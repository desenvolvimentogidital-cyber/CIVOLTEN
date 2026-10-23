import {SUPABASE,KEY,json,sameOrigin,readBody,sessionCookie} from '../lib/civolten-security.mjs';
export default {async fetch(req){
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 if(!sameOrigin(req))return json({error:'Origem bloqueada'},403);
 try{
  const b=await readBody(req,3000),email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=b.password;
  if(email.length>180||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)
   return json({error:'Use e-mail válido e senha de pelo menos 12 caracteres.'},400);
  const redirect=new URL(req.url).origin+'/';
  const r=await fetch(SUPABASE+'/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{
   method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email,password}),signal:AbortSignal.timeout(13000)});
  if(r.status===429)return json({error:'Muitas tentativas. Tente mais tarde.'},429);
  if(!r.ok){
   const problem=await r.json().catch(()=>({}));
   if(problem.code==='email_exists'||problem.code==='user_already_exists')
    return json({error:'Este e-mail já está cadastrado. Entre com sua senha.'},409);
   return json({error:'Cadastro indisponível no momento.'},502);
  }
  const data=await r.json();
  // Com "Confirm email" desligado, o Supabase fornece access_token e entra direto.
  // Com confirmação ligada, a identidade ainda NÃO pode receber uma sessão.
  if(typeof data.access_token==='string'&&data.access_token.length>60){
   return json({authenticated:true,message:'Conta criada. Bem-vindo ao painel!'},200,{
    'Set-Cookie':sessionCookie(data.access_token,Math.max(60,Math.min(3300,Number(data.expires_in)||3300)))
   });
  }
  return json({authenticated:false,confirmation_required:true,
   message:'Conta criada! Confirme o endereço de e-mail no link recebido para entrar no painel. Nenhuma aprovação administrativa é necessária.'});
 }catch{return json({error:'Não foi possível concluir o cadastro.'},502)}
}};
