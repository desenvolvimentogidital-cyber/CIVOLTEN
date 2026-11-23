import test from 'node:test';
import assert from 'node:assert/strict';
import {printableServiceContract} from '../src/service-contract-print.mjs';
const work={contractRef:'OS-101',customer:'Cliente Teste',customerRef:{document:'00.000.000/0001-00'},project:'Obra Teste',startOn:'2026-11-23',contractValue:4250,budgetSnapshot:{items:[{description:'Instalação elétrica',quantity:10,unit:'m'}]}};
test('contrato gera minuta com escopo e valor da OS',()=>{const html=printableServiceContract(work,{name:'CIVOLTEN'});assert.match(html,/CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE OBRA CERTA/);assert.match(html,/Instalação elétrica/);assert.match(html,/4.250,00/);assert.match(html,/MINUTA PARA CONFERÊNCIA/);});
test('contrato não incorpora nomes e assinaturas do documento de referência',()=>{const html=printableServiceContract(work);assert.doesNotMatch(html,/VOULK|GARDNER DENVER|CRISTIANO APARECIDO/);});
test('contrato escapa texto inserido pelo cliente',()=>{const html=printableServiceContract({...work,customer:'<script>alert(1)</script>'});assert.doesNotMatch(html,/<script>/);});
test('contrato exige obra com preço e escopo',()=>assert.throws(()=>printableServiceContract({}),/obra aprovada/));
