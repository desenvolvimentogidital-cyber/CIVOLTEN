import test from 'node:test';
import assert from 'node:assert/strict';
import {accountMailReady,sendAccountEmail} from '../src/account-mail.mjs';
const token='a'.repeat(64);
const env={CIVOLTEN_PUBLIC_ORIGIN:'https://civolten.vercel.app/',
 RESEND_API_KEY:'fake-key-not-real',CIVOLTEN_MAIL_FROM:'CIVOLTEN <no-reply@example.test>'};
test('envio de verificação opcional exige origem HTTPS, remetente e chave do provedor',()=>{
 assert.equal(accountMailReady(env),true);
 assert.equal(accountMailReady({...env,RESEND_API_KEY:''}),false);
 assert.equal(accountMailReady({...env,CIVOLTEN_MAIL_FROM:''}),false);
 assert.equal(accountMailReady({...env,CIVOLTEN_PUBLIC_ORIGIN:'http://civolten.vercel.app/'}),false);
});
test('mensagem usa token em fragmento e nunca tenta enviar e-mail durante o teste',async()=>{
 const captured=[];
 const out=await sendAccountEmail({to:'contato@example.test',kind:'verify',token,env,
  fetcher:async(url,opts)=>{captured.push({url,opts});return {ok:true}}});
 assert.equal(out.accepted,true);
 assert.equal(captured.length,1);
 assert.equal(captured[0].url,'https://api.resend.com/emails');
 assert.equal(captured[0].opts.headers.Authorization,'Bearer fake-key-not-real');
 const body=JSON.parse(captured[0].opts.body);
 assert.deepEqual(body.to,['contato@example.test']);
 assert.match(body.text,/secure\.html#verify=a{64}/);
 assert.equal(body.text.includes('http://'),false);
});
test('reset usa fragmento próprio e falha fechado quando e-mail não está configurado',async()=>{
 const messages=[];
 await sendAccountEmail({to:'contato@example.test',kind:'reset',token,env,
  fetcher:async(url,opts)=>{messages.push(JSON.parse(opts.body));return {ok:true}}});
 assert.match(messages[0].text,/secure\.html#reset=a{64}/);
 await assert.rejects(()=>sendAccountEmail({to:'contato@example.test',kind:'verify',token,
  env:{...env,RESEND_API_KEY:''},fetcher:async()=>{throw Error('não deve executar')}}),/não configurado/);
});
test('erro do provedor não expõe token, e-mail ou segredo',async()=>{
 await assert.rejects(()=>sendAccountEmail({to:'contato@example.test',kind:'verify',token,env,
  fetcher:async()=>({ok:false,status:403})}),e=>
   e.status===503&&!String(e.message).includes('fake-key')&&!String(e.message).includes(token));
});
