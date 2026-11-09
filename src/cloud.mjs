// CIVOLTEN: todos os cadastros são isolados por auth.uid() via RLS no Supabase.
// Este módulo não usa chave de administrador nem ignora políticas do banco.
import {fresh} from './calc.mjs';
import {payrollConfig} from './payroll.mjs';
import {companyConfig} from './pricing.mjs';
export const TABLES={
 fixed:'cv_fixed_costs_v1',
 variable:'cv_variable_costs_v1',
 employees:'cv_employees_v1',
 ledger:'cv_financial_entries_v1',
 budgets:'cv_budget_drafts_v1',
 catalog:'cv_service_catalog_v1',
 works:'cv_work_orders_v1',
 workLogs:'cv_work_logs_v1',
 measurements:'cv_measurements_v1',
 invites:'cv_proposal_invites_v1'
};
const normalize=(k,row)=>{
 if(k==='invites')return {id:row.id,budgetId:row.budget_id,token:row.token,
  budgetSnapshot:row.budget_snapshot,totalCents:Number(row.total_cents),
  validUntil:row.valid_until,status:row.status,
  respondentName:row.respondent_name||'',respondentEmail:row.respondent_email||'',
  declineReason:row.decline_reason||'',respondedAt:row.responded_at||null,
  createdAt:row.created_at};
 if(k==='works')return {id:row.id,budgetId:row.budget_id,customer:row.customer,
  project:row.project,contractRef:row.contract_ref,acceptanceRef:row.acceptance_ref,
  budgetSnapshot:row.budget_snapshot,pricedRows:row.priced_rows,
  contractValue:Number(row.contract_value),status:row.status,
  approvedOn:row.approved_on,startOn:row.start_on,finishOn:row.finish_on,
  createdAt:row.created_at};
 if(k==='workLogs')return {id:row.id,workOrderId:row.work_order_id,
  employeeId:row.employee_id,itemId:row.item_id,workDate:row.work_date,
  hours:Number(row.hours),qualificationConfirmed:row.qualification_confirmed,
  notes:row.notes||'',createdAt:row.created_at};
 if(k==='measurements')return {id:row.id,workOrderId:row.work_order_id,
  itemId:row.item_id,measuredOn:row.measured_on,quantity:Number(row.quantity),
  amount:Number(row.amount),status:row.status,approvedAt:row.approved_at,
  notes:row.notes||'',createdAt:row.created_at};
 if(k==='catalog')return {id:row.id,code:row.code,category:row.category,
  description:row.description,unit:row.unit,source:row.source,
  roles:Array.isArray(row.roles)?row.roles:[],directCost:row.direct_cost===null?null:Number(row.direct_cost),
  sinapiCode:row.sinapi_code||'',referenceMonth:row.reference_month||''};
 if(k==='fixed')return {id:row.id,name:row.name,category:row.category||'',
  amount:Number(row.amount),frequency:row.frequency};
 if(k==='variable')return {id:row.id,name:row.name,category:row.category||'',
  unit:row.unit,unitCost:Number(row.unit_cost),
  monthQty:row.month_qty===null?null:Number(row.month_qty)};
 if(k==='budgets')return {id:row.id,title:row.title,customer:row.customer,
  project:row.project||'',location:row.location||'',notes:row.notes||'',
  expiresOn:row.expires_on||null,items:row.items||[],pricing:row.pricing||null,
  commercial:row.commercial||{},
  status:'draft',demo:row.demo!==false,createdAt:row.created_at||null};
 if(k==='ledger')return {id:row.id,kind:row.kind,title:row.title,
  party:row.party||'',project:row.project||'',category:row.category||'',
  amount:Number(row.amount),dueDate:row.due_date,paidDate:row.paid_date,
  reference:row.reference||'',notes:row.notes||''};
 return {id:row.id,name:row.name,role:row.role,contractType:row.contract_type,
  active:row.active,salary:row.salary===null?null:Number(row.salary),
  hours:row.hours===null?null:Number(row.hours),
  fgtsPct:row.fgts_pct===null?null:Number(row.fgts_pct),
  employerPct:row.employer_pct===null?null:Number(row.employer_pct),
  benefits:Number(row.benefits||0),extras:Number(row.extras||0),
  rate:row.rate===null?null:Number(row.rate),rateUnit:row.rate_unit,
  quantity:row.quantity===null?null:Number(row.quantity)};
};
const payload=(k,item,userId)=>{
 const base={id:item.id,user_id:userId,updated_at:new Date().toISOString()};
 if(k==='invites')return {...base,budget_id:item.budgetId,token:item.token,
  budget_snapshot:item.budgetSnapshot,total_cents:item.totalCents,
  valid_until:item.validUntil,status:'pending'};
 if(k==='works')return {...base,budget_id:item.budgetId,customer:item.customer,
  project:item.project,contract_ref:item.contractRef,acceptance_ref:item.acceptanceRef,
  budget_snapshot:item.budgetSnapshot,priced_rows:item.pricedRows,
  contract_value:item.contractValue,status:item.status,approved_on:item.approvedOn,
  start_on:item.startOn||null,finish_on:item.finishOn||null};
 if(k==='workLogs')return {...base,work_order_id:item.workOrderId,
  item_id:item.itemId,employee_id:item.employeeId,work_date:item.workDate,
  hours:item.hours,qualification_confirmed:item.qualificationConfirmed===true,
  notes:item.notes||''};
 if(k==='measurements')return {...base,work_order_id:item.workOrderId,
  item_id:item.itemId,measured_on:item.measuredOn,
  quantity:item.quantity,amount:item.amount,status:item.status,
  approved_at:item.approvedAt||null,notes:item.notes||''};
 if(k==='catalog')return {...base,code:item.code,category:item.category,
  description:item.description,unit:item.unit,source:item.source,
  roles:item.roles||[],direct_cost:item.directCost,
  sinapi_code:item.sinapiCode||'',reference_month:item.referenceMonth||''};
 if(k==='fixed')return {...base,name:item.name,category:item.category,
  amount:item.amount,frequency:item.frequency};
 if(k==='variable')return {...base,name:item.name,category:item.category,
  unit:item.unit,unit_cost:item.unitCost,month_qty:item.monthQty};
 if(k==='budgets')return {...base,title:item.title,customer:item.customer,
  project:item.project||'',location:item.location||'',notes:item.notes||'',
  expires_on:item.expiresOn||null,items:item.items,pricing:item.pricing||null,
  commercial:item.commercial||{},
  status:'draft',demo:item.demo!==false};
 if(k==='ledger')return {...base,kind:item.kind,title:item.title,
  party:item.party||'',project:item.project||'',category:item.category||'',
  amount:item.amount,due_date:item.dueDate,paid_date:item.paidDate||null,
  reference:item.reference||'',notes:item.notes||''};
 if(k==='employees')return {...base,name:item.name,role:item.role,
  contract_type:item.contractType,active:item.active,salary:item.salary??null,
  hours:item.hours??null,fgts_pct:item.fgtsPct??null,
  employer_pct:item.employerPct??null,benefits:item.benefits??0,
  extras:item.extras??0,rate:item.rate??null,rate_unit:item.rateUnit??null,
  quantity:item.quantity??null};
 throw new Error('Cadastro inválido');
};
const checkId=userId=>{
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId||''))
  throw Error('Sessão inválida: identificador do usuário ausente.');
};
// Buscas em lotes por usuário, com ordenação estável e sem truncar 1000 registros.
async function fetchKind(client,userId,kind){
 const all=[],limit=500,maxRows=100000;
 for(let from=0;from<maxRows;from+=limit){
  const {data,error}=await client.from(TABLES[kind])
   .select('*').eq('user_id',userId)
   .order('created_at',{ascending:true}).order('id',{ascending:true})
   .range(from,from+limit-1);
  if(error)throw Error('Falha ao consultar '+kind+': '+error.message);
  const page=data||[];all.push(...page);
  if(page.length<limit)break;
  if(from+limit>=maxRows)throw Error('O cadastro de '+kind+' ultrapassa o limite de sincronização.');
 }
 return all.map(row=>normalize(kind,row));
}
// Após apontar HH, aprovar medição ou gerar recebível, não recarregar as 2617
// composições do catálogo nem as tabelas de custo para atualizar a tela.
export async function fetchOperationsRemote(client,userId,current){
 checkId(userId);
 const out={...current};
 await Promise.all(['works','workLogs','measurements','ledger','invites'].map(async kind=>{
  out[kind]=await fetchKind(client,userId,kind);
 }));
 return out;
}
export async function fetchInvitesRemote(client,userId){
 checkId(userId);
 return fetchKind(client,userId,'invites');
}
export async function revokeProposalRemote(client,userId,budgetId){
 checkId(userId);
 const {data,error}=await client.rpc('cv_proposal_revoke_v1',{p_budget_id:budgetId});
 if(error)throw Error('Não foi possível revogar o link: '+error.message);
 if(data!==true)throw Error('O banco não confirmou a revogação.');
 return true;
}
export async function fetchRemote(client,userId){
 checkId(userId);
 const out=fresh();
 await Promise.all(Object.keys(TABLES).map(async kind=>{
  out[kind]=await fetchKind(client,userId,kind);
 }));
 const {data:rates,error:ratesError}=await client.from('cv_payroll_settings_v1')
  .select('*').eq('user_id',userId).order('created_at',{ascending:true});
 if(ratesError)throw Error('Falha ao carregar encargos da empresa: '+ratesError.message);
 const one=rates?.[0];
 out.payroll=payrollConfig(one?{
  regime:one.regime,fgtsPct:Number(one.fgts_pct),
  employerPct:Number(one.employer_pct),ratPct:Number(one.rat_pct),
  terceirosPct:Number(one.terceiros_pct),reviewed:one.reviewed
 }:null);
 const {data:org,error:orgError}=await client.from('cv_company_settings_v1')
  .select('*').eq('user_id',userId).order('created_at',{ascending:true});
 if(orgError)throw Error('Falha ao carregar configurações da empresa: '+orgError.message);
 const a=org?.[0];
 out.company=companyConfig(a?{
  companyName:a.company_name,taxRegime:a.tax_regime,annex:a.annex,
  taxPct:Number(a.tax_pct),marginPct:Number(a.margin_pct),
  productiveDays:a.productive_days,hoursPerDay:Number(a.hours_per_day),
  productivePeople:a.productive_people,theme:a.theme,reviewed:a.reviewed
 }:null);
 return out;
}
export async function putRemote(client,userId,kind,item){
 checkId(userId);
 if(!TABLES[kind])throw Error('Tipo de cadastro inválido.');
 const row=payload(kind,item,userId);
 // Convites são apenas INSERT: impedir reaproveitamento do mesmo segredo ou edição de resposta.
 const query=kind==='invites'?client.from(TABLES[kind]).insert(row):
  client.from(TABLES[kind]).upsert(row,{onConflict:'id'});
 const {data,error}=await query.select('id').single();
 if(error)throw Error('Falha ao salvar no banco: '+error.message);
 if(!data?.id||data.id!==item.id)throw Error('Banco não confirmou o salvamento.');
 return item;
}
// Operação de medição -> contas a receber em transação atômica no Supabase.
// Nunca duplica receita ao tocar duas vezes em emitir cobrança.
export async function billMeasurementRemote(client,userId,measurementId,dueDate){
 checkId(userId);
 const {data,error}=await client.rpc('cv_bill_measurement_v1',{
  p_measurement_id:measurementId,p_due_date:dueDate
 });
 if(error)throw Error('Não foi possível gerar recebível: '+error.message);
 if(!data||typeof data!=='string')throw Error('Banco não confirmou o recebível.');
 return data;
}
// Importação em lote, sob a identidade autenticada do usuário (RLS).
// A lista é limitada aos custos; não altera funcionário, orçamento ou Financeiro.
export async function putCostPresetsRemote(client,userId,kind,items){
 checkId(userId);
 if(!['fixed','variable'].includes(kind))throw Error('Só custos podem ser importados.');
 if(!Array.isArray(items)||items.length>100)throw Error('Lote de custos inválido.');
 if(!items.length)return [];
 const rows=items.map(item=>payload(kind,item,userId));
 const {data,error}=await client.from(TABLES[kind]).upsert(rows,{onConflict:'id'}).select('id');
 if(error)throw Error('Não foi possível importar '+kind+': '+error.message);
 const written=new Set((data||[]).map(row=>row.id));
 if(written.size!==items.length||items.some(item=>!written.has(item.id)))
  throw Error('O Supabase não confirmou todos os custos importados.');
 return items;
}
// Persistencia em lotes por RLS: nao altera funcionarios, custos ou orcamentos.
export async function putCatalogBatchRemote(client,userId,items){
 checkId(userId);
 if(!Array.isArray(items)||items.length>100)throw Error('Lote do catalogo invalido.');
 if(!items.length)return [];
 const rows=items.map(item=>payload('catalog',item,userId));
 const {data,error}=await client.from(TABLES.catalog).upsert(rows,{onConflict:'id'}).select('id');
 if(error)throw Error('Falha na importacao do catalogo: '+error.message);
 const saved=new Set((data||[]).map(x=>x.id));
 if(saved.size!==items.length||items.some(item=>!saved.has(item.id)))
  throw Error('Supabase nao confirmou todos os servicos da importacao.');
 return items;
}
export async function deleteRemote(client,userId,kind,id){
 checkId(userId);
 if(!TABLES[kind])throw Error('Tipo de cadastro inválido.');
 const {data,error}=await client.from(TABLES[kind]).delete()
  .eq('id',id).eq('user_id',userId).select('id');
 if(error)throw Error('Falha ao excluir no banco: '+error.message);
 if(!Array.isArray(data)||data.length!==1)throw Error('Banco não confirmou a exclusão.');
 return true;
}

