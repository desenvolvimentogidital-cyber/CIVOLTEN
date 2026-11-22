// Fase 5: bloqueio explícito de emissão fiscal até a configuração de um emissor autorizado.
// O frontend nunca recebe certificado, token fiscal ou chave privada.
import {nfseIssues} from './nfse-ui.mjs';

export function nfseEmissionReadiness(draft,provider={}){
 const issues=nfseIssues(draft||{},3);
 const blockers=issues.map(issue=>typeof issue==='string'?issue:String(issue?.message||issue));
 if(provider.mode!=='server')blockers.push('Emissão real indisponível: configure um emissor fiscal no servidor.');
 if(provider.credentialsVerified!==true)blockers.push('Credenciais fiscais não verificadas no servidor.');
 if(provider.municipalitySupported!==true)blockers.push('Município e regime tributário ainda não homologados no emissor.');
 if(provider.environment!=='production')blockers.push('Ambiente de produção fiscal não homologado.');
 if(provider.authorized!==true)blockers.push('Autorização do prestador para emitir NFS-e não comprovada.');
 return {ready:blockers.length===0,blockers};
}
