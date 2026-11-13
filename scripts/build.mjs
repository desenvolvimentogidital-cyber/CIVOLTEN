import {mkdir,rm,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const dest='dist';
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
for(const file of ['index.html','aceite.html','manifest.webmanifest','sw.js'])
 await copyFile(file,path.join(dest,file));
await copyFile('src/styles.css',path.join(dest,'styles.css'));
await copyFile('src/nfse.css',path.join(dest,'nfse.css'));
await copyFile('src/aceite.css',path.join(dest,'aceite.css'));
await cp('assets',path.join(dest,'assets'),{recursive:true});
// Site institucional público, separado da aplicação de gestão.
await cp('site',path.join(dest,'site'),{recursive:true});
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
// Página pública de resposta; usa apenas a chave publishable do Supabase.
await build({
 entryPoints:['src/public-aceite.mjs'],outfile:path.join(dest,'aceite.js'),
 bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,
 define:{
  __CIVOLTEN_SUPABASE_URL__:JSON.stringify(process.env.SUPABASE_URL||'https://rvhnuowqfdugcecgmxnv.supabase.co'),
  __CIVOLTEN_SUPABASE_PUBLISHABLE_KEY__:JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY||"sb_publishable_UpkP7prNZFMBacZw31SuRg_8E-ea3TP"),
  __CIVOLTEN_E2E__:JSON.stringify(process.env.CIVOLTEN_E2E==='true')
 }
});
console.log('CIVOLTEN: app e resposta pública à proposta construídos.');
