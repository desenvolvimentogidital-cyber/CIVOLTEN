/* Transactional account e-mail. All tokens remain in the URL fragment or
 * body only at the recipient: never log them or expose them in API results.
 * No paid provider is required in tests (inject sendAccountEmail).
 */
const kinds={
 verify:{subject:'Confirme seu e-mail na CIVOLTEN',key:'verify'},
 reset:{subject:'Redefina sua senha CIVOLTEN',key:'reset'}
};
export function accountMailReady(env=process.env){
 try{
  const origin=new URL(env.CIVOLTEN_PUBLIC_ORIGIN||'');
  return origin.protocol==='https:'&&origin.pathname==='/'&&
   !!env.RESEND_API_KEY&&!!env.CIVOLTEN_MAIL_FROM;
 }catch{return false}
}
export async function sendAccountEmail({to,kind,token,env=process.env,fetcher=fetch}){
 if(!accountMailReady(env))throw Object.assign(new Error('Envio de e-mail ainda não configurado'),{status:503});
 if(!kinds[kind]||!/^[a-f0-9]{64}$/.test(token)||typeof to!=='string'||to.length>120)
  throw Object.assign(new Error('Solicitação de e-mail inválida'),{status:400});
 const origin=new URL(env.CIVOLTEN_PUBLIC_ORIGIN);
 const link=origin.origin+'/secure.html#'+kinds[kind].key+'='+encodeURIComponent(token);
 const body={from:env.CIVOLTEN_MAIL_FROM,to:[to],subject:kinds[kind].subject,
  text:(kind==='verify'?'Confirme sua conta':'Solicitação para criar uma senha nova')+
   '\n\nAcesse este endereço (válido por tempo limitado):\n'+link+
   '\n\nCaso não tenha solicitado, ignore esta mensagem.'};
 // Do not reveal provider credentials, token or recipient in thrown errors.
 const response=await fetcher('https://api.resend.com/emails',{
  method:'POST',headers:{'Content-Type':'application/json',
   'Authorization':'Bearer '+env.RESEND_API_KEY},
  body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Object.assign(new Error('Serviço de e-mail indisponível'),{status:503});
 return {accepted:true};
}
