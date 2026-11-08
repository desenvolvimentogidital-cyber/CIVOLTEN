// CIVOLTEN · preços gerenciais. Tributos percentuais sobre o PREÇO DE VENDA.
// Taxa informada manualmente (ex.: alíquota efetiva Simples Nacional, não nominal).
// Margem de lucro é percentual da receita, NÃO markup sobre custo.
export const THEMES=Object.freeze(['gold','blue','emerald','violet','coral']);
export const TAX_REGIMES=Object.freeze(['simples','mei','presumido','real','outro']);
export const ANNEXES=Object.freeze(['nao_definido','I','II','III','IV','V']);
export const DEFAULT_COMPANY=Object.freeze({
 companyName:'',taxRegime:'simples',annex:'nao_definido',
 taxPct:0,marginPct:0,productiveDays:22,hoursPerDay:8,productivePeople:0,
 theme:'gold',reviewed:false
});
const parse=n=>{
 if(n==null||String(n).trim()==='')return null;
 const v=typeof n==='number'?n:Number(String(n).trim().replace(',','.'));
 return Number.isFinite(v)?v:null;
};
export function companyConfig(raw){
 const data={...DEFAULT_COMPANY,...raw};
 const cfg={...data};
 cfg.companyName=typeof data.companyName==='string'?data.companyName.slice(0,160):'';
 cfg.taxRegime=TAX_REGIMES.includes(data.taxRegime)?data.taxRegime:'simples';
 cfg.annex=ANNEXES.includes(data.annex)?data.annex:'nao_definido';
 cfg.theme=THEMES.includes(data.theme)?data.theme:'gold';
 for(const [key,fallback] of [['taxPct',0],['marginPct',0],['productiveDays',22],['hoursPerDay',8],['productivePeople',0]]){
  cfg[key]=parse(data[key])??fallback;
 }
 cfg.reviewed=data.reviewed===true;
 return cfg;
}
export function validateCompany(fields,current=DEFAULT_COMPANY){
 const base=companyConfig(current);
 const name=String(fields.companyName??'').trim();
 if(name.length>160)throw Error('Nome da empresa deve ter até 160 caracteres.');
 const taxRegime=String(fields.taxRegime??'');
 const annex=String(fields.annex??'');
 if(!TAX_REGIMES.includes(taxRegime))throw Error('Informe o regime tributário.');
 if(!ANNEXES.includes(annex))throw Error('Informe o anexo do Simples ou não definido.');
 const pct=key=>{
  if(fields[key]==null||String(fields[key]).trim()==='')throw Error('Informe imposto e margem de lucro.');
  const n=parse(fields[key]);
  if(n===null||n<0||n>80||Math.round(n*100)!==n*100&&Math.abs(Math.round(n*100)-n*100)>1e-7)
   throw Error('Imposto e margem devem estar entre 0% e 80%, com no máximo 2 decimais.');
  return Math.round(n*100)/100;
 };
 const taxPct=pct('taxPct'),marginPct=pct('marginPct');
 if(taxPct+marginPct>=100)throw Error('Imposto mais margem deve ser inferior a 100%.');
 const days=parse(fields.productiveDays),hours=parse(fields.hoursPerDay),people=parse(fields.productivePeople);
 if(!Number.isInteger(days)||days<1||days>31)
  throw Error('Dias produtivos por mês devem estar entre 1 e 31.');
 if(hours===null||hours<=0||hours>24)
  throw Error('Horas produtivas por dia devem estar entre 0 e 24.');
 if(!Number.isInteger(people)||people<1||people>1000)
  throw Error('Informe entre 1 e 1000 profissionais produtivos.');
 const theme=THEMES.includes(fields.theme)?fields.theme:base.theme;
 return {companyName:name,taxRegime,annex,taxPct,marginPct,
  productiveDays:days,hoursPerDay:Math.round(hours*100)/100,
  productivePeople:people,theme,reviewed:true};
}
export function capacity(cfgRaw){
 const c=companyConfig(cfgRaw);
 const days=c.productiveDays,people=c.productivePeople,hours=c.hoursPerDay;
 if(!Number.isInteger(days)||days<=0||days>31||
  !Number.isInteger(people)||people<=0||people>1000||
  !Number.isFinite(hours)||hours<=0||hours>24)return null;
 return {companyDays:days,personDays:days*people,productiveHours:days*people*hours};
}
export function laborRates(monthlyCents,cfgRaw){
 const cfg=companyConfig(cfgRaw);
 const cap=capacity(cfg);
 if(!cfg.reviewed||!cap||!Number.isSafeInteger(monthlyCents)||monthlyCents<0)return null;
 return {monthly:monthlyCents,companyDay:Math.ceil(monthlyCents/cap.companyDays),
  personDay:Math.ceil(monthlyCents/cap.personDays),
  personHour:Math.ceil(monthlyCents/cap.productiveHours),...cap};
}
export function quoteFromCost(costCents,cfgRaw){
 const cfg=companyConfig(cfgRaw);
 if(!cfg.reviewed||!Number.isSafeInteger(costCents)||costCents<0)return null;
 const fraction=(100-cfg.taxPct-cfg.marginPct)/100;
 if(!Number.isFinite(fraction)||fraction<=0)return null;
 const selling=Math.ceil(costCents/fraction);
 const taxes=Math.round(selling*cfg.taxPct/100);
 const grossProfit=selling-costCents-taxes;
 return {cost:costCents,selling,taxes,grossProfit,
  effectiveMargin:selling?grossProfit/selling*100:0,taxPct:cfg.taxPct,marginPct:cfg.marginPct};
}
export function quoteForHours(monthlyCents,cfgRaw,hours,extraCents=0){
 const rate=laborRates(monthlyCents,cfgRaw);
 const h=parse(hours);
 if(!rate||h===null||h<=0||h>100000||
  !Number.isSafeInteger(extraCents)||extraCents<0||extraCents>999999999999)return null;
 const labor=Math.ceil(monthlyCents*h/rate.productiveHours);
 if(!Number.isSafeInteger(labor+extraCents))return null;
 const price=quoteFromCost(labor+extraCents,cfgRaw);
 return price?{...price,labor,extra:extraCents,hours:h}:null;
}
