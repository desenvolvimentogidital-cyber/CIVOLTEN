// CIVOLTEN • núcleo financeiro simples, sem valores fictícios.
export const STORE_PREFIX='civolten_premium_v1_';
export function decimal(value){
 if(value==null||String(value).trim()==='')return null;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let s=String(value).trim().replace(/\s/g,'').replace(/^R\$/i,'');
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 const n=Number(s);
 return Number.isFinite(n)?n:null;
}
export function cents(value){
 const n=decimal(value);
 return n===null?null:Math.round(n*100);
}
export function brl(value){
 return value===null||value===undefined?'A calcular':
 (Number(value)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
export function fmt(value){
 return value==null?'':String(value).replace('.',',');
}
export function fresh(){
 return {version:1,fixed:[],variable:[],employees:[],updatedAt:null};
}
export function fixedMonthly(item){
 const val=cents(item.amount);
 if(val===null||val<0)return null;
 return item.frequency==='annual'?Math.round(val/12):val;
}
export function variableMonthly(item){
 const val=cents(item.unitCost),quantity=decimal(item.monthQty);
 if(val===null||val<0||quantity===null||quantity<0)return null;
 return Math.round(val*quantity);
}
export function employeeCost(p){
 if(p.contractType==='contractor'){
  const rate=cents(p.rate),qty=decimal(p.quantity),hours=decimal(p.hours);
  if(rate===null||rate<=0)return {monthly:null,hourly:null,status:'pending'};
  const unit=p.rateUnit||'hour';
  const monthly=unit==='month'?rate:qty!==null&&qty>=0?Math.round(rate*qty):null;
  const hourly=unit==='hour'?rate:(unit==='day'&&hours>0?
   Math.round(rate/hours):unit==='month'&&hours>0?Math.round(rate/hours):null);
  return {monthly,hourly,status:monthly===null||hourly===null?'partial':'ready'};
 }
 const salary=cents(p.salary),monthlyHours=decimal(p.hours);
 const fgts=decimal(p.fgtsPct),employer=decimal(p.employerPct);
 const benefits=cents(p.benefits??0),extras=cents(p.extras??0);
 if(salary===null||salary<=0)return {monthly:null,hourly:null,status:'pending'};
 // Alíquotas desconhecidas não viram zero por aproximação.
 if(fgts===null||employer===null||fgts<0||employer<0||fgts>100||employer>100)
  return {monthly:null,hourly:null,status:'partial'};
 const thirteenth=Math.round(salary/12);
 const vacationThird=Math.round(salary/36);
 const base=salary+thirteenth+vacationThird;
 const monthly=base+Math.round(base*fgts/100)+Math.round(base*employer/100)+
  (benefits||0)+(extras||0);
 return {monthly,hourly:monthlyHours>0?Math.round(monthly/monthlyHours):null,
  status:monthlyHours>0?'ready':'partial',
  breakdown:{salary,thirteenth,vacationThird,fgts:Math.round(base*fgts/100),
    employer:Math.round(base*employer/100),benefits:benefits||0,extras:extras||0}};
}
const sum=a=>a.reduce((t,x)=>t+(Number.isFinite(x)?x:0),0);
export function summary(data){
 const fx=(data.fixed||[]).map(fixedMonthly);
 const va=(data.variable||[]).map(variableMonthly);
 const ep=(data.employees||[]).filter(e=>e.active!==false).map(employeeCost);
 const fixed=sum(fx),variable=sum(va.map(x=>x??0)),team=sum(ep.map(x=>x.monthly??0));
 const missing=fx.filter(x=>x===null).length+va.filter(x=>x===null).length+
   ep.filter(x=>x.status!=='ready'||x.monthly===null).length;
 return {fixed,variable,team,total:fixed+variable+team,employees:ep.length,
  missing,complete:missing===0,
  knownItems:fx.length+va.filter(x=>x!==null).length+ep.filter(x=>x.monthly!==null).length};
}
export function validate(kind,fields){
 const name=String(fields.name||'').trim();
 if(!name)throw Error('Informe a descrição ou o nome.');
 const pick=x=>{const n=decimal(x);return n===null?null:n};
 const requireAmount=(v,label)=>{const n=pick(v);if(n===null||n<0)throw Error('Informe '+label+' válido.');return n};
 if(kind==='fixed'){
  return {name,category:String(fields.category||'').trim(),amount:requireAmount(fields.amount,'o valor'),
   frequency:fields.frequency==='annual'?'annual':'monthly'};
 }
 if(kind==='variable'){
  const unitCost=requireAmount(fields.unitCost,'o custo unitário');
  const monthQty=pick(fields.monthQty);
  if(monthQty!==null&&monthQty<0)throw Error('A quantidade não pode ser negativa.');
  return {name,category:String(fields.category||'').trim(),unit:String(fields.unit||'un'),
    unitCost,monthQty};
 }
 if(kind==='employees'){
  const role=String(fields.role||'').trim(),contractType=fields.contractType==='contractor'?'contractor':'clt';
  if(!role)throw Error('Informe a função do profissional.');
  const active=fields.active!=='false';
  if(contractType==='contractor'){
   const rate=requireAmount(fields.rate,'o valor contratado');
   if(rate<=0)throw Error('O valor contratado deve ser maior que zero.');
   const quantity=pick(fields.quantity),hours=pick(fields.hours);
   if(quantity!==null&&quantity<0||hours!==null&&hours<=0)
    throw Error('Quantidades e horas devem ser positivas.');
   return {name,role,contractType,active,rate,quantity,hours,
    rateUnit:['hour','day','month'].includes(fields.rateUnit)?fields.rateUnit:'hour'};
  }
  const salary=requireAmount(fields.salary,'o salário-base');
  if(salary<=0)throw Error('O salário deve ser maior que zero.');
  const hours=pick(fields.hours),fgtsPct=pick(fields.fgtsPct),employerPct=pick(fields.employerPct);
  if(hours!==null&&hours<=0)throw Error('Horas produtivas devem ser maiores que zero.');
  for(const pct of [fgtsPct,employerPct])
   if(pct!==null&&(pct<0||pct>100))throw Error('Os encargos precisam estar entre 0% e 100%.');
  const benefits=pick(fields.benefits)??0,extras=pick(fields.extras)??0;
  if(benefits<0||extras<0)throw Error('Benefícios e outros custos não podem ser negativos.');
  return {name,role,contractType,active,salary,hours,fgtsPct,employerPct,benefits,extras};
 }
 throw Error('Cadastro inválido.');
}
export function safeLoad(storage,userId){
 if(!userId)return fresh();
 try{
  const raw=JSON.parse(storage.getItem(STORE_PREFIX+userId)||'null');
  if(!raw||raw.version!==1)return fresh();
  return {...fresh(),...raw,
   fixed:Array.isArray(raw.fixed)?raw.fixed:[],
   variable:Array.isArray(raw.variable)?raw.variable:[],
   employees:Array.isArray(raw.employees)?raw.employees:[]};
 }catch{return fresh();}
}
export function safeSave(storage,userId,state){
 if(!userId)throw Error('Entre na sua conta antes de salvar.');
 const next={...state,updatedAt:new Date().toISOString(),version:1};
 storage.setItem(STORE_PREFIX+userId,JSON.stringify(next));
 return next;
}
