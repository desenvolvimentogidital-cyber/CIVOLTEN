/* Required professions for the services already saved in a budget.
 * Reference composition (SIURB) is the source, NOT invented workers, payroll
 * or user-entered placeholder rates. Read-only, safe for the costing team.
 */
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const roleCode=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{2,40}$/.test(x);
const finitePositive=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>0;
const reviewed=new Set(['revisado','aprovado','validado']);
const round3=n=>Math.round(n*1000)/1000;
export function assembleBudgetProfessionRequirements(items=[],headcount=[]){
 const professions=new Map(),issues=[];
 const staff=new Map((headcount||[]).map(r=>[String(r.role_code),Number(r.active_workers)||0]));
 let missingComposition=0,pendingProductivity=0,servicesWithoutRoles=0;
 for(const [idx,item] of (items||[]).entries()){
  const label=String(item.source_name||item.source_code||idx+1).slice(0,180);
  if(!item.reference_price_id||item.source_matches_budget!==true){
   missingComposition++;issues.push('Serviço '+label+': tabela SIURB de referência ou regime incompatível');
   continue;
  }
  const entries=Array.isArray(item.labor)?item.labor:[];
  if(!entries.length){missingComposition++;issues.push('Serviço '+label+': composição de mão de obra direta indisponível');continue}
  const validReview=reviewed.has(String(item.labor_review_state||'').toLowerCase())&&
    finitePositive(item.direct_labor_hh_unit);
  if(!validReview){pendingProductivity++;issues.push('Serviço '+label+': produtividade ainda não revisada')}
  let found=false;
  for(const entry of entries){
   if(String(entry.unit||'').toUpperCase()!=='H')continue;
   if(!roleCode(entry.code)||!finitePositive(entry.coef)){
    issues.push('Serviço '+label+': código ou coeficiente da profissão inválido');continue;
   }
   found=true;
   const code=String(entry.code),name=String(entry.name||'').trim().slice(0,140)||code;
   const old=professions.get(code)||{code,name,services:0,estimated_hh:0,
    hours_estimate_verified:true,active_workers:staff.get(code)||0};
   old.services++;
   if(validReview&&finitePositive(item.quantity))
    old.estimated_hh+=Number(item.quantity)*Number(entry.coef);
   else old.hours_estimate_verified=false;
   professions.set(code,old);
  }
  if(!found){servicesWithoutRoles++;issues.push('Serviço '+label+': nenhuma profissão horista/mensalista identificada')}
 }
 const roles=[...professions.values()].map(x=>({...x,estimated_hh:x.hours_estimate_verified?round3(x.estimated_hh):null,
  staffed:x.active_workers>0})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.code.localeCompare(b.code));
 const missingStaff=roles.filter(x=>!x.staffed).length;
 if(!roles.length&&items.length)issues.push('Nenhuma profissão SIURB pronta para cadastro; conferir composições');
 if(missingStaff)issues.push('Há '+missingStaff+' profissão(ões) sem funcionários ativos da CIVOLTEN');
 return {professions:roles,summary:{services:items.length,required_professions:roles.length,
   missing_active_professions:missingStaff,items_without_composition:missingComposition,
   items_without_valid_roles:servicesWithoutRoles,services_pending_productivity_review:pendingProductivity},
  issues,staffing_complete:roles.length>0&&missingStaff===0&&missingComposition===0&&servicesWithoutRoles===0,
  productivity_approved:false,commercial_release:false,
  notice:'Cadastro guiado pelas funções da composição SIURB. Não cria funcionários fictícios, não presume salário, não vincula nominalmente colaboradores à obra e não autoriza execução.'};
}
export async function handleBudgetRequiredProfessions({req,res,sql,user,parts,method,send}){
 if(parts[0]!=='budgets'||parts[2]!=='required-professions')return false;
 const done=(status,data)=>{send(res,status,data);return true};
 if(parts.length!==3||!uuid(parts[1]))return done(400,{error:'Orçamento inválido'});
 if(method!=='GET')return done(405,{error:'Consulta de profissões somente leitura'});
 if(!['administrador','orcamentista'].includes(user?.role))
  return done(403,{error:'Consulta de pessoal reservada à equipe interna autorizada'});
 const budget=(await sql.query('SELECT id,code,status,reference_month,regime FROM budgets WHERE id=$1 LIMIT 1',[parts[1]]))[0];
 if(!budget)return done(404,{error:'Orçamento não encontrado'});
 const [items,headcount]=await Promise.all([
  sql.query(`SELECT i.id,i.position,i.source_name,i.source_code,i.quantity,i.reference_price_id,
   i.direct_labor_hh_unit,i.labor_review_state,d.labor,
   (v.source='SIURB' AND v.reference_month=b.reference_month AND v.regime=b.regime) AS source_matches_budget
   FROM budget_items i JOIN budgets b ON b.id=i.budget_id
   LEFT JOIN reference_prices p ON p.id=i.reference_price_id
   LEFT JOIN reference_price_versions v ON v.id=p.version_id
   LEFT JOIN reference_composition_details d ON d.reference_price_id=i.reference_price_id
   WHERE i.budget_id=$1 AND i.deleted_at IS NULL ORDER BY i.position,i.id LIMIT 501`,[parts[1]]),
  sql.query('SELECT role_code,count(*)::int AS active_workers FROM company_workers WHERE active=true GROUP BY role_code',[])
 ]);
 if(items.length>500)return done(409,{error:'Número de serviços excede limite seguro de análise de profissões'});
 return done(200,{budget:{id:budget.id,code:budget.code,status:budget.status,
  reference_month:budget.reference_month,regime:budget.regime},
  ...assembleBudgetProfessionRequirements(items,headcount)});
}
