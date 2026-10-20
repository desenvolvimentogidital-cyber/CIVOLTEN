/* Etapas claras do orçamento CIVOLTEN. Apenas altera a interface,
 * sem duplicar cálculo, autenticação ou armazenamento de dados.
 */
(function(){
'use strict';
const path=window.location.pathname;
if(path!=='/orcamento'&&path!=='/orcamento.html')return;
const $=id=>document.getElementById(id);
const details=$('quoteContactDetails'),open=$('goQuoteDetails');
if(!details||!open)return;
open.addEventListener('click',()=>{
 details.open=true;
 details.scrollIntoView?.({behavior:'smooth',block:'start'});
 $('name')?.focus?.({preventScroll:true});
});
/* Escopos integrais sem precificar no navegador: cada atalho usa os
 * próprios IDs do catálogo, quantidade em m² e o backend oficial. */
const projectTypes=[
 {button:'projectBuildAdd',area:'projectBuildArea',feedback:'projectBuildFeedback',
  id:'construcao_residencial_completa',category:'construcao',
  description:'Construção residencial completa, do zero à entrega pronta conforme projeto, com área construída aproximada de '},
 {button:'projectRenovationAdd',area:'projectRenovationArea',feedback:'projectRenovationFeedback',
  id:'reforma_apartamento_completa',category:'reforma',
  description:'Reforma completa de apartamento, com área aproximada de '}
];
const parseArea=value=>{
 const raw=String(value??'').trim().replace(',','.');
 const amount=Number(raw);
 return /^\\d+(?:\\.\\d{1,3})?$/.test(raw)&&
  Number.isFinite(amount)&&amount>=1&&amount<=100000?amount:null;
};
for(const preset of projectTypes){
 const button=$(preset.button),area=$(preset.area),feedback=$(preset.feedback);
 if(!button||!area||!feedback)continue;
 button.addEventListener('click',()=>{
  const amount=parseArea(area.value);
  if(amount===null){
   feedback.textContent='Informe a área construída em m² (por exemplo, 120 ou 85,5).';
   area.setAttribute('aria-invalid','true');
   area.focus();
   return;
  }
  area.removeAttribute('aria-invalid');
  const api=window.CIVOLTEN_FORM;
  if(!api||!api.getCatalog().some(x=>x.id===preset.id)){
   feedback.textContent='O serviço ainda está carregando. Aguarde e tente novamente.';
   return;
  }
  const hadItems=api.getCart().length>0;
  const result=api.addCartItem(preset.id,amount);
  if(!result.ok){
   feedback.textContent=result.message||'Não foi possível adicionar esse projeto.';
   return;
  }
  const categorySelect=$('category');
  if(categorySelect){
   if(!hadItems)categorySelect.value=preset.category;
   else if(categorySelect.value!==preset.category)categorySelect.value='outros';
  }
  const desc=$('desc');
  if(desc&&!desc.value.trim()){
   desc.value=preset.description+String(amount).replace('.',',')+
    ' m². Escopo, terreno, materiais e prazo sujeitos a avaliação técnica.';
  }
  feedback.textContent=amount.toLocaleString('pt-BR')+
   ' m² adicionados ao carrinho. Confira as quantidades e simule ou acrescente outros serviços.';
  window.CIVOLTEN_CARRINHO?.refresh?.();
 });
}
const category=new URLSearchParams(window.location.search).get('servico');
const filter=$('catalogType');
if(category&&filter){
 const categories=new Set(Array.from(filter.options).map(x=>x.value));
 const desired=categories.has(category)?category:category==='construcao'?'construcao':null;
 if(desired){
  filter.value=desired;
  filter.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
})();
