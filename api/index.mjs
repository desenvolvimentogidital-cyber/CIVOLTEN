/* CIVOLTEN: API privada de homologação. Vercel + Neon.
   A interface pública permanece em demonstração até a autenticação ser homologada. */
import { neon } from '@neondatabase/serverless';
import {validTaxId,normalizeTaxId} from '../src/documents.mjs';
import {handleStage2} from '../src/costing-api.mjs';
import {handleServiceCatalog} from '../src/service-catalog-api.mjs';
import {handleStage3} from '../src/schedule-api.mjs';
import {handleWorkforceEstimate} from '../src/workforce-estimate-api.mjs';
import {handleAutomaticBriefing} from '../src/automatic-budget-api.mjs';
import {handleBudgetPlanning} from '../src/budget-planning-api.mjs';
import {handleCompanyCosts} from '../src/company-costs-api.mjs';
import {handleScheduleManagement} from '../src/schedule-management-api.mjs';
import {handleReviewedAutoplan} from '../src/reviewed-autoplan-api.mjs';
import {handleScheduleProgress} from '../src/schedule-progress-api.mjs';
import {handleRemainingSchedule} from '../src/schedule-remaining-api.mjs';
import {handleStage4} from '../src/stage4-finance-api.mjs';
import {handleStage4Closeout} from '../src/stage4-closeout-api.mjs';
import {handleStage5Readiness} from '../src/stage5-readiness-api.mjs';
import {authorizePreviewMutation} from '../src/stage5-preview-guard.mjs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const sessionName='civolten_dev_session';
const hexhash=s=>createHash('sha256').update(s).digest('hex');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const response=(res,status,data,extra={})=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');for(const [k,v] of Object.entries(extra))res.setHeader(k,v);res.end(JSON.stringify(data))};
const cookie=(value,seconds)=>sessionName+'='+value+'; Path=/api/v1; HttpOnly; Secure; SameSite=Strict; Max-Age='+seconds;
const sessionToken=req=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(x=>x.startsWith(sessionName+'='))?.slice(sessionName.length+1)||'';
const requireField=(v,key,max=250)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Object.assign(new Error(key+' inválido'),{status:400});return v.trim()};
const opt=(v,max=250)=>v==null||v===''?null:requireField(String(v),'Campo',max);
const taxId=v=>{if(v==null||String(v).trim()==='')return null;const normalized=normalizeTaxId(v);if(!validTaxId(normalized))throw Object.assign(new Error('CPF/CNPJ inválido; aceita CNPJ alfanumérico de 2026'),{status:400});return normalized};
const number=(v,name,zero=false)=>{const n=Number(v);if(!Number.isFinite(n)||(zero?n<0:n<=0)||n>1e9)throw Object.assign(new Error(name+' inválido'),{status:400});return n};
async function readBody(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(new Error('Exige application/json'),{status:415});
 let data='',bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)throw Object.assign(new Error('Limite 64 KB'),{status:413});data+=chunk.toString()}
 try{const v=JSON.parse(data);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('JSON');return v}catch{throw Object.assign(new Error('JSON inválido'),{status:400})}
}
function validateRequest(req){
 const origin=String(req.headers.origin||'');
 const host=String(req.headers['x-forwarded-host']||req.headers.host||'');
 if(origin){let caller='';try{caller=new URL(origin).host}catch{}if(caller!==host)throw Object.assign(new Error('Origem bloqueada'),{status:403});}
 if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')throw Object.assign(new Error('Origem bloqueada'),{status:403});
 if(req.headers['x-civolten-request']!=='1')throw Object.assign(new Error('Cabeçalho anti-CSRF obrigatório'),{status:403});
}
async function who(req,sql){
 const token=sessionToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const data=await sql.query("SELECT u.id,u.login,u.role,u.must_change_password FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.is_active=true LIMIT 1",[hexhash(token)]);
 return data[0]||null;
}
const writable=user=>user.role==='administrador'||user.role==='orcamentista';
const noAccess=res=>response(res,403,{error:'Permissão insuficiente'});
const notFound=res=>response(res,404,{error:'Registro não encontrado'});
const hashPassword=p=>{if(typeof p!=='string'||p.length<12||p.length>128)throw Object.assign(new Error('Senha deve ter 12 a 128 caracteres'),{status:400});const salt=randomBytes(16).toString('hex');return 'scrypt$'+salt+'$'+scryptSync(p,salt,64).toString('hex')};
function matches(p,encoded){
 try{const [name,salt,digest]=encoded.split('$');if(name!=='scrypt'||!p)return false;const a=scryptSync(p,salt,64),b=Buffer.from(digest,'hex');return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}
}
function getParts(req){
 const u=new URL(req.url,'https://civolten-gj91.vercel.app');
 const fromQuery=u.searchParams.get('route');
 if(fromQuery)return fromQuery.split('/').filter(Boolean);
 const parts=u.pathname.split('/').filter(Boolean);
 if(parts[0]==='api'&&parts[1]==='v1')return parts.slice(2);
 return [];
}
export function createApi(sql,opts={}){
 return async(req,res)=>{
  try{
   const method=req.method||'GET',parts=getParts(req);
   const [resource,id,sub]=parts;
   if(!['GET','POST','PUT','DELETE'].includes(method))return response(res,405,{error:'Método não permitido'});
   if(method!=='GET')validateRequest(req);
   if(method!=='GET'){
    const gate=await authorizePreviewMutation(sql,{
     environment:opts.environment,previewBranchId:opts.previewBranchId
    });
    if(!gate.permitted)return response(res,503,{
     error:'Prévia sem identificação válida do banco de homologação: operações de escrita bloqueadas',
     code:gate.reason,commercial_release:false
    });
   }
   if(resource==='health'&&method==='GET'){
     const data=await sql.query('SELECT 1 AS connected',[]);
     return response(res,200,{ok:data[0]?.connected===1,database:'connected',mode:'homologacao'});
   }
   if(resource==='auth'&&id==='status'&&method==='GET'){
     const user=await who(req,sql);return response(res,200,{authenticated:!!user,user});
   }
   if(resource==='auth'&&id==='bootstrap'&&method==='POST'){
     const secret=opts.bootstrapSecret||process.env.CIVOLTEN_BOOTSTRAP_SECRET;
     if(!secret)return response(res,403,{error:'Configuração administrativa desativada'});
     const b=await readBody(req),got=String(b.bootstrap_secret||'');
     if(got.length!==secret.length||!timingSafeEqual(Buffer.from(got),Buffer.from(secret)))return response(res,403,{error:'Token de configuração inválido'});
     const userId=randomUUID(),username=requireField(b.login,'Login',120).toLowerCase(),passwordHash=hashPassword(b.password);
     // Um único statement cria a trava permanente e o usuário. Concorrência não duplica administradores iniciais.
     const inserted=await sql.query("WITH guard AS (INSERT INTO app_bootstrap_lock(singleton) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM app_users) ON CONFLICT DO NOTHING RETURNING singleton), bootstrap_user AS (INSERT INTO app_users(id,login,password_hash,role,must_change_password) SELECT $1,$2,$3,'administrador',true FROM guard RETURNING id) SELECT id FROM bootstrap_user",
       [userId,username,passwordHash]);
     if(!inserted.length)return response(res,409,{error:'Administrador inicial já foi configurado'});
     await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,'app_users',$2,'bootstrap')",[userId,userId]);
     return response(res,201,{ok:true});
   }
   if(resource==='auth'&&id==='login'&&method==='POST'){
     const b=await readBody(req),login=String(b.login||'').trim().toLowerCase();
     const fingerprint=hexhash(login+'|'+String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim());
     const recent=await sql.query("SELECT count(*)::int AS failures FROM audit_events WHERE entity_type='auth' AND action='login_failed' AND created_at>now()-interval '15 minutes' AND metadata->>'fingerprint'=$1",[fingerprint]);
     if(Number(recent[0].failures)>=6)return response(res,429,{error:'Muitas tentativas. Tente mais tarde.'},{'Retry-After':'900'});
     const data=await sql.query('SELECT id,login,password_hash,role,must_change_password FROM app_users WHERE login=$1 AND is_active=true LIMIT 1',[login]);
     if(!data[0]||!matches(b.password,data[0].password_hash)){
       await sql.query("INSERT INTO audit_events(entity_type,action,metadata) VALUES('auth','login_failed',jsonb_build_object('fingerprint',$1::text))",[fingerprint]);
       return response(res,401,{error:'Credenciais inválidas'});
     }
     const token=randomBytes(32).toString('hex'),expires=new Date(Date.now()+8*3600000).toISOString();
     await sql.query('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[hexhash(token),data[0].id,expires]);
     return response(res,200,{ok:true,user:{id:data[0].id,login:data[0].login,role:data[0].role,must_change_password:data[0].must_change_password}},{'Set-Cookie':cookie(token,28800)});
   }
   if(resource==='auth'&&id==='logout'&&method==='POST'){
     const token=sessionToken(req);
     if(token)await sql.query('UPDATE app_sessions SET revoked_at=now() WHERE token_hash=$1',[hexhash(token)]);
     return response(res,200,{ok:true},{'Set-Cookie':cookie('',0)});
   }
   const user=await who(req,sql);
   if(!user)return response(res,401,{error:'Sessão necessária'});
   if(user.must_change_password && !(resource==='auth'&&id==='change-password'))return response(res,403,{error:'Altere a senha temporária antes de acessar dados do CIVOLTEN',password_change_required:true});
   if(resource==='me'&&method==='GET')return response(res,200,user);
   const stage5Handled=await handleStage5Readiness({req,res,sql,user,parts,method,send:response});
   if(stage5Handled)return;
   const catalogHandled=await handleServiceCatalog({req,res,sql,user,parts,method,send:response});
   if(catalogHandled)return;
   const automaticHandled=await handleAutomaticBriefing({req,res,sql,user,parts,method,send:response,readBody});
   if(automaticHandled)return;
   const stage2Handled=await handleStage2({req,res,sql,user,parts,method,send:response,readBody});
   if(stage2Handled)return;
   const companyCostsHandled=await handleCompanyCosts({req,res,sql,user,parts,method,send:response,readBody});
   if(companyCostsHandled)return;
   const budgetPlanningHandled=await handleBudgetPlanning({req,res,sql,user,parts,method,send:response,readBody});
   if(budgetPlanningHandled)return;
   const manpowerHandled=await handleWorkforceEstimate({req,res,sql,user,parts,method,send:response});
   if(manpowerHandled)return;
   const stage3Handled=await handleStage3({req,res,sql,user,parts,method,send:response});
   if(stage3Handled)return;
   const generatedPlanHandled=await handleReviewedAutoplan({req,res,sql,user,parts,method,send:response,readBody});
   if(generatedPlanHandled)return;
   const scheduleManagementHandled=await handleScheduleManagement({req,res,sql,user,parts,method,send:response,readBody});
   if(scheduleManagementHandled)return;
   const progressHandled=await handleScheduleProgress({req,res,sql,user,parts,method,send:response,readBody});
   if(progressHandled)return;
   const remainingHandled=await handleRemainingSchedule({req,res,sql,parts,method,send:response});
   if(remainingHandled)return;
   const stage4Handled=await handleStage4({req,res,sql,user,parts,method,send:response,readBody});
   if(stage4Handled)return;
   const closeoutHandled=await handleStage4Closeout({req,res,sql,user,parts,method,send:response,readBody});
   if(closeoutHandled)return;

   if(resource==='auth'&&id==='change-password'&&method==='POST'){
     const b=await readBody(req);
     const match=await sql.query('SELECT password_hash FROM app_users WHERE id=$1 AND is_active=true LIMIT 1',[user.id]);
     if(!match.length||!matches(b.current_password,match[0].password_hash))return response(res,403,{error:'Senha atual incorreta'});
     if(String(b.new_password||'')===String(b.current_password||''))return response(res,400,{error:'Defina uma senha nova'});
     const replacement=hashPassword(b.new_password);
     await sql.query('UPDATE app_users SET password_hash=$2,must_change_password=false WHERE id=$1',[user.id,replacement]);
     await sql.query('UPDATE app_sessions SET revoked_at=now() WHERE user_id=$1 AND token_hash<>$2 AND revoked_at IS NULL',[user.id,hexhash(sessionToken(req))]);
     await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,'app_users',$1,'password_changed')",[user.id]);
     return response(res,200,{ok:true});
   }

   // Usuários de desenvolvimento: somente o administrador gerencia acesso e funções.
   if(resource==='users'){
     if(user.role!=='administrador')return noAccess(res);
     if(method==='GET'&&!id){
       return response(res,200,await sql.query("SELECT id,login,role,is_active,must_change_password,created_at,last_login_at FROM app_users ORDER BY created_at ASC LIMIT 100",[]));
     }
     if(method==='POST'&&!id){
       const b=await readBody(req);
       const login=requireField(b.login,'Usuário',120).toLowerCase();
       if(!/^[a-z0-9][a-z0-9._@-]{3,119}$/.test(login))return response(res,400,{error:'Usuário precisa ter 4 a 120 caracteres alfanuméricos'});
       const role=String(b.role||'orcamentista');
       if(!['orcamentista','revisor','consulta'].includes(role))return response(res,400,{error:'Perfil inválido para novo usuário'});
       const password=hashPassword(b.password),userId=randomUUID();
       const result=await sql.query(
         "WITH added AS (INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,true) RETURNING id,login,role,is_active,must_change_password,created_at) SELECT * FROM added",
         [userId,login,password,role]
       );
       await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata) VALUES($1,'app_users',$2,'create',jsonb_build_object('role',$3::text))",[user.id,userId,role]);
       return response(res,201,result[0]);
     }
     if(method==='PUT'&&id){
       if(!uuid(id))return response(res,400,{error:'Identificador inválido'});
       if(id===user.id)return response(res,409,{error:'Não é possível mudar seu próprio perfil ou desativar sua conta'});
       const b=await readBody(req),role=String(b.role||'');
       if(!['orcamentista','revisor','consulta'].includes(role))return response(res,400,{error:'Perfil inválido'});
       if(typeof b.is_active!=='boolean')return response(res,400,{error:'Ativação deve ser verdadeiro ou falso'});
       const updated=await sql.query("UPDATE app_users SET role=$2,is_active=$3 WHERE id=$1 AND role<>'administrador' RETURNING id,login,role,is_active,created_at,last_login_at",
          [id,role,b.is_active]);
       if(!updated.length)return response(res,404,{error:'Usuário inexistente ou administrador protegido'});
       if(!b.is_active)await sql.query("UPDATE app_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[id]);
       await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata) VALUES($1,'app_users',$2,'update',jsonb_build_object('role',$3::text,'active',$4::boolean))",[user.id,id,role,b.is_active]);
       return response(res,200,updated[0]);
     }
     return response(res,405,{error:'Método não permitido'});
   }
   // Exclusão lógica: preserva integridade e histórico para auditorias.
   if(method==='DELETE'&&id&&!sub&&['clients','projects','budgets'].includes(resource)){
     if(!writable(user))return noAccess(res);
     if(!uuid(id))return response(res,400,{error:'Identificador inválido'});
     let changed;
     if(resource==='clients')changed=await sql.query("UPDATE clients SET status='inativo',updated_at=now() WHERE id=$1 AND status<>'inativo' RETURNING id,status",[id]);
     else if(resource==='projects')changed=await sql.query("UPDATE projects SET status='arquivada',updated_at=now() WHERE id=$1 AND status<>'arquivada' RETURNING id,status",[id]);
     else changed=await sql.query("UPDATE budgets SET status='cancelado',lock_version=lock_version+1,updated_at=now() WHERE id=$1 AND status='rascunho' RETURNING id,status",[id]);
     if(!changed.length)return response(res,409,{error:'Registro não encontrado ou não pode ser arquivado neste estado'});
     await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,$2,$3,'archive')",[user.id,resource,id]);
     return response(res,200,{ok:true,...changed[0]});
   }
   if(resource==='budgets'&&id&&sub==='items'&&parts[3]&&method==='DELETE'){
     if(!writable(user))return noAccess(res);
     if(!uuid(id)||!uuid(parts[3]))return response(res,400,{error:'Identificador inválido'});
     const draft=await sql.query("SELECT id FROM budgets WHERE id=$1 AND status='rascunho'",[id]);
     if(!draft.length)return response(res,409,{error:'Só é possível remover itens de orçamentos em rascunho'});
     const rows=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND status='rascunho' AND EXISTS (SELECT 1 FROM budget_items WHERE id=$1 AND budget_id=$2 AND deleted_at IS NULL) RETURNING id), archived AS (UPDATE budget_items SET deleted_at=now() WHERE id=$1 AND budget_id=$2 AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM guard) RETURNING id), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $3,'budget_items',archived.id,'archive' FROM archived RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET bdi_reviewed=false,technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM archived) RETURNING budget_id) SELECT archived.id FROM archived JOIN logged ON true",
       [parts[3],id,user.id]);
     if(!rows.length)return response(res,409,{error:'Serviço indisponível ou orçamento não editável'});
     return response(res,200,{ok:true});
   }
   // Gravações editáveis são restritas a usuários autenticados e autorizados.
   if(resource==='clients'&&method==='PUT'&&id){
     if(!writable(user))return noAccess(res);
     if(!uuid(id))return response(res,400,{error:'Cliente inválido'});
     const b=await readBody(req);
     const name=requireField(b.name,'Nome',250);
     const taxNumber=taxId(b.tax_id),email=opt(b.email,254),phone=opt(b.phone,40),address=opt(b.address,800);
     const updated=await sql.query("WITH revised AS (UPDATE clients SET name=$2,tax_id=$3,email=$4,phone=$5,address=$6,updated_at=now() WHERE id=$1 RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $7,'clients',revised.id,'update' FROM revised RETURNING id) SELECT revised.* FROM revised JOIN logged ON true",
       [id,name,taxNumber,email,phone,address,user.id]);
     if(!updated.length)return notFound(res);
     return response(res,200,updated[0]);
   }
   if(resource==='projects'&&method==='PUT'&&id){
     if(!writable(user))return noAccess(res);
     if(!uuid(id))return response(res,400,{error:'Obra inválida'});
     const b=await readBody(req),title=requireField(b.title,'Obra',250);
     if(!uuid(b.client_id))return response(res,400,{error:'Cliente inválido'});
     const updated=await sql.query("WITH revised AS (UPDATE projects SET title=$2,client_id=$3,address=$4,updated_at=now() WHERE id=$1 RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $5,'projects',revised.id,'update' FROM revised RETURNING id) SELECT revised.* FROM revised JOIN logged ON true",
       [id,title,b.client_id,opt(b.address,800),user.id]);
     if(!updated.length)return notFound(res);
     return response(res,200,updated[0]);
   }
   if(resource==='budgets'&&method==='PUT'&&id&&!sub){
     if(!writable(user))return noAccess(res);
     if(!uuid(id))return response(res,400,{error:'Orçamento inválido'});
     const b=await readBody(req),title=requireField(b.title,'Título',250);
     const current=await sql.query('SELECT client_id,project_id,status,lock_version FROM budgets WHERE id=$1',[id]);
     if(!current.length)return notFound(res);
     if(current[0].status!=='rascunho')return response(res,409,{error:'Orçamento não editável neste estado'});
     if(!uuid(b.client_id))return response(res,400,{error:'Cliente inválido'});
     let projectId=null;
     if(b.project_id){
       if(!uuid(b.project_id))return response(res,400,{error:'Obra inválida'});
       const owned=await sql.query('SELECT id FROM projects WHERE id=$1 AND client_id=$2',[b.project_id,b.client_id]);
       if(!owned.length)return response(res,400,{error:'Obra não pertence ao cliente'});
       projectId=b.project_id;
     }
     const month=String(b.reference_month||current[0].reference_month);
     if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month))return response(res,400,{error:'Data-base inválida'});
     const regime=['Com desoneração','Sem desoneração'].includes(b.regime)?b.regime:'Sem desoneração';
     const bdi=number(b.bdi_pct,'BDI',true);
     if(bdi>100)return response(res,400,{error:'BDI deve ser no máximo 100%'});
     // Controle otimista evita sobrescrever alterações de outro dispositivo.
     const expected=Number(b.lock_version);
     if(!Number.isSafeInteger(expected)||expected<0)return response(res,400,{error:'Versão do orçamento obrigatória'});
     const updated=await sql.query("WITH revised AS (UPDATE budgets SET client_id=$2,project_id=$3,title=$4,reference_month=$5,regime=$6,bdi_pct=$7,lock_version=lock_version+1,updated_at=now() WHERE id=$1 AND lock_version=$8 AND status='rascunho' RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $9,'budgets',revised.id,'update' FROM revised RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET bdi_reviewed=false,technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$1 AND EXISTS(SELECT 1 FROM revised) RETURNING budget_id) SELECT revised.* FROM revised JOIN logged ON true",
       [id,b.client_id,projectId,title,month,regime,bdi,expected,user.id]);
     if(!updated.length)return response(res,409,{error:'Orçamento alterado em outro dispositivo. Atualize antes de salvar.'});
     return response(res,200,updated[0]);
   }
   if(resource==='budgets'&&id&&sub==='items'){
     if(!uuid(id))return response(res,400,{error:'Orçamento inválido'});
     if(method==='POST'||(method==='PUT'&&parts[3])){
       if(!writable(user))return noAccess(res);
       const b=await readBody(req);
       const original=await sql.query('SELECT id,status FROM budgets WHERE id=$1',[id]);
       if(!original.length)return notFound(res);
       if(original[0].status!=='rascunho')return response(res,409,{error:'Orçamento não está em rascunho'});
       const description=requireField(b.source_name,'Descrição do serviço',500);
       const unit=requireField(b.unit,'Unidade',30),position=Number(b.position);
       if(!Number.isSafeInteger(position)||position<1||position>10000)return response(res,400,{error:'Ordem inválida'});
       const qty=number(b.quantity,'Quantidade'),unitCost=number(b.direct_unit_cost,'Custo unitário',true);
       const sourceCode=opt(b.source_code,40);
       let row;
       if(method==='POST'){
         const itemId=randomUUID();
         row=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND status='rascunho' RETURNING id), created AS (INSERT INTO budget_items(id,budget_id,position,source_name,source_code,unit,quantity,direct_unit_cost) SELECT $1,guard.id,$3,$4,$5,$6,$7,$8 FROM guard RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $9,'budget_items',created.id,'create' FROM created RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET bdi_reviewed=false,technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM created) RETURNING budget_id) SELECT created.* FROM created JOIN logged ON true",
           [itemId,id,position,description,sourceCode,unit,qty,unitCost,user.id]);
       }else{
         if(!uuid(parts[3]))return response(res,400,{error:'Serviço inválido'});
         row=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND status='rascunho' AND EXISTS (SELECT 1 FROM budget_items WHERE id=$1 AND budget_id=$2 AND deleted_at IS NULL AND reference_price_id IS NULL) RETURNING id), changed AS (UPDATE budget_items SET position=$3,source_name=$4,source_code=$5,unit=$6,quantity=$7,direct_unit_cost=$8,reference_price_id=NULL WHERE id=$1 AND budget_id=$2 AND deleted_at IS NULL AND reference_price_id IS NULL AND EXISTS (SELECT 1 FROM guard) RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $9,'budget_items',changed.id,'update' FROM changed RETURNING id), deleted_reviews AS (DELETE FROM budget_item_cost_reviews WHERE budget_item_id=$1 AND EXISTS(SELECT 1 FROM changed) RETURNING budget_item_id), invalidated AS (UPDATE budget_costing_profiles SET bdi_reviewed=false,technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM changed) RETURNING budget_id) SELECT changed.* FROM changed JOIN logged ON true",
           [parts[3],id,position,description,sourceCode,unit,qty,unitCost,user.id]);
       }
       if(!row.length)return response(res,409,{error:'Orçamento não editável ou item indisponível. Recarregue o orçamento.'});
       return response(res,method==='POST'?201:200,row[0]);
     }
   }
   if(resource==='clients'){
     if(method==='GET'){
       if(id){if(!uuid(id))return response(res,400,{error:'Identificador inválido'});const r=await sql.query('SELECT * FROM clients WHERE id=$1 LIMIT 1',[id]);return r[0]?response(res,200,r[0]):notFound(res)}
       return response(res,200,await sql.query('SELECT * FROM clients ORDER BY created_at DESC LIMIT 200',[]));
     }
     if(method==='POST'){
       if(!writable(user))return noAccess(res);
       const b=await readBody(req),id=randomUUID(),name=requireField(b.name,'Nome');
       const row=await sql.query("WITH created AS (INSERT INTO clients(id,name,tax_id,email,phone,address,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $7,'clients',created.id,'create' FROM created RETURNING id) SELECT created.* FROM created JOIN logged ON true",
         [id,name,taxId(b.tax_id),opt(b.email,254),opt(b.phone,40),opt(b.address,800),user.id]);
       return response(res,201,row[0]);
     }
   }
   if(resource==='projects'){
     if(method==='GET')return response(res,200,await sql.query('SELECT p.*,c.name AS client_name FROM projects p JOIN clients c ON c.id=p.client_id ORDER BY p.created_at DESC LIMIT 200',[]));
     if(method==='POST'){
       if(!writable(user))return noAccess(res);
       const b=await readBody(req);if(!uuid(b.client_id))return response(res,400,{error:'Cliente inválido'});
       const id=randomUUID(),title=requireField(b.title,'Obra');
       const row=await sql.query("WITH created AS (INSERT INTO projects(id,client_id,title,address) VALUES($1,$2,$3,$4) RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $5,'projects',created.id,'create' FROM created RETURNING id) SELECT created.* FROM created JOIN logged ON true",
         [id,b.client_id,title,opt(b.address,800),user.id]);
       return response(res,201,row[0]);
     }
   }
   if(resource==='budgets'){
     if(method==='GET'&&!id)return response(res,200,await sql.query('SELECT b.id,b.code,b.title,b.client_id,b.project_id,b.status,b.lock_version,b.reference_month,b.regime,b.bdi_pct,c.name AS client_name FROM budgets b JOIN clients c ON c.id=b.client_id ORDER BY b.created_at DESC LIMIT 200',[]));
     if(method==='GET'&&id&&uuid(id)){
       const b=await sql.query('SELECT b.*,c.name AS client_name FROM budgets b JOIN clients c ON c.id=b.client_id WHERE b.id=$1',[id]);
       if(!b.length)return notFound(res);
       const items=await sql.query('SELECT * FROM budget_items WHERE budget_id=$1 AND deleted_at IS NULL ORDER BY position',[id]);
       return response(res,200,{...b[0],items});
     }
     if(method==='POST'&&!id){
       if(!writable(user))return noAccess(res);
       const b=await readBody(req);if(!uuid(b.client_id))return response(res,400,{error:'Cliente inválido'});
       const title=requireField(b.title,'Orçamento'),id=randomUUID(),month=String(b.reference_month||'2026-07');
       if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month))return response(res,400,{error:'Data-base inválida'});
       const regime=['Com desoneração','Sem desoneração'].includes(b.regime)?b.regime:'Sem desoneração';
       const bdi=number(b.bdi_pct??25,'BDI',true);
       if(bdi>100)return response(res,400,{error:'BDI acima de 100% requer revisão fora deste fluxo'});
       const code='ORC-'+new Date().getFullYear()+'-'+randomBytes(5).toString('hex').toUpperCase();
       let projectId=null;
       if(b.project_id){
         if(!uuid(b.project_id))return response(res,400,{error:'Obra inválida'});
         const p=await sql.query('SELECT id FROM projects WHERE id=$1 AND client_id=$2',[b.project_id,b.client_id]);
         if(!p.length)return response(res,400,{error:'Obra não pertence ao cliente'});
         projectId=b.project_id;
       }
       const r=await sql.query("WITH created AS (INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $9,'budgets',created.id,'create' FROM created RETURNING id) SELECT created.* FROM created JOIN logged ON true",
         [id,code,b.client_id,projectId,title,month,regime,bdi,user.id]);
       return response(res,201,r[0]);
     }
   }
   return response(res,404,{error:'Rota não disponível na API de homologação'});
  }catch(e){
   if(e.status)return response(res,e.status,{error:e.message});
   if(e.code==='23503')return response(res,400,{error:'Referência inválida'});
   if(e.code==='23505')return response(res,409,{error:'Registro duplicado'});
   if(e.code==='23514'||e.code==='22P02')return response(res,400,{error:'Dados inconsistentes'});
   console.error('[CIVOLTEN API]',String(e.message||e).replace(/postgres(?:ql)?:\/\/\S+/ig,'[URL oculta]').slice(0,260));
   return response(res,500,{error:'Falha interna'});
  }
 };
}
export default function vercelHandler(req,res){
 if(!process.env.DATABASE_URL)return response(res,503,{error:'Banco indisponível neste ambiente'});
 return createApi(neon(process.env.DATABASE_URL))(req,res);
}
