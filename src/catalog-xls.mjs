// Leitura local de Excel BIFF8 (.xls), inclusive composicoes SIURB.
// Apenas celulas sao lidas; macros, formulas e links nao sao executados.
const text16=new TextDecoder('utf-16le');
const MAGIC=[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1],END=0xfffffffe;
const sectorOk=n=>Number.isInteger(n)&&n>=0&&n<0xfffffffa;
const fail=m=>{throw Error(m);};
const dv=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);

function compoundWorkbook(buffer){
 const bytes=new Uint8Array(buffer),view=dv(bytes);
 if(bytes.length<512||MAGIC.some((x,i)=>x!==bytes[i]))
  fail('Este arquivo .xls nao e uma planilha Excel 97-2003 valida.');
 const shift=view.getUint16(30,true),miniShift=view.getUint16(32,true);
 if(![9,12].includes(shift)||miniShift!==6)fail('Formato XLS nao suportado.');
 const sectorSize=2**shift,sectorCount=Math.floor(bytes.length/sectorSize)-1;
 const sector=n=>{
  if(!sectorOk(n)||n>=sectorCount)fail('XLS corrompido: setor invalido.');
  return bytes.subarray((n+1)*sectorSize,(n+2)*sectorSize);
 };
 const fatCount=view.getUint32(44,true),dirStart=view.getUint32(48,true),
  miniCutoff=view.getUint32(56,true),miniStart=view.getUint32(60,true),
  miniCount=view.getUint32(64,true),difatStart=view.getUint32(68,true),
  difatCount=view.getUint32(72,true);
 if(fatCount>sectorCount||difatCount>sectorCount)fail('XLS com tabela de setores invalida.');
 const difat=[];
 for(let i=0;i<109;i++){const n=view.getUint32(76+4*i,true);if(sectorOk(n))difat.push(n);}
 let next=difatStart;
 for(let i=0;i<difatCount;i++){
  const v=dv(sector(next));
  for(let j=0;j<sectorSize/4-1;j++){
   const n=v.getUint32(j*4,true);if(sectorOk(n))difat.push(n);
  }
  next=v.getUint32(sectorSize-4,true);
 }
 if(difat.length<fatCount)fail('XLS com tabela FAT incompleta.');
 const fat=[];
 for(const n of difat.slice(0,fatCount)){
  const v=dv(sector(n));
  for(let i=0;i<sectorSize/4;i++)fat.push(v.getUint32(i*4,true));
 }
 const chain=(start,size=null,max=65_000_000)=>{
  const pages=[],seen=new Set();let total=0,n=start;
  while(sectorOk(n)){
   if(seen.has(n)||seen.size>sectorCount||n>=fat.length)fail('XLS com setores encadeados incorretamente.');
   seen.add(n);const block=sector(n);pages.push(block);total+=block.length;
   if(total>max)fail('XLS excede o limite de memoria.');
   if(size!==null&&total>=size)break;
   n=fat[n];
  }
  if(size!==null&&total<size)fail('XLS incompleto.');
  const output=new Uint8Array(size===null?total:size);
  let pos=0;
  for(const block of pages){
   const count=Math.min(block.length,output.length-pos);
   output.set(block.subarray(0,count),pos);pos+=count;
   if(pos===output.length)break;
  }
  return output;
 };
 const dir=chain(dirStart,null,12_000_000),entries=[],dirview=dv(dir);
 for(let off=0;off+128<=dir.length;off+=128){
  const len=dirview.getUint16(off+64,true);
  if(len<2||len>64||len%2)continue;
  const name=text16.decode(dir.subarray(off,off+len-2));
  const kind=dir[off+66],start=dirview.getUint32(off+116,true);
  const size=dirview.getUint32(off+120,true)+dirview.getUint32(off+124,true)*4294967296;
  if(kind===2||kind===5)entries.push({name,kind,start,size});
 }
 const entry=entries.find(x=>x.kind===2&&['Workbook','Book'].includes(x.name));
 if(!entry)fail('XLS nao contem uma pasta Excel legivel.');
 if(entry.size>65_000_000)fail('XLS excede 65 MB.');
 if(entry.size>=miniCutoff)return chain(entry.start,entry.size);
 const root=entries.find(x=>x.kind===5);
 if(!root||!sectorOk(miniStart)||miniCount>sectorCount)fail('XLS pequeno com mini setores invalidos.');
 const rootData=chain(root.start,root.size),mini=chain(miniStart,miniCount*sectorSize,10_000_000);
 const miniview=dv(mini),output=new Uint8Array(entry.size),seen=new Set();
 let current=entry.start,pos=0;
 while(sectorOk(current)&&pos<output.length){
  if(seen.has(current)||current*64>=rootData.length||current*4+4>mini.length)
   fail('XLS pequeno com mini setores corrompidos.');
  seen.add(current);
  const block=rootData.subarray(current*64,(current+1)*64);
  const count=Math.min(block.length,output.length-pos);
  output.set(block.subarray(0,count),pos);pos+=count;
  current=miniview.getUint32(current*4,true);
 }
 if(pos<output.length)fail('XLS incompleto.');
 return output;
}

