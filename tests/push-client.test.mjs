import test from 'node:test';
import assert from 'node:assert/strict';
import {newSiteLeadCount,newSiteLeadIds} from '../src/push-client.mjs';

test('contagem só considera solicitações novas',()=>{
 assert.equal(newSiteLeadCount([{id:'1',status:'novo'},{id:'2',status:'em_contato'},{id:'3',status:'novo'}]),2);
 assert.equal(newSiteLeadCount([]),0);
 assert.equal(newSiteLeadCount(null),0);
});
test('detecta somente novos identificadores com status novo',()=>{
 const old=[{id:'a',status:'novo'},{id:'b',status:'em_contato'}];
 const after=[{id:'a',status:'novo'},{id:'b',status:'novo'},{id:'c',status:'novo'},{id:'d',status:'arquivado'}];
 assert.deepEqual(newSiteLeadIds(old,after),['c']);
});
