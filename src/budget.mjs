// CIVOLTEN · MVP de orçamentos demonstrativos.
// Catálogo inventado exclusivamente para homologação; nenhuma referência SINAPI/SIURB.
// Custos e alíquotas guardados como fotografia no rascunho: não mudam silenciosamente.
import {summary,decimal,cents} from './calc.mjs';
import {companyConfig,capacity,quoteFromCost} from './pricing.mjs';
import {validDate,localToday} from './finance.mjs';

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
  sourceCode:sample?.code||'',description:sample?.description||'Serviço personalizado (teste)',
  unit:sample?.unit||'un',quantity:1,laborHours:sample?.laborHours??1,
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
 const directCost=moneyCheck(row.directCost,'Custo direto');
 const unit=safeText(row.unit,20,'Unidade');
 if(!unit)throw Error('Informe a unidade do serviço.');
 const source=row.source==='demo'?'demo':'manual';
 const sourceCode=source==='demo'?
  safeText(row.sourceCode,48,'Código do serviço'):'';
 if(source==='demo'&&!DEMO_SERVICES.some(s=>s.code===sourceCode))
  throw Error('Código fictício de serviço inválido.');
 const id=safeText(row.id,64,'Identificador do item');
 if(!id)throw Error('Identificador do item ausente.');
 return {id,source,sourceCode,description,unit,quantity,laborHours,directCost};
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
 const snapshot=raw.pricing==null?null:validateBudgetSnapshot(raw.pricing);
 return {id:raw.id,title,customer,project,location,notes,expiresOn:expiresOn||null,
  items,pricing:snapshot,status:'draft',demo:true,createdAt:raw.createdAt||null};
}
export function createPricingSnapshot(data){
 const cost=summary(data),cfg=companyConfig(data.company),cap=capacity(cfg);
 if(!cfg.reviewed||!cost.complete||!cap||!Number.isSafeInteger(cost.total)||cost.total<=0)return null;
 return {monthlyCostCents:cost.total,productiveHours:cap.productiveHours,
  taxPct:cfg.taxPct,marginPct:cfg.marginPct,companyName:cfg.companyName||'CIVOLTEN',
  capturedOn:localToday()};
}
export function validateBudgetSnapshot(raw){
 const cost=Number(raw.monthlyCostCents),hours=Number(raw.productiveHours),
  tax=Number(raw.taxPct),margin=Number(raw.marginPct);
 if(!Number.isSafeInteger(cost)||cost<=0||!Number.isFinite(hours)||hours<=0||
  !Number.isFinite(tax)||tax<0||tax>80||!Number.isFinite(margin)||margin<0||margin>80||
  tax+margin>=100)throw Error('Base da precificação inválida.');
 return {monthlyCostCents:cost,productiveHours:hours,taxPct:tax,marginPct:margin,
  companyName:safeText(raw.companyName,160,'Nome da empresa'),
  capturedOn:validDate(raw.capturedOn)?raw.capturedOn:localToday()};
}
export function priceBudget(raw){
 const snapshot=raw?.pricing;
 if(!snapshot)return null;
 const p=validateBudgetSnapshot(snapshot);
 if(!Array.isArray(raw.items)||!raw.items.length)return null;
 const config={reviewed:true,taxPct:p.taxPct,marginPct:p.marginPct};
 let totalCost=0,totalSale=0,totalHours=0,totalTax=0;
 const rows=raw.items.map(item=>{
  const r=validateBudgetItem(item),hours=r.laborHours*r.quantity;
  const labor=Math.ceil(p.monthlyCostCents*hours/p.productiveHours);
  const materials=Math.round(cents(r.directCost)*r.quantity);
  const cost=materials+labor;
  if(!Number.isSafeInteger(cost)||cost<0)throw Error('Valor do orçamento excede o limite.');
  const price=quoteFromCost(cost,config);
  if(!price)throw Error('Imposto e margem inválidos.');
  totalCost+=cost;totalSale+=price.selling;totalHours+=hours;totalTax+=price.taxes;
  return {...r,hours,labor,materials,cost,selling:price.selling,
   tax:price.taxes,unitSelling:price.selling/r.quantity};
 });
 if(!Number.isSafeInteger(totalCost)||!Number.isSafeInteger(totalSale)||
   totalSale>99999999999999)throw Error('Valor final excedeu o limite.');
 return {rows,totalCost,totalSale,totalTax,totalHours,
  profit:totalSale-totalCost-totalTax,snapshot:p,quantity:rows.length};
}
const csvSafe=v=>{
 let text=String(v??'');
 if(/^\s*[=+\-@\t\r]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
};
export function budgetCsv(budget){
 const p=priceBudget(budget);
 if(!p)throw Error('Configure a empresa e calcule os preços antes de exportar.');
 const cells=[
 ['Orçamento demonstrativo',budget.title],['Cliente',budget.customer],
 ['Obra',budget.project],['Local',budget.location],['Validade',budget.expiresOn||''],
 ['Base de custo',p.snapshot.capturedOn],['Total do orçamento (R$)',(p.totalSale/100).toFixed(2)],
 [],
 ['Código demonstração','Serviço','Unidade','Quantidade','Horas/un','Custo direto/un (R$)',
  'Valor de venda total (R$)']
 ];
 for(const item of p.rows)cells.push([item.sourceCode||'MANUAL',item.description,item.unit,
  item.quantity,item.laborHours,item.directCost,(item.selling/100).toFixed(2)]);
 return '\uFEFF'+cells.map(row=>row.map(csvSafe).join(';')).join('\r\n');
}
