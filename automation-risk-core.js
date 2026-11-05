/* CIVOLTEN — riscos automáticos comerciais/operacionais; sem inventar custos. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CIVOLTENAutomationRisk=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const n=x=>{const v=Number(String(x??0).replace(',','.'));return Number.isFinite(v)?v:0};
 function inspect(q,options={}){
  if(!q)return [];
  const c=options.company||{},status=String(q.status||'Rascunho'),draft=status==='Rascunho';
  const findings=[],add=(code,level,message)=>{if(!findings.some(x=>x.code===code))findings.push({code,level,message})};
  const final=['Enviado','Em análise','Aprovado'].includes(status);
  if(final&&(!q.items||!q.items.length))add('no-items','critical','Proposta enviada ou aprovada sem serviços cadastrados.');
  if(final&&!q.clientName)add('no-client','critical','Cliente não definido na proposta.');
  if(final&&(!Number.isFinite(Number(q.price))||n(q.price)<=0))
   add('no-price','critical','Proposta sem preço válido.');
  if(final&&n(q.price)<n(q.cost)-.01)
   add('direct-loss','critical','Preço de proposta inferior ao custo orçado.');
  if(final&&!String(q.paymentTerms||'').trim())
   add('payment-terms','warning','Condições de pagamento não preenchidas.');
  if(final&&!String(q.deadline||'').trim())
   add('deadline','warning','Prazo comercial ainda não definido.');
  if(final&&n(q.margin)+.05<n(q.profit??c.profit))
   add('low-margin','critical','Margem salva abaixo da meta cadastrada. Confira antes de assumir compromisso.');
  const date=String(q.date||''),validity=n(q.validity??c.validity);
  const today=String(options.today||new Date().toISOString().slice(0,10));
  if(['Enviado','Em análise'].includes(status)&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&
    /^\d{4}-\d{2}-\d{2}$/.test(today)&&validity>0){
   const expires=Date.parse(date+'T12:00:00Z')+Math.trunc(validity)*86400000;
   if(expires<Date.parse(today+'T12:00:00Z'))
    add('expired','warning','Validade comercial encerrada. Revise valores e condições antes de reenviar.');
  }
  for(const error of options.financial?.errors||[])
   add('financial-'+String(error.code||'check'),'critical',String(error.message||'Corrigir inconsistência financeira.'));
  for(const error of options.operations?.alerts||[])
   add('operation-'+String(error.code||'alert'),error.level==='critical'?'critical':'warning',String(error.message||'Revisar execução.'));
  if(final&&!q.auditFinancial?.date)
   add('no-audit-record','warning','Proposta sem registro da auditoria financeira na revisão atual; confirme antes de reutilizar.');
  if(draft&&(q.items||[]).length===0)
   add('draft-empty','info','Rascunho sem serviços: complete os itens antes de emitir.');
  return findings.sort((a,b)=>({critical:0,warning:1,info:2}[a.level]-{critical:0,warning:1,info:2}[b.level]));
 }
 function overview(quotes,options={},limit=10){
  const list=(Array.isArray(quotes)?quotes:[]).map(q=>({quote:q,findings:inspect(q,{
   ...options,financial:options.financialFor?.(q),operations:options.operationsFor?.(q)
  })})).filter(x=>x.findings.some(y=>y.level==='critical'||y.level==='warning'));
  const severity=x=>x.findings.some(f=>f.level==='critical')?0:1;
  return list.sort((a,b)=>severity(a)-severity(b)).slice(0,limit);
 }
 return {inspect,overview};
});
