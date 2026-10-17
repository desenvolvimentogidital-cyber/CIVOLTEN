import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../supabase/functions/civolten-beta/siurb-reference.ts',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source.replace(/^export /gm,'')+'\nglobalThis.testExports={normalizeReferenceBatch};',context);
const {normalizeReferenceBatch}=context.testExports;
function payload(source='EDIF'){
 return {source,period:'2026-07',regime:'com_desoneracao',items:[{
  code:'9003070',description:'Cabo isolado 750 V de dois condutores',unit:'M',cost:7.04,
  inputs:[{code:'2099',description:'Servente',unit:'H',unit_cost:25.67,coefficient:0.01,partial_cost:0.2567}]
 }]};
}
test('conversão SIURB conserva código, data-base, insumo, coeficiente e custo',()=>{
 const rows=normalizeReferenceBatch(payload());
 assert.equal(rows.length,1);
 assert.equal(rows[0].code,'9003070');
 assert.equal(rows[0].source,'EDIF');
 assert.equal(rows[0].base_month,'2026-07');
 assert.equal(rows[0].unit_cost,7.04);
 assert.equal(rows[0].inputs[0].coefficient,0.01);
 assert.equal(rows[0].inputs[0].partial_cost,0.2567);
});
test('referência rejeita períodos, fontes, quantidades e custos inválidos',()=>{
 const cases=[
  {...payload(),source:'SINAPI'},
  {...payload(),period:'2025-01'},
  {...payload(),regime:'sem_desoneracao'},
  {...payload(),items:[{...payload().items[0],code:'x#'}]},
  {...payload(),items:[{...payload().items[0],cost:-10}]},
  {...payload(),items:Array(31).fill(payload().items[0])},
  {...payload(),items:[payload().items[0],payload().items[0]]}
 ];
 for(const x of cases)assert.throws(()=>normalizeReferenceBatch(x));
});
test('arquivo de importação só é acessível a partir do painel seguro',()=>{
 const code=readFileSync(new URL('../assets/civolten-reference.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/innerHTML|localStorage|sessionStorage|document\.cookie|access_token/);
 assert.match(code,/admin-reference-import/);
 assert.match(code,/admin-reference-search/);
});
