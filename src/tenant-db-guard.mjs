/* CIVOLTEN multi-organization security prerequisite.
 * Do not call this a registration system: production must use a dedicated
 * PostgreSQL role WITHOUT BYPASSRLS, with FORCE RLS on every tenant-owned
 * table and transaction-local tenant context.
 *
 * Neon HTTP SQL transaction() sends all queries in the same transaction.
 * A bare SET and a following independent query are NOT safe with pooling.
 */
export const protectedTables=Object.freeze([
 'app_users','app_sessions','clients','projects','budgets','budget_items','budget_item_cost_reviews',
 'budget_costing_profiles','budget_extra_direct_costs',
 'budget_service_planning','budget_service_dependencies','company_workers',
 'company_labor_rates','company_overhead_config','company_pricing_config',
 'crews','crew_roles','schedule_tasks','schedule_progress_measurements',
 'task_dependencies','proposal_draft_snapshots','proposals',
 'budget_actual_costs','budget_cash_receipts','budget_completion_forecasts',
 'audit_events'
]);
const uuid=value=>typeof value==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function assessTenantRuntime({role,tablePolicies=[]}={}){
 const reasons=[];
 if(!role||role.rolsuper!==false||role.rolbypassrls!==false||role.rolcreaterole===true)
  reasons.push('A conexão PostgreSQL não pode ser superusuária ou BYPASSRLS');
 const byName=new Map(tablePolicies.map(x=>[x.table_name,x]));
 for(const name of protectedTables){
  const x=byName.get(name);
  if(!x?.rls_enabled||!x?.rls_forced||!x?.has_policy||
      (x.policy_count!==undefined&&Number(x.policy_count)!==1)||
      x.owned_by_runtime===true)
   reasons.push('RLS obrigatório ausente, permissivo ou incompleto em '+name);
 }
 return {ready:reasons.length===0,reasons};
}
export async function probeTenantRuntime(database){
 if(typeof database?.query!=='function'||typeof database?.transaction!=='function')
  return {ready:false,reasons:['Driver precisa de query() e transaction() com contexto local']};
 const [roles,policies]=await Promise.all([
  database.query('SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname=current_user'),
  database.query(`SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned_by_runtime,
    (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count,
    EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname
     AND p.policyname='tenant_only' AND p.cmd='ALL'
     AND p.qual LIKE '%organization_id%' AND p.qual LIKE '%civolten.organization_id%'
     AND p.with_check LIKE '%organization_id%' AND p.with_check LIKE '%civolten.organization_id%') AS has_policy
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')`)
 ]);
 return assessTenantRuntime({role:roles[0],tablePolicies:policies});
}
export function tenantScopedQueries(database,organizationId){
 if(!uuid(organizationId))throw Object.assign(new Error('Organização inválida'),{status:403});
 if(typeof database?.transaction!=='function'||typeof database?.query!=='function')
  throw Object.assign(new Error('Conexão sem transação de isolamento'),{status:503});
 return Object.freeze({
  organizationId,
  async query(statement,params=[]){
   if(typeof statement!=='string'||!statement.trim()||!Array.isArray(params))
    throw Object.assign(new Error('Consulta inválida'),{status:400});
   // No untrusted tenant ID is interpolated into SQL.
   // Neon query promises are lazy; transaction() executes both atomically.
   const [context,rows]=await database.transaction([
    database.query("SELECT set_config('civolten.organization_id',$1,true)",[organizationId]),
    database.query(statement,params)
   ]);
   if(!Array.isArray(rows))throw Error('Resposta inesperada do banco com isolamento');
   return rows;
  }
 });
}
