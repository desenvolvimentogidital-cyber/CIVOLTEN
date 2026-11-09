// Telas gerenciais de Financeiro, Faturamento e Relatórios.
import {brl,summary} from './calc.mjs';
import {monthSummary,reportRows,expenseCategories,flowMonths,entryStatus,
 amountCents,localToday,currentMonth} from './finance.mjs';
import {icon,e} from './views.mjs';

const money=brl;
const dateBR=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
const labelMonth=month=>{
 const d=new Date(month+'-01T12:00:00Z');
 return Number.isNaN(d.getTime())?month:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
};
const header=(title)=>'<div class="page-heading"><button class="small-square" type="button" data-go="home" aria-label="Voltar">'+icon('back',25)+'</button><h1>'+title+'</h1><span class="small-square is-empty"></span></div>';
const periodInput=(month)=>'<label class="fin-period"><span>Período</span><input type="month" aria-label="Selecionar mês" data-period value="'+e(month)+'"></label>';
const card=(caption,cents,accent=false)=>'<div class="fin-kpi'+(accent?' fin-kpi-featured':'')+'"><span>'+caption+'</span><strong>'+money(cents)+'</strong></div>';
const statusText=(entry,today)=>{
 const status=entryStatus(entry,today);
 return status==='paid'?(entry.kind==='income'?'Recebido':'Pago'):status==='late'?'Atrasado':'Em aberto';
};
const empty='<div class="fin-empty">Nenhum lançamento neste período. Use os botões acima para começar.</div>';
const entryList=(items,today=localToday())=>{
 if(!items.length)return empty;
 return '<div class="fin-entry-list">'+items.map(item=>{
  const paid=!!item.paidDate;
  const late=!paid&&item.dueDate<today;
  return '<div class="fin-entry"><button class="fin-entry-main" type="button" data-action="edit" data-kind="ledger" data-id="'+e(item.id)+'">'+
   '<span class="fin-entry-icon">'+icon(item.kind==='income'?'arrowup':'coins',20)+'</span>'+
   '<span class="fin-entry-text"><b>'+e(item.title)+'</b><small>'+
   e(item.party||item.project||item.category||(item.kind==='income'?'Receita':'Despesa'))+'</small>'+
   '<em>Vence '+dateBR(item.dueDate)+(paid?' · '+dateBR(item.paidDate):'')+'</em></span>'+
   '<span class="fin-entry-right"><strong>'+money(amountCents(item))+'</strong><small class="'+(paid?'is-paid':late?'is-late':'')+'">'+statusText(item,today)+'</small></span></button>'+
   (!paid?'<button class="fin-pay-button" type="button" data-action="mark-paid" data-id="'+e(item.id)+'" aria-label="'+
     (item.kind==='income'?'Registrar recebimento':'Registrar pagamento')+'">'+icon('check',15)+
    (item.kind==='income'?' Receber':' Pagar')+'</button>':'')+
   '</div>';
 }).join('')+'</div>';
};
export function financeView(data,month=currentMonth(),filter='all'){
 const s=monthSummary(data,month),today=localToday();
 const entries=reportRows(data,month).filter(x=>filter==='all'||x.kind===filter);
 return '<section class="fin-screen">'+header('Financeiro')+periodInput(month)+
  '<div class="fin-kpi-grid">'+card('Faturamento com vencimento',s.billed,true)+
  card('Recebido no mês',s.received)+card('Despesas pagas',s.spent)+card('Saldo de caixa do mês',s.balance,true)+'</div>'+
  '<div class="fin-dues"><div><span>A receber neste mês</span><strong>'+money(s.openReceivable)+'</strong></div>'+
  '<div><span>A pagar neste mês</span><strong>'+money(s.openPayable)+'</strong></div>'+
  (s.overdueReceivable||s.overduePayable?'<p>Em atraso (todos os períodos): '+money(s.overdueReceivable)+' a receber e '+money(s.overduePayable)+' a pagar.</p>':'')+
  '</div><div class="fin-actions"><button type="button" class="gold-button" data-action="new-income">'+icon('plus',20)+' Faturar / Receber</button>'+
  '<button type="button" class="outlined-button" data-action="new-expense">'+icon('plus',20)+' Nova despesa</button></div>'+
  '<div class="fin-link-row"><button type="button" data-go="costs">Custos previstos '+icon('chevron',17)+'</button>'+
  '<button type="button" data-go="reports">Relatórios '+icon('chevron',17)+'</button>'+
  '<button type="button" data-go="works">Obras e medições '+icon('chevron',17)+'</button></div>'+
  '<div class="fin-section-title"><h2>Lançamentos de '+e(labelMonth(month))+'</h2></div>'+
  '<div class="fin-filters">'+[
   ['all','Todos'],['income','Receitas'],['expense','Despesas']
  ].map(([key,label])=>'<button type="button" data-fin-filter="'+key+'" class="'+(filter===key?'active':'')+'">'+label+'</button>').join('')+'</div>'+
  entryList(entries,today)+
  '<p class="fin-helper">Faturamento aqui é controle gerencial de valores a receber, não emissão de nota fiscal. Datas de recebimento e pagamento determinam o caixa realizado. Custos da empresa e folha são previsões independentes.</p></section>';
}
const entryField=(title,name,value='',type='text',required=false)=>
 '<label class="modal-field"><span>'+title+'</span><input name="'+name+'" type="'+type+'" value="'+e(value??'')+'"'+
 (type==='number'?' step="0.01" min="0.01" inputmode="decimal"':'')+
 (required?' required':'')+'></label>';
