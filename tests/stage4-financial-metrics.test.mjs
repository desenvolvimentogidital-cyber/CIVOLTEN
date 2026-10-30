import test from 'node:test';
import assert from 'node:assert/strict';
import {financialProgress} from '../src/stage4-financial-metrics.mjs';
test('Etapa 4: fechamento em centavos e lucro real nulo sem contrato validado',()=>{
 const r=financialProgress({budgetDirect:'1000.00',indicativePrice:'1300.00',
  actualCosts:[{status:'validado',amount:'200.50'},{status:'pendente',amount:'80.00'},
   {status:'rejeitado',amount:'999.99'}],
  receipts:[{status:'validado',amount:'500.00'},{status:'pendente',amount:'50.00'}],
  forecasts:[{id:'f1',expected_remaining_cost:'600.00',status:'validado',
    created_at:'2026-10-28T00:00:00Z',reviewed_at:'2026-10-28T05:00:00Z'}]});
 assert.equal(r.actual_cost_validated_reais,200.5);
 assert.equal(r.receipt_validated_reais,500);
 assert.equal(r.actual_cost_pending_reais,80);
 assert.equal(r.projected_cost_at_completion_reais,800.5);
 assert.equal(r.hypothetical_contribution_at_estimated_price_reais,499.5);
 assert.equal(r.observed_receipts_less_incurred_costs_reais,299.5);
 assert.equal(r.actual_net_profit_reais,null);
 assert.equal(r.contract_accepted,false);
 assert.equal(r.budget_cost_consumed_pct,20.05);
});
test('Etapa 4: sem previsões aprovadas não inventa margem de conclusão',()=>{
 const r=financialProgress({budgetDirect:'100',indicativePrice:'200',
  actualCosts:[],receipts:[],forecasts:[{status:'pendente',expected_remaining_cost:'50'}]});
 assert.equal(r.approved_remaining_cost_reais,null);
 assert.equal(r.projected_cost_at_completion_reais,null);
 assert.equal(r.hypothetical_contribution_at_estimated_price_reais,null);
 assert.equal(r.actual_net_profit_margin_pct,null);
});
test('Etapa 4: resultado negativo, arredondamentos e versões independentes',()=>{
 const r=financialProgress({budgetDirect:'100',indicativePrice:'100',
  actualCosts:[{status:'validado',amount:'87.11'},{status:'validado',amount:'12.13'}],
  receipts:[{status:'validado',amount:'3.27'}],
  forecasts:[{status:'validado',id:'old',expected_remaining_cost:'100',
    reviewed_at:'2026-10-01T10:00:00Z'},
    {status:'validado',id:'new',expected_remaining_cost:'10.01',
    reviewed_at:'2026-10-02T10:00:00Z'}]});
 assert.equal(r.actual_cost_validated_reais,99.24);
 assert.equal(r.observed_receipts_less_incurred_costs_reais,-95.97);
 assert.equal(r.projected_cost_at_completion_reais,109.25);
 assert.equal(r.hypothetical_contribution_at_estimated_price_reais,-9.25);
 assert.equal(r.latest_forecast_id,'new');
});
