import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareProposalScope,proposalModes} from '../src/proposal-scope-mode.mjs';
import {renderProposalDraftPdf} from '../src/proposal-draft-pdf.mjs';

const items=[{id:'i1',source_code:'4001070',source_name:'Alvenaria',unit:'M2',
 quantity:'10',direct_unit_cost:'50.0000'}];
const costing={estimate:{ready:true,total_reais:650,direct_cost_reais:500,errors:[]}};
const staff={costs:{labor_estimated:275},roles:[
 {code:'2020',name:'Pedreiro',hourly_cost:'30'},
 {code:'2099',name:'Servente',hourly_cost:'20'}],
 services:[{item_id:'i1',reviewed:true,workers:2,
  roles:[{code:'2020',name:'Pedreiro',projected_hh:5},
   {code:'2099',name:'Servente',projected_hh:6}]}]};
test('preço de serviço completo SIURB já contém mão de obra e materiais, sem multiplicar por duas modalidades',()=>{
 const model=prepareProposalScope(proposalModes.full,{budgetItems:items,costing});
 assert.equal(model.items[0].unit_cost,'50.0000');
 assert.equal(model.price_final_reais,650);
 assert.equal(model.excludes_materials,false);
 assert.equal(model.commercial_release,false);
});
test('somente mão de obra usa h-h revisadas e custo-hora real, nunca preço completo SIURB',()=>{
 const model=prepareProposalScope(proposalModes.labor,{budgetItems:items,costing,workforce:staff});
 assert.equal(model.labor_cost_reference_reais,270);
 assert.equal(model.items[0].estimated_labor_cost_reais,270);
 assert.equal(model.items[0].unit_cost,null);
 assert.equal(model.price_final_reais,null);
 assert.equal(model.excludes_materials,true);
 assert.equal(model.commercial_release,false);
 assert.equal(model.complete,true);
});
test('nenhum salário, produtividade ou função faltante vira zero ou preço válido',()=>{
 for(const altered of [
  {...staff,roles:[]},
  {...staff,services:[{...staff.services[0],reviewed:false}]},
  {...staff,services:[{...staff.services[0],roles:[]}]},
  null
 ]){
  const model=prepareProposalScope(proposalModes.labor,{budgetItems:items,costing,workforce:altered});
  assert.equal(model.labor_cost_reference_reais,null);
  assert.equal(model.items[0].unit_cost,null);
  assert.equal(model.complete,false);
  assert.ok(model.issues.length);
 }
});
test('modalidade desconhecida é recusada',()=>{
 assert.throws(()=>prepareProposalScope('material-only',{budgetItems:items,costing}),/Escolha/);
});
test('PDF de mão de obra exclui preços SIURB e informa não emissão',async()=>{
 const scope=prepareProposalScope(proposalModes.labor,{budgetItems:items,costing,workforce:staff});
 const pdf=await renderProposalDraftPdf({
  issued:false,commercial_release:false,proposal_mode:scope.mode,scope_pricing:scope,
  budget:{code:'OR-REAL',lock_version:1},client:{name:'Cliente'},
  project:{title:'Projeto'},
  items:scope.items,costs:{direct_reais:270,bdi_reais:null,total_reais:null,
   blocking_errors:[{message:'BDI não aprovado'}]},
  scope:'Execução apenas de mão de obra',payment_terms:'A definir',
  exclusions:'Materiais não inclusos',validity_days:30
 },{version:1,sha256:'f'.repeat(64)});
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const html=readFileSync(new URL('../public/secure-finance.js',import.meta.url),'utf8');
 assert.match(html,/somente_mao_de_obra/);
 assert.match(html,/Mão de obra \+ materiais/);
 assert.match(html,/select name="proposal_mode"/);
});
