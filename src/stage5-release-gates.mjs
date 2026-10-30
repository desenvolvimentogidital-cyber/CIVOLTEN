/* Etapa 5 — bloqueios de lançamento. Não infere aprovação de matemática
 * nem usa um flag de frontend como autorização comercial.
 */
export const requiredTables=Object.freeze([
 'app_users','app_sessions','budgets','budget_items','proposals','audit_events',
 'budget_costing_profiles','budget_item_cost_reviews','budget_extra_direct_costs',
 'reference_prices','reference_composition_details','crews','crew_roles',
 'schedule_tasks','task_dependencies','schedule_progress_measurements',
 'proposal_draft_snapshots','budget_actual_costs','budget_cash_receipts',
 'budget_completion_forecasts','deployment_environment_guards'
]);
export const requiredColumns=Object.freeze([
 ['budgets','lock_version'],['crews','archived_at'],
 ['schedule_tasks','archived_at'],['proposal_draft_snapshots','snapshot_sha256'],
 ['budget_actual_costs','reviewed_by'],['budget_cash_receipts','reviewed_by'],
 ['budget_completion_forecasts','reviewed_by'],
 ['schedule_progress_measurements','review_status']
]);
export function validateSchema({tables=[],columns=[]}={}){
 const found=new Set(tables.map(x=>typeof x==='string'?x:x.table_name));
 const keyed=new Set(columns.map(x=>typeof x==='string'?x:x.table_name+'.'+x.column_name));
 const missingTables=requiredTables.filter(x=>!found.has(x));
 const missingColumns=requiredColumns.filter(([table,column])=>!keyed.has(table+'.'+column))
  .map(x=>x.join('.'));
 return {ready:!missingTables.length&&!missingColumns.length,
  missing_tables:missingTables,missing_columns:missingColumns};
}
const gates=Object.freeze([
 {key:'ci_green',label:'CI no commit exato passou'},
 {key:'schema_ready',label:'Migrações 0010–0013 conferidas no destino'},
 {key:'backup_restored',label:'Backup recente e restauração verificada'},
 {key:'preview_db_isolated',label:'Prévia isolada do banco de produção'},
 {key:'vercel_build_available',label:'Publicação autorizada no plano gratuito'},
 {key:'authenticated_browser_smoke',label:'Celular e desktop autenticados homologados'},
 {key:'siurb_costs_reconciled',label:'Itens, insumos SIURB e cotações reconciliados'},
 {key:'tax_and_bdi_approved',label:'Tributação, BDI e regime revisados por responsável'},
 {key:'contract_terms_approved',label:'Escopo, prazo, pagamento e exclusões validados'},
 {key:'authorized_customer_acceptance',label:'Identidade, consentimento e prova de aceite definidos'},
 {key:'production_release_approved',label:'Responsável autorizou liberação da versão'}
]);
export function evaluateReleaseGates(evidence={}){
 const checks=gates.map(({key,label})=>{
  const raw=evidence?.[key];
  const accepted=raw&&raw.passed===true&&typeof raw.reference==='string'&&raw.reference.trim().length>=6;
  return {key,label,passed:!!accepted,
   reference:accepted?raw.reference.trim():null};
 });
 return {production_ready:false,release_evidence_complete:checks.every(x=>x.passed),commercial_release:false,
  failed:checks.filter(x=>!x.passed),checks,
  note:'Checklist documental apenas. Mesmo todas as evidências preenchidas não autorizam emissão: homologação jurídica/tributária e assinatura exigem fluxos externos verificáveis.'};
}
