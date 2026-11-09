// Central de Respostas CIVOLTEN: classificação e busca separadas dos orçamentos.
import {proposalResponseLabel} from './proposal-link.mjs';
export const responded=i=>i?.status==='accepted'||i?.status==='declined';
export const responseSeen=(data,i)=>!!(data.reads||[]).find(r=>r.inviteId===i?.id);
export const unreadReplies=data=>(data?.invites||[]).filter(i=>responded(i)&&!responseSeen(data,i));
export const normalizedSearch=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().trim();
export function responseRecords(data){
 const budgetById=new Map((data?.budgets||[]).map(b=>[b.id,b]));
 const workByBudget=new Map((data?.works||[]).map(w=>[w.budgetId,w]));
 return (data?.invites||[]).map(invite=>{
  const budget=budgetById.get(invite.budgetId)||invite.budgetSnapshot||{};
  const work=workByBudget.get(invite.budgetId)||null;
  return {invite,budget,work,unread:responded(invite)&&!responseSeen(data,invite),
   customer:String(budget.customer||invite.budgetSnapshot?.customer||'Cliente não informado'),
   project:String(budget.project||budget.title||'Obra não informada'),
   title:String(budget.title||'Proposta comercial'),
   responder:String(invite.respondentName||''),
   status:invite.status,
   label:proposalResponseLabel(invite.status),
   when:String(invite.respondedAt||invite.createdAt||'')
  };
 }).sort((a,b)=>Number(b.unread)-Number(a.unread)||
   b.when.localeCompare(a.when)||a.customer.localeCompare(b.customer,'pt-BR'));
}
export function selectResponses(data,filter='all',search=''){
 const term=normalizedSearch(search);
 return responseRecords(data).filter(r=>{
  if(filter==='new'&&!r.unread)return false;
  if(['accepted','declined','pending'].includes(filter)&&r.status!==filter)return false;
  if(!term)return true;
  const v=[r.customer,r.project,r.title,r.responder,r.invite.respondentEmail,
   r.invite.budgetId,r.work?.contractRef].map(normalizedSearch).join(' ');
  return v.includes(term);
 });
}
export function replyCounts(data){
 const records=responseRecords(data);
 return {all:records.length,new:records.filter(r=>r.unread).length,
  accepted:records.filter(r=>r.status==='accepted').length,
  declined:records.filter(r=>r.status==='declined').length,
  pending:records.filter(r=>r.status==='pending').length};
}
