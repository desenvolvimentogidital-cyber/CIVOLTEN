/* CIVOLTEN Etapa 5 — diagnóstico autenticado e somente leitura.
 * Não vaza credenciais, clientes, valores de produção ou identidade pessoal.
 * Somente admin. O retorno NUNCA é assinatura de aprovação comercial.
 */
import {validateSchema,evaluateReleaseGates} from './stage5-release-gates.mjs';
import {summarizeSevenPhases} from './operational-phases.mjs';
export async function handleStage5Readiness({req,res,user,sql,parts,method,send}){
 if(parts[0]!=='release-readiness')return false;
 const done=(status,data)=>{send(res,status,data);return true};
 if(method!=='GET'||parts.length!==1)return done(405,{error:'Diagnóstico disponível somente por GET'});
 if(user.role!=='administrador')return done(403,{error:'Somente administrador consulta estado de homologação'});
 const [tables,columns,recordCounts]=await Promise.all([
  sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",[]),
  sql.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",[]),
  // Aggregated operational status only. No names, passwords, private amounts,
  // customer details or credentials are returned from this endpoint.
  sql.query(`SELECT
   (SELECT count(*)::int FROM app_users WHERE role='administrador' AND is_active=true) AS active_administrators,
   (SELECT count(*)::int FROM app_users WHERE role='administrador' AND is_active=true AND must_change_password=true) AS administrators_pending_password_change,
   (SELECT count(*)::int FROM budgets) AS budgets,
   (SELECT count(*)::int FROM reference_prices) AS reference_prices,
   (SELECT count(*)::int FROM reference_composition_details) AS reference_compositions,
   (SELECT count(*)::int FROM siurb_supplement_sources) AS siurb_supplement_source_records,
   (SELECT count(*)::int FROM siurb_supplement_prices) AS siurb_supplement_price_records,
   (SELECT count(*)::int FROM siurb_monthly_labor_sources) AS siurb_monthly_source_records,
   (SELECT count(*)::int FROM siurb_monthly_labor_prices) AS siurb_monthly_hourly_price_records,
   (SELECT count(*)::int FROM siurb_auxiliary_compositions) AS siurb_auxiliary_records,
   (SELECT count(*)::int FROM siurb_auxiliary_compositions WHERE arithmetically_reconciled) AS siurb_auxiliary_reconciled,
   (SELECT count(*)::int FROM siurb_auxiliary_compositions WHERE arithmetically_reconciled IS DISTINCT FROM TRUE) AS siurb_auxiliary_unreconciled,
   (SELECT count(*)::int FROM proposal_draft_snapshots) AS proposal_drafts,
   (SELECT count(*)::int FROM budget_items WHERE deleted_at IS NULL) AS active_budget_items,
   (SELECT count(*)::int FROM budget_items i
      LEFT JOIN budget_item_cost_reviews r ON r.budget_item_id=i.id
      WHERE i.deleted_at IS NULL
      AND (r.quantity_verified IS DISTINCT FROM TRUE OR r.composition_reviewed IS DISTINCT FROM TRUE)) AS items_pending_cost_review,
   (SELECT count(*)::int FROM budget_items WHERE deleted_at IS NULL
      AND (direct_labor_hh_unit IS NULL OR COALESCE(labor_review_state,'') NOT IN ('revisado','aprovado','validado'))) AS items_pending_productivity_review,
   (SELECT count(*)::int FROM budgets b LEFT JOIN budget_costing_profiles c ON c.budget_id=b.id
      WHERE b.status='rascunho'
      AND (c.bdi_reviewed IS DISTINCT FROM TRUE OR c.technical_reviewed IS DISTINCT FROM TRUE
        OR c.commercial_reviewed IS DISTINCT FROM TRUE)) AS budgets_pending_cost_approval,
   (SELECT count(*)::int FROM company_labor_rates) AS company_hourly_rates,
   (SELECT count(*)::int FROM company_overhead_config WHERE singleton=1) AS company_overhead_profiles,
   (SELECT count(*)::int FROM company_workers WHERE active=true) AS active_company_workers,
   (SELECT count(*)::int FROM proposals) AS issued_proposals`,[])
 ]);
 const schema=validateSchema({tables,columns});
 const evidence=schema.ready?{schema_ready:{passed:true,reference:'consulta interna information_schema'}}:{};
 const gates=evaluateReleaseGates(evidence);
 const counts=recordCounts[0]||{};
 const accountSetup={
  administrator_present:Number(counts.active_administrators)>0,
  administrator_password_change_pending:Number(counts.administrators_pending_password_change)>0,
  accounts_are_not_browser_tested:true
 };
 const totalItems=Number(counts.active_budget_items)||0;
 const pendingCost=Number(counts.items_pending_cost_review)||0;
 const pendingProductivity=Number(counts.items_pending_productivity_review)||0;
 const pendingBudgetApproval=Number(counts.budgets_pending_cost_approval)||0;
 // Read-only facts only. A configured value is not proof of a valid tax, salary or proposal.
 const sevenPhases=summarizeSevenPhases({schema,counts,account:accountSetup});
 const preparation=[
  {key:'administrator_password',label:'Trocar a senha temporária do administrador',
   complete:accountSetup.administrator_present&&!accountSetup.administrator_password_change_pending},
  {key:'budget_cost_reviews',label:'Conferir quantidade, custos e composições dos serviços',
   complete:totalItems>0&&pendingCost===0},
  {key:'productivity_reviews',label:'Revisar produtividade e horas-homem de todos os serviços',
   complete:totalItems>0&&pendingProductivity===0},
  {key:'budget_approvals',label:'Revisar BDI, tributos, margem e documentação dos orçamentos',
   complete:Number(counts.budgets)>0&&pendingBudgetApproval===0},
  {key:'company_hourly_rates',label:'Cadastrar custos-hora da equipe própria, quando utilizada',
   complete:Number(counts.company_hourly_rates)>0},
  {key:'company_overhead',label:'Cadastrar despesas fixas próprias, quando utilizadas',
   complete:Number(counts.company_overhead_profiles)>0},
  {key:'encrypted_backup',label:'Ativar backup cifrado periódico e testar restauração',
   complete:false},
  {key:'authenticated_devices',label:'Homologar login, orçamento e PDF em celular e desktop',
   complete:false},
  {key:'commercial_document_release',label:'Validar emissão, contratos e aceite comercial',
   complete:false}
 ];
 return done(200,{schema,
  gates,
  operational:{
   account_setup:accountSetup,
   phases:sevenPhases,
   all_seven_phases_approved:false,
   budget_records:Number(counts.budgets)||0,
   reference_price_records:Number(counts.reference_prices)||0,
   reference_composition_records:Number(counts.reference_compositions)||0,
   siurb_supplement_source_records:Number(counts.siurb_supplement_source_records)||0,
   siurb_supplement_price_records:Number(counts.siurb_supplement_price_records)||0,
   siurb_monthly_source_records:Number(counts.siurb_monthly_source_records)||0,
   siurb_monthly_hourly_price_records:Number(counts.siurb_monthly_hourly_price_records)||0,
   siurb_auxiliary_records:Number(counts.siurb_auxiliary_records)||0,
   siurb_auxiliary_reconciled:Number(counts.siurb_auxiliary_reconciled)||0,
   siurb_auxiliary_unreconciled:Number(counts.siurb_auxiliary_unreconciled)||0,
   proposal_draft_records:Number(counts.proposal_drafts)||0,
   active_budget_items:totalItems,
   items_pending_cost_review:pendingCost,
   items_pending_productivity_review:pendingProductivity,
   budgets_pending_cost_approval:pendingBudgetApproval,
   company_hourly_rates:Number(counts.company_hourly_rates)||0,
   company_overhead_profiles:Number(counts.company_overhead_profiles)||0,
   active_company_workers:Number(counts.active_company_workers)||0,
   issued_proposal_records:Number(counts.issued_proposals)||0,
   preparation,
   backup_automation_verified:false,
   browser_desktop_mobile_verified:false,
   note:'Contagens consultadas agora no banco; backup e login em dispositivos não são comprovados por esta consulta.'
  },
  application_mode:'homologacao',
  source:'read-only metadata',
  commercial_release:false,
  note:'Banco com esquema correto não equivale a CI, backup, navegador, custo SIURB, tributação, contrato e aceite homologados.'});
}
