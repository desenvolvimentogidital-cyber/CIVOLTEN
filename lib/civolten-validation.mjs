import {validBrazilDocument} from './civolten-contract.mjs';
const text=v=>String(v??'').trim();
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const issue=(selector,message)=>({selector,message});
const asAmount=v=>v===null||v===''?null:Number(v);
const iso=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;

/** Campos obrigatórios variam com a ação. Rascunho não exige dados completos do PDF. */
export function budgetIssues(b,{forPdf=false}={}){
 const errors=[];
 if(text(b?.title).length<3)errors.push(issue('[data-draft="title"]','Informe o nome da obra (mínimo de 3 caracteres).'));
 const days=Number(b?.days);
 if(!Number.isFinite(days)||days<=0||days>10000)errors.push(issue('[data-draft="days"]','Informe um prazo de execução válido, maior que zero.'));
 const scopes=Array.isArray(b?.scope_items)?b.scope_items:[];
 scopes.forEach((item,i)=>{
  if(!text(item?.description))errors.push(issue('[data-scope-description="'+i+'"]','Descreva este serviço.'));
  if(!text(item?.unit))errors.push(issue('[data-scope-unit="'+i+'"]','Escolha a unidade do serviço.'));
  if(!finite(Number(item?.quantity))||Number(item.quantity)<=0||Number(item.quantity)>1000000)
   errors.push(issue('[data-scope-quantity="'+i+'"]','Informe uma quantidade maior que zero.'));
 });
 (Array.isArray(b?.staff)?b.staff:[]).forEach((person,i)=>{
  if(!finite(Number(person?.days))||Number(person.days)<=0)
   errors.push(issue('[data-staff-days="'+i+'"]','Informe os dias deste profissional.'));
 });
 (Array.isArray(b?.expenses)?b.expenses:[]).forEach((cost,i)=>{
  if(!finite(Number(cost?.qty))||Number(cost.qty)<0)
   errors.push(issue('[data-expense-qty="'+i+'"]','Informe uma quantidade válida.'));
 });
 const discount=Number(b?.discount_pct??0);
 if(!finite(discount)||discount<0||discount>100)errors.push(issue('[data-discount-number]','O desconto deve ficar entre 0% e 100%.'));
 const manual=asAmount(b?.manual_price_cents);
 if(manual!==null&&(!finite(manual)||manual<0))errors.push(issue('[data-draft="manual_price"]','Informe um preço manual válido.'));
 if(forPdf){
  if(text(b?.customer).length<2)errors.push(issue('[data-draft="customer"]','Informe o nome do cliente.'));
  if(text(b?.address).length<4)errors.push(issue('[data-draft="address"]','Informe o local da obra.'));
  if(!text(b?.services)&&scopes.length===0&&!text(b?.civil_services)&&!text(b?.electrical_services))errors.push(issue('[data-draft="services"]','Descreva o escopo civil, elétrico ou adicione serviços e quantidades.'));
  const validity=Number(b?.validity_days);
  if(!Number.isInteger(validity)||validity<1||validity>365)
   errors.push(issue('[data-draft="validity_days"]','Informe a validade da proposta em dias (de 1 a 365).'));
  if(text(b?.payment_terms).length<6)
   errors.push(issue('[data-draft="payment_terms"]','Informe as condições de pagamento (mínimo de 6 caracteres).'));
  for(const field of ['company_intro','civil_services','electrical_services','methodology','technical_responsible','warranty_terms']){
   const limits={company_intro:2000,civil_services:2500,electrical_services:2500,methodology:1200,technical_responsible:150,warranty_terms:1000};
   if(text(b?.[field]).length>limits[field])errors.push(issue('[data-draft="'+field+'"]','Texto acima do tamanho permitido.'));
  }
 }
 return errors;
}
export function contractIssues(c,{forExport=false}={}){
 const errors=[];
 if(text(c?.title).length<3)errors.push(issue('[data-contract="title"]','Informe o título (mínimo de 3 caracteres).'));
 if(c?.revision_of&&text(c.revision_reason).length<5)errors.push(issue('[data-contract="revision_reason"]','Justifique a revisão com pelo menos 5 caracteres.'));
 if(!forExport){
  if(text(c?.counterparty_document)&&!validBrazilDocument(c?.counterparty_document))
   errors.push(issue('[data-contract="counterparty_document"]','Informe um CPF ou CNPJ válido.'));
  return errors;
 }
 if(text(c?.counterparty_name).length<2)errors.push(issue('[data-contract="counterparty_name"]','Informe o nome ou razão social da outra parte.'));
 if(!validBrazilDocument(c?.counterparty_document))errors.push(issue('[data-contract="counterparty_document"]','Informe um CPF ou CNPJ válido.'));
 if(c?.contract_template_version==='2'){
  const doc=v=>String(v??'').toUpperCase().replace(/[.\/\-\s]/g,'');
  if(doc(c?.company?.company_document)&&doc(c?.company?.company_document)===doc(c?.counterparty_document))
   errors.push(issue('[data-contract="counterparty_document"]','Os documentos das duas partes são iguais. Confira a identificação antes de emitir.'));
  if(text(c?.counterparty_address).length<6)
   errors.push(issue('[data-contract="counterparty_address"]','Informe o endereço completo da outra parte.'));
  if(text(c?.company?.company_address).length<6)
   errors.push(issue('.contract-company-review','Complete o endereço legal da CIVOLTEN em Configurações.'));
 }

 if(text(c?.scope).length<12)errors.push(issue('[data-contract="scope"]','Descreva o escopo dos serviços com pelo menos 12 caracteres.'));
 if(!text(c?.location))errors.push(issue('[data-contract="location"]','Informe o local dos serviços.'));
 if(!iso(text(c?.start_on)))errors.push(issue('[data-contract="start_on"]','Informe uma data de início válida.'));
 if(!iso(text(c?.end_on)))errors.push(issue('[data-contract="end_on"]','Informe uma data de término válida.'));
 if(iso(text(c?.start_on))&&iso(text(c?.end_on))&&c.end_on<c.start_on)
  errors.push(issue('[data-contract="end_on"]','O término não pode ser anterior ao início.'));
 if(!Number.isSafeInteger(c?.value_cents)||c.value_cents<=0)
  errors.push(issue('[data-contract="value_reais"]','Informe um valor total maior que R$ 0,00.'));
 if(text(c?.payment_terms).length<6)errors.push(issue('[data-contract="payment_terms"]','Informe as condições de pagamento.'));
 if(text(c?.payment_schedule).length<8)errors.push(issue('[data-contract="payment_schedule"]','Detalhe os vencimentos, parcelas ou medições.'));
 if(!text(c?.company?.company_name)||!validBrazilDocument(c?.company?.company_document))
  errors.push(issue('.contract-company-review','Configure o nome legal e CPF/CNPJ válido da empresa em Configurações.'));
 return errors;
}
export function taxMarginIssues(tax,margin){
 const a=Number(tax),b=Number(margin);
 const invalid=!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0||a>99||b>99||a+b>=100;
 return invalid?[
  issue('[name="tax_pct"]','Impostos e margem devem estar entre 0% e 99%, somando menos de 100%.'),
  issue('[name="margin_pct"]','Impostos e margem devem estar entre 0% e 99%, somando menos de 100%.')
 ]:[];
}
