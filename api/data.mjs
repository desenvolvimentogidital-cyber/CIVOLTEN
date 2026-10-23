import {SUPABASE,KEY,json,sameOrigin,browserAllowed,readBody,cookieToken,authorized} from '../lib/civolten-security.mjs';
import {calculateBudget} from '../lib/civolten-calc.mjs';
import {sanitizeContract,validateContractForExport,validBrazilDocument} from '../lib/civolten-contract.mjs';
import {listRows} from '../lib/civolten-pages.mjs';
const models={
 settings:['cv_settings','workdays_month','billable_days_month','hours_day','tax_pct','margin_pct'],
 workers:['cv_workers','name','profession','daily_cents','charges_pct','days_month','cost_mode','active'],
 professions:['cv_professions','name'],
 fixed:['cv_fixed_costs','name','category','monthly_cents','active'],
 variable:['cv_variable_costs','name','category','unit','unit_cents'],
 budgets:['cv_budgets','title','customer','status','content'],
 cash:['cv_cash_entries','kind','amount_cents','description','category','occurred_on','budget_id'],
 contracts:['cv_contracts','title','counterparty','status','content','budget_id'],
 contract_profiles:['cv_contract_profiles','company_name','company_document','company_address','company_representative','company_phone','company_email','city']
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function existingContract(id,jwt){
 const endpoint=new URL(SUPABASE+'/rest/v1/cv_contracts');
 endpoint.searchParams.set('select','*');endpoint.searchParams.set('id','eq.'+id);
 const response=await fetch(endpoint,{headers:{apikey:KEY,Authorization:'Bearer '+jwt,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Não foi possível conferir a versão atual do contrato.');
 return (await response.json())[0]||null;
}
export default {async fetch(req){
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return json({error:'Método não permitido'},405);
 if(req.method==='GET'?!browserAllowed(req):!sameOrigin(req))return json({error:'Origem bloqueada'},403);
 const url=new URL(req.url),entity=url.searchParams.get('entity'),model=models[entity];
 if(!model)return json({error:'Recurso inválido'},400);
 const jwt=cookieToken(req);
 if(!await authorized(jwt))return json({error:'Sua sessão expirou. Entre novamente.'},401);
 const id=url.searchParams.get('id');
 if(['PATCH','DELETE'].includes(req.method)&&!uuid.test(id||''))return json({error:'ID inválido'},400);
 const dst=new URL(SUPABASE+'/rest/v1/'+model[0]);
 const headers={apikey:KEY,Authorization:'Bearer '+jwt,Accept:'application/json',Prefer:'return=representation'};
 let payload;
 try{
  if(req.method==='GET'){
   dst.searchParams.set('select','*');
   if(entity!=='settings')dst.searchParams.set('order',entity==='cash'?'occurred_on.desc,created_at.desc,id.desc':'created_at.desc,id.desc');
  }else if(req.method==='DELETE'){
   if(entity==='contracts'){
    const current=await existingContract(id,jwt);
    if(!current)throw Error('Contrato não encontrado ou sem permissão.');
    if(current.status!=='rascunho')throw Error('Contratos emitidos, assinados ou cancelados devem ser preservados no histórico.');
   }
   dst.searchParams.set('id','eq.'+id)
  }
  else{
   const body=await readBody(req,59000),b=body.record;
   if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Registro inválido');
   const data={};for(const k of model.slice(1))if(Object.prototype.hasOwnProperty.call(b,k))data[k]=b[k];
   if(entity==='cash'){
    if(req.method!=='POST')throw Error('Movimentações do caixa não podem ser editadas; exclua e registre novamente.');
    if(!['entrada','saida'].includes(data.kind))throw Error('Tipo de movimento inválido');
    if(!Number.isSafeInteger(data.amount_cents)||data.amount_cents<1||data.amount_cents>100000000000)
     throw Error('Informe valor válido acima de R$ 0,00');
    if(typeof data.description!=='string'||data.description.trim().length<2||data.description.length>140)
     throw Error('Informe a descrição do lançamento');
    if(typeof data.category!=='string'||!data.category.trim()||data.category.length>80)
     throw Error('Informe a categoria');
    if(typeof data.occurred_on!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data.occurred_on)
       ||Number.isNaN(new Date(data.occurred_on+'T12:00:00Z').getTime()))
     throw Error('Data inválida');
    if(data.budget_id!=null&&!uuid.test(data.budget_id))throw Error('Obra vinculada inválida');
   }
   if(entity==='contracts'){
    const existing=req.method==='PATCH'?await existingContract(id,jwt):null;
    if(req.method==='PATCH'&&!existing)throw Error('Contrato não encontrado ou sem permissão.');
    if(typeof data.title!=='string'||data.title.trim().length<3||data.title.length>180)throw Error('Informe o nome do contrato (até 180 caracteres).');
    if(!['rascunho','emitido','assinado','cancelado'].includes(data.status))throw Error('Situação do contrato inválida.');
    data.content=sanitizeContract(data.content);
    if(data.status==='emitido'||data.status==='assinado')validateContractForExport(data.content);
    if(req.method==='POST'&&data.status!=='rascunho')throw Error('Salve o contrato primeiro como rascunho.');
    if(existing){
     if(existing.status==='assinado'||existing.status==='cancelado')throw Error('Contrato finalizado: crie uma nova revisão.');
     if(existing.status==='rascunho'&&data.status==='assinado')throw Error('Emita o contrato antes de marcar como assinado.');
     if(existing.status==='emitido'){
      if(!['emitido','assinado','cancelado'].includes(data.status))throw Error('Transição de situação inválida.');
      const old=sanitizeContract(existing.content);
      if(JSON.stringify(old)!==JSON.stringify(data.content)||existing.title!==data.title||existing.counterparty!==data.content.counterparty_name||(existing.budget_id||null)!==(data.budget_id||null))
       throw Error('Contrato emitido não pode ser modificado. Crie uma nova revisão.');
     }
    }
    if(data.content.revision_of&&(!uuid.test(data.content.revision_of)||!data.content.revision_reason||data.content.revision_reason.length<5))throw Error('Informe a referência e o motivo da revisão.');
    data.counterparty=data.content.counterparty_name;
    if(data.budget_id!=null&&!uuid.test(data.budget_id))throw Error('Vínculo com orçamento inválido.');
    data.budget_id=data.budget_id||null;
    data.updated_at=new Date().toISOString();
   }
   if(entity==='contract_profiles'){
    for(const [key,value] of Object.entries(data)){
     if(typeof value!=='string'||value.length>250)throw Error('Dados da empresa inválidos: '+key);
     data[key]=value.trim();
    }
    if(!data.company_name||!validBrazilDocument(data.company_document))throw Error('Informe a razão social e CPF/CNPJ válido da empresa.');
    data.updated_at=new Date().toISOString();
   }
   if(entity==='budgets'){
    if(!data.content||typeof data.content!=='object'||Array.isArray(data.content)||JSON.stringify(data.content).length>55000)throw Error('Orçamento inválido ou extenso');
    if(!['rascunho','enviado','aprovado','recusado'].includes(data.status||'rascunho'))throw Error('Situação inválida');
    const v=calculateBudget(data.content);data.cost_cents=v.cost_cents;data.price_cents=v.price_cents;
   }
   if(entity==='settings'||entity==='budgets')data.updated_at=new Date().toISOString();
   if(req.method==='PATCH')dst.searchParams.set('id','eq.'+id);
   headers['Content-Type']='application/json';payload=JSON.stringify(data);
  }
  if(req.method==='GET')return json({rows:await listRows(dst,headers)});
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),16000);let r;
  try{r=await fetch(dst,{method:req.method,headers,body:payload,signal:c.signal})}finally{clearTimeout(timer)}
  if(!r.ok){const error=await r.json().catch(()=>({}));return json({error:r.status===403?'Acesso negado':(error.message||'Não foi possível salvar').slice(0,160)},r.status===403?403:400)}
  const rows=await r.json().catch(()=>null);
  if(!Array.isArray(rows))return json({error:'O banco não confirmou a operação. Atualize e confira os registros.'},502);
  if((req.method==='PATCH'||req.method==='DELETE')&&rows.length===0)
   return json({error:'Registro não encontrado ou sem permissão. Atualize a página.'},404);
  if((req.method==='POST'||req.method==='PATCH')&&rows.length!==1)
   return json({error:'O banco não confirmou o registro salvo. Atualize e confira os dados.'},502);
  return json({rows});
 }catch(err){return json({error:err.message?.slice(0,160)||'Falha temporária'},400)}
}};