function sstStrings(chunks){
 if(!chunks.length)return [];
 let chunk=0,offset=0;
 const next=()=>{
  while(chunk<chunks.length&&offset>=chunks[chunk].length){chunk++;offset=0;}
  if(chunk>=chunks.length)fail('XLS com cadeia de textos incompleta.');
 };
 const byte=()=>{next();return chunks[chunk][offset++];};
 const u16=()=>byte()|(byte()<<8),u32=()=>((byte()|(byte()<<8)|(byte()<<16)|(byte()<<24))>>>0);
 const skip=n=>{for(let i=0;i<n;i++)byte();};
 u32();const unique=u32();
 if(unique>150_000)fail('XLS excede a capacidade de textos.');
 const strings=[];
 for(let i=0;i<unique;i++){
  const chars=u16(),flags=byte(),rich=flags&8?u16():0,extra=flags&4?u32():0;
  let wide=!!(flags&1),text='';
  for(let j=0;j<chars;j++){
   if(offset===chunks[chunk].length){next();wide=!!(byte()&1);}
   let code=byte();if(wide)code|=byte()<<8;
   text+=String.fromCharCode(code);
  }
  if(rich)skip(rich*4);
  if(extra)skip(extra);
  strings.push(text);
 }
 return strings;
}

function workbookSheets(bytes){
 const view=dv(bytes),bounds=[];let strings=[],pos=0;
 const record=at=>{
  if(at+4>bytes.length)fail('Registro XLS incompleto.');
  const type=view.getUint16(at,true),length=view.getUint16(at+2,true);
  if(at+4+length>bytes.length)fail('Registro XLS truncado.');
  return {type,payload:bytes.subarray(at+4,at+4+length),next:at+4+length};
 };
 while(pos<bytes.length){
  const r=record(pos);
  if(r.type===0x85&&r.payload.length>=8){
   const v=dv(r.payload),at=v.getUint32(0,true),len=r.payload[6],wide=r.payload[7]&1;
   const nameBytes=r.payload.subarray(8,8+len*(wide?2:1));
   const name=wide?text16.decode(nameBytes):String.fromCharCode(...nameBytes);
   if(at<bytes.length)bounds.push({name,at});
  }
  if(r.type===0xfc){
   const parts=[r.payload];let p=r.next;
   while(p+4<=bytes.length){
    const more=record(p);if(more.type!==0x3c)break;
    parts.push(more.payload);p=more.next;
   }
   strings=sstStrings(parts);pos=p;continue;
  }
  pos=r.next;if(r.type===0x0a)break;
 }
 const numberBuffer=new ArrayBuffer(8),numberView=new DataView(numberBuffer);
 const rk=raw=>{
  let value;
  if(raw&2)value=raw>>2;
  else{
   numberView.setUint32(0,0,true);
   numberView.setUint32(4,raw&0xfffffffc,true);
   value=numberView.getFloat64(0,true);
  }
  return raw&1?value/100:value;
 };
 const result=[];
 for(const sheet of bounds.slice(0,20)){
  const rows=new Map();let offset=sheet.at;
  const set=(row,col,value)=>{
   if(row>24999||col>99||value===null||value===undefined||value==='')return;
   if(!rows.has(row))rows.set(row,[]);
   rows.get(row)[col]=value;
  };
  while(offset<bytes.length){
   const r=record(offset),v=dv(r.payload);offset=r.next;
   if(r.type===0x0a)break;
   if(r.type===0xfd&&r.payload.length>=10){
    const row=v.getUint16(0,true),col=v.getUint16(2,true),id=v.getUint32(6,true);
    set(row,col,strings[id]??'');
   }else if(r.type===0x203&&r.payload.length>=14){
    set(v.getUint16(0,true),v.getUint16(2,true),v.getFloat64(6,true));
   }else if(r.type===0x27e&&r.payload.length>=10){
    set(v.getUint16(0,true),v.getUint16(2,true),rk(v.getUint32(6,true)));
   }else if(r.type===0xbd&&r.payload.length>=12){
    const row=v.getUint16(0,true),col=v.getUint16(2,true),n=Math.floor((r.payload.length-6)/6);
    for(let i=0;i<n;i++)set(row,col+i,rk(v.getUint32(6+i*6,true)));
   }else if(r.type===0x06&&r.payload.length>=14){
    const result=v.getFloat64(6,true);
    if(Number.isFinite(result))set(v.getUint16(0,true),v.getUint16(2,true),result);
   }else if(r.type===0x204&&r.payload.length>=8){
    const row=v.getUint16(0,true),col=v.getUint16(2,true),len=v.getUint16(6,true);
    set(row,col,new TextDecoder('latin1').decode(r.payload.subarray(8,8+len)));
   }
  }
  result.push({name:sheet.name,rows:[...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([,row])=>row)});
 }
 if(!result.length)fail('XLS sem planilhas legiveis.');
 return result;
}
export function readLegacyXls(buffer){return workbookSheets(compoundWorkbook(buffer));}

