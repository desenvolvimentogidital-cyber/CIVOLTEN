import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const wallpaper=fs.readFileSync(new URL('../assets/civolten-background.webp',import.meta.url));

test('mesmo cenário de obra aplicado ao login e a todas as telas do painel',()=>{
 assert.match(css,/--civolten-wallpaper:url\("\/assets\/civolten-background\.webp"\)/);
 assert.match(css,/\.auth-wrap,:root\[data-theme="dark"\] \.auth-wrap,#app\{/);
 assert.match(css,/#app\{\s*background-image:linear-gradient/);
});
test('imagem local valida e leve, sem serviço externo',()=>{
 assert.equal(wallpaper.toString('ascii',0,4),'RIFF');
 assert.equal(wallpaper.toString('ascii',8,12),'WEBP');
 assert.ok(wallpaper.length>12000&&wallpaper.length<250000);
});
test('camada de leitura em ambos temas e impressão livre de fundos',()=>{
 assert.match(css,/\.auth-card,:root\[data-theme="dark"\] \.auth-card\{/);
 assert.match(css,/:root\[data-theme="dark"\] #content \.card/);
 assert.match(css,/@media print\{\s*\.auth-wrap,#app\{background-image:none!important/);
});
