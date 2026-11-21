// CIVOLTEN NFS-e Nacional — preparação segura, sem comunicação com a SEFIN.
// A emissão real depende de backend privado, certificado, credenciamento e homologação.
import {nfseFieldErrors} from './nfse-ui.mjs';

export const NFSE_STATES=Object.freeze({
 DRAFT:'draft',READY:'ready',SUBMITTING:'submitting',AUTHORIZED:'authorized',
 REJECTED:'rejected',UNKNOWN:'unknown',CANCELLED:'cancelled'
});
const onlyDigits=value=>String(value??'').replace(/\D/g,'');
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const text=(value,max)=>String(value??'').trim().slice(0,max);
const moneyCents=value=>{
 const raw=String(value??'').trim();
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw))throw Error('Valor monetário inválido.');
 const [whole,decimal='']=raw.replace(',','.').split('.');
 const cents=BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
 if(cents<=0n||cents>999999999999n)throw Error('Valor fora do limite permitido.');
 return Number(cents);
};
export function prepareNfseRequest(d){
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Rascunho inválido.');
 const errors=nfseFieldErrors(d,3);
 if(Object.keys(errors).length)throw Error('Revise os campos fiscais: '+Object.values(errors).join(' '));
 // Snapshot imutável: nunca transportar senha, chave, certificado ou dados arbitrários.
 const snapshot={
  issuer:{name:text(d.issuerName,160),cnpj:onlyDigits(d.issuerCnpj),regime:d.regime},
  recipient:{name:text(d.clientName,180),document:onlyDigits(d.clientCnpj),
   email:text(d.clientEmail,160),address:{cep:onlyDigits(d.clientCep),city:text(d.clientCity,100),
   uf:text(d.clientUf,2),street:text(d.clientStreet,180),number:text(d.clientNumber,20)}},
  service:{description:text(d.description,2000),amountCents:moneyCents(d.amount),
   competence:d.competence,nationalCode:onlyDigits(d.serviceCode),nbs:onlyDigits(d.nbs),
   city:text(d.serviceCity,100)},
  work:{type:d.workType,code:text(d.workCode,60),cep:onlyDigits(d.cep),
   city:text(d.city,100),uf:text(d.uf,2),street:text(d.street,180),number:text(d.number,20)},
  taxation:{issRetention:d.issRetention,ibsCbs:d.ibsCbs,taxStatus:d.taxStatus,
   specialRegime:d.specialRegime,issSuspended:d.issSuspended,
   issBenefit:d.issBenefit,issDeduction:d.issDeduction}
 };
 return structuredClone(snapshot);
}
export function nfseActivationReadiness(config={}){
 // Informações apenas de estado: jamais receba ou exponha os segredos propriamente ditos.
 const checks={
  backendConfigured:config.backendConfigured===true,
  credentialConfigured:config.credentialConfigured===true,
  certificateConfigured:config.certificateConfigured===true,
  issuerAccredited:config.issuerAccredited===true,
  restrictedEnvironmentApproved:config.restrictedEnvironmentApproved===true,
  productionApproved:config.productionApproved===true
 };
 return {ready:Object.values(checks).every(Boolean),checks,
  missing:Object.keys(checks).filter(key=>!checks[key])};
}
export function nfseTransition(current,event,confirmation={}){
 const state=current||NFSE_STATES.DRAFT;
 const transitions={
  draft:{validate:'ready'},
  ready:{edit:'draft',submit:'submitting'},
  submitting:{authorize:'authorized',reject:'rejected',timeout:'unknown'},
  unknown:{reconcileAuthorized:'authorized',reconcileRejected:'rejected'},
  rejected:{edit:'draft'},
  authorized:{cancel:'cancelled'}
 };
 if(!own(transitions,state)||!own(transitions[state],event))throw Error('Transição fiscal não permitida.');
 const next=transitions[state][event];
 if(event==='submit'&&!nfseActivationReadiness(confirmation).ready)
  throw Error('Emissão bloqueada: backend, credenciamento, certificado e homologação pendentes.');
 if(['authorize','reconcileAuthorized'].includes(event)&&
  (!/^[0-9]{44,50}$/.test(String(confirmation.accessKey||''))||confirmation.officialConfirmation!==true))
  throw Error('Autorização só pode ser registrada após confirmação oficial da SEFIN.');
 if(event==='cancel'&&confirmation.officialConfirmation!==true)
  throw Error('Cancelamento exige confirmação oficial.');
 return next;
}
