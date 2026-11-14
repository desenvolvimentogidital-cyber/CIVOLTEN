// CIVOLTEN | Proteções de consistência entre proposta e cronograma.
const stable=value=>{
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 }
 return value;
};
const fingerprint=budget=>JSON.stringify(stable({
 title:budget?.title,customer:budget?.customer,project:budget?.project,
 location:budget?.location,notes:budget?.notes,expiresOn:budget?.expiresOn,
 items:budget?.items,commercial:budget?.commercial,pricing:budget?.pricing
}));
export function proposalReference(budget){
 if(!budget?.id||!/^[a-f0-9-]{8,}$/i.test(budget.id))return 'PRÉVIA';
 const year=/^\d{4}/.test(budget.createdAt||'')?budget.createdAt.slice(0,4):'';
 return 'PC-'+(year||'SEM-DATA')+'-'+budget.id.slice(0,8).toUpperCase();
}
export function assertSavedBudgetForPdf(draft,saved){
 if(!draft?.id||!saved||draft.id!==saved.id)
  throw Error('Salve o orçamento primeiro, depois reabra para gerar a proposta e o cronograma oficiais.');
 if(draft.demo!==false||draft.items?.some(i=>i.source==='demo'))
  throw Error('Revise os serviços antigos antes de gerar os documentos.');
 if(fingerprint(draft)!==fingerprint(saved))
  throw Error('Há alterações não salvas. Salve o orçamento e reabra antes de gerar o PDF.');
 return proposalReference(saved);
}
const asWords=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export function laborOnlyScopeWarnings(budget){
 if(budget?.commercial?.laborOnly!==true)return [];
 return (budget.items||[]).filter(item=>
  /(^|[^A-Z])(FORNECIMENTO|VENDA|AQUISICAO|COMPRA|LOCACAO|ALUGUEL)(?=[^A-Z]|$)/.test(asWords(item.description))
 ).map(item=>item.description);
}
