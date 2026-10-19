import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const pages=[
  ['index.html','assets/civolten-app-unificado.css'],
  ['servicos.html','assets/civolten-servicos-unificado.css'],
  ['proposta.html','assets/civolten-proposta-unificado.css'],
  ['privacidade.html','assets/civolten-privacidade-unificado.css']
];

test('cada tela carrega exatamente UM CSS, sem arquivos antigos empilhados',()=>{
 for(const [htmlFile,cssFile] of pages){
  const html=read(htmlFile);
  const links=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(links,['/'+cssFile+'?v=3'],htmlFile);
  assert.doesNotMatch(html,/civolten-premium\.css|civolten-art-direction\.css|civolten-telas\.css|civolten-padrao\.css|href="\/assets\/civolten\.css"/,htmlFile);
  assert.ok(read(cssFile).length>10000,cssFile);
 }
});

test('todos os arquivos finais têm a identidade clara como último bloco',()=>{
 for(const [,file] of pages){
  const css=read(file);
  assert.match(css,/\/\* === Identidade e acessibilidade === \*\//);
  assert.match(css,/\/\* === Padrão final da tela === \*\//);
  const final=css.slice(css.lastIndexOf('/* === Identidade e acessibilidade === */'));
  assert.match(final,/color-scheme:light/);
  assert.match(final,/--cv-navy:var\(--brand-primary/);
  assert.match(final,/--cv-gold:var\(--brand-accent/);
  assert.match(final,/\[hidden\],\.hidden,#admin \.hidden,#client \.hidden,#dashboard \.hidden\{display:none!important\}/);
 }
 const app=read('assets/civolten-app-unificado.css');
 assert.match(app,/#admin \.premium-admin-sidebar\{background:#fff/);
 assert.match(app,/#admin \.card\.admin-dashboard\.hidden\{display:none!important\}/);
 assert.match(app,/#client \.premium-quote-card\{background:#fff/);
 const services=read('assets/civolten-servicos-unificado.css');
 assert.match(services,/\.site-servicos \.services\{background:linear-gradient\(180deg,#fff,#f6f8fb\)/);
 assert.match(services,/\.site-servicos \.service-card \.service-name\{color:var\(--cv-ink\)/);
});

test('CSS estrutural está com blocos equilibrados e pronto para navegadores',()=>{
 for(const [,file] of pages){
  const css=read(file);
  const cleaned=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
  let depth=0;
  for(const ch of cleaned){
   if(ch==='{')depth++;
   if(ch==='}')depth--;
   assert.ok(depth>=0,file+' contém fechamento CSS a mais');
  }
  assert.equal(depth,0,file+' contém bloco CSS aberto');
 }
});
