/* CIVOLTEN — Conector de catálogo público SIURB, data-base julho/2026.
 * Importa custos UNITÁRIOS como referência, sem BDI e sem presumir
 * separação entre material/mão de obra nas composições.
 */
'use strict';
const SIURB_SOURCE = 'https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179';
const SIURB_BASE = '07/2026';
const SIURB_LINKS = {
  onerada: {edif: 'https://prefeitura.sp.gov.br/documents/d/obras/onerada-sem-des-custos-unit-edif-julho-2026-2-xls', infra: 'https://prefeitura.sp.gov.br/documents/d/obras/onerada-sem-des-custos-unit-infra-julho-2026-2-xls'},
  desonerada: {edif: 'https://prefeitura.sp.gov.br/documents/d/obras/desonerada-com-des-custos-unit-edif-julho-2026-2-xls', infra: 'https://prefeitura.sp.gov.br/documents/d/obras/desonerada-com-des-custos-unid-infra-julho-2026-2-xls'}
};
if(!Array.isArray(db.siurbItems)) db.siurbItems=[];
if(!db.siurbMeta || typeof db.siurbMeta!=='object') db.siurbMeta={base:SIURB_BASE, regime:'onerada'};
let siurbSearch='', siurbFilter='eletrica', siurbBusy=false, siurbMsg='', siurbAutoRequested=false;
const siurbNormalize = text => String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const siurbElectric = /eletric|eletrodut|conduit|cabo|condutor|fio |tomada|interrupt|disjunt|quadros? de distribu|aterrament|ilumin|luminari|lampad|fotocelul|spda|pararraio|para.raio|quadro de comando|transformador|eletrocalha|canalet|infraestrutura eletr|rede eletr|instalac[aã]o eletr|borne|contator|protetor contra surt|dps\b|barramento|ponto de luz|ponto de tomada|fusivel|poste de energia/;
const siurbCivil = /alvenaria|argamassa|concreto|impermeab|pintura|reboco|revestimento|ceramica|piso|parede|telha|cobertura|forro|laje|fundac|escavac|demolic|chapisco|massa corrida|emassamento|gesso|cimento|porta|janela|esquadria|instalac[aã]o hidraul|tubulac|drenag|cal[cç]ada|limpeza|solda|estrutura metal|tijolo|bloco|pedreiro|terraplen|regulariza[cç]/;
const siurbMoney = v => {
  if(typeof v==='number')return Number.isFinite(v)?v:NaN;
  const txt=String(v??'').replace(/R\$|\s/g,'').trim();
  if(!/^-?\d[\d.,]*$/.test(txt))return NaN;
  let t=txt;
  if(t.includes(',')&&t.includes('.')) t=t.replace(/\./g,'').replace(',','.');
  else if(t.includes(',')) t=t.replace(',','.');
  return Number(t);
};
const siurbUnits = new Set(['UN','UND','UNI','U','M','ML','M2','M3','M²','M³','KG','G','T','TON','L','LT','LITRO','H','HR','HORA','DIA','DIÁRIA','DIARIA','MÊS','MES','MÊSES','MES','CJ','CONJ','PÇ','PC','PTO','PONTO','GL','VB','JOGO','PAR','CEM','MIL','KM','M3XKM','M2XM','M2/MÊS']);
function siurbCode(v){const t=String(v??'').trim().replace(/\s+/g,'').replace(/[–—]/g,'-');return /^\d{2}[-./]\d{2,3}[-./]\d{2,3}$/.test(t)?t.replace(/[./]/g,'-'):null}
function siurbUnit(v){let t=String(v??'').trim().toUpperCase().replace(/\./g,'');if(siurbUnits.has(t))return t;return /^M[²³]$/.test(t)?t:''}
function parseSIURBRows(rows, group){
  const out=[];let priorCode='';
  for(const row of rows){
    const cells=(Array.isArray(row)?row:[]).map(v=>String(v??'').trim());
    if(!cells.some(Boolean))continue;
    const idx=cells.findIndex(v=>siurbCode(v));
    if(idx<0)continue;
    const code=siurbCode(cells[idx]);if(!code||code===priorCode)continue;
    const rest=cells.slice(idx+1);
    let unitAt=rest.findIndex(v=>siurbUnit(v));
    let unit=unitAt>=0?siurbUnit(rest[unitAt]):'';
    if(!unit)continue;
    const candidates=rest.slice(unitAt+1).map(siurbMoney).filter(v=>Number.isFinite(v)&&v>0&&v<100000000);
    if(!candidates.length)continue;
    let description=rest.slice(0,unitAt).filter(v=>v&&v.length>=5&&v.length<500&&v.toUpperCase()!==code).sort((a,b)=>b.length-a.length)[0]||'';
    if(!description)description=cells.slice(0,idx).filter(v=>v.length>10).sort((a,b)=>b.length-a.length)[0]||'';
    if(!description||description.length<8)continue;
    out.push({id:group+':'+code, code, name:description.replace(/\s+/g,' ').slice(0,230), unit:unit.replace('M²','M2').replace('M³','M3'), cost:Number(candidates[0].toFixed(2)), group});
    priorCode=code;
  }
  return out;
}
async function siurbXLSX(){
  if(window.XLSX)return window.XLSX;
  for(const url of ['https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){
    try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=true;script.src=url;script.onload=()=>window.XLSX?resolve():reject(new Error('Parser não carregado'));script.onerror=()=>reject(new Error('Rede indisponível'));document.head.append(script);});if(window.XLSX)return window.XLSX;}catch(e){console.warn('SIURB parser:',e.message)}
  }
  throw new Error('Não foi possível carregar o leitor Excel. Conecte-se à internet para importar a planilha.');
}
async function siurbParseExcel(buffer,group){
  const XLSX=await siurbXLSX();
  const wb=XLSX.read(new Uint8Array(buffer),{type:'array',cellDates:false});
  let rows=[];
  for(const name of wb.SheetNames){const sh=wb.Sheets[name];const data=XLSX.utils.sheet_to_json(sh,{header:1,defval:'',raw:true,blankrows:false});rows=rows.concat(parseSIURBRows(data,group));}
  const result=[...new Map(rows.map(r=>[r.id,r])).values()];
  if(result.length<10)throw new Error('Não consegui reconhecer os serviços da planilha. Use o arquivo "Custos Unitários" de Edificações ou Infraestrutura (07/2026).');
  return result;
}
function siurbList(){
 const all=db.siurbItems||[];
 const needle=siurbNormalize(siurbSearch.trim());
 const filtered=all.filter(it=>{
   const t=siurbNormalize(it.name);
   if(siurbFilter==='eletrica'&&!siurbElectric.test(t))return false;
   if(siurbFilter==='civil'&&!siurbCivil.test(t))return false;
   return !needle||siurbNormalize(it.name+' '+it.code+' '+it.group).includes(needle);
 });
 return `<div class="siurb-summary">${filtered.length.toLocaleString('pt-BR')} serviços encontrados (de ${all.length.toLocaleString('pt-BR')} importados)</div>`+
 (filtered.slice(0,55).map(it=>{
    const saved=db.services.some(s=>s.origin==='SIURB'&&s.sourceCode===it.code&&s.sourceGroup===it.group);
    return `<div class="siurb-row"><div class="siurb-row-top"><span class="siurb-code">${esc(it.group)} · ${esc(it.code)}</span><b>${cash(it.cost)} <small>/ ${esc(it.unit)}</small></b></div><div class="siurb-name">${esc(it.name)}</div><div class="siurb-row-bottom"><small>Data-base ${SIURB_BASE} · custo sem BDI</small><button class="btn ${saved?'btn-light':'btn-outline'} small-btn" data-action="siurb-add" data-siurb-id="${esc(it.id)}" ${saved?'disabled':''}>${saved?'Adicionado':'+ Meu catálogo'}</button></div></div>`;
 }).join('')||'<div class="empty">Nenhum resultado. Importe a planilha oficial ou mude os filtros.</div>')+(filtered.length>55?'<p class="small-desc">Mostrando 55 resultados. Digite mais palavras ou o código para localizar outros serviços.</p>':'');
}
function siurbPanel(){
  const n=db.siurbItems?.length||0;
  return `<div class="siurb-box"><div class="siurb-heading"><span class="siurb-logo">SP</span><div><h2>Serviços SIURB • São Paulo</h2><p>Referência oficial: julho de 2026</p></div></div><p class="small-desc">Importe as tabelas de <b>Custos Unitários</b> da Prefeitura. Códigos, unidades e custos serão preservados. <b>Custos unitários não incluem BDI</b>; confira a composição antes de cobrar só mão de obra.</p>
  <div class="siurb-split"><label class="label">Regime da tabela<select class="input" id="siurb-regime"><option value="onerada" ${db.siurbMeta?.regime!=='desonerada'?'selected':''}>Onerada (sem desoneração)</option><option value="desonerada" ${db.siurbMeta?.regime==='desonerada'?'selected':''}>Desonerada (com desoneração)</option></select></label></div>
  <button class="btn btn-gold block" data-action="siurb-fetch" ${siurbBusy?'disabled':''}>${I('download')} ${siurbBusy?'Baixando tabelas...':'Carregar tabela oficial (EDIF + INFRA)'}</button>
  <label class="siurb-file btn btn-outline block" for="siurb-file">${I('upload')} Importar XLS / XLSX / CSV baixado<input type="file" id="siurb-file" accept=".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel" hidden></label>
  <div class="siurb-sources"><a href="${SIURB_SOURCE}" target="_blank" rel="noopener">Página oficial da SIURB ↗</a><span>Atual: ${n.toLocaleString('pt-BR')} itens</span></div>
  ${siurbBusy?'<p class="siurb-message">Carregando os arquivos da Prefeitura...</p>':siurbMsg?`<p class="siurb-message">${esc(siurbMsg)}</p>`:''}
  <div class="siurb-filters"><button class="siurb-pill ${siurbFilter==='eletrica'?'active':''}" data-action="siurb-filter" data-value="eletrica">⚡ Elétrica</button><button class="siurb-pill ${siurbFilter==='civil'?'active':''}" data-action="siurb-filter" data-value="civil">Construção civil</button><button class="siurb-pill ${siurbFilter==='todos'?'active':''}" data-action="siurb-filter" data-value="todos">Todos</button></div>
  <div class="searchbar"><span>⌕</span><input id="siurb-search" placeholder="Buscar código ou descrição..." value="${esc(siurbSearch)}"></div>
  <div id="siurb-results">${siurbList()}</div>
  <p class="siurb-fine">Base consultada: SIURB Julho/2026. Referência de custo composto, não preço de venda. Não inclui automaticamente sua margem, taxas ou tributos.</p></div>`;
}
function siurbInstallPanel(){if(!siurbAutoRequested&&!(db.siurbItems||[]).length&&location.protocol!=='file:'){siurbAutoRequested=true;setTimeout(()=>{if(s.page==='services'&&!(db.siurbItems||[]).length)siurbImportOnline()},60)}const original=catalogPage('Serviços','Sua biblioteca de serviços e custos','addservice','Novo serviço',db.services,'tool',v=>v.origin==='SIURB'?`SIURB ${esc(v.sourceGroup)} ${esc(v.sourceCode)} · ${cash(v.referenceCost)} / ${esc(v.unit)} (custo global)`:`Mão de obra: ${cash(v.labor)} · Materiais: ${cash(v.material)} / ${esc(v.unit)}`);return original.replace('<main class="sheet full">','<main class="sheet full">'+siurbPanel()+`<div class="siurb-my-services"><h2>Meus serviços (${db.services.length})</h2><p class="small-desc">Os serviços adicionados da SIURB ficam aqui e podem ser editados antes de entrar em um orçamento.</p></div>`);}
ROUTES.services=siurbInstallPanel;
function siurbUpdateList(){const p=document.getElementById('siurb-results');if(p)p.innerHTML=siurbList()}
function siurbSaveItems(items,regime,source){
 const old=db.siurbItems,oldMeta=db.siurbMeta;
 db.siurbItems=items;db.siurbMeta={base:SIURB_BASE,regime,importedAt:new Date().toISOString(),source};
 if(!save()){db.siurbItems=old;db.siurbMeta=oldMeta;throw new Error('Não coube no armazenamento local. Faça backup e libere espaço antes de importar.');}
 siurbSearch='';siurbMsg=`Importação concluída: ${items.length.toLocaleString('pt-BR')} serviços. Preços de referência, não preços de venda.`;render();
}
async function siurbImportOnline(){
 if(siurbBusy)return;const regime=document.getElementById('siurb-regime')?.value||'onerada';siurbBusy=true;siurbMsg='';render();
 try{let data=[];for(const group of ['edif','infra']){
   const response=await fetch('/api/siurb?grupo='+group+'&regime='+regime,{cache:'no-store'});
   if(!response.ok){const msg=await response.json().catch(()=>({}));throw new Error(msg.erro||'Não foi possível obter '+group.toUpperCase()+' da Prefeitura');}
   const buffer=await response.arrayBuffer();
   data.push(...await siurbParseExcel(buffer,group.toUpperCase()));
 }
 siurbSaveItems([...new Map(data.map(v=>[v.id,v])).values()],regime,'Download oficial via Prefeitura');
 }catch(e){siurbMsg='Importação online indisponível: '+e.message+' Use o botão de importação manual com o XLS oficial.';console.error(e);}
 finally{siurbBusy=false;render()}
}
async function siurbImportFile(file){
 if(!file)return;if(siurbBusy)return;const regime=document.getElementById('siurb-regime')?.value||db.siurbMeta?.regime||'onerada';siurbBusy=true;siurbMsg='Lendo '+file.name+' ...';render();
 try{
    const buffer=await file.arrayBuffer();
    const group=/infra/i.test(file.name)?'INFRA':'EDIF';
    const items=await siurbParseExcel(buffer,group);
    const current=(db.siurbItems||[]).filter(x=>x.group!==group);
    siurbSaveItems([...current,...items],regime,'Importação manual: '+file.name);
 }catch(e){siurbMsg='Falha na importação: '+e.message;console.error(e)}finally{siurbBusy=false;render()}
}
document.addEventListener('click', e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action;
 if(action==='siurb-fetch'){e.preventDefault();siurbImportOnline()}
 if(action==='siurb-filter'){e.preventDefault();siurbFilter=btn.dataset.value;render()}
 if(action==='siurb-add'){
   e.preventDefault();const it=db.siurbItems.find(x=>x.id===btn.dataset.siurbId);if(!it)return;
   if(db.services.some(x=>x.origin==='SIURB'&&x.sourceCode===it.code&&x.sourceGroup===it.group)){toast('Este serviço já está no seu catálogo.');return}
   db.services.push({id:uid('sv'),name:it.name,unit:it.unit,labor:0,material:0,referenceCost:it.cost,origin:'SIURB',sourceCode:it.code,sourceGroup:it.group,sourceDate:SIURB_BASE,sourceRegime:db.siurbMeta.regime});
   if(!save()){db.services.pop();return}render();toast('Serviço SIURB incluído no seu catálogo.');
 }
});
document.addEventListener('input', e=>{if(e.target.id==='siurb-search'){siurbSearch=e.target.value;siurbUpdateList();}});
document.addEventListener('change',e=>{if(e.target.id==='siurb-file')siurbImportFile(e.target.files?.[0]);});
if(s.page==='services')render();

