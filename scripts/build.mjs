import {rm,cp,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
// A publicação nova só contém o frontend autorizado; scripts e telas antigas
// permanecem recuperáveis exclusivamente no Git, nunca no build estático.
const out='dist';
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of ['index.html','auth-screen.js','sw.js','manifest.webmanifest']){
 await copyFile(file,path.join(out,file));
}
for(const folder of ['assets','icons','core']){
 await cp(folder,path.join(out,folder),{recursive:true});
}
await build({
 entryPoints:['client/login.mjs'],outfile:path.join(out,'login.js'),
 bundle:true,platform:'browser',format:'iife',target:['es2022'],minify:true,
 define:{
  __CIVOLTEN_NEON_AUTH_URL__:JSON.stringify(process.env.NEON_AUTH_BASE_URL||''),
  __CIVOLTEN_BROWSER_TEST_MODE__:JSON.stringify(process.env.CIVOLTEN_BROWSER_TEST_MODE==='true')
 }
});
console.log('CIVOLTEN: versão limpa compilada. Login Neon disponível:',Boolean(process.env.NEON_AUTH_BASE_URL));
