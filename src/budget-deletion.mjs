// Exclusão do cadastro de orçamento sem apagar o histórico contratual.
export function budgetDeletionContext(data,id){
 const invites=(data?.invites||[]).filter(i=>i.budgetId===id);
 const works=(data?.works||[]).filter(w=>w.budgetId===id);
 return {invites,works,pending:invites.filter(i=>i.status==='pending').length};
}
export function budgetDeletionPrompt(budget,data){
 const context=budgetDeletionContext(data,budget.id);
 const paragraphs=[
  'Deseja excluir PERMANENTEMENTE o orçamento "'+String(budget.title||'Sem título')+'"?',
  'Esta ação remove o orçamento da sua conta e não poderá ser desfeita.'
 ];
 if(context.pending)paragraphs.push('Os links de aceite ainda aguardando resposta serão revogados.');
 if(context.invites.length||context.works.length)
  paragraphs.push('Importante: o histórico de aceites, as ordens de serviço, medições e lançamentos financeiros vinculados serão PRESERVADOS. Eles não serão excluídos junto com o orçamento.');
 if(context.invites.some(i=>i.status==='accepted')&&!context.works.length)
  paragraphs.push('Atenção: o aceite já registrado ficará no histórico, mas não será possível abrir uma nova ordem de serviço a partir do orçamento apagado.');
 return paragraphs.join('\n\n')+'\n\nConfirmar exclusão?';
}
