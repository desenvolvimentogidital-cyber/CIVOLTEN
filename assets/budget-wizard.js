// Navegação guiada do orçamento. Não altera os cálculos, o rascunho nem o PDF.
export const BUDGET_STEPS=[
 {id:'budget-step-project',label:'Obra'},
 {id:'budget-step-services',label:'Serviços'},
 {id:'budget-step-team',label:'Equipe'},
 {id:'budget-step-materials',label:'Materiais'},
 {id:'budget-step-commercial',label:'Proposta'}
];

export function clampBudgetStep(value){
 const number=Number(value);
 return Number.isInteger(number)?Math.max(0,Math.min(number,BUDGET_STEPS.length-1)):0;
}
export function budgetStepIndex(id){
 return BUDGET_STEPS.findIndex(step=>step.id===id);
}

export function mountBudgetWizard(root,{step=0,onStep=()=>{}}={}){
 if(!root)return null;
 const cards=BUDGET_STEPS.map(item=>root.querySelector('#'+item.id));
 if(cards.some(card=>!card))return null;
 const nav=[...root.querySelectorAll('.budget-jump-nav a')];
 const doc=root.ownerDocument;
 let active=clampBudgetStep(step);
 const control=(label,to,style)=>{
  const button=doc.createElement('button');
  button.type='button';
  button.className=style;
  button.dataset.budgetGo=String(to);
  button.textContent=label;
  return button;
 };
 cards.forEach((card,index)=>{
  const footer=doc.createElement('div');
  footer.className='budget-step-actions';
  const counter=doc.createElement('span');
  counter.className='budget-step-count';
  counter.textContent='Etapa '+(index+1)+' de '+BUDGET_STEPS.length;
  footer.append(counter);
  if(index>0)footer.append(control('← Voltar',index-1,'subtle'));
  if(index<BUDGET_STEPS.length-1)
   footer.append(control('Continuar: '+BUDGET_STEPS[index+1].label+' →',index+1,'primary'));
  else {
   const finish=doc.createElement('button');
   finish.type='button';
   finish.className='primary';
   finish.dataset.budgetSummary='';
   finish.textContent='Ver valor e finalizar →';
   footer.append(finish);
  }
  card.append(footer);
 });
 function show(index,{focus=false}={}){
  active=clampBudgetStep(index);
  cards.forEach((card,i)=>{card.hidden=i!==active});
  nav.forEach(link=>{
   const isActive=budgetStepIndex(String(link.getAttribute('href')||'').slice(1))===active;
   if(isActive)link.setAttribute('aria-current','step');
   else link.removeAttribute('aria-current');
  });
  onStep(active);
  if(focus){
   const heading=cards[active].querySelector('h2');
   (heading||cards[active]).scrollIntoView?.({block:'start',behavior:'smooth'});
   if(heading){heading.setAttribute('tabindex','-1');heading.focus?.({preventScroll:true})}
  }
 }
 function focusFirstError(){
  const field=root.querySelector('.cv-field-error,.cv-validation-group-error');
  if(!field)return false;
  const containing=field.closest('.budget-step-card');
  if(containing){
   const index=budgetStepIndex(containing.id);
   if(index>=0)show(index);
  }
  const details=field.closest('details');
  if(details)details.open=true;
  field.scrollIntoView?.({block:'center',behavior:'smooth'});
  if(typeof field.focus==='function')field.focus({preventScroll:true});
  return true;
 }
 root.addEventListener('click',event=>{
  const jump=event.target.closest?.('.budget-jump-nav a, [data-budget-go], [data-budget-summary]');
  if(!jump||!root.contains(jump))return;
  if(jump.matches('[data-budget-summary]')){
   root.querySelector('.budget-summary-panel')?.scrollIntoView?.({block:'start',behavior:'smooth'});
   return;
  }
  const index=jump.matches('[data-budget-go]')?Number(jump.dataset.budgetGo):
   budgetStepIndex(String(jump.getAttribute('href')||'').slice(1));
  if(index<0||!Number.isInteger(index))return;
  event.preventDefault();
  show(index,{focus:true});
 });
 show(active);
 return {show,focusFirstError,getStep:()=>active};
}
