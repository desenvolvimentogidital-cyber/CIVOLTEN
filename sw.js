const CACHE='civolten-premium-ui-v10-20261108-capa-original';
const PRECACHE=['/','/index.html','/styles.css?v=civolten-capa-arte-original-20261108','/app.js?v=civolten-capa-arte-original-20261108','/manifest.webmanifest',
'/assets/civolten-logo.png','/assets/civolten-simbolo.png','/assets/proposal-construction.svg','/assets/proposal-photo-atlas.webp','/assets/file_000000007df8820eb700b32dbfca9c55.png','/assets/skyline.svg',
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
 const freshCode=url.pathname==='/'||url.pathname==='/index.html'||
  url.pathname==='/app.js'||url.pathname==='/styles.css';
 e.respondWith(fetch(req,freshCode?{cache:'no-store'}:undefined).then(resp=>{
  if(resp.ok){
   const copy=resp.clone();
   e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}));
  }return resp;
 }).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>
  hit||(req.mode==='navigate'?caches.match('/index.html'):Response.error()))));
});