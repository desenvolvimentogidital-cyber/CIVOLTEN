const CACHE='civolten-premium-ui-v33-20261110-push-install';
const PRECACHE=['/','/index.html','/styles.css?v=civolten-acompanhamento-digital-20261109','/app.js?v=civolten-acompanhamento-digital-20261109','/manifest.webmanifest',
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
/* Web Push: o Android pode mostrar o aviso mesmo com o app fechado. */
self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?.json()||{};}catch{/* mensagem sem dados */}
 if(payload.type!=='site-lead')return;
 const id=String(payload.id||'').slice(0,60);
 const options={
  body:'Você recebeu um pedido de orçamento. Toque para visualizar.',
  icon:'/assets/icon-192.png',badge:'/assets/icon-192.png',
  tag:'civolten-site-lead-'+id,renotify:true,
  vibrate:[220,90,220],requireInteraction:false,
  data:{url:'/?abrir=solicitacoes'}
 };
 event.waitUntil(self.registration.showNotification('CIVOLTEN · Novo orçamento',options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('/?abrir=solicitacoes',self.location.origin);
  const pages=await clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=pages.find(c=>{try{return new URL(c.url).origin===target.origin}catch{return false}});
  if(existing){await existing.focus();existing.postMessage({type:'civolten-open-leads'});}
  else await clients.openWindow(target.href);
 })());
});
