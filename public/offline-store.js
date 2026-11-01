/* CIVOLTEN — armazenamento LOCAL voluntario, sem sessao, CPF, clientes ou senhas.
 * IndexedDB nao e criptografado: use somente em dispositivo pessoal protegido.
 * Nunca faz upload automatico.
 */
const DB='civolten-drafts-v1',STORE='snapshots';
const TENANT_LOCK='civolten-isolated-account-offline-locked';
export function lockOfflineForIsolatedAccounts(){
 // Browser storage is not encrypted: block old unscoped drafts as soon as a
 // tenant identity is detected. Do not silently delete unfinished local work.
 if(typeof localStorage!=='undefined')localStorage.setItem(TENANT_LOCK,'1');
}
export function offlineLocked(){
 try{return typeof localStorage!=='undefined'&&localStorage.getItem(TENANT_LOCK)==='1'}
 catch{return true}
}
const fail=msg=>{throw new Error(msg)};
const text=v=>String(v??'').trim();
export function pendingChanges(snapshot){
 return (snapshot?.items||[]).filter(item=>item.reference_price_id&&
  Number(item.quantity)!==Number(item.baseline_quantity));
}
export function normalizeBudgetSnapshot(detail){
 if(!detail?.id||!detail?.code||!Array.isArray(detail.items))fail('Orçamento incompleto');
 if(detail.items.length>500)fail('Muitos itens para o modo offline');
 if(detail.status!=='rascunho')fail('O modo offline permite editar somente rascunhos');
 return {id:text(detail.id),code:text(detail.code).slice(0,90),status:detail.status,
  saved_at:new Date().toISOString(),notes:'',items:detail.items.map(item=>({
   id:text(item.id),reference_price_id:item.reference_price_id?text(item.reference_price_id):null,
   code:text(item.source_code).slice(0,80),description:text(item.source_name).slice(0,450),
   unit:text(item.unit).slice(0,25),
   unit_cost:String(item.direct_unit_cost??'0').slice(0,35),
   quantity:String(item.quantity).slice(0,35),
   baseline_quantity:String(item.quantity).slice(0,35),
   position:Number(item.position)||0
  }))};
}
export function validateOfflineQuantity(value){
 const n=Number(value);
 if(!/^\d+(?:\.\d{1,6})?$/.test(String(value).trim())||!Number.isFinite(n)||n<=0||n>1e10)
  fail('Quantidade inválida (maior que zero e até 6 casas decimais)');
 return String(value).trim();
}
export function conflictsWithServer(draft,current){
 const origin=new Map((current?.items||[]).map(x=>[String(x.id),x]));
 return pendingChanges(draft).flatMap(item=>{
  const remote=origin.get(item.id);
  if(!remote||remote.reference_price_id!==item.reference_price_id||
   Number(remote.quantity)!==Number(item.baseline_quantity)||
   Number(remote.direct_unit_cost)!==Number(item.unit_cost))
   return [item.description||item.code||item.id];
  return [];
 });
}
export function openOfflineDB(){
 if(offlineLocked())return Promise.reject(new Error('Cópias offline bloqueadas para contas de empresas diferentes; proteja os dados e utilize o painel online.'));
 if(!('indexedDB' in globalThis))return Promise.reject(new Error('Armazenamento offline indisponível neste navegador'));
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Falha no banco local'));
 });
}
async function storage(mode,fn){
 const db=await openOfflineDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),request=fn(store);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  tx.onabort=()=>reject(tx.error||new Error('Transação offline abortada'));
 })}finally{db.close()}
}
export const listOfflineDrafts=async()=>(await storage('readonly',s=>s.getAll())).sort((a,b)=>b.saved_at.localeCompare(a.saved_at));
export const getOfflineDraft=id=>storage('readonly',s=>s.get(id));
export const removeOfflineDraft=id=>storage('readwrite',s=>s.delete(id));
export async function putOfflineDraft(draft){
 if(!draft||!draft.id||!Array.isArray(draft.items))fail('Rascunho inválido');
 if(draft.notes&&draft.notes.length>2000)fail('Anotações ultrapassam 2000 caracteres');
 if(draft.items.length>500)fail('Máximo de 500 serviços');
 for(const item of draft.items)validateOfflineQuantity(item.quantity);
 draft.saved_at=new Date().toISOString();
 await storage('readwrite',s=>s.put(draft));
 return draft;
}
export async function saveBudgetForOffline(detail){
 const existing=await getOfflineDraft(detail.id);
 if(existing&&pendingChanges(existing).length)
  fail('Há alterações offline pendentes. Sincronize ou descarte o rascunho antes de atualizar a cópia.');
 const snapshot=normalizeBudgetSnapshot(detail);
 if(existing?.notes)snapshot.notes=existing.notes;
 return putOfflineDraft(snapshot);
}
