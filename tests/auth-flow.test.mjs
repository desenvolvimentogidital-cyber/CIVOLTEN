import test from 'node:test';
import assert from 'node:assert/strict';
import {signupOutcome,authMessage,repeatedSignupMessage,pendingEmailMessage} from '../src/auth-flow.mjs';
test('Supabase HTTP 200 com identities vazio significa cadastro repetido, não sucesso',()=>{
 assert.equal(signupOutcome({data:{user:{identities:[]},session:null}}),'repeated');
 assert.match(repeatedSignupMessage,/não foi criada uma conta nova/i);
});
test('novo cadastro sem sessão precisa confirmar e-mail',()=>{
 assert.equal(signupOutcome({data:{user:{identities:[{provider:'email'}]},session:null}}),'confirmation');
 assert.match(pendingEmailMessage,/confirme seu e-mail/i);
});
test('novo cadastro com sessão é autenticado',()=>{
 assert.equal(signupOutcome({data:{user:{identities:[{provider:'email'}]},session:{access_token:'teste'}}}),'signed-in');
 assert.equal(signupOutcome({data:{user:null,session:null}}),'no-user');
});
test('erros de login são exibidos de forma acessível sem revelar contas',()=>{
 const invalid=authMessage({code:'invalid_credentials',message:'Invalid login credentials'});
 assert.match(invalid,/Esqueci minha senha/);
 assert.match(authMessage({code:'email_not_confirmed'}),/não foi confirmado/);
 assert.match(authMessage({code:'over_email_send_rate_limit'}),/Limite temporário/);
});
