// Respostas seguras para o fluxo do Supabase Auth.
// Uma inscrição repetida pode retornar 200 com usuário ofuscado: NÃO é conta nova.
export function signupOutcome(result){
 if(result?.error)return 'error';
 const user=result?.data?.user;
 if(!user)return 'no-user';
 if(Array.isArray(user.identities)&&user.identities.length===0)return 'repeated';
 if(!result?.data?.session)return 'confirmation';
 return 'signed-in';
}
export function authMessage(error,kind='login'){
 const code=String(error?.code||'').toLowerCase();
 if(code==='invalid_credentials'){
  return 'E-mail ou senha não conferem. Se você já tinha uma conta, toque em "Esqueci minha senha" para recuperar o acesso.';
 }
 if(code==='email_not_confirmed'){
  return 'Seu e-mail ainda não foi confirmado. Abra o link de confirmação recebido no e-mail antes de entrar.';
 }
 if(code==='user_already_exists'||code==='email_exists'||code==='user_already_registered'){
  return 'Não foi possível criar outra conta com esse e-mail. Se já tem cadastro, entre ou recupere sua senha.';
 }
 if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit'){
  return 'Limite temporário de tentativas ou e-mails. Evite repetir a solicitação e tente novamente mais tarde.';
 }
 if(code==='signup_disabled'||code==='email_provider_disabled'){
  return 'Cadastro por e-mail indisponível nesta configuração. Fale com o administrador do aplicativo.';
 }
 if(kind==='reset'){
  return 'Não foi possível enviar a recuperação agora. Confira o e-mail e tente novamente.';
 }
 return String(error?.message||'Não foi possível autenticar. Tente novamente.');
}
export const repeatedSignupMessage=
 'Não foi criada uma conta nova com esse e-mail. Se ele já tinha cadastro, use "Entrar" ou "Esqueci minha senha".';
export const pendingEmailMessage=
 'Cadastro recebido. Confira a caixa de entrada e o spam, confirme seu e-mail e depois faça login.';
