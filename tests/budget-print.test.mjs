import test from 'node:test';
import assert from 'node:assert/strict';
import {printableBudget} from '../src/budget-print.mjs';
import {createService,priceBudget} from '../src/budget.mjs';
import {brl} from '../src/calc.mjs';
const budget=(changes={})=>({
 id:'12345678-1111-4111-8111-111111111111',
 title:'Reformas de teste',customer:'Cliente ilustrativo',project:'Reforma da sala',
 location:'São Paulo / SP',expiresOn:'2026-12-01',notes:'Serviços conforme descrito.',
 demo:true,status:'draft',createdAt:'2026-11-07T12:00:00.000Z',
 items:[{...createService('DEMO-E01','item-1'),quantity:2}],
 pricing:{monthlyCostCents:1600000,productiveHours:320,taxPct:10,marginPct:20,
 companyName:'CIVOLTEN',capturedOn:'2026-11-07'},...changes
});
test('PDF V4 integra os dois arquivos oficiais da marca e marca-d’água por página',()=>{
 const html=printableBudget(budget());
 assert.match(html,/assets\/civolten-logo\.png/);
 assert.match(html,/assets\/civolten-simbolo\.png/);
 assert.match(html,/budget-pdf-watermark-icon/);
 assert.match(html,/budget-pdf-watermark-logo/);
 assert.match(html,/ORÇAMENTO DEMONSTRATIVO/);
 assert.match(html,/NÃO ENVIAR AO CLIENTE/);
 assert.match(html,/DOCUMENTO DE TESTE/);
 assert.match(html,/CV-12345678/);
});
test('preço do PDF sempre é o total calculado de linhas, não valor fixo do mockup',()=>{
 const b=budget();
 const html=printableBudget(b);
 assert.ok(html.includes(brl(priceBudget(b).totalSale)));
 assert.ok(html.includes(brl(priceBudget(b).rows[0].selling)));
 assert.ok(!html.includes('47.540,31'));
 assert.doesNotMatch(html,/Lucro gerencial|Alíquota aplicada|Custo mensal da empresa/);
});
test('dados de cliente e observações escapam HTML e são dinâmicos',()=>{
 const html=printableBudget(budget({
  customer:'João <script>alert(1)</script>',
  notes:'& descrição personalizada'
 }));
 assert.ok(html.includes('João &lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.ok(html.includes('&amp; descrição personalizada'));
 assert.match(html,/Reforma da sala/);
 assert.match(html,/Cliente ilustrativo|João/);
});
test('proposta futura sem itens fictícios não recebe aviso de teste',()=>{
 const b=budget({demo:false});
 const html=printableBudget(b);
 assert.match(html,/PROPOSTA COMERCIAL/);
 assert.doesNotMatch(html,/NÃO ENVIAR AO CLIENTE/);
 assert.doesNotMatch(html,/DOCUMENTO DE TESTE/);
});
test('rascunho sem preço validado não imprime uma proposta vazia',()=>{
 assert.equal(printableBudget(budget({pricing:null})), '');
});
