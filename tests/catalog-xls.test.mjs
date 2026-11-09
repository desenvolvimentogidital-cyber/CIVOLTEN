import test from 'node:test';
import assert from 'node:assert/strict';
import {readLegacyXls,extractSiurbCompositions} from '../src/catalog-xls.mjs';
import {readCatalogFile,suggestColumns,buildCatalogImport} from '../src/catalog-import.mjs';

// Gera um XLS binario sintetico Excel 97-2003, sem dados de clientes.
function makeXlsFixture(){
 const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;};
 const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
 const rec=(type,payload=Buffer.alloc(0))=>Buffer.concat([u16(type),u16(payload.length),payload]);
 const num=(row,col,val)=>{
  const b=Buffer.alloc(14);b.writeUInt16LE(row,0);b.writeUInt16LE(col,2);b.writeDoubleLE(val,6);
  return rec(0x203,b);
 };
 const label=(row,col,id)=>{
  const b=Buffer.alloc(10);b.writeUInt16LE(row,0);b.writeUInt16LE(col,2);b.writeUInt32LE(id,6);
  return rec(0xfd,b);
 };
 const strings=['CÓDIGO','NOME DO SERVIÇO','UNID','LIMPEZA DO TERRENO',
  'M2','SERVENTE (SGSP)','H','TRATOR DE ESTEIRAS','PINTURA'];
 const sst=rec(0xfc,Buffer.concat([
  u32(11),u32(strings.length),
  ...strings.map(x=>Buffer.concat([u16(x.length),Buffer.from([1]),Buffer.from(x,'utf16le')]))
 ]));
 const bof=rec(0x809,Buffer.alloc(16)),eof=rec(0x0a);
 const sheet=Buffer.concat([bof,
  label(0,0,0),label(0,1,1),label(0,7,2),
  num(1,0,1001001),label(1,1,3),label(1,7,4),
  num(2,2,2099),label(2,3,5),label(2,4,6),num(2,6,0.5),
  num(3,2,94061),label(3,3,7),label(3,4,6),num(3,6,0.12),
  num(4,0,1001002),label(4,1,8),label(4,7,4),
  num(5,2,2099),label(5,3,5),label(5,4,6),num(5,6,0.75),
  eof
 ]);
 const name=Buffer.from('Composicoes');
 const bound=Buffer.alloc(8+name.length);
 bound[6]=name.length;name.copy(bound,8);
 let globals=Buffer.concat([bof,rec(0x85,bound),sst,eof]);
 bound.writeUInt32LE(globals.length,0);
 const workbook=Buffer.concat([bof,rec(0x85,bound),sst,eof,sheet]);
 const wbSize=4096;
 if(workbook.length>wbSize)throw Error('Fixture XLS ultrapassou os setores.');
 const header=Buffer.alloc(512);
 Buffer.from('d0cf11e0a1b11ae1','hex').copy(header);
 header.writeUInt16LE(0x3e,24);header.writeUInt16LE(3,26);
 header.writeUInt16LE(0xfffe,28);header.writeUInt16LE(9,30);header.writeUInt16LE(6,32);
 header.writeUInt32LE(1,44);header.writeUInt32LE(1,48);
 header.writeUInt32LE(4096,56);header.writeUInt32LE(0xfffffffe,60);
 header.writeUInt32LE(0xfffffffe,68);header.writeUInt32LE(0,76);
 for(let i=1;i<109;i++)header.writeUInt32LE(0xffffffff,76+i*4);
 const fat=Buffer.alloc(512);
 for(let i=0;i<128;i++)fat.writeUInt32LE(0xffffffff,i*4);
 fat.writeUInt32LE(0xfffffffd,0);fat.writeUInt32LE(0xfffffffe,4);
 for(let i=2;i<10;i++)fat.writeUInt32LE(i===9?0xfffffffe:i+1,i*4);
 const dir=Buffer.alloc(512);
 const entry=(index,label,type,start,size)=>{
  const offset=index*128,value=Buffer.from(label+'\0','utf16le');
  value.copy(dir,offset);dir.writeUInt16LE(value.length,offset+64);
  dir[offset+66]=type;dir.writeUInt32LE(start>>>0,offset+116);
  dir.writeUInt32LE(size,offset+120);
 };
 entry(0,'Root Entry',5,0xfffffffe,0);
 entry(1,'Workbook',2,2,4096);
 return Buffer.concat([header,fat,dir,workbook,Buffer.alloc(wbSize-workbook.length)]);
}

test('BIFF8 XLS: extrai composicoes oficiais e exclui horas de maquinas',async()=>{
 const fixture=makeXlsFixture();
 const raw=fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.byteLength);
 const sheets=readLegacyXls(raw);
 assert.equal(sheets.length,1);
 assert.equal(sheets[0].rows[1][0],1001001);
 assert.equal(sheets[0].rows[3][3],'TRATOR DE ESTEIRAS');
 const sheet=extractSiurbCompositions(sheets[0]);
 assert.equal(sheet.rows.length,3);
 assert.equal(sheet.rows[1][3],'SERVENTE (SGSP)');
 assert.equal(sheet.rows[1][4],'0.5');
 assert.equal(sheet.rows[2][4],'0.75');
 const file=new File([fixture],'SIURB_EDIF_JUL26.xls',{type:'application/vnd.ms-excel'});
 const importSheets=await readCatalogFile(file);
 const mapping=suggestColumns(importSheets[0].rows);
 assert.deepEqual([mapping.code,mapping.description,mapping.unit,mapping.role,mapping.hours],[0,1,2,3,4]);
 const result=buildCatalogImport(importSheets[0].rows,{source:'siurb',month:'2026-07',mapping});
 assert.equal(result.items.length,2);
 assert.equal(result.items[0].code,'SIURB:1001001');
 assert.equal(result.items[0].roles[0].hours,0.5);
 assert.equal(result.items[0].directCost,null,'Preco oficial nao deve entrar na CIVOLTEN');
 assert.equal(result.items[1].roles[0].hours,0.75);
});

test('XLS invalido retorna erro claro e nao aceita execucao de arquivos arbitrarios',()=>{
 assert.throws(()=>readLegacyXls(new ArrayBuffer(400)),/Excel 97-2003/);
 assert.equal(extractSiurbCompositions({name:'Outro formato',rows:[['id','nome']]}),null);
});
