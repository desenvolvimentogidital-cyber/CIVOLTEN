/* Instalacao PWA nativa do navegador; sem baixar APK de terceiros. */
(function(){
 let deferred=null;
 function initialize(){
  if('serviceWorker' in navigator){
   window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'})
    .catch(e=>console.warn('CIVOLTEN: instalação offline indisponível',e.message)));
  }
  const panel=document.createElement('aside');panel.id='pwa-panel';panel.setAttribute('aria-label','Instalação e modo offline');
  panel.innerHTML='<button type="button" id="pwa-install" hidden>Instalar CIVOLTEN</button>'+
   '<a href="/offline.html" id="pwa-offline">Rascunhos offline</a><button type="button" id="pwa-hide" aria-label="Ocultar atalhos">×</button>';
  document.body.append(panel);
  panel.querySelector('#pwa-hide').addEventListener('click',()=>{panel.hidden=true});
  const install=panel.querySelector('#pwa-install');
  window.addEventListener('beforeinstallprompt',event=>{
   event.preventDefault();deferred=event;install.hidden=false;
  });
  install.addEventListener('click',async()=>{
   if(!deferred)return;
   const prompt=deferred;deferred=null;install.hidden=true;
   try{await prompt.prompt()}catch(e){console.warn('CIVOLTEN PWA:',e.message)}
  });
  window.addEventListener('appinstalled',()=>{deferred=null;install.hidden=true});
  function status(){panel.classList.toggle('offline-active',!navigator.onLine);
   panel.querySelector('#pwa-offline').textContent=navigator.onLine?'Rascunhos offline':'Abrir modo offline'}
  window.addEventListener('online',status);window.addEventListener('offline',status);status();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
 else initialize();
})();
