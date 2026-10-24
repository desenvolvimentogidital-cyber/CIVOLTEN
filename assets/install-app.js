// Instalação PWA. Nunca armazena sessões, usuários ou dados de negócios.
let deferredInstallPrompt=null;
const installButtons=()=>[...document.querySelectorAll('[data-install-app]')];
const inStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||
 navigator.standalone===true;
function updateInstallButtons(){
 installButtons().forEach(button=>{button.hidden=inStandalone()});
}
function installHelpMessage(){
 const ua=navigator.userAgent||'';
 const isiOS=/iPad|iPhone|iPod/.test(ua)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(isiOS)return 'No iPhone ou iPad, abra o CIVOLTEN no Safari, toque em Compartilhar (quadrado com seta para cima), selecione Adicionar à Tela de Início e confirme.';
 if(/Android/i.test(ua))return 'No Android, abra o CIVOLTEN no Chrome, toque no menu de três pontos (⋮) e escolha Instalar aplicativo ou Adicionar à tela inicial. Confirme a instalação.';
 return 'No Chrome ou Edge, abra o menu do navegador e escolha Instalar CIVOLTEN ou Instalar aplicativo, se disponível.';
}
function showInstallHelp(){
 const dialog=document.querySelector('#installHelp');
 if(!dialog)return;
 const text=dialog.querySelector('#installHelpText');
 if(text)text.textContent=installHelpMessage();
 if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
 else dialog.hidden=false;
}
document.addEventListener('click',async event=>{
 const install=event.target.closest?.('[data-install-app]');
 if(install){
  event.preventDefault();
  if(inStandalone())return;
  if(!deferredInstallPrompt){showInstallHelp();return}
  const prompt=deferredInstallPrompt;
  deferredInstallPrompt=null;
  try{
   await prompt.prompt();
   const choice=await prompt.userChoice;
   if(choice?.outcome==='accepted')updateInstallButtons();
  }catch{showInstallHelp()}
  return;
 }
 if(event.target.closest?.('[data-close-install]')){
  const dialog=document.querySelector('#installHelp');
  if(dialog?.open)dialog.close();
  else if(dialog)dialog.hidden=true;
 }
});
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();deferredInstallPrompt=event;
 updateInstallButtons();
});
window.addEventListener('appinstalled',()=>{
 deferredInstallPrompt=null;updateInstallButtons();
});
window.addEventListener('DOMContentLoaded',()=>{
 updateInstallButtons();
 if('serviceWorker' in navigator&&window.isSecureContext){
  navigator.serviceWorker.register('/sw.js',{scope:'/'})
   .catch(error=>console.warn('CIVOLTEN: instalação não disponível neste navegador.',error?.message||error));
 }
});
