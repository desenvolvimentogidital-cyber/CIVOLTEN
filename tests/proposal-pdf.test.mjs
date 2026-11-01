import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {renderProposalPdf} from '../src/proposal-pdf.mjs';
const sample=()=>({
 code:'PROP-2026-0001',version:1,snapshot_sha256:'a'.repeat(64),issued_on:'2026-10-29',
 review:{technical:true,commercial:true,costs:true,scope:true,payment:true,schedule:true},
 company:{name:'CIVOLTEN Elétrica e Construção',tax_id:'11.222.333/0001-81'},
 client:{name:'Cliente comercial fictício',tax_id:'529.982.247-25'},
 project:{name:'Obra de teste',address:'Rua Exemplo, 100 - São Paulo'},
 scope:'Instalação elétrica conforme desenhos, quantitativos e memorial descritivo anexados.',
 exclusions:'Exclusos trabalhos estruturais não discriminados e materiais fora do orçamento.',
 validity_days:30,payment_terms:'50% na contratação e 50% mediante medição.',
 execution_term:'Dez dias úteis a contar da mobilização aprovada.',
 items:[{code:'2041',description:'Instalação do ponto de eletricidade',quantity:10,unit:'un',unit_cost:10}],
 bdi_amount:25,contingency_amount:0,total:125
});
test('PDF comercial válido gera páginas A4 e metadados sem modificar snapshot',async()=>{
 const d=sample(),json=JSON.stringify(d);
 const pdf=await renderProposalPdf(d);
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const opened=await PDFDocument.load(pdf);
 assert.ok(opened.getPageCount()>=1);
 assert.equal(opened.getPage(0).getWidth(),595.28);
 assert.ok(opened.getTitle().includes(d.code));
 assert.equal(JSON.stringify(d),json);
});
test('PDF suporta várias páginas e não corta lista longa de serviços',async()=>{
 const d=sample();d.items=Array.from({length:80},(_,i)=>({code:'S'+i,unit:'m²',description:'Descrição completa de serviço detalhado '+(i+1),quantity:1,unit_cost:10}));
 d.total=825;
 const pdf=await renderProposalPdf(d);
 assert.ok((await PDFDocument.load(pdf)).getPageCount()>1);
});
test('PDF não emite proposta sem todas as revisões',async()=>{
 const d=sample();d.review.technical=false;
 await assert.rejects(renderProposalPdf(d),/revisão technical pendente/);
});
test('PDF rejeita valor total diferente do snapshot calculado',async()=>{
 const d=sample();d.total=500;
 await assert.rejects(renderProposalPdf(d),/Divergência/);
});
test('PDF rejeita propostas sem hash/versionamento e sem contrato',async()=>{
 const d=sample();d.snapshot_sha256='';
 await assert.rejects(renderProposalPdf(d),/Snapshot/);
});

test('proposta comercial aprovada carrega automaticamente a logo original sem parâmetro externo',async()=>{
 const source=readFileSync(new URL('../src/proposal-pdf.mjs',import.meta.url),'utf8');
 assert.match(source,/assets\\/logo\\.png/);
 const bytes=await renderProposalPdf(sample());
 assert.ok(bytes.length>9000,'Logomarca deve estar incorporada');
});
