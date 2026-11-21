import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNfseRequest,nfseActivationReadiness,nfseTransition} from '../src/nfse-integration.mjs';
import {nfseNewDraft} from '../src/nfse-ui.mjs';

const valid=()=>({...nfseNewDraft({companyName:'Empresa',taxRegime:'mei'}),
 issuerCnpj:'67.138.121/0001-75',clientCnpj:'71.731.707/0001-16',
 clientName:'Cliente',description:'Serviço',amount:'1234,56',cep:'11060-300',
 street:'Rua Teste',number:'10',city:'Santos',uf:'SP',serviceCity:'Santos/SP',
 serviceCode:'07.02.02',nbs:'1.0106.11.00',issRetention:'nao',ibsCbs:'nao'});
test('prepara snapshot fiscal mínimo e não vaza segredos',()=>{
 const d={...valid(),certificate:'SEGREDO',password:'SENHA',apiKey:'CHAVE'};
 const payload=prepareNfseRequest(d);
 assert.equal(payload.service.amountCents,123456);
 assert.equal(payload.issuer.regime,'mei');
 assert.equal(payload.recipient.document,'71731707000116');
 assert.ok(!JSON.stringify(payload).includes('SEGREDO'));
 assert.ok(!JSON.stringify(payload).includes('SENHA'));
 assert.ok(!JSON.stringify(payload).includes('CHAVE'));
});
test('não prepara dados fiscais incompletos ou valor inválido',()=>{
 assert.throws(()=>prepareNfseRequest({...valid(),serviceCode:''}),/Revise/);
 assert.throws(()=>prepareNfseRequest({...valid(),amount:'1e6'}),/monetário/);
});
test('bloqueia emissão até todas as verificações serem confirmadas',()=>{
 const status=nfseActivationReadiness();
 assert.equal(status.ready,false);
 assert.equal(status.missing.length,6);
 assert.throws(()=>nfseTransition('ready','submit',{}),/bloqueada/);
 const config=Object.fromEntries(status.missing.map(k=>[k,true]));
 assert.equal(nfseTransition('ready','submit',config),'submitting');
});
test('timeout não autoriza nota e não permite reenviar sem reconciliação',()=>{
 assert.equal(nfseTransition('submitting','timeout'),'unknown');
 assert.throws(()=>nfseTransition('unknown','submit'),/não permitida/);
 assert.throws(()=>nfseTransition('unknown','reconcileAuthorized',{}),/confirmação oficial/);
 assert.equal(nfseTransition('unknown','reconcileAuthorized',
  {accessKey:'1'.repeat(50),officialConfirmation:true}),'authorized');
 assert.throws(()=>nfseTransition('authorized','cancel'),/confirmação oficial/);
});
