// Catalogo sem servicos precadastrados: somente importacoes SIURB/SINAPI do usuario.
import {decimal} from './calc.mjs';
export const CATALOG_PRESETS=Object.freeze([]);
export const CATALOG_SECTIONS=Object.freeze([]);
export const catalogRows=records=>Array.isArray(records)?records.filter(x=>x&&x.code):[];
export const catalogByCode=(records,code)=>catalogRows(records).find(x=>x.code===code)||null;
export function catalogHours(record){
 const roles=record?.roles;
 if(!Array.isArray(roles)||!roles.length)return null;
 let hours=0;
 for(const row of roles){
  const n=decimal(row?.hours);
  if(!String(row?.role||'').trim()||n===null||n<=0||n>10000)return null;
  hours+=n;
 }
 return Math.round(hours*1e5)/1e5;
}
// Para proposta exclusivamente de mão de obra, só HH por unidade é exigido.
// Custos diretos antigos permanecem preservados para orçamentos históricos.
export const catalogReady=item=>catalogHours(item)!==null;
export function catalogStats(records){
 const entries=catalogRows(records);
 return {total:entries.length,ready:entries.filter(catalogReady).length,
  pending:entries.filter(x=>!catalogReady(x)).length};
}
export function validateCatalogRecord(fields,template,oldId){
 if(!template?.code)throw Error('Selecione um servico importado.');
 const source=['sinapi','siurb','internal'].includes(fields.source)?fields.source:template.source;
 const description=String(fields.description??template.description).trim();
 const unit=String(fields.unit??template.unit).trim();
 if(!description||description.length>180)throw Error('Descricao do servico invalida.');
 if(!unit||unit.length>20)throw Error('Unidade de medida invalida.');
 const roles=[];
 if(fields.coefficients!==undefined){
  for(const line of String(fields.coefficients).split(/\r?\n/)){
   if(!line.trim())continue;
   const cut=line.lastIndexOf(';');
   if(cut<1)throw Error('Use Funcao; HH por unidade em cada linha.');
   const role=line.slice(0,cut).trim();
   const hours=decimal(line.slice(cut+1).trim());
   if(!role||role.length>80||hours===null||hours<=0||hours>10000)
    throw Error('Coeficiente HH/un invalido. Informe Funcao; 0,25.');
   if(roles.length>=30)throw Error('Limite de 30 funcoes por composicao.');
   roles.push({role,hours});
  }
 }else{
  for(let i=1;i<=3;i++){
   const role=String(fields['role'+i]??'').trim(),hours=decimal(fields['hours'+i]);
   if(role||hours!==null){
    if(!role||hours===null||hours<=0||hours>10000)throw Error('Coeficiente HH/un invalido.');
    roles.push({role,hours});
   }
  }
 }
 const cost=decimal(fields.directCost);
 if(cost!==null&&(cost<0||cost>999999999||Math.abs(cost*100-Math.round(cost*100))>1e-6))
  throw Error('Custo direto invalido: informe reais com ate dois decimais.');
 const officialCode=String(fields.sinapiCode??template.sinapiCode??'').trim();
 const month=String(fields.referenceMonth??template.referenceMonth??'').trim();
 if(officialCode.length>48||month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
  throw Error('Codigo ou competencia de referencia invalidos.');
 return {id:oldId||template.id||null,code:template.code,category:template.category,
  description,unit,source,roles,directCost:cost,
  sinapiCode:officialCode,referenceMonth:month};
}
export function catalogToBudgetItem(record,id){
 if(!record||!id)throw Error('Servico do catalogo invalido.');
 const system=record.source==='siurb'?'SIURB':record.source==='sinapi'?'SINAPI':'INTERNO';
 return {id,source:'internal',sourceCode:record.code,description:record.description,
  unit:record.unit,quantity:1,laborHours:catalogHours(record)??'',
  directCost:record.directCost??null,
  roles:(record.roles||[]).map(r=>({...r})),
  reference:{system,code:record.sinapiCode||'',month:record.referenceMonth||'',
   validation:system==='INTERNO'?'Referencia interna CIVOLTEN':
    'Referencia tecnica importada; produtividade e custos precisam de revisao pela empresa'}};
}
