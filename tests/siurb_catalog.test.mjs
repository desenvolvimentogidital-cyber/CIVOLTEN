import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=JSON.parse(readFileSync(new URL('../public/data/siurb-2026-07.json',import.meta.url),'utf8'));
const items=file.items;
test('SIURB oficial jul/2026: origem, regimes, integridade e produtividade não presumida',()=>{
 assert.equal(file.meta.reference_month,'2026-07');
 assert.equal(file.meta.total,items.length);
 assert.equal(items.length,6988);
 assert.equal(file.meta.origins.length,4);
 assert.ok(file.meta.origins.every(x=>x.source_url.startsWith('https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/')&&x.sha256.length===64));
 const groups=new Map();
 const keys=new Set();
 for(const item of items){
  assert.equal(item.source,'SIURB');
  assert.equal(item.reference_month,'2026-07');
  assert.ok(['Edificações','Infraestrutura'].includes(item.category));
  assert.ok(['Com desoneração','Sem desoneração'].includes(item.regime));
  assert.match(item.code,/^\d{6,9}$/);
  assert.ok(item.description.trim().length>4);
  assert.ok(item.unit.trim().length>0);
  assert.ok(Number.isFinite(item.cost)&&item.cost>0);
  assert.equal(item.hh_per_unit,null);
  const key=[item.category,item.regime,item.code].join(':');
  assert.ok(!keys.has(key),'código repetido no mesmo grupo/regime: '+key);
  keys.add(key);
  const g=item.category+'|'+item.regime;groups.set(g,(groups.get(g)||0)+1);
 }
 assert.equal(groups.get('Edificações|Sem desoneração'),2630);
 assert.equal(groups.get('Edificações|Com desoneração'),2630);
 assert.equal(groups.get('Infraestrutura|Sem desoneração'),864);
 assert.equal(groups.get('Infraestrutura|Com desoneração'),864);
 const one=(cat,regime,code)=>items.find(x=>x.category===cat&&x.regime===regime&&x.code===code);
 assert.equal(one('Edificações','Sem desoneração','1001001').cost,1.81);
 assert.equal(one('Edificações','Com desoneração','1001001').cost,1.79);
 assert.equal(one('Infraestrutura','Sem desoneração','1009000').cost,0.77);
});
