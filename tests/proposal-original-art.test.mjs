import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildArtProposalHtml,proposalArtPaths} from '../lib/civolten-proposal-art.mjs';
test('o template utiliza exatamente as sete artes originais e não imagens genéricas',()=>{
 const html=buildArtProposalHtml({
  title:'Reforma elétrica e civil',customer:'Cliente Exemplo',address:'Local Exemplo',days:10,
  scope_items:[{description:'Demolição',unit:'m²',quantity:4,category:'civil'},
  {description:'Quadro elétrico',unit:'un',quantity:1,category:'eletrica'}]
 },{priceCents:100000});
 assert.equal((html.match(/class="cv-art-page"/g)||[]).length,7);
 for(const path of proposalArtPaths)assert.ok(html.includes(path),path);
 assert.match(html,/Demolição/);
 assert.match(html,/Quadro elétrico/);
 assert.match(html,/R\$\s*1\.000,00/);
});
test('nenhum custo, imposto ou margem interna entra na proposta ao cliente',()=>{
 const html=buildArtProposalHtml({title:'Reforma',customer:'Cliente',
 staff:[{name:'SEGREDO_FUNCIONÁRIO'}],expenses:[{name:'SEGREDO_DESPESA'}],
 pricing:{tax_pct:33,margin_pct:99},notes:'Aprovar escopo.'},
 {priceCents:300000});
 for(const secret of ['SEGREDO_FUNCIONÁRIO','SEGREDO_DESPESA','tax_pct','margin_pct'])
  assert.ok(!html.includes(secret));
});
test('escapa HTML de campos comerciais e separa os escopos por categoria',()=>{
 const html=buildArtProposalHtml({title:'<script>bad</script>',
 scope_items:[{description:'<img src=x onerror=alert(1)>',unit:'m²',quantity:2,category:'civil'}]},
 {priceCents:100});
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('&lt;img'));
});
test('identidade das sete páginas exige sete imagens instaladas antes do uso',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-art-print.css',import.meta.url),'utf8');
 assert.match(css,/@page cvOriginalArt/);
 assert.match(css,/page:cvOriginalArt/);
 assert.match(css,/\.cv-art-back/);
});
