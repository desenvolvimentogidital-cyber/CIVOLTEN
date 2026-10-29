/* CIVOLTEN: API privada de homologação. Vercel + Neon.
   A interface pública permanece em demonstração até a autenticação ser homologada. */
import { neon } from '@neondatabase/serverless';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const sessionName='civolten_dev_session';
const hexhash=s=>createHash('sha256').update(s).digest('hex');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const response=(res,status,data,extra={})=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');for(const [k,v] of Object.entries(extra))res.setHeader(k,v);res.end(JSON.stringify(data))};
const cookie=(value,seconds)=>sessionName+'='+value+'; Path=/api/v1; HttpOnly; Secure; SameSite=Strict; Max-Age='+seconds;
const sessionToken=req=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(x=>x.startsWith(sessionName+'='))?.slice(sessionName.length+1)||'';
const requireField=(v,key,max=250)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Object.assign(new Error(key+' inválido'),{status:400});return v.trim()};
const opt=(v,max=250)=>v==null||v===''?null:requireField(String(v),'Campo',max);
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
 const data=await sql.query("SELECT u.id,u.login,u.role FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.is_active=true LIMIT 1",[hexhash(token)]);
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
     const count=await sql.query('SELECT count(*)::integer AS total FROM app_users',[]);
     if(count[0].total!==0)return response(res,409,{error:'Usuário administrador já existente'});
     const userId=randomUUID(),username=requireField(b.login,'Login',120).toLowerCase(),passwordHash=hashPassword(b.password);
     await sql.query("INSERT INTO app_users(id,login,password_hash,role) VALUES($1,$2,$3,'administrador')",[userId,username,passwordHash]);
     await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,'app_users',$2,'bootstrap')",[userId,userId]);
     return response(res,201,{ok:true});
   }
   if(resource==='auth'&&id==='login'&&method==='POST'){
     const b=await readBody(req),login=String(b.login||'').trim().toLowerCase();
     const fingerprint=hexhash(login+'|'+String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim());
     const recent=await sql.query("SELECT count(*)::int AS failures FROM audit_events WHERE entity_type='auth' AND action='login_failed' AND created_at>now()-interval '15 minutes' AND metadata->>'fingerprint'=$1",[fingerprint]);
     if(Number(recent[0].failures)>=6)return response(res,429,{error:'Muitas tentativas. Tente mais tarde.'},{'Retry-After':'900'});
     const data=await sql.query('SELECT id,login,password_hash,role FROM app_users WHERE login=$1 AND is_active=true LIMIT 1',[login]);
     if(!data[0]||!matches(b.password,data[0].password_hash)){
       await sql.query("INSERT INTO audit_events(entity_type,action,metadata) VALUES('auth','login_failed',jsonb_build_object('fingerprint',$1::text))",[fingerprint]);
       return response(res,401,{error:'Credenciais inválidas'});
     }
     const token=randomBytes(32).toString('hex'),expires=new Date(Date.now()+8*3600000).toISOString();
     await sql.query('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[hexhash(token),data[0].id,expires]);
     return response(res,200,{ok:true,user:{id:data[0].id,login:data[0].login,role:data[0].role}},{'Set-Cookie':cookie(token,28800)});
   }
   if(resource==='auth'&&id==='logout'&&method==='POST'){
     const token=sessionToken(req);
     if(token)await sql.query('UPDATE app_sessions SET revoked_at=now() WHERE token_hash=$1',[hexhash(token)]);
     return response(res,200,{ok:true},{'Set-Cookie':cookie('',0)});
   }
   const user=await who(req,sql);
   if(!user)return response(res,401,{error:'Sessão necessária'});
   if(resource==='me'&&method==='GET')return response(res,200,user);
   if(resource==='clients'){
     if(method==='GET'){
       if(id){if(!uuid(id))return response(res,400,{error:'Identificador inválido'});const r=await sql.query('SELECT * FROM clients WHERE id=$1 LIMIT 1',[id]);return r[0]?response(res,200,r[0]):notFound(res)}
       return response(res,200,await sql.query('SELECT * FROM clients ORDER BY created_at DESC LIMIT 200',[]));
     }
     if(method==='POST'){
       if(!writable(user))return noAccess(res);
       const b=await readBody(req),id=randomUUID(),name=requireField(b.name,'Nome');
       const row=await sql.query('INSERT INTO clients(id,name,tax_id,email,phone,address,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
         [id,name,opt(b.tax_id,18),opt(b.email,254),opt(b.phone,40),opt(b.address,800),user.id]);
       await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,'clients',$2,'create')",[user.id,id]);
       return response(res,201,row[0]);
     }
   }
   if(resource==='projects'){
     if(method==='GET')return response(res,200,await sql.query('SELECT p.*,c.name AS client_name FROM projects p JOIN clients c ON c.id=p.client_id ORDER BY p.created_at DESC LIMIT 200',[]));
     if(method==='POST'){
       if(!writable(user))return noAccess(res);
       const b=await readBody(req);if(!uuid(b.client_id))return response(res,400,{error:'Cliente inválido'});
       const id=randomUUID(),title=requireField(b.title,'Obra');
       const row=await sql.query('INSERT INTO projects(id,client_id,title,address) VALUES($1,$2,$3,$4) RETURNING *',[id,b.client_id,title,opt(b.address,800)]);
       await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,'projects',$2,'create')",[user.id,id]);
       return response(res,201,row[0]);
     }
   }
   if(resource==='budgets'){
     if(method==='GET'&&!id)return response(res,200,await sql.query('SELECT b.id,b.code,b.title,b.status,b.reference_month,b.regime,b.bdi_pct,c.name AS client_name FROM budgets b JOIN clients c ON c.id=b.client_id ORDER BY b.created_at DESC LIMIT 200',[]));
     if(method==='GET'&&id&&uuid(id)){
       const b=await sql.query('SELECT b.*,c.name AS client_name FROM budgets b JOIN clients c ON c.id=b.client_id WHERE b.id=$1',[id]);
       if(!b.length)return notFound(res);
       const items=await sql.query('SELECT * FROM budget_items WHERE budget_id=$1 ORDER BY position',[id]);
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
       const r=await sql.query('INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
         [id,code,b.client_id,projectId,title,month,regime,bdi,user.id]);
       await sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES($1,'budgets',$2,'create')",[user.id,id]);
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
