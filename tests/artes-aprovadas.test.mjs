import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,root),'utf8');

test('sete artes aprovadas realmente estão versionadas e são PNGs',()=>{
 for(const name of ['hero','background','eletrica','alvenaria','reforma','pintura','drywall']){
  const file=new URL('assets/images/'+name+'.png',root);
  const bytes=fs.readFileSync(file);
  assert.ok(bytes.length>3000&&bytes.length<3000000,name+' fora do tamanho esperado');
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],name+' não é PNG');
 }
});
test('telas públicas usam as artes locais e oferecem fallback, sem ofertas fora do escopo',()=>{
 const home=read('index.html'),catalog=read('servicos.html');
 assert.match(home,/assets\/images\/hero\.png/);
 assert.match(home,/assets\/images\/eletrica\.png/);
 assert.match(home,/assets\/images\/alvenaria\.png/);
 assert.match(home,/assets\/images\/pintura\.png/);
 assert.match(home,/assets\/images\/drywall\.png/);
 assert.match(home,/assets\/images\/reforma\.png/);
 assert.match(home,/assets\/civolten-app-unificado\.css/);
 assert.match(home,/assets\/civolten-assets\.js/);
 assert.match(catalog,/assets\/images\/hero\.png/);
 assert.doesNotMatch(catalog,/Automa[cç][aã]o residencial|Sistemas de seguran[cç]a/);
 assert.match(read('assets/servicos.css'),/assets\/images\/background\.png/);
});
test('identidade visual usa endpoint público de mesma origem e preserva logo configurada',()=>{
 const branding=read('assets/site-branding.js');
 const api=read('api/site-branding.mjs');
 assert.match(branding,/PUBLIC_API = '\/api\/site-branding'/);
 assert.match(branding,/branding\.logo_data_url/);
 for(const id of ['siteLogo','adminNavLogo','previewSiteLogo','previewPdfLogo','footerLogo'])assert.match(branding,new RegExp(id));
 assert.doesNotMatch(branding,/innerHTML|localStorage|sessionStorage/);
 assert.match(api,/method !== 'GET'/);
 assert.match(api,/no-store/);
 new vm.Script(branding);
 new vm.Script(read('assets/civolten-assets.js'));
});
