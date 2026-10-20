/* Navegação CIVOLTEN: telas públicas e administrativas com endereços independentes.
 * A implementação compartilha o formulário e o painel existente, sem duplicar
 * regras de autenticação, preços ou orçamentos.
 */
(function(){
'use strict';
const path=window.location.pathname.replace(/\/+$/,'')||'/';
const screen=path==='/empresa'?'empresa':path==='/orcamento'?'orcamento':'inicio';
document.body.dataset.screen=screen;
const $=id=>document.getElementById(id);
const toggle=$('toggle');
const skip=document.querySelector('.skip-link');
// A empresa é acessada diretamente, inclusive sem botão visível no celular.
if(screen==='empresa'){
 $('admin')?.classList.remove('hidden');
 $('client')?.classList.add('hidden');
 window.CIVOLTEN_ADMIN_BOOT?.();
}
if(toggle){
 toggle.onclick=()=>window.location.assign(screen==='empresa'?'/':'/empresa');
 if(screen==='empresa')toggle.textContent='← Voltar ao site';
}
if(skip){
  skip.setAttribute('href',screen==='orcamento'?'#formulario':screen==='empresa'?'#admin':'#inicio');
  skip.textContent=screen==='orcamento'?'Pular para o orçamento':screen==='empresa'?'Pular para a área da empresa':'Pular para o conteúdo';
}
const logo=document.querySelector('.premium-logo-link');
if(logo)logo.href='/';
const nav=document.querySelector('.premium-site-nav');
if(nav){
  const links=nav.querySelectorAll('a');
  if(links[0])links[0].href='/';
  if(links[1])links[1].href='/servicos';
  if(links[2])links[2].href='/#como-funciona';
  if(links[3])links[3].href='/orcamento';
  for(const link of links){
    const target=link.getAttribute('href');
    const active=(screen==='inicio'&&target==='/')||(screen==='orcamento'&&target==='/orcamento');
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}
for(const link of document.querySelectorAll('.cv-mobile-nav a')){
 const target=link.getAttribute('href');
 const active=(screen==='inicio'&&target==='/')||(screen==='orcamento'&&target==='/orcamento')||(screen==='empresa'&&target==='/empresa');
 if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
}
if(screen==='orcamento')document.title='Solicitar orçamento | CIVOLTEN';
else if(screen==='empresa')document.title='Área da empresa | CIVOLTEN';
else document.title='CIVOLTEN | Construção e elétrica';
for(const link of document.querySelectorAll('.landing-hero-actions a')){
 const text=link.textContent||'';
 link.href=text.includes('Simular')?'/orcamento#simulacao':'/orcamento';
}
for(const link of document.querySelectorAll('.landing-category-card[data-select-category]')){
 const category=link.dataset.selectCategory;
 if(['eletrica','manutencao','iluminacao','solar','construcao','reforma','pisos','pintura','hidraulica','alvenaria'].includes(category))
   link.href='/orcamento?servico='+encodeURIComponent(category);
}
const quick=$('quickContinue');
if(quick&&screen==='inicio'){
 quick.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const chosen=window.CIVOLTEN_QUICK_SELECTION?.collect?.();
  if(!chosen)return;
  const params=new URLSearchParams({
   servico:chosen.category,grupo:chosen.group,quantidade:String(chosen.quantity),
   modo:chosen.mode,subtipo:chosen.label
  });
  if(chosen.items.length)params.set('itens',chosen.items.join(','));
  if(chosen.selections?.length)params.set('selecoes',JSON.stringify(chosen.selections.slice(0,60)));
  if(chosen.details)params.set('detalhes',chosen.details.slice(0,1800));
  window.location.assign('/orcamento?'+params.toString());
 },true);
}
if(screen==='orcamento'){
 const params=new URLSearchParams(window.location.search);
 const category=params.get('servico');
 const group=params.get('grupo');
 const allowed=['eletrica','manutencao','iluminacao','construcao','reforma','pintura','hidraulica','outros'];
 if(allowed.includes(category)){
  if(group&&window.CIVOLTEN_QUICK_SELECTION?.directory?.[group]){
   const button=document.querySelector('[data-quick-category="'+group+'"]');
   button?.click();
  }
  const ids=String(params.get('itens')||'').split(',').filter(x=>/^[a-z0-9_]{2,70}$/.test(x)).slice(0,60);
  let selections=[];
  try{
   const parsed=JSON.parse(params.get('selecoes')||'[]');
   if(Array.isArray(parsed))selections=parsed.slice(0,60);
  }catch{selections=[];}
  window.CIVOLTEN_FORM?.prefillQuickSelection({
   category,items:ids,selections,details:params.get('detalhes')||'',
   quantity:params.get('quantidade'),mode:params.get('modo'),
   label:params.get('subtipo')||''
  });
 }
}
})();
