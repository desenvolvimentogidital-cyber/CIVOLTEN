import {SUPABASE,KEY,json,sameOrigin,browserAllowed,readBody,cookieToken,sessionCookie,clearCookie,authenticatedUser} from '../lib/civolten-security.mjs';
const tokenPattern=/^[A-Za-z0-9._~-]{60,8192}$/;
export default {async fetch(r){
 if(r.method==='GET'){
  if(!browserAllowed(r))return json({error:'Origem bloqueada'},403);
  const user=await authenticatedUser(cookieToken(r));
  return json(user?{authenticated:true,email:user.email}:{authenticated:false});
 }
 if(r.method==='DELETE')return sameOrigin(r)?
  json({authenticated:false},200,{'Set-Cookie':clearCookie()}):json({error:'Origem bloqueada'},403);
 if(r.method!=='POST')return json({error:'Método não permitido'},405);
 if(!sameOrigin(r))return json({error:'Origem bloqueada'},403);
 try{
  const b=await readBody(r,8500);
  // Após confirmação por e-mail, o Supabase pode redirecionar com um token
  // no fragmento: verificar esse token no servidor antes de criar cookie HttpOnly.
  if(Object.prototype.hasOwnProperty.call(b,'access_token')){
   if(typeof b.access_token!=='string'||!tokenPattern.test(b.access_token))return json({error:'Sessão inválida'},401);
   const user=await authenticatedUser(b.access_token);
   if(!user)return json({error:'Sessão inválida ou expirada'},401);
   return json({authenticated:true,email:user.email},200,{'Set-Cookie':sessionCookie(b.access_token,3300)});
  }
  if(typeof b.email!=='string'||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)||b.email.length>180||typeof b.password!=='string'||b.password.length<12||b.password.length>128)
   return json({error:'Credenciais inválidas'},400);
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);let a;
  try{a=await fetch(SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',
   headers:{apikey:KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email:b.email.trim(),password:b.password}),signal:ctl.signal})}finally{clearTimeout(timer)}
  if(!a.ok)return json({error:'E-mail ou senha inválidos'},401);
  const tokens=await a.json();
  if(!tokens.access_token||!tokenPattern.test(tokens.access_token))return json({error:'Não foi possível iniciar a sessão'},401);
  return json({authenticated:true},200,{'Set-Cookie':sessionCookie(tokens.access_token,Math.max(60,Math.min(3300,Number(tokens.expires_in)||3300)))});
 }catch{return json({error:'Não foi possível autenticar'},400)}
}};
