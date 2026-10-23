import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {contractDefaults,defaultContractCompany,contractFromBudget,sanitizeContract,validateContractForExport,buildContractHtml,validBrazilDocument} from '../lib/civolten-contract.mjs';
import dataApi from '../api/data.mjs';

const company={company_name:'CIVOLTEN Serviços Ltda',company_document:'11.222.333/0001-81',company_address:'Rua dos Testes, 10',company_representative:'Responsável CIVOLTEN'};
const valid=()=>({...contractDefaults(),title:'Instalação elétrica',role:'prestadora',company,
 counterparty_name:'Cliente Exemplo',counterparty_document:'123.456.789-09',
 counterparty_address:'Av. Principal, 22',scope:'Instalação de circuitos e tomadas no imóvel',
 location:'Av. Principal, 22',start_on:'2026-11-03',end_on:'2026-11-20',
 value_cents:1250000,payment_terms:'30% na assinatura e 70% após entrega',payment_schedule:'Entrada: R$ 3.750,00 na assinatura; R$ 8.750,00 na entrega e vistoria'});
test('novos contratos começam com cláusulas sugeridas que podem ser alteradas',()=>{
 const c=contractDefaults();
 assert.match(c.materials,/materiais/);
 assert.match(c.changes,/escrito/);
 assert.equal(c.start_on,'');
 assert.equal(c.payment_terms,'');
 assert.equal(c.value_cents,0);
 assert.equal(defaultContractCompany().company_document,'');
});
test('usuário seleciona se a CIVOLTEN presta ou contrata o serviço',()=>{
 const a=buildContractHtml(valid());
 assert.match(a,/CONTRATADA \/ PRESTADORA:<\/strong> <strong>CIVOLTEN Serviços/);
 const b=buildContractHtml({...valid(),role:'contratante'});
 assert.match(b,/CONTRATANTE:<\/strong> <strong>CIVOLTEN Serviços/);
 assert.match(b,/CONTRATADA \/ PRESTADORA:<\/strong> <strong>Cliente Exemplo/);
});
test('puxa apenas dados comerciais de orçamento sem custos e margens sigilosos',()=>{
 const budget={id:'550e8400-e29b-41d4-a716-446655440000',title:'Construção elétrica',
  customer:'Cliente da Obra',price_cents:345678,content:{services:'Montagem de quadros',
  address:'Rua 5',scope_items:[{description:'Instalar tomada',quantity:3,unit:'un'}],
  staff:[{name:'Profissional restrito',daily_cents:88800}],
  expenses:[{name:'Despesa restrita'}],pricing:{margin_pct:40,tax_pct:15}}};
 const c=contractFromBudget(budget,company);
 assert.equal(c.counterparty_name,'Cliente da Obra');
 assert.equal(c.value_cents,345678);
 assert.match(c.scope,/Montagem de quadros/);
 assert.match(c.scope,/Instalar tomada/);
 assert.equal(c.company.company_document,company.company_document);
 assert.ok(!JSON.stringify(c).includes('Profissional restrito'));
 assert.ok(!JSON.stringify(c).includes('Despesa restrita'));
 assert.ok(!JSON.stringify(c).includes('margin_pct'));
});
test('contrato PDF contém partes, escopo, datas, preço global, termos e assinaturas',()=>{
 const html=buildContractHtml(valid(),{id:'550e8400-e29b-41d4-a716-446655440000'});
 for(const label of ['CONTRATO DE PRESTAÇÃO DE SERVIÇOS','Cliente Exemplo','CIVOLTEN Serviços','Instalação de circuitos',
 '03/11/2026','20/11/2026','R$','12.500,00','30% na assinatura','Cláusula 1','Cláusula 8',
 'Testemunha 1','Testemunha 2','CT-550E8400','Cronograma de parcelas','Vistoria e aceite','Responsabilidade técnica'])assert.ok(html.includes(label),label);
});
test('contrato não contém custos internos nem HTML injetado',()=>{
 const c={...valid(),scope:'Serviço de instalação <img src=x onerror=alert(1)> com disjuntores',
 special_terms:'<script>alert("x")</script>',staff:[{name:'Colaborador confidencial'}],
 pricing:{fixed_monthly_cents:22222222,margin_pct:55},profit_cents:888888};
 const html=buildContractHtml(c);
 for(const secret of ['Colaborador confidencial','22222222','margin_pct','profit_cents','<script>','<img src=x'])
  assert.ok(!html.includes(secret),'vazamento de '+secret);
 assert.match(html,/&lt;img/);
 assert.match(html,/&lt;script&gt;/);
});
test('não inventa identificação ou pagamento: PDF só é liberado após preenchimento',()=>{
 const c=valid();
 for(const changes of [{company:{...company,company_document:''}},
 {counterparty_document:''},{payment_schedule:''},{scope:'curto'},{location:''},{payment_terms:''},
 {start_on:'2026-13-02'},{end_on:'2026-10-01'},{value_cents:0}]){
  assert.throws(()=>validateContractForExport({...c,...changes}));
 }
 assert.doesNotThrow(()=>validateContractForExport(c));
});
test('minuta aceita informações parciais, mas rejeita campos e tipos inseguros',()=>{
 assert.equal(sanitizeContract({title:'Minuta'}).title,'Minuta');
 assert.throws(()=>sanitizeContract({role:'administrador'}));
 assert.throws(()=>sanitizeContract({value_cents:-100}));
 assert.throws(()=>sanitizeContract({value_cents:2.4}));
 assert.equal('staff' in sanitizeContract({...valid(),staff:[{name:'Sigilo'}]}),false);
});
test('RLS protege contratos e perfil, inclusive orçamento associado',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261023_cv_contracts_profiles.sql',import.meta.url),'utf8');
 for(const table of ['cv_contract_profiles','cv_contracts']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
  assert.match(sql,new RegExp('grant select,insert,update,delete on public\\.cv_contract_profiles,public\\.cv_contracts to authenticated'));
 }
 assert.match(sql,/owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/b\.owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/unique\(owner_id\)/);
});
test('interface oferece aba separada, perfil, novo contrato e impressão',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const view=fs.readFileSync(new URL('../assets/contracts.js',import.meta.url),'utf8');
 const print=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 assert.match(html,/data-view="contracts"/);
 assert.match(app,/startContract\(/);
 assert.match(app,/saveContractProfile\(/);
 assert.match(app,/buildContractHtml\(c,\{id:state\.contractId\}\)/);
 assert.match(app,/data-action="create-contract-from-budget"/);
 assert.match(app,/state\.contractDraft\[key\]=e\.value/);
 assert.match(view,/data-action="print-contract"/);
 assert.match(view,/id="contractProfileForm"/);
 assert.match(view,/Editar materiais, atrasos, aceite/);
 assert.match(print,/#printArea \.contract-document/);
});
test('API não aceita acesso a contratos sem sessão válida',async()=>{
 const req=new Request('https://civolten.example.test/api/data?entity=contracts',
  {method:'GET',headers:{'sec-fetch-site':'same-origin'}});
 const r=await dataApi.fetch(req);
 assert.equal(r.status,401);
});

test('validação de documentos rejeita dígitos falsos e aceita CPF, CNPJ numérico e alfanumérico',()=>{
 assert.equal(validBrazilDocument('123.456.789-09'),true);
 assert.equal(validBrazilDocument('11.222.333/0001-81'),true);
 assert.equal(validBrazilDocument('111.111.111-11'),false);
 assert.equal(validBrazilDocument('11.222.333/0001-82'),false);
 const body='A1B2C3D4E5F6';
 const nums=[...body].map(char=>char.charCodeAt(0)-48);
 const digit=(arr,weights)=>{const d=arr.reduce((sum,n,i)=>sum+n*weights[i],0)%11;return d<2?0:11-d};
 const first=digit(nums,[5,4,3,2,9,8,7,6,5,4,3,2]);
 const second=digit([...nums,first],[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 assert.equal(validBrazilDocument(body+first+second),true);
});
test('revisão exige motivo e impede documentos antigos serem alterados pela interface',()=>{
 const html=fs.readFileSync(new URL('../assets/contracts.js',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const api=fs.readFileSync(new URL('../api/data.mjs',import.meta.url),'utf8');
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261023184500_cv_contracts_lifecycle_guard.sql',import.meta.url),'utf8');
 assert.match(html,/revise-open-contract/);
 assert.match(app,/function reviseContract/);
 assert.match(app,/_locked:row.status!=='rascunho'/);
 assert.match(api,/existingContract\(id,jwt\)/);
 assert.match(migration,/new.content is distinct from old.content/);
 assert.throws(()=>validateContractForExport({...valid(),revision_of:'550e8400-e29b-41d4-a716-446655440000'}),/Justifique/);
 assert.doesNotThrow(()=>validateContractForExport({...valid(),revision_of:'550e8400-e29b-41d4-a716-446655440000',revision_reason:'Ajuste de prazo acordado'}));
});
