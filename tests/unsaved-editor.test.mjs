import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const start=app.indexOf('function hasUnsavedEditor(){');
const end=app.indexOf('function budgetValidation(forPdf=false){');
assert.ok(start>=0&&end>start);
const helper=app.slice(start,end);

function fakeEditor(view){
 const draft={title:'Obra registrada',days:2};
 const contractDraft={title:'Contrato de prestação',status:'rascunho'};
 const state={
  view,
  draft:structuredClone(draft),
  budgetSavedSnapshot:JSON.stringify(draft),
  contractDraft:structuredClone(contractDraft),
  contractSavedSnapshot:JSON.stringify(contractDraft)
 };
 const messages=[],ctx={state,window:{confirm:message=>{
  messages.push(message);
  return false;
 }}};
 vm.runInNewContext(helper,ctx);
 return {...ctx,messages};
}

test('nenhuma confirmação desnecessária para orçamento ou contrato inalterado',()=>{
 for(const view of ['editor','contract-editor','home']){
  const ctx=fakeEditor(view);
  assert.equal(vm.runInNewContext('hasUnsavedEditor()',ctx),false);
  assert.equal(vm.runInNewContext('confirmLeaveEditor()',ctx),true);
  assert.equal(ctx.messages.length,0);
 }
});

test('alterações de orçamento pedem confirmação e Cancelar preserva os dados',()=>{
 const ctx=fakeEditor('editor');
 ctx.state.draft.title='Obra modificada';
 assert.equal(vm.runInNewContext('hasUnsavedEditor()',ctx),true);
 assert.equal(vm.runInNewContext('confirmLeaveEditor()',ctx),false);
 assert.equal(ctx.state.draft.title,'Obra modificada');
 assert.match(ctx.messages[0],/alterações não salvas/);
});

test('alterações de contratos também são protegidas',()=>{
 const ctx=fakeEditor('contract-editor');
 ctx.state.contractDraft.status='emitido';
 assert.equal(vm.runInNewContext('hasUnsavedEditor()',ctx),true);
 assert.equal(vm.runInNewContext('confirmLeaveEditor()',ctx),false);
 assert.equal(ctx.messages.length,1);
 ctx.window.confirm=()=>true;
 assert.equal(vm.runInNewContext('confirmLeaveEditor()',ctx),true);
});

test('navegação, login e salvamento mantêm guardas e snapshots atualizados',()=>{
 assert.match(app,/if\(tab\.dataset\.view!==state\.view&&!confirmLeaveEditor\(\)\)return/);
 assert.match(app,/async function logout\(\)\{\s*if\(!confirmLeaveEditor\(\)\)return/);
 assert.match(app,/state\.budgetSavedSnapshot=JSON\.stringify\(state\.draft\)/);
 assert.match(app,/state\.contractSavedSnapshot=JSON\.stringify\(state\.contractDraft\)/);
 assert.match(app,/state\.budgetSavedSnapshot=null;state\.view='budgets'/);
});
