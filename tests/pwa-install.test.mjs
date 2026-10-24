import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url));
const manifest=JSON.parse(read('manifest.json').toString('utf8'));
const html=read('index.html').toString('utf8');
const sw=read('sw.js').toString('utf8');
const script=read('assets/install-app.js').toString('utf8');
const css=read('assets/app.css').toString('utf8');
const vercel=JSON.parse(read('vercel.json').toString('utf8'));

function parsePNG(bytes){
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let at=8,ihdr,bytesIDAT=[],hasPalette=false;
 while(at<bytes.length){
  const size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);
  const body=bytes.subarray(at+8,at+8+size);
  if(type==='IHDR')ihdr={width:body.readUInt32BE(0),height:body.readUInt32BE(4),depth:body[8],type:body[9]};
  if(type==='PLTE')hasPalette=true;
  if(type==='IDAT')bytesIDAT.push(body);
  at+=12+size;
  if(type==='IEND')break;
 }
 assert.ok(ihdr);
 assert.equal(hasPalette,true);
 const data=inflateSync(Buffer.concat(bytesIDAT));
 assert.equal(data.length,(ihdr.width+1)*ihdr.height);
 return ihdr;
}

test('manifesto é instalável e preserva nome/domínio CIVOLTEN',()=>{
 assert.equal(manifest.id,'/');
 assert.equal(manifest.start_url,'/');
 assert.equal(manifest.scope,'/');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.name,'CIVOLTEN — Gestão de Obras');
 assert.equal(manifest.prefer_related_applications,false);
 assert.equal(vercel.cleanUrls,true);
 assert.match(html,/rel="manifest" href="\/manifest.json"/);
 assert.match(html,/rel="apple-touch-icon" href="\/assets\/civolten-logo.png"/);
});

test('ícones instaláveis possuem tamanhos reais de 192 e 512 pixels',()=>{
 for(const size of [192,512]){
  const file='/assets/app-icon-'+size+'.png';
  const entry=manifest.icons.find(icon=>icon.src===file);
  assert.equal(entry?.sizes,size+'x'+size);
  assert.equal(entry?.type,'image/png');
  const dimensions=parsePNG(read(file.slice(1)));
  assert.equal(dimensions.width,size);
  assert.equal(dimensions.height,size);
  assert.equal(dimensions.depth,8);
  assert.equal(dimensions.type,3);
 }
 assert.ok(manifest.icons.some(icon=>icon.src==='/assets/civolten-logo.png'));
});

test('instalação tem ação visível dentro e fora da conta',()=>{
 assert.equal((html.match(/data-install-app/g)||[]).length,2);
 assert.match(html,/data-close-install/);
 assert.match(html,/id="installHelpText"/);
 assert.match(html,/src="\/assets\/install-app.js"/);
 assert.match(script,/beforeinstallprompt/);
 assert.match(script,/deferredInstallPrompt\.prompt\(\)/);
 assert.match(script,/event\.preventDefault\(\)/);
 assert.match(script,/\/iPad\|iPhone\|iPod\//);
 assert.match(script,/Adicionar à Tela de Início/);
 assert.match(script,/Adicionar à tela inicial/);
 assert.match(script,/serviceWorker\.register\('\/sw.js',\{scope:'\/'\}\)/);
});

test('instalação não armazena dados privados e internet permanece obrigatória',()=>{
 assert.match(sw,/event\.request\.mode!=='navigate'/);
 assert.match(sw,/fetch\(event\.request\)/);
 assert.match(sw,/Sem conexão com a internet/);
 assert.match(sw,/Nenhum orçamento ou contrato foi baixado/);
 assert.doesNotMatch(sw,/caches\.|cache\.put|localStorage|indexedDB/);
 assert.doesNotMatch(script,/localStorage|indexedDB|CacheStorage/);
 assert.match(css,/display-mode:standalone/);
 assert.match(vercel.headers[0].headers.find(x=>x.key==='Cache-Control').value,/no-store/);
});

test('menu do celular continua horizontal, sem botão hambúrguer',()=>{
 assert.match(html,/<nav aria-label="Navegação">/);
 assert.doesNotMatch(html,/mobileMenuToggle|civoltenMainNav/);
 assert.match(css,/#app \.sidebar nav\{display:flex;overflow-x:auto/);
});
