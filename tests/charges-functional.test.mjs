import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateBudget} from '../lib/civolten-calc.mjs';

const base={days:5,staff:[{name:'Eletricista',daily_cents:20000,days:5,charges_pct:0}],pricing:{billable_days_month:22,tax_pct:10,margin_pct:20}};

test('encargos percentuais de 0, 12.5 e 20 mudam custo real e preco sugerido',()=>{
 const zero=calculateBudget(base);
 const twelve=calculateBudget({...base,staff:[{...base.staff[0],charges_pct:12.5}]});
 const twenty=calculateBudget({...base,staff:[{...base.staff[0],charges_pct:20}]});
 assert.equal(zero.labor_cents,100000);
 assert.equal(twelve.labor_cents,112500);
 assert.equal(twenty.labor_cents,120000);
 assert.ok(twenty.calculated_price_cents>twelve.calculated_price_cents);
 assert.ok(twelve.calculated_price_cents>zero.calculated_price_cents);
});

test('encargos aplicados individualmente por profissional e por diaria',()=>{
 const result=calculateBudget({...base,staff:[
  {name:'Autonomo',daily_cents:20000,days:2,charges_pct:0},
  {name:'CLT',daily_cents:10000,days:3,charges_pct:50}
 ]});
 assert.equal(result.labor_cents,85000);
});

test('rejeitar taxas invalidas sem truncamento silencioso',()=>{
 for(const invalid of [-1,201,500,'nao preenchido',null]){
  const staff=[{...base.staff[0],charges_pct:invalid}];
  if(invalid===null)continue; // null é o legado sem percentual, tratado como zero
  assert.throws(()=>calculateBudget({...base,staff}),/Encargos do profissional/);
 }
 assert.equal(calculateBudget({...base,staff:[{...base.staff[0],charges_pct:null}]}).labor_cents,100000);
});

test('funcionarios novos começam com 0%, limite de 200% e orçamento permite edição',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(app,/k==='charges_pct'\?\(raw\?\?0\)/);
 assert.match(app,/k==='charges_pct'\?'min="0" max="200" step="0\.01"'/);
 assert.match(app,/data-staff-charges/);
 assert.match(app,/e\.dataset\.staffCharges!==undefined/);
 assert.match(app,/b\.staff\[i\]\.charges_pct=pct/);
 assert.match(app,/data-staff-cost/);
 assert.match(app,/summary\(\)/);
 assert.match(css,/\.staff-line\{/);
 assert.match(css,/@media\(max-width:1090px\)/);
 assert.match(app,/o cadastro original não muda/); // a edição do orçamento é independente
});

test('cadastro conserva o percentual informado e não o substitui por referência',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(app,/\['charges_pct','Encargos estimados \(\%\)','number'\]/);
 assert.match(app,/record\[k\]=type==='checkbox'\?e\.checked:type==='money'\?money\(e\.value\):type==='number'\?num\(e\.value\)/);
 assert.match(app,/charges_pct:num\(x\.charges_pct\)/);
});
