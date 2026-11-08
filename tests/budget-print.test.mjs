import test from 'node:test';
import assert from 'node:assert/strict';
import {printableBudget,splitServicePages} from '../src/budget-print.mjs';
import {createService,priceBudget} from '../src/budget.mjs';
import {brl} from '../src/calc.mjs';

const real=(code,id)=>{
 const original=createService(code,id);
 return {...original,source:'manual',sourceCode:'',
  description:original.description.replace(/\\s*\\(exemplo\\)\\s*$/i,'')};
};
const budget=(override={})=>({
 id:'12345678-1111-4111-8111-111111111111',
 title:'Reforma comercial',customer:'Cliente de referência',
 project:'Reforma da sala',location:'São Paulo / SP',
 expiresOn:'2026-12-01',notes:'Serviços conforme descrito.',
 demo:false,status:'draft',createdAt:'2026-11-07T12:00:00.000Z',
 items:[{...real('DEMO-E01','item-1'),quantity:2},
  {...real('DEMO-C02','item-2'),quantity:3}],
 commercial:{paymentTerms:'Pagamento em duas etapas, conforme acordado',
  executionTerm:'Execução em até 20 dias úteis após liberação da obra',
  warrantyTerms:'Conforme contrato e legislação aplicável',
  scopeNotes:'Não inclui intervenções não descritas',
  companyContact:'contato@exemplo.test',companyDocument:'00.000.000/0000-00'},
 pricing:{monthlyCostCents:1600000,productiveHours:320,taxPct:10,marginPct:20,
  companyName:'CIVOLTEN',capturedOn:'2026-11-07'},...override
});
const pages=html=>Array.from(html.matchAll(/<section class="proposal-page ([^"]+)" data-pdf-page="(\d+)">/g)).map(x=>({kind:x[1],page:Number(x[2])}));
const section=html=>html.split(/(?=<section class="proposal-page )/).slice(1);

test('Signature possui capa, serviços e condições nessa ordem',()=>{
 const html=printableBudget(budget());
 assert.match(html,/budget-pdf-v5/);
 assert.deepEqual(pages(html).map(x=>x.kind),['proposal-cover','proposal-services','proposal-conditions']);
 assert.match(html,/Proposta<br><strong>Comercial<\/strong>/);
 assert.equal((html.match(/class="proposal-cover-background"/g)||[]).length,1);
 assert.match(html,/src="\/assets\/file_000000007df8820eb700b32dbfca9c55\.png"/);
 assert.equal((html.match(/class="proposal-helmet-brand"/g)||[]).length,1,'Logo do capacete aparece só na capa');
 assert.match(html,/class="proposal-helmet-mark" src="\/assets\/civolten-simbolo\.png"/);
 assert.match(html,/class="proposal-helmet-wordmark" src="\/assets\/civolten-logo\.png"/);
 const parts=section(html);
 assert.match(parts[0],/proposal-helmet-brand/);
 assert.doesNotMatch(parts[1]+parts[2],/proposal-helmet-brand/);
 assert.equal((html.match(/class="proposal-cover-background"/g)||[]).length,1);
 assert.match(html,/Descrição dos serviços/);
 assert.match(html,/INVESTIMENTO TOTAL/);
});
test('preço total aparece exclusivamente na folha de condições; nenhuma linha tem preço',()=>{
 const b=budget(),p=priceBudget(b),html=printableBudget(b);
 const parts=section(html);
 assert.equal(parts.length,3);
 const total=brl(p.totalSale);
 assert.equal(html.split(total).length-1,1,'Valor único, sem duplicidade na descrição dos serviços');
 assert.ok(parts[2].includes(total));
 for(const part of parts.slice(0,2)){
  assert.doesNotMatch(part,/R\$\s*[\d.]/);
  assert.doesNotMatch(part,/Valor unitário|Valor total|Preço total|Total dos serviços/);
 }
 assert.match(parts[1],/<th>Descrição do serviço<\/th><th>Unidade<\/th><th>Quantidade<\/th>/);
 assert.match(parts[1],/Instalação de ponto elétrico/);
 assert.doesNotMatch(parts[1],/<th>.*Valor/);
 assert.doesNotMatch(html,/Lucro gerencial|Alíquota aplicada|Custo mensal da empresa/);
});
test('todas as páginas têm logotipo, número e marca-d’água; sem caixa de seção 01',()=>{
 const html=printableBudget(budget());
 assert.equal((html.match(/class="proposal-watermark"/g)||[]).length,3);
 assert.equal((html.match(/class="proposal-wordmark"/g)||[]).length,3);
 assert.equal((html.match(/data-pdf-page=/g)||[]).length,3);
 assert.match(html,/PC-2026-12345678/);
 assert.doesNotMatch(html,/budget-pdf-section-label[^>]*><span>01/);
 assert.match(html,/DEMONSTRAÇÃO · NÃO ENVIAR AO CLIENTE/);
 assert.match(html,/DOCUMENTO DE TESTE/);
});
test('paginação divide itens sem alterar totais, e o fechamento permanece no fim',()=>{
 const rows=Array.from({length:30},(_,i)=>({
  description:'Serviço executado conforme memorial e especificações '+i,unit:'un',quantity:i+1
 }));
 const chunks=splitServicePages(rows);
 assert.ok(chunks.length>=4);
 assert.deepEqual(chunks.flat(),rows);
 const b=budget({items:Array.from({length:30},(_,i)=>({...real('DEMO-E01','i'+i),quantity:i+1}))});
 const html=printableBudget(b),found=pages(html);
 assert.equal(found.length,chunks.length+2);
 assert.equal(found[0].kind,'proposal-cover');
 assert.equal(found.at(-1).kind,'proposal-conditions');
 assert.equal((html.match(/<strong>R\$\s/g)||[]).length,1);
});
test('condições comerciais são campos dinâmicos, escapados e sem prazos inventados',()=>{
 const b=budget({commercial:{paymentTerms:'<script>alert(1)</script>',
  executionTerm:'até 45 dias',warrantyTerms:'A combinar'}});
 const html=printableBudget(b);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/até 45 dias/);
 assert.match(html,/A combinar/);
 const blank=printableBudget(budget({commercial:{}}));
 assert.match(blank,/A definir entre as partes/);
 assert.doesNotMatch(blank,/Garantia de 12 meses|30 dias corridos/);
});
test('não gera PDF com preços ainda indisponíveis',()=>{
 assert.equal(printableBudget(budget({pricing:null})),'');
});

test('propostas antigas sem revisao nao geram PDF comercial',()=>{
 assert.equal(printableBudget(budget({demo:true})),'');
});
