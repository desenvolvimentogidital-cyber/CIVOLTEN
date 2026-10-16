import {EDGE,json,sameOrigin,browserAllowed,readBody,cookieToken} from '../lib/civolten-security.mjs';
// O endpoint Supabase revalida o usuário e role a cada operação.
const endpoints={'admin-me':['GET'],'admin-list':['GET'],'admin-pricing':['GET','POST'],'admin-status':['POST'],'admin-media':['GET']};
export default {async fetch(req){
 const url=new URL(req.url),action=url.searchParams.get('action');
 if(!endpoints[action]?.includes(req.method))return json({error:'Rota não permitida'},404);
 if(req.method==='POST'?!sameOrigin(req):!browserAllowed(req))
  return json({error:'Origem bloqueada'},403);
 const jwt=cookieToken(req);
 if(!jwt)return json({error:'Sessão expirada. Entre novamente.'},401);
 try{
  const dst=new URL(EDGE);dst.searchParams.set('api',action);
  if(action==='admin-media'){
   const id=url.searchParams.get('id'),path=url.searchParams.get('path');
   if(!/^[0-9a-f-]{36}$/i.test(id||'')||typeof path!=='string'||path.length>400)
    return json({error:'Anexo inválido'},400);
   dst.searchParams.set('id',id);dst.searchParams.set('path',path);
  }
  const headers={Authorization:'Bearer '+jwt};
  let payload;
  if(req.method==='POST'){
   const body=await readBody(req,12000);
   headers['Content-Type']='application/json';
   payload=JSON.stringify(body);
  }
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  let r;
  try{r=await fetch(dst,{method:req.method,headers,body:payload,signal:ctrl.signal})}
  finally{clearTimeout(timer)}
  const response=await r.json().catch(()=>({error:'Resposta inválida do servidor'}));
  return json(response,r.status);
 }catch{return json({error:'Falha temporária do servidor.'},502)}
}};
