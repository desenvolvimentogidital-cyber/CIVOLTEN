// Configuração de empresa, precificação e aparência — dados isolados por usuário.
import {summary,brl,cents} from './calc.mjs';
import {companyConfig,THEMES,laborRates,quoteFromCost,quoteForHours} from './pricing.mjs';
import {icon,e} from './views.mjs';

const themes={
 gold:['Dourado','#ffbb24','#ef8500'],
 blue:['Azul','#4ca9ff','#126fc0'],
 emerald:['Verde','#50d3a1','#168260'],
 violet:['Violeta','#bc98ff','#7346b3'],
 coral:['Coral','#ff8e70','#cc4b49']
};
const opt=(value,items)=>items.map(([k,text])=>
 '<option value="'+e(k)+'"'+(String(k)===String(value)?' selected':'')+'>'+e(text)+'</option>').join('');
const fld=(label,name,value,type='number',extra='')=>
 '<label class="modal-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" value="'+e(value??'')+'" '+
 (type==='number'?'min="0" step="0.01" inputmode="decimal" ':'')+extra+'></label>';
const money=(n)=>brl(n);
const heading=(name)=>'<div class="page-heading"><button type="button" class="small-square" data-go="more" aria-label="Voltar">'+icon('back',23)+'</button><h1>'+name+'</h1><span class="small-square is-empty"></span></div>';
const metric=(label,price)=>'<div class="fin-kpi"><span>'+label+'</span><strong>'+money(price)+'</strong></div>';
const info='<p class="fin-helper">Atenção: a alíquota informada é uma estimativa gerencial do total de tributos incidentes sobre o faturamento. No Simples Nacional, confirme a alíquota <b>efetiva</b> do serviço (anexo, RBT12, fator R, retenções e situação fiscal) com seu contador. Não acrescente ISS ou DAS duas vezes. Não substitui apuração do PGDAS-D nem emite nota fiscal.</p>';

