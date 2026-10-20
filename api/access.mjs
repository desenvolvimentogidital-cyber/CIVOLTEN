import {SUPABASE,KEY,EDGE,json,sameOrigin,readBody,cookieToken,authorized} from '../lib/civolten-security.mjs';
const authURL=SUPABASE+'/auth/v1';
const headers=token=>({apikey:KEY,Authorization:'Bearer '+token,Accept:'application/json'});
async function getUser(jwt){
 if(!jwt)return null;
 const r=await fetch(authURL+'/user',{headers:headers(jwt),signal:AbortSignal.timeout(10000)});
 return r.ok?await r.json():null;
}
export default {async fetch(req){
 if(req.method!=='POST'&&req.method!=='GET')return json({error:'Método não permitido'},405);
 if(req.method==='POST'&&!sameOrigin(req))return json({error:'Origem bloqueada'},403);
 const url=new URL(req.url),action=url.searchParams.get('action'),jwt=cookieToken(req);
 try{
  if(req.method==='GET'&&action==='list'){
   if(!await authorized(jwt))return json({error:'Somente administrador'},403);
   const r=await fetch(SUPABASE+'/rest/v1/cv_access_requests?select=user_id,email,status,requested_at&status=eq.pending&order=requested_at.desc&limit=100',{headers:headers(jwt),signal:AbortSignal.timeout(12000)});
   if(!r.ok)return json({error:'Não foi possível consultar solicitações'},502);
   return json({rows:await r.json()});
  }
  if(req.method==='GET'&&action==='status'){
   const user=await getUser(jwt);
   if(!user)return json({authenticated:false});
   return json({authenticated:true,pending:!(await authorized(jwt))});
  }
  if(req.method==='POST'&&action==='request'){
   const user=await getUser(jwt);
   if(!user||!user.email_confirmed_at)return json({error:'Confirme seu e-mail e entre novamente.'},403);
   if(await authorized(jwt))return json({status:'approved'});
   const post=await fetch(SUPABASE+'/rest/v1/cv_access_requests',{
    method:'POST',headers:{...headers(jwt),'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
    body:JSON.stringify({user_id:user.id,email:user.email,status:'pending'}),signal:AbortSignal.timeout(13000)});
   if(!post.ok)return json({error:'Não foi possível registrar a solicitação'},502);
   return json({status:'pending'});
  }
  if(req.method==='POST'&&action==='approve'){
   if(!await authorized(jwt))return json({error:'Somente administrador'},403);
   const body=await readBody(req,1000);
   const user_id=body.user_id;
   if(typeof user_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id))return json({error:'Solicitação inválida'},400);
   const r=await fetch(SUPABASE+'/rest/v1/rpc/cv_approve_access_request',{
    method:'POST',headers:{...headers(jwt),'Content-Type':'application/json'},
    body:JSON.stringify({p_user_id:user_id}),signal:AbortSignal.timeout(13000)});
   if(!r.ok)return json({error:'Não foi possível aprovar a conta. Verifique se o e-mail foi confirmado.'},400);
   return json({approved:true});
  }
  return json({error:'Ação inválida'},404);
 }catch{return json({error:'Falha ao verificar sua solicitação'},502)}
}};