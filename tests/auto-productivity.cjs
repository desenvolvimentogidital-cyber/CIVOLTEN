'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {sameOfficial,roleMatches,analyze}=require('../auto-productivity-core.js');
const base={name:'FORNECIMENTO E INSTALAÇÃO DE PAREDE',unit:'M2'};
const sinapi={...base,id:'sinapi1',code:'123456',source:'SINAPI',uf:'SP',verifiedUF:true,analytical:true,regime:'onerada',base:'2026-07',
 analyticLabor:[{role:'Pedreiro',hoursPerUnit:1.25},{role:'Servente',hoursPerUnit:.75}],
 analyticItems:[]};
const workers=[{id:'a',role:'Pedreiro',name:'Pedreiro A',rate:32},{id:'b',role:'Pedreiro',name:'Pedreiro B',rate:38},{id:'c',role:'Servente',name:'Ajudante',rate:20}];
test('associação entre SIURB e SINAPI exige mesmo nome, unidade e referência única',()=>{
 assert.equal(sameOfficial(base,[sinapi],'onerada')?.id,'sinapi1');
 assert.equal(sameOfficial(base,[{...sinapi,unit:'M3'}]),null);
 assert.equal(sameOfficial(base,[sinapi,sinapi]),null);
 assert.equal(sameOfficial(base,[{...sinapi,verifiedUF:false}]),null);
 assert.equal(sameOfficial(base,[{...sinapi,regime:'desonerada'}],'onerada'),null);
});
test('coeficientes reais com custo/hora cadastrado montam estimativa sem digitar horas',()=>{
 const a=analyze(sinapi,workers,w=>w.rate);
 assert.equal(a.status,'ready');assert.equal(a.hours,2);
 assert.equal(a.cost,62.5);assert.equal(a.rows[0].workerId,'b');assert.equal(a.rows[1].workerId,'c');
 assert.equal(a.referenceCode,'123456');
});
test('não atribui salários nem produtividade inventados quando faltam dados',()=>{
 const a=analyze(sinapi,[],()=>0);
 assert.equal(a.status,'missing-rate');assert.equal(a.cost,0);assert.equal(a.hours,2);
 assert.equal(a.missingRates.length,2);
});
test('subcomposições não viram estimativa global validada',()=>{
 const a=analyze({...sinapi,analyticItems:[{type:'COMPOSICAO',unit:'M2',coefficient:1}]},workers,w=>w.rate);
 assert.equal(a.status,'partial');
});
test('coeficientes ausentes não produzem produtividade fictícia',()=>{
 const a=analyze({...sinapi,analyticLabor:[]},workers,w=>w.rate);
 assert.equal(a.status,'unavailable');assert.equal(a.hours,0);assert.equal(a.cost,0);
});
test('ajudante nunca substitui o profissional principal',()=>{
 assert.equal(roleMatches('Pedreiro','Ajudante de pedreiro'),false);
 assert.equal(roleMatches('Servente','Ajudante de obra'),true);
});
test('valor publicado SINAPI não altera custo por hora real',()=>{
 const a=analyze({...sinapi,cost:99000},workers,w=>w.rate);
 assert.equal(a.cost,62.5);
});
