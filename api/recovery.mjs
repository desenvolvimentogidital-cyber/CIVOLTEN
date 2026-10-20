import {SUPABASE,KEY,json,sameOrigin,readBody} from '../lib/civolten-security.mjs';
export default {async fetch(req){
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 if(!sameOrigin(req))return json({error:'Origem bloqueada'},403);
 try{
  const b=await readBody(req,2500),action=b.action;
  if(action==='request'){
   const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
   if(email.length>180||!/^\S+@\S+\.\S+$/.test(email))return json({error:'Informe um e-mail válido'},400);
   const u=new URL(req.url);
   const redirect=u.origin+'/';
   const r=await fetch(SUPABASE+'/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email}),signal:AbortSignal.timeout(13000)});
   if(r.status===429)return json({error:'Muitas tentativas de recuperação. Tente mais tarde.'},429);
   if(!r.ok)return json({error:'Não foi possível enviar a recuperação; confira as configurações de redirecionamento de e-mail do Supabase.'},502);
   return json({sent:true,message:'Se a conta existir, você receberá um e-mail com as instruções.'});
  }
  if(action==='update'){
   const jwt=typeof b.access_token==='string'?b.access_token:'',password=b.password;
   if(!/^[A-Za-z0-9._~-]{60,8192}$/.test(jwt)||typeof password!=='string'||password.length<12||password.length>128)
    return json({error:'Link de recuperação inválido ou senha curta'},400);
   const check=await fetch(SUPABASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(13000)});
   if(!check.ok)return json({error:'Link expirado. Solicite outro.'},401);
   const response=await fetch(SUPABASE+'/auth/v1/user',{method:'PUT',
    headers:{apikey:KEY,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
    body:JSON.stringify({password}),signal:AbortSignal.timeout(13000)});
   if(!response.ok)return json({error:'Não foi possível alterar a senha. Experimente uma senha diferente.'},400);
   return json({updated:true});
  }
  return json({error:'Ação inválida'},400);
 }catch{return json({error:'Não foi possível concluir. Tente novamente.'},502)}
}};