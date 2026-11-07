import { readdir, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const output='dist';
await mkdir(output,{recursive:true});
for (const entry of await readdir('.', {withFileTypes:true})) {
 if (entry.isDirectory() && ['assets','icons'].includes(entry.name)) {
  await cp(entry.name,path.join(output,entry.name),{recursive:true});
 } else if (entry.isFile() && /\.(html|js|css|webmanifest)$/.test(entry.name)) {
  await cp(entry.name,path.join(output,entry.name));
 }
}
await build({
 entryPoints:['client/cloud-sync.mjs'],
 outfile:path.join(output,'cloud-sync.js'),
 bundle:true,platform:'browser',format:'iife',target:['es2022'],minify:true,
 define:{__CIVOLTEN_NEON_AUTH_URL__:JSON.stringify(process.env.NEON_AUTH_BASE_URL||''),
  __CIVOLTEN_BROWSER_TEST_MODE__:JSON.stringify(process.env.CIVOLTEN_BROWSER_TEST_MODE==='true')}
});
console.log('CIVOLTEN: PWA e interface de nuvem compilados. Auth:',Boolean(process.env.NEON_AUTH_BASE_URL));
