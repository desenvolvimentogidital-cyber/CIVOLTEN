import test from 'node:test';
import assert from 'node:assert/strict';
import {nfseEmissionReadiness} from '../src/nfse-emission-readiness.mjs';
import {nfseNewDraft} from '../src/nfse-ui.mjs';

test('fase 5: rascunho não permite emissão real sem servidor fiscal',()=>{
 const status=nfseEmissionReadiness(nfseNewDraft(),{});
 assert.equal(status.ready,false);
 assert.match(status.blockers.join(' '),/emissor fiscal no servidor/);
 assert.match(status.blockers.join(' '),/Credenciais fiscais/);
});
test('fase 5: flags parciais nunca liberam emissão',()=>{
 const status=nfseEmissionReadiness({},{
  mode:'server',credentialsVerified:true,municipalitySupported:true,
  environment:'production',authorized:false
 });
 assert.equal(status.ready,false);
 assert.match(status.blockers.join(' '),/Autorização do prestador/);
});
