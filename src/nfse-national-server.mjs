// CIVOLTEN: adaptador servidor para a SEFIN Nacional.
// Sem certificado, nenhuma transmissão é permitida. Nunca importar no frontend.
import https from 'node:https';
import {Buffer} from 'node:buffer';

const HOSTS=Object.freeze({
 homologation:'sefin.producaorestrita.nfse.gov.br',
 production:'sefin.nfse.gov.br'
});
export function nationalNfseConfig(env=process.env){
 const environment=env.NFSE_ENVIRONMENT==='production'?'production':'homologation';
 const pfx=env.NFSE_CERT_PFX_BASE64||'';
 const passphrase=env.NFSE_CERT_PASSPHRASE||'';
 const configured=Boolean(pfx&&passphrase&&env.NFSE_ISSUER_CNPJ);
 return {environment,configured,issuerCnpj:env.NFSE_ISSUER_CNPJ||null,
  host:HOSTS[environment],transmissionEnabled:env.NFSE_TRANSMISSION_ENABLED==='true'&&configured};
}
export function assertNfseTransmission(config){
 if(!config?.configured)throw new Error('Certificado digital e CNPJ do emitente não configurados no servidor.');
 if(!config.transmissionEnabled)throw new Error('Transmissão fiscal desativada até homologação e autorização explícita.');
 if(!HOSTS[config.environment]||config.host!==HOSTS[config.environment])throw new Error('Destino fiscal não autorizado.');
}
function requestNational({host,path,method,pfx,passphrase,body,timeoutMs=20000},requestImpl=https.request){
 return new Promise((resolve,reject)=>{
  let req;
  try{
   req=requestImpl({hostname:host,port:443,path,method,pfx,passphrase,
    rejectUnauthorized:true,timeout:timeoutMs,headers:{
     accept:'application/json',...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{})
    }},res=>{
     const chunks=[];let size=0;
     res.on('data',chunk=>{size+=chunk.length;if(size>2_000_000){req.destroy(new Error('Resposta fiscal excede o limite.'));return;}chunks.push(chunk);});
     res.on('error',reject);
     res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
    });
   req.on('error',reject);
   req.on('timeout',()=>req.destroy(new Error('Tempo limite da API Nacional excedido.')));
   if(body)req.write(body);
   req.end();
  }catch(error){reject(error);}
 });
}
export async function sendSignedDps({signedXml,environment,env=process.env,requestImpl}={}){
 const config=nationalNfseConfig(env);
 assertNfseTransmission(config);
 if(environment!==config.environment)throw new Error('Ambiente fiscal divergente.');
 if(typeof signedXml!=='string'||signedXml.length>500_000||!signedXml.includes('<DPS')||!signedXml.includes('Signature'))
  throw new Error('DPS XML assinada é obrigatória.');
 const pfx=Buffer.from(env.NFSE_CERT_PFX_BASE64,'base64');
 if(pfx.length<100)throw new Error('Certificado digital inválido ou incompleto.');
 // A SEFIN recebe o XML da DPS em JSON, compactado e codificado em Base64 GZip.
 // O empacotamento é feito aqui para evitar formatos distintos no cliente.
 const {gzipSync}=await import('node:zlib');
 const body=JSON.stringify({dpsXmlGZipB64:gzipSync(Buffer.from(signedXml,'utf8')).toString('base64')});
 return requestNational({host:config.host,path:config.environment==='homologation'?'/API/SefinNacional/nfse':'/SefinNacional/nfse',method:'POST',
  pfx,passphrase:env.NFSE_CERT_PASSPHRASE,body},requestImpl);
}
export function nationalNfseStatus(env=process.env){
 const c=nationalNfseConfig(env);
 return {provider:'SEFIN Nacional',environment:c.environment,certificateConfigured:c.configured,
  transmissionEnabled:c.transmissionEnabled,readyForRealEmission:c.transmissionEnabled&&c.environment==='production'};
}
