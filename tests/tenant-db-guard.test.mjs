import test from 'node:test';
import assert from 'node:assert/strict';
import {protectedTables,assessTenantRuntime,tenantScopedQueries} from '../src/tenant-db-guard.mjs';
const organizationA='11111111-1111-4111-8111-111111111111';
const organizationB='22222222-2222-4222-8222-222222222222';
const fullPolicies=protectedTables.map(table_name=>({table_name,rls_enabled:true,rls_forced:true,has_policy:true}));
test('role Neon proprietário BYPASSRLS impossibilita cadastro multiempresa seguro',()=>{
 const x=assessTenantRuntime({role:{rolsuper:false,rolbypassrls:true},tablePolicies:fullPolicies});
 assert.equal(x.ready,false);
 assert.ok(x.reasons.some(s=>s.includes('BYPASSRLS')));
});
test('falha fechada se uma única tabela perder FORCE RLS ou política',()=>{
 const x=assessTenantRuntime({role:{rolsuper:false,rolbypassrls:false},
  tablePolicies:fullPolicies.map(r=>r.table_name==='budget_items'?{...r,rls_forced:false}:r)});
 assert.equal(x.ready,false);
 assert.ok(x.reasons.some(s=>s.includes('budget_items')));
 assert.equal(assessTenantRuntime({role:{rolsuper:false,rolbypassrls:false},tablePolicies:fullPolicies}).ready,true);
});
test('contexto por organização usa transação local, com parâmetros, sem variável global compartilhada',async()=>{
 const batches=[];
 const db={
  query(q,params=[]){return {q,params};},
  async transaction(queries){
   batches.push(queries);
   const context=queries[0].params[0];
   return [[{set_config:context}],[{organization_id:context,marker:queries[1].params[0]}]];
  }
 };
 const a=tenantScopedQueries(db,organizationA),b=tenantScopedQueries(db,organizationB);
 const [rowsA,rowsB]=await Promise.all([
  a.query('SELECT * FROM budgets WHERE id=$1',['A']),
  b.query('SELECT * FROM budgets WHERE id=$1',['B'])
 ]);
 assert.equal(rowsA[0].organization_id,organizationA);
 assert.equal(rowsB[0].organization_id,organizationB);
 assert.equal(batches.length,2);
 for(const batch of batches){
  assert.match(batch[0].q,/set_config/);
  assert.equal(batch[0].params.length,1);
  assert.equal(batch[1].q,'SELECT * FROM budgets WHERE id=$1');
 }
 assert.notEqual(batches[0][0].params[0],batches[1][0].params[0]);
});
test('não executa consultas sem organização válida ou transação de servidor',async()=>{
 assert.throws(()=>tenantScopedQueries({query(){}},organizationA),/transação/);
 assert.throws(()=>tenantScopedQueries({query(){},transaction(){}},'not-an-org'),/Organização inválida/);
 const client=tenantScopedQueries({query(){},async transaction(){return [[],[]]}},organizationA);
 await assert.rejects(()=>client.query('',[]),/Consulta inválida/);
});
