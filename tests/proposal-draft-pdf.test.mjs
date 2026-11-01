import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {renderProposalDraftPdf} from '../src/proposal-draft-pdf.mjs';
const sample=()=>({
 model:'civolten-proposal-draft-v1',
 issued:false,commercial_release:false,
 budget:{code:'QA4-ABC123',lock_version:2},
 client:{name:'Cliente 100% fictício'},
 project:{title:'Obra fictícia de homologação'},
 scope:'Serviços de pintura de teste sem validade comercial',
 exclusions:'Não se incluem serviços extras ou escopos não previstos',
 payment_terms:'Pagamento fictício conforme acordo de teste',
 validity_days:30,
 items:[{name:'Pintura em parede com áreas medidas',code:'PINT-QA',quantity:'100',unit:'M2',unit_cost:'50'}],
 costs:{direct_reais:5000,bdi_reais:1200,contingency_reais:200,total_reais:6400,
  blocking_errors:[{code:'NOT_REVIEWED',message:'Orçamento não aprovado'}]}
});
test('PDF rascunho de proposta usa formato A4 e marca não emitido',async()=>{
 const bytes=await renderProposalDraftPdf(sample(),{version:1,sha256:'a'.repeat(64)});
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPage(0).getWidth(),595.28);
 assert.ok(pdf.getTitle().includes('RASCUNHO NAO EMITIDO'));
 assert.ok(pdf.getPageCount()>=1);
});
test('PDF de rascunho rejeita proposta comercial e documento sem hash',async()=>{
 const d=sample();d.commercial_release=true;
 await assert.rejects(()=>renderProposalDraftPdf(d,{version:1,sha256:'a'.repeat(64)}),/Somente snapshot/);
 const e=sample();e.issued=true;
 await assert.rejects(()=>renderProposalDraftPdf(e,{version:1,sha256:'a'.repeat(64)}),/Somente snapshot/);
 await assert.rejects(()=>renderProposalDraftPdf(sample(),{version:1,sha256:'x'}),/Versão e hash/);
});
test('PDF de rascunho com serviços longos pagina sem truncar',async()=>{
 const d=sample();
 d.items=Array.from({length:105},(_,i)=>({name:'Serviço fictício de teste com especificações detalhadas '+i,
  code:'QA-'+i,quantity:'10',unit:'M2',unit_cost:'15.00'}));
 const pdf=await PDFDocument.load(await renderProposalDraftPdf(d,{version:3,sha256:'f'.repeat(64)}));
 assert.ok(pdf.getPageCount()>1);
});
\ntest('proposta de rascunho incorpora logos oficiais, apresenta cores metálicas e não expõe folha nem margem',async()=>{\n const source=readFileSync(new URL('../src/proposal-draft-pdf.mjs',import.meta.url),'utf8');\n assert.match(source,/assets\\/logo\\.png/);\n assert.match(source,/assets\\/icone\\.png/);\n assert.match(source,/Visão voltada ao cliente/);\n assert.doesNotMatch(source,/costRow\\('Pro-labore/);\n assert.doesNotMatch(source,/costRow\\('Meta de margem/);\n const bytes=await renderProposalDraftPdf(sample(),{version:4,sha256:'f'.repeat(64)});\n assert.ok(bytes.length>12000,'Logomarca e símbolo precisam estar incorporados ao PDF');\n const pdf=await PDFDocument.load(bytes);\n assert.equal(pdf.getPage(0).getWidth(),595.28);\n});\n