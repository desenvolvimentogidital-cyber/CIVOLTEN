/* CUB-SP set/2026 — R1 residencial unifamiliar, NBR 12721.
 * Valores divulgados na tabela SindusCon-SP de 09/2026 (reproduzida no Portal do RI).
 * CUB é custo básico, NÃO é o preço de uma casa pronta nem preço comercial CIVOLTEN.
 */
(function(){
 'use strict';
 if(!['/orcamento','/orcamento.html'].includes(window.location.pathname))return;
 const $=id=>document.getElementById(id);
 const area=$('projectBuildArea'),type=$('cubPattern'),regime=$('cubRegime');
 const output=$('cubResult');
 if(!area||!type||!regime||!output)return;
 const CUB={
  R1B:{sem_desoneracao:2193.39,com_desoneracao:2125.84},
  R1N:{sem_desoneracao:2690.33,com_desoneracao:2595.06},
  R1A:{sem_desoneracao:3255.86,com_desoneracao:3152.47}
 };
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
 function render(){
  const text=String(area.value||'').trim();
  const square=Number(text);
  if(!text||!Number.isFinite(square)||square<1||square>100000){
   output.textContent='Informe a área construída acima para consultar o custo básico por m².';
   return;
  }
  const price=CUB[type.value]?.[regime.value];
  if(!(price>0)){output.textContent='Padrão CUB não disponível.';return;}
  const total=Math.round(square*price*100)/100;
  output.replaceChildren();
  const strong=document.createElement('strong');
  strong.textContent=money(total)+' (CUB básico)';
  const description=document.createElement('span');
  description.textContent=square.toLocaleString('pt-BR')+' m² × '+money(price)+'/m² · SP · 09/2026. NÃO é valor final da obra.';
  output.append(strong,description);
 }
 for(const e of [area,type,regime])e.addEventListener('input',render);
 for(const e of [type,regime])e.addEventListener('change',render);
 render();
})();
