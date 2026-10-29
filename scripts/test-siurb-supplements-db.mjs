/** Stage2 QA: importação idempotente em PostgreSQL TEMPORÁRIO, nunca em Neon. */
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const execute=promisify(execFile);
const url=process.env.DATABASE_URL||'';
let parsed;
try{parsed=new URL(url)}catch{throw Error('CIVOLTEN QA database URL ausente')}
if(!['localhost','127.0.0.1'].includes(parsed.hostname)||parsed.pathname!=='/civolten_test'||process.env.CI!=='true')
 throw new Error('Teste somente em PostgreSQL descartável local de CI');
const pool=new pg.Pool({connectionString:url,max:2});
try{
 await pool.query(await readFile(new URL('../db/migrations/0009_siurb_supplements.sql',import.meta.url),'utf8'));
 const env={...process.env,CIVOLTEN_SUPPLEMENTS_IMPORT_CONFIRM:'importar-civolten-qa'};
 const command=[new URL('./import-siurb-supplements-neon.mjs',import.meta.url).pathname];
 await execute(process.execPath,command,{env,timeout:120000});
 await execute(process.execPath,command,{env,timeout:120000});
 const r=await pool.query(`SELECT
  (SELECT count(*)::int FROM siurb_supplement_sources) AS sources,
  (SELECT count(*)::int FROM siurb_supplement_prices) AS prices,
  (SELECT count(*)::int FROM siurb_auxiliary_compositions) AS auxiliaries,
  (SELECT count(*)::int FROM siurb_auxiliary_compositions WHERE arithmetically_reconciled) AS reconciled,
  (SELECT count(*)::int FROM siurb_auxiliary_compositions WHERE commercially_approved) AS approved`);
 const d=r.rows[0],expected={sources:8,prices:5828,auxiliaries:232,reconciled:222,approved:0};
 for(const [key,v] of Object.entries(expected))if(d[key]!==v)throw new Error('Contagem QA divergente: '+key+'='+d[key]+' esperado '+v);
 console.log('QA PostgreSQL isolamento/importação idempotente aprovada:',JSON.stringify(d));
}finally{await pool.end()}
