import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProposalHtml,normalizeScopeItems} from '../lib/civolten-proposal.mjs';
import {budgetIssues} from '../lib/civolten-validation.mjs';
const make=extra=>({
 title:'Adequação e instalação elétrica',customer:'Cliente Exemplo',address:'Rua Exemplo, 123',
 days:15,services:'Execução conforme memorial aprovado.',civil_services:'Reforma de alvenaria.',
 electrical_services:'Instalação de quadro de distribuição.',
 payment_terms:'Pagamento mediante etapas aprovadas.',validity_days:15,
 scope_items:[{description:'Alvenaria',unit:'m²',quantity:20,category:'civil'},
 {description:'Passagem de cabos',unit:'m',quantity:100,category:'eletrica'}],
 notes:'Verificar o acesso ao local.',...extra
});
const opt={priceCents:2465000,id:'550e8400-e29b-41d4-a716-446655440000',
 logoDataUrl:'/assets/civolten-logo.png',headerArtUrl:'/assets/civolten-proposal-header.png'};
test('novo orçamento imprime sete páginas com CIVOLTEN em todas',()=>{
 const html=buildProposalHtml(make(),opt);
 assert.equal((html.match(/class="cv-page /g)||[]).length,7);
 assert.equal((html.match(/class="proposal-masthead"/g)||[]).length,7);
 assert.equal((html.match(/class="proposal-logo"/g)||[]).length,7);
 assert.equal((html.match(/class="proposal-header-art"/g)||[]).length,7);
 for(const heading of ['Apresentação da empresa','Construção Civil','Instalações Elétricas',
 'Metodologia de execução e cronograma','Investimento e condições comerciais',
 'Garantias, responsabilidades e aceite']) assert.ok(html.includes(heading),heading);
 assert.match(html,/24\.650,00/);
 assert.match(html,/Pagamento mediante etapas aprovadas/);
 assert.match(html,/Assinatura|assinatura/);
});
test('quantidades civis e elétricas são separadas e não há preços internos',()=>{
 const html=buildProposalHtml(make({staff:[{name:'SEGREDO_FUNCIONARIO',daily_cents:100}],
 expenses:[{name:'SEGREDO_MATERIAL'}],pricing:{tax_pct:88,margin_pct:22}}),opt);
 assert.ok(!html.includes('SEGREDO_FUNCIONARIO'));
 assert.ok(!html.includes('SEGREDO_MATERIAL'));
 assert.ok(!html.includes('tax_pct'));
 assert.match(html,/Passagem de cabos/);
 assert.match(html,/Alvenaria/);
 assert.deepEqual(normalizeScopeItems([{description:'Cabos',unit:'m',quantity:10,category:'eletrica'}])[0].category,'eletrica');
});
test('campos obrigatórios do novo PDF são validados e rascunhos são permitidos',()=>{
 const incomplete=make({payment_terms:'',validity_days:'',customer:''});
 const pdf=budgetIssues(incomplete,{forPdf:true});
 assert.ok(pdf.some(x=>x.selector==='[data-draft="payment_terms"]'));
 assert.ok(pdf.some(x=>x.selector==='[data-draft="validity_days"]'));
 assert.ok(pdf.some(x=>x.selector==='[data-draft="customer"]'));
 const draft=budgetIssues(incomplete,{forPdf:false});
 assert.ok(!draft.some(x=>x.selector==='[data-draft="payment_terms"]'));
});
test('novo A4 é nomeado e não altera o formato de contratos',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 assert.match(css,/@page cvProposal\s*\{size:A4; margin:0\}/);
 assert.match(css,/page:cvProposal/);
 assert.match(css,/\.contract-document/);
});
