/* Identidade da CIVOLTEN: a logo oficial é a única marca no cabeçalho e rodapé.
 * Cores e textos vêm da configuração administrativa validada pelo servidor. */
(function(){
'use strict';
const API='https://rvhnuowqfdugcecgmxnv.supabase.co/functions/v1/civolten-beta?api=site-branding';
const $=id=>document.getElementById(id);
function apply(branding){
 if(!branding||typeof branding!=='object')return;
 const validColor=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const primary=validColor(branding.color_primary)?branding.color_primary:'#08182B';
 const accent=validColor(branding.color_accent)?branding.color_accent:'#DCA629';
 const width=Number(branding.logo_width_px);
 const logoWidth=Number.isInteger(width)?Math.max(60,Math.min(320,width)):160;
 const root=document.documentElement.style;
 root.setProperty('--brand-primary',primary);
 root.setProperty('--brand-accent',accent);
 root.setProperty('--g',accent);
 root.setProperty('--brand-logo-width',logoWidth+'px');
 for(const img of [$('siteLogo'),$('proposalLogo'),$('footerLogo')]){
  if(!img)continue;
  const logo=branding.logo_data_url;
  if(typeof logo==='string'&&logo.length<300000&&/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(logo)){
   img.src=logo;img.hidden=false;
  }else{
   img.hidden=true;img.removeAttribute('src');
  }
 }
 const heading=$('siteHeadline'),summary=$('siteDescription'),footer=$('siteFooterNote');
 if(heading&&typeof branding.site_headline==='string')heading.textContent=branding.site_headline;
 if(summary&&typeof branding.site_description==='string')summary.textContent=branding.site_description;
 if(footer&&typeof branding.footer_note==='string')footer.textContent=branding.footer_note;
 const wa=$('siteContactWhatsApp');
 const phone=String(branding.contact_whatsapp||'').replace(/\D/g,'');
 if(wa){
  if(/^[1-9][0-9]{10,12}$/.test(phone)){
   wa.href='https://wa.me/'+phone;wa.hidden=false;
  }else wa.hidden=true;
 }
}
async function load(){
 try{
  const r=await fetch(API,{credentials:'omit',cache:'no-store'});
  if(!r.ok)throw Error('Configuração indisponível');
  const data=await r.json();
  apply(data.branding);
 }catch{
  // Não substituir a logo por texto ou símbolo quando faltar conexão.
  // A marca só aparece quando uma imagem oficial estiver configurada.
 }
}
window.CIVOLTEN_SITE_BRANDING={apply,reload:load};
load();
})();