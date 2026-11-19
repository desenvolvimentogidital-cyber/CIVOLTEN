import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMaterial,validateSupplier,validateMovement,stockStatus,applyMovement} from '../src/materials.mjs';
test('valida material e estoque mínimo',()=>{
 assert.deepEqual(validateMaterial({name:' Cabo 2,5 mm ',unit:'m',minStock:'10'}),{id:null,name:'Cabo 2,5 mm',category:'',unit:'m',minStock:10,active:true});
 assert.throws(()=>validateMaterial({name:'',minStock:0}),/nome/);
 assert.throws(()=>validateMaterial({name:'Cabo',minStock:-1}),/mínimo/);
});
test('valida fornecedor e documento opcional',()=>{
 assert.equal(validateSupplier({name:'Fornecedor A'}).document,'');
 assert.equal(validateSupplier({name:'Fornecedor A',document:'529.982.247-25'}).document,'52998224725');
 assert.equal(validateSupplier({name:'Fornecedor A',document:'11.222.333/0001-81'}).document,'11222333000181');
 assert.throws(()=>validateSupplier({name:'Fornecedor A',document:'123'}),/CPF\/CNPJ/);
});
test('entrada, saída, perda, devolução e ajuste calculam saldo corretamente',()=>{
 const material={id:'m1',stock:10,averageCost:5};
 const entry=validateMovement({type:'purchase',quantity:'4',unitCost:'7.50'},material);
 assert.equal(entry.delta,4);
 const stocked=applyMovement(material,entry);
 assert.equal(stocked.stock,14);
 assert.equal(stocked.averageCost,5.7143);
 assert.equal(applyMovement(stocked,{delta:-3}).stock,11);
 assert.equal(validateMovement({type:'loss',quantity:2},stocked).delta,-2);
 assert.equal(validateMovement({type:'return',quantity:1},stocked).delta,1);
 assert.equal(validateMovement({type:'adjustment',quantity:6},stocked).delta,-8);
 assert.throws(()=>validateMovement({type:'adjustment',quantity:14},stocked),/já corresponde/);
});
test('bloqueia saída maior que saldo e custo inválido',()=>{
 const material={id:'m1',stock:2,averageCost:3};
 assert.throws(()=>validateMovement({type:'exit',quantity:3},material),/insuficiente/);
 assert.throws(()=>validateMovement({type:'purchase',quantity:1,unitCost:''},material),/custo unitário/);
 assert.throws(()=>applyMovement(material,{delta:-3}),/negativo/);
});
test('alerta estoque mínimo e calcula valor estimado',()=>{
 assert.deepEqual(stockStatus({stock:2,minStock:3,averageCost:4}),{stock:2,min:3,belowMinimum:true,empty:false,inventoryValue:8});
});
