// Validação visual compartilhada: não altera os templates de impressão.
let nextErrorId=0;
const isField=el=>el?.matches?.('input,textarea,select');
const relevant=el=>isField(el)&&!el.disabled&&!['hidden','button','submit','reset','checkbox','radio','range','file'].includes(el.type||'');
function parentFor(field){return isField(field)?field.closest('label')||field.parentElement:field}
function inline(field){
 const current=field._cvValidationMessage;
 if(current?.isConnected)return current;
 const message=document.createElement('small');
 message.className='cv-validation-message';
 message.id='cv-validation-'+(++nextErrorId);
 message.setAttribute('role','alert');
 if(isField(field))field.insertAdjacentElement('afterend',message);
 else field.appendChild(message);
 field._cvValidationMessage=message;
 return message;
}
export function clearFieldError(field){
 if(!field)return;
 field.classList.remove('cv-field-error','cv-validation-group-error');
 if(isField(field)){
  field.removeAttribute('aria-invalid');
  const original=field.dataset.cvPreviousDescribedBy;
  if(original!==undefined){if(original)field.setAttribute('aria-describedby',original);else field.removeAttribute('aria-describedby');delete field.dataset.cvPreviousDescribedBy}
 }
 if(field._cvValidationMessage){field._cvValidationMessage.remove();field._cvValidationMessage=null}
 const parent=parentFor(field);if(parent?.classList)parent.classList.remove('cv-error-container');
}
export function markFieldError(field,message){
 if(!field)return;
 field.classList.add(isField(field)?'cv-field-error':'cv-validation-group-error');
 const node=inline(field);node.textContent=message;
 const parent=parentFor(field);if(parent?.classList)parent.classList.add('cv-error-container');
 if(isField(field)){
  if(field.dataset.cvPreviousDescribedBy===undefined)field.dataset.cvPreviousDescribedBy=field.getAttribute('aria-describedby')||'';
  const original=field.dataset.cvPreviousDescribedBy;
  field.setAttribute('aria-invalid','true');
  field.setAttribute('aria-describedby',(original?original+' ':'')+node.id);
 }
}
export function nativeFieldIssue(field,{checkRequired=true}={}){
 if(!relevant(field))return null;
 const value=String(field.value??'');
 if(!value.trim()){
  if(checkRequired&&field.required)return 'Este campo é obrigatório.';
  return null;
 }
 const validity=field.validity;
 if(!validity||validity.valid)return null;
 if(validity.typeMismatch)return field.type==='email'?'Informe um e-mail válido.':'Informe um valor no formato correto.';
 if(validity.badInput)return 'Digite um número válido.';
 if(validity.rangeUnderflow)return 'O valor está abaixo do mínimo permitido.';
 if(validity.rangeOverflow)return 'O valor está acima do máximo permitido.';
 if(validity.stepMismatch)return 'Use um valor compatível com o intervalo permitido.';
 if(validity.tooShort)return 'Informe mais caracteres.';
 if(validity.tooLong)return 'Texto acima do limite permitido.';
 if(validity.patternMismatch)return 'Confira o formato deste campo.';
 if(validity.valueMissing&&checkRequired)return 'Este campo é obrigatório.';
 return 'Confira o valor informado.';
}
function fields(root){return [...(root?.querySelectorAll?.('input,textarea,select')||[])].filter(relevant)}
function actionRoot(root){return root||document.querySelector('#content')||document}
function showSummary(root,count){
 const area=actionRoot(root);
 let summary=area.querySelector?.('.cv-validation-summary');
 if(!summary){
  summary=document.createElement('div');summary.className='cv-validation-summary';
  summary.setAttribute('role','alert');summary.setAttribute('aria-live','assertive');
  area.prepend(summary);
 }
 summary.textContent='Revise '+count+' campo(s) destacado(s) em vermelho antes de continuar.';
}
export function clearValidationSummary(root){
 root?.querySelector?.('.cv-validation-summary')?.remove();
}
export function validateArea(root,{issues=[],checkRequired=true,focus=true}={}){
 const area=actionRoot(root);
 let count=0,first=null;
 for(const field of fields(area)){
  clearFieldError(field);
  const message=nativeFieldIssue(field,{checkRequired});
  if(message){markFieldError(field,message);count++;first??=field}
 }
 for(const {selector,message} of issues){
  const field=area.querySelector?.(selector)||document.querySelector(selector);
  if(!field){count++;continue}
  if(!field.classList.contains('cv-field-error')&&!field.classList.contains('cv-validation-group-error'))count++;
  markFieldError(field,message);
  first??=field;
 }
 if(count){
  showSummary(area,count);
  if(focus&&first){
   const details=first.closest?.('details');
   if(details)details.open=true;
   first.scrollIntoView?.({block:'center',behavior:'smooth'});
   if(isField(first)&&!first.disabled)first.focus?.({preventScroll:true});
   else first.querySelector?.('button')?.focus?.({preventScroll:true});
  }
  return false;
 }
 clearValidationSummary(area);
 return true;
}
export function revalidateField(field,issues=[],{checkRequired=true,blur=false}={}){
 if(!relevant(field))return;
 if(!blur&&!field.classList.contains('cv-field-error'))return;
 const explicit=issues.find(({selector})=>field.matches(selector));
 const error=explicit?.message||nativeFieldIssue(field,{checkRequired});
 if(error)markFieldError(field,error);
 else {
  clearFieldError(field);
  const area=field.closest('form,.budget-simple-editor,.contract-editor')||document.querySelector('#content');
  if(area&&!area.querySelector('.cv-field-error,.cv-validation-group-error'))clearValidationSummary(area);
 }
}
export function attachFormValidation(){
 for(const form of document.querySelectorAll('form'))form.noValidate=true;
}
