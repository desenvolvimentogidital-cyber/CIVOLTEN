import test from 'node:test';
import assert from 'node:assert/strict';
import {COST_PRESETS,costPresetsMissing,prepareCostPresets} from '../src/cost-presets.mjs';
import {fresh,summary} from '../src/calc.mjs';
import {createE2EClient} from '../src/e2e-client.mjs';
import {putCostPresetsRemote,fetchRemote,putRemote} from '../src/cloud.mjs';

const userId='00000000-0000-4000-8000-000000000001';
const uuidFactory=()=>{
 let n=0;
 return ()=>'11111111-1111-4111-8111-'+String(++n).padStart(12,'0');
};
const storage=()=>{
 const rows=new Map();
 globalThis.localStorage={getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)};
};

test('modelos abrangentes, sem salários e impostos duplicados nem valores fictícios',()=>{
 assert.equal(COST_PRESETS.fixed.length,29);
 assert.equal(COST_PRESETS.variable.length,37);
 const d=fresh(),items=prepareCostPresets(d,uuidFactory());
 assert.equal(items.fixed.length,29);
 assert.equal(items.variable.length,37);
 assert.ok(items.fixed.every(x=>x.amount===0));
 assert.ok(items.variable.every(x=>x.unitCost===0&&x.monthQty===null));
 assert.ok(items.fixed.some(x=>x.frequency==='annual'));
 assert.ok(items.variable.some(x=>x.name.includes('Materiais elétricos')));
 assert.ok(!items.fixed.some(x=>/Salário CLT|FGTS|Imposto sobre venda/.test(x.name)));
 assert.equal(new Set([...items.fixed,...items.variable].map(x=>x.id)).size,66);
 d.fixed.push(...items.fixed);d.variable.push(...items.variable);
 const a=summary(d);
 assert.equal(a.total,0,'Valores não informados não podem virar dinheiro estimado');
 assert.equal(a.missing,66,'Todos ficam marcados pendentes até informar custos reais');
 assert.equal(a.complete,false);
 d.fixed[0].amount=1250;
 d.variable[0].unitCost=40;d.variable[0].monthQty=5;
 const b=summary(d);
 assert.equal(b.fixed,125000);
 assert.equal(b.variable,20000);
 assert.equal(b.total,145000);
 assert.equal(b.missing,64);
});
test('duplicidades são evitadas e registros anteriores ficam intactos',()=>{
 const d=fresh();
 d.fixed.push({id:'existente',name:'ALUGUEL',amount:1320,frequency:'monthly',category:'Atual'});
 d.variable.push({id:'combustivel',name:'Combustível',unitCost:17,monthQty:8,unit:'un'});
 const left=costPresetsMissing(d);
 assert.equal(left.fixed.length,28);
 assert.equal(left.variable.length,36);
 const next=prepareCostPresets(d,uuidFactory());
 assert.equal(next.fixed.length,28);
 assert.equal(next.variable.length,36);
 assert.equal(d.fixed[0].amount,1320);
 assert.equal(d.variable[0].unitCost,17);
 d.fixed.push(...next.fixed);d.variable.push(...next.variable);
 assert.equal(costPresetsMissing(d).fixed.length,0);
 assert.equal(costPresetsMissing(d).variable.length,0);
});
test('importação em lote persiste na conta, respeita RLS e não toca funcionários ou orçamentos',async()=>{
 storage();
 const client=createE2EClient();
 await client.auth.signInWithPassword({email:'custos@teste.example'});
 const d=fresh();
 const existing={id:'22222222-2222-4222-8222-222222222222',
  name:'Aluguel',category:'Infraestrutura',amount:1300,frequency:'monthly'};
 await putRemote(client,userId,'fixed',existing);
 d.fixed.push(existing);
 const created=prepareCostPresets(d,uuidFactory());
 await putCostPresetsRemote(client,userId,'fixed',created.fixed);
 await putCostPresetsRemote(client,userId,'variable',created.variable);
 const remote=await fetchRemote(client,userId);
 assert.equal(remote.fixed.length,29);
 assert.equal(remote.variable.length,37);
 assert.equal(remote.fixed.find(i=>i.id===existing.id).amount,1300);
 assert.equal(remote.budgets.length,0);
 assert.equal(remote.employees.length,0);
 assert.equal(summary(remote).fixed,130000);
 assert.equal(summary(remote).missing,65);
 const nothing=prepareCostPresets(remote,uuidFactory());
 assert.equal(nothing.fixed.length,0);
 assert.equal(nothing.variable.length,0);
 assert.deepEqual(await putCostPresetsRemote(client,userId,'fixed',[]),[]);
 await assert.rejects(
  putCostPresetsRemote(client,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixed',created.fixed),
  /RLS|não foi possível/i
 );
});
