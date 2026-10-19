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
if(toggle){
  // A função antiga alternava o cliente e a empresa na mesma tela.
  // Agora cada área tem o seu endereço e seu próprio histórico.
  if(screen==='empresa' && $('admin')?.classList.contains('hidden')){
    toggle.click();
  }
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
 if(['eletrica','pintura','construcao','reforma'].includes(category))
   link.href='/orcamento?servico='+encodeURIComponent(category);
}
const quick=$('quickContinue');
if(quick&&screen==='inicio'){
  quick.addEventListener('click',event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const category=document.querySelector('[data-quick-category].active')?.dataset.quickCategory||'eletrica';
    const num=Number($('quickQuantity')?.value||1);
    const qty=Number.isFinite(num)&&num>=1&&num<=100000?num:1;
    const mode=document.querySelector('input[name="quickScope"]:checked')?.value==='mao_obra'?'mao_obra':'completo';
    const params=new URLSearchParams({servico:category,quantidade:String(qty),modo:mode});
    window.location.assign('/orcamento?'+params.toString());
  },true);
}
if(screen==='orcamento'){
  const params=new URLSearchParams(window.location.search);
  const category=params.get('servico');
  if(['eletrica','pintura','construcao','reforma'].includes(category)){
    const button=document.querySelector('[data-quick-category="'+category+'"]');
    button?.click();
    const quantity=Number(params.get('quantidade'));
    if(Number.isFinite(quantity)&&quantity>=1&&quantity<=100000&&$('quickQuantity'))$('quickQuantity').value=String(quantity);
    if(params.get('modo')==='mao_obra'){
      const radio=document.querySelector('input[name="quickScope"][value="mao_obra"]');
      if(radio)radio.checked=true;
    }
    quick?.click();
  }
}
})();
