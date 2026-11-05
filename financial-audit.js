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
 const c=calc(q),lines=q.items||[];
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
   warnings.push({code:'reference',message:'Preço manual está abaixo do preço sugerido com a maior referência SIURB/SINAPI.'});
  }
 }
 if((q.tax??db.company.tax)==0&&q.type!=='Mão de obra')
  warnings.push({code:'tax',message:'Tributos sobre a venda estão em 0%. Confirme o regime e a incidência com o contador.'});
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
const css=document.createElement('style');
css.textContent='.fa-check{background:#f7f9f9;border:1px solid #cbd7d2;border-radius:13px;padding:13px;margin:12px 0}.fa-check h3{font-size:15px;margin:0 0 7px}.fa-explain{font-size:12px;line-height:1.5;margin:5px 0;color:#46524b}.fa-findings{display:grid;gap:7px;margin-top:9px}.fa-critical,.fa-note{font-size:11px;line-height:1.4;padding:9px 10px;border-radius:8px;margin:0}.fa-critical{background:#ffebea;color:#973b2c}.fa-note{background:#fff4da;color:#74531a}';
document.head.append(css);
window.CIVOLTENFinancialAudit={inspect};
})();