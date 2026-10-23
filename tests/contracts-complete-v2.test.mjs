import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildContractHtml,buildLegacyContractHtml,contractDefaults,
  sanitizeContract,validateContractForExport} from '../lib/civolten-contract.mjs';
import {contractIssues} from '../lib/civolten-validation.mjs';

const valid=()=>({
 ...contractDefaults(),title:'Adequação de instalações elétricas e reforma civil',
 role:'prestadora',
 company:{company_name:'CIVOLTEN Serviços Ltda',
  company_document:'11.222.333/0001-81',company_address:'Rua Exemplo, 100',
  company_representative:'Representante da Empresa'},
 counterparty_name:'Cliente Demonstração',counterparty_document:'123.456.789-09',
 counterparty_address:'Rua do Cliente, 23',scope:'Instalações elétricas, alvenaria e acabamentos previstos.',
 location:'Rua da Obra, 45',start_on:'2026-11-03',end_on:'2026-11-24',
 value_cents:1200000,payment_terms:'40% na contratação e saldo na entrega.',
 payment_schedule:'R$ 4.800 na contratação; R$ 7.200 na entrega.'
});
test('novos contratos possuem conteúdo completo e 30 cláusulas numeradas',()=>{
 const data=valid();
 const html=buildContractHtml(data,{id:'550e8400-e29b-41d4-a716-446655440000'});
 const sections=html.match(/class="contract-clause contract-clause-v2"/g)||[];
 assert.equal(sections.length,30);
 for(const part of [
  'Objeto e escopo','exclusões','Projetos','Materiais','Licenças',
  'Medições','Nota','NR-10','Segurança do trabalho','registro',
  'Equipe','Proteção do imóvel','resíduos','imprevistos',
  'Alterações','força maior','pagamento em atraso','testes',
  'Garantias legais','Responsabilidade civil','Rescisão',
  'Dados pessoais','Notificações','Solução de controvérsias',
  'Disposições gerais'])assert.ok(html.toLowerCase().includes(part.toLowerCase()),part);
 assert.match(html,/12\.000,00/);
 assert.match(html,/Assinatura e identificação/);
 assert.match(html,/Testemunha 1/);
 assert.match(html,/CT-550E8400/);
});
test('textos podem ser revisados sem expor folha, lucro ou despesas',()=>{
 const c=valid();
 c.electrical_safety='Proibição de trabalho energizado sem análise prévia.';
 c.scope='Serviços com caracteres <script>alert("x")</script>';
 c.staff=[{name:'FUNCIONÁRIO RESTRITO'}];c.pricing={margin_pct:30};c.profit_cents=777777;
 const html=buildContractHtml(c);
 assert.match(html,/Proibição de trabalho energizado/);
 assert.match(html,/&lt;script&gt;/);
 for(const text of ['FUNCIONÁRIO RESTRITO','margin_pct','profit_cents','<script>'])assert.ok(!html.includes(text),text);
});
test('contratos legados emitidos continuam com as 12 cláusulas anteriores',()=>{
 const data=valid();
 delete data.contract_template_version;  // documento armazenado antes do modelo completo
 const saved=sanitizeContract(data);
 assert.equal(saved.contract_template_version,'1');
 const html=buildContractHtml(saved);
 assert.equal((html.match(/class="contract-clause"/g)||[]).length,12);
 assert.equal(html,buildLegacyContractHtml(saved));
 assert.ok(!html.includes('contract-document-v2'));
});
test('novos contratos exigem endereço das partes e os antigos preservam regras',()=>{
 const c=valid();
 const fail={...c,counterparty_address:''};
 assert.throws(()=>validateContractForExport(fail),/endereço completo da outra parte/);
 assert.ok(contractIssues(fail,{forExport:true}).some(x=>x.selector==='[data-contract="counterparty_address"]'));
 const noCompanyAddress={...c,company:{...c.company,company_address:''}};
 assert.throws(()=>validateContractForExport(noCompanyAddress),/endereço completo da empresa/);
 const legacy={...fail,contract_template_version:'1'};
 assert.doesNotThrow(()=>validateContractForExport(legacy));
});
test('front-end possui edição de todos os textos e protege a versão antiga',()=>{
 const ui=fs.readFileSync(new URL('../assets/contracts.js',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 for(const field of ['electrical_safety','worksite_safety','permits','measurements',
  'unforeseen','subcontracting','dispute_resolution','confidentiality'])
  assert.ok(ui.includes(field),field);
 assert.match(app,/contract_template_version:row\.status==='rascunho'\?'2'/);
 assert.match(app,/contract_template_version:'2',status:'rascunho',revision_of/);
 assert.match(css,/\.contract-document-v2/);
 assert.match(css,/\.cv-proposal/);
});
