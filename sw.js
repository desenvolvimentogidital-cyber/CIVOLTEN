const CACHE='civolten-premium-ui-v4-20261107-budgets';
const PRECACHE=['/','/index.html','/styles.css','/app.js','/manifest.webmanifest',
'/assets/civolten-logo.png','/assets/civolten-simbolo.png','/assets/skyline.svg',
'/assets/icon-192.png','/assets/icon-512.png'];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));
 self.skipWaiting();
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));
 self.clients.claim();
});
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 e.respondWith(fetch(req).then(resp=>{
  if(resp.ok){
   const copy=resp.clone();
   e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}));
  }return resp;
 }).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>
  hit||(req.mode==='navigate'?caches.match('/index.html'):Response.error()))));
});