/* CIVOLTEN — Importação manual SINAPI (CAIXA/IBGE).
 * Excel/CSV/ZIP; armazenamento em IndexedDB, isolado do SIURB.
 * Valores são referências, não preços de venda nem mão de obra isolada.
 * A importação de coeficientes analíticos exige mapeamento técnico posterior.
 */
(function(){
'use strict';
const SOURCE='https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx';
let records=[],busy=false,message='',search='',shown=0,meta=null;
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const dec=v=>{
 if(typeof v==='number')return Number.isFinite(v)?v:NaN;
 let s=String(v??'').replace(/R\$/gi,'').replace(/\s/g,'').trim();
 if(!/^\d[\d.,]*$/.test(s))return NaN;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0)s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else if(comma>=0)s=s.replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
 return Number(s);
};
const number=v=>{const n=dec(v);return Number.isFinite(n)&&n>=0?n:0};
const money=v=>cash(number(v));
const text=v=>esc(String(v??''));
const simplifiedUnit=v=>norm(v).replace(/\^/g,'').replace(/M²/g,'M2').replace(/M³/g,'M3');
const knownUnit=/^(UN|UND|UNID|UNIDADE|M|M2|M3|M²|M³|KG|T|TON|L|H|HR|HORA|DIA|MES|MÊS|CJ|PÇ|PC|PTO|KM|M3XKM)$/;
const codeOf=v=>{
 const s=String(v??'').trim();
 const match=s.match(/^(\d{5,7})(?:[.,]0+)?$/);
 return match?match[1]:'';
};
const kindName=v=>/INSUMO/.test(norm(v))?'insumo':/COMPOSICAO/.test(norm(v))?'composicao':'';
function header(cells){
 const w=cells.map(norm),ix=re=>w.findIndex(x=>re.test(x));
 const code=ix(/^(CODIGO|CODIGO SINAPI|COD|CODIGO DA COMPOSICAO)$/);
 const desc=ix(/^(DESCRICAO|DESCRICAO DA COMPOSICAO|DESCRICAO DO SERVICO|DESCRICAO DO INSUMO|DISCRIMINACAO|SERVICO)$/);
 const unit=ix(/^(UNID|UNIDADE|UND|UM|U M|UNID DE MEDIDA)$/);
 const uf=ix(/^(UF|ESTADO|SIGLA UF)$/);
 const type=ix(/^(TIPO|CLASSE|TIPO DE COMPOSICAO)$/);
 const direct=ix(/^(CUSTO TOTAL|CUSTO UNITARIO|CUSTO UNIT|PRECO UNITARIO|VALOR UNITARIO|VALOR TOTAL|PRECO TOTAL|PRECO R\$|CUSTO R\$|CUSTO|PRECO)$/);
 const regionColumn=ix(/^(SP|SAO PAULO|CUSTO SP|PRECO SP|SP CUSTO|SP PRECO)$/);
 const cost=direct>=0?direct:regionColumn;
 // Não confundir COEFICIENTE/QUANTIDADE com custo.
 return code>=0&&desc>=0&&unit>=0?{code,desc,unit,uf,type,cost,regionColumn}:null;
}
function inferSheetUF(sheetName,filename){
 const n=norm(sheetName+' '+filename).replace(/[^A-Z0-9]/g,' ');
 if(/\bSP\b|\bSAO PAULO\b/.test(n))return 'SP';
 const m=n.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SE|TO)\b/);
 return m?m[1]:null;
}
function parseRows(rows,ctx){
 const items=[],unpriced=[];let h=null,unmapped=0,matchedHeaders=0;
 for(let i=0;i<rows.length;i++){
  const row=Array.isArray(rows[i])?rows[i]:[];
  const found=header(row);if(found){h=found;matchedHeaders++;continue}
  if(!h)continue;
  const code=codeOf(row[h.code]);if(!code)continue;
  const desc=String(row[h.desc]??'').trim().replace(/\s+/g,' ');
  const u=simplifiedUnit(row[h.unit]);
  if(desc.length<6||desc.length>380||!knownUnit.test(u)){unmapped++;continue}
  const rowUF=h.uf>=0?norm(row[h.uf]).replace(/^SAO PAULO$/,'SP'):'';
  if(rowUF&&rowUF!==ctx.uf)continue;
  const sheetUF=inferSheetUF(ctx.sheetName,ctx.fileName);
  if(!rowUF&&sheetUF&&sheetUF!==ctx.uf)continue;
  const kind=h.type>=0?kindName(row[h.type]):kindName(ctx.sheetName+' '+ctx.fileName);
  if(kind==='insumo'&&ctx.kind==='composicoes')continue;
  if(kind==='composicao'&&ctx.kind==='insumos')continue;
  // Quando a planilha mistura insumos e composições, somente os da categoria selecionada.
  if(h.type>=0&&!kind)continue;
  const value=h.cost>=0?dec(row[h.cost]):NaN;
  const item={id:'SINAPI:'+ctx.uf+':'+ctx.regime+':'+ctx.base+':'+(kind||ctx.kind)+':'+code,
   code,name:desc,unit:u,cost:Number.isFinite(value)&&value>0&&value<1e9?Math.round(value*100)/100:null,
   kind:kind||ctx.kind,uf:ctx.uf,base:ctx.base,regime:ctx.regime,source:'SINAPI',
   fileName:ctx.fileName,sheetName:ctx.sheetName,verifiedUF:!!rowUF||!!sheetUF||h.regionColumn>=0};
  (item.cost==null?unpriced:items).push(item);
 }
 return {items:items.concat(unpriced),headers:matchedHeaders,unmapped};
}
function parseWorkbook(book,options,filename){
 const out=new Map();let headers=0,seen=0,unmapped=0;
 for(const name of book.SheetNames||[]){
  const sheet=book.Sheets[name];if(!sheet||!sheet['!ref'])continue;
  const rows=window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:false});
  if(!rows.length)continue;
  const parsed=parseRows(rows,{...options,fileName:filename,sheetName:name});
  headers+=parsed.headers;unmapped+=parsed.unmapped;seen+=rows.length;
  for(const r of parsed.items){
   // Prefer entries with explicitly defined prices over blank prices.
   if(!out.has(r.id)||out.get(r.id).cost==null&&r.cost!=null)out.set(r.id,r);
  }
 }
 return {items:[...out.values()],headers,seen,unmapped};
}
async function ensureZIP(){
 if(window.JSZip)return window.JSZip;
 for(const url of ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js']){
  try{
   await new Promise((resolve,reject)=>{
    const tag=document.createElement('script');tag.async=true;tag.src=url;
    tag.onload=()=>window.JSZip?resolve():reject(new Error('Leitor ZIP não carregado'));
    tag.onerror=()=>reject(new Error('Falha ao carregar leitor ZIP'));document.head.append(tag);
   });if(window.JSZip)return window.JSZip;
  }catch(err){console.warn('SINAPI ZIP',err)}
 }
 throw new Error('Não foi possível abrir ZIP. Extraia o XLSX do ZIP e envie o XLSX diretamente.');
}
async function readFile(file,options){
 await siurbXLSX();
 if(/\.zip$/i.test(file.name)){
  if(file.size>90*1024*1024)throw new Error('ZIP grande para o celular. Extraia o Excel de composições e importe apenas o XLSX.');
  const JSZip=await ensureZIP(),zip=await JSZip.loadAsync(file);
  const entries=Object.values(zip.files).filter(x=>!x.dir&&/\.(xlsx|xls|csv)$/i.test(x.name))
   .filter(x=>!/(INSTRUCOES|LEIA.ME|MANUTENCOES|FAMILIAS)/i.test(x.name))
   .filter(x=>options.kind==='insumos'?/INSUM|PRECO|SINAPI|SP/i.test(x.name):/COMP|CUSTO|SINAPI|SP/i.test(x.name))
   .slice(0,18);
  if(!entries.length)throw new Error('O ZIP não contém planilha compatível. Extraia o XLSX oficial e importe o arquivo diretamente.');
  const all=new Map(),errors=[];let headers=0;
  for(const entry of entries){
   try{
    const blob=await entry.async('uint8array');
    if(blob.length>35*1024*1024)throw new Error('Planilha interna muito grande: '+entry.name);
    const book=window.XLSX.read(blob,{type:'array',cellDates:false});
    const parsed=parseWorkbook(book,options,entry.name);
    headers+=parsed.headers;
    for(const item of parsed.items)if(!all.has(item.id)||all.get(item.id).cost==null&&item.cost!=null)all.set(item.id,item);
   }catch(err){errors.push(entry.name+': '+err.message)}
  }
  return {items:[...all.values()],headers,errors};
 }
 if(!/\.(xls|xlsx|csv)$/i.test(file.name))throw new Error('Selecione ZIP, XLSX, XLS ou CSV.');
 if(file.size>45*1024*1024)throw new Error('Arquivo grande para importação direta no celular. Selecione o Excel de São Paulo ou divida o arquivo.');
 const book=window.XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:false});
 return {...parseWorkbook(book,options,file.name),errors:[]};
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error('IndexedDB indisponível neste dispositivo'));
  const req=indexedDB.open('civolten_sinapi_v1',1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('sinapi'))req.result.createObjectStore('sinapi',{keyPath:'key'})};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function store(items,details){
 const database=await openDB();
 try{await new Promise((resolve,reject)=>{
  const tx=database.transaction('sinapi','readwrite');
  tx.objectStore('sinapi').put({key:'current',items,details});
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error||new Error('Erro ao salvar a planilha'));
 });}finally{database.close()}
}
async function restore(){
 try{
  const database=await openDB();let data;
  try{data=await new Promise((resolve,reject)=>{
   const tx=database.transaction('sinapi','readonly'),req=tx.objectStore('sinapi').get('current');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  })}finally{database.close()}
  if(data){records=data.items||[];meta=data.details||null; if(s.page==='services')render()}
 }catch(e){console.warn('SINAPI cache',e.message)}
}
function hits(){
 const q=norm(search);
 const filtered=(q?records.filter(x=>norm(x.name+' '+x.code).includes(q)):records).slice(0,35);
 shown=filtered.length;
 return filtered.map(x=>
  '<div class="sn-result"><div><strong>'+text(x.code)+' · '+text(x.name)+'</strong>'+
  '<small>'+text(x.kind==='insumo'?'Insumo':'Composição')+' · '+text(x.unit)+' · '+
  (x.cost!=null?money(x.cost)+' por unidade':'preço não encontrado')+
  (x.verifiedUF?'':' · UF a conferir no arquivo')+'</small></div>'+
  '<button type="button" class="btn btn-outline" data-action="sn-add" data-id="'+text(x.id)+'">Usar no catálogo</button></div>'
 ).join('')||'<p class="small-desc">Nenhum item disponível. Importe um arquivo ou procure por outro código.</p>';
}
function panel(){
 const details=meta||db.sinapiMeta||{};
 return '<section class="siurb-box sn-panel"><div class="siurb-heading"><span class="siurb-logo sn-logo">BR</span>'+
 '<div><h2>SINAPI • CAIXA / IBGE</h2><p>Importador de composições e insumos · Referência complementar à SIURB</p></div></div>'+
 '<p class="small-desc">Baixe o pacote oficial SINAPI e selecione o <b>ZIP ou Excel</b> aqui. Para planilhas em PDF, é necessário baixar a versão XLSX. A importação não altera seus salários, serviços ou orçamentos já cadastrados.</p>'+
 '<div class="sn-settings"><label class="label">UF<select id="sn-uf" class="input">'+
 '<option value="SP">São Paulo (SP)</option></select></label>'+
 '<label class="label">Competência da planilha (mês/ano)<input id="sn-base" class="input" type="month" value="'+text(details.base||new Date().toISOString().slice(0,7))+'"></label>'+
 '<label class="label">Regime<select id="sn-regime" class="input">'+
 '<option value="onerada"'+(details.regime!=='desonerada'?' selected':'')+'>Onerada</option>'+
 '<option value="desonerada"'+(details.regime==='desonerada'?' selected':'')+'>Desonerada</option></select></label>'+
 '<label class="label">Tipo de relatório<select id="sn-kind" class="input">'+
 '<option value="composicoes"'+(details.kind!=='insumos'?' selected':'')+'>Composições e custos de serviços</option>'+
 '<option value="insumos"'+(details.kind==='insumos'?' selected':'')+'>Insumos e materiais</option></select></label></div>'+
 '<label class="siurb-file btn btn-outline block" for="sn-file">'+I('upload')+' Selecionar SINAPI: ZIP / XLSX / XLS / CSV'+
 '<input type="file" id="sn-file" accept=".zip,.xlsx,.xls,.csv,application/zip,text/csv" hidden '+(busy?'disabled':'')+'></label>'+
 '<div class="siurb-sources"><a href="'+SOURCE+'" target="_blank" rel="noopener">Baixar relatórios oficiais na CAIXA ↗</a>'+
 '<span>Importados: '+records.length.toLocaleString('pt-BR')+' itens</span></div>'+
 '<div class="sn-message" id="sn-message" aria-live="polite">'+text(message||(details.fileName?'Última importação: '+details.fileName+' · '+details.base+' · '+details.regime:'Aguardando sua planilha SINAPI.'))+'</div>'+
 '<p class="siurb-fine">Os arquivos SINAPI em XLSX são distribuídos pela CAIXA em ZIP. São referências públicas, sem preços de venda ou mão de obra desmembrada automaticamente. O formato exato do arquivo será validado na importação.</p>'+
 '<div class="searchbar"><span>⌕</span><input id="sn-search" placeholder="Pesquisar no SINAPI importado: código ou serviço..." value="'+text(search)+'"></div>'+
 '<div id="sn-results">'+hits()+'</div>'+
 (records.length>35?'<p class="small-desc">Exibindo até 35 resultados. Pesquise pelo código ou descrição para encontrar os demais.</p>':'')+
 '<p class="siurb-fine">O catálogo SINAPI fica armazenado separadamente no navegador. Guarde o ZIP/XLSX original: ele pode precisar ser importado novamente após limpar dados do celular. A comparação com SIURB requer validar a equivalência das composições.</p>'+
 '</section>';
}
const previousServices=ROUTES.services;
ROUTES.services=function(){
 const html=previousServices();
 const anchor='<div class="siurb-my-services">';
 if(html.includes(anchor))return html.replace(anchor,panel()+anchor);
 return html.replace('<main class="sheet full">','<main class="sheet full">'+panel());
};
async function importFile(file){
 if(!file||busy)return;
 const base=document.getElementById('sn-base')?.value;
 const regime=document.getElementById('sn-regime')?.value||'onerada';
 const kind=document.getElementById('sn-kind')?.value||'composicoes';
 const uf='SP';
 if(!/^\d{4}-\d{2}$/.test(base||'')){message='Informe a competência (mês/ano) do arquivo antes de importar.';render();return}
 busy=true;message='Lendo '+file.name+' no dispositivo...';render();
 try{
  const result=await readFile(file,{base,regime,kind,uf});
  if(!result.items.length)throw new Error('Não encontrei linhas de código, descrição e unidade reconhecíveis. Confira se é XLSX de composições/insumos e não um relatório PDF ou de outra UF.');
  const uncertain=result.items.filter(x=>!x.verifiedUF).length;
  const details={base,regime,uf,kind,fileName:file.name,count:result.items.length,importedAt:new Date().toISOString(),uncertain};
  // Preserva categorias anteriores quando o usuário importa insumos após composições.
  const previous=records.filter(x=>x.kind!==(kind==='composicoes'?'composicao':'insumo'));
  const merged=[...new Map([...previous,...result.items].map(x=>[x.id,x])).values()];
  await store(merged,details);
  records=merged;meta=details;
  db.sinapiMeta={...details,count:merged.length};
  if(!save())message='Planilha salva no catálogo SINAPI local, mas os metadados não couberam no cadastro. Faça backup.';
  else message='SINAPI importado: '+result.items.length.toLocaleString('pt-BR')+' itens do arquivo '+file.name+'.'+
    (uncertain?' Atenção: '+uncertain+' itens sem UF explícita; confira a planilha para garantir São Paulo.':'')+
    (result.errors?.length?' Alguns arquivos do ZIP foram ignorados: '+result.errors.slice(0,2).join(' / '):'');
  search='';render();
 }catch(e){message='Não foi possível importar SINAPI: '+e.message;console.warn('SINAPI import',e);render()}
 finally{busy=false}
}
document.addEventListener('change',event=>{
 if(event.target?.id==='sn-file'){const file=event.target.files?.[0];importFile(file)}
},true);
document.addEventListener('input',event=>{
 if(event.target?.id!=='sn-search')return;
 search=event.target.value;const target=document.getElementById('sn-results');
 if(target)target.innerHTML=hits();
},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action="sn-add"]');if(!button)return;
 event.preventDefault();event.stopPropagation();
 const item=records.find(x=>x.id===button.dataset.id);
 if(!item)return;
 if(db.services.some(x=>x.origin==='SINAPI'&&x.sourceCode===item.code&&x.sourceUF===item.uf&&x.sourceDate===item.base&&x.sourceRegime===item.regime)){
  toast('Este item SINAPI já está no seu catálogo.');return
 }
 const service={id:uid('sv'),origin:'SINAPI',name:item.name,unit:item.unit,
  referenceCost:item.cost||0,labor:0,material:0,equipment:0,
  sourceCode:item.code,sourceUF:item.uf,sourceDate:item.base,
  sourceRegime:item.regime,sourceKind:item.kind,sourceFile:item.fileName,
  costSplitConfirmed:false,referenceNeedsValidation:true};
 db.services.push(service);
 if(!save()){db.services.pop();toast('Sem espaço no armazenamento. Faça backup e libere espaço.');return}
 toast('Item SINAPI adicionado à biblioteca. Confira sua produtividade e composição antes de orçar.');
 render();
},true);
const css=document.createElement('style');
css.textContent='.sn-panel{margin:12px 0;background:#f7fafc;border-color:#bdcedf}.sn-logo{background:#276295!important;color:white!important}.sn-settings{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.sn-settings .label{font-size:11px}.sn-settings .input{margin:5px 0 0}.sn-result{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid #dae2ec}.sn-result>div{flex:1;min-width:0}.sn-result strong{display:block;font-size:12px;line-height:1.35}.sn-result small{display:block;font-size:10px;color:#64748b;line-height:1.4;margin-top:4px}.sn-result button{font-size:10px;min-width:90px;padding:8px 6px}.sn-message{font-size:12px;line-height:1.45;margin:10px 0;color:#254465}@media(max-width:380px){.sn-settings{grid-template-columns:1fr}.sn-result{align-items:flex-start}}';
document.head.append(css);
restore();
window.CIVOLTENSINAPI={parseRows,parseWorkbook,getRecords:()=>records.slice(),getMeta:()=>meta};
})();