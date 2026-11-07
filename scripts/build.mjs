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
  __CIVOLTEN_SUPABASE_URL__:JSON.stringify(process.env.SUPABASE_URL||'https://rvhnuowqfdugcecgmxnv.supabase.co'),
  // Publishable key: intended to be public in browser clients. Never use service_role!
  __CIVOLTEN_SUPABASE_PUBLISHABLE_KEY__:JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY||"sb_publishable_UpkP7prNZFMBacZw31SuRg_8E-ea3TP"),
  __CIVOLTEN_E2E__:JSON.stringify(process.env.CIVOLTEN_E2E==='true')
 }
});
console.log('CIVOLTEN premium: build concluído com Supabase Auth e banco RLS.');
