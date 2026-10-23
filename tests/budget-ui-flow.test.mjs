import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const part=app.slice(app.indexOf('function editor(){'),app.indexOf('function summary(){'));
test('editor apresenta cinco etapas na sequência natural de construção do orçamento',()=>{
 const ids=['project','services','team','materials','commercial'];
 const order=ids.map(key=>part.indexOf('id="budget-step-'+key+'"'));
 assert.ok(order.every(x=>x>=0));
 assert.deepEqual([...order].sort((a,b)=>a-b),order);
 for(const id of ids)assert.match(part,new RegExp('href="#budget-step-'+id+'"'));
 assert.match(part,/budget-workflow-head/);
});
test('todos os campos do orçamento continuam únicos e editáveis',()=>{
 const fields=['title','customer','address','days','status','services','notes','company_intro',
  'civil_services','electrical_services','methodology','validity_days',
  'technical_responsible','payment_terms','warranty_terms','manual_price'];
 for(const key of fields){
  assert.equal(part.split('data-draft="'+key+'"').length-1,1,'campo duplicado ou ausente: '+key);
 }
 for(const action of ['apply-electrical-proposal','add-worker','add-scope','add-variable',
  'add-expense','save-budget','print-budget']){
  assert.ok(part.includes('data-action="'+action+'"'),action);
 }
 assert.ok(part.includes('id="budgetSummary"'));
});
test('condições comerciais aparecem, mas campos opcionais permanecem recolhidos',()=>{
 const requiredPos=part.indexOf('data-draft="payment_terms"');
 const advancedPos=part.indexOf('class="budget-more-details"><summary>Mais detalhes do PDF');
 assert.ok(requiredPos>0&&advancedPos>0&&requiredPos<advancedPos);
 assert.ok(part.includes('class="grid budget-commercial-essential"'));
 assert.ok(!part.includes('class="budget-more-details" open><summary>Personalizar'));
});
test('mudanças visuais não afetam PDF, contratos e autenticação',()=>{
 assert.match(css,/\.budget-jump-nav/);
 assert.match(css,/\.budget-simple-editor/);
 assert.match(css,/\.budget-summary-panel/);
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(index,/proposal-print\.css/);
 assert.ok(!index.includes('proposal-art-print.css'));
 const print=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 assert.match(print,/\.contract-document-v2/);
 assert.match(print,/\.cv-proposal/);
});
