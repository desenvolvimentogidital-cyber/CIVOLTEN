/* CIVOLTEN — Transparência dos dados para automação sem números fictícios. */
(function(){
 'use strict';
 const txt=v=>esc(String(v??''));
 const positive=v=>Number.isFinite(Number(v))&&Number(v)>0;
 function report(){
  const siurb=db.siurbItems||[],sinapi=window.CIVOLTENSINAPI?.getRecords?.()||[];
  const workers=db.workers||[],services=db.services||[];
  const goodWorkers=workers.filter(w=>Number(window.CIVOLTENPayroll?.hourly?.(w))>0).length;
  const analytic=sinapi.filter(x=>x.analytical&&x.uf==='SP'&&x.verifiedUF);
  const cost=sinapi.filter(x=>x.cost!=null&&positive(x.cost));
  const missingSIURB=siurb.filter(x=>!positive(x.cost));
  const missingSINAPI=sinapi.filter(x=>!(x.cost!=null&&positive(x.cost)));
  const realServices=services.filter(x=>positive(x.labor));
  const pendingQuotes=(db.quotes||[]).filter(q=>['Enviado','Em análise','Aprovado'].includes(q.status)&&
   window.CIVOLTENFinancialAudit?.inspect?.(q)?.errors?.length);
  return {siurb:siurb.length,siurbPriced:siurb.length-missingSIURB.length,
   sinapi:sinapi.length,sinapiPriced:cost.length,analytic:analytic.length,
   workers:workers.length,goodWorkers,services:services.length,realServices:realServices.length,
   missingSIURB:missingSIURB.length,missingSINAPI:missingSINAPI.length,
   pendingQuotes:pendingQuotes.length};
 }
 function panel(){
  const a=report();
  const items=[
   ['SIURB · preços de referência',a.siurbPriced+' / '+a.siurb,
    a.siurb?'Referência pública; custo interno calculado separadamente.':'Tabela oficial ainda não carregada.'],
   ['SINAPI · preços de SP',a.sinapiPriced+' / '+a.sinapi,
    a.sinapi?'CSD/CCD pode ser carregado junto ou depois do Analítico.':'Importe ZIP/XLSX oficial para preencher os coeficientes.'],
   ['SINAPI · composições analíticas',String(a.analytic),
    'Horas-homem diretas; subcomposições podem permanecer pendentes.'],
   ['Profissionais com custo/hora',a.goodWorkers+' / '+a.workers,
    'Cadastro único da equipe alimenta automaticamente todos os novos orçamentos.'],
   ['Serviços com mão de obra interna',a.realServices+' / '+a.services,
    'Não confundir preço público com custo real da CIVOLTEN.']
  ];
  return '<section class="cv-auto-panel"><h3>Motor de automação · diagnóstico</h3>'+
   '<p>O CIVOLTEN utiliza o que foi carregado e comprovado. Não preenche valores ausentes com estimativas inventadas.</p>'+
   items.map(([label,value,info])=>'<div class="cv-auto-row"><b>'+txt(label)+'</b><strong>'+txt(value)+'</strong><small>'+txt(info)+'</small></div>').join('')+
   (a.missingSIURB||a.missingSINAPI?'<p class="cv-auto-alert">Referências sem preço: SIURB '+a.missingSIURB+
    ' · SINAPI '+a.missingSINAPI+'. Importe/atualize os arquivos oficiais. Esses valores não serão apresentados como R$ 0,00.</p>':'')+
   (a.pendingQuotes?'<p class="cv-auto-alert">'+a.pendingQuotes+
     ' proposta(s) com pendência de auditoria; consulte o radar no painel.</p>':'')+
   '</section>';
 }
 const base=ROUTES.services;
 ROUTES.services=function(){
  const html=base(),tag='<main class="sheet full">';
  return html.includes(tag)?html.replace(tag,tag+panel()):html;
 };
 const css=document.createElement('style');
 css.textContent='.cv-auto-panel{background:#fdfbf7;border:1px solid #dec28a;border-radius:14px;padding:14px;margin:0 0 18px;display:grid;gap:10px}.cv-auto-panel h3{font-size:16px;margin:0;color:#242322}.cv-auto-panel p{font-size:11px;line-height:1.5;margin:0;color:#78664b}.cv-auto-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;padding:7px 0;border-bottom:1px solid #e9e2d3}.cv-auto-row b{font-size:11px}.cv-auto-row strong{font-size:12px;color:#9b6309;white-space:nowrap}.cv-auto-row small{grid-column:1/-1;color:#7b766b;font-size:10px}.cv-auto-panel .cv-auto-alert{padding:10px;background:#fff0da;color:#7c3c15;border-radius:8px}@media print{.cv-auto-panel{display:none!important}}';
 document.head.append(css);
 window.CIVOLTENAutomationCoverage={report};
})();
