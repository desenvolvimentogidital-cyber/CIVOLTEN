import test from 'node:test';
import assert from 'node:assert/strict';
import {financePage,financeDialog} from '../public/secure-finance.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
const fixture=()=>({
 user:{role:'administrador'},detail:{id:'00000000-0000-4000-8000-000000000001'},
 finance:{
  summary:{budget:{id:'b',code:'QA-2026',status:'rascunho',lock_version:2},
   estimate:{errors:[{message:'Tributos precisam de revisão humana'}]},
   actuals:{validated_reais:100,pending_reais:50},
   comparison:{budget_sell_reais:1200,budget_direct_reais:800,budget_contribution_reais:400},
   note:'Lucro líquido não determinado'},
  drafts:{drafts:[{id:'00000000-0000-4000-8000-000000000002',version:1,created_at:'2026-10-29',
    stale:false,snapshot_sha256:'a'.repeat(64)}]},
  actuals:{costs:[{id:'00000000-0000-4000-8000-000000000003',description:'Material fictício',
    amount:50,incurred_on:'2026-10-28',evidence_ref:'NOTA-QA-TESTE',
    status:'pendente'}]}
 }});
test('Etapa 4: painel exibe rascunhos, custos e impede chamar contribuição de lucro líquido',()=>{
 const page=financePage({state:fixture(),esc,writeable:()=>true});
 for(const action of ['finance-create-draft','finance-add-actual','finance-open-draft','finance-review-actual'])
  assert.ok(page.includes('data-action="'+action+'"'),action);
 assert.ok(page.includes('Não determinado'));
 assert.ok(page.includes('não significa lucro líquido'));
 assert.ok(page.includes('Tributos precisam de revisão humana'));
});
test('Etapa 4: consulta não pode ver botões de alteração/revisão',()=>{
 const st=fixture();st.user.role='consulta';
 const page=financePage({state:st,esc,writeable:()=>false});
 for(const action of ['finance-create-draft','finance-add-actual','finance-review-actual'])
  assert.equal(page.includes('data-action="'+action+'"'),false);
 assert.ok(page.includes('finance-open-draft'));
});
test('Etapa 4: detalhes de proposta oferecem PDF marcado RASCUNHO',()=>{
 const st=fixture();st.financeDraft={id:'00000000-0000-4000-8000-000000000002',
   version:1,stale:false,snapshot_sha256:'a'.repeat(64),
   snapshot:{client:{name:'Teste'},project:{title:'Obra QA'},
    scope:'Pintura de ambiente fictício',exclusions:'Extra não incluído',payment_terms:'Condicional',
    items:[{name:'Piso',quantity:'10',unit:'M2'}],costs:{total_reais:500}}};
 let markup=null;
 const dialog=(title,body)=>{markup=body};
 assert.equal(financeDialog('finance-view-draft',{state:st,dialog,esc}),true);
 assert.ok(markup.includes('RASCUNHO'));
 assert.ok(markup.includes('/proposal-drafts/00000000-0000-4000-8000-000000000002/pdf'));
});
