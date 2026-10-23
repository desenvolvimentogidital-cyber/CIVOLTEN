import {financeOverview,financeMonths,budgetFinancials} from '/lib/civolten-finance.mjs';

// Graficos em SVG locais, sem dependencias externas ou scripts de terceiros.
export function chartMonths(rows,series,emptyText){
 if(!rows.some(x=>series.some(s=>x[s.key]>0)))
  return '<div class="fin-empty-graph">'+emptyText+'</div>';
 const max=Math.max(1,...rows.flatMap(x=>series.map(s=>Math.max(0,x[s.key]))));
 const ticks=rows.map((x,i)=>{
  const pos=42+i*108;
  const bars=series.map((serie,j)=>{
   const val=Math.max(0,x[serie.key]);
   const h=Math.round(val/max*132);
   return '<rect x="'+(pos+j*27)+'" y="'+(168-h)+'" width="23" height="'+h+'" rx="5" class="'+serie.css+'"><title>'+x.label+' · '+serie.label+': '+(val/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</title></rect>';
  }).join('');
  return bars+'<text x="'+(pos+24)+'" y="193" text-anchor="middle" class="fin-svg-label">'+x.label+'</text>';
 }).join('');
 return '<svg class="fin-chart-svg" viewBox="0 0 690 210" role="img" aria-label="'+series.map(s=>s.label).join(' e ')+' nos últimos seis meses" preserveAspectRatio="xMidYMid meet">'+
 '<line x1="26" x2="670" y1="168" y2="168" class="fin-svg-baseline"/>'+
 ticks+'</svg><div class="fin-legend">'+series.map(s=>'<span><i class="'+s.css+'"></i>'+s.label+'</span>').join('')+'</div>';
}
const statusName={rascunho:'Rascunho',enviado:'Enviado',aprovado:'Aprovado',recusado:'Recusado'};
export function projectResults(data,search,status,esc,brl){
 const query=String(search||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const selected=data.budgets.filter(b=>{
  if(status!=='todos'&&b.status!==status)return false;
  return (b.title+' '+(b.customer||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(query);
 });
 if(!selected.length)return '<div class="fin-empty-graph">Nenhuma obra encontrada com esses filtros.</div>';
 return '<div class="fin-project-scroll"><table class="fin-project-table"><thead><tr><th>Obra / cliente</th><th>Situação</th><th>Custos</th><th>Venda</th><th>Impostos</th><th>Lucro previsto</th><th></th></tr></thead><tbody>'+
  selected.map(row=>{
   const x=budgetFinancials(row);
   const margin=x.margin_pct.toFixed(1)+'%';
   return '<tr><td><strong>'+esc(x.title)+'</strong><small>'+esc(x.customer||'Sem cliente')+'</small></td>'+
   '<td><span class="fin-status fin-status-'+esc(x.status)+'">'+esc(statusName[x.status]||x.status)+'</span></td>'+
   '<td>'+brl(x.cost_cents)+'</td><td>'+brl(x.price_cents)+'</td><td>'+brl(x.tax_cents)+'</td>'+
   '<td class="'+(x.profit_cents<0?'fin-negative':'fin-positive')+'"><strong>'+brl(x.profit_cents)+'</strong><small>'+margin+' de margem</small></td>'+
   '<td><button type="button" class="subtle small" data-action="open-budget" data-id="'+esc(x.id)+'">Abrir</button></td></tr>';
  }).join('')+'</tbody></table></div>'+
  '<p class="fin-hint">'+selected.length+' orçamento(s) encontrados · valores estimados, não necessariamente recebidos.</p>';
}
export function financialDashboard({data,search,status,esc,brl,title,companyRates,notice}){
 const cfg=data.settings[0],rates=companyRates(data.fixed,cfg||{},data.workers);
 const all=financeOverview(data.budgets,data.cash),months=financeMonths(data.budgets,data.cash);
 const p=all.approved,actual=all.cash;
 const margin=p.price_cents?p.profit_cents/p.price_cents*100:0;
 const duplicateWarning=rates.payroll_cents>0&&data.fixed.some(x=>x.active&&/sal[aá]rio|folha de pagamento|remunera[cç][aã]o/i.test(x.name))
 ?'<div class="warning" role="note">Revise o possível salário administrativo repetido entre despesas fixas e folha de funcionários.</div>':'';
 const settingsWarning=!cfg
 ?'<div class="warning" role="alert">Parâmetros de margem e impostos não configurados. Revise-os antes de usar os preços previstos.</div>'
 :(Number(cfg.margin_pct)===0||Number(cfg.tax_pct)===0)
 ?'<div class="warning" role="alert">Impostos ou margem de lucro estão em 0%. Confira se isso representa a realidade da empresa.</div>':'';
 const date=new Date(),localDate=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const optionBudgets=data.budgets.filter(b=>b.status==='aprovado'||b.status==='enviado');
 const cashRows=data.cash.slice(0,8).map(x=>{
  const match=data.budgets.find(b=>b.id===x.budget_id);
  return '<div class="fin-cash-line"><span><strong>'+esc(x.description)+'</strong><small>'+esc(x.category)+' · '+esc(String(x.occurred_on||'').split('-').reverse().join('/'))+(match?' · '+esc(match.title):'')+'</small></span>'+
   '<strong class="'+(x.kind==='saida'?'fin-negative':'fin-positive')+'">'+(x.kind==='saida'?'− ':'+ ')+brl(x.amount_cents)+'</strong>'+
   '<button class="subtle small" type="button" data-action="delete-cash" data-id="'+esc(x.id)+'" aria-label="Excluir lançamento">×</button></div>';
 }).join('');
 const card=(label,value,sub,klass='')=>'<article class="fin-kpi '+klass+'"><small>'+label+'</small><strong>'+value+'</strong><span>'+sub+'</span></article>';
 return title('Visão geral','Indicadores financeiros da CIVOLTEN com análise de orçamentos e movimentações reais de caixa.',
 '<button type="button" class="primary" data-action="new-budget">+ Novo orçamento</button>')+
 settingsWarning+duplicateWarning+
 '<div class="fin-section-head"><h2>Visão financeira da empresa</h2><span>Custos mensais e projeções</span></div>'+
 '<div class="fin-kpis">'+
 card('Custo mensal da empresa',brl(rates.monthly_cents),'Despesas fixas '+brl(rates.fixed_expenses_cents)+' + folha '+brl(rates.payroll_cents),'fin-kpi-gold')+
 card('Custo por dia',brl(rates.daily_cents),rates.billable_days_month+' dias faturáveis/mês')+
 card('Custo por hora',brl(rates.hourly_cents),rates.hours_day+' horas por dia')+
 card('Propostas em aberto',brl(all.pipeline.open_cents),all.pipeline.open_count+' enviadas · ainda não fechadas','fin-kpi-gold')+
 card('Obras fechadas (aprovadas)',brl(all.pipeline.closed_cents),all.pipeline.closed_count+' aprovadas · faturamento previsto')+
 card('Rascunhos em preparação',brl(all.pipeline.draft_cents),all.pipeline.draft_count+' ainda não enviados')+
 card('Venda prevista (aprovadas)',brl(p.price_cents),'Não é dinheiro recebido')+
 card('Custos previstos (aprovadas)',brl(p.cost_cents),'Inclui o rateio da estrutura')+
 card('Impostos previstos',brl(p.tax_cents),'Estimativa sobre o preço de venda')+
 card('Lucro estimado',brl(p.profit_cents),'Margem '+margin.toFixed(1)+'% · somente aprovadas',p.profit_cents<0?'fin-kpi-loss':'fin-kpi-profit')+
 '</div>'+
 '<div class="fin-grid-two"><section class="card fin-panel"><header class="fin-panel-header"><div><h2>Obras aprovadas · evolução</h2><p>Venda prevista × custo previsto · últimos 6 meses</p></div><span class="fin-tag">Projeção</span></header>'+
 chartMonths(months,[{key:'price_cents',label:'Venda prevista',css:'fin-bar-gold'},{key:'cost_cents',label:'Custo previsto',css:'fin-bar-blue'}],'Ainda não há obras aprovadas neste período.')+
 '<p class="fin-hint">Agrupado pela data de cadastro da obra aprovada. A aprovação não equivale a faturamento.</p></section>'+
 '<section class="card fin-panel"><header class="fin-panel-header"><div><h2>Fluxo de caixa</h2><p>Recebimentos × pagamentos · últimos 6 meses</p></div><span class="fin-tag">Real registrado</span></header>'+
 chartMonths(months,[{key:'income_cents',label:'Entradas registradas',css:'fin-bar-green'},{key:'expense_cents',label:'Saídas registradas',css:'fin-bar-red'}],'Cadastre recebimentos e pagamentos reais para iniciar este gráfico.')+
 '<p class="fin-hint">Sem lançamentos automáticos de propostas, salários ou materiais. Apenas o que você registrar como pago ou recebido.</p></section></div>'+
 '<div class="fin-grid-two"><section class="card fin-panel"><header class="fin-panel-header"><div><h2>Caixa da empresa</h2><p>Movimentações efetivamente registradas</p></div><span class="fin-tag">Controle manual</span></header>'+
 '<div class="fin-cash-kpis"><div><small>Entradas</small><strong class="fin-positive">'+brl(actual.income_cents)+'</strong></div><div><small>Saídas</small><strong class="fin-negative">'+brl(actual.expense_cents)+'</strong></div><div><small>Saldo dos lançamentos</small><strong class="'+(actual.balance_cents<0?'fin-negative':'')+'">'+brl(actual.balance_cents)+'</strong></div></div>'+
 '<p class="fin-hint">Saldo desde o início dos registros, sem saldo bancário inicial presumido. Não é extrato bancário nem lucro contábil.</p>'+
 '<form id="cashEntryForm" class="fin-cash-form"><h3>Novo movimento de caixa</h3>'+
 '<div class="fin-cash-fields"><label>Tipo<select name="kind" required><option value="entrada">Entrada recebida</option><option value="saida">Saída paga</option></select></label>'+
 '<label>Valor (R$)<input name="amount" type="number" min=".01" step=".01" required placeholder="0,00"></label>'+
 '<label>Data<input name="occurred_on" type="date" value="'+localDate+'" required></label>'+
 '<label>Categoria<select name="category" required><option>Recebimento de obra</option><option>Pagamento de equipe</option><option>Materiais</option><option>Despesas fixas</option><option>Impostos</option><option>Outros</option></select></label>'+
 '<label class="fin-full">Descrição<input name="description" maxlength="140" placeholder="Ex.: Entrada de sinal da obra" required></label>'+
 '<label class="fin-full">Obra relacionada (opcional)<select name="budget_id"><option value="">Sem vínculo</option>'+optionBudgets.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('')+'</select></label></div>'+
 '<button class="primary" type="submit">Registrar movimentação</button></form>'+
 '<h3 class="fin-subtitle">Últimos lançamentos</h3>'+(cashRows||'<p class="fin-hint">Nenhum recebimento ou pagamento registrado ainda.</p>')+'</section>'+
 '<section class="card fin-panel"><header class="fin-panel-header"><div><h2>Margem e saúde financeira</h2><p>Controle de preço e rentabilidade</p></div><span class="fin-tag">Ajustável</span></header>'+
 '<div class="fin-compare"><div><small>Margem-alvo configurada</small><strong>'+Number(cfg?.margin_pct??0).toFixed(2)+'%</strong></div><div><small>Margem estimada das aprovadas</small><strong class="'+(margin<0?'fin-negative':'fin-positive')+'">'+margin.toFixed(2)+'%</strong></div></div>'+
 '<form id="dashboardMarginForm" class="fin-margin-form"><h3>Ajustar parâmetros das próximas obras</h3>'+
 '<div class="fin-cash-fields"><label>Margem-alvo (%)<input name="margin_pct" type="number" min="0" max="99" step=".01" value="'+esc(cfg?.margin_pct??0)+'" required></label>'+
 '<label>Impostos estimados (%)<input name="tax_pct" type="number" min="0" max="99" step=".01" value="'+esc(cfg?.tax_pct??0)+'" required></label></div>'+
 '<button class="secondary" type="submit">Salvar margens e impostos</button></form>'+
 '<p class="fin-hint">Mudanças afetam novos orçamentos; propostas já salvas mantêm as margens originais. Lucro previsto = preço − custo − impostos estimados.</p>'+
 '<div class="fin-health"><h3>Como interpretar os números</h3><p>O lucro das propostas aprovadas ainda é <strong>estimativa</strong>. O saldo do caixa depende dos recebimentos e pagamentos que você lançar. Para medir a saúde financeira real, registre as movimentações e confira obrigações a pagar, tributos e extratos.</p></div>'+
 '<div class="fin-status-count"><span>Rascunhos: '+all.byStatus.rascunho+'</span><span>Enviados: '+all.byStatus.enviado+'</span><span>Aprovados: '+all.byStatus.aprovado+'</span><span>Recusados: '+all.byStatus.recusado+'</span></div>'+
 '</section></div>'+
 '<section class="card fin-panel fin-projects"><header class="fin-panel-header"><div><h2>Resultado por obra</h2><p>Pesquise e compare o custo, a venda, os impostos e o lucro de cada proposta</p></div><span class="fin-tag">Todas as obras</span></header>'+
 '<div class="fin-filters"><label>Buscar por obra ou cliente<input id="dashboardProjectSearch" type="search" placeholder="Pesquisar obra ou cliente" value="'+esc(search)+'"></label>'+
 '<label>Situação<select id="dashboardProjectStatus">'+Object.entries({todos:'Todas',rascunho:'Rascunhos',enviado:'Enviados',aprovado:'Aprovados',recusado:'Recusados'}).map(([v,n])=>'<option value="'+v+'" '+(status===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div>'+
 '<div id="dashboardProjectResults">'+projectResults(data,search,status,esc,brl)+'</div></section>'+
 notice();
}
