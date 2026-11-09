// CIVOLTEN | Fluxo operacional: proposta aprovada -> obra -> HH reais -> medição -> recebível.
// Valores contratados congelados na aprovação; jamais reprecificar obra pela base atual.
import {priceBudget} from './budget.mjs';
import {validDate,localToday} from './finance.mjs';
import {decimal,cents} from './calc.mjs';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .replace(/[^a-z0-9]/gi,' ').toUpperCase().trim();
const text=(v,max,label,required=false)=>{
 const value=String(v??'').trim();
 if(value.length>max||(required&&!value))throw Error('Revise '+label+' (até '+max+' caracteres).');
 return value;
};
export const statusLabel={approved:'Aprovada',in_progress:'Em execução',
 completed:'Concluída',cancelled:'Cancelada'};
export const measuredStatus={draft:'A conferir',approved:'Aprovada'};
export const numberBR=x=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:3});
export function createWorkOrder(budget,fields={},id){
 if(!uuid.test(id||''))throw Error('Identificador da obra inválido.');
 if(budget?.demo!==false||budget?.commercial?.laborOnly!==true)
  throw Error('Somente propostas de mão de obra revisadas podem virar ordem de serviço.');
 const p=priceBudget(budget);
 if(!p?.rows?.length||!Number.isSafeInteger(p.totalSale)||p.totalSale<=0)
  throw Error('Revise o preço do orçamento antes da aprovação.');
 const ref=text(fields.contractRef,80,'número da ordem de serviço',true);
 const acceptance=text(fields.acceptanceRef,240,'referência do aceite real do cliente',true);
 const approvedOn=fields.approvedOn||localToday();
 if(!validDate(approvedOn))throw Error('Data de aprovação inválida.');
 const startOn=fields.startOn||null;
 if(startOn&&!validDate(startOn))throw Error('Data de início inválida.');
 const frozen=structuredClone(budget);
 // Armazena a precificação homologada e todo o escopo. Não usa custos futuros para recalcular.
 return {id,budgetId:budget.id,customer:text(budget.customer,180,'cliente',true),
  project:text(budget.project||budget.title,180,'obra'),contractRef:ref,
  acceptanceRef:acceptance,budgetSnapshot:frozen,pricedRows:p.rows,
  contractValue:p.totalSale/100,status:'approved',approvedOn,startOn,
  finishOn:null,createdAt:new Date().toISOString()};
}
export function workItem(order,itemId){
 if(!order||!Array.isArray(order.budgetSnapshot?.items))throw Error('Contrato sem itens.');
 const item=order.budgetSnapshot.items.find(x=>x.id===itemId);
 const row=order.pricedRows?.find(x=>x.id===itemId);
 if(!item||!row)throw Error('Serviço não pertence à obra aprovada.');
 return {item,row};
}
export function roleMatch(employee,item){
 const roles=item?.roles||[];
 if(!roles.length)return true;
 const employeeRole=norm(employee?.role);
 if(!employeeRole)return false;
 return roles.some(r=>{
  const needed=norm(r.role);
  if(!needed)return false;
  const simpl=s=>s.replace(/\b(A|DE|DO|DA|COM|EM|SEM|SGSP|HORISTA|ENCARGOS|COMPLEMENTARES)\b/g,' ').replace(/ +/g,' ').trim();
  const a=simpl(needed),b=simpl(employeeRole);
  return (a.length>=4&&b.includes(a))||(b.length>=4&&a.includes(b));
 });
}
export function workProgress(order,logs=[],measurements=[]){
 if(!order)return null;
 const items=(order.budgetSnapshot?.items||[]).map(item=>{
  const row=order.pricedRows.find(x=>x.id===item.id);
  if(!row)throw Error('Contrato com serviço sem preço congelado.');
  const target=Number(item.quantity),plannedHH=Number(row.hours);
  const measured=measurements.filter(m=>m.workOrderId===order.id&&m.itemId===item.id);
  const approved=measured.filter(m=>m.status==='approved');
  const measuredQty=approved.reduce((a,m)=>a+Number(m.quantity),0);
  const reservedQty=measured.reduce((a,m)=>a+Number(m.quantity),0);
  const invoicedCents=measured.filter(m=>m.status==='approved'&&
    m.ledgerEntryId).reduce((a,m)=>a+cents(m.amount),0);
  const measuredCents=approved.reduce((a,m)=>a+cents(m.amount),0);
  const hours=logs.filter(l=>l.workOrderId===order.id&&l.itemId===item.id)
   .reduce((a,l)=>a+Number(l.hours),0);
  const plannedSaleCents=Number(row.selling);
  return {...item,target,plannedHH,plannedSaleCents,measuredQty,
    reservedQty,remaining:Math.max(0,Math.round((target-reservedQty)*1000)/1000),
    measuredCents,invoicedCents,hours,unbilledCents:measuredCents-invoicedCents};
 });
 const plannedHH=items.reduce((a,x)=>a+x.plannedHH,0);
 const actualHH=items.reduce((a,x)=>a+x.hours,0);
 const approvedCents=items.reduce((a,x)=>a+x.measuredCents,0);
 const unbilledCents=items.reduce((a,x)=>a+x.unbilledCents,0);
 const contractCents=cents(order.contractValue);
 const projectedRate=order.budgetSnapshot.pricing.monthlyCostCents/
   order.budgetSnapshot.pricing.productiveHours;
 const actualCostCents=Math.ceil(actualHH*projectedRate);
 const plannedCostCents=Number(order.pricedRows.reduce((a,x)=>a+Number(x.cost),0));
 return {items,plannedHH,actualHH,hhVariance:actualHH-plannedHH,
  approvedCents,unbilledCents,contractCents,actualCostCents,plannedCostCents,
  balanceCents:contractCents-approvedCents,completed:items.length>0&&items.every(x=>x.measuredQty>=x.target),
  percent:contractCents?Math.min(100,approvedCents*100/contractCents):0};
}
export function createWorkLog(order,fields,employees,id){
 if(!uuid.test(id||''))throw Error('Identificador do apontamento inválido.');
 if(order.status!=='in_progress')throw Error('Inicie a obra antes de apontar horas.');
 const {item}=workItem(order,fields.itemId);
 const employee=(employees||[]).find(x=>x.id===fields.employeeId&&x.active!==false);
 if(!employee)throw Error('Selecione um profissional ativo da sua empresa.');
 const hours=decimal(fields.hours);
 if(hours===null||hours<=0||hours>24||Math.abs(hours*100-Math.round(hours*100))>1e-7)
  throw Error('Informe horas reais entre 0,01 e 24 por dia.');
 if(!validDate(fields.workDate))throw Error('Data do trabalho inválida.');
 const confirmed=fields.qualificationConfirmed===true||
  fields.qualificationConfirmed==='on';
 if(!roleMatch(employee,item)&&!confirmed)
  throw Error('A função do profissional não coincide com a composição SIURB. Confirme a habilitação antes de registrar.');
 return {id,workOrderId:order.id,itemId:item.id,employeeId:employee.id,
  workDate:fields.workDate,hours,qualificationConfirmed:confirmed,
  notes:text(fields.notes,900,'observações')};
}
export function createMeasurement(order,existing=[],fields={},id){
 if(!uuid.test(id||''))throw Error('Identificador da medição inválido.');
 if(order.status!=='in_progress')throw Error('Inicie a obra antes de medir.');
 const {item,row}=workItem(order,fields.itemId);
 const qty=decimal(fields.quantity);
 if(qty===null||qty<=0||qty>100000||Math.abs(qty*1000-Math.round(qty*1000))>1e-6)
  throw Error('Quantidade medida inválida (até 3 casas decimais).');
 const already=(existing||[]).filter(m=>m.workOrderId===order.id&&m.itemId===item.id&&m.id!==id);
 const used=already.reduce((a,m)=>a+Number(m.quantity),0);
 if(used+qty>Number(item.quantity)+1e-7)
  throw Error('A quantidade medida supera o contratado; registre aditivo antes de ampliar.');
 const measuredOn=fields.measuredOn||localToday();
 if(!validDate(measuredOn))throw Error('Data de medição inválida.');
 const full=Number(row.selling);
 const pastCents=already.reduce((a,m)=>a+cents(m.amount),0);
 const saleCents=Math.abs(used+qty-Number(item.quantity))<1e-7?
   full-pastCents:Math.round(full*qty/Number(item.quantity));
 if(!Number.isSafeInteger(saleCents)||saleCents<0)throw Error('Valor da medição inválido.');
 return {id,workOrderId:order.id,itemId:item.id,measuredOn,quantity:qty,
  amount:saleCents/100,status:'draft',approvedAt:null,
  notes:text(fields.notes,900,'observações')};
}
export function billingReference(measurement){return 'MED:'+measurement.id;}
export function canComplete(order,logs,measurements){
 const p=workProgress(order,logs,measurements);
 return order.status==='in_progress'&&p.completed&&p.actualHH>0;
}
const csvCell=x=>{
 let s=String(x??'');if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
export function workCsv(order,logs=[],measurements=[],employees=[]){
 const p=workProgress(order,logs,measurements);
 const rows=[['CIVOLTEN - relatório de execução de mão de obra',''],
  ['OS',order.contractRef],['Cliente',order.customer],['Obra',order.project],
  ['Status',statusLabel[order.status]],['Aceite informado',order.acceptanceRef],
  ['Valor contratado (R$)',order.contractValue.toFixed(2)],
  ['Valor medido aprovado (R$)',(p.approvedCents/100).toFixed(2)],
  ['HH previstas',p.plannedHH],['HH registradas',p.actualHH],[],
  ['Serviço','Unidade','Quantidade contratada','Quantidade aprovada',
   'HH previstas','HH realizadas','Valor medido aprovado R$']];
 for(const x of p.items)rows.push([x.description,x.unit,x.target,x.measuredQty,
  x.plannedHH,x.hours,(x.measuredCents/100).toFixed(2)]);
 rows.push([],['Data','Profissional','Serviço','HH realizadas','Observação']);
 for(const l of logs.filter(x=>x.workOrderId===order.id)){
  const person=employees.find(x=>x.id===l.employeeId);
  rows.push([l.workDate,person?.name||'Não encontrado',
   p.items.find(x=>x.id===l.itemId)?.description||'Serviço removido',l.hours,l.notes]);
 }
 rows.push([],['Medição','Data','Serviço','Quantidade','Valor R$','Situação','Referência']);
 for(const m of measurements.filter(x=>x.workOrderId===order.id)){
  rows.push([m.id,m.measuredOn,p.items.find(x=>x.id===m.itemId)?.description||'',m.quantity,
   Number(m.amount).toFixed(2),measuredStatus[m.status]||m.status,billingReference(m)]);
 }
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
