// CIVOLTEN · cronograma preliminar pelo esforço em horas-homem.
// Não é cronograma executivo: dependências, feriados, acesso e clima exigem revisão técnica.
import {decimal} from './calc.mjs';
import {validDate} from './finance.mjs';
const integer=(value,label,max,allowEmpty=false)=>{
 if(allowEmpty&&(value==null||String(value).trim()===''))return null;
 const n=decimal(value);
 if(!Number.isInteger(n)||n<1||n>max)throw Error(label+' deve estar entre 1 e '+max+'.');
 return n;
};
export function validateSchedule(raw={}){
 const data=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const goal=data.goal==='days'?'days':'crew';
 const pricingMode=data.pricingMode==='days'?'days':'hours';
 const days=integer(data.days,'Prazo de execução',730,true);
 const crew=integer(data.crew,'Número de profissionais',1000,true);
 const startDate=String(data.startDate??'').trim();
 if(startDate&&!validDate(startDate))throw Error('Data de início do cronograma inválida.');
 return {goal,days,crew,startDate,pricingMode};
}
const parseDate=str=>{
 const [y,m,d]=str.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d,12));
};
const dateString=date=>date.toISOString().slice(0,10);
const nextWorkingDay=date=>{
 const next=new Date(date.getTime());
 do{next.setUTCDate(next.getUTCDate()+1)}while([0,6].includes(next.getUTCDay()));
 return next;
};
const workingDays=(start,number)=>{
 let date=parseDate(start);
 while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
 const result=[];
 for(let i=0;i<number;i++){
  result.push(dateString(date));
  date=nextWorkingDay(date);
 }
 return result;
};
const safeHours=(item)=>{
 const quantity=decimal(item.quantity),hours=decimal(item.laborHours);
 if(quantity===null||hours===null||quantity<=0||hours<0||!Number.isFinite(quantity*hours))
  throw Error('Revise quantidade e horas por unidade antes de gerar o cronograma.');
 return Math.round(quantity*hours*1000)/1000;
};
export function schedulePlan(items,raw={},capacity={}){
 const settings=validateSchedule(raw);
 const hoursPerDay=decimal(capacity.hoursPerDay);
 const people=decimal(capacity.productivePeople);
 const monthlyDays=decimal(capacity.productiveDays);
 if(hoursPerDay===null||hoursPerDay<=0||hoursPerDay>24||
    !Number.isInteger(people)||people<=0||
    !Number.isInteger(monthlyDays)||monthlyDays<=0)
  return null;
 const rows=(items||[]).map((item,index)=>({
  id:item.id||String(index),description:String(item.description||'Serviço '+(index+1)),
  hours:safeHours(item),quantity:Number(item.quantity),unit:item.unit||'un'
 }));
 const totalHours=Math.round(rows.reduce((sum,item)=>sum+item.hours,0)*1000)/1000;
 const crewDefault=settings.crew??people;
 if(settings.goal==='days'&&settings.days===null)
  throw Error('Informe o prazo desejado em dias úteis para calcular os profissionais.');
 const usingDays=settings.goal==='days';
 const crew=usingDays?Math.max(1,Math.ceil(totalHours/(settings.days*hoursPerDay))):
  crewDefault;
 const days=usingDays?settings.days:totalHours>0?
  Math.max(1,Math.ceil(totalHours/(crew*hoursPerDay))):0;
 if(days>730)throw Error('Prazo estimado excede 730 dias úteis. Revise a equipe ou os serviços.');
 const neededPeople=usingDays?crew:totalHours>0?Math.ceil(totalHours/(Math.max(1,days)*hoursPerDay)):0;
 const available=people>=crew;
 const daySlots=settings.startDate&&days?workingDays(settings.startDate,days):[];
 let cumulative=0;
 const timeline=rows.map(row=>{
  if(row.hours===0||totalHours===0||days===0)return {...row,startDay:null,endDay:null,startDate:null,endDate:null,days:0};
  // Distribui o esforço entre os dias planejados, permitindo que dois serviços
  // usem o mesmo dia sem prometer execução física simultânea.
  const start=Math.min(days,Math.floor(cumulative/totalHours*days+1e-9)+1);
  cumulative+=row.hours;
  const end=Math.min(days,Math.max(start,Math.ceil(cumulative/totalHours*days-1e-9)));
  return {...row,startDay:start,endDay:end,days:end-start+1,
   startDate:daySlots[start-1]||null,endDate:daySlots[end-1]||null};
 });
 return {
  settings,totalHours,days,crew,requiredPeople:neededPeople,
  companyPeople:people,hoursPerDay,productiveDays:monthlyDays,
  available,extraPeople:Math.max(0,crew-people),rows:timeline,
  startDate:daySlots[0]||null,endDate:daySlots.at(-1)||null,
  dailyCompanyCost:capacity.monthlyCostCents>0?
   Math.ceil(capacity.monthlyCostCents/monthlyDays):null,
  dayBasedCost:capacity.monthlyCostCents>0&&days>0?
   Math.ceil(capacity.monthlyCostCents*days/monthlyDays):null,
  notes:'Estimativa por horas-homem; exclui feriados, intempéries, mobilização e dependências técnicas.'
 };
}
export const dateBR=(value)=>value?value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4):'A definir';
export const suggestExecutionTerm=plan=>plan?.days?
 String(plan.days)+' dias úteis estimados de execução'+(plan.startDate&&plan.endDate?
 ' (de '+dateBR(plan.startDate)+' a '+dateBR(plan.endDate)+')':'')+'.':'';
export function scheduleCsv(plan){
 if(!plan)throw Error('Configure capacidade produtiva para gerar o cronograma.');
 const safe=value=>{
  let s=String(value??'');if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 const entries=[
  ['Cronograma preliminar da CIVOLTEN',''],
  ['Prazo (dias úteis)',plan.days],['Profissionais estimados',plan.crew],
  ['Horas-homem totais',plan.totalHours],
  ['Data inicial',plan.startDate||''],['Data final',plan.endDate||''],[],
  ['Serviço','Horas-homem','Dia inicial','Dia final','Data inicial','Data final','Profissionais da obra']
 ];
 for(const row of plan.rows)
  entries.push([row.description,row.hours,row.startDay??'',row.endDay??'',
   row.startDate||'',row.endDate||'',plan.crew]);
 entries.push([],['Observação',plan.notes]);
 return '\uFEFF'+entries.map(row=>row.map(safe).join(';')).join('\r\n');
}
