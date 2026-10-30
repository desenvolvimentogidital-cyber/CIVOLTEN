/* CIVOLTEN PWA — cache EXCLUSIVAMENTE do app shell publico.
 * Dados de APIs, sessao, autenticacao e orcamentos: network-only, nunca Cache API.
 */
const CACHE='civolten-shell-v1-20261030';
const ASSETS=[
 '/offline.html','/offline.js','/offline-store.js','/offline-sync.js','/pwa-init.js',
 '/secure.html','/secure.css','/style.css','/secure.js','/secure-costing.js',
 '/secure-schedule.js','/secure-finance.js','/secure-service-picker.js',
 '/secure-workforce.js','/secure-planning-ui.js','/secure-company-costs.js',
 '/manifest.webmanifest','/assets/logo.png','/assets/icone.png'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(ASSETS.map(async path=>{
   const response=await fetch(new Request(path,{cache:'reload',credentials:'omit'}));
   if(response.ok&&response.type==='basic')await cache.put(path,response);
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('civolten-shell-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin)return;
 // Vercel APIs and dynamic user data must never enter offline cache.
 if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/_vercel/')||
    u.pathname.includes('/auth/')||u.pathname.startsWith('/.well-known/'))return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    return await fetch(req);
   }catch{
    return await caches.match('/offline.html')||
     new Response('Sem internet: abra o CIVOLTEN conectado ao menos uma vez para instalar o modo offline.',{
      status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
   }
  })());
  return;
 }
 if(!ASSETS.includes(u.pathname))return;
 event.respondWith((async()=>{
  const cached=await caches.match(u.pathname);
  if(cached)return cached;
  try{const live=await fetch(req);if(live.ok&&live.type==='basic') (await caches.open(CACHE)).put(u.pathname,live.clone());return live}
  catch{return Response.error()}
 })());
});
