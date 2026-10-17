import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PDFDocument} from 'pdf-lib';
import {generateQuotePdf} from '../lib/civolten-pdf.mjs';

const source=readFileSync(new URL('../supabase/functions/civolten-beta/quote-extra.ts',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source.replace(/^export /gm,'')+'\nglobalThis.unit={validateItems,validateTerms};',context);
const {validateItems,validateTerms}=context.unit;
const sample={id:'a0912d32-4444-4444-8444-444444444444',customer_name:'Cliente Exemplo Silva',
 description:'Instalação de quadro e pintura completa',status:'novo',
 estimate_min:null,estimate_max:null,submitted_at:new Date().toISOString(),request_details:{itens:[]}};
test('editor comercial calcula soma exata e aceita unidade e quantidade decimal',()=>{
 const x=validateItems([
  {description:'Pintura do imóvel',unit:'m²',quantity:2.5,unit_price:120.2},
  {description:'Quadro de distribuição',unit:'unidade',quantity:1,unit_price:300.1}
 ]);
 assert.equal(x.total,600.6);
 assert.equal(x.items[0].line_total,300.5);
 assert.equal(x.items[1].line_total,300.1);
});
test('editor impede preço falso, item sem descrição e quantidade inválida',()=>{
 for(const line of [
  {description:'',unit:'un.',quantity:1,unit_price:20},
  {description:'Serviço válido',unit:'un.',quantity:-1,unit_price:20},
  {description:'Serviço válido',unit:'un.',quantity:1,unit_price:Infinity},
  {description:'Serviço válido',unit:'un.',quantity:1,unit_price:-0.01}
 ])assert.throws(()=>validateItems([line]));
});
test('prazo e validade são validados no servidor',()=>{
 assert.equal(validateTerms({validity_days:15,deadline:'20 dias',payment:'50%'}).validity_days,15);
 assert.throws(()=>validateTerms({validity_days:9999}));
});
test('PDF usa valores editados pela empresa sem precisar inventar preço da simulação',async()=>{
 const model={
  pedido:sample,
  simulacao:null,
  servicos:[],
  commercial:{
   revision:2,total:1850.50,
   items:[
    {description:'Pintura de dois quartos',quantity:1,unit:'serv.',unit_price:750.50,line_total:750.50},
    {description:'Troca do quadro elétrico',quantity:1,unit:'serv.',unit_price:1100,line_total:1100}
   ],
   terms:{validity_days:15,deadline:'10 dias úteis',payment:'50% na aprovação',included:'Mão de obra',excluded:'Materiais adicionais'}
  },
  branding:{company_name:'CIVOLTEN',color_primary:'#0A223A',color_accent:'#FFC34B'}
 };
 const data=await generateQuotePdf(model,'final');
 assert.equal(Buffer.from(data).subarray(0,5).toString(),'%PDF-');
 const doc=await PDFDocument.load(data);
 assert.ok(doc.getPageCount()>=1);
});
test('página pública de proposta não usa interpolação HTML insegura nem armazena credenciais',()=>{
 const content=readFileSync(new URL('../assets/proposta.js',import.meta.url),'utf8');
 assert.doesNotMatch(content,/innerHTML|localStorage|sessionStorage|document\.cookie/);
 assert.match(content,/client-decision/);
});
