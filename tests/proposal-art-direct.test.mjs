import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildArtProposalHtml,artProposalIssues,proposalArtPaths} from '../lib/civolten-proposal-art.mjs';
import {budgetIssues} from '../lib/civolten-validation.mjs';

const sample=()=>({
 title:'Adequação elétrica e civil',customer:'Cliente Exemplo',
 address:'Local Exemplo',days:10,validity_days:15,
 payment_terms:'Entrada e saldo mediante entrega.',
 civil_services:'Reforma e acabamento previstos.',
 electrical_services:'Adequação do quadro e circuitos.',
 scope_items:[
  {description:'Alvenaria',unit:'m²',quantity:12,category:'civil'},
  {description:'Passagem de cabos',unit:'m',quantity:80,category:'eletrica'}
 ]});
test('sete fundos fixos reais sem ZIP, visíveis nas sete páginas A4',()=>{
 const html=buildArtProposalHtml(sample(),{priceCents:2345000});
 assert.equal((html.match(/class="cv-art-page"/g)||[]).length,7);
 for(const path of proposalArtPaths)assert.ok(html.includes(path),path);
 for(let i=1;i<=7;i++){
  const p='../assets/proposal-art/'+String(i).padStart(2,'0')+'.png';
  const data=fs.readFileSync(new URL(p,import.meta.url));
  assert.deepEqual([...data.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(data.readUInt32BE(16)>=350&&data.readUInt32BE(20)>=500);
 }
});
test('preços e escopos reais aparecem e valores internos não',()=>{
 const b=sample();
 b.staff=[{name:'SEGREDO_FUNCIONÁRIO',daily_cents:900}];
 b.expenses=[{name:'SEGREDO_CUSTO'}];
 b.pricing={margin_pct:30,tax_pct:22};
 const html=buildArtProposalHtml(b,{priceCents:2345000});
 assert.match(html,/Alvenaria/);
 assert.match(html,/Passagem de cabos/);
 assert.match(html,/R\$\s*23\.450,00/);
 for(const s of ['SEGREDO_FUNCIONÁRIO','SEGREDO_CUSTO','tax_pct','margin_pct'])assert.ok(!html.includes(s));
});
test('entrada potencialmente maliciosa é escapada',()=>{
 const b=sample();
 b.customer='<script>alert(1)</script>';
 const html=buildArtProposalHtml(b,{priceCents:1000});
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
});
test('campos extensos são identificados antes de imprimir sem cortar',()=>{
 const b={...sample(),company_intro:'a'.repeat(421)};
 assert.ok(artProposalIssues(b).some(x=>x.selector==='[data-draft="company_intro"]'));
 assert.throws(()=>buildArtProposalHtml(b,{priceCents:1000}),/Texto muito longo/);
 assert.ok(artProposalIssues({...sample(),scope_items:Array.from({length:7},(_,i)=>({category:'civil',description:'Serviço '+i,unit:'un',quantity:1}))}).some(x=>/seis itens/.test(x.message)));
});
test('prévia não exige valor final mas PDF exige',()=>{
 assert.match(buildArtProposalHtml(sample(),{priceCents:0,preview:true}),/A confirmar/);
 assert.throws(()=>buildArtProposalHtml(sample(),{priceCents:0}),/preço final/);
});
test('modelo anterior e contratos seguem disponíveis',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/proposal-art-print.css',import.meta.url),'utf8');
 assert.match(app,/async function printBudget\(\)/);
 assert.match(app,/buildProposalHtml\(b/);
 assert.match(app,/async function printVisualBudget\(\)/);
 assert.match(app,/buildArtProposalHtml\(b/);
 assert.match(app,/data-action="preview-art-budget"/);
 assert.match(app,/data-action="print-art-budget"/);
 assert.match(index,/proposal-print\.css" media="print"/);
 assert.match(index,/proposal-art-print\.css" media="print"/);
 assert.match(css,/@page cvOriginalArt/);
 assert.match(css,/\.cv-art-back/);
 assert.match(app,/printContract\(\)/);
 assert.equal(budgetIssues(sample(),{forPdf:true}).filter(x=>x.message.includes('arte')).length,0);
});
