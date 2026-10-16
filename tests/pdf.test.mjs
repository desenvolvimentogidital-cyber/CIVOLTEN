import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {generateQuotePdf} from '../lib/civolten-pdf.mjs';
import handler from '../api/quote-pdf.mjs';

const ID='a0912d32-4444-4444-8444-444444444444';
function pedido(min=null,max=null){
 return {pedido:{
  id:ID,customer_name:'Cliente Teste Silva',phone:'+5511999887766',
  city:'São Paulo',neighborhood:'Mooca',description:'Reforma elétrica completa e pintura do apartamento com verificação dos circuitos.',
  status:'analisando',estimate_min:min,estimate_max:max,
  request_details:{padrao:'medio',itens:[{servico_id:'reforma_apartamento_completa',quantidade:40},{servico_id:'ponto_tomada_interruptor',quantidade:5}]},
  admin_notes:'NÃO DEVE APARECER NO PDF',submitted_at:'2026-10-16T10:00:00Z'
 },simulacao:{total_bruto:111767.68},servicos:[
  {service_id:'reforma_apartamento_completa',description:'Reforma completa de apartamento',unit:'m²'},
  {service_id:'ponto_tomada_interruptor',description:'Ponto de tomada/interruptor',unit:'unidade'}
 ]};
}

test('prévia PDF é gerada sem preço administrativo, com páginas e metadados',async()=>{
 const bytes=await generateQuotePdf(pedido(), 'preview');
 assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
 assert.ok(bytes.length>850);
 const doc=await PDFDocument.load(bytes);
 assert.equal(doc.getTitle(),'CIVOLTEN - Orçamento '+ID.slice(0,8).toUpperCase());
 assert.ok(doc.getPageCount()>=1);
});
test('PDF de cliente exige preço salvo pela empresa',async()=>{
 await assert.rejects(()=>generateQuotePdf(pedido(),'final'),e=>e.status===409);
});
test('PDF cliente permite valores aprovados e várias páginas',async()=>{
 const d=pedido(110000,125000);
 d.pedido.request_details.itens=Array.from({length:60},(_,i)=>({servico_id:i%2?'ponto_tomada_interruptor':'reforma_apartamento_completa',quantidade:i+1}));
 const bytes=await generateQuotePdf(d,'final');
 const doc=await PDFDocument.load(bytes);
 assert.ok(doc.getPageCount()>=2);
});
test('PDF endpoint nega acesso sem sessão',async()=>{
 const url='https://civolten.vercel.app/api/quote-pdf?id='+ID;
 const r=await handler.fetch(new Request(url));
 assert.equal(r.status,401);
 assert.match(r.headers.get('Cache-Control'),/no-store/);
});
test('PDF endpoint não expõe dados internos e retorna PDF autenticado',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  assert.match(String(url),/api=admin-quote/);
  assert.equal(opts.headers.Authorization,'Bearer '+'a'.repeat(140));
  return Response.json(pedido(110000,125000));
 };
 try{
  const req=new Request('https://civolten.vercel.app/api/quote-pdf?id='+ID+'&mode=final',{
   headers:{Cookie:'__Host-civolten_session='+'a'.repeat(140)}
  });
  const r=await handler.fetch(req);
  assert.equal(r.status,200);
  assert.equal(r.headers.get('Content-Type'),'application/pdf');
  assert.match(r.headers.get('Content-Disposition'),/attachment/);
  assert.match(r.headers.get('Cache-Control'),/no-store/);
  const bytes=new Uint8Array(await r.arrayBuffer());
  const doc=await PDFDocument.load(bytes);assert.ok(doc.getPageCount()>=1);
 }finally{globalThis.fetch=original}
});
test('não se pode emitir PDF final com números não aprovados',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json(pedido());
 try{
  const r=await handler.fetch(new Request('https://civolten.vercel.app/api/quote-pdf?id='+ID+'&mode=final',{
   headers:{Cookie:'__Host-civolten_session='+'a'.repeat(140)}
  }));
  assert.equal(r.status,409);
 }finally{globalThis.fetch=original}
});
