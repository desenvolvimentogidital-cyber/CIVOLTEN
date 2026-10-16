import {writeFileSync,mkdirSync} from 'node:fs';
import {generateQuotePdf} from '../lib/civolten-pdf.mjs';

const id='a0912d32-4444-4444-8444-444444444444';
const base={
 pedido:{
  id,
  customer_name:'CLIENTE DE DEMONSTRAÇÃO',
  phone:'(11) 99999-0000',
  city:'São Paulo',
  neighborhood:'Bela Vista',
  description:'Quero aumentar 5 quartos',
  status:'novo',
  estimate_min:null,
  estimate_max:null,
  submitted_at:'2026-10-16T12:00:00Z',
  request_details:{itens:[]}
 },
 simulacao:{total_bruto:293780.30},servicos:[]
};
mkdirSync('preview-artifacts',{recursive:true});
writeFileSync('preview-artifacts/CIVOLTEN-PREVIA-v2.pdf',await generateQuotePdf(base,'preview'));
const final=structuredClone(base);
final.pedido.estimate_min=290000;
final.pedido.estimate_max=310000;
writeFileSync('preview-artifacts/CIVOLTEN-ORCAMENTO-v2.pdf',await generateQuotePdf(final,'final'));
const detailed=structuredClone(base);
detailed.pedido.description='Reforma e ampliação de quartos com instalações elétricas e pintura';
detailed.pedido.request_details={
 padrao:'medio',itens:[
  {servico_id:'reforma_apartamento_completa',quantidade:35},
  {servico_id:'ponto_tomada_interruptor',quantidade:9},
  {servico_id:'pintura_alvenaria',quantidade:68}
 ]
};
detailed.simulacao.itens=[
 {servico_id:'reforma_apartamento_completa',descricao:'Reforma completa dos ambientes',unidade:'m²',quantidade:35,total:85000},
 {servico_id:'ponto_tomada_interruptor',descricao:'Ponto de tomada e interruptor',unidade:'unidade',quantidade:9,total:1800},
 {servico_id:'pintura_alvenaria',descricao:'Pintura de alvenaria e acabamento',unidade:'m²',quantidade:68,total:7900}
];
detailed.pedido.estimate_min=98000;
detailed.pedido.estimate_max=98000;
writeFileSync('preview-artifacts/CIVOLTEN-ORCAMENTO-DETALHADO-v3.pdf',await generateQuotePdf(detailed,'final'));
console.log('Amostras PDF vetoriais geradas.');
