// Link de resposta a proposta: segredo aleatório de 256 bits na parte # do URL.
// O fragmento não é enviado ao servidor pelo navegador nem no Referer.
export const proposalOrigin='https://civolten.vercel.app';
export const validProposalToken=token=>/^[0-9a-f]{64}$/.test(String(token||''));
export function createProposalToken(cryptoProvider=globalThis.crypto){
 if(!cryptoProvider?.getRandomValues)throw Error('Navegador não oferece aleatoriedade segura.');
 const bytes=cryptoProvider.getRandomValues(new Uint8Array(32));
 return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function proposalResponseUrl(token){
 if(!validProposalToken(token))throw Error('Código de resposta inválido');
 return proposalOrigin+'/aceite.html#t='+token;
}
export const proposalResponseLabel=status=>({
 pending:'Aguardando resposta do cliente',
 accepted:'Proposta aceita pelo cliente',
 declined:'Proposta recusada pelo cliente',
 revoked:'Link revogado',
 expired:'Prazo de resposta encerrado'})[status]||'Não enviada';
export function proposalValidUntil(budget,today=new Date()){
 const localDate=String(today.getFullYear())+'-'+String(today.getMonth()+1).padStart(2,'0')+
  '-'+String(today.getDate()).padStart(2,'0');
 const thirty=new Date(today.getFullYear(),today.getMonth(),today.getDate()+30);
 const limit=String(thirty.getFullYear())+'-'+String(thirty.getMonth()+1).padStart(2,'0')+
  '-'+String(thirty.getDate()).padStart(2,'0');
 if(budget?.expiresOn&&budget.expiresOn<localDate)
  throw Error('A proposta expirou. Duplique e atualize a validade antes de enviar.');
 return budget?.expiresOn&&budget.expiresOn<limit?budget.expiresOn:limit;
}
