import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('porta de entrada publicada abre o painel autenticado e nunca a demo',()=>{
 const v=JSON.parse(source('vercel.json'));
 const landing=v.redirects.find(x=>x.source==='/');
 const legacy=v.redirects.find(x=>x.source==='/index.html');
 for(const rule of [landing,legacy]){
  assert.ok(rule,'Redirecionamento obrigatório ausente');
  assert.equal(rule.destination,'/secure.html');
  assert.equal(rule.permanent,false);
 }
 assert.ok(v.rewrites.some(x=>x.source==='/api/v1/:route*'));
 const secure=source('public/secure.html');
 assert.match(secure,/secure\.js/);
 assert.doesNotMatch(secure,/demo-api\.js/);
});

test('login e painel não oferecem mais a demonstração como operação real',()=>{
 const script=source('public/secure.js');
 assert.doesNotMatch(script,/Voltar à demonstração/);
 assert.doesNotMatch(script,/Primeira configuração do administrador/);
 assert.match(script,/Acesso seguro/);
 assert.match(script,/release-readiness/);
 assert.match(script,/Verificar liberação real do sistema/);
});

test('diagnóstico de liberação exige administrador e respeita bloqueio comercial',()=>{
 const script=source('public/secure.js');
 const service=source('src/stage5-readiness-api.mjs');
 assert.match(script,/state\.user\?\.role!=='administrador'/);
 assert.match(script,/report\.commercial_release/);
 assert.match(service,/user\.role!=='administrador'/);
 assert.match(service,/commercial_release:false/);
});

test('smoke remoto exige redirecionamento, API, autenticação e banco',()=>{
 const smoke=source('scripts/verify-remote-stage1.mjs');
 assert.match(smoke,/GET \/ -> HTTP/);
 assert.match(smoke,/redirect:'manual'/);
 assert.match(smoke,/\/api\/v1\/health/);
 assert.match(smoke,/\/api\/v1\/auth\/status/);
});

test('smoke aceita arquivos com query de versão e não declara falha falsa',()=>{
 const smoke=source('scripts/verify-remote-stage1.mjs');
 const html=source('public/secure.html');
 assert.ok(smoke.includes("marker:'src=\"/secure.js'"),'O marcador deve aceitar o sufixo de versão');
 assert.ok(html.includes('src="/secure.js?v='),'O painel publica versão de cache do arquivo JS');
});

test('monitoração de produção é diária, só consulta e não precisa de secrets',()=>{
 const workflow=source('.github/workflows/production-smoke.yml');
 assert.match(workflow,/schedule:/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.ok(workflow.includes('contents: read'));
 assert.ok(workflow.includes('node scripts/verify-remote-stage1.mjs'));
 assert.doesNotMatch(workflow,/CIVOLTEN_BACKUP_DATABASE_URL|VERCEL_TOKEN|INSERT INTO|DELETE FROM/);
});
