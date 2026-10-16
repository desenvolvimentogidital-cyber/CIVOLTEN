import {SUPABASE,PUBLIC_KEY,json,sameOrigin,browserAllowed,readBody,cookieToken,sessionCookie,clearCookie,authorized} from '../lib/civolten-security.mjs';
// Login: JWT somente em cookie HttpOnly; sessão curta; sem refresh token no navegador.
export default {async fetch(req){
 if(req.method==='GET'){
  if(!browserAllowed(req))return json({error:'Origem bloqueada'},403);
  return json({authenticated:await authorized(cookieToken(req))});
 }
 if(req.method==='DELETE'){
  if(!sameOrigin(req))return json({error:'Origem bloqueada'},403);
  return json({authenticated:false},200,{'Set-Cookie':clearCookie()});
 }
 if(req.method!=='POST')return json({error:'Método não permitido'},405,{'Allow':'GET,POST,DELETE'});
 if(!sameOrigin(req))return json({error:'Origem bloqueada'},403);
 try{
  const body=await readBody(req,3000);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=body.password;
  if(email.length>180||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)
   return json({error:'Credenciais inválidas'},400);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  let response;
  try{
   response=await fetch(SUPABASE+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password}),signal:ctrl.signal
   });
  }finally{clearTimeout(timer)}
  if(!response.ok)return json({error:'E-mail, senha ou permissão inválidos'},401);
  const data=await response.json();
  if(!data.access_token||!await authorized(data.access_token))return json({error:'Acesso restrito ao administrador'},403);
  const maxAge=Math.max(60,Math.min(3300,Number(data.expires_in)||3300));
  return json({authenticated:true},200,{'Set-Cookie':sessionCookie(data.access_token,maxAge)});
 }catch{return json({error:'Não foi possível autenticar. Tente novamente.'},400)}
}};
