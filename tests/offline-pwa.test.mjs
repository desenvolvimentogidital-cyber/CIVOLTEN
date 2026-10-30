import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeBudgetSnapshot,pendingChanges,validateOfflineQuantity,conflictsWithServer} from '../public/offline-store.js';
const id='00000000-0000-4000-8000-000000000099';
const item='00000000-0000-4000-8000-000000000011';
const ref='00000000-0000-4000-8000-000000000012';
const detail={id,code:'ORC-2026-TESTE',status:'rascunho',
 items:[{id:item,reference_price_id:ref,source_code:'10001001',source_name:'ALVENARIA',unit:'M2',
  quantity:'100',direct_unit_cost:'30.25',position:1}]};
test('Cópia offline guarda só dados mínimos dos serviços, sem clientes nem tokens',()=>{
 const s=normalizeBudgetSnapshot({...detail,client_name:'Cliente confidencial',password:'segredo',access_token:'token'});
 const str=JSON.stringify(s);
 assert.equal(s.code,detail.code);assert.equal(s.items.length,1);
 assert.doesNotMatch(str,/Cliente confidencial|segredo|token|client_name|password/);
 assert.equal(s.items[0].baseline_quantity,'100');
 assert.equal(s.items[0].reference_price_id,ref);
});
test('Modo offline é restrito a orçamentos em rascunho',()=>{
 assert.throws(()=>normalizeBudgetSnapshot({...detail,status:'aprovado'}),/rascunhos/);
});
test('Quantidade exige valor positivo e até 6 casas decimais',()=>{
 assert.equal(validateOfflineQuantity('1.234567'),'1.234567');
 for(const v of ['-1','0','NaN','Infinity','1.1234567','10000000001',''])
  assert.throws(()=>validateOfflineQuantity(v),/inválida/);
});
test('Distingue rascunho pendente de itens sem alteração',()=>{
 const s=normalizeBudgetSnapshot(detail);
 assert.equal(pendingChanges(s).length,0);
 s.items[0].quantity='110';
 assert.equal(pendingChanges(s).length,1);
});
test('Sincronização bloqueia conflito de quantitativo e preço oficial alterados online',()=>{
 const s=normalizeBudgetSnapshot(detail);s.items[0].quantity='110';
 assert.deepEqual(conflictsWithServer(s,detail),[]);
 assert.deepEqual(conflictsWithServer(s,{...detail,items:[{...detail.items[0],quantity:'120'}]}),['ALVENARIA']);
 assert.deepEqual(conflictsWithServer(s,{...detail,items:[{...detail.items[0],direct_unit_cost:'30.30'}]}),['ALVENARIA']);
 assert.deepEqual(conflictsWithServer(s,{...detail,items:[]}),['ALVENARIA']);
});
test('PWA não cacheia login, sessão, API nem dados comerciais',()=>{
 const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 const secure=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../public/offline.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/secure.html',import.meta.url),'utf8');
 assert.equal(manifest.start_url,'/secure.html');assert.equal(manifest.display,'standalone');
 assert.equal(manifest.icons.length>=2,true);
 assert.match(sw,/u\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/req\.method!=='GET'/);
 assert.doesNotMatch(sw,/caches\.put.*api\/v1/);
 assert.match(sw,/offline\.html/);assert.match(sw,/offline\.css/);
 assert.match(html,/manifest\.webmanifest/);assert.match(html,/pwa-init\.js/);
 assert.match(secure,/saveBudgetForOffline/);
 assert.match(secure,/syncOfflineBudget/);
 assert.match(secure,/window\.confirm\('Sincronizar/);
 assert.match(offline,/putOfflineDraft/);
 assert.match(offline,/removeOfflineDraft/);
});
