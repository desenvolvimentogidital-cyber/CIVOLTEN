/* Importação CSV/JSON sem bibliotecas externas para uso em celular.
 * XLSX/PDF devem ser convertidos antes, pois não são CSV.
 */
(function(){
'use strict';
function normalizedKey(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
}
function parseCSV(text){
 const str=String(text||'').replace(/^\uFEFF/,'');
 const first=str.split(/\r?\n/,1)[0]||'';
 const delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
 const rows=[];let cells=[],part='',quoted=false;
 for(let i=0;i<str.length;i++){
  const ch=str[i];
  if(quoted){
   if(ch==='"'&&str[i+1]==='"'){part+='"';i++;}
   else if(ch==='"')quoted=false;
   else part+=ch;
  }else if(ch==='"'){quoted=true;}
  else if(ch===delimiter){cells.push(part.trim());part='';}
  else if(ch==='\n'){cells.push(part.trim());part='';if(cells.some(Boolean))rows.push(cells);cells=[];}
  else if(ch!=='\r')part+=ch;
 }
 if(quoted)throw Error('CSV com aspas sem fechamento.');
 cells.push(part.trim());if(cells.some(Boolean))rows.push(cells);
 if(rows.length<2)throw Error('O arquivo precisa de cabeçalho e pelo menos uma linha.');
 const headings=rows.shift().map(normalizedKey);
 if(new Set(headings).size!==headings.length)throw Error('Colunas duplicadas no cabeçalho.');
 if(rows.length>15000)throw Error('Arquivo grande demais. Separe em partes menores.');
 return rows.map((cells,index)=>{
  const record={};
  for(let i=0;i<headings.length;i++)record[headings[i]]=cells[i]||'';
  record.__line=index+2;return record;
 });
}
function field(row,...names){for(const name of names){const value=row[normalizedKey(name)];if(value!==undefined&&value!=='')return value;}return '';}
function numberBR(value){
 if(typeof value==='number')return value;
 const raw=String(value??'').trim().replace(/R\$\s*/g,'').replace(/\s/g,'');
 if(!raw||raw==='-')return null;
 let normalized=raw;
 if(raw.includes(',')&&raw.includes('.'))normalized=raw.lastIndexOf(',')>raw.lastIndexOf('.')?
  raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
 else if(raw.includes(','))normalized=raw.replace(',','.');
 const n=Number(normalized);
 if(!Number.isFinite(n)||n<0)throw Error('Valor numérico inválido: '+raw);
 return Math.round(n*100)/100;
}
function validateFile(file){
 if(!file)throw Error('Selecione um arquivo CSV ou JSON.');
 if(file.size>5000000)throw Error('Limite de 5 MB por arquivo. Divida em arquivos menores.');
 if(!/\.(?:csv|json)$/i.test(file.name))throw Error('Formato não suportado. Salve PDF ou Excel como CSV e escolha o arquivo CSV.');
}
async function loadFile(file){
 validateFile(file);
 const source=await file.text();
 if(file.name.toLowerCase().endsWith('.json')){
  try{return {json:JSON.parse(source)}}catch{throw Error('JSON inválido. Confira a estrutura do arquivo.');}
 }
 return {rows:parseCSV(source)};
}
function download(name,content){
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 URL.revokeObjectURL(url);
}
window.CIVOLTEN_TABLE_IMPORT={parseCSV,field,numberBR,loadFile,download};
})();
