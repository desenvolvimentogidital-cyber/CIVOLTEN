import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const printer=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');

test('aumento da arte do nome fica restrito ao painel autenticado',()=>{
 const mark=css.indexOf('/* Marca CIVOLTEN ampliada somente no ambiente APÓS LOGIN.');
 assert.ok(mark>0);
 const rules=css.slice(mark);
 assert.match(rules,/#app \.sidebar \.brand \.brand-wordmark-frame/);
 assert.doesNotMatch(rules,/\.auth-card|\.auth-wrap|#printArea/);
 assert.doesNotMatch(rules,/\.brand-wordmark-frame(?=\s*\{)/);
});

test('tela grande usa largura de marca maior do que a original',()=>{
 const block=css.slice(css.indexOf('@media screen and (min-width:971px)'));
 assert.match(block,/#app \.sidebar\{width:298px;min-width:298px\}/);
 assert.match(block, /#app \.sidebar \.brand \.brand-wordmark-frame\{\s*width:100%;max-width:270px;height:76px\s*\}/);
 assert.match(block,/#app \.sidebar \.brand \.brand-logo\{width:90px;height:90px\}/);
});

test('tablet e celular exibem nome ampliado sem cortar a tela',()=>{
 const tablet=css.slice(css.indexOf('@media screen and (min-width:681px) and (max-width:970px)'));
 const mobile=css.slice(css.lastIndexOf('@media screen and (max-width:680px)'));
 assert.match(tablet,/#app \.sidebar\{width:264px;min-width:264px\}/);
 assert.match(tablet,/max-width:242px;height:70px/);
 assert.match(mobile,/flex-direction:column;align-items:center;justify-content:center/);
 assert.match(mobile,/max-width:335px;height:76px/);
 assert.match(mobile,/\.brand-wordmark\{\s*width:100%;max-width:none/);
});

test('logo e nome originais ficam no login e no painel, enquanto a impressão é independente',()=>{
 assert.equal((page.match(/class="brand-wordmark"/g)||[]).length,3);
 assert.equal((page.match(/class="brand-logo"/g)||[]).length,3);
 assert.match(page,/id="app" hidden><aside class="sidebar"/);
 assert.match(printer,/#printArea \.proposal-header-art-slot/);
 assert.match(printer,/#printArea \.proposal-logo/);
 assert.doesNotMatch(css.slice(css.indexOf('/* Marca CIVOLTEN ampliada somente no ambiente APÓS LOGIN.')),/@media print/);
});
