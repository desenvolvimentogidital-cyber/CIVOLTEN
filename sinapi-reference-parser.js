/* SINAPI Referência 2026 - interpretação do XLSX oficial.
   Fontes de dados: Analítico (coeficientes), CSD/CCD (custos SP) e ISD/ICD (insumos SP).
   Nunca interpreta custo total da composição como mão de obra e nunca confunde UF.
*/
(function(){
'use strict';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const money=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>0&&n<1e9?Math.round(n*100)/100:null};
const coeff=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>0&&n<1e7?n:null};
const code=v=>{const x=String(v??'').replace(/[.,]0+$/,'').trim();return /^\d{1,7}$/.test(x)&&Number(x)>0?x:''};
const unit=v=>norm(v).replace(/M²/g,'M2').replace(/M³/g,'M3').replace(/\^/g,'');
const key=(description,measurement)=>norm(description)+'|'+unit(measurement);
function actualBase(rows,fallback){
 const raw=String(rows?.[2]?.[1]??'').trim(),match=raw.match(/^([01]?\d)\/(20\d{2})$/);
 return match&&Number(match[1])>=1&&Number(match[1])<=12?match[2]+'-'+match[1].padStart(2,'0'):fallback;
}
function roleOf(description){
 const name=norm(description);
 if(!/COM ENCARGOS/.test(name))return null;
 if(/\bSERVENTE\b/.test(name))return 'Ajudante';
 if(/\bAJUDANTE DE ELETRICISTA\b/.test(name))return 'Ajudante';
 if(/\bELETRICISTA\b/.test(name))return 'Eletricista';
 if(/\bPEDREIRO\b/.test(name))return 'Pedreiro';
 if(/\bCARPINTEIRO\b/.test(name))return 'Carpinteiro';
 if(/\bARMADOR\b/.test(name))return 'Armador';
 if(/\bPINTOR\b/.test(name))return 'Pintor';
 if(/\bENCANADOR\b/.test(name))return 'Encanador';
 if(/\bOPERADOR\b/.test(name))return 'Operador';
 if(/\bGESSEIRO\b/.test(name))return 'Gesseiro';
 if(/\bSOLDADOR\b/.test(name))return 'Soldador';
 return null;
}
function readRows(book,name){
 const sheet=book.Sheets[name];
 return sheet&&sheet['!ref']?window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:false}):null;
}
function pricesSP(rows,type){
 const result=new Map();
 if(!rows||!rows.length)return result;
 const states=rows.slice(0,12).find(row=>Array.isArray(row)&&row.some(v=>norm(v)==='SP'));
 if(!states)return result;
 const i=states.findIndex(v=>norm(v)==='SP');
 if(i<0)return result;
 for(const row of rows.slice(10)){
  if(!Array.isArray(row))continue;
  const description=String(row[type==='composicao'?2:2]??'').trim();
  const measurement=row[type==='composicao'?3:3];
  const price=money(row[i]);
  if(!description||!price||!measurement)continue;
  const k=key(description,measurement);
  // Dados por descrição são utilizados apenas quando únicos; no relatório CSD
  // fornecido os códigos da composição estão armazenados com cache '0'.
  if(result.has(k))result.set(k,null);
  else result.set(k,price);
 }
 return result;
}
function costRows(book,options,filename){
 const sheet=options.regime==='desonerada'?'CCD':'CSD';
 const rows=readRows(book,sheet);
 if(!rows?.length)return [];
 const state=rows.slice(0,12).find(row=>Array.isArray(row)&&row.some(v=>norm(v)==='SP'));
 if(!state)return [];
 const i=state.findIndex(v=>norm(v)==='SP'),result=[];
 for(const row of rows.slice(10)){
  if(!Array.isArray(row))continue;
  const name=String(row[2]??'').trim(),u=unit(row[3]),cost=money(row[i]);
  if(name.length<6||!u||!cost||!/^(?:UN|UND|M|M2|M3|M²|M³|KG|T|H|L|M2XKM|M3XKM|M3/KM|M2/MES|CJ|PTO)$/.test(u))continue;
  result.push({source:'SINAPI',kind:'composicao',uf:'SP',verifiedUF:true,
   regime:options.regime,base:options.base,code:code(row[1])||'',
   name,unit:u,cost,fileName,sheetName:sheet});
 }
 return result;
}
function analytic(book,options,filename){
 const rows=readRows(book,'Analítico');
 if(!rows)return null;
 options={...options,base:actualBase(rows,options.base)};
 const title=norm(rows[1]?.[0]);
 const heading=rows.find(row=>norm(row?.[1]).includes('CODIGO DA')&&norm(row?.[6])==='COEFICIENTE');
 if(!/RELATORIO ANALITICO DE COMPOSICOES/.test(title)||!heading)
  throw new Error('A aba Analítico não contém as colunas oficiais de código, tipo, descrição, unidade e coeficiente.');
 const costName=options.regime==='desonerada'?'CCD':'CSD';
 const costs=pricesSP(readRows(book,costName),'composicao');
 const costsByRow=costRows(book,options,filename);
 const list=[],byCode=new Map();let parent=null;
 const groupName=String(filename||'SINAPI referência');
 for(const row of rows.slice(10)){
  if(!Array.isArray(row))continue;
  const compositionCode=code(row[1]);
  if(!compositionCode)continue;
  const type=norm(row[2]),description=String(row[4]??'').trim();
  const u=unit(row[5]),h=coeff(row[6]),situation=norm(row[7]);
  if(!type&&description&&u){
   if(byCode.has(compositionCode)){parent=byCode.get(compositionCode);continue}
   parent={id:'SINAPI:'+options.uf+':'+options.regime+':'+options.base+':composicao:'+compositionCode,
    code:compositionCode,name:description,unit:u,kind:'composicao',uf:options.uf,
    base:options.base,regime:options.regime,source:'SINAPI',fileName:groupName,
    sheetName:'Analítico',verifiedUF:true,
    cost:costs.get(key(description,u))||null,
    status:situation,analytical:true,analyticalReviewNeeded:true,
    analyticLabor:[],analyticItems:[],laborHoursPerUnit:0};
   list.push(parent);byCode.set(compositionCode,parent);
   continue;
  }
  const found=byCode.get(compositionCode);
  if(!found||!type||!description||!h)continue;
  const child={type,code:code(row[3]),name:description,unit:u,coefficient:h,status:situation};
  found.analyticItems.push(child);
  const role=type==='COMPOSICAO'&&u==='H'?roleOf(description):null;
  if(role){found.analyticLabor.push({...child,role,hoursPerUnit:h});found.laborHoursPerUnit+=h}
 }
 if(!list.length)throw new Error('Nenhuma composição reconhecida na aba Analítico da planilha.');
 for(const item of list)item.laborHoursPerUnit=Math.round(item.laborHoursPerUnit*1e7)/1e7;
 return {items:list,priceRows:costsByRow,headers:1,seen:rows.length,base:options.base,layout:'SINAPI Referência/Analítico',
  laborCompositions:list.filter(x=>x.analyticLabor.length).length,
  priced:list.filter(x=>x.cost!==null).length,
  notes:'Coeficientes analíticos diretos: subcomposições não são expandidas automaticamente.'};
}
function inputs(book,options,filename){
 const sheet=options.regime==='desonerada'?'ICD':'ISD';
 const rows=readRows(book,sheet);
 if(!rows)return null;
 options={...options,base:actualBase(rows,options.base)};
 const state=rows.slice(0,12).find(row=>Array.isArray(row)&&row.some(v=>norm(v)==='SP'));
 if(!state)throw new Error('A planilha de insumos não contém coluna SP verificável.');
 const col=state.findIndex(v=>norm(v)==='SP');
 const items=[];
 for(const row of rows.slice(10)){
  const compositionCode=code(row?.[1]),name=String(row?.[2]??'').trim(),u=unit(row?.[3]);
  if(!compositionCode||!name||!u)continue;
  const price=money(row?.[col]);
  items.push({id:'SINAPI:'+options.uf+':'+options.regime+':'+options.base+':insumo:'+compositionCode,
   code:compositionCode,name,unit:u,cost:price,kind:'insumo',uf:options.uf,base:options.base,
   regime:options.regime,source:'SINAPI',fileName:filename,sheetName:sheet,
   verifiedUF:true,status:'REFERÊNCIA DE INSUMO'});
 }
 return {items,headers:1,seen:rows.length,base:options.base,layout:'SINAPI Referência/'+sheet};
}
function parse(book,options,filename){
 if(options.uf!=='SP')throw new Error('Esta importação está configurada para São Paulo (SP).');
 if(options.kind==='insumos'&&book?.Sheets?.[options.regime==='desonerada'?'ICD':'ISD'])
  return inputs(book,options,filename);
 if(book?.Sheets?.Analítico)return analytic(book,options,filename);
 const sheet=options.regime==='desonerada'?'CCD':'CSD';
 if(book?.Sheets?.[sheet]){
  const rows=costRows(book,options,filename);
  return {items:[],priceRows:rows,headers:1,seen:rows.length,
   layout:'SINAPI Referência/'+sheet,notes:'Custos oficiais por UF. Vincular com Analítico por código ou descrição/unidade únicos.'};
 }
 return null;
}
window.CIVOLTENReferenceParser={parse,roleOf,analytic,inputs,costRows};
})();