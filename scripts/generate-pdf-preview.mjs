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
const tailored=structuredClone(detailed);
tailored.commercial={
 revision:3,total:123450.75,decision:'draft',
 items:[
  {description:'Demolição e recomposição com preparação dos ambientes',quantity:35,unit:'m²',unit_price:2000,line_total:70000},
  {description:'Pontos de tomada e interruptor',quantity:9,unit:'unidade',unit_price:150,line_total:1350},
  {description:'Pintura premium e acabamento interno',quantity:68,unit:'m²',unit_price:766.1875,line_total:52100.75}
 ],
 terms:{validity_days:15,deadline:'30 dias úteis após aprovação',
 payment:'30% na aprovação; 70% conforme etapas concluídas',
 included:'Mão de obra e preparação; materiais somente quando indicados no escopo.',
 excluded:'Alterações estruturais, taxas públicas e quaisquer serviços não descritos.'}
};
tailored.branding={
 company_name:'CIVOLTEN',color_primary:'#08182B',color_accent:'#DCA629'
};
writeFileSync('preview-artifacts/CIVOLTEN-PRO-EDITADO-v1.pdf',await generateQuotePdf(tailored,'final'));
console.log('Amostras PDF vetoriais geradas.');
