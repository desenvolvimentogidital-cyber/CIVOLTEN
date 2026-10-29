import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSiurbComposition} from '../src/siurb-composition-audit.mjs';

const root=()=>({
 code:'S-01',version_id:'version-a',unit:'M2',direct_hh_per_unit:'0.0098',
 labor:[{code:'2099',name:'SERVENTE',unit:'H',coef:0.0098}],
 other:[{code:'94061',name:'TRATOR',unit:'H',coef:0.0049}]
});
test('SIURB: não atribuir preço fictício nem transformar hora de equipamento em hora-homem',async()=>{
 const result=await inspectSiurbComposition({root:root(),lookup:async()=>null});
 assert.equal(result.direct_hh_per_unit,'0.0098');
 assert.equal(result.nodes.length,2);
 assert.equal(result.nodes[0].kind,'mao_de_obra');
 assert.equal(result.nodes[1].kind,'insumo_ou_auxiliar');
 assert.equal(result.nodes[1].status,'insumo_sem_preco_oficial_carregado');
 assert.equal(result.fully_priced,false);
 assert.equal(result.commercially_verified,false);
});
test('SIURB: expansão recursiva limitada à versão canônica',async()=>{
 const calls=[];
 const lookup=async(code,version)=>{
  calls.push([code,version]);
  if(code!=='A1'||version!=='version-a')return null;
  return {id:'aux1',code:'A1',unit:'UN',unit_cost:'12.00',
    labor:[],other:[{code:'B1',name:'Insumo não cotado',unit:'KG',coef:'2'}]};
 };
 const data=root();data.labor=[];data.other=[{code:'A1',unit:'UN',coef:'3'}];
 const result=await inspectSiurbComposition({root:data,lookup});
 assert.equal(result.nodes.length,2);
 assert.equal(result.nodes[0].status,'auxiliar_expandido_para_auditoria');
 assert.equal(result.nodes[1].status,'insumo_sem_preco_oficial_carregado');
 assert.deepEqual(calls,[['A1','version-a'],['B1','version-a']]);
 assert.equal(result.fully_priced,false);
});
test('SIURB: bloquear ciclos, inconsistência de unidade e coeficiente inválido',async()=>{
 const data=root();data.labor=[];data.other=[
  {code:'A1',unit:'UN',coef:1},{code:'D',unit:'M2',coef:1},{code:'X',unit:'H',coef:-1}
 ];
 const lookup=async code => code==='A1'
  ?{id:'aux1',unit:'UN',unit_cost:'1',labor:[],other:[{code:'A1',unit:'UN',coef:1}]}
  : code==='D'?{id:'d',unit:'M3',unit_cost:'1',labor:[],other:[]}:null;
 const result=await inspectSiurbComposition({root:data,lookup});
 assert.ok(result.issues.some(x=>x.type==='ciclo_de_composicao'));
 assert.ok(result.issues.some(x=>x.type==='unidade_incompativel'));
 assert.ok(result.issues.some(x=>x.type==='coeficiente_ou_unidade_invalida'));
 assert.equal(result.commercially_verified,false);
});
test('SIURB: ficha ausente e limite de nós falham de forma segura',async()=>{
 const missing=await inspectSiurbComposition({root:{code:'sem-ficha'},lookup:async()=>null});
 assert.equal(missing.status,'sem_ficha');
 assert.equal(missing.fully_priced,false);
 const bounded=await inspectSiurbComposition({root:root(),lookup:async()=>null,maxNodes:1});
 assert.equal(bounded.limited,true);
 assert.equal(bounded.nodes.length,1);
});
