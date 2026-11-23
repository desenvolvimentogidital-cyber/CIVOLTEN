import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposalReference} from '../src/budget-document-guard.mjs';
const html=readFileSync(new URL('../contrato.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/budget-ui.mjs',import.meta.url),'utf8');
test('contract uses CIVOLTEN visual identity in editor and PDF',()=>{
 assert.match(html,/class="form-brand"/);
 assert.match(html,/civolten-logo\.png/);
 assert.match(html,/brand-watermark/);
 assert.match(html,/@media print/);
});
test('contract number is automatic and proposal is passed from budget',()=>{
 assert.doesNotMatch(html,/id="proposta"/);
 assert.match(html,/contractNumber='CT-'/);
 assert.match(html,/URLSearchParams\(location.search\)/);
 assert.match(ui,/encodeURIComponent\(proposalReference\(draft\)\)/);
 assert.equal(proposalReference({id:'12345678-1234-1234-1234-123456789abc',createdAt:'2026-11-23'}),'PC-2026-12345678');
});
