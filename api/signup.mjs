import {SUPABASE,KEY,json,sameOrigin,readBody} from '../lib/civolten-security.mjs';
export default {async fetch(req){
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 if(!sameOrigin(req))return json({error:'Origem bloqueada'},403);
 try{
  const b=await readBody(req,3000),email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=b.password;
  if(email.length>180||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)return json({error:'Use e-mail válido e senha de pelo menos 12 caracteres.'},400);
  const redirect=new URL(req.url).origin+'/';
  const r=await fetch(SUPABASE+'/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{
   method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email,password}),signal:AbortSignal.timeout(13000)});
  if(r.status===429)return json({error:'Muitas tentativas. Tente mais tarde.'},429);
  if(!r.ok){
   const problem=await r.json().catch(()=>({}));
   if(problem.code==='email_exists'||problem.code==='user_already_exists')return json({sent:true});
   return json({error:'Cadastro indisponível no momento. Confira as configurações de autenticação do Supabase.'},502);
  }
  return json({sent:true,message:'Confira seu e-mail, confirme o cadastro e depois faça login para solicitar autorização.'});
 }catch{return json({error:'Não foi possível solicitar o cadastro.'},502)}
}};