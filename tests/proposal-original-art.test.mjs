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


test('sete imagens de homologação existem no repositório e são arquivos PNG válidos',()=>{
 for(let i=1;i<=7;i++){
  const n=String(i).padStart(2,'0');
  const bytes=fs.readFileSync(new URL('../assets/proposal-art/'+n+'.png',import.meta.url));
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(bytes.readUInt32BE(16)>=376&&bytes.readUInt32BE(20)>=532,'Imagem '+n+' deve existir');
 }
});

test('Orçamentos oferece prévia das sete páginas e exporta o gerador artístico',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/import \{buildArtProposalHtml\}/);
 assert.match(app,/async function printArtBudget\(\)/);
 assert.match(app,/const html=buildArtProposalHtml\(b/);
 assert.match(app,/async function printBudget\(\)/);
 assert.match(app,/const html=buildProposalHtml\(b/);
 assert.match(app,/data-action="preview-art-budget"/);
 assert.match(app,/data-action="preview-saved-budget"/);
 assert.match(index,/proposal-art-print\.css" media="print"/);
 assert.ok(fs.existsSync(new URL('../assets/proposal-art-preview.js',import.meta.url)));
});

test('textos longos não são cortados silenciosamente na arte',()=>{
 assert.throws(()=>buildArtProposalHtml({title:'Reforma',
  civil_services:'A'.repeat(321),payment_terms:'À vista'}, {priceCents:10000}),/limite de 320 caracteres/);
 assert.throws(()=>buildArtProposalHtml({title:'Reforma',
  payment_terms:'P'.repeat(161)},{priceCents:10000}),/limite de 160 caracteres/);
});

test('somente as artes originais instaladas podem ir ao PDF ou visualizador',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const loader=fs.readFileSync(new URL('../assets/proposal-art-assets.js',import.meta.url),'utf8');
 const preview=fs.readFileSync(new URL('../assets/proposal-art-preview.js',import.meta.url),'utf8');
 const config=fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
 assert.match(app,/Carregar artes originais \(ZIP\)/);
 assert.match(app,/applyOfficialArtUrls\(div,artUrls\)/);
 assert.match(preview,/replaceOfficialArtUrlsInHtml\(html,images\)/);
 assert.match(loader,/indexedDB\.open/);
 assert.match(loader,/found\.size===7/);
 assert.match(config,/img-src 'self' data: blob:/);
});

test('exportação anterior continua independente do ZIP e do desenho de teste',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const original=app.slice(app.indexOf('async function printBudget(){'),app.indexOf('async function printArtBudget(){'));
 const art=app.slice(app.indexOf('async function printArtBudget(){'),app.indexOf("document.addEventListener('submit'",app.indexOf('async function printArtBudget(){')));
 assert.match(original,/buildProposalHtml\(b/);
 assert.ok(!original.includes('officialProposalArtUrls('));
 assert.match(art,/officialProposalArtUrls\(\)/);
 assert.match(art,/buildArtProposalHtml\(b/);
 assert.match(app,/data-action="print-art-budget"/);
});
test('validação de tamanho das artes não afeta a exportação anterior', async()=>{
 const {budgetIssues}=await import('../lib/civolten-validation.mjs');
 const b={title:'Obra teste',customer:'Cliente teste',address:'Local completo',days:5,
  services:'Serviços civis teste'.repeat(35),payment_terms:'Entrada de 40% e saldo após entrega.',validity_days:15};
 assert.equal(budgetIssues(b,{forPdf:true}).filter(x=>x.message.includes('arte')).length,0);
 assert.ok(budgetIssues(b,{forPdf:true,forArtPdf:true}).some(x=>x.message.includes('320 caracteres')));
});
