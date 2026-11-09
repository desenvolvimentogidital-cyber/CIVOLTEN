// Interface responsiva de orçamento com catálogo interno e histórico compatível.
import {summary,brl} from './calc.mjs';
import {priceBudget,budgetQuantityEstimate} from './budget.mjs';
import {catalogRows} from './service-catalog.mjs';
import {icon,e} from './views.mjs';
import {printableBudget} from './budget-print.mjs';
import {companyConfig} from './pricing.mjs';
import {schedulePlan} from './budget-schedule.mjs';
const money=brl;
const dateBR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'Não definida';
const header=(text,back)=>'<div class="page-heading"><button type="button" class="small-square" data-go="'+back+'" aria-label="Voltar">'+
 icon('back',22)+'</button><h1>'+text+'</h1><span class="small-square is-empty"></span></div>';
const field=(label,name,value='',type='text',params='')=>
 '<label class="modal-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" data-budget-field="'+name+'" value="'+e(value??'')+'" '+
 (type==='number'?'inputmode="decimal" step="any" min="0" ':'')+params+'></label>';
const textarea=(label,name,value='')=>'<label class="modal-field"><span>'+label+'</span><textarea name="'+name+
 '" data-budget-field="'+name+'" rows="3">'+e(value)+'</textarea></label>';
const m=(value,highlight=false)=>'<div class="fin-kpi'+(highlight?' fin-kpi-featured':'')+'"><span>'+value[0]+'</span><strong>'+value[1]+'</strong></div>';
const needsReview=draft=>draft?.demo!==false||draft?.items?.some(item=>item.source==='demo');
const status=draft=>needsReview(draft)?
 '<div class="budget-legacy-note"><p class="fin-helper">Este orçamento foi criado com referências anteriores. Para utilizar como proposta comercial, revise os serviços, a produtividade e os custos reais da empresa.</p>'+
 '<button type="button" class="outlined-button" data-action="budget-regularize">'+icon('edit',16)+' Revisar para uso comercial</button></div>':'';