export async function putCompanyRemote(client,userId,config){
 checkId(userId);
 const c=companyConfig(config);
 const row={user_id:userId,company_name:c.companyName,tax_regime:c.taxRegime,
  annex:c.annex,tax_pct:c.taxPct,margin_pct:c.marginPct,
  productive_days:c.productiveDays,hours_per_day:c.hoursPerDay,
  productive_people:c.productivePeople,theme:c.theme,reviewed:c.reviewed,
  updated_at:new Date().toISOString()};
 const {data,error}=await client.from('cv_company_settings_v1')
  .upsert(row,{onConflict:'user_id'}).select('user_id').single();
 if(error)throw Error('Não foi possível salvar as configurações da empresa: '+error.message);
 if(data?.user_id!==userId)throw Error('O banco não confirmou as configurações da empresa.');
 return true;
}
export async function putPayrollRemote(client,userId,config){
 checkId(userId);
 const row={user_id:userId,regime:config.regime,
  fgts_pct:config.fgtsPct,employer_pct:config.employerPct,
  rat_pct:config.ratPct,terceiros_pct:config.terceirosPct,
  reviewed:true,updated_at:new Date().toISOString()};
 const {data,error}=await client.from('cv_payroll_settings_v1')
  .upsert(row,{onConflict:'user_id'}).select('user_id').single();
 if(error)throw Error('Não foi possível salvar os encargos: '+error.message);
 if(data?.user_id!==userId)throw Error('O banco não confirmou a configuração dos encargos.');
 return true;
}
