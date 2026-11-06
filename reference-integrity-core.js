/* CIVOLTEN | Integridade da base pública SINAPI/SIURB.
   Referência monetária não é custo interno, nem produtividade real da equipe. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CIVOLTENReferenceIntegrity=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 const unit=v=>norm(String(v??'').replace(/²/g,'2').replace(/³/g,'3').replace(/\^/g,'')).replace(/ /g,'').replace(/^(UNIDADE|UNID|UND|UNI)$/,'UN').replace(/^(HORA|HR)$/,'H');
 const money=v=>{const n=Number(v);return Number.isFinite(n)&&n>0&&n<1e9?Math.round(n*100)/100:null};
 const sourceKey=v=>[v?.source||v?.origin||'SINAPI',v?.uf||'SP',v?.regime||v?.sourceRegime||'',v?.base||v?.sourceDate||'',v?.kind||'composicao'].map(norm).join('|');
 const nameKey=v=>[sourceKey(v),norm(v?.name),unit(v?.unit)].join('|');
 const codeKey=v=>[sourceKey(v),norm(v?.code||v?.sourceCode)].join('|');
 const identity=v=>String(v.id||codeKey(v));
 const asRows=v=>Array.isArray(v)?v:[];
 function mergedRecord(old,next){
  // Merge only for same stable identity; otherwise never mix UFs/edition/regimes.
  if(identity(old)!==identity(next))return next;
  const merged={...old,...next};
  if(money(next.cost)==null&&money(old.cost)!=null){
   merged.cost=old.cost;
   merged.priceEvidence=old.priceEvidence||old.fileName||'Preço da mesma referência previamente importada';
  }
  if(!next.analytical&&old.analytical){
   merged.analytical=true;
   merged.analyticItems=asRows(old.analyticItems).map(x=>({...x}));
   merged.analyticLabor=asRows(old.analyticLabor).map(x=>({...x}));
   merged.laborHoursPerUnit=old.laborHoursPerUnit||0;
   merged.analyticalReviewNeeded=old.analyticalReviewNeeded;
   merged.analyticalSourceFile=old.analyticalSourceFile||old.fileName;
  }else if(next.analytical&&old.analytical&&
   !asRows(next.analyticItems).length&&asRows(old.analyticItems).length){
   // A fresh metadata-only record must not erase known coefficients.
   merged.analyticItems=old.analyticItems;
   merged.analyticLabor=old.analyticLabor;
   merged.laborHoursPerUnit=old.laborHoursPerUnit;
  }
  if(!next.verifiedUF&&old.verifiedUF)merged.verifiedUF=true;
  return merged;
 }
 function mergeRecords(existing,incoming){
  const map=new Map();
  for(const row of [...asRows(existing),...asRows(incoming)]){
   if(!row||!row.id)continue;
   const id=identity(row);
   map.set(id,map.has(id)?mergedRecord(map.get(id),row):row);
  }
  return [...map.values()];
 }
 function enrich(items,prices){
  // Any ambiguity in the public price rows MUST remain unpriced.
  const priceByCode=new Map(),priceByName=new Map();
  const add=(map,key,row)=>{
   const previous=map.get(key)||[];
   if(!previous.some(x=>x.fileName===row.fileName&&x.cost===row.cost))previous.push(row);
   map.set(key,previous);
  };
  for(const r of asRows(prices)){
   if(!r||money(r.cost)==null||!r.verifiedUF||r.uf!=='SP')continue;
   const k=nameKey(r);
   if(r.name&&r.unit)add(priceByName,k,r);
   if(r.code)add(priceByCode,codeKey(r),r);
  }
  let recovered=0,conflicts=0,missing=0;
  const updated=asRows(items).map(item=>{
   if(item?.source!=='SINAPI'||item.uf!=='SP'||!item.verifiedUF||money(item.cost)!=null)return item;
   // Code match is preferred; if no match, exact normalized name + unit.
   const coded=item.code?priceByCode.get(codeKey(item))||[]:[];
   const candidates=coded.length?coded:priceByName.get(nameKey(item))||[];
   const unique=[...new Set(candidates.map(x=>money(x.cost)))];
   if(unique.length===1&&candidates.length){
    recovered++;
    return {...item,cost:unique[0],priceEvidence:'SINAPI custo SP confirmado',
      costSourceFile:candidates[0].fileName||candidates[0].sheetName||'Planilha de custos'};
   }
   if(unique.length>1)conflicts++;
   else missing++;
   return item;
  });
  return {items:updated,recovered,conflicts,missing};
 }
 function quality(items){
  let total=0,priced=0,analytic=0,unpricedAnalytic=0;
  for(const row of asRows(items)){
   if(!row)continue;total++;
   if(money(row.cost)!=null)priced++;
   if(row.analytical){analytic++;if(money(row.cost)==null)unpricedAnalytic++;}
  }
  return {total,priced,unpriced:total-priced,analytic,unpricedAnalytic};
 }
 return {norm,unit,money,sourceKey,nameKey,codeKey,mergedRecord,mergeRecords,enrich,quality};
});
