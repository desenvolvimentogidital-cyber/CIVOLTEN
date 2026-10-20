import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('assets/civolten-quote-flow.js');

function mock(){
 const handlers={},elements={},cart=[];
 function el(id){
  return elements[id]||=({
   value:'',textContent:'',open:false,attrs:{},options:[],
   addEventListener(type,fn){handlers[id+':'+type]=fn},
   setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
   focus(){this.focused=true},scrollIntoView(){this.scrolled=true},
   dispatchEvent(){this.dispatched=true}
  });
 }
 for(const id of ['quoteContactDetails','goQuoteDetails','catalogType',
  'projectBuildAdd','projectBuildArea','projectBuildFeedback',
  'projectRenovationAdd','projectRenovationArea','projectRenovationFeedback',
  'category','desc'])el(id);
 const approved=['construcao_residencial_completa','reforma_apartamento_completa'];
 const window={location:{pathname:'/orcamento',search:''},
  CIVOLTEN_FORM:{
   getCatalog:()=>approved.map(id=>({id,unidade:'m²'})),
   getCart:()=>cart,
   addCartItem(id,quantidade){if(!approved.includes(id))return {ok:false,message:'Serviço indisponível.'};cart.push({servico_id:id,quantidade,modalidade:'completo'});return {ok:true}}
  },
  CIVOLTEN_CARRINHO:{refresh(){window.refreshed=true}}
 };
 const doc={getElementById:id=>elements[id]||null};
 vm.runInNewContext(script,{document:doc,window,URLSearchParams,Number,Object,Array,Set});
 const click=id=>handlers[id+':click']();
 return {elements,cart,window,click};
}

test('construção do zero adiciona 120 m² ao carrinho com unidade e descrição de projeto integral',()=>{
 const m=mock();
 m.elements.projectBuildArea.value='120';
 m.click('projectBuildAdd');
 assert.deepEqual(JSON.parse(JSON.stringify(m.cart)),[
  {servico_id:'construcao_residencial_completa',quantidade:120,modalidade:'completo'}
 ]);
 assert.equal(m.elements.category.value,'construcao');
 assert.match(m.elements.desc.value,/Construção residencial completa/);
 assert.match(m.elements.desc.value,/120 m²/);
 assert.match(m.elements.projectBuildFeedback.textContent,/120 m² adicionados/);
 assert.equal(m.window.refreshed,true);
});

test('reforma por 85,5 m² usa serviço real já precificado e mantém ambos no carrinho',()=>{
 const m=mock();
 m.elements.projectBuildArea.value='120';m.click('projectBuildAdd');
 m.elements.projectRenovationArea.value='85.5';m.click('projectRenovationAdd');
 assert.equal(m.cart.length,2);
 assert.equal(m.cart[0].quantidade,120);
 assert.equal(m.cart[1].servico_id,'reforma_apartamento_completa');
 assert.equal(m.cart[1].quantidade,85.5);
 assert.equal(m.elements.category.value,'outros');
 assert.match(m.elements.projectRenovationFeedback.textContent,/85,5 m²/);
});

test('área inválida é bloqueada sem adicionar projeto ou inventar valor',()=>{
 for(const bad of ['', '0', '-5', '100001', '12.1234', 'abc']){
  const m=mock();m.elements.projectBuildArea.value=bad;
  m.click('projectBuildAdd');
  assert.equal(m.cart.length,0,'não adicionar '+bad);
  assert.match(m.elements.projectBuildFeedback.textContent,/Informe a área construída/);
 }
});

test('obra integral só usa composição cadastrada no servidor, sem preço fixo no frontend',()=>{
 const matrix=JSON.parse(read('app-nextjs/data/matriz-precos.json'));
 assert.equal(Object.keys(matrix.servicos).length,18);
 const service=matrix.servicos.construcao_residencial_completa;
 assert.equal(service.unidade,'m²');
 for(const key of ['baixo','medio','alto'])assert.equal(service[key],0);
 assert.match(service.observacao,/avaliação técnica obrigatória/);
 const fallback=/const FALLBACK_CATALOG=(\[[^;]+\]);/.exec(read('assets/civolten.js'));
 assert.ok(fallback);
 const list=JSON.parse(fallback[1]);
 assert.equal(list.length,18);
 assert.equal(list.find(x=>x.id==='construcao_residencial_completa').unidade,'m²');
 assert.match(read('supabase/functions/civolten-beta/index.ts'),/if\(unit===0\)throw new Error\('PRECIFICACAO_PENDENTE:/);
 assert.doesNotMatch(script,/localStorage|sessionStorage|preco_unitario|precoTotal/);
 assert.match(read('assets/civolten-carrinho.js'),/construcao_residencial_completa:'construcao'/);
});

test('atalhos móveis aparecem na página de orçamento sem dados pessoais prévios',()=>{
 const html=read('orcamento.html');
 assert.ok(html.indexOf('id="fullProjectShortcuts"')<html.indexOf('id="catalogFinder"'));
 for(const id of ['projectBuildArea','projectBuildAdd','projectBuildFeedback','projectRenovationArea','projectRenovationAdd','projectRenovationFeedback'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="projectBuildArea"[^>]*type="number"[^>]*inputmode="decimal"/);
 assert.match(html,/civolten-quote-flow\.js\?v=2/);
 assert.match(html,/civolten-carrinho\.js\?v=5/);
 assert.match(read('assets/civolten-app-unificado.css'),/\.project-shortcuts-grid\{display:grid;grid-template-columns:1fr 1fr/);
});
