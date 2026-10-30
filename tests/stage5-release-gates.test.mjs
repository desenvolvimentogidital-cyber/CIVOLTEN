import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSchema,evaluateReleaseGates,requiredColumns,requiredTables}
 from '../src/stage5-release-gates.mjs';
const correct=()=>({
 tables:requiredTables.map(table_name=>({table_name})),
 columns:requiredColumns.map(([table_name,column_name])=>({table_name,column_name}))
});
test('Etapa 5: esquema completo QA contém todas as tabelas de custos e cronograma',()=>{
 const p=validateSchema(correct());
 assert.equal(p.ready,true);
 assert.deepEqual(p.missing_tables,[]);
 assert.deepEqual(p.missing_columns,[]);
});
test('Etapa 5: falta de migração ou soft archive impede prontidão',()=>{
 const p=correct();
 p.tables=p.tables.filter(x=>x.table_name!=='budget_cash_receipts');
 p.columns=p.columns.filter(x=>x.column_name!=='archived_at');
 const r=validateSchema(p);
 assert.equal(r.ready,false);
 assert.ok(r.missing_tables.includes('budget_cash_receipts'));
 assert.ok(r.missing_columns.includes('schedule_tasks.archived_at'));
});
test('Etapa 5: aprovação comercial requer evidência de CADA condição',()=>{
 const defaults=evaluateReleaseGates();
 assert.equal(defaults.production_ready,false);
 assert.equal(defaults.commercial_release,false);
 assert.ok(defaults.failed.length>=10);
 const partial=evaluateReleaseGates({
  schema_ready:{passed:true,reference:'Neon homologação 2026-10-30'},
  ci_green:{passed:true,reference:'Actions 40988315974'},
  tax_and_bdi_approved:{passed:false,reference:'não concluído'}
 });
 assert.equal(partial.production_ready,false);
 assert.ok(partial.failed.some(x=>x.key==='tax_and_bdi_approved'));
 assert.equal(partial.checks.find(x=>x.key==='schema_ready').passed,true);
});
test('Etapa 5: não aceitar boolean simples ou referência vazia como aprovação',()=>{
 const gates=evaluateReleaseGates({
  ci_green:true,
  schema_ready:{passed:true,reference:'  '},
  preview_db_isolated:{passed:true,reference:'verificado'}
 });
 assert.equal(gates.commercial_release,false);
 assert.equal(gates.checks.find(x=>x.key==='ci_green').passed,false);
 assert.equal(gates.checks.find(x=>x.key==='schema_ready').passed,false);
});

test('Etapa 5: checklist todo marcado ainda não pode emitir documento comercial',()=>{
 const every=Object.fromEntries(evaluateReleaseGates().checks.map(x=>[x.key,
   {passed:true,reference:'Apenas declaração fictícia sem homologação válida'}]));
 const r=evaluateReleaseGates(every);
 assert.equal(r.release_evidence_complete,true);
 assert.equal(r.production_ready,false);
 assert.equal(r.commercial_release,false);
});
