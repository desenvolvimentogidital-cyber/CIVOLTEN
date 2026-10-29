import test from 'node:test';
import assert from 'node:assert/strict';
import {validCPF,validCNPJ,validTaxId,normalizeTaxId} from '../src/documents.mjs';
import '../public/audit.js';
test('CNPJ numérico tradicional mantém validação',()=>{
 assert.equal(validCNPJ('11.222.333/0001-81'),true);
 assert.equal(validCNPJ('11.222.333/0001-82'),false);
 assert.equal(validCNPJ('00.000.000/0000-00'),false);
});
test('CNPJ alfanumérico com módulo 11 oficial Receita Federal em 2026',()=>{
 assert.equal(validCNPJ('12.ABC.345/01DE-35'),true);
 assert.equal(validCNPJ('00.000.000/E08G-12'),true);
 assert.equal(normalizeTaxId('12.abc.345/01de-35'),'12ABC34501DE35');
 assert.equal(validCNPJ('12.ABC.345/01DE-34'),false);
 assert.equal(validTaxId('12.ABC.345/01DE-35'),true);
});
test('CPF, formatação e documentos inválidos',()=>{
 assert.equal(validCPF('529.982.247-25'),true);
 assert.equal(validCPF('529.982.247-26'),false);
 assert.equal(validTaxId('sem documento'),false);
});
test('Auditoria comercial do navegador aceita CNPJ alfanumérico válido',()=>{
 const b={client_name:'Cliente CNPJ alfanumérico',client_doc:'12.ABC.345/01DE-35',project_name:'Obra Alfa',
 project_address:'Rua fictícia, 100',payment_terms:'50% inicial e 50% após medição',
 notes:'Premissas técnicas conferidas pelo fiscal responsável, exclusões de serviços não contratados.',
 bdi:25,safety_pct:15,validity_days:30,totalDays:5,finish:'2026-11-12',
 reference_month:'2026-07',summary:{cost:100,total:125,rows:[
 {description:'Serviço detalhado',unit:'m²',code:'CIV',qty:10,unit_cost:10,hh_unit:1}
 ]}};
 const company={company:'CIVOLTEN',cnpj:'11.222.333/0001-81',email:'comercial@example.com',phone:'11999999999'};
 const result=globalThis.CIVOLTEN_AUDIT(b,company);
 assert.equal(result.errors.some(x=>x.code==='client_doc'),false);
});
