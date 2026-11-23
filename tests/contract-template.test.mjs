import test from 'node:test';
import assert from 'node:assert/strict';
import {clauses,contractMissing,contractHtml} from '../src/contract-template.mjs';
test('modelo tem oito cláusulas',()=>assert.equal(clauses.length,8));
test('exige dados mínimos antes de assinatura',()=>assert.deepEqual(contractMissing({customer:'Cliente'}),['contractor','scope','place','price','startDate','durationDays']));
test('protege dados interpolados contra HTML',()=>{
 const html=contractHtml({customer:'<script>alert(1)</script>'});
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<script>'));
});
test('não contém dados pessoais do contrato de referência',()=>{
 const html=contractHtml({});
 assert.ok(!html.includes('VOULK'));
 assert.ok(!html.includes('CRISTIANO APARECIDO'));
});
