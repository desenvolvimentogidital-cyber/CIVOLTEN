/**
 * Importação explícita e transacional dos suplementos SIURB 07/2026.
 * Fonte: artifacts/siurb-supplements-normalized.json gerado por
 * scripts/audit-siurb-supplements.py e scripts/build-siurb-supplements.py.
 * Usar APENAS no banco CIVOLTEN de desenvolvimento / QA aprovado.
 */
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';

const input=process.argv.find(x=>x.startsWith('--file='))?.slice(7)||'artifacts/siurb-supplements-normalized.json';
const dataset=JSON.parse(await readFile(input,'utf8'));
const shaPattern=/^[a-f0-9]{64}$/;
const sourceKey=s=>s.regime+'|'+s.kind;
const knownKinds=['horista','equipamentos','insumos','auxiliares'];
const regimeNames={sem:'Sem desoneração',com:'Com desoneração'};
function assert(ok,msg){if(!ok)throw new Error(msg)}
assert(dataset.reference_month==='2026-07','Data-base incorreta');
assert(dataset.commercial_release===false,'Fonte deve permanecer não comercial');
assert(dataset.sources?.length===8,'São necessários exatamente 8 arquivos verificados');
assert(dataset.prices?.length===5828,'Quantidade de preços suplementares diferente da auditada');
assert(dataset.auxiliaries?.length===232,'Quantidade de composições auxiliares diferente da auditada');
const sources=new Map();
for(const s of dataset.sources){
 assert(regimeNames[s.regime] && knownKinds.includes(s.kind),'Regime/categoria desconhecidos');
 assert(shaPattern.test(s.sha256),'Hash inválido');
 assert(s.url?.startsWith('https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/'),'Origem inválida');
 const key=sourceKey(s);assert(!sources.has(key),'Fonte duplicada: '+key);sources.set(key,s);
}
for(const kind of knownKinds)for(const regime of ['sem','com'])assert(sources.has(regime+'|'+kind),'Fonte ausente '+regime+'/'+kind);
const seenPrices=new Set();
for(const p of dataset.prices){
 const expected=sources.get(sourceKey(p));
 assert(expected?.sha256===p.source_sha256,'Preço sem fonte rastreável');
 assert(['horista','equipamentos','insumos'].includes(p.kind),'Categoria de preço inválida');
 assert(/^\d{3,9}$/.test(p.code) && p.unit && p.description,'Preço incompleto');
 assert(/^\d+(?:\.\d{1,4})?$/.test(p.unit_cost) && Number(p.unit_cost)>0,'Valor unitário inválido');
 const key=sourceKey(p)+'|'+p.code+'|'+p.variant;
 assert(!seenPrices.has(key),'Preço duplicado: '+key);seenPrices.add(key);
}
const seenAux=new Set();
for(const a of dataset.auxiliaries){
 assert(sources.get(a.regime+'|auxiliares')?.sha256===a.source_sha256,'Composição auxiliar sem origem');
 assert(/^\d{3,9}$/.test(a.code) && a.unit && a.description,'Composição incompleta');
 assert(Array.isArray(a.components) && a.components.length>0,'Auxiliar sem componentes');
 assert(a.commercially_approved===false,'Aprovação comercial indevida');
 const key=a.regime+'|'+a.code;assert(!seenAux.has(key),'Auxiliar duplicada');seenAux.add(key);
}
if(process.argv.includes('--dry-run')){
 console.log('SIURB validada sem escrita:',dataset.prices.length,'preços e',dataset.auxiliaries.length,'auxiliares; 8 SHA-256 conferidos.');
 process.exit(0);
}
const url=process.env.DATABASE_URL||'';
let parsed;
try{parsed=new URL(url)}catch{throw Error('DATABASE_URL indisponível. Configure somente no ambiente seguro.')}
const neonDevelopment=parsed.hostname.endsWith('.neon.tech') &&
   parsed.pathname==='/civolten' &&
   process.env.CIVOLTEN_SUPPLEMENTS_IMPORT_CONFIRM==='importar-civolten-dev';
const isolatedCi=process.env.CI==='true' &&
   ['127.0.0.1','localhost'].includes(parsed.hostname) &&
   parsed.pathname==='/civolten_test' &&
   process.env.CIVOLTEN_SUPPLEMENTS_IMPORT_CONFIRM==='importar-civolten-qa';
if(!['postgres:','postgresql:'].includes(parsed.protocol) || (!neonDevelopment && !isolatedCi))
 throw new Error('Importação bloqueada: exija Neon CIVOLTEN de desenvolvimento ou PostgreSQL descartável de CI.');
const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:15000});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtext('civolten-siurb-supplement-import'))");
 for(const s of dataset.sources){
  const rows=await client.query(
   `INSERT INTO siurb_supplement_sources(reference_month,regime,kind,source_url,sha256)
    VALUES('2026-07',$1,$2,$3,$4)
    ON CONFLICT(reference_month,regime,kind,sha256) DO UPDATE SET source_url=EXCLUDED.source_url
    RETURNING id`,
   [regimeNames[s.regime],s.kind,s.url,s.sha256]);
  const id=rows.rows[0].id;
  if(s.kind==='auxiliares'){
   const items=dataset.auxiliaries.filter(x=>x.regime===s.regime);
   for(let i=0;i<items.length;i+=100){
    const part=items.slice(i,i+100);
    await client.query(
     `INSERT INTO siurb_auxiliary_compositions(source_id,code,description,unit,official_unit_cost,components,
       sum_official_partials,difference_to_official,arithmetically_reconciled,commercially_approved)
      SELECT $1::uuid,r.code,r.description,r.unit,r.official_unit_cost,r.components,
        r.sum_official_partials,r.difference_to_official,r.arithmetically_reconciled,false
      FROM jsonb_to_recordset($2::jsonb) AS r(code text,description text,unit text,
        official_unit_cost numeric,components jsonb,sum_official_partials numeric,
        difference_to_official numeric,arithmetically_reconciled boolean)
      ON CONFLICT(source_id,code) DO NOTHING`,[id,JSON.stringify(part)]);
   }
  }else{
   const items=dataset.prices.filter(x=>x.regime===s.regime&&x.kind===s.kind);
   for(let i=0;i<items.length;i+=150){
    const part=items.slice(i,i+150);
    await client.query(
     `INSERT INTO siurb_supplement_prices(source_id,code,description,unit,kind,variant,unit_cost)
      SELECT $1::uuid,r.code,r.description,r.unit,r.kind,r.variant,r.unit_cost
      FROM jsonb_to_recordset($2::jsonb) AS r(code text,description text,unit text,
       kind text,variant text,unit_cost numeric)
      ON CONFLICT(source_id,code,variant) DO NOTHING`,[id,JSON.stringify(part)]);
   }
  }
  const table=s.kind==='auxiliares'?'siurb_auxiliary_compositions':'siurb_supplement_prices';
  const result=await client.query('SELECT count(*)::int AS total FROM '+table+' WHERE source_id=$1',[id]);
  const expected=s.kind==='auxiliares'?s.auxiliary_rows:s.price_rows;
  assert(result.rows[0].total===expected,'Contagem divergente em '+s.regime+'/'+s.kind);
 }
 await client.query('COMMIT');
 console.log('SIURB suplementos importados para desenvolvimento com proveniência preservada.');
}catch(error){
 await client.query('ROLLBACK');throw error;
}finally{client.release();await pool.end();}
