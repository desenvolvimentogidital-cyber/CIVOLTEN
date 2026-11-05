/* CIVOLTEN — Catálogo integrado de referência SIURB + SINAPI.
 * Uma busca; adiciona a fonte com MENOR custo público apenas quando escopo,
 * unidade e regime são estritamente equivalentes (descrição normalizada igual).
 * Custo público NUNCA vira custo real da empresa nem preço de venda automático.
 */
(function(){
'use strict';
let query='',message='',totalHits=0;
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const unit=value=>{
 const raw=String(value??'').toUpperCase().replace(/M²/g,'M2').replace(/M³/g,'M3').replace(/M\^2/g,'M2').replace(/M\^3/g,'M3');
 let u=normalize(raw).replace(/ /g,'');
 return ({'UND':'UN','UNIDADE':'UN','UNID':'UN','UNI':'UN','HORA':'H','HR':'H','TON':'T'}[u]||u);
};
const amount=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:null;};
const currency=value=>amount(value)==null?'Preço não informado':cash(value);
function readReferences(){
 const regimeSiurb=db.siurbMeta?.regime||'';
 const siurb=(db.siurbItems||[]).map(v=>({
  id:String(v.id),code:String(v.code||''),name:String(v.name||''),unit:unit(v.unit),value:amount(v.cost),
  origin:'SIURB',regime:regimeSiurb,uf:'SP',date:db.siurbMeta?.base||'07/2026',
  original:v
 }));
 const sinapi=(window.CIVOLTENSINAPI?.getRecords?.()||[])
  .filter(v=>v.kind==='composicao'||v.kind==='composicoes')
  .filter(v=>v.uf==='SP'&&v.verifiedUF)
  .map(v=>({
   id:String(v.id),code:String(v.code||''),name:String(v.name||''),unit:unit(v.unit),value:amount(v.cost),
   origin:'SINAPI',regime:v.regime||'',uf:v.uf||'',date:v.base||'',original:v
  }));
 return {siurb,sinapi};
}
function comparable(a,b){
 // No automatic matching by code: the two publishers have DIFFERENT code systems.
 // Exact normalized descriptions are intentionally strict; approximate services
 // need professional review before their values can be compared.
 return a.origin!==b.origin&&a.uf===b.uf&&a.uf==='SP'&&a.regime&&a.regime===b.regime&&
  a.unit&&a.unit===b.unit&&normalize(a.name)===normalize(b.name)&&
  amount(a.value)!=null&&amount(b.value)!=null;
}
function key(r){return normalize(r.name)+'|'+r.unit+'|'+r.regime+'|'+r.uf}
function rank(a,q){
 const n=normalize(q),name=normalize(a.name),code=normalize(a.code);
 if(code===n)return -100;
 if(name===n)return -80;
 if(name.startsWith(n))return -40;
 if(code.startsWith(n))return -30;
 if(name.includes(n))return -10;
 return 0;
}
function searchBoth(phrase){
 const q=normalize(phrase);
 if(q.length<2)return {rows:[],total:0};
 const {siurb,sinapi}=readReferences();
 const filtered=[...siurb,...sinapi].filter(r=>normalize(r.name+' '+r.code).includes(q));
 // Exact/starts-with matches rank first; keep UI bounded on mobile.
 filtered.sort((a,b)=>rank(a,q)-rank(b,q)||a.name.localeCompare(b.name,'pt-BR'));
 const grouped=new Map();
 for(const ref of filtered){
  const k=key(ref);
  if(!grouped.has(k))grouped.set(k,[]);
  grouped.get(k).push(ref);
 }
 const rows=[];
 for(const entries of grouped.values()){
  const ordered=entries.slice().sort((a,b)=>(a.value??Infinity)-(b.value??Infinity));
  const best=ordered[0];
  const sameScope=entries.filter(x=>comparable(best,x));
  const alt=sameScope.length?sameScope.sort((a,b)=>a.value-b.value)[0]:null;
  // When both sources are present and strictly comparable, choose lower cost.
  const chosen=alt&&alt.value<best.value?alt:best;
  rows.push({chosen,alternative:entries.find(x=>x.origin!==chosen.origin&&comparable(chosen,x))||null,
   refs:entries,compared:entries.some(x=>x.origin!==chosen.origin&&comparable(chosen,x))});
 }
 return {rows:rows.slice(0,30),total:rows.length};
}
function isSaved(r){return db.services.some(s=>s.origin===r.origin&&s.sourceCode===r.code&&
   (r.origin==='SINAPI'?s.sourceDate===r.date&&s.sourceRegime===r.regime:s.sourceGroup===r.original?.group));}
function renderRows(){
 const {rows,total}=searchBoth(query);totalHits=total;
 return '<div class="uc-summary">'+total.toLocaleString('pt-BR')+
   ' resultado(s) para a busca nas tabelas importadas</div>'+
 (rows.map(row=>{
  const selected=row.chosen,alt=row.alternative,comparison=row.compared;
  const saved=isSaved(selected);
  return '<article class="uc-result"><div class="uc-item-top"><strong>'+esc(selected.name)+'</strong>'+
   '<small>'+esc(selected.unit)+' · '+esc(selected.code)+'</small></div>'+
   '<div class="uc-price"><span>Referência '+esc(selected.origin)+'</span><b>'+currency(selected.value)+
   (selected.value!=null?' / '+esc(selected.unit):'')+'</b></div>'+
   (comparison?'<p class="uc-match">Menor custo de referência entre descrições e unidades idênticas</p>'+
     '<div class="uc-other">Outra fonte: '+esc(alt.origin)+' '+currency(alt.value)+
     ' / '+esc(alt.unit)+' · '+esc(alt.code)+'</div>':
     '<p class="uc-fine">Referência disponível. Sem composição equivalente confirmada na outra tabela.</p>')+
   '<div class="uc-foot"><span>'+esc(selected.date)+' · '+esc(selected.regime||'regime a conferir')+
   '</span><button class="btn btn-outline" data-action="uc-add" data-ref="'+esc(selected.id)+'"'+
   (saved?' disabled':'')+' type="button">'+(saved?'No catálogo':'Adicionar ao catálogo')+'</button></div></article>';
 }).join('')||'<div class="uc-empty">Não encontrei esse serviço nas tabelas importadas. Tente pelo código ou outra descrição.</div>')+
 (total>30?'<p class="uc-fine">Mostrando os 30 primeiros. Pesquise por código ou detalhe a descrição.</p>':'');
}
function box(){
 return '<section class="uc-panel"><h2>Catálogo único de serviços</h2>'+
 '<p class="uc-desc">Pesquise uma vez na SIURB + SINAPI. Para descrições, unidades e regimes iguais, a CIVOLTEN destaca automaticamente o menor custo público. O preço final do orçamento usa os custos reais da empresa.</p>'+
 '<div class="searchbar"><span>⌕</span><input type="search" id="uc-search" autocomplete="off" placeholder="Buscar serviço ou código nas duas tabelas" value="'+esc(query)+'"></div>'+
 '<div id="uc-results">'+(query.trim().length>=2?renderRows():'<p class="uc-empty">Digite um serviço para buscar nas duas tabelas. Exemplo: alvenaria, elétrica, concreto ou código.</p>')+'</div>'+
 '<p class="uc-fine">A comparação de preços é apenas entre descrições exatamente equivalentes, unidade e regime iguais. Diferenças de escopo, materiais ou composição exigem conferência técnica. Preço de referência não substitui custo real, impostos, margem nem é preço de venda.</p>'+
 '</section>';
}
function createFrom(r,alternatives){
 const item=r.original;
 const sourceInfo=(alternatives||[]).map(x=>({
  source:x.origin,code:x.code,date:x.date,unit:x.unit,regime:x.regime,cost:x.value
 }));
 const common={id:uid('sv'),name:r.name,unit:r.unit,labor:0,material:0,equipment:0,
  referenceCost:r.value||0,origin:r.origin,sourceCode:r.code,
  sourceDate:r.date,sourceRegime:r.regime,referenceNeedsValidation:true,
  unifiedReferences:sourceInfo,unifiedSelectedAt:new Date().toISOString(),
  costSplitConfirmed:false};
 if(r.origin==='SIURB')return {...common,sourceGroup:item.group||''};
 return {...common,sourceUF:'SP',sourceKind:item.kind,sourceFile:item.fileName,
  analytical:!!item.analytical,analyticLabor:(item.analyticLabor||[]).map(x=>({...x})),
  analyticItems:(item.analyticItems||[]).map(x=>({...x})),
  laborHoursPerUnit:item.laborHoursPerUnit||0,analyticalReviewNeeded:!!item.analytical};
}
const previousServices=ROUTES.services;
ROUTES.services=function(){
 const html=previousServices();
 return html.replace('<main class="sheet full">','<main class="sheet full">'+box());
};
document.addEventListener('input',event=>{
 if(event.target.id!=='uc-search')return;
 query=event.target.value;
 const container=document.getElementById('uc-results');
 if(container)container.innerHTML=query.trim().length>=2?renderRows():
  '<p class="uc-empty">Digite pelo menos duas letras ou um código para pesquisar.</p>';
},true);
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-action="uc-add"]');
 if(!btn)return;
 event.preventDefault();event.stopPropagation();
 const found=searchBoth(query).rows.find(x=>x.chosen.id===btn.dataset.ref);
 if(!found){toast('Referência não localizada. Pesquise novamente.');return}
 const r=found.chosen;
 if(isSaved(r)){toast('Este serviço já está no catálogo.');return}
 const service=createFrom(r,found.refs);
 db.services.push(service);
 if(!save()){db.services.pop();toast('Sem espaço para salvar. Faça backup e libere espaço.');return}
 message=r.origin+' • '+r.code;
 toast('Serviço adicionado pelo catálogo único ('+message+'). Confira a composição antes de orçar.');
 render();
},true);
const css=document.createElement('style');
css.textContent='.uc-panel{border:1px solid #d8c38f;border-radius:16px;background:#fffaf0;padding:14px;margin-bottom:14px}.uc-panel h2{font-size:17px;margin:0 0 4px}.uc-desc{font-size:12px;line-height:1.5;margin:4px 0 10px;color:#6b5b3a}.uc-result{padding:11px 0;border-bottom:1px solid #eadfc8}.uc-item-top strong{display:block;font-size:12px;line-height:1.4}.uc-item-top small{font-size:11px;color:#806b3a}.uc-price{display:flex;gap:8px;justify-content:space-between;align-items:center;font-size:12px;margin:8px 0}.uc-price b{font-size:14px;white-space:nowrap}.uc-match{font-size:11px;color:#365d3f;background:#ebf5e9;padding:7px;border-radius:7px}.uc-other,.uc-fine{font-size:10px;line-height:1.5;color:#736b5a;margin:6px 0}.uc-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}.uc-foot span{font-size:10px;color:#777}.uc-foot button{font-size:11px;min-width:110px}.uc-summary,.uc-empty{font-size:12px;color:#555;padding:10px 0}';
document.head.append(css);
window.CIVOLTENUnifiedCatalog={search:searchBoth,comparable,createFrom,getQuery:()=>query};
})();