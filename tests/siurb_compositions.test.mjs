import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=JSON.parse(readFileSync(new URL('../public/data/siurb-compositions-2026-07.json',import.meta.url),'utf8'));
const costs=JSON.parse(readFileSync(new URL('../public/data/siurb-2026-07.json',import.meta.url),'utf8'));
const ids=new Map(costs.items.map(x=>[[x.category,x.regime,x.code].join('|'),x]));
test('SIURB composições e coeficientes diretos rastreáveis',()=>{
 assert.equal(file.meta.reference_month,'2026-07');
 assert.equal(file.meta.count,6926);
 assert.equal(file.items.length,6926);
 assert.equal(file.meta.origins.length,4);
 assert.equal(file.meta.labor_sources.length,4);
 const keys=new Set();
 for(const row of file.items){
  const key=[row.category,row.regime,row.code].join('|');
  assert.ok(!keys.has(key),'Duplicação de código: '+key);keys.add(key);
  const cost=ids.get(key);assert.ok(cost,'Preço ausente: '+key);
  assert.ok(Math.abs(row.cost-cost.cost)<=.02);
  assert.ok(row.direct_hh_per_unit>=0);
  const hours=row.labor.reduce((s,x)=>s+x.coef,0);
  assert.ok(Math.abs(hours-row.direct_hh_per_unit)<.000002);
  assert.ok(row.labor.every(x=>x.unit.toUpperCase()==='H'));
  assert.ok(row.other.every(x=>x.group==='material/equipamento/auxiliar'));
 }
 assert.equal(costs.items.length-file.items.length,62,'Custos sem ficha detalhada devem continuar sinalizados');
 const first=file.items.find(x=>x.category==='Edificações'&&x.regime==='Sem desoneração'&&x.code==='1001001');
 assert.ok(first);
 assert.ok(Math.abs(first.direct_hh_per_unit-.0098)<1e-7);
 assert.ok(first.other.some(x=>x.code==='94061'),'Horas de trator não podem ser contadas como mão de obra');
});
