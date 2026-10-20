import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const browser={};
vm.runInNewContext(read('assets/civolten-table-import.js'),{window:browser,Number,String,Set});
const csv=browser.CIVOLTEN_TABLE_IMPORT;
test('CSV português lê cabeçalho, valores brasileiros, aspas e vírgula decimal',()=>{
 const rows=csv.parseCSV('Código;Descrição;Unidade;Custo\n12345;"Reparo; instalação";M2;1.234,56\n');
 assert.equal(rows.length,1);
 assert.equal(csv.field(rows[0],'codigo'),'12345');
 assert.equal(csv.field(rows[0],'descricao'),'Reparo; instalação');
 assert.equal(csv.numberBR(csv.field(rows[0],'custo')),1234.56);
 const comma=csv.parseCSV('codigo,descricao,unidade\n1234,Pintura,M2\n');
 assert.equal(csv.field(comma[0],'unidade'),'M2');
 assert.throws(()=>csv.parseCSV('codigo;descricao\n1234;"sem fechamento'),/aspas/);
});
test('arquivo XLSX/PDF não é interpretado como CSV ou JSON',async()=>{
 await assert.rejects(csv.loadFile({name:'cub.pdf',size:120,text:async()=>''}),/Formato não suportado/);
 await assert.rejects(csv.loadFile({name:'sinapi.xlsx',size:120,text:async()=>''}),/Formato não suportado/);
});
const cubCtx=vm.createContext({Set,Map,Number,Error});
vm.runInContext(read('supabase/functions/civolten-beta/cub-reference.ts').replace(/^export /gm,'')+
 '\nglobalThis.cub={normalizeCubBatch,publicCubReference,cubAdmin};',cubCtx);
const {normalizeCubBatch,publicCubReference,cubAdmin}=cubCtx.cub;
const official='https://sindusconsp.com.br/servicos/cub/';
const payload=(cost=2650)=>({schema:'civolten.cub.v1',uf:'SP',period:'2026-09',
 items:[{pattern:'R1N',regime:'sem_desoneracao',cost,source_url:official}]});
test('CUB validado para SP com mês, padrão, fonte e sem adulterar preços comerciais',()=>{
 const rows=normalizeCubBatch(payload());
 assert.equal(rows.length,1);
 assert.equal(rows[0].unit_cost,2650);
 assert.equal(rows[0].base_month,'2026-09');
 for(const item of [{period:'2026-13'},{uf:'RJ'},{schema:'outro'}]){
  assert.throws(()=>normalizeCubBatch({...payload(),...item}));
 }
 for(const cost of [0,-9,100001])assert.throws(()=>normalizeCubBatch(payload(cost)));
 assert.throws(()=>normalizeCubBatch({...payload(),items:[payload().items[0],payload().items[0]]}),/duplicados/);
 assert.throws(()=>normalizeCubBatch({...payload(),items:[{...payload().items[0],source_url:'https://evil.example/'}]}));
 const sql=read('supabase/migrations/20261020_cub_reference_rates.sql');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/pricing_catalog/i);
});
test('CUB consulta pública sem cadastro obrigatório e importação exige rota administrativa',async()=>{
 let queryCount=0,upsertRows=null;
 const db={from(name){assert.equal(name,'cub_reference_rates');return {
  select(){queryCount++;return this},eq(){return this},order(){return this},
  limit:async()=>({data:[],error:null}),upsert:async rows=>{upsertRows=rows;return {error:null}}
 }}};
 const publicData=await publicCubReference(db);
 assert.equal(publicData.uf,'SP');
 assert.equal(queryCount,1);
 const result=await cubAdmin({api:'admin-cub-import',req:{method:'POST'},
  db,body:async()=>payload(),out:x=>x,err:e=>({error:e})});
 assert.equal(result.imported,1);
 assert.equal(upsertRows[0].pattern,'R1N');
});
test('Vercel e Supabase só permitem upload técnico em rotas autenticadas',()=>{
 const bff=read('api/admin.mjs'),api=read('supabase/functions/civolten-beta/index.ts');
 for(const name of ['admin-cub-import','admin-cub-list','admin-sinapi-import','admin-sinapi-search','admin-sinapi-compare']){
  assert.ok(bff.includes(name),name+' ausente do BFF');
  assert.ok(api.includes(name),name+' ausente da função');
 }
 const gate=api.indexOf("if(api?.startsWith('admin-'))");
 const source=api.slice(gate,gate+800);
 assert.match(source,/if\(!await admin\(req\)\)/);
 assert.match(read('supabase/functions/civolten-beta/cub-reference.ts'),/CUB_SOURCES/);
 assert.match(read('supabase/functions/civolten-beta/sinapi-reference.ts'),/price_verified/);
});
test('Interface da empresa contém CUB e SINAPI com prévia e arquivo CSV/JSON, também no celular',()=>{
 const html=read('empresa.html');
 for(const target of ['civolten-table-import.js?v=1','civolten-cub-admin.js?v=1',
   'civolten-sinapi-admin.js?v=2','civolten-reference.js?v=3'])
  assert.ok(html.includes(target),target);
 assert.ok(html.includes('Importar tabelas técnicas'));
 assert.match(read('assets/civolten-reference.js'),/CIVOLTEN_CUB_ADMIN/);
 for(const file of ['assets/civolten-cub-admin.js','assets/civolten-sinapi-admin.js']){
  const s=read(file);
  new vm.Script(s,{filename:file});
  assert.match(s,/accept:'.csv,.json/);
  assert.match(s,/Conferir arquivo/);
  assert.doesNotMatch(s,/innerHTML|localStorage|sessionStorage/);
 }
 assert.match(read('assets/civolten-cub.js'),/cub-reference/);
 assert.match(read('assets/civolten-app-unificado.css'),/\.cub-importer/);
 assert.match(read('assets/civolten-cub-admin.js'),/csv/);
 assert.match(read('assets/civolten-table-import.js'),/Formato não suportado/);
});
