import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateBudget} from '../src/estimate-engine.mjs';
const emptyRates=()=>({
 administracaoCentral:0,seguro:0,garantia:0,risco:0,
 despesasFinanceiras:0,lucro:0,tributosSobreReceita:0
});
const base=()=>({
 reference_month:'2026-07',regime:'Sem desoneração',bdi:emptyRates(),
 bdi_reviewed:true,technical_reviewed:true,commercial_reviewed:true,
 contingency_pct:0,
 items:[{code:'CIV-TEST',description:'Serviço fictício unitário',unit:'m²',quantity:'100',unit_cost:'2.50',source:'MANUAL',
 quantity_verified:true,supplier_quote_verified:true,supplier_name:'Fornecedor QA',quote_reference:'COT-QA-001',quote_date:'2026-10-29'}]
});
test('BDI zero: base em centavos exatos sem juros ou custos presumidos',()=>{
 const x=estimateBudget(base());
 assert.equal(x.direct_cost_reais,250);
 assert.equal(x.bdi_amount_reais,0);
 assert.equal(x.total_reais,250);
 assert.equal(x.ready,true);
});
test('Tributo sobre faturamento aplica divisor da fórmula, sem somar 10% diretamente',()=>{
 const input=base();input.bdi.tributosSobreReceita=10;
 const x=estimateBudget(input);
 assert.equal(x.direct_cost_reais,250);
 assert.equal(x.total_reais,277.78);
 assert.equal(x.bdi_amount_reais,27.78);
});
test('Contingência separada e cenários de elevação de custo',()=>{
 const x=base();x.contingency_pct=8;x.extra_direct_costs=[{description:'Frete confirmado',amount:'50.00',included_in_unit_prices:false}];
 const r=estimateBudget(x);
 assert.equal(r.direct_cost_reais,300);
 assert.equal(r.contingency_reais,24);
 assert.equal(r.total_reais,324);
 assert.equal(r.scenarios[0].estimated_direct_cost_reais,315);
 assert.equal(r.scenarios[0].contribution_reais,9);
});
test('Casas decimais em serviços SIURB não geram erro de ponto flutuante',()=>{
 const x=base();
 x.items=[{code:'1001001',source:'SIURB',description:'LIMPEZA MECANIZADA GERAL',unit:'m²',quantity:'0.333333',
 unit_cost:'1.8100',reference_month:'2026-07',regime:'Sem desoneração',composition_reviewed:true,quantity_verified:true,reference_price_id:'00000000-0000-4000-8000-000000000001'}];
 const r=estimateBudget(x);
 assert.equal(r.direct_cost_reais,0.6);
 assert.equal(r.total_reais,0.6);
 assert.equal(r.ready,true);
});
test('Data-base SIURB divergente e custo unitário inválido bloqueiam',()=>{
 const x=base();x.items[0]={...x.items[0],source:'SIURB',reference_month:'2025-07',regime:'Com desoneração',unit_cost:-5};
 const r=estimateBudget(x);
 assert.equal(r.ready,false);
 assert.ok(r.errors.some(e=>e.code==='REFERENCE_MISMATCH'));
 assert.ok(r.errors.some(e=>e.code==='INVALID_ITEM'));
});
test('Revisão técnica e BDI não podem ser marcados como concluídos automaticamente',()=>{
 const x=base();x.bdi_reviewed=false;x.technical_reviewed=false;x.commercial_reviewed=false;
 const r=estimateBudget(x);
 assert.equal(r.ready,false);
 assert.ok(r.errors.length>=3);
});
test('Duplicação explícita de insumos diretos é bloqueada',()=>{
 const x=base();x.extra_direct_costs=[{description:'Frete SIURB já incluso',amount:20,included_in_unit_prices:true}];
 const r=estimateBudget(x);
 assert.equal(r.ready,false);
 assert.ok(r.errors.some(e=>e.code==='DUPLICATION'));
});
test('Perdas, frete e serviços extras são aplicados uma vez com centavos exatos',()=> {
 const input=base();input.items[0].quantity='3';input.items[0].unit_cost='100.0000';
 input.items[0].loss_pct='10';input.items[0].freight_unit_cost='2.5000';
 input.items[0].other_unit_cost='1.2500';
 const result=estimateBudget(input);
 assert.equal(result.direct_cost_reais,341.25);
 assert.equal(result.ready,true);
});
test('Cotação manual sem comprovante bloqueia orçamento',()=>{
 const x=base();x.items[0].supplier_quote_verified=false;
 const r=estimateBudget(x);
 assert.equal(r.ready,false);
 assert.ok(r.errors.some(e=>e.code==='UNQUOTED'));
});
test('Preço declarado como SIURB sem identificação oficial bloqueia',()=>{
 const x=base();x.items[0].source='SIURB';
 x.items[0].reference_month='2026-07';x.items[0].regime='Sem desoneração';x.items[0].composition_reviewed=true;
 const r=estimateBudget(x);
 assert.equal(r.ready,false);
 assert.ok(r.errors.some(e=>e.code==='NO_OFFICIAL_PRICE'));
});
test('Alíquota agregada de 100% é rejeitada sem cálculos infinitos',()=>{
 const x=base();x.bdi.tributosSobreReceita=100;
 const r=estimateBudget(x);
 assert.equal(r.ready,false);
 assert.ok(r.errors.some(e=>e.code==='BDI_TAX'));
});

test('SIURB: custo não conciliado dos insumos bloqueia liberação mesmo com assinatura de BDI',()=>{
 const input=base();
 input.items=[{code:'1001001',source:'SIURB',description:'Serviço oficial',unit:'M2',
  quantity:'10',unit_cost:'1.8100',reference_month:'2026-07',regime:'Sem desoneração',
  composition_reviewed:true,composition_available:true,quantity_verified:true,
  reference_price_id:'00000000-0000-4000-8000-000000000001',auxiliaries_unexpanded:true}];
 const r=estimateBudget(input);
 assert.equal(r.ready,false);
 assert.ok(r.errors.some(e=>e.code==='SIURB_INPUTS_UNPRICED'));
 assert.equal(r.direct_cost_reais,18.10);
});
