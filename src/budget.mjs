// CIVOLTEN · orçamentos com referências internas de produtividade.
// Serviços fictícios são mantidos APENAS para leitura dos orçamentos antigos.
// Custos e alíquotas guardados como fotografia no rascunho: não mudam silenciosamente.
import {summary,decimal,cents} from './calc.mjs';
import {companyConfig,capacity,quoteFromCost} from './pricing.mjs';
import {validDate,localToday} from './finance.mjs';
import {validateSchedule,schedulePlan} from './budget-schedule.mjs';
import {catalogHours} from './service-catalog.mjs';

// Compatibilidade histórica: nunca incluir na seleção de novos orçamentos.
export const DEMO_SERVICES=Object.freeze([
 {code:'DEMO-E01',description:'Instalação de ponto elétrico residencial (exemplo)',unit:'un',laborHours:2.5,directCost:35},
 {code:'DEMO-E02',description:'Instalação de luminária LED (exemplo)',unit:'un',laborHours:1.5,directCost:20},
 {code:'DEMO-E03',description:'Passagem de cabo elétrico em eletroduto (exemplo)',unit:'m',laborHours:0.25,directCost:7},
 {code:'DEMO-E04',description:'Montagem de quadro de distribuição pequeno (exemplo)',unit:'un',laborHours:8,directCost:320},
 {code:'DEMO-C01',description:'Assentamento de revestimento cerâmico (exemplo)',unit:'m²',laborHours:1.6,directCost:45},
 {code:'DEMO-C02',description:'Pintura de parede interna (exemplo)',unit:'m²',laborHours:0.45,directCost:12},
 {code:'DEMO-C03',description:'Execução de alvenaria de vedação (exemplo)',unit:'m²',laborHours:2.8,directCost:65},
 {code:'DEMO-C04',description:'Instalação de tomada e espelho (exemplo)',unit:'un',laborHours:0.8,directCost:18}
]);
const safeText=(v,max,label)=>{
 const s=String(v??'').trim();
 if(s.length>max)throw Error(label+' muito longo.');
 return s;
};
const positive=(v,label,{allowZero=false,max=1000000}={})=>{
 const n=decimal(v);
 if(n===null||!Number.isFinite(n)||(allowZero?n<0:n<=0)||n>max)
  throw Error('Informe '+label+' válido.');
 return n;
};
const moneyCheck=(v,label)=>{
 const n=positive(v,label,{allowZero:true,max:999999999});
 if(Math.abs(n*100-Math.round(n*100))>1e-6)
  throw Error(label+' deve ter no máximo duas casas decimais.');
 return n;
};
export function createService(code,uuid){
 const sample=DEMO_SERVICES.find(x=>x.code===code);
 if(code!=='manual'&&!sample)throw Error('Serviço de demonstração não encontrado.');
 if(typeof uuid!=='string'||!uuid)throw Error('Identificador do item ausente.');
 return {id:uuid,source:sample?'demo':'manual',
  sourceCode:sample?.code||'',description:sample?.description||'Serviço personalizado',
  unit:sample?.unit||'un',quantity:1,laborHours:sample?.laborHours??0,
  directCost:sample?.directCost??0};
}
export function validateBudgetItem(row){
 const description=safeText(row.description,180,'Descrição do serviço');
 if(!description)throw Error('Informe a descrição de todos os serviços.');
 const quantity=positive(row.quantity,'quantidade',{max:100000});
 if(Math.abs(quantity*1000-Math.round(quantity*1000))>1e-6)
  throw Error('Quantidade deve ter até três casas decimais.');
 const laborHours=positive(row.laborHours,'horas de trabalho',{allowZero:true,max:10000});
 if(Math.abs(laborHours*1000-Math.round(laborHours*1000))>1e-6)
  throw Error('Horas devem ter até três casas decimais.');
 // Apenas materiais/equipamentos adicionais; mao de obra vem automaticamente dos custos mensais.
 const directCost=moneyCheck(row.directCost==null||String(row.directCost).trim()===''?0:row.directCost,'Custo direto');
 const unit=safeText(row.unit,20,'Unidade');
 if(!unit)throw Error('Informe a unidade do serviço.');
 const source=row.source==='demo'?'demo':row.source==='internal'?'internal':'manual';
 const sourceCode=source==='demo'||source==='internal'?
  safeText(row.sourceCode,48,'Código do serviço'):'';
 if(source==='internal'&&!(/^(CV-\d\d-\d{3}|(?:SIURB|SINAPI):.{1,41})$/.test(sourceCode)))
  throw Error('Código interno do serviço inválido.');
 if(source==='demo'&&!DEMO_SERVICES.some(s=>s.code===sourceCode))
  throw Error('Código fictício de serviço inválido.');
 const id=safeText(row.id,64,'Identificador do item');
 if(!id)throw Error('Identificador do item ausente.');
 const roles=source==='internal'&&Array.isArray(row.roles)?
  row.roles.slice(0,30).map(r=>({role:safeText(r.role,80,'Profissional'),
   hours:positive(r.hours,'coeficiente HH por unidade',{max:10000})})):[];
 const reference=source==='internal'&&row.reference&&typeof row.reference==='object'?{
  system:['SINAPI','SIURB'].includes(row.reference.system)?row.reference.system:'INTERNO',
  code:safeText(row.reference.code||'',48,'Código de referência'),
  month:safeText(row.reference.month||'',7,'Competência'),
  validation:safeText(row.reference.validation||'',180,'Proveniência')}:null;
 const hhMin=source==='internal'&&row.hhMin!=null?positive(row.hhMin,'HH mínimo por unidade',{max:10000}):null;
 const hhMax=source==='internal'&&row.hhMax!=null?positive(row.hhMax,'HH máximo por unidade',{max:10000}):null;
 if(hhMin!==null&&hhMax!==null&&hhMin>hhMax)throw Error('Faixa de produtividade inválida.');
 const crewComposition=source==='internal'?safeText(row.crewComposition||'',180,'Equipe estimada'):'';
 return {id,source,sourceCode,description,unit,quantity,laborHours,directCost,
  ...(source==='internal'?{roles,reference,crewComposition,hhMin,hhMax}:{} )};
}
export function validateCommercial(raw={}){
 // Campos opcionais; nenhum prazo, pagamento ou garantia é presumido.
 const c=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {
  paymentTerms:safeText(c.paymentTerms,500,'Condições de pagamento'),
  executionTerm:safeText(c.executionTerm,260,'Prazo de execução'),
  warrantyTerms:safeText(c.warrantyTerms,360,'Garantia dos serviços'),
  scopeNotes:safeText(c.scopeNotes,900,'Escopo e exclusões'),
  companyContact:safeText(c.companyContact,200,'Contato da empresa'),
  companyDocument:safeText(c.companyDocument,40,'Documento da empresa'),
  schedule:validateSchedule(c.schedule)
 };
}
export function validateBudget(raw){
 const title=safeText(raw.title,180,'Título');
 const customer=safeText(raw.customer,180,'Cliente');
 if(!title)throw Error('Informe o título do orçamento.');
 if(!customer)throw Error('Informe o cliente do orçamento.');
 const project=safeText(raw.project,180,'Obra');
 const location=safeText(raw.location,240,'Local');
 const notes=safeText(raw.notes,1500,'Observações');
 const expiresOn=safeText(raw.expiresOn,10,'Validade');
 if(expiresOn&&!validDate(expiresOn))throw Error('Informe uma data de validade válida.');
 if(!Array.isArray(raw.items)||raw.items.length===0)
  throw Error('Adicione ao menos um serviço.');
 if(raw.items.length>100)throw Error('Máximo de 100 itens por orçamento.');
 const items=raw.items.map(validateBudgetItem);
 if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('Itens duplicados no orçamento.');
 if(raw.demo===false&&items.some(x=>x.source==='demo'))throw Error('Serviços fictícios não podem entrar no novo orçamento CIVOLTEN.');
 const snapshot=raw.pricing==null?null:validateBudgetSnapshot(raw.pricing);
 return {id:raw.id,title,customer,project,location,notes,expiresOn:expiresOn||null,
  items,commercial:validateCommercial(raw.commercial),pricing:snapshot,status:'draft',demo:raw.demo!==false,createdAt:raw.createdAt||null};
}
export function createPricingSnapshot(data){
 const cost=summary(data),cfg=companyConfig(data.company),cap=capacity(cfg);
 // Modelos de despesas vazios nao devem impedir usar os custos reais ja cadastrados.
 // Custos da equipe sem informacao suficiente continuam bloqueando o calculo.
 if(!cfg.reviewed||cost.workforceMissing>0||!cap||!Number.isSafeInteger(cost.total)||cost.total<=0)return null;
 return {monthlyCostCents:cost.total,productiveHours:cap.productiveHours,
  productiveDays:cfg.productiveDays,hoursPerDay:cfg.hoursPerDay,productivePeople:cfg.productivePeople,
  taxPct:cfg.taxPct,marginPct:cfg.marginPct,companyName:cfg.companyName||'CIVOLTEN',
  capturedOn:localToday()};
}
export function validateBudgetSnapshot(raw){
 const cost=Number(raw.monthlyCostCents),hours=Number(raw.productiveHours),
  tax=Number(raw.taxPct),margin=Number(raw.marginPct);
 if(!Number.isSafeInteger(cost)||cost<=0||!Number.isFinite(hours)||hours<=0||
  !Number.isFinite(tax)||tax<0||tax>80||!Number.isFinite(margin)||margin<0||margin>80||
  tax+margin>=100)throw Error('Base da precificação inválida.');
 const days=raw.productiveDays==null?null:Number(raw.productiveDays);
 const perDay=raw.hoursPerDay==null?null:Number(raw.hoursPerDay);
 const people=raw.productivePeople==null?null:Number(raw.productivePeople);
 if((days!==null&&(!Number.isInteger(days)||days<1||days>31))||
  (perDay!==null&&(!Number.isFinite(perDay)||perDay<=0||perDay>24))||
  (people!==null&&(!Number.isInteger(people)||people<1||people>1000)))
  throw Error('Capacidade da empresa no orçamento inválida.');
 return {monthlyCostCents:cost,productiveHours:hours,taxPct:tax,marginPct:margin,
  productiveDays:days,hoursPerDay:perDay,productivePeople:people,
  companyName:safeText(raw.companyName,160,'Nome da empresa'),
  capturedOn:validDate(raw.capturedOn)?raw.capturedOn:localToday()};
}
// Fonte unica de calculo para a linha completa: quantidade × HH/un × custo de HH.
// Arredonda apenas os totais em centavos, nao multiplica um preco unitario ja arredondado.
export function budgetQuantityEstimate(snapshot,hours,quantity,extraDirect=0){
 if(!snapshot)return null;
 const p=validateBudgetSnapshot(snapshot);
 const hh=decimal(hours),qty=decimal(quantity);
 const extra=extraDirect==null||String(extraDirect).trim()===''?0:decimal(extraDirect);
 if(hh===null||hh<=0||hh>10000||qty===null||qty<=0||qty>100000||
    extra===null||extra<0||extra>999999999||
    Math.abs(hh*1000-Math.round(hh*1000))>1e-6||
    Math.abs(qty*1000-Math.round(qty*1000))>1e-6||
    Math.abs(extra*100-Math.round(extra*100))>1e-6)return null;
 const totalHours=Math.round(hh*qty*1000000)/1000000;
 const labor=Math.ceil(p.monthlyCostCents*totalHours/p.productiveHours);
 const materials=Math.round(cents(extra)*qty);
 const cost=labor+materials;
 if(!Number.isSafeInteger(labor)||!Number.isSafeInteger(materials)||
    !Number.isSafeInteger(cost)||cost<0)return null;
 const quote=quoteFromCost(cost,{reviewed:true,taxPct:p.taxPct,marginPct:p.marginPct});
 if(!quote||!Number.isSafeInteger(quote.selling)||quote.selling>99999999999999)return null;
 return {monthly:p.monthlyCostCents,days:p.productiveDays||22,
  hoursDay:p.hoursPerDay||8,people:p.productivePeople||1,
  hourly:p.monthlyCostCents/p.productiveHours,
  quantity:qty,hours:hh,totalHours,labor,materials,...quote,
  perUnitSelling:quote.selling/qty,perUnitLabor:labor/qty};
}
// Compatibilidade com calculos unitarios ja existentes; a proposta sempre usa a quantidade completa.
export function budgetUnitEstimate(snapshot,hours,extraDirect=0){
 return budgetQuantityEstimate(snapshot,hours,1,extraDirect);
}
export function priceBudget(raw){
 const snapshot=raw?.pricing;
 if(!snapshot)return null;
 const p=validateBudgetSnapshot(snapshot);
 if(!Array.isArray(raw.items)||!raw.items.length)return null;
 if(raw.demo===false&&raw.items.some(item=>!Number.isFinite(Number(item.laborHours))||Number(item.laborHours)<=0))
  throw Error('Informe produtividade maior que zero em todos os serviços antes de calcular o preço profissional.');
 const config={reviewed:true,taxPct:p.taxPct,marginPct:p.marginPct};
 const settings=validateSchedule(raw.commercial?.schedule);
 if(settings.pricingMode==='days'){
  if(!p.productiveDays||!p.productivePeople||!p.hoursPerDay)
   throw Error('Atualize a base de preços para calcular pela duração da obra.');
  const plan=schedulePlan(raw.items,settings,{...p});
  if(!plan||!plan.totalHours||!plan.days)throw Error('Informe horas de trabalho para calcular o cronograma.');
  if(!plan.available)throw Error('Prazo exige '+plan.crew+' profissionais, mas a empresa tem '+
   plan.companyPeople+'. Ajuste o prazo ou a equipe antes de usar o preço por dias.');
  const rows=raw.items.map(item=>{
   const r=validateBudgetItem(item);
   return {...r,hours:r.laborHours*r.quantity,
    materials:Math.round(cents(r.directCost)*r.quantity)};
  });
  const totalMaterials=rows.reduce((sum,item)=>sum+item.materials,0);
  const totalLabor=Math.ceil(p.monthlyCostCents*plan.days/p.productiveDays);
  const totalCost=totalMaterials+totalLabor;
  if(!Number.isSafeInteger(totalCost)||totalCost<=0)throw Error('Custo do cronograma excede o limite.');
  const quote=quoteFromCost(totalCost,config);
  if(!quote||!Number.isSafeInteger(quote.selling)||quote.selling>99999999999999)
   throw Error('Preço da obra excede o limite.');
  let assignedLabor=0,assignedSale=0,assignedTax=0;
  const distributed=rows.map((row,index)=>{
   const last=index===rows.length-1;
   const labor=last?totalLabor-assignedLabor:
    Math.floor(totalLabor*row.hours/plan.totalHours);
   assignedLabor+=labor;
   const cost=row.materials+labor;
   const selling=last?quote.selling-assignedSale:
    Math.floor(quote.selling*cost/totalCost);
   assignedSale+=selling;
   const tax=last?quote.taxes-assignedTax:
    Math.floor(quote.taxes*selling/quote.selling);
   assignedTax+=tax;
   return {...row,labor,cost,selling,tax,unitSelling:selling/row.quantity};
  });
  return {rows:distributed,totalCost,totalSale:quote.selling,totalTax:quote.taxes,
   totalHours:plan.totalHours,profit:quote.grossProfit,snapshot:p,quantity:rows.length,
   pricingMode:'days',schedule:plan,totalLabor,totalMaterials};
 }
 let totalCost=0,totalSale=0,totalHours=0,totalTax=0;
 const rows=raw.items.map(item=>{
  const r=validateBudgetItem(item);
  const price=budgetQuantityEstimate(p,r.laborHours,r.quantity,r.directCost);
  if(!price)throw Error('Não foi possível calcular o total deste serviço; confira HH, quantidade e custos.');
  const hours=price.totalHours,labor=price.labor,materials=price.materials,cost=price.cost;
  totalCost+=cost;totalSale+=price.selling;totalHours+=hours;totalTax+=price.taxes;
  return {...r,hours,labor,materials,cost,selling:price.selling,
   tax:price.taxes,unitSelling:price.perUnitSelling};
 });
 if(!Number.isSafeInteger(totalCost)||!Number.isSafeInteger(totalSale)||
   totalSale>99999999999999)throw Error('Valor final excedeu o limite.');
 return {rows,totalCost,totalSale,totalTax,totalHours,
  profit:totalSale-totalCost-totalTax,snapshot:p,quantity:rows.length,pricingMode:'hours'};
}
const csvSafe=v=>{
 let text=String(v??'');
 if(/^\s*[=+\-@\t\r]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
};
export function budgetCsv(budget){
 if(budget?.demo!==false||budget?.items?.some(item=>item.source==='demo'))
  throw Error('Revise os servicos e os custos do orcamento anterior antes de exportar.');
 const p=priceBudget(budget);
 if(!p)throw Error('Configure a empresa e calcule os preços antes de exportar.');
 const cells=[
 [ 'Orçamento CIVOLTEN',budget.title],['Cliente',budget.customer],
 ['Obra',budget.project],['Local',budget.location],['Validade',budget.expiresOn||''],
 ['Base de custo',p.snapshot.capturedOn],
 ['Modalidade do preço',p.pricingMode==='days'?'Por dias úteis de execução':'Por horas-homem'],
 ['Dias úteis estimados',p.schedule?.days??''],['Profissionais estimados',p.schedule?.crew??''],
 ['Total do orçamento (R$)',(p.totalSale/100).toFixed(2)],
 [],
 ['Código de serviço','Serviço','Unidade','Quantidade','Horas-homem/un','Horas-homem totais',
  'Materiais/equipamentos adicionais por unidade (R$)',
  'Mão de obra total (R$)','Materiais/equipamentos totais (R$)','Custo total (R$)',
  'Preço médio por unidade (R$; 4 casas)','Valor de venda total (R$)']
 ];
 for(const item of p.rows)cells.push([item.sourceCode||'MANUAL',item.description,item.unit,
  item.quantity,item.laborHours,item.hours,item.directCost,
  (item.labor/100).toFixed(2),(item.materials/100).toFixed(2),
  (item.cost/100).toFixed(2),(item.unitSelling/100).toFixed(4),
  (item.selling/100).toFixed(2)]);
 return '\uFEFF'+cells.map(row=>row.map(csvSafe).join(';')).join('\r\n');
}
