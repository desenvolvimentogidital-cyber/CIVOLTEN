import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ui=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../public/secure.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/secure.css',import.meta.url),'utf8');
const demo=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('Painel real compartilha tokens visuais com interface aprovada',()=>{
 assert.match(css,/^@import url\('\/style\.css'\)/);
 assert.match(demo,/--orange:/);
 assert.match(css,/\.secure-layout \.nav-link/);
 assert.match(css,/\.secure-layout \.topbar/);
 assert.match(css,/\.dashboard-kpis/);
});
test('Tema claro e escuro aplica atributo esperado pelo design aprovado',()=>{
 assert.match(page,/document\.documentElement\.dataset\.theme/);
 assert.match(ui,/document\.documentElement\.dataset\.theme=dark\?'dark':'light'/);
 assert.match(demo,/:root\[data-theme=dark\]/);
});
test('Painel logado mantém navegação e módulos reais, nunca demo',()=>{
 for(const nav of ['inicio','clientes','obras','orcamentos','usuarios'])
  assert.match(ui,new RegExp("'"+nav+"'"));
 assert.match(ui,/function navHTML\(mobile=false\)/);
 assert.match(ui,/function dashboard\(\)/);
 assert.match(ui,/api\('clients'\)/);
 assert.match(ui,/api\('projects'\)/);
 assert.match(ui,/api\('budgets'\)/);
 assert.doesNotMatch(page,/demo-api\.js/);
});
test('Design responsivo mantém rodapé móvel e dashboard acessíveis',()=>{
 assert.match(ui,/class="mobile-nav"/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.mobile-link\.active/);
 assert.match(page,/name="viewport"/);
});
test('Links e funções reais continuam disponíveis no layout',()=>{
 assert.match(ui,/data-action="password-modal"/);
 assert.match(ui,/data-action="logout"/);
 assert.match(ui,/data-action="theme"/);
 assert.match(ui,/data-action="view"/);
 assert.match(page,/secure\.js/);
 assert.match(page,/secure\.css/);
});
