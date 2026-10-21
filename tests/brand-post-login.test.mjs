import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const printer=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
const intro='/* Ajuste pontual: imagem do NOME maior ao lado do icone no celular.';
const begin=css.indexOf(intro);
const correction=css.slice(begin);

test('corrige somente a imagem do nome na sidebar autenticada',()=>{
 assert.ok(begin>0,'bloco de correção existente');
 assert.match(correction,/#app \.sidebar \.brand \.brand-wordmark-frame/);
 assert.match(correction,/#app \.sidebar \.brand \.brand-wordmark\{/);
 assert.doesNotMatch(correction,/\.auth-card|\.auth-wrap|#printArea/);
 assert.doesNotMatch(correction,/#app \.sidebar\{width:|#app \.sidebar\{min-width:/);
 assert.doesNotMatch(correction,/#app \.sidebar \.brand \.brand-logo/);
});
test('restaura composicao horizontal com nome ao lado do simbolo no celular',()=>{
 assert.match(correction,/#app \.sidebar \.brand\{\s*flex-direction:row;align-items:center;justify-content:flex-start;/);
 assert.match(correction,/#app \.sidebar \.brand \.brand-wordmark-frame\{\s*flex:1 1 auto;min-width:0;width:auto;max-width:none;height:58px/);
 assert.doesNotMatch(correction,/flex-direction:column/);
 assert.doesNotMatch(correction,/max-width:335px/);
});
test('remove efetivamente o limite antigo de 110px que encolhia o nome',()=>{
 const oldCss=css.slice(0,begin);
 assert.match(oldCss,/\.sidebar \.brand img\{max-height:54px;max-width:110px\}/);
 assert.match(correction,/#app \.sidebar \.brand \.brand-wordmark\{\s*display:block;width:100%;height:auto;\s*max-width:none;max-height:none/);
});
test('medidas de icone e barra lateral anteriores permanecem intactas',()=>{
 const oldCss=css.slice(0,begin);
 assert.match(oldCss,/\.sidebar\{background:var\(--navy\).*?width:250px;min-width:250px/);
 assert.match(oldCss,/@media\(max-width:970px\)\{\.sidebar\{width:205px;min-width:205px/);
 assert.match(oldCss,/\.sidebar \.brand \.brand-logo\{width:49px;height:49px\}/);
 assert.match(oldCss,/\.sidebar \.brand \.brand-logo\{width:77px;height:77px\}/);
});
test('preserva identidade original no login, nome em imagem e PDF aprovado',()=>{
 assert.equal((page.match(/class="brand-wordmark"/g)||[]).length,3);
 assert.equal((page.match(/class="brand-logo"/g)||[]).length,3);
 assert.match(page,/id="app" hidden><aside class="sidebar"/);
 assert.match(printer,/#printArea \.proposal-header-art-slot/);
 assert.match(printer,/#printArea \.proposal-logo/);
 assert.doesNotMatch(correction,/@media print/);
});
