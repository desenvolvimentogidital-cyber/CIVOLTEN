/* Offline, fully verified SIURB supplementary data export for code-reviewable Git chunks.
 * The source dataset has been checked by the original eight-file SHA256 audit
 * and normalization script. This step does NOT connect to or change Neon.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const payload=JSON.parse(await readFile('artifacts/siurb-supplements-normalized.json','utf8'));
const modes=['sem','com'],kinds=['horista','equipamentos','insumos','auxiliares'];
if(payload.reference_month!=='2026-07'||payload.sources?.length!==8||
 payload.prices?.length!==5828||payload.auxiliaries?.length!==232||
 payload.commercial_release!==false||
 payload.counts?.auxiliaries_reconciled!==222)
 throw new Error('SIURB: auditoria incompleta, importação proibida');
const sha=s=>/^[a-f0-9]{64}$/.test(String(s));
for(const source of payload.sources)if(!sha(source.sha256)||
 !modes.includes(source.regime)||!kinds.includes(source.kind)||
 !source.url?.startsWith('https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/'))
 throw new Error('Fonte SIURB fora do padrão oficial');
const folder='data/siurb-supplements-2026-07';
await mkdir(folder,{recursive:true});
const manifest={reference_month:payload.reference_month,commercial_release:false,
 source_page:payload.source_page,counts:payload.counts,sources:[]};
for(const regime of modes)for(const kind of kinds){
 const source=payload.sources.find(s=>s.regime===regime&&s.kind===kind);
 if(!source)throw new Error('Fonte ausente: '+regime+'/'+kind);
 const records=kind==='auxiliares'?
  payload.auxiliaries.filter(p=>p.regime===regime):
  payload.prices.filter(p=>p.regime===regime&&p.kind===kind);
 const expected=kind==='auxiliares'?source.auxiliary_rows:source.price_rows;
 if(records.length!==expected)throw new Error('Contagem inesperada: '+regime+'/'+kind);
 if(records.some(p=>p.source_sha256!==source.sha256||
  (kind!=='auxiliares'&&(p.kind!==kind||!p.variant||!p.unit_cost))))
  throw new Error('Preço sem proveniência '+regime+'/'+kind);
 const file=regime+'-'+kind+'.json';
 const wrapper={reference_month:'2026-07',regime,kind,
  source:{url:source.url,sha256:source.sha256},rows:records,
  commercially_approved:false};
 await writeFile(join(folder,file),JSON.stringify(wrapper)+'\n','utf8');
 manifest.sources.push({regime,kind,file,source_sha256:source.sha256,rows:records.length});
}
await writeFile(join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log('Oito tabelas publicas SIURB geradas com hashes/contagens revisados.',
 manifest.counts,'Nao gravou em banco de dados.');
