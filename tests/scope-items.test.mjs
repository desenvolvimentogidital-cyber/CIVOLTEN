import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProposalHtml,normalizeScopeItems} from '../lib/civolten-proposal.mjs';

const record={
 title:'Reforma e divisórias', customer:'Cliente Exemplo',address:'São Paulo - SP', days:18,
 services:'Execução e acabamento conforme especificação do projeto.',
 scope_items:[
  {description:'Execução de paredes de alvenaria',unit:'m²',quantity:35.5},
  {description:'Assentamento de piso porcelanato',unit:'m²',quantity:48},
  {description:'Instalação de forro de gesso',unit:'m²',quantity:32},
  {description:'Montagem de divisórias em drywall',unit:'m²',quantity:22.25},
  {description:'Instalação de pontos elétricos',unit:'ponto',quantity:8}
 ],
 staff:[{name:'Funcionário interno confidencial',daily_cents:150000}],
 expenses:[{name:'Custo material interno',unit_cents:22000}],
 pricing:{tax_pct:12,margin_pct:35,fixed_monthly_cents:90000}
};

test('imprime lista descritiva com quantidades e unidade para o cliente',()=>{
 const html=buildProposalHtml(record,{priceCents:1650000});
 assert.match(html,/Serviços e quantitativos/);
 assert.match(html,/proposal-quantity-table/);
 assert.match(html,/Execução de paredes de alvenaria/);
 assert.match(html,/35,5/);
 assert.match(html,/48/);
 assert.match(html,/22,25/);
 assert.match(html,/ponto/);
 assert.match(html,/R\$\s*16\.500,00/);
 assert.equal((html.match(/<tbody>/g)||[]).length,1);
 assert.equal((html.match(/<tr>/g)||[]).length,6);
});

test('memorial descritivo jamais expoe custos internos ou precos por unidade',()=>{
 const html=buildProposalHtml(record,{priceCents:1650000});
 for(const hidden of ['Funcionário interno confidencial','Custo material interno','daily_cents','unit_cents','margin_pct','tax_pct','preço unitário','PREÇO UNITÁRIO','R$ 1.500,00']){
  assert.ok(!html.includes(hidden),'Dado financeiro indevido: '+hidden);
 }
});

test('antigos orcamentos ainda mostram texto de escopo normal',()=>{
 const {scope_items,...legacy}=record;
 const html=buildProposalHtml(legacy,{priceCents:1650000});
 assert.match(html,/Escopo dos serviços/);
 assert.doesNotMatch(html,/proposal-quantity-table/);
 assert.match(html,/Execução e acabamento/);
});

test('valida unidade, descricao, numero positivo e no maximo duas casas decimais',()=>{
 assert.deepEqual(normalizeScopeItems([]),[]);
 assert.equal(normalizeScopeItems([{description:'Parede',unit:'m²',quantity:0.29}])[0].quantity,0.29);
 for(const item of [
  {description:'',unit:'m²',quantity:1},
  {description:'Parede',unit:'km',quantity:1},
  {description:'Parede',unit:'m²',quantity:0},
  {description:'Parede',unit:'m²',quantity:-1},
  {description:'Parede',unit:'m²',quantity:2.333},
  {description:'Parede',unit:'m²',quantity:Infinity}
 ])assert.throws(()=>normalizeScopeItems([item]));
 assert.throws(()=>normalizeScopeItems('Não é uma lista'));
});

test('escapa conteudo HTML de servicos na tabela comercial',()=>{
 const html=buildProposalHtml({...record,scope_items:[{description:'<img src=x onerror=alert(1)>',unit:'m²',quantity:3.5}]},{priceCents:1650000});
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('editor permite adicionar, editar, remover e salvar itens comerciais',()=>{
 const js=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(js,/data-action="add-scope"/);
 assert.match(js,/data-action="remove-scope"/);
 assert.match(js,/data-scope-description/);
 assert.match(js,/data-scope-unit/);
 assert.match(js,/data-scope-quantity/);
 assert.match(js,/normalizeScopeItems\(b\.scope_items\|\|\[\]\)/);
});

test('tabela comercial tem formatacao A4 e cabeçalho repetivel',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 assert.match(css,/proposal-quantity-table thead\{display:table-header-group\}/);
 assert.match(css,/proposal-quantity-table tr\{break-inside:avoid/);
 assert.match(css,/@page\{size:A4/);
});
