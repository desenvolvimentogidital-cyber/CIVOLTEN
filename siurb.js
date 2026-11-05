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
const siurbMoney = value => {
 if(typeof value==='number')return Number.isFinite(value)?value:NaN;
 let t=String(value??'').replace(/\u00a0/g,' ').trim();
 if(!t||/^(?:-|—|n\/?a|r\$\s*-)$/i.test(t))return NaN;
 t=t.replace(/\bR\$\s*/ig,'').replace(/\s/g,'');
 if(!/^-?\d[\d.,]*$/.test(t))return NaN;
 const dot=t.lastIndexOf('.'),comma=t.lastIndexOf(',');
 if(comma>=0&&dot>=0)t=comma>dot?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
 else if(comma>=0)t=t.replace(',','.');
 else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
 const n=Number(t);return Number.isFinite(n)?n:NaN;
};
const siurbUnits = new Set(['UN','UND','UNI','U','UNID','UNIDADE','M','ML','M2','M3','DM3','CM','KM','KG','G','T','TON','L','LT','LITRO','H','HR','HORA','DIA','DIARIA','MES','ANO','CJ','CONJ','CONJUNTO','PÇ','PC','PTO','PONTO','GL','VB','JOGO','PAR','CEM','MIL','M3XKM','M2XM','M2/MES','M3/MES','M/MES','M2XKM','M3/KM','HM','KW','KWH','MWH','HP','JG','SC','BARRA','B','BL','LATA','ROLO','FL','VEZ']);
function siurbCode(v){
 const text=String(v??'').trim().replace(/[–—−]/g,'-');if(!text)return null;
 const punct=text.match(/(?:^|[^0-9])([0-9]{1,3}[-./\s]+[0-9]{1,3}[-./\s]+[0-9]{1,4})(?![0-9])/);
 if(punct){const parts=punct[1].split(/[-./\s]+/).filter(Boolean);if(parts.length===3)return parts.join('-')}
 const digits=text.match(/(?:^|[^0-9])([0-9]{7,10})(?![0-9])/);
 if(digits&&(text===digits[1]||/\b(?:SIURB|CÓDIGO|CODIGO|C[ÓO]D\.?)[\s:]/i.test(text)))return digits[1];
 return null;
}
function siurbUnit(v){
 let t=String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s/g,'').replace(/\.$/,'');
 t=t.replace(/M\^2/g,'M2').replace(/M\^3/g,'M3').replace(/M²/g,'M2').replace(/M³/g,'M3');
 return siurbUnits.has(t)?t:'';
}
function siurbHeader(row){
 const words=row.map(v=>siurbNormalize(v));const find=re=>words.findIndex(x=>re.test(x));
 const code=find(/^(?:cod(?:igo)?\.?|item|codigo do servico)$/),desc=find(/^(?:descricao|descricao do servico|servico|designacao)/),unit=find(/^(?:unid(?:ade)?\.?|und\.?|u\.m\.?|medida|unidade de medicao)$/),cost=find(/(?:custo|valor|preco).*?(?:r\$|unit)|^(?:custo|valor|preco)(?:\s*r\$)?$/);
 return [code,desc,unit,cost].filter(i=>i>=0).length>=2?{code,desc,unit,cost}:null;
}
function siurbGoodCost(v){const n=siurbMoney(v);return Number.isFinite(n)&&n>0&&n<1e9?n:NaN}
function siurbDataRow(row,group,head){
 const cells=(Array.isArray(row)?row:[]).map(v=>typeof v==='string'?v.trim():v);
 if(!cells.some(v=>String(v??'').trim()))return null;
 let codeIdx=head?.code>=0&&siurbCode(cells[head.code])?head.code:cells.findIndex(v=>siurbCode(v));
 if(codeIdx<0)return null;
 const code=siurbCode(cells[codeIdx]);if(!code)return null;
 const codeRaw=String(cells[codeIdx]??'').trim();
 const preUnit=head?.unit>=0&&siurbUnit(cells[head.unit])?head.unit:-1;
 const unitIdx=preUnit>=0?preUnit:cells.findIndex((v,i)=>i>codeIdx&&siurbUnit(v));
 const unit=unitIdx>=0?siurbUnit(cells[unitIdx]):'';
 let name='';
 if(head?.desc>=0&&head.desc!==codeIdx)name=String(cells[head.desc]??'').trim();
 if(!name){
  const inside=codeRaw.replace(/(?:^|[^\d])\d{1,3}[-./\s]+\d{1,3}[-./\s]+\d{1,4}(?!\d)/,' ').trim();
  const between=cells.slice(codeIdx+1,unitIdx>codeIdx?unitIdx:undefined).map(v=>String(v??'').trim()).filter(v=>v&&v.length>3&&!siurbUnit(v)&&!Number.isFinite(siurbMoney(v)));
  name=between.join(' ')||inside;
 }
 if(!name)name=String(cells.slice(0,codeIdx).find(v=>String(v??'').trim().length>5&&!siurbCode(v))??'').trim();
 name=name.replace(/\s+/g,' ').replace(/^[-–:;]+|[-–:;]+$/g,'').trim();
 let cost=NaN;
 if(head?.cost>=0&&head.cost!==unitIdx)cost=siurbGoodCost(cells[head.cost]);
 if(!Number.isFinite(cost)&&unitIdx>=0){
  const vals=cells.slice(unitIdx+1).map(siurbGoodCost).filter(Number.isFinite);
  if(vals.length)cost=vals[0];
 }
 if(!Number.isFinite(cost)){
  const exclude=new Set([codeIdx,unitIdx,head?.desc,head?.unit]);
  const vals=cells.map((v,i)=>exclude.has(i)||i<=codeIdx?NaN:siurbGoodCost(v)).filter(Number.isFinite);
  if(vals.length)cost=vals[vals.length-1];
 }
 return {code,unit,name,cost,group};
}
function parseSIURBRows(rows,group){
 const out=new Map();let head=null,pending=null;
 for(let i=0;i<rows.length;i++){
  const cells=Array.isArray(rows[i])?rows[i]:[];
  const h=siurbHeader(cells);if(h){head=h;pending=null;continue}
  const r=siurbDataRow(cells,group,head);
  if(r){
   if(pending&&pending.code!==r.code)pending=null;
   if(r.unit&&Number.isFinite(r.cost)&&r.name.length>=5){
    if(!out.has(r.code))out.set(r.code,{id:group+':'+r.code,code:r.code,name:r.name.slice(0,320),unit:r.unit,cost:Number(r.cost.toFixed(2)),group});pending=null;
   }else pending={...r,line:i};
   continue;
  }
  if(pending&&i-pending.line<=2){
   const tail=cells.map(v=>String(v??'').trim());
   if(!pending.unit){const where=tail.findIndex(v=>siurbUnit(v));if(where>=0){pending.unit=siurbUnit(tail[where]);const nums=tail.slice(where+1).map(siurbGoodCost).filter(Number.isFinite);if(nums.length)pending.cost=nums[0]}}
   if(!Number.isFinite(pending.cost)&&pending.unit){const nums=tail.map(siurbGoodCost).filter(Number.isFinite);if(nums.length)pending.cost=nums[nums.length-1]}
   if(pending.unit&&Number.isFinite(pending.cost)&&pending.name.length>=5){
    if(!out.has(pending.code))out.set(pending.code,{id:group+':'+pending.code,code:pending.code,name:pending.name.slice(0,320),unit:pending.unit,cost:Number(pending.cost.toFixed(2)),group});pending=null;
   }
  }else pending=null;
 }
 return [...out.values()];
}

