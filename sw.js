const CACHE='civolten-base-limpa-v1-20261107';
const FILES=['/','/index.html','/auth-screen.js','/core/app.js',
 '/core/cost-engine.js','/core/styles.css','/login.js','/manifest.webmanifest',
 '/assets/civolten-logo.png','/icons/civolten-simbolo.png',
 '/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(
  keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==location.origin||
  url.pathname.startsWith('/api/')||url.pathname.startsWith('/login'))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){
   const clone=response.clone();
   caches.open(CACHE).then(cache=>cache.put(req,clone)).catch(()=>{});
  }
  return response;
 }).catch(()=>caches.match(req,{ignoreSearch:true})
   .then(cached=>cached||(req.mode==='navigate'?caches.match('/index.html'):Response.error()))));
});
