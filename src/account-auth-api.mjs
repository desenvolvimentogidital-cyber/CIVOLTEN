/* Account lifecycle for an isolated, verified organization.
 * Not routed on production until explicit multi-tenant/signup flags, RLS
 * preflight and owner-controlled transactional mail settings are enabled.
 */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {accountMailReady,sendAccountEmail} from './account-mail.mjs';
import {probeTenantRuntime} from './tenant-db-guard.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const safeEmail=s=>typeof s==='string'&&s.length<=120&&
 /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const tokenValid=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const safeOrganization=s=>typeof s==='string'&&s.trim().length>=2&&s.trim().length<=160;
const send=(opts)=>opts?.sendAccountEmail||sendAccountEmail;
const mailReady=opts=>typeof opts?.sendAccountEmail==='function'||accountMailReady();
const auditIp=req=>sha(String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim());
const generic={ok:true,message:'Se o cadastro ou e-mail estiver elegível, as instruções serão enviadas.'};
function rollout(opts,multiTenant){
 return multiTenant===true&&(opts?.signupEnabled===true||
  (opts?.signupEnabled!==false&&process.env.CIVOLTEN_SIGNUP_ENABLED==='true'));
}
async function allowed(db,opts,multiTenant){
 if(!rollout(opts,multiTenant)||!mailReady(opts))return false;
 const inspection=await probeTenantRuntime(db);
 return inspection.ready===true;
}
async function rateLimit(db,key,req,login,max=3){
 const fingerprint=sha(key+'|'+login+'|'+auditIp(req));
 const rows=await db.query("SELECT count(*)::int AS attempts FROM auth_signup_attempts WHERE fingerprint=$1 AND attempted_at>now()-interval '1 hour'",[fingerprint]);
 if(Number(rows[0]?.attempts)>=max)return false;
 await db.query("INSERT INTO auth_signup_attempts(fingerprint) VALUES($1)",[fingerprint]);
 return true;
}
async function newToken(db,userId,purpose,minutes){
 const token=randomBytes(32).toString('hex');
 await db.query("INSERT INTO account_action_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+($4::integer*interval '1 minute'))",
  [sha(token),userId,purpose,minutes]);
 return token;
}
export async function handleAccountAuth({req,res,db,parts,method,sendResponse,readBody,opts,multiTenant,hashPassword}){
 if(parts[0]!=='auth'||!['signup','verify-email','resend-verification','request-reset','reset-password'].includes(parts[1]))return false;
 const done=(status,data)=>{sendResponse(res,status,data);return true};
 if(parts.length!==2)return done(404,{error:'Rota não encontrada'});
 if(method!=='POST')return done(405,{error:'Método POST obrigatório'});
 if(!rollout(opts,multiTenant))return done(503,{error:'Cadastro e recuperação multiempresa ainda não liberados',code:'SIGNUP_NOT_RELEASED'});
 if(!mailReady(opts))return done(503,{error:'E-mail transacional da conta não configurado',code:'EMAIL_PROVIDER_REQUIRED'});
 const inspect=await probeTenantRuntime(db);
 if(!inspect.ready)return done(503,{error:'Credencial PostgreSQL ou RLS insuficiente',code:'TENANT_DB_NOT_ISOLATED'});
 const body=await readBody(req);
 if(parts[1]==='verify-email'){
  if(!tokenValid(body.token))return done(400,{error:'Código de verificação inválido'});
  const eligible=await db.query("SELECT organization_id FROM civolten_auth_token_org($1,$2)",[sha(body.token),'verify']);
  if(!eligible.length)return done(400,{error:'Código expirado, inválido ou já utilizado'});
  const [,rows]=await db.transaction([
   db.query("SELECT set_config('civolten.organization_id',$1,true)",[eligible[0].organization_id]),
   db.query(`WITH claimed AS (
   UPDATE account_action_tokens SET consumed_at=now()
   WHERE token_hash=$1 AND purpose='verify' AND consumed_at IS NULL AND expires_at>now()
   RETURNING user_id
  ), activated AS (
   UPDATE app_users SET is_active=true,email_verified_at=now()
   WHERE id IN(SELECT user_id FROM claimed) AND is_active=false AND email_verified_at IS NULL
   RETURNING id,organization_id
  ), audited AS (
   INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
   SELECT id,'app_users',id,'email_verified' FROM activated RETURNING id
  ) SELECT id FROM activated`,[sha(body.token)])
  ]);
  return rows.length?done(200,{ok:true,verified:true,can_login:true}):
   done(400,{error:'Código expirado, inválido ou já utilizado'});
 }
 if(parts[1]==='reset-password'){
  if(!tokenValid(body.token))return done(400,{error:'Código de redefinição inválido'});
  const passwordHash=hashPassword(body.new_password);
  const eligible=await db.query("SELECT organization_id FROM civolten_auth_token_org($1,$2)",[sha(body.token),'reset']);
  if(!eligible.length)return done(400,{error:'Código expirado, inválido ou já utilizado'});
  const [,rows]=await db.transaction([
   db.query("SELECT set_config('civolten.organization_id',$1,true)",[eligible[0].organization_id]),
   db.query(`WITH claimed AS (
   UPDATE account_action_tokens SET consumed_at=now()
   WHERE token_hash=$1 AND purpose='reset' AND consumed_at IS NULL AND expires_at>now()
   RETURNING user_id
  ), updated AS (
   UPDATE app_users SET password_hash=$2,must_change_password=false
   WHERE id IN(SELECT user_id FROM claimed) AND is_active=true AND email_verified_at IS NOT NULL
   RETURNING id
  ), revoked AS (
   UPDATE app_sessions SET revoked_at=now() WHERE user_id IN(SELECT id FROM updated)
    AND revoked_at IS NULL RETURNING user_id
  ), audited AS (
   INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
   SELECT id,'app_users',id,'password_reset' FROM updated RETURNING id
  ) SELECT id FROM updated`,[sha(body.token),passwordHash])
  ]);
  return rows.length?done(200,{ok:true,password_changed:true,all_sessions_revoked:true}):
   done(400,{error:'Código expirado, inválido ou já utilizado'});
 }
 const login=String(body.login||'').trim().toLowerCase();
 if(!safeEmail(login))return done(400,{error:'Informe um e-mail válido'});
 if(!await rateLimit(db,parts[1],req,login))return done(429,{error:'Muitas solicitações. Tente mais tarde.'});
 if(parts[1]==='signup'){
  if(!safeOrganization(body.organization_name))return done(400,{error:'Informe nome da empresa (2 a 160 caracteres)'});
  const passwordHash=hashPassword(body.password);
  const existing=await db.query('SELECT id FROM civolten_auth_user($1,$2)',[login,'exists']);
  if(existing.length)return done(202,generic);
  const org=randomUUID(),id=randomUUID(),token=randomBytes(32).toString('hex');
  await db.transaction([
   db.query("SELECT set_config('civolten.organization_id',$1,true)",[org]),
   db.query('INSERT INTO organizations(id,name) VALUES($1,$2)',[org,body.organization_name.trim()]),
   db.query("INSERT INTO app_users(id,organization_id,login,password_hash,role,must_change_password,is_active) VALUES($1,$2,$3,$4,'administrador',false,false)",[id,org,login,passwordHash]),
   db.query("INSERT INTO account_action_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'verify',now()+interval '30 minutes')",[sha(token),id]),
   db.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata) VALUES($1,'organizations',$2,'signup_pending',jsonb_build_object('email_unverified',true))",[id,org])
  ]);
  await send(opts)({to:login,kind:'verify',token});
  return done(202,{...generic,verification_required:true});
 }
 const users=await db.query("SELECT id FROM civolten_auth_user($1,$2)",[login,'verify']);
 if(parts[1]==='resend-verification'){
  if(users.length){
   const token=await newToken(db,users[0].id,'verify',30);
   await send(opts)({to:login,kind:'verify',token});
  }
  return done(202,generic);
 }
 if(parts[1]==='request-reset'){
  const active=await db.query("SELECT id FROM civolten_auth_user($1,$2)",[login,'reset']);
  if(active.length){
   const token=await newToken(db,active[0].id,'reset',20);
   await send(opts)({to:login,kind:'reset',token});
  }
  return done(202,generic);
 }
 return done(404,{error:'Rota inexistente'});
}
export function signupConfigured(opts,multiTenant){return rollout(opts,multiTenant)&&mailReady(opts)}
