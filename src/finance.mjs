// CIVOLTEN | Faturamento e fluxo de caixa gerencial.
// Valores em centavos nas somas; cadastros gravados em reais no Supabase.
// Custos fixos/variáveis e folha são PREVISÕES, nunca baixas de caixa automáticas.
import {decimal,cents,summary,employeeCost,fixedMonthly,variableMonthly} from './calc.mjs';

export function localToday(now=new Date()){
 const p=n=>String(n).padStart(2,'0');
 return now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate());
}
export const currentMonth=(now=new Date())=>localToday(now).slice(0,7);
export function validDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
 const parsed=new Date(value+'T00:00:00.000Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function validateEntry(fields){
 const kind=String(fields.kind||'');
 if(!['income','expense'].includes(kind))throw Error('Selecione receita ou despesa.');
 const title=String(fields.title||'').trim();
 if(!title||title.length>180)throw Error('Informe uma descrição de até 180 caracteres.');
 const amount=decimal(fields.amount);
 if(amount===null||!Number.isFinite(amount)||amount<=0||amount>999999999999.99||
  Math.abs(amount*100-Math.round(amount*100))>0.00001)
  throw Error('Informe um valor positivo com no máximo duas casas decimais.');
 const dueDate=String(fields.dueDate||'');
 if(!validDate(dueDate))throw Error('Informe um vencimento válido.');
 const paidDate=String(fields.paidDate||'').trim();
 if(paidDate&&!validDate(paidDate))throw Error('A data de pagamento/recebimento é inválida.');
 const short=(key,max=180)=>{
  const val=String(fields[key]||'').trim();
  if(val.length>max)throw Error('Campo '+key+' excedeu o limite de caracteres.');
  return val;
 };
 return {kind,title,amount,party:short('party'),category:short('category'),
  project:short('project'),reference:short('reference',80),
  notes:short('notes',1000),dueDate,paidDate:paidDate||null};
}
export function amountCents(entry){
 return cents(entry?.amount)??0;
}
export function entryStatus(entry,today=localToday()){
 if(entry.paidDate)return 'paid';
 return entry.dueDate<today?'late':'open';
}
export function monthSummary(data,month=currentMonth(),today=localToday()){
 const items=data?.ledger||[];
 const current=items.filter(e=>e.dueDate?.slice(0,7)===month);
 const due=(kind,paid)=>current.filter(e=>e.kind===kind&&(paid===null||!!e.paidDate===paid));
 const paidInMonth=(kind)=>items.filter(e=>e.kind===kind&&e.paidDate?.slice(0,7)===month);
 const total=arr=>arr.reduce((acc,e)=>acc+amountCents(e),0);
 const billed=total(current.filter(e=>e.kind==='income'));
 const committed=total(current.filter(e=>e.kind==='expense'));
 const received=total(paidInMonth('income'));
 const spent=total(paidInMonth('expense'));
 return {
  billed,committed,received,spent,balance:received-spent,
  openReceivable:total(due('income',false)),
  openPayable:total(due('expense',false)),
  overdueReceivable:total(items.filter(e=>e.kind==='income'&&!e.paidDate&&e.dueDate<today)),
  overduePayable:total(items.filter(e=>e.kind==='expense'&&!e.paidDate&&e.dueDate<today)),
  expectedCosts:summary(data).total,
  transactions:current.length,
  openCount:current.filter(e=>!e.paidDate).length
 };
}
export function reportRows(data,month=currentMonth()){
 const rows=(data.ledger||[]).filter(e=>e.dueDate?.slice(0,7)===month||e.paidDate?.slice(0,7)===month);
 return rows.slice().sort((a,b)=>b.dueDate.localeCompare(a.dueDate));
}
export function expenseCategories(data,month=currentMonth()){
 const sums=new Map();
 for(const e of data.ledger||[]){
  if(e.kind!=='expense'||e.paidDate?.slice(0,7)!==month)continue;
  const key=e.category||'Sem categoria';
  sums.set(key,(sums.get(key)||0)+amountCents(e));
 }
 return [...sums].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
}
export function flowMonths(data,month=currentMonth(),count=6){
 const start=new Date(month+'-01T12:00:00Z');
 if(Number.isNaN(start.getTime()))return [];
 const series=[];
 for(let i=count-1;i>=0;i--){
  const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()-i,1,12));
  const key=d.toISOString().slice(0,7);
  series.push({month:key,...monthSummary(data,key)});
 }
 return series;
}
const csvField=value=>{
 let s=String(value??'');
 // Evita que planilhas interpretem dados do usuário como fórmulas.
 if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
export function reportCsv(data,month=currentMonth()){
 const head=['Seção','Tipo','Descrição','Categoria','Cliente/Fornecedor','Obra',
  'Valor (R$)','Vencimento','Pago/Recebido em','Referência'];
 const rows=[];
 const row=(section,type,title,cat,party,project,amount,due,paid,reference)=>
  rows.push([section,type,title,cat,party,project,(amount/100).toFixed(2).replace('.',','),
   due||'',paid||'',reference||'']);
 for(const e of reportRows(data,month))
  row('Movimentação',e.kind==='income'?'Receita':'Despesa',e.title,e.category,e.party,e.project,
   amountCents(e),e.dueDate,e.paidDate,e.reference);
 for(const e of data.fixed||[])
  row('Previsão','Custo fixo',e.name,e.category,'','',fixedMonthly(e)??0,month+'-01','','');
 for(const e of data.variable||[])
  row('Previsão','Custo variável',e.name,e.category,'','',variableMonthly(e)??0,month+'-01','','');
 for(const e of (data.employees||[]).filter(x=>x.active!==false))
  row('Previsão','Equipe',e.name,e.role,'','',employeeCost(e,data.payroll).monthly??0,month+'-01','','');
 return '\uFEFF'+[head,...rows].map(values=>values.map(csvField).join(';')).join('\r\n');
}
