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
 let at=8,ihdr,bytesIDAT=[];
 while(at<bytes.length){
  const size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);
  const body=bytes.subarray(at+8,at+8+size);
  if(type==='IHDR')ihdr={width:body.readUInt32BE(0),height:body.readUInt32BE(4),depth:body[8],type:body[9]};
  if(type==='IDAT')bytesIDAT.push(body);
  at+=12+size;
  if(type==='IEND')break;
 }
 assert.ok(ihdr);
 const data=inflateSync(Buffer.concat(bytesIDAT));
 assert.equal(data.length,(ihdr.width*(ihdr.type===6?4:1)+1)*ihdr.height);
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
 assert.match(html,/rel="manifest" href="\/manifest.json\?v=logo-escuro-v3"/);
 assert.match(html,/rel="apple-touch-icon" sizes="192x192" href="\/assets\/civolten-escuro-v3-192.png"/);
});

test('ícones instaláveis possuem tamanhos reais de 192 e 512 pixels',()=>{
 for(const size of [192,512]){
  const file='/assets/civolten-escuro-v3-'+size+'.png';
  const entry=manifest.icons.find(icon=>icon.src===file);
  assert.equal(entry?.sizes,size+'x'+size);
  assert.equal(entry?.type,'image/png');
  const dimensions=parsePNG(read(file.slice(1)));
  assert.equal(dimensions.width,size);
  assert.equal(dimensions.height,size);
  assert.equal(dimensions.depth,8);
  assert.equal(dimensions.type,6);
 }
 assert.ok(manifest.icons.some(icon=>icon.src==='/assets/civolten-escuro-v3-maskable-512.png'&&icon.purpose==='maskable'));
 assert.doesNotMatch(html,/href="\/assets\/civolten-app-logo-192.png"/);
});


function pixelsPNG(bytes){
 const info=parsePNG(bytes);
 assert.equal(info.depth,8);
 assert.equal(info.type,6);
 let p=8,parts=[];
 while(p<bytes.length){
  const n=bytes.readUInt32BE(p);
  const type=bytes.toString('ascii',p+4,p+8);
  if(type==='IDAT')parts.push(bytes.subarray(p+8,p+8+n));
  p+=12+n;
  if(type==='IEND')break;
 }
 const decoded=inflateSync(Buffer.concat(parts)),width=info.width,height=info.height;
 const stride=width*4,out=Buffer.alloc(width*height*4);
 assert.equal(decoded.length,(stride+1)*height);
 for(let y=0;y<height;y++){
  const inputOffset=y*(stride+1)+1,outputOffset=y*stride,filter=decoded[inputOffset-1];
  assert.ok(filter>=0&&filter<=4);
  for(let x=0;x<stride;x++){
   const left=x>=4?out[outputOffset+x-4]:0;
   const above=y?out[outputOffset+x-stride]:0;
   const diagonal=y&&x>=4?out[outputOffset+x-stride-4]:0;
   let predicted=0;
   if(filter===1)predicted=left;
   else if(filter===2)predicted=above;
   else if(filter===3)predicted=(left+above)>>1;
   else if(filter===4){
    const p=left+above-diagonal;
    const a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-diagonal);
    predicted=a<=b&&a<=c?left:b<=c?above:diagonal;
   }
   out[outputOffset+x]=(decoded[inputOffset+x]+predicted)&255;
  }
 }
 return {width,height,data:out};
}

test('ícones usam fundo azul-marinho opaco com a logo original centralizada',()=>{
 const original=pixelsPNG(read('assets/civolten-logo.png'));
 assert.equal(original.width,1254);
 assert.equal(original.height,1254);
 for(const [size,scale,file] of [
  [192,.82,'assets/civolten-escuro-v3-192.png'],
  [512,.82,'assets/civolten-escuro-v3-512.png'],
  [512,.69,'assets/civolten-escuro-v3-maskable-512.png']
 ]){
  const icon=pixelsPNG(read(file));
  assert.equal(icon.width,size);
  assert.equal(icon.height,size);
  assert.deepEqual([...icon.data.subarray(0,4)],[8,24,43,255]);
  const coords=[[.25,.25],[.5,.5],[.6,.35],[.72,.72]];
  for(const [x,y] of coords){
   const px=Math.floor(size*x),py=Math.floor(size*y);
   const ox=(px+.5-size/2)*original.width/(size*scale)+original.width/2-.5;
   const oy=(py+.5-size/2)*original.height/(size*scale)+original.height/2-.5;
   const ix=Math.floor(ox),iy=Math.floor(oy),jx=Math.min(original.width-1,ix+1),jy=Math.min(original.height-1,iy+1);
   const wx=ox-ix,wy=oy-iy;
   let alpha=0,rgb=[0,0,0];
   for(const [cx,cy,weight] of [
    [ix,iy,(1-wx)*(1-wy)],[jx,iy,wx*(1-wy)],
    [ix,jy,(1-wx)*wy],[jx,jy,wx*wy]
   ]){
    if(cx<0||cy<0||cx>=original.width||cy>=original.height)continue;
    const off=(cy*original.width+cx)*4, opacity=original.data[off+3]/255;
    alpha+=opacity*weight;
    for(let c=0;c<3;c++)rgb[c]+=original.data[off+c]*opacity*weight;
   }
   const got=(py*size+px)*4;
   for(let c=0;c<3;c++){
    const expect=Math.round(rgb[c]+[8,24,43][c]*(1-alpha));
    assert.ok(Math.abs(icon.data[got+c]-expect)<=2,
     'color should retain official logo over dark background: '+size+' '+file+' '+px+','+py+' channel '+c);
   }
   assert.equal(icon.data[got+3],255);
  }
 }
});

test('instalação tem ação visível dentro e fora da conta',()=>{
 assert.equal((html.match(/data-install-app/g)||[]).length,2);
 assert.match(html,/data-close-install/);
 assert.match(html,/id="installHelpText"/);
 assert.match(html,/src="\/assets\/install-app.js"/);
 assert.match(script,/beforeinstallprompt/);
 assert.match(script,/await prompt\.prompt\(\)/);
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
