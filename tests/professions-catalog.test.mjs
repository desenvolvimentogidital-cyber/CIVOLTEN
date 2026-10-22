import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import api from '../api/data.mjs';

const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const boot=fs.readFileSync(new URL('../api/bootstrap.mjs',import.meta.url),'utf8');
const endpoint=fs.readFileSync(new URL('../api/data.mjs',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261021_cv_professions_catalog.sql',import.meta.url),'utf8');

test('catalogo tem mais de 80 profissoes de construcao e eletrica, sem tabelas de precos',()=>{
 const names=[...migration.matchAll(/\('([^']+)'\)/g)].map(x=>x[1]);
 assert.ok(names.length>=80, 'uma lista abrangente de profissoes');
 for(const value of ['Pedreiro','Eletricista','Encanador','Instalador de drywall','Ajudante de eletricista','Porcelanatista']){
  assert.ok(names.includes(value),value);
 }
 assert.doesNotMatch(migration,/\bdaily_cents\b|\bsinapi\b|\bcub_reference\b|\bprice_cents\b/);
});

test('Supabase restringe a lista e a inclusao a quem for administrador aprovado',()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.cv_professions from anon,authenticated/);
 assert.match(migration,/owner_id is null or owner_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/with check \(owner_id=\(select auth\.uid\(\)\) and \(select cv_private\.is_admin\(\)\)\)/);
 assert.match(migration,/owner_id uuid default auth\.uid\(\)/);
 assert.match(boot,/professions:'cv_professions'/);
 assert.match(endpoint,/professions:\['cv_professions','name'\]/);
 assert.match(endpoint,/if\(!await authorized\(jwt\)\)/);
});

test('clique no campo exibe a lista completa; digitar filtra com acentos',()=>{
 assert.match(app,/function professionNames\(\)/);
 assert.match(app,/\.normalize\('NFD'\)/);
 assert.match(app,/\.includes\(query\)/);
 assert.match(app,/professionNames\(\)\.filter/);
 assert.match(app,/if\(ev\.target\.id==='workerProfession'\)showProfessionOptions/);
 assert.match(app,/role="listbox"/);
 assert.match(app,/role="option"/);
 assert.match(app,/aria-expanded="false"/);
 assert.match(css,/\.profession-suggestions\{/);
 assert.match(css,/max-height:245px;overflow-y:auto/);
});

test('o profissional cadastrado permanece pesquisavel em orcamentos',()=>{
 assert.match(app,/id="workerSearch"/);
 assert.match(app,/id="workerSelect"/);
 assert.match(app,/function updateWorkerChoices\(\)/);
 assert.match(app,/normalizeProfession\(x\.name\+' '\+x\.profession\)/);
 assert.match(app,/if\(e\.id==='workerSearch'\)\{updateWorkerChoices\(\);return\}/);
 assert.match(app,/const workers=state\.data\.workers\.filter\(x=>x\.active&&\(x\.cost_mode\?\?'monthly'\)==='project'\)/);
});

test('salva profissao personalizada apenas depois de cadastrar o funcionario',()=>{
 const code=app.slice(app.indexOf('async function saveEntity('),app.indexOf('async function saveSettings('));
 assert.ok(code.indexOf("await request(route(entity,id),method,{record})")<code.indexOf("await request(route('professions'),'POST',{record:{name:record.profession}})"));
 assert.match(code,/entity==='workers'/);
 assert.match(code,/profissões|profissão/);
 assert.match(app,/row\.profession\|\|row\.name/);
});

test('API de profissoes bloqueia acesso sem sessao',async()=>{
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Nunca deve consultar o banco sem sessao')};
 try{
  const res=await api.fetch(new Request('https://civolten.example.test/api/data?entity=professions',{headers:{'sec-fetch-site':'same-origin'}}));
  assert.equal(res.status,401);
  assert.equal(calls,0);
 }finally{globalThis.fetch=previous}
});
