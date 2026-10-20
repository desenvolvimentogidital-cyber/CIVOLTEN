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
 const imported=new Map();
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
 const CUB_ENDPOINT='https://rvhnuowqfdugcecgmxnv.supabase.co/functions/v1/civolten-beta?api=cub-reference';
 async function updateRates(){
  try{
   const response=await fetch(CUB_ENDPOINT,{method:'GET',cache:'no-store',credentials:'omit'});
   if(!response.ok)throw Error('Referência CUB externa indisponível.');
   const data=await response.json();
   if(!Array.isArray(data.rates))throw Error('Resposta CUB inválida.');
   imported.clear();
   for(const item of data.rates){
    const key=item.pattern+':'+item.regime;
    const cost=Number(item.unit_cost);
    if(!imported.has(key)&&/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(item.base_month)&&
     Number.isFinite(cost)&&cost>0&&CUB[item.pattern]?.[item.regime]>0)
     imported.set(key,{cost,month:item.base_month,source:item.source_url});
   }
   render();
  }catch{
   // Sem conexão, a estimativa continua usando a referência publicada de 09/2026.
   render();
  }
 }
 function render(){
  const text=String(area.value||'').trim();
  const square=Number(text);
  if(!text||!Number.isFinite(square)||square<1||square>100000){
   output.textContent='Informe a área construída acima para consultar o custo básico por m².';
   return;
  }
  const saved=imported.get(type.value+':'+regime.value);
  const price=saved?.cost??CUB[type.value]?.[regime.value];
  if(!(price>0)){output.textContent='Padrão CUB não disponível.';return;}
  const total=Math.round(square*price*100)/100;
  output.replaceChildren();
  const strong=document.createElement('strong');
  strong.textContent=money(total)+' (CUB básico)';
  const description=document.createElement('span');
  const month=saved?.month? saved.month.slice(5)+'/'+saved.month.slice(0,4):'09/2026';
  description.textContent=square.toLocaleString('pt-BR')+' m² × '+money(price)+'/m² · SP · '+month+
   (saved?' · Referência importada no painel':' · Referência incorporada')+
   '. NÃO é valor final da obra.';
  output.append(strong,description);
 }
 for(const e of [area,type,regime])e.addEventListener('input',render);
 for(const e of [type,regime])e.addEventListener('change',render);
 render();
 if(typeof fetch==='function')updateRates();
})();
