/* Sugestões de pessoal somente leitura, derivadas dos serviços salvos no orçamento. */
import {buildWorkforceEstimate} from './workforce-estimate.mjs';
import {summarizeWorkforce} from './workforce-costing.mjs';
import {readCompanyCosts} from './company-costs-api.mjs';
import {planResourceSchedule} from './budget-resource-scheduler.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export async function handleWorkforceEstimate({req,res,sql,user,parts,method,send}){
 const [resource,id,sub]=parts;
 if(resource!=='budgets'||sub!=='workforce-estimate')return false;
 const done=(status,data)=>{send(res,status,data);return true};
 if(method!=='GET'||parts.length!==3)return done(405,{error:'Estimativa disponível somente para consulta'});
 if(!uuid(id))return done(400,{error:'Orçamento inválido'});
 const q=new URL(req.url,'https://civolten-gj91.vercel.app').searchParams;
 const settings={target_days:q.get('target_days')??10,hours_day:q.get('hours_day')??8,
  efficiency_pct:q.get('efficiency_pct')??85,crew_size:q.get('crew_size')??4,
  available_workers:q.get('available_workers')??null};
 let check;
 try{check=buildWorkforceEstimate([],settings)}catch(e){if(e.status===400)return done(400,{error:e.message});throw e}
 const budgets=await sql.query("SELECT id,code,status,reference_month,regime,lock_version FROM budgets WHERE id=$1 LIMIT 1",[id]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 const budget=budgets[0];
 const items=await sql.query("SELECT bi.id,bi.position,bi.source_code,bi.source_name,bi.quantity,bi.unit,bi.reference_price_id,bi.direct_labor_hh_unit,bi.labor_review_state,p.workforce_hh_direct,d.direct_hh_per_unit,d.labor,CASE WHEN bi.reference_price_id IS NULL THEN TRUE WHEN v.source='SIURB' AND v.reference_month=b.reference_month AND v.regime=b.regime THEN TRUE ELSE FALSE END AS source_matches_budget FROM budget_items bi JOIN budgets b ON b.id=bi.budget_id LEFT JOIN reference_prices p ON p.id=bi.reference_price_id LEFT JOIN reference_price_versions v ON v.id=p.version_id LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id WHERE bi.budget_id=$1 AND bi.deleted_at IS NULL ORDER BY bi.position,bi.id LIMIT 500",[id]);
 const result=buildWorkforceEstimate(items,check.settings);
 const internal=['administrador','orcamentista'].includes(user?.role);
 const costs=internal?await readCompanyCosts(sql):{rates:[],workers:[],overhead:null};
 const management=summarizeWorkforce(result,costs);
 const [fronts,dependencies]=await Promise.all([
  sql.query('SELECT budget_item_id,work_front,wait_workdays FROM budget_service_planning WHERE budget_id=$1',[id]),
  sql.query('SELECT predecessor_item_id,successor_item_id,lag_workdays FROM budget_service_dependencies WHERE budget_id=$1',[id])
 ]);
 const resourceSchedule=planResourceSchedule(result.services,{
  available_workers:result.settings.available_workers,fronts,dependencies});
 const days=resourceSchedule.workdays;
 const dayCost=costs.overhead?Number(costs.overhead.monthly_overhead)/Number(costs.overhead.workdays_per_month):null;
 const laborCost=management.costs.labor_estimated;
 const productivityReviewed=result.services.length>0&&result.services.every(s=>s.reviewed===true);
 const planIsValidated=resourceSchedule.ready&&productivityReviewed;
 const totalPossible=planIsValidated&&days!==null&&dayCost!==null&&laborCost!==null;
 // Substituir soma sequencial simplista pelo rateio do cronograma com frentes e recursos.
 management.duration={...management.duration,
  sequential_workdays:days??management.duration.sequential_workdays,
  complete:planIsValidated,
  mode:'frentes_e_recursos',
  dependency_only_workdays:resourceSchedule.dependency_only_workdays};
 management.costs={...management.costs,
  overhead_sequential:dayCost===null||days===null?null:Math.round(dayCost*days*100)/100,
  total_sequential:totalPossible?Math.round((laborCost+dayCost*days)*100)/100:null,
  incomplete_scope:!planIsValidated,
  available:totalPossible};

 return done(200,{budget:{id:budget.id,code:budget.code,status:budget.status,
    reference_month:budget.reference_month,regime:budget.regime,lock_version:budget.lock_version},
   ...result,...management,resource_schedule:resourceSchedule,
   // Do not expose salary or company overhead to read-only users.
   costs:internal?management.costs:null,
   roles:internal?management.roles:management.roles.map(({hourly_cost,cost_source,estimated_cost,...role})=>role)});
}
