'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const integrity=require('../reference-integrity-core.js');
function parser(){
 const win={XLSX:{utils:{sheet_to_json:s=>s.rows}}},ctx={window:win,console};
 vm.runInNewContext(read('sinapi-reference-parser.js'),ctx);
 return win.CIVOLTENReferenceParser;
}
const options={uf:'SP',base:'2026-07',regime:'onerada',kind:'composicoes'};
const rows=(base='07/2026')=>{
 const a=Array.from({length:12},()=>[]);
 a[2][1]=base;a[5][4]='SP';
 a[10]=['', '999001','ALVENARIA DE BLOCOS CERAMICOS','M2',148.35];
 return a;
};
test('CSD isolado produz referência de preço com base oficial, sem inventar composição',()=>{
 const p=parser(),result=p.parse({Sheets:{CSD:{'!ref':'A1:E12',rows:rows()}}},options,'CSD-SP.xlsx');
 assert.equal(result.items.length,0);assert.equal(result.priceRows.length,1);
 assert.equal(result.priceRows[0].base,'2026-07');assert.equal(result.priceRows[0].cost,148.35);
 assert.equal(result.priceRows[0].uf,'SP');
});
test('analítico separado mantém horas e se completa pelo preço CSD',()=>{
 const p=parser(),a=Array.from({length:12},()=>[]);
 a[1][0]='RELATORIO ANALITICO DE COMPOSICOES';
 a[2][1]='07/2026';a[5][1]='CODIGO DA COMPOSICAO';a[5][6]='COEFICIENTE';
 a[10]=['','999001','','','ALVENARIA DE BLOCOS CERAMICOS','M2',''];
 a[11]=['','999001','COMPOSICAO','88309','PEDREIRO COM ENCARGOS COMPLEMENTARES','H',1.2,''];
 const analytic=p.parse({Sheets:{Analítico:{'!ref':'A1:H12',rows:a}}},options,'Analitico.xlsx').items;
 assert.equal(analytic.length,1);assert.equal(analytic[0].analyticLabor[0].hoursPerUnit,1.2);
 assert.equal(analytic[0].cost,null);
 const cost=p.parse({Sheets:{CSD:{'!ref':'A1:E12',rows:rows()}}},options,'CSD.xlsx').priceRows;
 const merged=integrity.enrich(analytic,cost);
 assert.equal(merged.recovered,1);assert.equal(merged.items[0].cost,148.35);
 assert.equal(merged.items[0].laborHoursPerUnit,1.2);
});
test('SIURB conserva alvenaria sem preço, sem transformar vazio em zero',()=>{
 const ctx={db:{siurbItems:[],siurbMeta:{base:'07/2026',regime:'onerada'}},
  window:{},ROUTES:{services:()=>''},s:{page:'home'},
  document:{addEventListener:()=>{}},console,esc:v=>String(v),cash:v=>String(v)};
 vm.runInNewContext(read('siurb.js')+'\n;globalThis.testSIURB=parseSIURBRows;',ctx);
 const a=ctx.testSIURB([
  ['Código','Descrição','Unidade','Custo unitário'],
  ['10.007.069','ALVENARIA BLOCO CERAMICO','M2',''],
  ['10.007.070','ALVENARIA DE VEDAÇÃO','M2','184,25']
 ],'EDIF');
 assert.equal(a.length,2);
 assert.equal(a.find(x=>x.code==='10-007-069').cost,null);
 assert.equal(a.find(x=>x.code==='10-007-070').cost,184.25);
});
test('SIURB com dois preços conflitantes não escolhe um custo silenciosamente',()=>{
 const ctx={db:{siurbItems:[],siurbMeta:{}},window:{},ROUTES:{services:()=>''},s:{page:'home'},
  document:{addEventListener:()=>{}},console,esc:v=>String(v),cash:v=>String(v)};
 vm.runInNewContext(read('siurb.js')+'\n;globalThis.testSIURB=parseSIURBRows;',ctx);
 const a=ctx.testSIURB([['Código','Descrição','Unidade','Custo'],
  ['10.007.069','ALVENARIA BLOCO CERAMICO','M2','180,00'],
  ['10.007.069','ALVENARIA BLOCO CERAMICO','M2','210,00']], 'EDIF');
 assert.equal(a.length,1);assert.equal(a[0].cost,null);assert.equal(a[0].priceStatus,'conflict');
});
