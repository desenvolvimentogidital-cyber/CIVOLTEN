/* Catálogo de escolha rápida. IDs conferidos com os 17 serviços reais da CIVOLTEN.
 * Composições não cadastradas são encaminhadas para análise, nunca precificadas.
 */
(function(){
'use strict';
const directory={
 eletrica:{label:'Instalações elétricas',category:'eletrica',options:[
  ['instalacao_eletrica_completa','Instalação elétrica completa'],['passagem_fiacao','Passagem de fiação'],['quadro_distribuicao','Quadro de distribuição (QDC)'],['ponto_tomada_interruptor','Tomadas e interruptores'],['rasgo_parede_conduite','Infraestrutura para conduítes']]},
 manutencao:{label:'Manutenção elétrica',category:'manutencao',options:[
  ['quadro_distribuicao','Quadro de distribuição'],['ponto_tomada_interruptor','Trocar tomadas/interruptores'],['instalacao_chuveiro','Instalação de chuveiro'],['passagem_fiacao','Revisão de circuitos e fiação']]},
 iluminacao:{label:'Iluminação LED',category:'iluminacao',options:[
  ['luminaria_spot_led','Luminárias, plafons e spots'],['fita_led_sanca','Fita LED em sanca']]},
 solar:{label:'Energia solar',category:'outros',options:[]},
 construcao:{label:'Construção civil',category:'construcao',options:[
  ['levantamento_bloco','Construção de paredes'],['regularizacao_contrapiso','Contrapiso'],['reboco_interno','Reboco interno'],['demolicao_alvenaria','Demolição de alvenaria']]},
 reforma:{label:'Reformas em geral',category:'reforma',options:[
  ['reforma_apartamento_completa','Reforma completa'],['demolicao_alvenaria','Demolições'],['regularizacao_contrapiso','Contrapiso'],['drywall_pintura_premium','Drywall e acabamento']]},
 pisos:{label:'Pisos e revestimentos',category:'construcao',options:[
  ['assentamento_porcelanato','Assentamento de porcelanato'],['assentamento_azulejo_pastilha','Azulejos e pastilhas'],['regularizacao_contrapiso','Regularização de contrapiso']]},
 pintura:{label:'Pintura e acabamentos',category:'pintura',options:[
  ['pintura_alvenaria','Pintura de alvenaria'],['drywall_pintura_premium','Drywall com pintura premium'],['reboco_interno','Preparação e reboco']]},
 hidraulica:{label:'Serviços hidráulicos',category:'hidraulica',options:[]},
 alvenaria:{label:'Alvenaria e acabamentos',category:'construcao',options:[
  ['levantamento_bloco','Levantamento de blocos'],['reboco_interno','Reboco interno'],['assentamento_porcelanato','Revestimento porcelanato'],['assentamento_azulejo_pastilha','Azulejo ou pastilha']]},
};
const $=id=>document.getElementById(id);
const container=$('quickSubservices');
let current='eletrica';
function render(group){
 if(!Object.hasOwn(directory,group))return;
 current=group;
 if(!container)return;
 const info=directory[group];
 container.replaceChildren();
 const title=document.createElement('legend');
 title.textContent='O que você precisa em '+info.label+'?';
 container.appendChild(title);
 const note=document.createElement('p');
 note.className='quick-help';
 note.textContent=info.options.length?'Selecione um ou mais serviços. Você poderá ajustar as quantidades no orçamento.':'Esse serviço depende de avaliação técnica. Descreva abaixo o que precisa.';
 container.appendChild(note);
 for(const [id,label] of info.options){
  const wrap=document.createElement('label');wrap.className='quick-subitem';
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.name='quickItem';checkbox.value=id;
  const caption=document.createElement('span');caption.textContent=label;
  wrap.append(checkbox,caption);container.appendChild(wrap);
 }
 const detail=document.createElement('label');detail.className='quick-details-label';
 detail.textContent='Mais detalhes (opcional)';
 if(!info.options.length)detail.textContent='Descreva o serviço para avaliação';
 const input=document.createElement('textarea');input.id='quickDetails';input.maxLength=500;input.rows=2;
 input.placeholder=info.options.length?'Ex.: reforma do banheiro, área de 20 m²...':'Ex.: quero instalar um sistema de energia solar no meu imóvel...';
 detail.appendChild(input);container.appendChild(detail);
 const alert=document.createElement('p');alert.id='quickWarning';alert.className='quick-warning';alert.setAttribute('role','alert');alert.hidden=true;
 container.appendChild(alert);
}
function collect(){
 const info=directory[current];
 const ids=Array.from(container?.querySelectorAll('input[name="quickItem"]:checked')||[]).map(x=>x.value);
 const details=$('quickDetails')?.value.trim()||'';
 if(ids.length===0&&details.length<8){
  const warning=$('quickWarning');
  if(warning){warning.hidden=false;warning.textContent='Escolha pelo menos um serviço ou descreva sua necessidade (mínimo de 8 caracteres).';}
  $('quickDetails')?.focus();
  return null;
 }
 const raw=Number($('quickQuantity')?.value||1);
 const quantity=Number.isFinite(raw)&&raw>0&&raw<=100000?raw:1;
 const mode=document.querySelector('input[name="quickScope"]:checked')?.value==='mao_obra'?'mao_obra':'completo';
 return {category:info.category,group:current,label:info.label,items:ids,details,quantity,mode};
}
for(const button of document.querySelectorAll('[data-quick-category]')){
 button.addEventListener('click',()=>render(button.dataset.quickCategory));
}
render(current);
window.CIVOLTEN_QUICK_SELECTION={collect,render,directory};
})();
