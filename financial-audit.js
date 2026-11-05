/* CIVOLTEN — auditoria financeira antes da emissão.
 * Preserva rascunhos incompletos; impede salvar proposta não conferida
 * com preço abaixo do custo + tributos ou abaixo da margem alvo cadastrada.
 * Falhas técnicas são verificações explícitas, nunca custo inventado.
 */
(function(){
'use strict';
const n=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)?x:0};
const positive=v=>n(v)>0;
const normalize=v=>String(v??'').toLowerCase();
function inspect(q){
 const errors=[],warnings=[];
 if(!q)return {errors:[{code:'noquote',message:'Não há orçamento ativo para conferir.'}],warnings:[],financial:null};
 // No orçamento com equipe exclusiva, atualizar o complemento de pessoal
 // ANTES de testar margem, desconto ou valor manual. A atualização posterior
 // feita pelo cronograma não pode diminuir a margem depois da aprovação.
 const forecast=q.schedule?.dedicated&&window.CIVOLTENSchedule?.calculate
   ?window.CIVOLTENSchedule.calculate(q):null;
 if(q.schedule?.dedicated&&!forecast)
  errors.push({code:'schedule-unavailable',message:'O cronograma dedicado ainda não está disponível para calcular o custo da equipe.'});
 if(forecast){
  if(forecast.missing||forecast.unknownCost)
   errors.push({code:'schedule-cost',message:'Cronograma dedicado: há produtividade ou custo/hora de profissional não conferidos.'});
  if(forecast.projectDays>forecast.days)
   errors.push({code:'schedule-days',message:'A equipe planejada não atende ao prazo desejado. Revise a quantidade de profissionais.'});
 }
 const committed=forecast?Math.round(Math.max(0,n(forecast.reserve))*100)/100:0;
 const pricedQuote=forecast?{...q,scheduleExtraCost:committed}:q;
 if(forecast&&q===s.wizard)q.scheduleExtraCost=committed;
 const c=calc(pricedQuote),lines=q.items||[];
 if(q!==s.wizard&&q.status==='Rascunho'&&(!positive(q.price)||Math.abs(n(q.price)-c.price)>0.05))
  errors.push({code:'saved-stale',message:'O rascunho salvo não corresponde ao preço recalculado. Reabra e salve a proposta depois da conferência.'});
 if(!lines.length)errors.push({code:'empty',message:'Adicione pelo menos um serviço antes de emitir a proposta.'});
 for(let i=0;i<lines.length;i++){
  const line=lines[i],prefix='Item '+(i+1)+' ('+String(line.service||'sem descrição').slice(0,52)+'): ';
  if(!line.service||!(n(line.qty)>0)||!line.unit)errors.push({code:'item',message:prefix+'descrição, unidade e quantidade devem ser válidas.'});
  if(!(n(line.labor)>0))errors.push({code:'labor',message:prefix+'falta custo de mão de obra com encargos.'});
  if(line.analyticalReviewNeeded){
   errors.push({code:'analytic',message:prefix+'produtividade SINAPI ainda não conferida. Valide a composição em Mais → Serviços antes de emitir.'});
  }
  if(line.source==='SIURB'&&line.splitConfirmed===false&&!line.companyProductivityConfirmed){
   warnings.push({code:'siurb',message:prefix+'referência SIURB sem separação de custos conferida.'});
  }
  if(q.type==='Mão de obra'&&line.owner==='empresa')
   errors.push({code:'scope-labor',message:prefix+'orçamento só de mão de obra não deve cobrar materiais da empresa.'});
  const catalog=db.services.find(s=>s.id===line.catalogServiceId);
  if(line.owner==='empresa'&&catalog?.origin==='SINAPI'&&
      (catalog.analyticItems||[]).some(x=>x.type==='INSUMO')&&!(n(line.material)>0)){
   errors.push({code:'materials',message:prefix+'há insumos na composição SINAPI, mas o custo real dos materiais da empresa está zerado.'});
  }
  const crew=line.productivity?.crew||[];
  if(crew.length&&crew.some(r=>!positive(r.perUnitHours??r.hours)||!positive(r.rate))){
   errors.push({code:'crew-rate',message:prefix+'há profissional com coeficiente ou custo/hora ausente.'});
  }
  if(!crew.length&&!(positive(line.hoursUnit)&&line.workerId)){
   warnings.push({code:'productivity',message:prefix+'sem produtividade suficiente para prever equipe e prazo.'});
  }
 }
 if(!(c.direct>0))errors.push({code:'direct',message:'O custo direto está zerado. Confira a composição dos serviços.'});
 const missingFixedHours=q.costModel==='fixed_hourly_v1'&&
    positive(q.fixedMonthlySnapshot)&&!(c.allocationHours>0);
 if(missingFixedHours)errors.push({code:'fixed',message:'A obra não possui horas suficientes para ratear os custos fixos mensais.'});
 if(q.costModel==='fixed_hourly_v1'&&!(n(q.fixedHoursOverride)>0)){
  const unknown=lines.filter(l=>!(n(l.productivity?.hoursPerUnit)>0)&&
   !(n(l.hoursUnit)>0));
  if(unknown.length)errors.push({code:'partial-hours',message:'Há '+unknown.length+
   ' serviço(s) sem horas para ratear despesas fixas. Cadastre produtividade ou informe as horas totais conferidas da obra.'});
 }
 if(!(c.denom>0)||!(c.price>0)||!Number.isFinite(c.price))
  errors.push({code:'denom',message:'Preço inválido. A margem, os tributos e as taxas precisam somar menos de 100%.'});
 else{
  const taxRatio=(n(q.tax??db.company.tax)+n(q.fees??db.company.fees))/100;
  const netRevenue=c.price*(1-taxRatio);
  if(netRevenue+0.005<c.cost)
   errors.push({code:'loss',message:'O preço de venda não cobre os custos mais os tributos/taxas previstos. Recalcule antes de emitir.'});
  const desiredMargin=Math.max(0,n(q.profit??db.company.profit));
  if(c.margin+0.051<desiredMargin){
   errors.push({code:'target-margin',message:'A margem final ('+c.margin.toFixed(2)+'%) ficou abaixo da meta ('+
    desiredMargin.toFixed(2)+'%). Revise preço, desconto ou meta de margem.'});
  }
  if(c.referencePremium>0&&q.priceMode==='manual'&&c.price+0.01<c.suggested){
   errors.push({code:'reference',message:'O preço manual está abaixo da sugestão baseada na maior referência SIURB/SINAPI. Revise a composição e o preço antes de emitir.'});
  }
 }
 if(n(q.profit??db.company.profit)===0)
  warnings.push({code:'no-margin',message:'Margem de lucro definida em 0%. Verifique se isso é intencional.'});
 if(n(q.tax??db.company.tax)===0){
  const regime=String(db.company.taxRegime||'');
  if(regime&&regime!=='MEI')
   errors.push({code:'tax',message:'O regime '+regime+' está com 0% de tributos sobre venda. Configure a alíquota aplicável antes de emitir.'});
  else
   warnings.push({code:'tax',message:'Tributos sobre venda em 0% (MEI). Confira se o DAS está incluído nas despesas mensais e se a empresa permanece enquadrada.'});
 }
 if(q.type==='Completo'&&lines.some(x=>x.owner==='empresa'&&n(x.material)===0))
  warnings.push({code:'materials-check',message:'Há serviços completos sem valor de materiais. Confirme que o escopo realmente não exige fornecimento.'});
 if((db.workers||[]).some(w=>n(w.mealBenefit)>0)&&
    (q.expenseItems||[]).some(x=>/almo[cç]o|refei[cç][aã]o/i.test(String(x.name))))
  warnings.push({code:'meal-double',message:'Benefício alimentação também aparece na folha e nas despesas da obra. Confira se não foi cobrado duas vezes.'});
 if(q.costModel==='fixed_hourly_v1'&&
    n(q.fixedCapacitySnapshot)<=160&&db.workers.filter(w=>w.employmentStatus==='planejado').length>=3)
   warnings.push({code:'capacity',message:'Capacidade de rateio fixo de até 160 hh/mês para equipe com vários postos: confira as horas faturáveis totais da empresa.'});
 return {errors,warnings,financial:c};
}
function renderAudit(q){
 const report=inspect(q);
 const pending=report.errors.length;
 const title=pending?'Revisão necessária antes de salvar proposta':'Conferência financeira sem bloqueios';
 const lines=report.errors.concat(report.warnings);
 return '<section class="fa-check"><h3>'+esc(title)+'</h3>'+
  '<p class="fa-explain">'+(pending?'Corrija os pontos abaixo ou salve como rascunho.':
   'Custo, tributos, desconto e margem foram conferidos com os valores atuais; confira as observações.')+'</p>'+
  (lines.length?'<div class="fa-findings">'+lines.map(i=>'<p class="'+(report.errors.includes(i)?'fa-critical':'fa-note')+'">'+esc(i.message)+'</p>').join('')+'</div>':
    '<p class="fa-explain">Todos os itens possuem mão de obra e quantidade positiva; o preço cobre os custos e a margem definida.</p>')+
  '</section>';
}
const oldStep3=wizardStep3;
wizardStep3=function(){
 const html=oldStep3();
 if(!s.wizard)return html;
 const end=html.lastIndexOf('<div class="form-actions">');
 return end>=0?html.slice(0,end)+renderAudit(s.wizard)+html.slice(end):renderAudit(s.wizard)+html;
};
const oldPersist=persistWizard;
persistWizard=function(){
 const q=s.wizard;
 if(q&&q.status!=='Rascunho'){
  const report=inspect(q);
  if(report.errors.length){toast(report.errors[0].message);return}
  q.auditFinancial={status:'passed',date:new Date().toISOString(),checks:'financial-v1',
   warnings:report.warnings.map(x=>x.code)};
 }
 return oldPersist();
};
const oldClick=click;
click=function(action,element){
 if(action==='finish'&&s.wizard){
  const report=inspect(s.wizard);
  if(report.errors.length){
   toast(report.errors[0].message);return
  }
  s.wizard.auditFinancial={status:'passed',date:new Date().toISOString(),checks:'financial-v1',
   warnings:report.warnings.map(x=>x.code)};
 }
 return oldClick(action,element);
};
// Impedir que o usuário contorne a auditoria mudando um rascunho salvo
// diretamente para Enviado/Aprovado na lista ou no detalhe.
document.addEventListener('change',event=>{
 const id=event.target?.dataset?.quoteStatus;
 if(!id||event.target.value==='Rascunho')return;
 const quote=db.quotes.find(q=>q.id===id);
 if(!quote)return;
 const verdict=inspect(quote);
 if(verdict.errors.length){
  event.preventDefault();event.stopImmediatePropagation();
  event.target.value=quote.status;
  toast('Não é possível enviar/aprovar: '+verdict.errors[0].message);
  return;
 }
 quote.auditFinancial={status:'passed',date:new Date().toISOString(),checks:'financial-v1',
  warnings:verdict.warnings.map(x=>x.code)};
 // O evento nativo salva a nova situação e o registro de auditoria juntos.
},true);
const css=document.createElement('style');
css.textContent='.fa-check{background:#f7f9f9;border:1px solid #cbd7d2;border-radius:13px;padding:13px;margin:12px 0}.fa-check h3{font-size:15px;margin:0 0 7px}.fa-explain{font-size:12px;line-height:1.5;margin:5px 0;color:#46524b}.fa-findings{display:grid;gap:7px;margin-top:9px}.fa-critical,.fa-note{font-size:11px;line-height:1.4;padding:9px 10px;border-radius:8px;margin:0}.fa-critical{background:#ffebea;color:#973b2c}.fa-note{background:#fff4da;color:#74531a}';
document.head.append(css);
window.CIVOLTENFinancialAudit={inspect};
})();