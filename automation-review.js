/* CIVOLTEN — revisão automática de proposta e alertas de obra no painel. */
(function(){
 'use strict';
 if(!window.CIVOLTENAutomationRisk)return;
 const engine=window.CIVOLTENAutomationRisk;
 const safe=s=>esc(String(s??''));
 const riskFor=q=>engine.inspect(q,{company:db.company,
   financial:window.CIVOLTENFinancialAudit?.inspect?.(q),
   operations:window.CIVOLTENOperationsCore?.summary?.(q,db.company)});
 const riskPanel=(q)=>{
  const entries=riskFor(q);if(!entries.length)return '';
  return '<section class="cv-guard-panel"><h3>Conferência automática da proposta</h3>'+
   '<p>Alertas calculados com os dados disponíveis. Eles não substituem a conferência técnica nem contábil.</p>'+
   entries.map(f=>'<div class="cv-guard-row '+(f.level==='critical'?'critical':f.level==='warning'?'warning':'info')+'">'+
   '<strong>'+(f.level==='critical'?'Atenção crítica':f.level==='warning'?'Revisar':'Pendente')+'</strong> '+safe(f.message)+'</div>').join('')+
   '</section>';
 };
 const originalDetail=ROUTES.quoteDetail;
 ROUTES.quoteDetail=function(){
  const html=originalDetail(),q=db.quotes.find(x=>x.id===s.detail);
  if(!q)return html;
  const end=html.lastIndexOf('</main>');return end<0?html:html.slice(0,end)+riskPanel(q)+html.slice(end);
 };
 function dashboard(){
  const quotes=db.quotes||[];
  const flagged=engine.overview(quotes,{
   company:db.company,
   financialFor:q=>window.CIVOLTENFinancialAudit?.inspect?.(q),
   operationsFor:q=>window.CIVOLTENOperationsCore?.summary?.(q,db.company)
  },7);
  if(!flagged.length)return '';
  const critical=flagged.filter(x=>x.findings.some(y=>y.level==='critical')).length;
  return '<section class="cv-guard-panel"><h3>Radar automático CIVOLTEN</h3>'+
   '<p>'+critical+' proposta(s) ou obra(s) com alerta crítico. Toque para conferir antes de tomar decisões.</p>'+
   flagged.map(({quote,findings})=>'<button type="button" data-action="detail" data-id="'+safe(quote.id)+'" class="cv-guard-link">'+
   '<span><b>'+safe(quote.number||quote.title||'Orçamento')+'</b><small>'+safe(quote.clientName||'Cliente não informado')+'</small></span>'+
   '<span>'+findings.filter(x=>x.level==='critical').length+' críticos · '+findings.filter(x=>x.level==='warning').length+' avisos</span></button>').join('')+'</section>';
 }
 for(const route of ['home','reports']){
  const old=ROUTES[route];
  ROUTES[route]=function(){
   const html=old(),add=dashboard(),end=html.lastIndexOf('</main>');
   return end<0?html:html.slice(0,end)+add+html.slice(end);
  };
 }
 const css=document.createElement('style');
 css.textContent='.cv-guard-panel{margin:15px 0;padding:14px;border:1px solid #e6d8b4;border-radius:14px;background:#fffdfa;color:#25292e;display:grid;gap:9px}'+
  '.cv-guard-panel h3{font-size:15px;margin:0}.cv-guard-panel p{font-size:11px;line-height:1.5;color:#61666d;margin:0}'+
  '.cv-guard-row{border-left:3px solid #d5a440;padding:9px 10px;background:#fff5df;font-size:11px;line-height:1.45}'+
  '.cv-guard-row.critical{border-color:#bc3c39;background:#ffebea;color:#8f322e}'+
  '.cv-guard-row.info{background:#f2f4f6;border-color:#b8bec6}'+
  '.cv-guard-link{width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid #e5e6e7;background:white;border-radius:9px;padding:11px;text-align:left}'+
  '.cv-guard-link span:first-child{min-width:0;flex:1}.cv-guard-link b{font-size:11px;display:block}.cv-guard-link small{font-size:9px;color:#777;display:block}'+
  '.cv-guard-link span:last-child{font-size:10px;color:#ac572e;white-space:nowrap}'+
  '@media print{.cv-guard-panel{display:none!important}}';
 document.head.append(css);
 window.CIVOLTENAutomationReview={riskFor};
})();
