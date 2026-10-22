import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync(new URL('../empresa.html',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../painel.html',import.meta.url),'utf8');
const server=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const css=fs.readFileSync(new URL('../site/assets/styles.css',import.meta.url),'utf8');
test('website público e painel privado separados',()=>{
 assert.match(page,/id="servicos"/);
 assert.match(page,/id="sobre"/);
 assert.match(page,/id="projetos"/);
 assert.match(page,/id="diferenciais"/);
 assert.doesNotMatch(page,/id="login"/);
 assert.match(panel,/id="login"/);
 assert.match(panel,/id="app"/);
 assert.match(panel,/\/assets\/app\.js/);
});
test('raiz redireciona para site público',()=>{
 assert.ok(server.redirects.some(x=>x.source==='/'&&x.destination==='/empresa'));
 assert.ok(server.headers.some(x=>x.source==='/(.*)'&&x.headers.some(y=>y.key==='Content-Security-Policy')));
});
test('referências e layout responsivo',()=>{
 assert.match(page,/\/site\/assets\/styles.css/);
 assert.match(page,/\/site\/assets\/script.js/);
 assert.match(page,/href="\/painel"/);
 assert.match(css,/@media \(max-width:820px\)/);
 assert.match(css,/@media \(max-width:640px\)/);
 assert.doesNotMatch(page,/>\+100</);
});