function error(msg){return '<p class="form-error" role="alert">'+e(msg)+'</p>';}
export function budgetsView(data){
 const rows=(data.budgets||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 return '<section class="fin-screen budget-screen">'+header('Orçamentos','home')+
 '<p class="fin-intro">Elabore propostas comerciais com produtividade por HH/un, composições importadas da SIURB/SINAPI e custos reais da CIVOLTEN.</p>'+
 '<button type="button" class="outlined-button" data-go="catalog">'+icon('clipboard',18)+' Catálogo de serviços SIURB/SINAPI</button>'+
 '<button class="gold-button budget-new-button" type="button" data-action="budget-new">'+icon('plus',22)+' Novo orçamento CIVOLTEN</button>'+
 (rows.length?'<div class="budget-list">'+rows.map(b=>{
  let price=null;try{price=priceBudget(b)}catch{/* registros antigos devem continuar acessíveis */}
  return '<button class="budget-list-item" type="button" data-action="budget-open" data-id="'+e(b.id)+'">'+
   '<span class="budget-list-icon">'+icon('clipboard',22)+'</span>'+
   '<span class="budget-list-copy"><b>'+e(b.title)+'</b><small>'+e(b.customer||'Cliente não informado')+
   '</small><em>'+b.items.length+' serviço(s) · '+dateBR(b.createdAt?.slice(0,10))+'</em></span>'+
   '<span class="budget-list-total"><strong>'+(needsReview(b)?'A revisar':price?money(price.totalSale):'Sem preço')+'</strong>'+
   '<small>'+(needsReview(b)?'Revisão pendente':'Rascunho')+'</small></span></button>';
 }).join('')+'</div>':
 '<div class="fin-empty">Nenhum orçamento salvo. Crie seu primeiro orçamento com os serviços do catálogo interno.</div>')+
 '<div class="fin-link-row"><button type="button" data-go="company">Ajustar precificação '+icon('chevron',17)+'</button></div></section>';
}
function itemRow(item,index,snapshot,pricedRow=null){
 const quantity=Number(item.quantity).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const hours=Number(item.laborHours).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const cost=money(Math.round(Number(item.directCost??0)*100));
 let quote=null;try{quote=budgetQuantityEstimate(snapshot,item.laborHours,item.quantity,item.directCost)}catch{};
 const hoursTotal=pricedRow?.hours??quote?.totalHours;
 const laborTotal=pricedRow?.labor??quote?.labor;
 const sellingTotal=pricedRow?.selling??quote?.selling;
 const materialsTotal=pricedRow?.materials??quote?.materials;
 return '<article class="budget-item budget-item-compact" data-budget-item="'+e(item.id)+'">'+
  '<div class="budget-item-top"><span>'+(item.source==='demo'?'Serviço a revisar':item.source==='internal'?'Serviço CIVOLTEN':'Personalizado')+' · item '+(index+1)+'</span>'+
  '<button type="button" class="budget-remove" data-action="budget-remove-item" data-id="'+e(item.id)+'" aria-label="Remover serviço">'+icon('trash',16)+' Remover</button></div>'+
  '<h3>'+e(item.description)+'</h3>'+
  '<p class="budget-item-summary">'+quantity+' '+e(item.unit)+' · '+hours+' HH/un. · adicionais/un. '+cost+'</p>'+
  (sellingTotal!=null?'<div class="budget-item-totals">'+
   '<span>Esforço total: <b>'+Number(hoursTotal).toLocaleString('pt-BR',{maximumFractionDigits:3})+' HH</b></span>'+
   '<span>Mão de obra total: <b>'+money(laborTotal)+'</b></span>'+
   '<span>Materiais/equipamentos totais: <b>'+money(materialsTotal)+'</b></span>'+
   '<strong>Preço total deste serviço ('+quantity+' '+e(item.unit)+'): '+money(sellingTotal)+'</strong></div>':'')+
  '<button type="button" class="budget-item-edit" data-action="budget-edit-item" data-id="'+e(item.id)+'">'+icon('edit',16)+' Editar serviço</button>'+
  '</article>';
}
const serviceField=(label,name,value,type='text',params='')=>
 '<label class="modal-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+e(value??'')+'" '+
 (type==='number'?'inputmode="decimal" min="0" step="any" ':'')+params+'></label>';
// Exibe automaticamente os valores atuais sem exigir preenchimento de campo calculado.
export function budgetServiceEstimate(fields,snapshot,pricingMode='hours'){
 if(!snapshot)return '<p class="fin-helper">O custo por HH será calculado quando a empresa tiver custos mensais e capacidade produtiva configurados.</p>';
 let quote=null;try{quote=budgetQuantityEstimate(snapshot,fields?.laborHours,fields?.quantity,fields?.directCost)}catch{}
 if(!quote)return '<p class="fin-helper">Informe quantidade maior que zero, produtividade HH/un maior que zero e eventuais adicionais para calcular o total.</p>';
 const num=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const avgUnit='R$ '+(quote.selling/100/quote.quantity).toLocaleString('pt-BR',
  {minimumFractionDigits:2,maximumFractionDigits:4});
 const rate='R$ '+(quote.hourly/100).toLocaleString('pt-BR',
  {minimumFractionDigits:4,maximumFractionDigits:4});
 const daily=Math.ceil(quote.monthly/quote.days),unit=e(fields?.unit||'un');
 return '<div class="budget-unit-summary" role="status">'+
  '<div class="budget-unit-summary-head">Cálculo da quantidade total · CIVOLTEN</div>'+
  '<div><span>Despesa mensal da empresa</span><strong>'+money(quote.monthly)+'</strong></div>'+
  '<div><span>Custo por dia ('+quote.days+' dias)</span><strong>'+money(daily)+'</strong></div>'+
  '<div><span>Custo por HH ('+quote.hoursDay+'h × '+quote.people+' profissionais)</span><strong>'+rate+'/HH</strong></div>'+
  '<div class="budget-quantity-math"><span>Quantidade × produtividade</span><strong>'+
   num(quote.quantity)+' '+unit+' × '+num(quote.hours)+' HH/'+unit+' = '+num(quote.totalHours)+' HH</strong></div>'+
  '<div><span>Mão de obra dos '+num(quote.quantity)+' '+unit+'</span><strong>'+money(quote.labor)+'</strong></div>'+
  '<div><span>Materiais/equipamentos totais</span><strong>'+money(quote.materials)+'</strong></div>'+
  '<div><span>Custo total antes de impostos e lucro</span><strong>'+money(quote.cost)+'</strong></div>'+
  '<div><span>Impostos sobre a venda</span><strong>'+money(quote.taxes)+'</strong></div>'+
  '<div><span>Lucro gerencial</span><strong>'+money(quote.grossProfit)+'</strong></div>'+
  '<div><span>Preço médio por '+unit+' (até 4 casas)</span><strong>'+avgUnit+'</strong></div>'+
  '<div class="budget-full-quote"><span>PREÇO TOTAL DOS '+num(quote.quantity)+' '+unit+'</span><strong>'+
   money(quote.selling)+'</strong></div>'+
  '<small>O valor total é calculado com todas as HH ('+num(quote.totalHours)+') antes do arredondamento. '+
   'Imposto e margem já estão incluídos; nenhum preço oficial da SIURB/SINAPI é usado.</small>'+
  (pricingMode==='days'?'<p class="budget-mode-notice">Este resumo usa precificação por HH. A proposta está configurada <b>por dias de execução</b>, '+
   'que usa o custo diário e o cronograma; o total final pode ser diferente.</p>':'')+
 '</div>';
}
export function budgetServiceDialog(service,editing=false,snapshot=null,pricingMode='hours'){
 return '<div class="modal-inner budget-service-modal">'+
 '<div class="modal-heading"><h2 id="budget-service-title">'+(editing?'Editar serviço':'Adicionar serviço')+'</h2>'+
 '<button type="button" class="small-square" data-action="close-modal" aria-label="Fechar formulário">×</button></div>'+
 '<p class="helper-text">Preencha o serviço aqui mesmo. Ele só entra no orçamento quando você confirmar.</p>'+
 '<form id="budget-service-form" aria-labelledby="budget-service-title">'+
 '<div class="modal-fields">'+
 serviceField('Descrição do serviço','description',service.description,'text','maxlength="180" required')+
 '<div class="budget-service-grid">'+
 serviceField('Unidade','unit',service.unit,'text','maxlength="20" required')+
 serviceField('Quantidade','quantity',service.quantity,'number','max="100000" required')+
 serviceField('Produtividade adotada (HH por unidade)','laborHours',service.laborHours,'number','max="10000" required')+
 serviceField('Materiais e equipamentos adicionais por unidade (R$) — opcional','directCost',service.directCost??0,'number','max="999999999" placeholder="0,00"')+
 '</div></div>'+
 (service.crewComposition?'<p class="fin-helper">Equipe sugerida: '+e(service.crewComposition)+'. Faixa inicial: '+e(service.hhMin)+' a '+e(service.hhMax)+' HH/'+e(service.unit)+'. O ponto médio é pré-selecionado e pode ser ajustado.</p>':'')+
 '<p class="fin-helper">A mão de obra é calculada automaticamente: custo mensal ÷ dias ÷ horas ÷ profissionais × HH/un. Deixe adicionais em R$ 0,00 quando já estiverem nos custos mensais. Em serviços mecanizados, confira o custo real da máquina/equipamento.</p>'+
 '<div id="budget-service-estimate" aria-live="polite">'+budgetServiceEstimate(service,snapshot,pricingMode)+'</div>'+
 '<p id="budget-service-error" class="form-error" role="alert" hidden></p>'+
 '<div class="modal-buttons">'+
 '<button type="button" class="outlined-button" data-action="close-modal">Cancelar</button>'+
 '<button type="submit" class="gold-button">'+icon('check',18)+(editing?' Salvar alterações':' Adicionar serviço')+'</button>'+
 '</div></form></div>';
}
export function getBudgetSchedule(data,draft){
 const snap=draft.pricing;
 const cfg=snap?.productiveDays&&snap?.productivePeople&&snap?.hoursPerDay?snap:companyConfig(data.company);
 return schedulePlan(draft.items,draft.commercial?.schedule||{},cfg);
}
const scheduleField=(title,name,value,type='number',additional='')=>
 '<label class="modal-field"><span>'+title+'</span><input type="'+type+'" name="'+name+'" data-schedule-field="'+name+
 '" value="'+e(value??'')+'" '+(type==='number'?'min="1" step="1" inputmode="numeric" ':'')+additional+'></label>';
export function budgetSchedulePreview(data,draft){
 let plan;
 try{plan=getBudgetSchedule(data,draft)}catch(err){return error(err.message||'Revise as horas e quantidades.');}
 if(!plan)return '<div class="fin-empty">Configure a capacidade produtiva em Mais → Empresa para estimar a obra.</div>';
 if(!plan.totalHours)return '<div class="fin-empty">Adicione serviços com horas de trabalho para gerar o cronograma.</div>';
 const cost=plan.dailyCompanyCost===null?'A calcular':money(plan.dailyCompanyCost);
 const num=n=>n.toLocaleString('pt-BR');
 const summary='<div class="budget-schedule-kpis">'+
  m(['Duração estimada',num(plan.days)+' dias úteis'])+
  m(['Profissionais usados no cálculo',num(plan.crew)])+
  m(['Equipe atual da empresa',num(plan.companyPeople)+' profissionais'])+
  m(['Prazo com a equipe atual',num(plan.daysWithCompany)+' dias úteis'])+
  m(['Esforço dos serviços',num(plan.totalHours)+' h-h'])+
  m(['Custo diário da empresa',cost])+'</div>'+
  '<div class="budget-schedule-staffing"><strong>Como reduzir o prazo</strong>'+
  '<p>Com '+num(plan.companyPeople)+' profissionais, a estimativa é de <b>'+num(plan.daysWithCompany)+
   ' dias úteis</b>, trabalhando '+num(plan.hoursPerDay)+' horas por dia.</p>'+
  (plan.daysWithCompany>1?'<p>Para executar em cerca de <b>'+num(plan.halfDays)+
   ' dias úteis</b>, seriam necessários <b>'+num(plan.crewForHalfTime)+' profissionais</b>.</p>':'')+
  '<p>Para concluir em <b>'+num(plan.productiveDays)+' dias úteis</b> (um mês produtivo), seriam necessários <b>'+
   num(plan.crewForMonth)+' profissionais</b> — estimativa de dimensionamento, não contratação automática.</p></div>';
 const note=plan.available?
  '<p class="budget-schedule-ok">'+icon('check',15)+' Estimativa compatível com a equipe cadastrada ('+plan.companyPeople+').</p>':
  '<p class="cost-pending-note">Prazo exige '+plan.crew+' profissionais e sua empresa tem '+plan.companyPeople+
  '. Faltam '+plan.extraPeople+'. Revise o prazo ou inclua o custo da equipe adicional antes da proposta.</p>';
 const dates=plan.startDate?'<p class="fin-helper">Início: '+dateBR(plan.startDate)+
  (plan.endDate?' · Término estimado: '+dateBR(plan.endDate):
   ' · prazo calculado em dias úteis; término além do intervalo de datas do calendário')+
  ' · sábados e domingos não contados.</p>':
  '<p class="fin-helper">Informe a data de início para ver as datas do cronograma.</p>';
 const days=plan.rows.map(row=>'<div class="budget-schedule-row">'+
  '<div class="budget-schedule-row-head"><b>'+e(row.description)+'</b><span>'+row.hours.toLocaleString('pt-BR')+' h-h</span></div>'+
  '<div class="budget-schedule-track"><span style="left:'+
  (row.startDay?((row.startDay-1)/plan.days*100).toFixed(3):0)+'%;width:'+
  (row.days?(row.days/plan.days*100).toFixed(3):0)+'%"></span></div>'+
  '<small>'+(row.startDay?'Dia '+row.startDay+' até '+row.endDay+
   (row.startDate?' · '+dateBR(row.startDate)+' a '+dateBR(row.endDate):''):
   'Sem horas estimadas')+'</small></div>').join('');
 const guidance=plan.days>plan.productiveDays*12?
  '<p class="budget-schedule-guidance">Prazo longo para a equipe informada: <b>'+
  num(plan.days)+' dias úteis</b>. O cálculo continua válido como estimativa. '+
  'Para reduzir o prazo, aumente os profissionais destinados à obra ou reveja as HH por unidade dos serviços.</p>':'';
 return summary+note+guidance+dates+'<div class="budget-schedule-list">'+days+'</div>'+
  '<p class="fin-helper">Estimativa gerencial por horas-homem, com compartilhamento de dias entre atividades. Dependências, serviços paralelos, feriados, clima e produtividade real precisam ser conferidos pelo responsável técnico.</p>';
}
const scheduleControls=(data,draft)=>{
 const sc=draft.commercial?.schedule||{};
 const goal=sc.goal==='days'?'days':'crew',mode=sc.pricingMode==='days'?'days':'hours';
 const current=companyConfig(data.company);
 return '<div class="budget-section-heading"><h2>Cronograma automático</h2></div>'+
  '<p class="fin-helper">O sistema estima prazo e equipe a partir de quantidade × horas por unidade de cada serviço. Você pode ajustar os dias ou os profissionais.</p>'+
  '<div class="budget-schedule-controls">'+
  '<label class="modal-field"><span>Calcular a partir de</span><select name="goal" data-schedule-field="goal">'+
  '<option value="crew"'+(goal==='crew'?' selected':'')+'>Equipe disponível → dias</option>'+
  '<option value="days"'+(goal==='days'?' selected':'')+'>Prazo desejado → profissionais</option></select></label>'+
  (goal==='days'?scheduleField('Prazo desejado (dias úteis)','days',sc.days??'', 'number','placeholder="Ex.: 20"'):
   scheduleField('Profissionais destinados à obra','crew',sc.crew??current.productivePeople??1,'number','max="1000"'))+
  scheduleField('Data prevista de início','startDate',sc.startDate||'','date','')+
  '<label class="modal-field"><span>Formação do preço da proposta</span><select name="pricingMode" data-schedule-field="pricingMode">'+
  '<option value="hours"'+(mode==='hours'?' selected':'')+'>Por horas de trabalho (atual)</option>'+
  '<option value="days"'+(mode==='days'?' selected':'')+'>Por dias de execução (custo diário)</option></select></label>'+
  '</div>'+
  '<div id="budget-schedule-preview" aria-live="polite">'+budgetSchedulePreview(data,draft)+'</div>'+
  '<div class="budget-schedule-actions">'+
  '<button type="button" class="outlined-button" data-action="budget-schedule-term">'+icon('calendar',17)+' Usar prazo na proposta</button>'+
  '<button type="button" class="outlined-button" data-action="budget-schedule-export">'+icon('file',17)+' Exportar cronograma</button></div>'+
  '<p class="fin-helper">Preço por dias: (custo mensal da empresa ÷ dias produtivos/mês) × dias da obra + custos diretos; aplica depois imposto e margem. O custo mensal já inclui a equipe cadastrada, sem duplicá-la.</p>';
};
const preview=(draft)=>{
 if(needsReview(draft))return '<div class="fin-empty">Antes de calcular ou emitir a proposta, revise os itens anteriores e confirme horas, materiais e custos próprios.</div>';
 let p;try{p=priceBudget(draft)}catch(err){return error(err.message||'Dados de serviço inválidos.');}
 if(!p)return '<div class="fin-empty">Preço ainda indisponível. Conclua o custo mensal e as configurações em Mais → Empresa e precificação; depois use “Atualizar base de preços”. Você pode salvar o rascunho sem valores.</div>';
 return '<div class="fin-kpi-grid">'+
 m(['Custo total estimado',money(p.totalCost)])+
 m(['Preço final para o cliente',money(p.totalSale)],true)+
 m(['Impostos estimados',money(p.totalTax)])+
 m(['Lucro gerencial',money(p.profit)])+'</div>'+
 '<div class="budget-overview"><div>Modalidade <b>'+(p.pricingMode==='days'?'Por dias de execução':'Por horas-homem')+'</b></div>'+ 
 (p.schedule?'<div>Prazo e equipe <b>'+p.schedule.days+' dias · '+p.schedule.crew+' profissionais</b></div>':'')+
 '<div>Horas de mão de obra <b>'+p.totalHours.toLocaleString('pt-BR')+' h</b></div>'+
 '<div>Alíquota aplicada <b>'+e(p.snapshot.taxPct)+'%</b></div>'+
 '<div>Margem desejada <b>'+e(p.snapshot.marginPct)+'%</b></div>'+
 '<div>Base congelada em <b>'+dateBR(p.snapshot.capturedOn)+'</b></div></div>'+
 '<div class="budget-priced-items">'+p.rows.map(row=>'<div><span>'+e(row.description)+'<small>'+e(row.quantity)+' '+e(row.unit)+' · valor unitário '+money(Math.round(row.unitSelling))+'/'+e(row.unit)+'</small></span>'+
 '<strong>'+money(row.selling)+'</strong></div>').join('')+'</div>';
};
export function budgetPreview(draft){return preview(draft);}
// Pesquisa em todos os serviços sincronizados com o Supabase, não apenas nos visíveis.
const normalizeCatalogTerm=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function filterBudgetCatalog(records,search=''){
 const term=normalizeCatalogTerm(search);
 return catalogRows(records).filter(item=>!term||normalizeCatalogTerm([
  item.description,item.code,item.sinapiCode,item.unit,item.source,item.category
 ].join(' ')).includes(term))
 .sort((a,b)=>String(a.description).localeCompare(String(b.description),'pt-BR',{sensitivity:'base'}));
}
export function budgetCatalogResults(records,search=''){
 const matches=filterBudgetCatalog(records,search);
 const shown=matches.slice(0,60);
 return '<p class="budget-catalog-meta" role="status" aria-live="polite">'+
  (matches.length?
   'Exibindo '+shown.length+' de '+matches.length+' serviço(s) encontrado(s). '+
    (matches.length>shown.length?'Digite mais letras para localizar os demais.':'Toque em um serviço para adicionar ao orçamento.'):
   'Nenhum serviço encontrado. Tente outro nome ou código.')+'</p>'+
  '<div id="budget-catalog-list" class="budget-catalog-list" role="group" aria-label="Serviços disponíveis no catálogo">'+
  shown.map((item,index)=>'<button type="button" class="budget-catalog-row" data-action="budget-choose-service" data-code="'+e(item.code)+'" '+
   'aria-label="Adicionar '+e(item.description)+' ao orçamento">'+
   '<span class="budget-catalog-row-index">'+(index+1)+'</span>'+
   '<span class="budget-catalog-row-content"><strong>'+e(item.description)+'</strong>'+
   '<small>'+e((item.source||'').toUpperCase())+' · '+e(item.sinapiCode||item.code)+' · '+e(item.unit)+'</small></span>'+
   '<span class="budget-catalog-row-plus" aria-hidden="true">'+icon('plus',19)+'</span>'+
  '</button>').join('')+'</div>';
}
export function budgetEditorView(data,draft,err='',pickerSearch=''){
 if(!draft)return budgetsView(data);
 const payrollUnreviewed=(data.employees||[]).some(e=>e.active!==false&&e.contractType==='clt')&&
  data.payroll?.reviewed!==true;
 let calculated=null;try{calculated=!needsReview(draft)?priceBudget(draft):null}catch{/* mostrar erro no preview */}
 const priced=!!calculated;
 return '<section class="fin-screen budget-screen budget-editor">'+header('Montar orçamento','budgets')+
 status(draft)+
 '<form id="budget-form" class="budget-form" novalidate>'+
 '<div class="budget-editor-head"><span>Rascunho · '+(draft.id?'edição':'novo')+'</span>'+
 '<p>Ao salvar, o orçamento fica privado na sua conta. Os itens e custos não alteram Financeiro, contratos ou estoque.</p></div>'+
 field('Título do orçamento','title',draft.title,'text','maxlength="180" required')+
 field('Cliente','customer',draft.customer,'text','maxlength="180" required')+
 field('Obra / projeto','project',draft.project,'text','maxlength="180"')+
 field('Local da obra','location',draft.location,'text','maxlength="240"')+
 field('Validade da proposta','expiresOn',draft.expiresOn||'','date')+
 textarea('Observações','notes',draft.notes)+
 '<div class="budget-section-heading"><h2>Condições comerciais</h2></div>'+ 
 '<p class="fin-helper">São exibidas somente na última página da proposta. Preencha condições reais; campos vazios serão marcados como a definir, sem inventar prazos ou garantias.</p>'+ 
 textarea('Condições de pagamento','paymentTerms',draft.commercial?.paymentTerms||'')+
 textarea('Prazo de execução','executionTerm',draft.commercial?.executionTerm||'')+
 textarea('Garantia dos serviços','warrantyTerms',draft.commercial?.warrantyTerms||'')+
 textarea('Escopo e exclusões','scopeNotes',draft.commercial?.scopeNotes||'')+
 field('Contato comercial da empresa (opcional)','companyContact',draft.commercial?.companyContact||'','text','maxlength="200"')+
 field('CNPJ ou identificação da empresa (opcional)','companyDocument',draft.commercial?.companyDocument||'','text','maxlength="40"')+
 '<div class="budget-section-heading"><h2>Serviços</h2><span>'+draft.items.length+' item(ns)</span></div>'+
 '<div class="budget-service-picker">'+
  '<label class="budget-catalog-search-label" for="budget-catalog-search">Procurar serviços do catálogo</label>'+
  '<div class="budget-catalog-search-tools">'+
  '<input id="budget-catalog-search" type="search" autocomplete="off" inputmode="search" '+
  'aria-controls="budget-catalog-list" placeholder="Pesquisar nome, código ou unidade" value="'+e(pickerSearch)+'">'+
  '<button type="button" class="budget-catalog-clear" data-action="budget-catalog-clear">Limpar</button></div>'+
  '<div id="budget-catalog-results">'+budgetCatalogResults(data.catalog,pickerSearch)+'</div>'+
  '<button type="button" class="outlined-button budget-manual-add" data-action="budget-add-item">'+icon('plus',19)+
  ' Adicionar serviço manual</button></div>'+
 '<p class="fin-helper">A produtividade SIURB/SINAPI preenche as HH/un. O custo por unidade é calculado automaticamente com as despesas da sua empresa, imposto e margem, sem usar preços da tabela oficial.</p>'+
 '<button class="outlined-button" type="button" data-go="catalog">'+icon('clipboard',18)+' Importar catalogo SIURB/SINAPI</button>'+
 (draft.items.length?'<div class="budget-items">'+draft.items.map((item,index)=>itemRow(item,index,draft.pricing,calculated?.rows[index]||null)).join('')+'</div>':
 '<div class="fin-empty">Inclua ao menos um serviço para salvar o orçamento.</div>')+
 scheduleControls(data,draft)+
 '<div class="budget-section-heading"><h2>Formação do preço</h2></div>'+
 (payrollUnreviewed?'<p class="fin-helper budget-audit-note"><strong>Conferência da folha CLT pendente:</strong> a empresa ainda utiliza percentuais iniciais para FGTS, INSS patronal, RAT e outros encargos. O preço calculado pode mudar após a conferência com a contabilidade. Antes de enviar a proposta, revise em <b>Mais → Encargos CLT da empresa</b>.</p>':'')+
 (summary(data).missing?'<p class="fin-helper">O cálculo inclui os custos já cadastrados. Modelos de despesas ainda sem valor ficam fora da conta até serem preenchidos.</p>':'')+
 (summary(data).assumedQuantities?'<p class="fin-helper">'+summary(data).assumedQuantities+' custo(s) variáveis utilizam 1 unidade/mês porque a quantidade não foi informada. Revise se necessário.</p>':'')+
 '<p class="fin-helper">O custo mensal é dividido pelos dias produtivos, horas por dia e profissionais. Cada serviço recebe seu valor pela produtividade HH/un; imposto e margem são aplicados automaticamente.</p>'+
 '<button type="button" data-action="budget-refresh-pricing" class="budget-refresh">'+icon('chart',18)+' Recalcular com os custos atuais (opcional)</button>'+
 '<div id="budget-price-preview" aria-live="polite">'+preview(draft)+'</div>'+
 (err?error(err):'')+
 '<button class="gold-button budget-save-button" type="submit"'+(needsReview(draft)?' disabled':'')+'>'+icon('check',19)+' Salvar rascunho</button></form>'+
 '<div class="budget-secondary-actions"><button type="button" class="outlined-button" data-action="budget-print"'+(priced?'':' disabled')+'>'+icon('file',18)+' Visualizar / PDF</button>'+
 '<button type="button" class="outlined-button" data-action="budget-export"'+(priced?'':' disabled')+'>'+icon('file',18)+' Exportar CSV</button></div>'+ 
 '<p class="budget-pdf-model-label">'+icon('check',15)+' Proposta Signature · 3 páginas · CIVOLTEN</p>'+
 (draft.id?'<button type="button" class="fin-delete" data-action="budget-delete">'+icon('trash',18)+' Excluir orçamento</button>':'')+
 '<div class="fin-link-row"><button type="button" data-go="company">Configurar custo, imposto e margem '+icon('chevron',17)+'</button></div>'+
 printableBudget(draft)+'</section>';
}
