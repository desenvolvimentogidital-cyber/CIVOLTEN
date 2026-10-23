import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProposalHtml} from '../lib/civolten-proposal.mjs';
const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const css=read('../assets/proposal-print.css');
const html=buildProposalHtml({
 title:'Reforma e adequação elétrica',customer:'Cliente Teste',address:'Endereço Teste',
 days:12,services:'Reforma e instalações conforme escopo aprovado.',
 payment_terms:'Pagamento conforme etapas acordadas.',validity_days:15,
 scope_items:[{category:'civil',description:'Alvenaria',unit:'m²',quantity:12},
 {category:'eletrica',description:'Passagem de cabos',unit:'m',quantity:50}]
},{priceCents:1250000,
 logoDataUrl:'/assets/civolten-logo.png',
 headerArtUrl:'/assets/civolten-proposal-header.png'});
test('acabamento novo afeta apenas folhas de proposta e impressão',()=>{
 const from=css.indexOf('CIVOLTEN | Acabamento visual premium do PDF');
 const next=css.indexOf('/* CIVOLTEN | Contratos completos v2.',from);
 const section=css.slice(from,next>from?next:undefined);
 assert.ok(section.includes('@media print'));
 assert.ok(section.includes('#printArea .cv-proposal'));
 assert.ok(!section.includes('.contract-document'));
 assert.ok(!section.includes('.budget-simple-editor'));
 assert.ok(!section.includes('#auth'));
 assert.match(section,/\.cv-cover::before/);
 assert.match(section,/\.cv-heading::before/);
 assert.match(section,/\.cv-picture::before/);
 assert.match(section,/\.cv-price-total/);
});
test('conteúdo, logo, valor, dados e sete páginas seguem intactos',()=>{
 assert.equal((html.match(/class="cv-page /g)||[]).length,7);
 assert.equal((html.match(/class="proposal-logo"/g)||[]).length,7);
 assert.equal((html.match(/class="proposal-header-art"/g)||[]).length,7);
 assert.match(html,/Cliente Teste/);
 assert.match(html,/Alvenaria/);
 assert.match(html,/Passagem de cabos/);
 assert.match(html,/12\.500,00/);
});
test('contratos continuam usando estilo independente',()=>{
 assert.match(css,/\.contract-document/);
 assert.match(css,/@page cvProposal\s*\{size:A4; margin:0\}/);
 const pageHead=read('../index.html');
 assert.match(pageHead,/proposal-print\.css" media="print"/);
 assert.ok(!pageHead.includes('proposal-art-print.css'));
});
