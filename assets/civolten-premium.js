/* Experiência premium: controles visuais ligam-se ao mesmo orçamento seguro,
 * sem duplicar valores, login nem cálculos no navegador. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const quickButtons=Array.from(document.querySelectorAll('[data-quick-category]'));
let selectedCategory='eletrica';
const opts={
 eletrica:{catalog:'instalacao_eletrica_completa',label:'Instalações elétricas'},
 pintura:{catalog:'pintura_alvenaria',label:'Pintura e acabamento'},
 construcao:{catalog:'levantamento_bloco',label:'Alvenaria'},
 reforma:{catalog:'reforma_apartamento_completa',label:'Reforma'},
};
function chooseCategory(cat){
 if(!Object.hasOwn(opts,cat))return;
 selectedCategory=cat;
 const form=$('category');
 if(form)form.value=cat;
 for(const button of quickButtons){
  const active=button.dataset.quickCategory===cat;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 }
}
for(const button of quickButtons)
 button.addEventListener('click',()=>chooseCategory(button.dataset.quickCategory));
for(const link of document.querySelectorAll('[data-select-category]')){
 link.addEventListener('click',()=>chooseCategory(link.dataset.selectCategory));
}
$('quickContinue')?.addEventListener('click',()=>{
 chooseCategory(selectedCategory);
 const qty=Number($('quickQuantity')?.value||1);
 const mode=document.querySelector('input[name="quickScope"]:checked')?.value||'completo';
 const first=$('lines')?.querySelector('.line');
 const service=first?.querySelector('select');
 const amount=first?.querySelector('input');
 if(amount&&Number.isFinite(qty)&&qty>=1&&qty<=100000)amount.value=String(qty);
 if(service){
  const chosen=opts[selectedCategory].catalog;
  if(mode==='completo'&&Array.from(service.options).some(option=>option.value===chosen)){
   service.value=chosen;
   service.dispatchEvent(new Event('change'));
  }else if(mode==='mao_obra'){
   // A mão de obra só pode ser cotada a partir de composição SIURB com insumos.
   const status=$('catalogstatus');
   if(status)status.textContent='Para somente mão de obra, escolha abaixo uma composição EDIF/INFRA que tenha profissionais identificados.';
  }
  if(mode==='mao_obra'&&/^siurb:/.test(service.value)&&first._modeSelect){
   first._modeSelect.value='mao_obra';first._modeSelect.dispatchEvent(new Event('change'));
  }
 }
 $('formulario')?.scrollIntoView({behavior:'smooth',block:'start'});
});
const metric=(label,value,icon)=>{const card=document.createElement('div');card.className='admin-kpi';
 const symbol=document.createElement('div');symbol.className='admin-kpi-icon';symbol.textContent=icon;
 const body=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');
 name.textContent=label;number.textContent=value;body.append(name,number);card.append(symbol,body);
 return card;
};
function updateDashboard(pedidos){
 if(!Array.isArray(pedidos))return;
 const target=$('adminKpis');if(!target)return;
 const recent=pedidos.length;
 const active=pedidos.filter(p=>['draft','pending','changes_requested'].includes(p.commercial?.decision)).length;
 const sent=pedidos.filter(p=>['pending','approved','rejected','changes_requested'].includes(p.commercial?.decision)).length;
 const finalized=pedidos.filter(p=>['approved','rejected'].includes(p.commercial?.decision));
 const approved=finalized.filter(p=>p.commercial?.decision==='approved').length;
 const percent=finalized.length?Math.round(100*approved/finalized.length)+'%':'—';
 target.replaceChildren(metric('Pedidos recentes',String(recent),'▤'),
  metric('Orçamentos ativos',String(active),'▣'),
  metric('Propostas enviadas',String(sent),'➤'),
  metric('Taxa de aprovação',percent,'▥'));
}
window.CIVOLTEN_PREMIUM={updateDashboard};
})();