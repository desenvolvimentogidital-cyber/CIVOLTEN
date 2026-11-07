import {mkdir,rm,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const dest='dist';
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
for(const file of ['index.html','manifest.webmanifest','sw.js'])
 await copyFile(file,path.join(dest,file));
await copyFile('src/styles.css',path.join(dest,'styles.css'));
await cp('assets',path.join(dest,'assets'),{recursive:true});
await build({
 entryPoints:['src/main.mjs'],outfile:path.join(dest,'app.js'),
 bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,
 define:{
  __CIVOLTEN_AUTH_URL__:JSON.stringify(process.env.NEON_AUTH_BASE_URL||''),
  __CIVOLTEN_E2E__:JSON.stringify(process.env.CIVOLTEN_E2E==='true')
 }
});
console.log('CIVOLTEN premium: build concluído. Neon Auth configurado:',Boolean(process.env.NEON_AUTH_BASE_URL));
