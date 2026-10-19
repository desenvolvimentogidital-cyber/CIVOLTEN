/* Se um arquivo artístico ainda não estiver disponível durante o deploy,
 * mantenha uma imagem de referência pública em vez de exibir um card quebrado. */
(function(){
 'use strict';
 for(const image of document.querySelectorAll('img[data-fallback]')){
   const fallback=image.dataset.fallback;
   if(!fallback || !/^https:\/\/images\.pexels\.com\//.test(fallback))continue;
   image.addEventListener('error',function(){
     if(this.dataset.artFallbackUsed==='1')return;
     this.dataset.artFallbackUsed='1';
     this.src=fallback;
   });
 }
})();
