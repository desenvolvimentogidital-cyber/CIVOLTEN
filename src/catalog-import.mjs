// Importacao local de planilhas oficiais. Nenhum preco de referencia e utilizado.
const utf=new TextDecoder();
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function parseDecimal(value){
 const s=String(value??'').trim().replace(/\s/g,'');
 if(!s)return null;
 const clean=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s;
 if(!/^[+-]?\d+(\.\d+)?$/.test(clean))return null;
 const n=Number(clean);return Number.isFinite(n)?n:null;
}
export function parseDelimited(input){
 const text=String(input).replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/,1)[0]||'';
 const separator=[';','\t',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===separator&&!quoted){row.push(cell);cell='';}
  else if((c==='\r'||c==='\n')&&!quoted){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);
   row=[];cell='';
  }else cell+=c;
 }
 if(quoted)throw Error('CSV com aspas abertas: confira o formato.');
 row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);
 return rows;
}
function textOf(el,tag){
 const n=el.getElementsByTagName(tag)[0];
 return n?n.textContent||'':'';
}
function xmlOf(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('Planilha XLSX com XML invalido.');
 return doc;
}
async function unzipEntries(buffer){
 const view=new DataView(buffer),bytes=new Uint8Array(buffer);
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw Error('Arquivo XLSX nao reconhecido.');
 const total=view.getUint16(eocd+10,true),offset=view.getUint32(eocd+16,true),found=new Map();
 if(total>4000)throw Error('Planilha com excesso de arquivos internos.');
 let pos=offset;
 for(let i=0;i<total;i++){
  if(view.getUint32(pos,true)!==0x02014b50)throw Error('ZIP XLSX inconsistente.');
  const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),
   expanded=view.getUint32(pos+24,true),nlen=view.getUint16(pos+28,true),
   extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),
   local=view.getUint32(pos+42,true),name=utf.decode(bytes.subarray(pos+46,pos+46+nlen));
  pos+=46+nlen+extra+comment;
  if(!/^(xl\/|\[Content_Types\])/.test(name))continue;
  if(expanded>50_000_000)throw Error('Uma aba XLSX excede o limite de memoria.');
  found.set(name,{method,compressed,local});
 }
 async function read(name){
  const f=found.get(name);if(!f)return null;
  if(view.getUint32(f.local,true)!==0x04034b50)throw Error('ZIP XLSX inconsistente.');
  const start=f.local+30+view.getUint16(f.local+26,true)+view.getUint16(f.local+28,true);
  const contents=bytes.subarray(start,start+f.compressed);
  if(f.method===0)return utf.decode(contents);
  if(f.method!==8||!globalThis.DecompressionStream)throw Error('Seu navegador nao abre XLSX. Salve a aba como CSV UTF-8.');
  try{
   const stream=new Blob([contents]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
   return utf.decode(await new Response(stream).arrayBuffer());
  }catch{throw Error('Nao foi possivel ler o XLSX neste navegador; exporte a aba como CSV UTF-8.');}
 }
 return {read};
}
function worksheetRows(xml,strings){
 const doc=xmlOf(xml),result=[];
 const rows=doc.getElementsByTagName('row');
 for(let r=0;r<rows.length&&result.length<25000;r++){
  const cells=rows[r].getElementsByTagName('c'),row=[];
  for(let j=0;j<cells.length;j++){
   const cell=cells[j],cellref=cell.getAttribute('r')||'';
   const letters=cellref.match(/^[A-Z]+/i)?.[0]||'';
   let col=0;for(const l of letters.toUpperCase())col=col*26+l.charCodeAt(0)-64;
   if(!col||col>100)continue;
   const raw=textOf(cell,'v');
   let value=cell.getAttribute('t')==='s'?strings[Number(raw)]??'':cell.getAttribute('t')==='inlineStr'?textOf(cell,'is'):raw;
   if(cell.getAttribute('t')==='inlineStr'){
    const ts=cell.getElementsByTagName('t');value=Array.from(ts,x=>x.textContent||'').join('');
   }
   row[col-1]=value;
  }
  if(row.some(x=>String(x??'').trim()))result.push(row);
 }
 return result;
}
export async function readCatalogFile(file){
 if(!file||file.size>65_000_000)throw Error('Selecione um arquivo XLSX/CSV de ate 65 MB.');
 if(/\.(csv|tsv|txt)$/i.test(file.name)){
  const rows=parseDelimited(await file.text());
  return [{name:file.name,rows}];
 }
 if(!/\.xlsx$/i.test(file.name))throw Error('Use um arquivo .xlsx, .csv ou .tsv (nao PDF ou ZIP).');
 const zip=await unzipEntries(await file.arrayBuffer());
 const workbook=await zip.read('xl/workbook.xml');
 if(!workbook)throw Error('Arquivo nao contem uma pasta de trabalho XLSX.');
 const rels=await zip.read('xl/_rels/workbook.xml.rels');
 const links=new Map();
 if(rels){
  for(const node of xmlOf(rels).getElementsByTagName('Relationship'))
   links.set(node.getAttribute('Id'),node.getAttribute('Target'));
 }
 const shared=await zip.read('xl/sharedStrings.xml');
 const strings=shared?Array.from(xmlOf(shared).getElementsByTagName('si'),si=>
  Array.from(si.getElementsByTagName('t'),x=>x.textContent||'').join('')):[];
 const nodes=xmlOf(workbook).getElementsByTagName('sheet');
 const sheets=[];for(let i=0;i<nodes.length&&i<20;i++){
  const node=nodes[i],rid=node.getAttribute('r:id')||node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  let target=links.get(rid)||'worksheets/sheet'+(i+1)+'.xml';
  target=target.replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target;
  if(target.includes('..'))continue;
  const raw=await zip.read(target);
  if(!raw)continue;
  sheets.push({name:node.getAttribute('name')||'Aba '+(i+1),rows:worksheetRows(raw,strings)});
 }
 if(!sheets.length)throw Error('Nenhuma aba XLSX legivel encontrada.');
 return sheets;
}
export const FIELD_NAMES=[
 ['code','Codigo do servico/composicao',/c[oó]d|cod|composi[cç][aã]o.*n[uú]m/i],
 ['description','Descricao do servico',/descri|servi[cç]o|item/i],
 ['unit','Unidade',/^unid|^und$|unidade|^un$/i],
 ['role','Funcao/profissional (opcional)',/profiss|fun[cç][aã]o|m[aã]o.de.obra|recurso/i],
 ['hours','Coeficiente HH por unidade (opcional)',/coef|produtiv|horas|^hh/i],
 ['category','Grupo/categoria (opcional)',/grupo|categoria|etapa/i]
];
export function suggestColumns(rows,headerIndex=0){
 const titles=rows[headerIndex]||[];
 const map={};
 for(const [key,,rx] of FIELD_NAMES){
  let idx=titles.findIndex(x=>rx.test(norm(x)));
  if(idx<0)idx=-1;map[key]=idx;
 }
 if(map.code<0)map.code=0;
 if(map.description<0)map.description=1;
 if(map.unit<0)map.unit=2;
 return map;
}
export function buildCatalogImport(rows,{source,month,headerIndex=0,mapping,existing=[]}){
 if(!['siurb','sinapi'].includes(source))throw Error('Escolha SIURB ou SINAPI.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw Error('Informe a competencia AAAA-MM da planilha.');
 if(!Array.isArray(rows)||!rows.length)throw Error('Aba vazia.');
 for(const name of ['code','description','unit'])
  if(!Number.isInteger(mapping?.[name])||mapping[name]<0)throw Error('Associe as colunas de codigo, descricao e unidade.');
 const used=new Map(),previous=new Map((existing||[]).map(x=>[x.code,x]));
 let skipped=0,loadedLabor=0,previousCode=null;
 for(const row of rows.slice(headerIndex+1)){
  const get=k=>mapping[k]>=0?String(row[mapping[k]]??'').trim():'';
  const rawCode=get('code'),role=get('role'),hours=parseDecimal(get('hours'));
  const fullCode=(source+':'+rawCode).toUpperCase();
  if(!rawCode){
   if(previousCode&&role&&hours!==null&&hours>0) {
    const old=used.get(previousCode);
    if(old&&!old.roles.some(x=>x.role===role&&x.hours===hours)&&old.roles.length<30){old.roles.push({role:role.slice(0,80),hours});loadedLabor++;}
   }
   continue;
  }
  previousCode=null;
  const description=get('description'),unit=get('unit');
  if(fullCode.length>48||fullCode.length<5||!description||description.length>180||!unit||unit.length>20){skipped++;continue;}
  let record=used.get(fullCode);
  if(!record){
   const saved=previous.get(fullCode);
   record={id:saved?.id||null,code:fullCode,category:(get('category')||source.toUpperCase()).slice(0,10),
    description:saved?.description||description,unit:saved?.unit||unit,source,
    sinapiCode:rawCode.slice(0,48),referenceMonth:month,
    directCost:saved?.directCost??null,roles:Array.isArray(saved?.roles)&&saved.roles.length?saved.roles.map(x=>({...x})) :[]};
   used.set(fullCode,record);
  }
  previousCode=fullCode;
  // Quando existe configuracao propria, nunca sobrescrever a produtividade editada.
  if(previous.has(fullCode)&&record.roles.length)continue;
  if(role&&hours!==null&&hours>0&&hours<=10000&&record.roles.length<30&&
     !record.roles.some(x=>x.role===role&&x.hours===hours)){
   record.roles.push({role:role.slice(0,80),hours});loadedLabor++;
  }
 }
 if(!used.size)throw Error('Nenhum servico encontrado. Confira a aba e o mapeamento das colunas.');
 return {items:[...used.values()],skipped,loadedLabor,source,month};
}
