import test from 'node:test';
import assert from 'node:assert/strict';
import {financePage,financeDialog} from '../public/secure-finance.js';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fixture=()=>({user:{id:'admin',role:'administrador'},
 detail:{id:'00000000-0000-4000-8000-000000000100'},
 finance:{
  summary:{budget:{status:'rascunho',code:'QA4-CLOSE',lock_version:4},
   estimate:{errors:[{message:'BDI depende de conferência'}]},
   actuals:{validated_reais:200,pending_reais:50},
   comparison:{budget_sell_reais:1000,budget_direct_reais:700,budget_contribution_reais:300},
   note:'Não é lucro líquido'},
  drafts:{drafts:[]},actuals:{costs:[]},
  closeout:{metrics:{receipt_validated_reais:500,receipt_pending_reais:100,
   approved_remaining_cost_reais:400,projected_cost_at_completion_reais:600,
   hypothetical_contribution_at_estimated_price_reais:400},
   needs_forecast_refresh:false},
  receipts:{records:[{id:'r1',payer_name:'Pagador fictício',amount:'500',received_on:'2026-10-28',
   evidence_ref:'REC-QA-500',status:'pendente',created_by:'writer'}]},
  forecasts:{records:[{id:'f1',as_of:'2026-10-28',expected_remaining_cost:'400',
   evidence_ref:'ETC-QA-400',status:'pendente',created_by:'writer'}]},
  readiness:{ready:false,reasons:['Emissão e aceite sem homologação']}}});
test('painel da Etapa 4 mostra pagamentos, custo restante e emissão bloqueada',()=>{
 const html=financePage({state:fixture(),esc:e,writeable:()=>true});
 for(const action of ['finance-add-receipt','finance-add-forecast','finance-review-receipt','finance-review-forecast'])
  assert.ok(html.includes('data-action="'+action+'"'),action);
 assert.ok(html.includes('Recebimentos validados'));
 assert.ok(html.includes('Contribuição hipotética'));
 assert.ok(html.includes('Emissão, envio, assinatura e aceite bloqueados'));
 assert.ok(html.includes('REC-QA-500'));
});
test('perfil consulta não vê botões de alteração nem revisão',()=>{
 const x=fixture();x.user.role='consulta';
 const html=financePage({state:x,esc:e,writeable:()=>false});
 for(const action of ['finance-add-receipt','finance-add-forecast',
   'finance-review-receipt','finance-review-forecast'])
  assert.ok(!html.includes('data-action="'+action+'"'),action);
});
test('diálogos possuem formulários de comprovação e aprovação independente',()=>{
 const x=fixture(),parts=[];
 const dialog=(title,body)=>parts.push(body);
 const ctx={state:x,dialog,esc:e};
 assert.equal(financeDialog('finance-add-receipt',ctx),true);
 assert.equal(financeDialog('finance-add-forecast',ctx),true);
 x.financeSelected='r1';assert.equal(financeDialog('finance-review-receipt',ctx),true);
 x.financeSelected='f1';assert.equal(financeDialog('finance-review-forecast',ctx),true);
 for(const id of ['finance-receipt-form','finance-forecast-form',
  'finance-receipt-review-form','finance-forecast-review-form'])
  assert.ok(parts.some(t=>t.includes(id)),id);
});
