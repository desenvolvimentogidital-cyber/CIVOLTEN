import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {computeBudget,calculatePlan} from './src/calc.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.join(root,'public');
const dbDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(root,'data');
fs.mkdirSync(dbDir,{recursive:true});
const db=new DatabaseSync(path.join(dbDir,'civolten.sqlite'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,type TEXT DEFAULT 'Pessoa jurídica',doc TEXT DEFAULT '',email TEXT DEFAULT '',phone TEXT DEFAULT '',contact TEXT DEFAULT '',address TEXT DEFAULT '',city TEXT DEFAULT '',status TEXT DEFAULT 'Ativo',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT,client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,name TEXT NOT NULL,type TEXT DEFAULT 'Obra',address TEXT DEFAULT '',status TEXT DEFAULT 'Planejamento',notes TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL,description TEXT NOT NULL,unit TEXT DEFAULT 'un',cost REAL DEFAULT 0,hh_per_unit REAL DEFAULT 0,source TEXT DEFAULT 'PRÓPRIA',reference_month TEXT DEFAULT '',regime TEXT DEFAULT '',category TEXT DEFAULT '',UNIQUE(code,source,reference_month,regime));
CREATE TABLE IF NOT EXISTS budgets (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,title TEXT NOT NULL,status TEXT DEFAULT 'Rascunho',reference_month TEXT DEFAULT '2026-07',regime TEXT DEFAULT 'Sem desoneração',bdi REAL DEFAULT 25,safety_pct REAL DEFAULT 15,workers INTEGER DEFAULT 2,hours_day REAL DEFAULT 8,efficiency REAL DEFAULT .8,work_days_week INTEGER DEFAULT 5,start_date TEXT DEFAULT '',payment_terms TEXT DEFAULT 'A negociar',validity_days INTEGER DEFAULT 30,notes TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT,budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,catalog_id INTEGER REFERENCES catalog(id) ON DELETE SET NULL,code TEXT DEFAULT '',description TEXT NOT NULL,unit TEXT DEFAULT 'un',qty REAL NOT NULL,unit_cost REAL NOT NULL,hh_unit REAL DEFAULT 0,team TEXT DEFAULT '',sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS proposals (id INTEGER PRIMARY KEY AUTOINCREMENT,budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,code TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
const defaultSettings={company:'CIVOLTEN — Elétrica & Construção Civil',cnpj:'',phone:'',email:'',address:'',footer:'Soluções em elétrica e construção civil.',proposalIntro:'A CIVOLTEN apresenta sua proposta comercial para execução dos serviços detalhados neste documento.',proposalWarranty:'Conforme contrato e legislação aplicável.'};
for(const [k,v] of Object.entries(defaultSettings)) db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k,v);
const getAll = sql => db.prepare(sql).all();
const getSettings=()=>Object.fromEntries(getAll('SELECT key,value FROM settings').map(x=>[x.key,x.value]));
const hashPassword=(pass,salt)=>crypto.scryptSync(pass,salt,64).toString('hex');
const parseCookie=req=>Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(v=>{const i=v.indexOf('=');return [v.slice(0,i).trim(),v.slice(i+1).trim()]}));
const now=()=>Date.now();
const isAuthed=req=>{const token=parseCookie(req).civolten_session;if(!token)return false;const record=db.prepare('SELECT expires_at FROM sessions WHERE token_hash=?').get(crypto.createHash('sha256').update(token).digest('hex'));return Boolean(record && record.expires_at>now())};
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const fail=(res,message,status=400)=>json(res,{error:message},status);
const num=(v, min=0,max=1e12)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(`Número inválido: ${v}`);return n;};
const txt=(v,max=5000)=>String(v??'').trim().slice(0,max);
const required=(v,k)=>{const s=txt(v);if(!s)throw Error(`Campo obrigatório: ${k}`);return s;};
const idNum=v=>num(v,1,1e9);
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>5_000_000)throw Error('Arquivo excede 5 MB');}return data?JSON.parse(data):{};}
const sel=(table,id)=>db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
function save(table, obj, fields, id=null){
 const data=Object.fromEntries(fields.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
 if(!Object.keys(data).length)throw Error('Nenhum dado informado');
 if(id){const row=sel(table,id);if(!row)throw Error('Registro não encontrado');db.prepare(`UPDATE ${table} SET ${Object.keys(data).map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...Object.values(data),id);return id;}
 const keys=Object.keys(data);return Number(db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(data)).lastInsertRowid);
}
const fields={clients:['name','type','doc','email','phone','contact','address','city','status'],projects:['client_id','name','type','address','status','notes'],budgets:['client_id','project_id','title','status','reference_month','regime','bdi','safety_pct','workers','hours_day','efficiency','work_days_week','start_date','payment_terms','validity_days','notes'],items:['catalog_id','code','description','unit','qty','unit_cost','hh_unit','team','sort_order']};
function validate(table,b){
 const x={...b};
 if(['clients','projects'].includes(table))x.name=required(x.name??'', 'Nome');
 if(table==='budgets'){x.title=required(x.title,'Título');x.client_id=idNum(x.client_id);if(x.project_id)x.project_id=idNum(x.project_id);else x.project_id=null; x.bdi=num(x.bdi??25,0,200);x.safety_pct=num(x.safety_pct??15,0,100);x.workers=num(x.workers??2,1,1000);x.hours_day=num(x.hours_day??8,1,24);x.efficiency=num(x.efficiency??.8,.1,1);x.work_days_week=num(x.work_days_week??5,5,6);x.validity_days=num(x.validity_days??30,1,365);}
 if(table==='projects')x.client_id=idNum(x.client_id);
 if(table==='items'){x.description=required(x.description,'Descrição');x.qty=num(x.qty,0);x.unit_cost=num(x.unit_cost,0);x.hh_unit=num(x.hh_unit??0,0);x.catalog_id=x.catalog_id?idNum(x.catalog_id):null;}
 return x;
}
function budgetDetails(id){const b=db.prepare(`SELECT b.*,c.name client_name,c.doc client_doc,c.email client_email,c.phone client_phone,p.name project_name,p.address project_address FROM budgets b LEFT JOIN clients c ON b.client_id=c.id LEFT JOIN projects p ON b.project_id=p.id WHERE b.id=?`).get(id);if(!b)throw Error('Orçamento não encontrado');const items=db.prepare('SELECT * FROM items WHERE budget_id=? ORDER BY sort_order,id').all(id);return {...b,items,...calculatePlan(items,b)};}
const route=async (req,res,url)=>{
 const parts=url.pathname.split('/').filter(Boolean);
 const [_,kind,p3,p4]=parts;
 const method=req.method;
 if(kind==='auth'){
   if(p3==='status'&&method==='GET')return json(res,{setupRequired:!db.prepare('SELECT id FROM admin WHERE id=1').get(),authenticated:isAuthed(req)});
   if(p3==='setup'&&method==='POST'){
     if(db.prepare('SELECT id FROM admin WHERE id=1').get())return fail(res,'Administrador já configurado',409);
     const b=await body(req);const password=txt(b.password,512);if(password.length<10)return fail(res,'Use senha de pelo menos 10 caracteres');
     const salt=crypto.randomBytes(16).toString('hex');db.prepare('INSERT INTO admin(id,username,password_hash,salt) VALUES(1,?,?,?)').run(required(b.username,'Usuário'),hashPassword(password,salt),salt);return json(res,{ok:true});
   }
   if(p3==='login'&&method==='POST'){
     const b=await body(req);const admin=db.prepare('SELECT * FROM admin WHERE id=1').get();if(!admin||txt(b.username)!==admin.username||hashPassword(String(b.password??''),admin.salt)!==admin.password_hash)return fail(res,'Credenciais incorretas',401);
     const token=crypto.randomBytes(32).toString('hex'), exp=now()+7*24*60*60*1000;db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now());db.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),exp);
     res.setHeader('Set-Cookie',`civolten_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=604800${process.env.HTTPS==='true'?'; Secure':''}`);return json(res,{ok:true});
   }
   if(p3==='logout'&&method==='POST'){const token=parseCookie(req).civolten_session;if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));res.setHeader('Set-Cookie','civolten_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');return json(res,{ok:true});}
 }
 if(!isAuthed(req))return fail(res,'Sessão necessária',401);
 if(kind==='settings'){
   if(method==='GET')return json(res,getSettings());
   if(method==='PUT'){const b=await body(req);db.exec('BEGIN');try{for(const k of Object.keys(defaultSettings))if(k in b)db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(k,txt(b[k],2000));db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return json(res,getSettings());}
 }
 if(kind==='dashboard'&&method==='GET'){
   const budgets=getAll(`SELECT b.*,c.name client_name,p.name project_name,COALESCE((SELECT SUM(i.qty*i.unit_cost) FROM items i WHERE i.budget_id=b.id),0)*(1+b.bdi/100) total FROM budgets b LEFT JOIN clients c ON c.id=b.client_id LEFT JOIN projects p ON p.id=b.project_id ORDER BY b.id DESC`);
   const counts={active:budgets.filter(x=>!['Aprovado','Perdido'].includes(x.status)).length,sent:budgets.filter(x=>x.status==='Enviado').length,works:getAll("SELECT count(*) as n FROM projects WHERE status='Em andamento'")[0].n,negotiation:budgets.filter(x=>['Enviado','Em análise'].includes(x.status)).reduce((s,x)=>s+x.total,0),clients:getAll('SELECT count(*) n FROM clients')[0].n};return json(res,{counts,budgets:budgets.slice(0,7),pipeline:['Rascunho','Enviado','Em análise','Aprovado','Perdido'].map(status=>({status,count:budgets.filter(x=>x.status===status).length}))});
 }
 if(kind==='catalog'){
   if(method==='GET')return json(res,db.prepare('SELECT * FROM catalog WHERE description LIKE ? OR code LIKE ? ORDER BY source DESC,description LIMIT 500').all(...Array(2).fill(`%${txt(url.searchParams.get('q')||'',120)}%`)));
   if(p3==='import'&&method==='POST'){
     const b=await body(req);if(!Array.isArray(b.entries)||b.entries.length>3000)throw Error('Importe lotes de até 3000 registros');
     const ref=required(b.reference_month,'Data-base'),source=txt(b.source||'SIURB',30),regime=txt(b.regime||'Sem desoneração',80);let inserted=0;
     db.exec('BEGIN');try{const insert=db.prepare(`INSERT INTO catalog(code,description,unit,cost,hh_per_unit,source,reference_month,regime,category) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(code,source,reference_month,regime) DO UPDATE SET description=excluded.description,unit=excluded.unit,cost=excluded.cost,hh_per_unit=excluded.hh_per_unit,category=excluded.category`);
       for(const e of b.entries){if(!txt(e.code)||!txt(e.description))continue;if(source==='SIURB' && (/^DEMO-/i.test(txt(e.code)) || /NÃO É SIURB/i.test(txt(e.description)))) throw Error('Registros demonstrativos não podem ser classificados como SIURB');insert.run(txt(e.code,80),txt(e.description,500),txt(e.unit||'un',20),num(e.cost,0),num(e.hh_per_unit??0,0),source,ref,regime,txt(e.category||'Geral',100));inserted++;}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e}return json(res,{inserted});
   }
 }
 if(['clients','projects','budgets'].includes(kind) && !p4){
   const id=p3?idNum(p3):null;
   if(method==='GET'&&!id){
     let sql={clients:'SELECT * FROM clients ORDER BY id DESC',projects:'SELECT p.*,c.name client_name FROM projects p JOIN clients c ON c.id=p.client_id ORDER BY p.id DESC',budgets:'SELECT b.*,c.name client_name,p.name project_name,COALESCE((SELECT SUM(i.qty*i.unit_cost) FROM items i WHERE i.budget_id=b.id),0)*(1+b.bdi/100) total FROM budgets b JOIN clients c ON c.id=b.client_id LEFT JOIN projects p ON p.id=b.project_id ORDER BY b.id DESC'}[kind];return json(res,getAll(sql));
   }
   if(method==='GET'&&id){return json(res,kind==='budgets'?budgetDetails(id):sel(kind,id));}
   if(method==='POST'&&!id){let b=validate(kind,await body(req));if(kind==='budgets'){b.code=`ORC-${new Date().getFullYear()}-${String((db.prepare('SELECT MAX(id) mx FROM budgets').get().mx||0)+1).padStart(4,'0')}`;}
     const newId=save(kind,b,fields[kind].concat(kind==='budgets'?['code']:[]));return json(res,kind==='budgets'?budgetDetails(newId):sel(kind,newId),201);
   }
   if(method==='PUT'&&id){let b={...sel(kind,id),...await body(req)};b=validate(kind,b);save(kind,b,fields[kind],id);if(kind==='budgets')db.prepare('UPDATE budgets SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);return json(res,kind==='budgets'?budgetDetails(id):sel(kind,id));}
   if(method==='DELETE'&&id){db.prepare(`DELETE FROM ${kind} WHERE id=?`).run(id);return json(res,{ok:true});}
   if(kind==='budgets'&&id&&p4==='items'){/* handled below */}
 }
 if(kind==='budgets'&&p3&&p4==='items'){
   const budgetId=idNum(p3);if(!sel('budgets',budgetId))throw Error('Orçamento não encontrado');
   const itemId=parts[4]?idNum(parts[4]):null;
   if(method==='POST'&&!itemId){const b=validate('items',await body(req));const id=save('items',{...b,budget_id:budgetId},fields.items.concat(['budget_id']));return json(res,sel('items',id),201);}
   if(method==='PUT'&&itemId){const existing=sel('items',itemId);if(!existing||existing.budget_id!==budgetId)throw Error('Item não encontrado');const b=validate('items',{...existing,...await body(req)});save('items',b,fields.items,itemId);return json(res,sel('items',itemId));}
   if(method==='DELETE'&&itemId){db.prepare('DELETE FROM items WHERE id=? AND budget_id=?').run(itemId,budgetId);return json(res,{ok:true});}
 }
 if(kind==='proposals'){
   if(method==='GET'&&!p3)return json(res,getAll('SELECT pr.id,pr.budget_id,pr.code,pr.created_at,b.title,c.name client_name FROM proposals pr JOIN budgets b ON b.id=pr.budget_id JOIN clients c ON c.id=b.client_id ORDER BY pr.id DESC'));
   if(method==='GET'&&p3)return json(res,sel('proposals',idNum(p3)));
   if(method==='POST'){
     const b=await body(req),id=idNum(b.budget_id),content=budgetDetails(id),code=`PROP-${new Date().getFullYear()}-${String((db.prepare('SELECT MAX(id) mx FROM proposals').get().mx||0)+1).padStart(4,'0')}`;
     if(!content.items.length || content.summary.total<=0)throw Error('Inclua itens e valores válidos antes de emitir a proposta.');const snapshot={...content,company:getSettings(),issued_at:new Date().toISOString()};const inserted=Number(db.prepare('INSERT INTO proposals(budget_id,code,content) VALUES(?,?,?)').run(id,code,JSON.stringify(snapshot)).lastInsertRowid);
     return json(res,{id:inserted,code,content:JSON.stringify(snapshot)},201);
   }
 }
 return fail(res,'Rota não encontrada',404);
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
   const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
   res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
   if(u.pathname.startsWith('/api/')){
     if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)return fail(res,'Origem não permitida',403);}
     return await route(req,res,u);
   }
   if(!['GET','HEAD'].includes(req.method))return fail(res,'Método não permitido',405);
   const requested=path.resolve(webRoot,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
   if(!requested.startsWith(webRoot+path.sep))return fail(res,'Arquivo não permitido',403);
   let stat;try{stat=fs.statSync(requested)}catch{return fail(res,'Arquivo não encontrado',404)}
   if(!stat.isFile())return fail(res,'Arquivo não encontrado',404);
   res.writeHead(200,{'Content-Type':mime[path.extname(requested)]||'application/octet-stream','Cache-Control':requested.endsWith('.html')?'no-cache':'public,max-age=3600','X-Content-Type-Options':'nosniff'});
   fs.createReadStream(requested).pipe(res);
 }catch(e){if(!res.headersSent)fail(res,e.message,e.message.includes('FOREIGN KEY')?409:400);else res.end();console.error('[CIVOLTEN]',e.message)}
});
const port=Number(process.env.PORT||3100),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`CIVOLTEN iniciado: http://${host}:${port} (login inicial obrigatório)`));