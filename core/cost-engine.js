/* CIVOLTEN | Base V1: custos da empresa e equipe.
 * Os dados da versão antiga nunca são alterados. Cálculos monetários em centavos.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CIVOLTENCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const STORAGE_KEY='civolten_core_v1';
 function decimal(value){
  if(value===undefined||value===null||String(value).trim()==='')return null;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  let raw=String(value).trim().replace(/\s/g,'').replace(/^R\$/i,'');
  if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.');
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
 }
 function cents(value){
  const n=decimal(value);
  return n===null?null:Math.round((n+Number.EPSILON)*100);
 }
 const amount=value=>{const c=cents(value);return c===null?null:c/100};
 const positive=v=>decimal(v)!==null&&decimal(v)>0;
 const percent=v=>{const n=decimal(v);return n!==null&&n>=0&&n<=100?n:null};
 const add=(...values)=>values.reduce((sum,x)=>sum+(Number.isInteger(x)?x:0),0);
 const defaultData=()=>({schema:1,fixed:[],variable:[],employees:[],
  settings:{productiveHoursMonth:null},updatedAt:null});
 function normalizeData(raw){
  const data=defaultData();
  if(!raw||typeof raw!=='object')return data;
  for(const key of ['fixed','variable','employees']){
   if(Array.isArray(raw[key]))data[key]=raw[key].filter(v=>v&&typeof v==='object'&&typeof v.id==='string');
  }
  if(raw.settings&&typeof raw.settings==='object')
   data.settings.productiveHoursMonth=positive(raw.settings.productiveHoursMonth)?
    decimal(raw.settings.productiveHoursMonth):null;
  if(typeof raw.updatedAt==='string')data.updatedAt=raw.updatedAt;
  return data;
 }
 function fixedCost(item){
  const price=cents(item.amount);
  if(price===null||price<0)return {monthly:null,status:'pending'};
  const frequency=item.frequency==='year'?'year':'month';
  const monthly=frequency==='year'?Math.round(price/12):price;
  return {monthly,amount:price,frequency,status:'ready'};
 }
 function variableCost(item){
  const price=cents(item.rate),qty=decimal(item.monthlyQty);
  if(price===null||price<0)return {rate:null,monthly:null,status:'pending'};
  if(qty===null||qty<0)return {rate:price,monthly:null,status:'no-forecast'};
  return {rate:price,monthly:Math.round(price*qty),qty,status:'ready'};
 }
 function employeeCost(person){
  const type=person.type==='contractor'?'contractor':'clt';
  if(type==='contractor'){
   const rate=cents(person.rate),unit=['hour','day','month'].includes(person.rateUnit)?person.rateUnit:'hour';
   const qty=decimal(person.monthlyQty);
   const hoursDay=decimal(person.hoursDay),hoursMonth=decimal(person.hoursMonth);
   const validRate=rate!==null&&rate>=0;
   const hourly=validRate?(unit==='hour'?rate:
    unit==='day'&&hoursDay>0?Math.round(rate/hoursDay):
    unit==='month'&&hoursMonth>0?Math.round(rate/hoursMonth):null):null;
   const monthly=validRate?(unit==='month'?rate:qty!==null&&qty>=0?Math.round(rate*qty):null):null;
   return {type,rate,unit,hourly,monthly,
    status:!validRate?'pending':hourly===null?'partial':'ready',
    monthlyStatus:monthly===null?'no-forecast':'ready',parts:{contractor:monthly}};
  }
  const salary=cents(person.salary),hours=decimal(person.productiveHours),
   fgts=percent(person.fgtsPct),employer=percent(person.employerPct);
  if(salary===null||salary<=0)return {type,status:'pending',monthly:null,hourly:null,parts:{}};
  const thirteenth=Math.round(salary/12);
  const vacationThird=Math.round(salary/36);
  const basis=add(salary,thirteenth,vacationThird);
  const fgtsAmount=fgts===null?null:Math.round(basis*fgts/100);
  const employerAmount=employer===null?null:Math.round(basis*employer/100);
  const benefits=cents(person.benefits)||0,extra=cents(person.extras)||0;
  const monthly=add(basis,fgtsAmount,employerAmount,benefits,extra);
  return {type,monthly,hourly:hours>0?Math.round(monthly/hours):null,
   status:hours>0&&fgts!==null&&employer!==null?'ready':'partial',
   missing:[...(hours>0?[]:['horas produtivas']),
    ...(fgts===null?['FGTS']:[]),...(employer===null?['encargos patronais']:[])],
   parts:{salary,thirteenth,vacationThird,fgts:fgtsAmount,employer:employerAmount,benefits,extra},
   note:'Provisão gerencial; verificar regime, CCT, adicionais e encargos aplicáveis.'};
 }
 function overview(state){
  const d=normalizeData(state);
  const fixed=d.fixed.map(fixedCost),variable=d.variable.map(variableCost),employees=d.employees.map(employeeCost);
  const fixedMonthly=add(...fixed.map(x=>x.monthly));
  const variableMonthly=add(...variable.map(x=>x.monthly));
  const employeeMonthly=add(...employees.map(x=>x.monthly));
  const capacity=decimal(d.settings.productiveHoursMonth);
  return {
   fixedMonthly,variableMonthly,employeeMonthly,
   forecastMonthly:add(fixedMonthly,variableMonthly,employeeMonthly),
   fixedHour:capacity>0?Math.round(fixedMonthly/capacity):null,
   capacity:capacity>0?capacity:null,
   fixedMissing:fixed.filter(x=>x.status==='pending').length,
   variableMissing:variable.filter(x=>x.monthly===null).length,
   employeeMissing:employees.filter(x=>x.status!=='ready'||x.monthly===null).length,
   counts:{fixed:d.fixed.length,variable:d.variable.length,employees:d.employees.length},
   completeness:fixed.every(x=>x.status==='ready')&&
    variable.every(x=>x.monthly!==null)&&employees.every(x=>x.status==='ready'&&x.monthly!==null)
  };
 }
 function itemInput(kind,input,id){
  const trimmed=v=>String(v??'').trim();
  const name=trimmed(input.name);
  if(!name)throw new Error('Informe a descrição.');
  if(kind==='fixed'){
   const value=amount(input.amount);
   if(value===null||value<0)throw new Error('Informe o valor do custo fixo.');
   return {id,name,category:trimmed(input.category),amount:value,
    frequency:input.frequency==='year'?'year':'month'};
  }
  if(kind==='variable'){
   const rate=amount(input.rate),qty=decimal(input.monthlyQty);
   if(rate===null||rate<0)throw new Error('Informe o valor unitário do custo variável.');
   if(qty!==null&&qty<0)throw new Error('Quantidade prevista deve ser positiva.');
   return {id,name,rate,unit:['service','day','km','hour','unit'].includes(input.unit)?input.unit:'unit',
    monthlyQty:qty};
  }
  if(kind==='employees'){
   const type=input.type==='contractor'?'contractor':'clt',role=trimmed(input.role);
   if(type==='clt'){
    const salary=amount(input.salary);
    if(salary===null||salary<=0)throw new Error('Informe o salário-base mensal.');
    const hours=decimal(input.productiveHours),fgts=percent(input.fgtsPct),employer=percent(input.employerPct);
    if(decimal(input.productiveHours)!==null&&hours<=0)throw new Error('Horas produtivas devem ser maiores que zero.');
    if(trimmed(input.fgtsPct)&&fgts===null||trimmed(input.employerPct)&&employer===null)
     throw new Error('Informe percentuais entre 0 e 100.');
    for(const key of ['benefits','extras']){
     const value=amount(input[key]);
     if(value!==null&&value<0)throw new Error('Custos adicionais não podem ser negativos.');
    }
    return {id,name,role,type,salary,productiveHours:hours,fgtsPct:fgts,employerPct:employer,
     benefits:amount(input.benefits)||0,extras:amount(input.extras)||0};
   }
   const rate=amount(input.rate),qty=decimal(input.monthlyQty);
   if(rate===null||rate<=0)throw new Error('Informe um valor de contrato maior que zero.');
   if(qty!==null&&qty<0)throw new Error('Quantidade mensal deve ser positiva.');
   for(const k of ['hoursDay','hoursMonth']){
    const value=decimal(input[k]);
    if(value!==null&&value<=0)throw new Error('Horas previstas devem ser maiores que zero.');
   }
   return {id,name,role,type,rate,rateUnit:['hour','day','month'].includes(input.rateUnit)?input.rateUnit:'hour',
    monthlyQty:qty,hoursDay:decimal(input.hoursDay),hoursMonth:decimal(input.hoursMonth)};
  }
  throw new Error('Tipo de cadastro inválido.');
 }
 function createStore(storage,key=STORAGE_KEY){
  function load(){
   try {return normalizeData(JSON.parse(storage.getItem(key)||'null'))}
   catch {return defaultData()}
  }
  function commit(data){
   const next=normalizeData(data);next.updatedAt=new Date().toISOString();
   storage.setItem(key,JSON.stringify(next));return next;
  }
  return {load,commit,key};
 }
 return {STORAGE_KEY,defaultData,normalizeData,decimal,cents,amount,fixedCost,variableCost,
  employeeCost,overview,itemInput,createStore};
});
