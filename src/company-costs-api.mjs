/* Custos internos da CIVOLTEN: cadastros opcionais; sem dados de identificação
 * além do nome profissional. A API exige usuário interno com escrita de orçamento.
 */
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const allowed=user=>['administrador','orcamentista'].includes(user?.role);
const textValue=(v,n,max=160)=>{const s=String(v??'').trim();if(s.length<2||s.length>max)throw Object.assign(new Error(n+' inválido'),{status:400});return s};
const codeValue=(v)=>{const s=String(v??'').trim();if(!s||s.length>40||!(/^[a-zA-Z0-9_\-]+$/.test(s)))throw Object.assign(new Error('Código da profissão inválido'),{status:400});return s};
const cash=(v,n,maximum=100000000)=>{
 if(v===null||v===undefined||v==='')throw Object.assign(new Error(n+' obrigatório'),{status:400});
 const s=String(v).replace(',','.').trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(s)||Number(s)>maximum)throw Object.assign(new Error(n+' inválido'),{status:400});
 return s;
};
const userId=u=>u.id;
export async function readCompanyCosts(sql){
 const [rates,workers,config]=await Promise.all([
  sql.query('SELECT role_code,role_name,hourly_employer_cost FROM company_labor_rates ORDER BY role_name',[]),
  sql.query('SELECT id,display_name,role_code,role_name,monthly_employer_cost,active FROM company_workers ORDER BY active DESC,role_name,display_name LIMIT 500',[]),
  sql.query('SELECT monthly_overhead,workdays_per_month FROM company_overhead_config WHERE singleton=1',[])
 ]);
 // Pricing is optional until the additive 0017 migration has been applied.
 // Never hide unexpected SQL errors or silently assume that taxes are zero.
 let pricing=null,pricing_setup_required=false;
 try{
  const rows=await sql.query('SELECT target_margin_pct,owner_prolabore_monthly,updated_at FROM company_pricing_config WHERE singleton=1',[]);
  pricing=rows[0]||null;
 }catch(e){
  if(e?.code!=='42P01')throw e;
  pricing_setup_required=true;
 }
 return {rates,workers,overhead:config[0]||null,pricing,pricing_setup_required};
}
export async function handleCompanyCosts({req,res,sql,user,parts,method,send,readBody}){
 if(parts[0]!=='company-costs')return false;
 const done=(status,data)=>{send(res,status,data);return true};
 if(!allowed(user))return done(403,{error:'Somente equipe interna autorizada pode consultar custos de pessoal'});
 if(parts.length===1&&method==='GET')return done(200,{...await readCompanyCosts(sql),commercial_release:false});
 if(parts[1]==='pricing'&&parts.length===2&&method==='PUT'){
  // Commercial targets and owner compensation can only be changed by an administrator.
  // This does not write budget prices, BDI, proposals or invoices.
  if(user.role!=='administrador')return done(403,{error:'Somente administrador pode configurar margem e pró-labore'});
  const b=await readBody(req);
  const margin=cash(b.target_margin_pct,'Margem desejada',80);
  const prolabore=cash(b.owner_prolabore_monthly,'Pró-labore mensal',10000000);
  const rows=await sql.query("WITH changed AS (INSERT INTO company_pricing_config(singleton,target_margin_pct,owner_prolabore_monthly,updated_by) VALUES (1,$1,$2,$3) ON CONFLICT(singleton) DO UPDATE SET target_margin_pct=EXCLUDED.target_margin_pct,owner_prolabore_monthly=EXCLUDED.owner_prolabore_monthly,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING singleton,target_margin_pct,owner_prolabore_monthly,updated_at), logged AS (INSERT INTO audit_events(actor_id,entity_type,action,metadata) SELECT $3,'company_pricing_config','update',jsonb_build_object('target_margin_pct',target_margin_pct,'owner_prolabore_monthly',owner_prolabore_monthly) FROM changed RETURNING id) SELECT changed.target_margin_pct,changed.owner_prolabore_monthly,changed.updated_at FROM changed JOIN logged ON true",[margin,prolabore,userId(user)]);
  return done(200,{...rows[0],commercial_release:false});
 }
 if(parts[1]==='rates'&&parts.length===2&&method==='PUT'){
  const b=await readBody(req),code=codeValue(b.role_code),name=textValue(b.role_name,'Profissão',140);
  const rate=cash(b.hourly_employer_cost,'Custo-hora do profissional',1000000);
  const rows=await sql.query("WITH upsert AS (INSERT INTO company_labor_rates(role_code,role_name,hourly_employer_cost) VALUES($1,$2,$3) ON CONFLICT(role_code) DO UPDATE SET role_name=EXCLUDED.role_name,hourly_employer_cost=EXCLUDED.hourly_employer_cost,updated_at=now() RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata) SELECT $4,'company_labor_rates',NULL,'upsert',jsonb_build_object('role_code',role_code) FROM upsert RETURNING id) SELECT upsert.* FROM upsert JOIN logged ON true",
   [code,name,rate,userId(user)]);
  return done(200,rows[0]);
 }
 if(parts[1]==='overhead'&&parts.length===2&&method==='PUT'){
  const b=await readBody(req),amount=cash(b.monthly_overhead,'Despesas fixas mensais');
  const days=Number(b.workdays_per_month);
  if(!Number.isSafeInteger(days)||days<15||days>31)return done(400,{error:'Dias úteis mensais devem ficar entre 15 e 31'});
  const rows=await sql.query("WITH upsert AS (INSERT INTO company_overhead_config(singleton,monthly_overhead,workdays_per_month) VALUES(1,$1,$2) ON CONFLICT(singleton) DO UPDATE SET monthly_overhead=EXCLUDED.monthly_overhead,workdays_per_month=EXCLUDED.workdays_per_month,updated_at=now() RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,action,metadata) SELECT $3,'company_overhead_config','update',jsonb_build_object('workdays_per_month',workdays_per_month) FROM upsert RETURNING id) SELECT upsert.monthly_overhead,upsert.workdays_per_month FROM upsert JOIN logged ON true",[amount,days,userId(user)]);
  return done(200,rows[0]);
 }
 if(parts[1]==='workers'&&(method==='POST'&&parts.length===2||method==='PUT'&&parts.length===3&&uuid(parts[2]))){
  const b=await readBody(req),name=textValue(b.display_name,'Nome profissional'),
   role=codeValue(b.role_code),roleName=textValue(b.role_name,'Profissão',140),
   monthly=cash(b.monthly_employer_cost,'Custo mensal completo',1000000);
  if(method==='POST'){
   const rows=await sql.query("WITH created AS (INSERT INTO company_workers(display_name,role_code,role_name,monthly_employer_cost) VALUES($1,$2,$3,$4) RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $5,'company_workers',id,'create' FROM created RETURNING id) SELECT created.* FROM created JOIN logged ON true",[name,role,roleName,monthly,userId(user)]);
   return done(201,rows[0]);
  }
  if(typeof b.active!=='boolean')return done(400,{error:'Situação ativo/inativo obrigatória'});
  const rows=await sql.query("WITH changed AS (UPDATE company_workers SET display_name=$2,role_code=$3,role_name=$4,monthly_employer_cost=$5,active=$6,updated_at=now() WHERE id=$1 RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $7,'company_workers',id,'update' FROM changed RETURNING id) SELECT changed.* FROM changed JOIN logged ON true",[parts[2],name,role,roleName,monthly,b.active,userId(user)]);
  return rows.length?done(200,rows[0]):done(404,{error:'Profissional não encontrado'});
 }
 return done(405,{error:'Rota ou método de custos internos não permitido'});
}
