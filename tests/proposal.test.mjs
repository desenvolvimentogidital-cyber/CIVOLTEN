import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProposalHtml, proposalReference} from '../lib/civolten-proposal.mjs';

const sample={
 title:'Instalação elétrica e reforma',
 customer:'Cliente CIVOLTEN',
 address:'São Paulo - SP',
 services:'Instalação dos circuitos.\nRevisão do quadro de distribuição.',
 notes:'Pagamento e início a combinar.',
 days:12,
 status:'enviado',
 staff:[{name:'Nome interno segredo', daily_cents:87654321}],
 expenses:[{name:'Custo material interno segredo',unit_cents:23456789}],
 pricing:{tax_pct:22,margin_pct:35,fixed_monthly_cents:7654321},
 manual_price_cents:1199000
};
const options={
 priceCents:1199000,
 id:'550e8400-e29b-41d4-a716-446655440000',
 date:new Date('2026-10-21T12:00:00Z')
};

test('proposta comercial A4 tem identificacao, escopo, valor, prazo, aceite e referencia',()=>{
 const html=buildProposalHtml(sample,options);
 assert.match(html,/PROPOSTA<br>COMERCIAL/);
 assert.match(html,/CV-550E8400/);
 assert.match(html,/21 de outubro de 2026/);
 assert.match(html,/Instalação elétrica e reforma/);
 assert.match(html,/Cliente CIVOLTEN/);
 assert.match(html,/12 dias de execução/);
 assert.match(html,/Escopo dos serviços/);
 assert.match(html,/Instalação dos circuitos.\nRevisão do quadro de distribuição/);
 assert.match(html,/Condições e observações/);
 assert.match(html,/Aceite da proposta/);
 assert.match(html,/R\$\s*11\.990,00/);
});

test('nunca inclui salarios, margens, impostos, itens internos ou custos na proposta',()=>{
 const html=buildProposalHtml(sample,options);
 for(const confidential of ['Nome interno segredo','Custo material interno segredo','87.654.321','23.456.789','7654321','tax_pct','margin_pct','daily_cents','staff','expenses','lucro','impostos sobre venda']){
  assert.ok(!html.includes(confidential),'vazamento de dado privado: '+confidential);
 }
});

test('escapa texto do cliente e nao aceita logo com atributos ou codigo malicioso',()=>{
 const unsafe={...sample,title:'<img src=x onerror=alert(1)>',customer:'" onclick="run()',services:'<script>alert(1)</script>',notes:"'<b>ruim</b>"};
 const html=buildProposalHtml(unsafe,{...options,logoDataUrl:'data:image/svg+xml,<svg onload=alert(1)>'});
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('data:image/svg+xml'));
 assert.match(html,/proposal-monogram/);
});

test('usa logo original quando for PNG ou JPEG incorporado valido',()=>{
 const html=buildProposalHtml(sample,{...options,logoDataUrl:'data:image/png;base64,aGVsbG8='});
 assert.match(html,/class="proposal-logo"/);
 assert.match(html,/data:image\/png;base64,aGVsbG8=/);
 assert.doesNotMatch(html,/proposal-monogram/);
});

test('orcamento nao salvo tem referencia explicita, sem inventar numero oficial',()=>{
 assert.equal(proposalReference(null),'Prévia sem número');
 const html=buildProposalHtml({...sample,notes:'',days:1}, {...options,id:null});
 assert.match(html,/Prévia sem número/);
 assert.match(html,/1 dia de execução/);
 assert.doesNotMatch(html,/Condições e observações/);
});

test('dados minimos geram documento valido e entradas incorretas sao recusadas',()=>{
 const html=buildProposalHtml({title:'Obra A',days:0},{priceCents:0});
 assert.match(html,/A confirmar/);
 assert.match(html,/Obra A/);
 assert.throws(()=>buildProposalHtml({title:''},{priceCents:100}),/Informe o nome/);
 assert.throws(()=>buildProposalHtml({title:'Obra'}, {priceCents:-2}),/Valor comercial/);
});

test('folha A4 imprime independentemente do tema escuro e nao exibe painel',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(css,/@page\s*\{\s*size:A4/);
 assert.match(css,/#app,#auth,#flash\s*\{\s*display:none!important/);
 assert.match(css,/print-color-adjust:exact/);
 assert.match(css,/break-inside:avoid/);
 assert.match(css,/\.proposal-rich/);
 assert.match(page,/proposal-print\.css" media="print"/);
 assert.match(app,/import \{buildProposalHtml\} from '\/lib\/civolten-proposal\.mjs'/);
 assert.match(app,/priceCents:r\.price_cents/);
});
