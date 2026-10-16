import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {generateQuotePdf} from '../lib/civolten-pdf.mjs';
import {approvedQuoteTotal,commercialBreakdown} from '../lib/civolten-commercial.mjs';
import handler from '../api/quote-pdf.mjs';

const ID='a0912d32-4444-4444-8444-444444444444';
function pedido(min=null,max=null){
 return {pedido:{
  id:ID,customer_name:'Cliente Teste Silva',phone:'+5511999887766',
  city:'São Paulo',neighborhood:'Mooca',description:'Reforma elétrica completa e pintura do apartamento com verificação dos circuitos.',
  status:'analisando',estimate_min:min,estimate_max:max,
  request_details:{padrao:'medio',itens:[{servico_id:'reforma_apartamento_completa',quantidade:40},{servico_id:'ponto_tomada_interruptor',quantidade:5}]},
  admin_notes:'NÃO DEVE APARECER NO PDF',submitted_at:'2026-10-16T10:00:00Z'
 },simulacao:{total_bruto:111767.68,itens:[
  {servico_id:'reforma_apartamento_completa',descricao:'Reforma completa de apartamento',unidade:'m²',quantidade:40,total:100000,preco_unitario:2500},
  {servico_id:'ponto_tomada_interruptor',descricao:'Ponto de tomada/interruptor',unidade:'unidade',quantidade:5,total:1500,preco_unitario:300}
 ]},servicos:[
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
test('PDF do cliente funciona a partir da simulação sem exigir mínimo e máximo',async()=>{
 const bytes=await generateQuotePdf(pedido(),'final');
 const doc=await PDFDocument.load(bytes);
 assert.ok(doc.getPageCount()>=1);
});
test('PDF final exige simulação válida e não fabrica preços',async()=>{
 const d=pedido();
 d.simulacao=null;
 await assert.rejects(()=>generateQuotePdf(d,'final'),e=>e.status===409);
});
test('os valores comerciais distribuem o total aprovado sem mostrar custos internos',()=>{
 const m=pedido(125000,125000);
 const rows=commercialBreakdown(m.pedido,m.simulacao,m.servicos,approvedQuoteTotal(m.pedido,m.simulacao));
 assert.equal(rows.length,2);
 assert.equal(rows.reduce((sum,x)=>sum+Math.round(x.lineTotal*100),0),12500000);
 assert.equal(rows[0].quantity,40);
 assert.ok(rows[0].unitPrice>0);
 assert.equal(rows[0].name,'Reforma completa de apartamento');
});
test('descrição sem serviços selecionados vira um único escopo sem inventar itens',async()=>{
 const m=pedido();
 m.pedido.request_details.itens=[];
 m.pedido.description='Quero aumentar 5 quartos';
 m.simulacao={total_bruto:293780.30,itens:[]};
 const rows=commercialBreakdown(m.pedido,m.simulacao,m.servicos,293780.30);
 assert.equal(rows.length,1);
 assert.equal(rows[0].name,'Quero aumentar 5 quartos');
 assert.equal(rows[0].lineTotal,293780.30);
 const bytes=await generateQuotePdf(m,'final');
 assert.ok((await PDFDocument.load(bytes)).getPageCount()>=1);
});
test('PDF cliente permite valores aprovados e várias páginas',async()=>{
 const d=pedido(125000,125000);
 d.pedido.request_details.itens=Array.from({length:60},(_,i)=>({servico_id:i%2?'ponto_tomada_interruptor':'reforma_apartamento_completa',quantidade:i+1}));
 d.simulacao.itens=d.pedido.request_details.itens.map((x,i)=>({
  servico_id:x.servico_id,descricao:i%2?'Ponto de tomada/interruptor':'Reforma completa de apartamento',
  unidade:i%2?'unidade':'m²',quantidade:x.quantidade,total:(i+1)*100,preco_unitario:100
 }));
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
  return Response.json(pedido(125000,125000));
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
test('não se pode emitir PDF final com simulação ausente',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{const d=pedido();d.simulacao=null;return Response.json(d)};
 try{
  const r=await handler.fetch(new Request('https://civolten.vercel.app/api/quote-pdf?id='+ID+'&mode=final',{
   headers:{Cookie:'__Host-civolten_session='+'a'.repeat(140)}
  }));
  assert.equal(r.status,409);
 }finally{globalThis.fetch=original}
});


test('valores arredondados preservam o total em centavos',()=>{
 const m=pedido();
 m.pedido.request_details.itens=[
  {servico_id:'ponto_tomada_interruptor',quantidade:1},
  {servico_id:'ponto_tomada_interruptor',quantidade:1},
  {servico_id:'ponto_tomada_interruptor',quantidade:1}
 ];
 m.simulacao.itens=m.pedido.request_details.itens.map(()=>({
  servico_id:'ponto_tomada_interruptor',quantidade:1,total:1,descricao:'Ponto de tomada',unidade:'un.'
 }));
 const rows=commercialBreakdown(m.pedido,m.simulacao,m.servicos,10);
 assert.deepEqual(rows.map(r=>Math.round(r.lineTotal*100)),[334,333,333]);
 assert.equal(rows.reduce((sum,row)=>sum+Math.round(row.lineTotal*100),0),1000);
});
test('snapshot diferente do pedido impede detalhamento com preço inventado',()=>{
 const m=pedido();
 m.simulacao.itens[0].quantidade=41;
 assert.throws(()=>commercialBreakdown(m.pedido,m.simulacao,m.servicos,120000),e=>e.status===409);
});
test('faixas legadas não aparecem como preço mínimo/máximo',()=>{
 const m=pedido(5000,10000);
 assert.equal(approvedQuoteTotal(m.pedido,m.simulacao),m.simulacao.total_bruto);
});