export function pricingPreview(data,hours='8',extra='0'){
 const sum=summary(data),cfg=companyConfig(data.company);
 const r=laborRates(sum.total,cfg);
 if(!cfg.reviewed)return '<div class="fin-empty">Configure dias, horas, equipe, imposto e margem para liberar a precificação.</div>';
 if(!r)return '<div class="fin-empty">Informe uma capacidade produtiva válida antes de calcular.</div>';
 if(sum.workforceMissing>0)return '<div class="fin-empty">Complete os custos dos profissionais ativos para calcular o custo da hora.</div>';
  if(sum.total<=0)return '<div class="fin-empty">Cadastre ao menos uma despesa mensal real para formar o preço por hora.</div>';
 const warning=(sum.missing?'<p class="fin-helper cost-pending-note">Atenção: '+sum.missing+' despesa(s) ainda estão a preencher. O preço considera somente os custos reais informados; revise os demais antes de usar em uma proposta definitiva.</p>':'')+
  (sum.assumedQuantities?'<p class="fin-helper cost-pending-note">'+sum.assumedQuantities+' custo(s) variável(is) sem quantidade foram calculados como 1 unidade/mês. Revise em Custos → Variáveis antes de emitir proposta definitiva.</p>':'');
 const pHour=quoteFromCost(r.personHour,cfg),pDay=quoteFromCost(r.personDay,cfg);
 const extraMoney=cents(extra),q=extraMoney===null?null:quoteForHours(sum.total,cfg,hours,extraMoney);
 return warning+'<div class="fin-kpi-grid">'+metric('Custo mensal da empresa',r.monthly)+
  metric('Custo diário da empresa',r.companyDay)+
  metric('Custo por profissional / dia',r.personDay)+
  metric('Custo por hora produtiva',r.personHour)+
  metric('Venda sugerida / hora',pHour.selling)+
  metric('Venda sugerida / profissional / dia',pDay.selling)+'</div>'+
  '<div class="pricing-capacity">Capacidade: '+r.personDays+' diárias de profissionais e '+r.productiveHours.toLocaleString('pt-BR')+' horas produtivas por mês.</div>'+
  '<div class="pricing-quote">'+
  (q?'<h3>Preço estimado para o cliente</h3><strong>'+money(q.selling)+'</strong>'+
   '<div class="fin-report-lines">'+
   '<div><span>Mão de obra ('+e(q.hours)+' horas)</span><b>'+money(q.labor)+'</b></div>'+
   '<div><span>Custos diretos adicionais</span><b>'+money(q.extra)+'</b></div>'+
   '<div><span>Custo do serviço</span><b>'+money(q.cost)+'</b></div>'+
   '<div><span>Tributos ('+e(cfg.taxPct)+'% da venda)</span><b>'+money(q.taxes)+'</b></div>'+
   '<div><span>Lucro estimado (margem '+e(cfg.marginPct)+'%)</span><b>'+money(q.grossProfit)+'</b></div>'+
   '<div class="fin-highlight"><span>Preço sugerido</span><b>'+money(q.selling)+'</b></div></div>':
   '<p class="form-error">Informe horas positivas e custo direto válido para calcular.</p>')+'</div>';
}
export function companyView(data,hours='8',extra='0'){
 const cfg=companyConfig(data.company),sum=summary(data);
 return '<section class="fin-screen company-screen">'+heading('Configurações da empresa')+
 '<div class="fin-kpi-grid">'+metric('Custo mensal da empresa',sum.total)+
 '<div class="fin-kpi"><span>Funcionários ativos</span><strong>'+sum.employees+'</strong></div></div>'+
 '<p class="fin-intro">Esses parâmetros serão usados como padrão para formar preços de mão de obra e futuros orçamentos. Não alteram os custos originais.</p>'+
 '<form id="company-form" class="company-form">'+
 '<h2>Identificação e tributação</h2>'+
 fld('Nome da empresa','companyName',cfg.companyName,'text','maxlength="160" placeholder="Nome comercial"')+
 '<label class="modal-field"><span>Regime tributário</span><select name="taxRegime">'+opt(cfg.taxRegime,[
  ['simples','Simples Nacional'],['mei','MEI'],['presumido','Lucro Presumido'],['real','Lucro Real'],['outro','Outro']])+'</select></label>'+
 '<label class="modal-field"><span>Anexo do Simples (referência)</span><select name="annex">'+opt(cfg.annex,[
  ['nao_definido','Não definido / não se aplica'],['I','Anexo I'],['II','Anexo II'],
  ['III','Anexo III'],['IV','Anexo IV'],['V','Anexo V']])+'</select></label>'+
 fld('Alíquota efetiva total sobre a nota (%)','taxPct',cfg.taxPct,'number','max="80" required')+
 fld('Margem de lucro desejada (% sobre preço de venda)','marginPct',cfg.marginPct,'number','max="80" required')+
 info+
 '<h2>Capacidade produtiva da empresa</h2>'+
 fld('Dias produtivos por mês','productiveDays',cfg.productiveDays,'number','min="1" max="31" step="1" required')+
 fld('Horas produtivas por dia (por profissional)','hoursPerDay',cfg.hoursPerDay,'number','min="0.01" max="24" required')+
 fld('Quantidade de profissionais produtivos','productivePeople',cfg.productivePeople||'','number','min="1" max="1000" step="1" required placeholder="Ex.: 2"')+
 '<p class="fin-helper">Cadastre somente os profissionais cujas horas serão vendidas. Os custos gerais da empresa são rateados por essas horas. Um funcionário administrativo entra no custo mensal, mas não necessariamente na quantidade de profissionais produtivos.</p>'+
 '<p id="company-error" role="alert" class="form-error" hidden></p>'+
 '<button class="gold-button" type="submit">'+icon('check',18)+' Salvar configuração da empresa</button></form>'+
 '<article class="fin-report-section"><h2>Cálculo rápido de preços</h2>'+
 '<div class="pricing-simulator">'+fld('Horas de mão de obra previstas','quoteHours',hours,'number','min="0.01" max="100000" step="0.25" data-pricing-input')+
 fld('Outros custos diretos deste serviço (R$)','quoteExtra',extra,'number','min="0" step="0.01" data-pricing-input')+'</div>'+
 '<div id="pricing-preview" aria-live="polite">'+pricingPreview(data,hours,extra)+'</div>'+
 '<p class="fin-helper">Fórmula: preço = custo do serviço ÷ (1 − imposto% − margem%). O lucro é calculado sobre a venda, após considerar tributos. Custos adicionais devem ser lançados apenas quando não estiverem incluídos no custo mensal.</p></article>'+
 '<div class="fin-link-row"><button type="button" data-go="costs">Ver custos da empresa '+icon('chevron',16)+'</button>'+
 '<button type="button" data-go="appearance">Personalizar cores '+icon('chevron',16)+'</button></div></section>';
}
export function appearanceView(config){
 const cfg=companyConfig(config);
 return '<section class="fin-screen appearance-screen">'+heading('Cores do aplicativo')+
 '<p class="fin-intro">Escolha uma identidade visual. O tema é salvo no Supabase da sua conta e aplicado em todas as telas, sem alterar os logotipos oficiais.</p>'+
 '<div class="appearance-choices">'+THEMES.map(theme=>{
  const [name,primary,secondary]=themes[theme];
  return '<button type="button" class="appearance-choice'+(cfg.theme===theme?' active':'')+
   '" data-theme-choice="'+theme+'" aria-pressed="'+(cfg.theme===theme?'true':'false')+'">'+
   '<span class="appearance-swatch" style="background:linear-gradient(135deg,'+primary+','+secondary+')"></span>'+
   '<span>'+e(name)+'</span>'+(cfg.theme===theme?icon('check',19):'')+'</button>';
 }).join('')+'</div>'+
 '<p class="fin-helper">A escolha só é aplicada após a confirmação de gravação no banco. Seus dados financeiros e as configurações tributárias não são modificados.</p>'+
 '<div class="fin-link-row"><button type="button" data-go="company">Configuração da empresa '+icon('chevron',16)+'</button></div></section>';
}
