import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');

test('apresentacao institucional tem quatro funcionalidades reais',()=>{
 for (const label of ['Orçamentos reais','Equipe e mão de obra','Despesas e impostos','Visão financeira']){
  assert.ok(page.includes(label),label);
 }
 assert.match(page,/id="authFeatures"/);
 assert.match(page,/href="#authFeatures"/);
 assert.match(page,/Como funciona\?/);
});
test('formulários de autenticação e aviso de privacidade são preservados',()=>{
 for(const id of ['login','signupForm','recoverForm','passwordForm','authNotice']){
  assert.ok(page.includes('id="'+id+'"'),id);
 }
 assert.ok(page.includes('data-auth-mode="signup"'));
 assert.doesNotMatch(page,/pendingCard|Solicitar aprovação|data-view="access"/);
 assert.equal((page.match(/class="brand-logo"/g)||[]).length,2);
 assert.equal((page.match(/class="brand-wordmark"/g)||[]).length,2);
});
test('apresentação é responsiva e mantém o PDF sem fundo',()=>{
 assert.match(css,/#loginCard\.auth-card\{/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.match(css,/#loginCard \.auth-feature-grid/);
 assert.match(css,/#loginCard \.auth-overview\{display:none!important\}/);
 assert.match(css,/#printArea\{background:#fff!important;color:#111!important\}/);
});
