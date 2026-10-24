/* CIVOLTEN: instalado no celular sem armazenar informações financeiras.
   Nenhum dado de API, sessão, orçamento ou contrato é salvo no Cache Storage. */
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>{
  const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width, initial-scale=1">'+
   '<title>CIVOLTEN — sem conexão</title><body>'+
   '<main><h1>Sem conexão com a internet</h1>'+
   '<p>O CIVOLTEN precisa de internet para acessar seus dados privados com segurança.</p>'+
   '<p>Conecte-se novamente e atualize esta página. Nenhum orçamento ou contrato foi baixado para este aparelho.</p>'+
   '</main></body></html>';
  return new Response(html,{status:503,statusText:'Offline',headers:{
   'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
   'Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }});
 }));
});
