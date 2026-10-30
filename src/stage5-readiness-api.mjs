/* CIVOLTEN Etapa 5 — diagnóstico autenticado e somente leitura.
 * Não vaza credenciais, clientes, valores de produção ou identidade pessoal.
 * Somente admin. O retorno NUNCA é assinatura de aprovação comercial.
 */
import {validateSchema,evaluateReleaseGates} from './stage5-release-gates.mjs';
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
   (SELECT count(*)::int FROM proposal_draft_snapshots) AS proposal_drafts`,[])
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
 return done(200,{schema,
  gates,
  operational:{
   account_setup:accountSetup,
   budget_records:Number(counts.budgets)||0,
   reference_price_records:Number(counts.reference_prices)||0,
   proposal_draft_records:Number(counts.proposal_drafts)||0,
   backup_automation_verified:false,
   browser_desktop_mobile_verified:false,
   note:'Contagens consultadas agora no banco; backup e login em dispositivos não são comprovados por esta consulta.'
  },
  application_mode:'homologacao',
  source:'read-only metadata',
  commercial_release:false,
  note:'Banco com esquema correto não equivale a CI, backup, navegador, custo SIURB, tributação, contrato e aceite homologados.'});
}
