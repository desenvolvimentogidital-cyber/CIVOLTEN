import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {budgetIssues,contractIssues,taxMarginIssues} from '../lib/civolten-validation.mjs';
import {contractDefaults} from '../lib/civolten-contract.mjs';
import {electricalProposalPreset} from '../lib/civolten-proposal-text.mjs';
import {nativeFieldIssue} from '../assets/field-validation.js';

const selectors=issues=>issues.map(x=>x.selector);
const pdfBudget=()=>({title:'Instalação elétrica',customer:'Cliente de teste',address:'Rua das Flores, 100',
 services:'Montar circuitos do imóvel',days:10,discount_pct:0,scope_items:[],staff:[],expenses:[],
 manual_price_cents:null});
const pdfContract=()=>({...contractDefaults(),title:'Instalação elétrica',counterparty_name:'Cliente de teste',
 counterparty_document:'123.456.789-09',location:'Rua das Flores, 100',
 scope:'Instalar quadro e tomadas',start_on:'2026-11-01',end_on:'2026-11-30',
 value_cents:100000,payment_terms:'40% de entrada',payment_schedule:'R$400 sinal e R$600 entrega',
 company:{company_name:'CIVOLTEN Testes',company_document:'11.222.333/0001-81'}});
test('rascunho do orçamento aceita campos comerciais ainda não preenchidos',()=>{
 const b={...pdfBudget(),customer:'',address:'',services:''};
 assert.equal(budgetIssues(b).length,0);
});
test('proposta em PDF destaca cliente, obra e descrição ausentes',()=>{
 const b={...pdfBudget(),customer:'',address:' ',services:'',scope_items:[]};
 const missing=selectors(budgetIssues(b,{forPdf:true}));
 for(const selector of ['[data-draft="customer"]','[data-draft="address"]','[data-draft="services"]'])assert.ok(missing.includes(selector));
});
test('a descrição livre pode substituir a lista de serviços, sem criar obrigação falsa',()=>{
 const b={...pdfBudget(),scope_items:[],services:'Instalação completa'};
 assert.ok(!selectors(budgetIssues(b,{forPdf:true})).includes('[data-draft="services"]'));
});
test('cada serviço incompleto destaca sua linha, mesmo sem serviços livre',()=>{
 const b={...pdfBudget(),services:'Descrição comercial',scope_items:[{description:'',unit:'m',quantity:0}]};
 const issues=selectors(budgetIssues(b,{forPdf:true}));
 assert.ok(issues.includes('[data-scope-description="0"]'));
 assert.ok(issues.includes('[data-scope-quantity="0"]'));
});
test('faltas de valores e campos dinâmicos de orçamento são destacadas',()=>{
 const b={...pdfBudget(),title:'',days:0,discount_pct:150,staff:[{days:0}],expenses:[{qty:-1}],manual_price_cents:-10};
 const x=selectors(budgetIssues(b));
 for(const selector of ['[data-draft="title"]','[data-draft="days"]','[data-discount-number]',
  '[data-staff-days="0"]','[data-expense-qty="0"]','[data-draft="manual_price"]'])assert.ok(x.includes(selector),selector);
});
test('rascunho de contrato exige título, mas não bloqueia informações ainda pendentes',()=>{
 const c={...contractDefaults(),title:'Contrato de testes'};
 assert.deepEqual(contractIssues(c),[]);
 assert.ok(selectors(contractIssues({...c,title:''})).includes('[data-contract="title"]'));
});
test('contrato para PDF exige documento válido, escopo, prazos, pagamento e cadastro da empresa',()=>{
 const c={...pdfContract(),counterparty_document:'11111111111',scope:'x',end_on:'2026-10-15',
  payment_schedule:'',company:{company_name:'',company_document:'00000000000000'}};
 const selectorsFound=selectors(contractIssues(c,{forExport:true}));
 for(const sel of ['[data-contract="counterparty_document"]','[data-contract="scope"]',
 '[data-contract="end_on"]','[data-contract="payment_schedule"]','.contract-company-review'])assert.ok(selectorsFound.includes(sel),sel);
});
test('dados completos de contrato não geram alerta desnecessário',()=>{
 assert.deepEqual(contractIssues(pdfContract(),{forExport:true}),[]);
});
test('parâmetros financeiros inválidos apontam ambos os percentuais',()=>{
 assert.equal(taxMarginIssues(30,70).length,2);
 assert.equal(taxMarginIssues(20,30).length,0);
});
test('estilos de erro existem e o PDF original permanece intocado',()=>{
 const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 const print=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../assets/field-validation.js',import.meta.url),'utf8');
 assert.match(css,/\.cv-field-error/);
 assert.match(ui,/aria-invalid/);
 assert.match(ui,/cv-validation-message/);
 assert.match(app,/if\(!budgetValidation\(true\)\)return/);
 assert.match(app,/if\(!contractValidation\(true\)\)return/);
 assert.match(print,/proposal-header-art/);
 assert.match(print,/@page\{size:A4/);
});

test('modelo de texto técnico elétrico permanece editável e não altera o PDF comercial',()=>{
 const preset=electricalProposalPreset();
 assert.match(preset.services,/NBR 5410/);
 assert.equal(preset.scope_items.length,3);
 assert.deepEqual(preset.scope_items.map(i=>i.quantity),[1,1500,150]);
 assert.match(preset.notes,/40% de entrada/);
 assert.match(preset.notes,/60% restantes/);
 assert.match(preset.notes,/apólice vigente/);
 assert.match(preset.notes,/quando houver trabalho em altura/);
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(app,/data-action="apply-electrical-proposal"/);
 assert.match(app,/b\.services=preset\.services/);
 assert.match(app,/b\.notes=preset\.notes/);
 assert.match(app,/b\.scope_items=preset\.scope_items/);
 assert.doesNotMatch(preset.services,/1500 m/);
});

test('validação global diferencia campos obrigatórios, opcionais e formatos inválidos',()=>{
 const input=(value,required,validity={},type='text')=>({
  value,required,type,disabled:false,matches:selector=>selector==='input,textarea,select',
  validity:{valid:true,...validity}
 });
 assert.match(nativeFieldIssue(input('',true)),/obrigatório/);
 assert.equal(nativeFieldIssue(input('',true),{checkRequired:false}),null);
 assert.equal(nativeFieldIssue(input('',false)),null);
 assert.match(nativeFieldIssue(input('invalido',true,{valid:false,typeMismatch:true},'email')),/e-mail/);
 assert.match(nativeFieldIssue(input('-1',true,{valid:false,rangeUnderflow:true},'number')),/mínimo/);
 assert.match(nativeFieldIssue(input('1.3',true,{valid:false,stepMismatch:true},'number')),/intervalo/);
});
test('CPF/CNPJ incorreto fica destacado mesmo ao editar uma minuta',()=>{
 const c={...contractDefaults(),title:'Contrato de teste',counterparty_document:'000.000.000-00'};
 assert.ok(selectors(contractIssues(c)).includes('[data-contract="counterparty_document"]'));
});
test('aviso de erro não desloca o editor em duas colunas',()=>{
 const js=fs.readFileSync(new URL('../assets/field-validation.js',import.meta.url),'utf8');
 assert.match(js,/area\.querySelector\(':scope > \.stack'\)/);
});
