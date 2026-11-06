'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const x=require('../reference-integrity-core.js');
const id='SINAPI:SP:onerada:2026-07:composicao:999001';
const analytic={id,code:'999001',name:'ALVENARIA DE BLOCOS CERÂMICOS',unit:'M²',
 kind:'composicao',source:'SINAPI',uf:'SP',verifiedUF:true,regime:'onerada',base:'2026-07',
 analytical:true,analyticItems:[{type:'COMPOSICAO',unit:'H',coefficient:1.2}],
 analyticLabor:[{role:'Pedreiro',hoursPerUnit:1.2}],laborHoursPerUnit:1.2,cost:null};
const ref={code:'999001',name:analytic.name,unit:'M2',kind:'composicao',source:'SINAPI',uf:'SP',
 verifiedUF:true,regime:'onerada',base:'2026-07',cost:148.35,fileName:'CSD oficial'};
test('combina analítico e CSD/SP sem perder coeficiente nem referência',()=>{
 const r=x.enrich([analytic],[ref]);
 assert.equal(r.recovered,1);assert.equal(r.items[0].cost,148.35);
 assert.equal(r.items[0].analyticLabor[0].hoursPerUnit,1.2);
});
test('planilha de preço independente não apaga a composição analítica',()=>{
 const priced={...analytic,cost:148.35,analytical:false,analyticItems:[],analyticLabor:[]};
 const a=x.mergeRecords([analytic],[priced])[0];
 assert.equal(a.cost,148.35);assert.equal(a.analytical,true);
 assert.equal(a.analyticLabor.length,1);
});
test('preço ausente não substitui preço verificado da mesma identidade',()=>{
 const a=x.mergeRecords([{...analytic,cost:148.35}],[analytic])[0];
 assert.equal(a.cost,148.35);
});
test('não cruza unidades, datas, regimes ou UF distintos',()=>{
 for(const change of [{unit:'M3'},{regime:'desonerada'},{base:'2026-08'},{uf:'RJ'},{verifiedUF:false}]){
  const r=x.enrich([analytic],[{...ref,...change}]);
  assert.equal(r.recovered,0,JSON.stringify(change));
  assert.equal(r.items[0].cost,null);
 }
});
test('descrição equivalente sem código é usada apenas quando custo único',()=>{
 const r=x.enrich([analytic],[{...ref,code:''}]);
 assert.equal(r.recovered,1);assert.equal(r.items[0].cost,148.35);
});
test('duas cotações divergentes não escolhem preço arbitrariamente',()=>{
 const r=x.enrich([analytic],[ref,{...ref,fileName:'Outro',cost:130}]);
 assert.equal(r.conflicts,1);assert.equal(r.items[0].cost,null);
});
test('preço de referência é nullable, nunca inventa zero',()=>{
 const q=x.quality([analytic,{...analytic,id:'outro',cost:10,analytical:false}]);
 assert.equal(q.unpriced,1);assert.equal(q.analytic,1);
 assert.equal(x.money(null),null);assert.equal(x.money(''),null);
});
