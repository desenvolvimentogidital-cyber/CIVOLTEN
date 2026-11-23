import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {gunzipSync} from 'node:zlib';
import {nationalNfseConfig,nationalNfseStatus,sendSignedDps} from '../src/nfse-national-server.mjs';
const env={NFSE_ENVIRONMENT:'homologation',NFSE_CERT_PFX_BASE64:Buffer.alloc(150,1).toString('base64'),
 NFSE_CERT_PASSPHRASE:'test-only',NFSE_ISSUER_CNPJ:'12345678000199',NFSE_TRANSMISSION_ENABLED:'true'};
test('sem certificado a emissão permanece bloqueada',async()=>{
 assert.equal(nationalNfseStatus({}).certificateConfigured,false);
 await assert.rejects(()=>sendSignedDps({signedXml:'<DPS><Signature/></DPS>',environment:'homologation',env:{}}),/Certificado/);
});
test('mesmo com certificado, emissão exige habilitação explícita',async()=>{
 await assert.rejects(()=>sendSignedDps({signedXml:'<DPS><Signature/></DPS>',environment:'homologation',env:{...env,NFSE_TRANSMISSION_ENABLED:'false'}}),/desativada/);
});
test('ambiente de homologação não transmite para produção',async()=>{
 await assert.rejects(()=>sendSignedDps({signedXml:'<DPS><Signature/></DPS>',environment:'production',env}),/divergente/);
 assert.equal(nationalNfseConfig(env).host,'sefin.producaorestrita.nfse.gov.br');
});
test('DPS assinada é compactada e enviada somente ao domínio nacional permitido',async()=>{
 let opts,posted='';
 const requestImpl=(options,cb)=>{
  opts=options;
  const req=new EventEmitter();
  req.write=chunk=>{posted+=chunk};
  req.end=()=>{const res=new EventEmitter();res.statusCode=200;cb(res);queueMicrotask(()=>res.emit('end'));};
  req.destroy=error=>req.emit('error',error);
  return req;
 };
 const result=await sendSignedDps({signedXml:'<DPS><Signature/></DPS>',environment:'homologation',env,requestImpl});
 assert.equal(result.status,200);
 assert.equal(opts.hostname,'sefin.producaorestrita.nfse.gov.br');
 assert.equal(opts.path,'/API/SefinNacional/nfse');
 assert.equal(opts.rejectUnauthorized,true);
 assert.equal(gunzipSync(Buffer.from(JSON.parse(posted).dpsXmlGZipB64,'base64')).toString(),'<DPS><Signature/></DPS>');
});