async function siurbXLSX(){
  if(window.XLSX)return window.XLSX;
  for(const url of ['https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){
    try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=true;script.src=url;script.onload=()=>window.XLSX?resolve():reject(new Error('Parser não carregado'));script.onerror=()=>reject(new Error('Rede indisponível'));document.head.append(script);});if(window.XLSX)return window.XLSX;}catch(e){console.warn('SIURB parser:',e.message)}
  }
  throw new Error('Não foi possível carregar o leitor Excel. Conecte-se à internet para importar a planilha.');
}
async function siurbParseExcel(buffer,group){
 const XLSX=await siurbXLSX();let wb;
 try{wb=XLSX.read(new Uint8Array(buffer),{type:'array',cellDates:false,cellNF:true,cellText:true})}
 catch(e){throw new Error('O arquivo não pôde ser aberto como Excel. Confira se o download terminou.')}
 const all=[];let inspected=0,codesSeen=0;const sheets=[];
 for(const name of wb.SheetNames){
  const sh=wb.Sheets[name];if(!sh||!sh['!ref'])continue;
  // raw:true pode remover máscaras que formam códigos como 08-018-002.
  const formatted=XLSX.utils.sheet_to_json(sh,{header:1,defval:'',raw:false,blankrows:false});
  const raw=XLSX.utils.sheet_to_json(sh,{header:1,defval:'',raw:true,blankrows:false});
  inspected+=formatted.length;
  const f=parseSIURBRows(formatted,group),r=parseSIURBRows(raw,group);
  const selected=f.length>=r.length?f:r;
  codesSeen+=formatted.reduce((n,row)=>n+(Array.isArray(row)&&row.some(x=>siurbCode(x))?1:0),0);
  sheets.push(name+': '+selected.length);all.push(...selected);
 }
 const result=[...new Map(all.map(x=>[x.id,x])).values()];
 if(!result.length){
  const diagnostic=inspected?' ('+inspected+' linhas analisadas, '+codesSeen+' códigos encontrados; abas: '+sheets.slice(0,4).join(', ')+')':'';
  throw new Error('Nenhum serviço com código, unidade e custo válido foi localizado'+diagnostic+'. Verifique se o arquivo é “Custos Unitários” da SIURB.');
 }
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
 if(siurbBusy)return;const regime=document.getElementById('siurb-regime')?.value||'onerada';
 siurbBusy=true;siurbMsg='';render();
 try{
  const records=[],success=[],errors=[];
  for(const group of ['edif','infra']){
   try{
    const response=await fetch('/api/siurb?grupo='+group+'&regime='+regime,{cache:'no-store'});
    if(!response.ok){const o=await response.json().catch(()=>({}));throw new Error(o.erro||'Falha HTTP '+response.status)}
    const parsed=await siurbParseExcel(await response.arrayBuffer(),group.toUpperCase());
    records.push(...parsed);success.push(group.toUpperCase());
   }catch(e){errors.push(group.toUpperCase()+': '+e.message);console.error('SIURB '+group,e)}
  }
  if(!success.length)throw new Error(errors.join(' | '));
  const previous=(db.siurbItems||[]).filter(x=>!success.includes(x.group));
  const merged=[...new Map([...previous,...records].map(x=>[x.id,x])).values()];
  siurbSaveItems(merged,regime,'Consulta oficial SIURB ('+success.join(', ')+')');
  if(errors.length)siurbMsg='Importação parcial: '+records.length.toLocaleString('pt-BR')+' itens atualizados. '+errors.join(' | ')+'. Importe manualmente os arquivos faltantes.';
 }catch(e){siurbMsg='Importação indisponível: '+e.message+'. Você também pode selecionar o XLS oficial na importação manual.';console.error(e)}
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

