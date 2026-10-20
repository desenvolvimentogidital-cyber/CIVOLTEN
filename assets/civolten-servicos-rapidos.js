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
 pintura:{label:'Pintura',category:'pintura',options:[
  ['pintura_alvenaria','Pintura de paredes'],
  ['avaliacao:pintura_tetos','Pintura de tetos'],
  ['avaliacao:pintura_pisos','Pintura de pisos'],
  ['avaliacao:pintura_drywall','Pintura de drywall']]},
 hidraulica:{label:'Serviços hidráulicos',category:'hidraulica',options:[]},
 alvenaria:{label:'Alvenaria e acabamentos',category:'construcao',options:[
  ['levantamento_bloco','Levantamento de blocos'],['reboco_interno','Reboco interno'],['assentamento_porcelanato','Revestimento porcelanato'],['assentamento_azulejo_pastilha','Azulejo ou pastilha']]},
};
const $=id=>document.getElementById(id);
const container=$('quickSubservices');
const saved=new Map();
const notes=new Map();
const quantities=new Map();
let current='eletrica',rendered=false;
const safeQuantity=value=>{
 const n=Number(value);
 return Number.isFinite(n)&&n>0&&n<=100000?n:1;
};
function saveCurrent(){
 if(!rendered||!container)return;
 const allowed=new Set(directory[current].options.map(([id])=>id));
 const chosen=Array.from(container.querySelectorAll('input[name="quickItem"]:checked'))
  .map(input=>input.value).filter(id=>allowed.has(id));
 if(chosen.length)saved.set(current,new Set(chosen));
 else saved.delete(current);
 const detail=$('quickDetails')?.value.trim().slice(0,500)||'';
 if(detail)notes.set(current,detail);
 else notes.delete(current);
 quantities.set(current,safeQuantity($('quickQuantity')?.value||1));
}
function buildSelection(){
 const selections=[],description=[];
 const categorySet=new Set();
 for(const [group,info] of Object.entries(directory)){
  const ids=saved.get(group)||new Set();
  const rawNote=notes.get(group)||'';
  if(!ids.size&&!rawNote)continue;
  categorySet.add(info.category);
  const quantity=quantities.get(group)||1;
  const assessments=[];
  for(const [id,label] of info.options){
   if(!ids.has(id))continue;
   if(id.startsWith('avaliacao:'))assessments.push(label);
   else selections.push({id,quantity});
  }
  const descriptionParts=[];
  if(assessments.length)descriptionParts.push('Serviços para avaliação: '+assessments.join(', ')+'. Quantidade aproximada: '+quantity+'.');
  if(rawNote)descriptionParts.push(rawNote);
  if(descriptionParts.length)description.push(info.label+': '+descriptionParts.join(' '));
 }
 const unique=new Map();
 for(const {id,quantity} of selections){
  const total=(unique.get(id)||0)+quantity;
  unique.set(id,Math.min(100000,Number(total.toFixed(3))));
 }
 return {
  selections:Array.from(unique,([id,quantity])=>({id,quantity})).slice(0,60),
  notes:description.join(' ').slice(0,1800),
  categorySet
 };
}
function drawSummary(){
 const summary=$('quickSelectionSummary'),itemsNode=$('quickSelectedItems');
 if(!summary&&!itemsNode)return;
 const {selections,notes:description}=buildSelection();
 const total=selections.length+
  Array.from(saved.entries()).reduce((n,[group,ids])=>n+
   Array.from(ids).filter(id=>id.startsWith('avaliacao:')).length,0);
 const activeGroups=new Set([...saved.keys(),...notes.keys()]).size;
 if(summary)summary.textContent=total+' serviço'+(total===1?'':'s')+' selecionado'+(total===1?'':'s')+
  (activeGroups?' em '+activeGroups+' categoria'+(activeGroups===1?'':'s'):'')+
  (description&&!total?' · Solicitação para avaliação':'');
 if(!itemsNode)return;
 itemsNode.replaceChildren();
 for(const [group,info] of Object.entries(directory)){
  const selected=saved.get(group)||new Set();
  for(const [id,label] of info.options){
   if(!selected.has(id))continue;
   const chip=document.createElement('span');chip.className='quick-selected-chip';
   const name=document.createElement('span');
   name.textContent=info.label+': '+label;
   const remove=document.createElement('button');
   remove.type='button';remove.textContent='×';
   remove.setAttribute('aria-label','Remover '+label+' de '+info.label);
   remove.addEventListener('click',()=>{
    selected.delete(id);
    if(!selected.size)saved.delete(group);
    if(group===current){
     for(const checkbox of container.querySelectorAll('input[name="quickItem"]')){
      if(checkbox.value===id)checkbox.checked=false;
     }
     saveCurrent();
    }
    drawSummary();
   });
   chip.append(name,remove);
   itemsNode.appendChild(chip);
  }
 }
}
function render(group){
 if(!Object.hasOwn(directory,group))return;
 if(rendered)saveCurrent();
 current=group;
 const compact=$('quickCategorySelect');
 if(compact&&compact.value!==group)compact.value=group;
 if(!container)return;
 const info=directory[group];
 container.replaceChildren();
 const title=document.createElement('legend');
 title.textContent='O que você precisa em '+info.label+'?';
 container.appendChild(title);
 const note=document.createElement('p');
 note.className='quick-help';
 note.textContent=info.options.length?'Marque os serviços. Você pode mudar de categoria sem perder o que já escolheu.':'Esse serviço depende de avaliação técnica. Descreva abaixo o que precisa.';
 container.appendChild(note);
 const checked=saved.get(group)||new Set();
 for(const [id,label] of info.options){
  const wrap=document.createElement('label');wrap.className='quick-subitem';
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.name='quickItem';checkbox.value=id;
  checkbox.checked=checked.has(id);
  const caption=document.createElement('span');caption.textContent=label;
  wrap.append(checkbox,caption);container.appendChild(wrap);
 }
 const detail=document.createElement('label');detail.className='quick-details-label';
 detail.textContent=info.options.length?'Mais detalhes (opcional)':'Descreva o serviço para avaliação';
 const input=document.createElement('textarea');input.id='quickDetails';input.maxLength=500;input.rows=2;
 input.value=notes.get(group)||'';
 input.placeholder=info.options.length?'Ex.: reforma do banheiro, área de 20 m²...':'Ex.: quero instalar um sistema de energia solar no meu imóvel...';
 detail.appendChild(input);container.appendChild(detail);
 const alert=document.createElement('p');alert.id='quickWarning';alert.className='quick-warning';alert.setAttribute('role','alert');alert.hidden=true;
 container.appendChild(alert);
 const qty=$('quickQuantity');
 if(qty)qty.value=String(quantities.get(group)||1);
 rendered=true;
 drawSummary();
}
function collect(){
 saveCurrent();
 const {selections,notes:description,categorySet}=buildSelection();
 const anySelected=Array.from(saved.values()).some(ids=>ids.size>0);
 const anyDetailed=Array.from(notes.values()).some(note=>note.length>=8);
 if(!anySelected&&!anyDetailed){
  const warning=$('quickWarning');
  if(warning){warning.hidden=false;warning.textContent='Marque serviços em uma ou mais categorias ou descreva sua necessidade (mínimo de 8 caracteres).';}
  $('quickDetails')?.focus();
  return null;
 }
 const info=directory[current];
 const category=categorySet.size===1?Array.from(categorySet)[0]:'outros';
 const quantity=safeQuantity($('quickQuantity')?.value||1);
 const mode=document.querySelector('input[name="quickScope"]:checked')?.value==='mao_obra'?'mao_obra':'completo';
 return {
  category,group:current,label:categorySet.size>1?'Serviços de várias categorias':info.label,
  items:selections.map(s=>s.id),selections,
  details:description,quantity,mode
 };
}
for(const button of document.querySelectorAll('[data-quick-category]')){
 button.addEventListener('click',()=>render(button.dataset.quickCategory));
}
$('quickCategorySelect')?.addEventListener('change',event=>{
 const group=event.target.value;
 if(!Object.hasOwn(directory,group))return;
 const button=document.querySelector('[data-quick-category="'+group+'"]');
 if(button)button.click();
 else render(group);
});
container?.addEventListener?.('change',()=>{saveCurrent();drawSummary();});
container?.addEventListener?.('input',()=>{saveCurrent();drawSummary();});
$('quickQuantity')?.addEventListener?.('input',()=>{saveCurrent();drawSummary();});
render(current);
window.CIVOLTEN_QUICK_SELECTION={collect,render,directory};
})();