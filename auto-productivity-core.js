/* CIVOLTEN | Produtividade oficial automática sem coeficientes inventados.
 * SINAPI analítico fornece horas por unidade; SIURB sintético fornece apenas
 * custo global. Uma referência pública NÃO é o custo real da CIVOLTEN.
 */
(function(root,factory){
 const lib=factory();
 if(typeof module==='object'&&module.exports)module.exports=lib;
 else root.CIVOLTENAutoProductivity=lib;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const n=v=>{const x=Number(String(v??'0').replace(',','.'));return Number.isFinite(x)&&x>0?x:0};
 const unit=v=>norm(v).replace(/[²^]/g,'2').replace(/³/g,'3').replace(/[^a-z0-9]/g,'');
 const cents=v=>Math.round(v*100)/100;
 function sameOfficial(siurb,candidates,siurbRegime=''){
  if(!siurb?.name||!siurb?.unit)return null;
  const name=norm(siurb.name),u=unit(siurb.unit),regime=norm(siurbRegime||siurb.regime||siurb.sourceRegime);
  const matches=(candidates||[]).filter(x=>
   x&&x.analytical===true&&Array.isArray(x.analyticLabor)&&
   x.verifiedUF===true&&x.uf==='SP'&&
   norm(x.name)===name&&unit(x.unit)===u&&
   (!regime||!x.regime||norm(x.regime)===regime));
  // Um nome igual com várias versões não permite seleção arbitrária.
  return matches.length===1?matches[0]:null;
 }
 function roleMatches(sourceRole,workerRole){
  const a=norm(sourceRole),b=norm(workerRole);
  if(!a||!b)return false;
  if(/^(servente|ajudante|auxiliar)(?:\b|$)/.test(a))return /\b(servente|ajudante|auxiliar)\b/.test(b);
  if(/\bpedreiro\b/.test(a))return /\bpedreiro\b/.test(b)&&!/\b(ajudante|auxiliar)\b/.test(b);
  if(/\beletricista\b/.test(a))return /\beletricista\b/.test(b)&&!/\b(ajudante|auxiliar)\b/.test(b);
  if(/\bpintor\b/.test(a))return /\bpintor\b/.test(b)&&!/\b(ajudante|auxiliar)\b/.test(b);
  const first=a.split(/[,(/]/)[0].trim();
  return first.length>=5&&(b===first||b.includes(first)||first.includes(b)&&b.length>=5);
 }
 function analyze(ref,workers=[],hourly=()=>0){
  const labor=Array.isArray(ref?.analyticLabor)?ref.analyticLabor:[];
  const parts=Array.isArray(ref?.analyticItems)?ref.analyticItems:[];
  const grouped=new Map(),unknown=[];
  for(const line of labor){
   const hours=n(line.hoursPerUnit),role=String(line.role||'').trim();
   if(!hours)continue;
   if(!role){unknown.push(line);continue}
   const key=norm(role);
   if(!grouped.has(key))grouped.set(key,{role,hours:0});
   grouped.get(key).hours+=hours;
  }
  const indirect=parts.some(x=>x?.type==='COMPOSICAO'&&unit(x.unit)!=='h');
  const unmapped=parts.some(x=>x?.type==='COMPOSICAO'&&unit(x.unit)==='h'&&n(x.coefficient)&&
   !labor.some(l=>l.code===x.code&&l.role&&n(l.hoursPerUnit)));
  const rows=[...grouped.values()].map(entry=>{
   const matches=workers.filter(w=>roleMatches(entry.role,w.role)&&n(hourly(w))>0);
   matches.sort((a,b)=>n(hourly(b))-n(hourly(a)));
   const worker=matches[0];
   return {role:entry.role,workerId:worker?.id||'',workerName:worker?.name||entry.role,
    perUnitHours:Math.round(entry.hours*1e7)/1e7,count:1,rate:worker?n(hourly(worker)):0};
  });
  const hours=rows.reduce((v,row)=>v+row.perUnitHours,0);
  const cost=cents(rows.reduce((v,row)=>v+row.perUnitHours*row.rate,0));
  const missingRates=rows.filter(r=>!r.workerId||r.rate<=0).map(r=>r.role);
  let status='ready',reason='';
  if(!hours){status='unavailable';reason='A planilha oficial não contém coeficientes horistas reconhecidos para este serviço.'}
  else if(indirect||unmapped||unknown.length){status='partial';reason='A composição possui subcomposições ou mão de obra não mapeada. As horas diretas não representam a obra completa.'}
  else if(missingRates.length){status='missing-rate';reason='Falta custo/hora cadastrado para: '+missingRates.join(', ')+'.'}
  return {status,reason,rows,hours:Math.round(hours*1e7)/1e7,cost,missingRates,
   referenceCode:ref?.code||ref?.sourceCode||'',referenceBase:ref?.base||ref?.sourceDate||'',
   source:'SINAPI',indirect,unmapped};
 }
 return {sameOfficial,roleMatches,analyze,norm};
});
