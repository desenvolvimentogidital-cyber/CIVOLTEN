/* Experiência premium: controles visuais ligam-se ao mesmo orçamento seguro,
 * sem duplicar valores, login nem cálculos no navegador. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
// Painel premium: métricas reais, sem controle duplicado de serviços na home.
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