const option=(value,label,selected)=>'<option value="'+value+'"'+(value===selected?' selected':'')+'>'+label+'</option>';
export function ledgerEditorView(item={},suggested='income'){
 const kind=item.kind||suggested,editing=!!item.id;
 return '<div class="modal-inner"><div class="modal-heading"><h2>'+(editing?'Editar lançamento':'Novo lançamento')+'</h2>'+
 '<button class="small-square" type="button" data-action="close-modal" aria-label="Fechar">×</button></div>'+
 '<form id="record-form"><div class="modal-fields">'+
 '<label class="modal-field"><span>Tipo</span><select name="kind">'+option('income','Receita / faturamento',kind)+
 option('expense','Despesa / conta a pagar',kind)+'</select></label>'+
 entryField('Descrição','title',item.title||'', 'text',true)+
 entryField('Cliente ou fornecedor','party',item.party||'')+
 entryField('Obra / contrato (opcional)','project',item.project||'')+
 entryField('Categoria','category',item.category||'')+
 entryField('Valor (R$)','amount',item.amount??'', 'number',true)+
 entryField('Vencimento','dueDate',item.dueDate||localToday(), 'date',true)+
 entryField('Data recebida / paga (deixe vazio se em aberto)','paidDate',item.paidDate||'', 'date')+
 entryField('Número / referência do documento','reference',item.reference||'')+
 '<label class="modal-field"><span>Observações</span><textarea name="notes" rows="2" maxlength="1000">'+e(item.notes||'')+'</textarea></label>'+
 '</div><p class="helper-text">Preencha a data de recebimento/pagamento apenas quando o dinheiro efetivamente movimentar. Uma emissão fiscal oficial é feita fora deste cadastro.</p>'+
 '<p class="form-error" role="alert" id="form-error" hidden></p>'+
 '<div class="modal-buttons"><button class="outlined-button" type="button" data-action="close-modal">Cancelar</button>'+
 '<button class="gold-button" type="submit">Salvar</button></div>'+
 (editing?'<button class="fin-delete" type="button" data-action="delete-record">'+icon('trash',18)+' Excluir lançamento</button>':'')+
 '</form></div>';
}
const chart=(data)=>{
 const max=Math.max(1,...data.flatMap(x=>[x.received,x.spent]));
 return '<div class="fin-chart"><div class="fin-chart-legend"><span>■ Entradas recebidas</span><span>■ Saídas pagas</span></div>'+
 data.map(x=>'<div class="fin-chart-row"><span>'+e(x.month.slice(5,7)+'/'+x.month.slice(2,4))+'</span>'+
 '<div class="fin-chart-bars"><div class="fin-chart-in" style="width:'+Math.round(100*x.received/max)+'%" title="Entradas '+money(x.received)+'"></div>'+
 '<div class="fin-chart-out" style="width:'+Math.round(100*x.spent/max)+'%" title="Saídas '+money(x.spent)+'"></div></div></div>').join('')+'</div>';
};
export function reportsView(data,month=currentMonth()){
 const s=monthSummary(data,month),pred=summary(data),categories=expenseCategories(data,month),rows=reportRows(data,month);
 return '<section class="fin-screen fin-report">'+header('Relatórios')+periodInput(month)+
 '<p class="fin-intro">Resumo gerencial de '+e(labelMonth(month))+', calculado a partir dos seus cadastros reais.</p>'+
 '<div class="fin-kpi-grid">'+card('Faturado (vencimentos)',s.billed,true)+
 card('Recebido (caixa)',s.received)+card('Pago (caixa)',s.spent)+
 card('Saldo do período',s.balance,true)+
 card('A receber no período',s.openReceivable)+card('A pagar no período',s.openPayable)+'</div>'+
 '<div class="fin-report-tools"><button type="button" data-action="export-csv" class="gold-button">'+icon('file',18)+' Exportar Excel/CSV</button>'+
 '<button type="button" data-action="print-report" class="outlined-button">'+icon('file',18)+' Imprimir / PDF</button></div>'+
 '<article class="fin-report-section"><h2>Fluxo de caixa · últimos 6 meses</h2>'+chart(flowMonths(data,month))+'</article>'+
 '<article class="fin-report-section"><h2>Custos mensais previstos</h2>'+
 '<div class="fin-report-lines"><div><span>Fixos</span><b>'+money(pred.fixed)+'</b></div>'+
 '<div><span>Variáveis previstos</span><b>'+money(pred.variable)+'</b></div>'+
 '<div><span>Equipe ativa (estimada)</span><b>'+money(pred.team)+'</b></div>'+
 '<div class="fin-highlight"><span>Total projetado / mês</span><b>'+money(pred.total)+'</b></div></div>'+
 (pred.missing?'<p class="fin-helper">'+pred.missing+' cadastro(s) com valores ainda pendentes.</p>':'')+
 '<p class="fin-helper">Projeção de custos não equivale a despesa paga. Para registrar pagamentos, use Financeiro.</p></article>'+
 '<article class="fin-report-section"><h2>Despesas efetivamente pagas por categoria</h2>'+
 (categories.length?'<div class="fin-report-lines">'+categories.map(x=>
 '<div><span>'+e(x.name)+'</span><b>'+money(x.amount)+'</b></div>').join('')+'</div>':
 '<p class="fin-helper">Nenhuma despesa paga neste mês.</p>')+'</article>'+
 '<article class="fin-report-section"><h2>Lançamentos do período ('+rows.length+')</h2>'+
 entryList(rows)+'</article>'+
 '<div class="fin-link-row"><button type="button" data-go="finance">Abrir financeiro '+icon('chevron',17)+'</button>'+
 '<button type="button" data-go="team">Ver equipe '+icon('chevron',17)+'</button></div>'+
 '<p class="fin-helper">Não é demonstração contábil nem fiscal. Saldo = recebimentos realizados − pagamentos realizados, conforme as datas lançadas; não representa lucro tributável.</p></section>';
}
