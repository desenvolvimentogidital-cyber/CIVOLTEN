import {SUPABASE,KEY,json,sameOrigin,browserAllowed,readBody,cookieToken,authorized} from '../lib/civolten-security.mjs';
import {calculateBudget} from '../lib/civolten-calc.mjs';
const models={
 settings:['cv_settings','workdays_month','billable_days_month','tax_pct','margin_pct'],
 workers:['cv_workers','name','profession','daily_cents','charges_pct','days_month','active'],
 fixed:['cv_fixed_costs','name','category','monthly_cents','active'],
 variable:['cv_variable_costs','name','category','unit','unit_cents'],
 budgets:['cv_budgets','title','customer','status','content']
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
   dst.searchParams.set('select','*');dst.searchParams.set('limit','250');
   if(entity!=='settings')dst.searchParams.set('order','created_at.desc');
  }else if(req.method==='DELETE'){dst.searchParams.set('id','eq.'+id)}
  else{
   const body=await readBody(req,59000),b=body.record;
   if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Registro inválido');
   const data={};for(const k of model.slice(1))if(Object.prototype.hasOwnProperty.call(b,k))data[k]=b[k];
   if(entity==='budgets'){
    if(!data.content||typeof data.content!=='object'||Array.isArray(data.content)||JSON.stringify(data.content).length>55000)throw Error('Orçamento inválido ou extenso');
    if(!['rascunho','enviado','aprovado','recusado'].includes(data.status||'rascunho'))throw Error('Situação inválida');
    const v=calculateBudget(data.content);data.cost_cents=v.cost_cents;data.price_cents=v.price_cents;
   }
   if(entity==='settings'||entity==='budgets')data.updated_at=new Date().toISOString();
   if(req.method==='PATCH')dst.searchParams.set('id','eq.'+id);
   headers['Content-Type']='application/json';payload=JSON.stringify(data);
  }
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),16000);let r;
  try{r=await fetch(dst,{method:req.method,headers,body:payload,signal:c.signal})}finally{clearTimeout(timer)}
  if(!r.ok){const error=await r.json().catch(()=>({}));return json({error:r.status===403?'Acesso negado':(error.message||'Não foi possível salvar').slice(0,160)},r.status===403?403:400)}
  return json({rows:await r.json().catch(()=>[])});
 }catch(err){return json({error:err.message?.slice(0,160)||'Falha temporária'},400)}
}};
