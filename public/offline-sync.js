/* Sincronizacao somente SOB ACAO EXPLICITA do usuario logado.
 * Rascunho local pode alterar apenas quantidade de serviço SIURB existente.
 * Notas offline nao vao para o servidor. Sem mutacao em segundo plano.
 */
import {getOfflineDraft,putOfflineDraft,pendingChanges,conflictsWithServer} from './offline-store.js';
export async function syncOfflineBudget(id,api){
 const draft=await getOfflineDraft(id);
 if(!draft)throw Error('Rascunho offline não encontrado');
 const changes=pendingChanges(draft);
 if(!changes.length)return {synced:0,notes_only:!!draft.notes};
 const path='budgets/'+encodeURIComponent(id);
 let current=await api(path);
 if(current.status!=='rascunho')throw Error('O orçamento não está mais em rascunho. Não foi sincronizado.');
 const conflicts=conflictsWithServer(draft,current);
 if(conflicts.length)throw Error('Conflito: '+conflicts.join(', ')+'. O orçamento foi alterado online. Confira antes de sincronizar.');
 let synced=0;
 for(const item of changes){
  // Revalidar cada escrita e lock_version do estado mais recente.
  const source=(current.items||[]).find(x=>x.id===item.id);
  if(!source||source.reference_price_id!==item.reference_price_id||
    Number(source.quantity)!==Number(item.baseline_quantity)||
    Number(source.direct_unit_cost)!==Number(item.unit_cost))
    throw Error('Conflito ao sincronizar '+item.description+'. Nenhum dado conflitante foi sobrescrito.');
  try{
   await api(path+'/siurb-items/'+encodeURIComponent(item.id),'PUT',{
    lock_version:current.lock_version,
    position:Number(source.position),quantity:item.quantity,
    reference_month:current.reference_month,regime:current.regime
   });
  }catch(e){throw Error('Sincronização interrompida no serviço '+item.description+': '+e.message)}
  item.baseline_quantity=item.quantity;
  await putOfflineDraft(draft);
  synced++;
  current=await api(path);
 }
 return {synced,notes_only:!!draft.notes};
}