// Estrutura SIURB Edificacoes: serviço A/B/H; insumos C/D/E/G.
// Coeficiente HH e aceito SOMENTE para mao de obra (codigos 1000..2999),
// nunca para horas de maquinas, materiais ou precos de referencia.
export function extractSiurbCompositions(sheet){
 const rows=sheet?.rows||[];
 const valid=rows.slice(0,12).some(row=>
  /C[ÓO]DIGO/i.test(String(row[0]??''))&&/NOME DO SERVI[CÇ]O/i.test(String(row[1]??'')));
 if(!valid)return null;
 const services=[];let current=null;
 const str=x=>String(x??'').trim();
 const num=x=>{
  if(typeof x==='number')return Number.isFinite(x)?x:null;
  const s=str(x);if(!s)return null;
  const value=Number(s.replace(',','.'));return Number.isFinite(value)?value:null;
 };
 for(const row of rows){
  const code=str(row[0]),description=str(row[1]),unit=str(row[7]);
  if(/^\d{5,15}(\.0)?$/.test(code)&&description&&unit){
   current={code:code.replace(/\.0$/,''),description:description.slice(0,180),
    unit:unit.slice(0,20),roles:[]};
   services.push(current);continue;
  }
  if(!current)continue;
  const id=num(row[2]),role=str(row[3]),ingredientUnit=str(row[4]).toUpperCase(),hh=num(row[6]);
  if(id!==null&&Number.isInteger(id)&&id>=1000&&id<3000&&role&&
     ingredientUnit==='H'&&hh!==null&&hh>0&&hh<=10000&&current.roles.length<30){
   current.roles.push({role:role.slice(0,80),hours:hh});
  }
 }
 if(!services.length)return null;
 const normalized=[['Codigo','Descricao','Unidade','Profissional','Coeficiente HH','Categoria']];
 for(const item of services){
  const base=[item.code,item.description,item.unit],category=item.code.slice(0,2);
  if(!item.roles.length){normalized.push([...base,'','',category]);continue;}
  for(const role of item.roles)normalized.push([...base,role.role,String(role.hours),category]);
 }
 return {name:'SIURB - servicos e HH (sem precos)',rows:normalized};
}
