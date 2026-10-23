// Carrega as sete artes originais sem enviar o arquivo ao servidor.
// O ZIP disponibilizado para o teste contém entradas PNG sem compressão (método 0).
const DB_NAME='civolten-proposta-original-v1';
const STORE='paginas';
const MAX_PACKAGE_BYTES=28000000;
const PNG_SIG=[137,80,78,71,13,10,26,10];
let currentUrls=null;
const check=bool=>{if(!bool)throw Error('O pacote não contém as sete imagens oficiais da CIVOLTEN. Selecione o ZIP original disponibilizado para este teste.')};
const number=v=>String(v).padStart(2,'0');
function parseOfficialZip(arrayBuffer){
 const d=new DataView(arrayBuffer),u=new Uint8Array(arrayBuffer),dec=new TextDecoder();
 let pos=0;
 const found=new Map();
 while(pos+30<=u.length && d.getUint32(pos,true)===0x04034b50){
  const flags=d.getUint16(pos+6,true),method=d.getUint16(pos+8,true);
  const packed=d.getUint32(pos+18,true),unpacked=d.getUint32(pos+22,true);
  const nameLen=d.getUint16(pos+26,true),extraLen=d.getUint16(pos+28,true);
  check(flags===0 && method===0 && packed===unpacked);
  const contentStart=pos+30+nameLen+extraLen;
  check(contentStart+packed<=u.length);
  const name=dec.decode(u.subarray(pos+30,pos+30+nameLen));
  const match=name.match(/(?:^|\/)(0[1-7])\.png$/i);
  if(match){
   const bytes=u.slice(contentStart,contentStart+packed);
   check(bytes.length>20000&&bytes.length<6000000&&PNG_SIG.every((v,i)=>bytes[i]===v));
   check(new DataView(bytes.buffer).getUint32(16,false)>=700);
   check(new DataView(bytes.buffer).getUint32(20,false)>=950);
   found.set(match[1],new Blob([bytes],{type:'image/png'}));
  }
  pos=contentStart+packed;
 }
 check(found.size===7);
 for(let i=1;i<=7;i++)check(found.has(number(i)));
 return found;
}
function database(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(Error('Este navegador não permite guardar as artes. Abra no Chrome atualizado.'));
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error('Não foi possível abrir o armazenamento local das artes.'));
 });
}
function txDone(tx){
 return new Promise((resolve,reject)=>{
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(Error('Não foi possível gravar as artes. Verifique o espaço livre do aparelho.'));
  tx.onabort=()=>reject(Error('Importação interrompida.'));
 });
}
export async function installOfficialProposalArts(file){
 if(!file||file.size>MAX_PACKAGE_BYTES)throw Error('Selecione o ZIP original CIVOLTEN de até 28 MB.');
 const images=parseOfficialZip(await file.arrayBuffer());
 const db=await database();
 try{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  for(let i=1;i<=7;i++)store.put(images.get(number(i)),number(i));
  await txDone(tx);
 }finally{db.close()}
 if(currentUrls){currentUrls.forEach(URL.revokeObjectURL);currentUrls=null}
 return 7;
}
export async function officialProposalArtUrls(){
 if(currentUrls)return currentUrls;
 const db=await database();
 try{
  const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE);
  const images=await Promise.all(Array.from({length:7},(_,i)=>new Promise(resolve=>{
   const req=store.get(number(i+1));req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
  })));
  if(images.some(x=>!(x instanceof Blob))){
   throw Error('Instale primeiro o pacote com as sete artes aprovadas da CIVOLTEN. Use “Carregar artes originais (ZIP)” em Orçamentos.');
  }
  currentUrls=images.map(x=>URL.createObjectURL(x));
  return currentUrls;
 }finally{db.close()}
}
export function applyOfficialArtUrls(root,urls){
 const imgs=[...root.querySelectorAll('.cv-art-page .cv-art-back')];
 if(imgs.length!==7||urls.length!==7)throw Error('Não foi possível preparar as sete páginas.');
 imgs.forEach((img,i)=>{img.src=urls[i]});
}
export function replaceOfficialArtUrlsInHtml(html,urls){
 return html.replace(/\/assets\/proposal-art\/(0[1-7])\.png/g,(_,n)=>urls[Number(n)-1]);
}
