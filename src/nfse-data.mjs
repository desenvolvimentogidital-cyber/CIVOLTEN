// CIVOLTEN NFS-e | Consulta pública de CNPJ/CEP e persistência isolada no Supabase.
// Nenhuma função deste módulo envia DPS, assina XML ou emite documento fiscal.
import {nfseHasCnpj,nfseIssues} from './nfse-ui.mjs';

export const NFSE_DRAFT_TABLE='cv_nfse_drafts_v1';
export const NFSE_CLIENT_TABLE='cv_nfse_clients_v1';
export const onlyDigits=v=>String(v??'').replace(/\D/g,'');
const fail=(msg)=>{throw Error(msg);};
const normalizeText=(v,max=180)=>String(v??'').trim().slice(0,max);
const waitFetch=async(url,fetcher)=>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetcher(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  if(!response.ok)fail(response.status===429?'Muitas consultas. Aguarde e tente novamente.':
   response.status===404?'Cadastro não encontrado nessa base pública. Informe manualmente.':
   'Serviço externo indisponível. Confira os dados manualmente.');
  return await response.json();
 }catch(err){
  if(err.name==='AbortError')fail('A consulta demorou demais. Informe manualmente ou tente novamente.');
  if(err instanceof SyntaxError)fail('Resposta da consulta inválida. Informe os dados manualmente.');
  if(err instanceof TypeError)fail('Falha de conexão. Você pode digitar os dados manualmente.');
  throw err;
 }finally{clearTimeout(timer);}
};
export async function lookupCnpj(cnpj,fetcher=fetch){
 const value=onlyDigits(cnpj);
 if(!nfseHasCnpj(value))fail('Digite um CNPJ válido com 14 dígitos.');
 const row=await waitFetch('https://brasilapi.com.br/api/cnpj/v1/'+value,fetcher);
 if(!row||typeof row!=='object'||!normalizeText(row.razao_social))
  fail('A consulta não retornou uma razão social. Confira os dados manualmente.');
 return {
  clientCnpj:value,clientName:normalizeText(row.razao_social),
  clientEmail:normalizeText(row.email,160),
  clientCep:normalizeText(row.cep,9),clientStreet:normalizeText(row.logradouro),
  clientNumber:normalizeText(row.numero,20),clientDistrict:normalizeText(row.bairro,100),
  clientCity:normalizeText(row.municipio,100),clientUf:normalizeText(row.uf,2),
  clientComplement:normalizeText(row.complemento,100),
  active:String(row.descricao_situacao_cadastral||'').toUpperCase().includes('ATIVA'),
  consultedAt:new Date().toISOString()
 };
}
export async function lookupCep(cep,fetcher=fetch){
 const value=onlyDigits(cep);
 if(value.length!==8)fail('Informe um CEP válido com oito dígitos.');
 const row=await waitFetch('https://viacep.com.br/ws/'+value+'/json/',fetcher);
 if(row?.erro===true||!row?.localidade||!row?.uf)
  fail('CEP não localizado. Confira o endereço e preencha manualmente.');
 return {
  cep:value.slice(0,5)+'-'+value.slice(5),
  street:normalizeText(row.logradouro),district:normalizeText(row.bairro,100),
  city:normalizeText(row.localidade,100),uf:normalizeText(row.uf,2)
 };
}
export function clientFromDraft(d){
 const cnpj=onlyDigits(d.clientCnpj);
 if(!nfseHasCnpj(cnpj)||!normalizeText(d.clientName))return null;
 return {cnpj,legal_name:normalizeText(d.clientName),email:normalizeText(d.clientEmail,160),
  address:{cep:normalizeText(d.clientCep,9),street:normalizeText(d.clientStreet),
   number:normalizeText(d.clientNumber,20),district:normalizeText(d.clientDistrict,100),
   city:normalizeText(d.clientCity,100),uf:normalizeText(d.clientUf,2),
   complement:normalizeText(d.clientComplement,100)}};
}
export function clientToDraft(row){
 return {clientCnpj:row.cnpj,clientName:row.legal_name,clientEmail:row.email||'',
  clientCep:row.address?.cep||'',clientStreet:row.address?.street||'',
  clientNumber:row.address?.number||'',clientDistrict:row.address?.district||'',
  clientCity:row.address?.city||'',clientUf:row.address?.uf||'',
  clientComplement:row.address?.complement||''};
}
function checkSession(client,userId){
 if(!client||!/^[a-f0-9-]{36}$/i.test(userId||''))fail('Faça login para salvar na sua conta.');
}
export async function loadNfseRecords(client,userId){
 checkSession(client,userId);
 const load=async(table)=>{
  const {data,error}=await client.from(table).select('*').eq('user_id',userId)
   .order('updated_at',{ascending:false}).range(0,99);
  if(error)fail('Não foi possível carregar os dados de NFS-e: '+error.message);
  return data||[];
 };
 const [rows,clients]=await Promise.all([load(NFSE_DRAFT_TABLE),load(NFSE_CLIENT_TABLE)]);
 return {drafts:rows.map(r=>({id:r.id,status:r.status,payload:r.payload||{},updatedAt:r.updated_at})),
  clients:clients.map(r=>({id:r.id,cnpj:r.cnpj,legal_name:r.legal_name,
   email:r.email||'',address:r.address||{},updatedAt:r.updated_at}))};
}
export async function saveNfseCloud(client,userId,id,d){
 checkSession(client,userId);
 const safeId=/^[a-f0-9-]{36}$/i.test(id||'')?id:crypto.randomUUID();
 // Não armazenar credenciais ou supostos retornos da API no rascunho.
 const payload=Object.fromEntries(Object.entries(d||{}).filter(([k])=>
  !['certificate','password','accessToken','xml','pdf','apiKey'].includes(k)));
 const ready=nfseIssues(payload,3).length===0;
 const {error}=await client.from(NFSE_DRAFT_TABLE).upsert({
  id:safeId,user_id:userId,payload,status:ready?'ready':'draft',updated_at:new Date().toISOString()
 }).select('id');
 if(error)fail('O rascunho não foi salvo na nuvem: '+error.message);
 return {id:safeId,status:ready?'ready':'draft'};
}
export async function saveNfseClient(client,userId,d,existingId=null){
 checkSession(client,userId);
 const data=clientFromDraft(d);
 if(!data)return false;
 const {error}=await client.from(NFSE_CLIENT_TABLE).upsert({
  ...data,id:existingId||crypto.randomUUID(),user_id:userId,updated_at:new Date().toISOString()
 },{onConflict:'user_id,cnpj'}).select('id');
 if(error)fail('Rascunho salvo, mas não foi possível cadastrar o cliente: '+error.message);
 return true;
}
export async function deleteNfseCloud(client,userId,id){
 checkSession(client,userId);
 if(!/^[a-f0-9-]{36}$/i.test(id||''))fail('Rascunho inválido.');
 const {data,error}=await client.from(NFSE_DRAFT_TABLE).delete().eq('id',id).eq('user_id',userId).select('id');
 if(error)fail('Não foi possível excluir o rascunho: '+error.message);
 if(!data?.length)fail('Rascunho não encontrado na sua conta.');
 return true;
}
