// Assistente visual de contratos: não muda cláusulas, valores ou ciclo de vida.
export const CONTRACT_STEPS=[
 {id:'contract-step-parties',label:'Participantes'},
 {id:'contract-step-work',label:'Serviço e prazo'},
 {id:'contract-step-payment',label:'Pagamento'},
 {id:'contract-step-terms',label:'Cláusulas'}
];
export function clampContractStep(value){
 const n=Number(value);
 return Number.isInteger(n)?Math.max(0,Math.min(n,CONTRACT_STEPS.length-1)):0;
}
export function contractStepIndex(id){
 return CONTRACT_STEPS.findIndex(step=>step.id===id);
}
export function mountContractWizard(root,{step=0,onStep=()=>{}}={}){
 const area=root?.querySelector('.contract-editor');
 if(!area)return null;
 const cards=CONTRACT_STEPS.map(x=>area.querySelector('#'+x.id));
 if(cards.some(x=>!x))return null;
 const nav=[...root.querySelectorAll('.contract-jump-nav a')];
 const doc=root.ownerDocument;
 let active=clampContractStep(step);
 const button=(label,index,kind)=>{
  const element=doc.createElement('button');
  element.type='button';element.className=kind;
  element.dataset.contractGo=String(index);element.textContent=label;
  return element;
 };
 cards.forEach((card,index)=>{
  const actions=doc.createElement('div');
  actions.className='contract-step-actions';
  const counter=doc.createElement('span');
  counter.className='contract-step-count';
  counter.textContent='Etapa '+(index+1)+' de '+CONTRACT_STEPS.length;
  actions.append(counter);
  if(index>0)actions.append(button('← Voltar',index-1,'subtle'));
  if(index<CONTRACT_STEPS.length-1)
   actions.append(button('Continuar: '+CONTRACT_STEPS[index+1].label+' →',index+1,'primary'));
  else{
   const finish=doc.createElement('button');
   finish.type='button';finish.className='primary';
   finish.dataset.contractSummary='';
   finish.textContent='Ver resumo e salvar →';
   actions.append(finish);
  }
  card.append(actions);
 });
 function show(index,{focus=false}={}){
  active=clampContractStep(index);
  cards.forEach((card,i)=>card.hidden=i!==active);
  nav.forEach(anchor=>{
   const selected=contractStepIndex(String(anchor.getAttribute('href')||'').slice(1))===active;
   if(selected)anchor.setAttribute('aria-current','step');
   else anchor.removeAttribute('aria-current');
  });
  onStep(active);
  if(focus){
   const title=cards[active].querySelector('h2')||cards[active];
   title.scrollIntoView?.({block:'start',behavior:'smooth'});
   title.setAttribute('tabindex','-1');
   title.focus?.({preventScroll:true});
  }
 }
 function focusFirstError(){
  const field=area.querySelector('.cv-field-error,.cv-validation-group-error');
  if(!field)return false;
  const section=field.closest('.contract-editor-card');
  const stepIndex=contractStepIndex(section?.id);
  if(stepIndex>=0)show(stepIndex);
  // Cláusulas opcionais recolhidas continuam acessíveis quando possuem erro.
  for(let details=field.closest('details');details;details=details.parentElement?.closest?.('details')){
   details.open=true;
  }
  field.scrollIntoView?.({block:'center',behavior:'smooth'});
  if(typeof field.focus==='function')field.focus({preventScroll:true});
  return true;
 }
 root.addEventListener('click',event=>{
  const target=event.target.closest?.('.contract-jump-nav a,[data-contract-go],[data-contract-summary]');
  if(!target||!root.contains(target))return;
  if(target.matches('[data-contract-summary]')){
   event.preventDefault();
   area.querySelector('.contract-summary')?.scrollIntoView?.({block:'start',behavior:'smooth'});
   return;
  }
  const destination=target.matches('[data-contract-go]')?Number(target.dataset.contractGo):
   contractStepIndex(String(target.getAttribute('href')||'').slice(1));
  if(!Number.isInteger(destination)||destination<0)return;
  event.preventDefault();
  show(destination,{focus:true});
 });
 show(active);
 return {show,focusFirstError,getStep:()=>active};
}
