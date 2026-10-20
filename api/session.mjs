import {SUPABASE,KEY,json,sameOrigin,browserAllowed,readBody,cookieToken,sessionCookie,clearCookie,authorized} from '../lib/civolten-security.mjs';
export default {async fetch(r){
 if(r.method==='GET'){
  if(!browserAllowed(r))return json({error:'Origem bloqueada'},403);
  const token=cookieToken(r);
  if(await authorized(token))return json({authenticated:true,pending:false});
  if(token){
   try{const user=await fetch(SUPABASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
    if(user.ok)return json({authenticated:false,pending:true})}catch{}
  }
  return json({authenticated:false,pending:false});
 }
 if(r.method==='DELETE')return sameOrigin(r)?json({authenticated:false},200,{'Set-Cookie':clearCookie()}):json({error:'Origem bloqueada'},403);
 if(r.method!=='POST')return json({error:'Método não permitido'},405);
 if(!sameOrigin(r))return json({error:'Origem bloqueada'},403);
 try{
  const b=await readBody(r,3000);
  if(typeof b.email!=='string'||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)||b.email.length>180||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return json({error:'Credenciais inválidas'},400);
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);let a;
  try{a=await fetch(SUPABASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:b.email.trim(),password:b.password}),signal:c.signal})}finally{clearTimeout(timer)}
  if(!a.ok)return json({error:'E-mail ou senha inválidos'},401);
  const v=await a.json();if(!v.access_token)return json({error:'Não foi possível iniciar a sessão'},401);
  const admin=await authorized(v.access_token);
  return json({authenticated:admin,pending:!admin},200,{'Set-Cookie':sessionCookie(v.access_token,Math.max(60,Math.min(3300,Number(v.expires_in)||3300)))});
 }catch{return json({error:'Não foi possível autenticar'},400)}
}};
