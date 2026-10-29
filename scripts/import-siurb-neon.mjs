/* CIVOLTEN: importação reprodutível dos 6.988 custos e 6.926 composições SIURB.
 * Exige confirmação explícita e URL privada de banco DEV; nunca executa por padrão.
 */
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';

const prices=JSON.parse(await readFile(new URL('../public/data/siurb-2026-07.json',import.meta.url),'utf8'));
const comps=JSON.parse(await readFile(new URL('../public/data/siurb-compositions-2026-07.json',import.meta.url),'utf8'));
const key=x=>[x.category||x.group,x.regime].join('|');
if(prices.meta.reference_month!=='2026-07'||comps.meta.reference_month!=='2026-07'||prices.items.length!==6988||comps.items.length!==6926)
 throw Error('Arquivos SIURB não correspondem à versão aprovada de julho de 2026');
if(prices.meta.origins.reduce((s,o)=>s+o.count,0)!==6988||comps.meta.origins.reduce((s,o)=>s+o.count,0)!==6926)
 throw Error('Totais da proveniência SIURB divergentes');
const pgroup=new Map(),cgroup=new Map();
for(const row of prices.items){if(!row.code||!Number.isFinite(row.cost)||row.cost<0)throw Error('Preço oficial inválido: '+row.code);
 const k=key(row);if(!pgroup.has(k))pgroup.set(k,[]);pgroup.get(k).push(row)}
for(const row of comps.items){if(!row.code||!Array.isArray(row.labor)||!Array.isArray(row.other))throw Error('Composição direta inválida');
 const k=key(row);if(!cgroup.has(k))cgroup.set(k,[]);cgroup.get(k).push(row)}
for(const origin of prices.meta.origins){if((pgroup.get(key(origin))||[]).length!==origin.count)throw Error('Contagem inválida '+key(origin))}
for(const origin of comps.meta.origins){if((cgroup.get(key(origin))||[]).length!==origin.count)throw Error('Contagem inválida '+key(origin))}
if(process.argv.includes('--dry-run')){
 console.log('SIURB validada: preços='+prices.items.length+' composições='+comps.items.length+' sem ficha='+(prices.items.length-comps.items.length));
 process.exit(0);
}
const url=process.env.DATABASE_URL||'';
let target;
try{target=new URL(url)}catch{throw Error('Defina DATABASE_URL somente em ambiente seguro')}
if(!['postgres:','postgresql:'].includes(target.protocol)||target.pathname!=='/civolten'||!target.hostname.endsWith('.neon.tech')||
 process.env.CIVOLTEN_IMPORT_CONFIRM!=='importar-civolten-dev')
 throw Error('Importação bloqueada. Requer banco CIVOLTEN de desenvolvimento e confirmação CIVOLTEN_IMPORT_CONFIRM');
const client=new Pool({connectionString:url,max:1,connectionTimeoutMillis:15000});
const tx=await client.connect();
try{
 await tx.query('BEGIN');
 for(const origin of prices.meta.origins){
  const rows=await tx.query(
   "INSERT INTO reference_price_versions(source,reference_month,regime,scope,source_url,sha256,published_at) VALUES('SIURB','2026-07',$1,$2,$3,$4,'2026-10-01') ON CONFLICT(source,reference_month,regime,scope,sha256) DO UPDATE SET source_url=EXCLUDED.source_url RETURNING id",
   [origin.regime,origin.group,origin.source_url,origin.sha256]);
  const versionId=rows.rows[0].id;
  for(let i=0;i<(pgroup.get(key(origin))||[]).length;i+=150){
   const payload=pgroup.get(key(origin)).slice(i,i+150).map(x=>({code:x.code,description:x.description,unit:x.unit,cost:x.cost}));
   await tx.query("INSERT INTO reference_prices(version_id,code,description,unit,unit_cost) SELECT $1::uuid,x.code,x.description,x.unit,x.cost FROM jsonb_to_recordset($2::jsonb) AS x(code text,description text,unit text,cost numeric) ON CONFLICT(version_id,code) DO NOTHING",
    [versionId,JSON.stringify(payload)]);
  }
  const originComps=cgroup.get(key(origin))||[];
  for(let i=0;i<originComps.length;i+=120){
   const payload=originComps.slice(i,i+120).map(x=>({code:x.code,labor:x.labor,other:x.other,hh:x.direct_hh_per_unit,validation:x.labor_validation}));
   await tx.query("INSERT INTO reference_composition_details(reference_price_id,labor,other,direct_hh_per_unit,validation) SELECT p.id,x.labor,x.other,x.hh,x.validation FROM jsonb_to_recordset($2::jsonb) AS x(code text,labor jsonb,other jsonb,hh numeric,validation text) JOIN reference_prices p ON p.version_id=$1 AND p.code=x.code ON CONFLICT(reference_price_id) DO NOTHING",
    [versionId,JSON.stringify(payload)]);
  }
  const verified=await tx.query("SELECT (SELECT count(*)::int FROM reference_prices WHERE version_id=$1) prices,(SELECT count(*)::int FROM reference_composition_details d JOIN reference_prices p ON p.id=d.reference_price_id WHERE p.version_id=$1) compositions",[versionId]);
  const expectedComps=originComps.length;
  if(verified.rows[0].prices!==origin.count||verified.rows[0].compositions!==expectedComps)
   throw Error('Importação incompleta em '+key(origin)+'. Transação será cancelada.');
 }
 await tx.query("UPDATE reference_prices p SET workforce_hh_direct=d.direct_hh_per_unit,productivity_status=CASE WHEN d.direct_hh_per_unit IS NULL THEN 'pendente' ELSE 'direta_parcial' END FROM reference_composition_details d WHERE p.id=d.reference_price_id");
 await tx.query('COMMIT');
 console.log('Importação SIURB concluída e verificada: '+prices.items.length+' preços; '+comps.items.length+' composições diretas');
}catch(e){await tx.query('ROLLBACK');throw e}
finally{tx.release();await client.end()}
