import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const core=read('assets/civolten.js');
const start=core.indexOf('function showSimulationState(');
const end=core.indexOf("$('files').onchange=",start);
assert.ok(start>0&&end>start,'Handler de simulação não encontrado');
const code=core.slice(start,end);

function fixture({response={simulacao:{total_bruto:468.9}},issues=[],error=null}={}){
 const els={};
 const node=tag=>({
  tag,children:[],textContent:'',disabled:false,open:false,scrolled:false,
  classList:{states:new Set(['hidden']),add(key){this.states.add(key)},remove(key){this.states.delete(key)},toggle(key,on){if(on)this.states.add(key);else this.states.delete(key)},contains(key){return this.states.has(key)}},
  replaceChildren(...children){this.children=[...children]},append(...children){this.children.push(...children)},
  scrollIntoView(){this.scrolled=true}
 });
 for(const id of ['simulate','estimate','quoteEstimateOptions','cartTechnicalEditor','days','km'])els[id]=node(id);
 els.days.value='1';els.km.value='0';
 const cart=[{servico_id:'pintura_alvenaria',quantidade:5,modalidade:'completo'},{servico_id:'quadro_distribuicao',quantidade:2,modalidade:'completo'}];
 let payload,apiCalls=0;
 const ctx={
  $:id=>els[id],
  document:{createElement:node},
  clean(){},resetFieldErrors(){},
  simulationRequiredErrors:()=>issues,
  currentItems:()=>cart,
  api:async(method,action,data)=>{apiCalls++;payload={method,action,data};if(error)throw error;return response},
  BRL:n=>'R$ '+Number(n).toFixed(2),
  padrao:'medio',Number
 };
 vm.runInNewContext(code,ctx);
 const texts=()=>els.estimate.children.map(n=>n.textContent);
 return {els,cart,texts,run:()=>els.simulate.onclick(),calls:()=>apiCalls,payload:()=>payload};
}

test('simular envia as mesmas linhas do carrinho e exibe o total no próprio bloco',async()=>{
 const t=fixture();
 await t.run();
 assert.equal(t.calls(),1);
 assert.equal(t.payload().method,'POST');
 assert.equal(t.payload().action,'simulate');
 assert.equal(t.payload().data.itens.length,2);
 assert.equal(t.payload().data.itens[0].servico_id,'pintura_alvenaria');
 assert.equal(t.payload().data.itens[0].quantidade,5);
 assert.equal(t.payload().data.itens[1].servico_id,'quadro_distribuicao');
 assert.equal(t.payload().data.itens[1].quantidade,2);
 assert.equal(t.texts()[1],'R$ 468.90');
 assert.equal(t.els.estimate.classList.contains('hidden'),false);
 assert.equal(t.els.estimate.scrolled,true);
 assert.equal(t.els.simulate.disabled,false);
});

test('serviço sem preço oferece avaliação personalizada sem apagar o carrinho',async()=>{
 const t=fixture({response:{avaliacao_necessaria:true,mensagem:'Aguardando avaliação técnica.'}});
 await t.run();
 assert.equal(t.texts()[1],'Avaliação personalizada');
 assert.match(t.texts()[2],/avaliação técnica/);
 assert.equal(t.cart.length,2);
});

test('erro da API aparece junto ao botão, não numa seção de contato escondida',async()=>{
 const t=fixture({error:new Error('Falha de conexão')});
 await t.run();
 assert.equal(t.calls(),1);
 assert.equal(t.texts()[1],'Não foi possível calcular agora');
 assert.match(t.texts()[2],/Falha de conexão/);
 assert.equal(t.els.estimate.classList.contains('quote-estimate-error'),true);
 assert.equal(t.els.estimate.classList.contains('hidden'),false);
 assert.equal(t.els.estimate.scrolled,true);
});

test('validação mostra erro visível no simulador sem chamar API',async()=>{
 const t=fixture({issues:[{field:null,message:'Selecione pelo menos um serviço para simular.'}]});
 await t.run();
 assert.equal(t.calls(),0);
 assert.match(t.texts()[2],/Selecione pelo menos um serviço/);
 assert.equal(t.els.estimate.classList.contains('quote-estimate-error'),true);
});

test('html inclui revisão dos serviços, feedback e versões de cache atualizadas',()=>{
 for(const page of ['index.html','orcamento.html','empresa.html']){
  const html=read(page);
  for(const id of ['quoteCartReview','quoteCartItems','quoteCartCount','quoteCartNotice','estimate'])
   assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/civolten-carrinho\.js\?v=3/);
  assert.match(html,/civolten\.js\?v=17/);
  assert.match(html,/civolten-app-unificado\.css\?v=9/);
 }
 const css=read('assets/civolten-app-unificado.css');
 assert.match(css,/\.quote-cart-review\{border:/);
 assert.match(css,/\.quote-simulation-actions #estimate\.quote-estimate-error/);
});
