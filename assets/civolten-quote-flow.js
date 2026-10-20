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
