/* Uma única origem da identidade visual, utilizada nas páginas, painel e PDF.
 * A imagem é sempre a cadastrada pelo administrador; não há logotipo fictício.
 * A leitura pública usa a rota da própria Vercel para evitar diferenças de CORS.
 */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const PUBLIC_API = '/api/site-branding';
const LOGOS = ['siteLogo', 'proposalLogo', 'footerLogo', 'adminNavLogo', 'previewSiteLogo', 'previewPdfLogo'];
const DEFAULTS = Object.freeze({primary:'#08182B',accent:'#DCA629',width:160});
const color = (v, fallback) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
const text = (id, value) => {
  const element = $(id);
  if(element && typeof value === 'string') element.textContent = value;
};
let lastLoaded = null;

function apply(branding) {
  if(!branding || typeof branding !== 'object') return;
  lastLoaded = branding;
  const css = document.documentElement.style;
  const primary = color(branding.color_primary,DEFAULTS.primary);
  const accent = color(branding.color_accent,DEFAULTS.accent);
  const requestedWidth = Number(branding.logo_width_px);
  const width = Number.isFinite(requestedWidth) ? Math.min(320,Math.max(60,Math.round(requestedWidth))) : DEFAULTS.width;
  css.setProperty('--brand-primary',primary);
  css.setProperty('--brand-accent',accent);
  css.setProperty('--g',accent);
  css.setProperty('--brand-logo-width',width+'px');

  const logo = branding.logo_data_url;
  const safeImage = typeof logo === 'string' && logo.length <= 360000 &&
    /^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(logo);
  for(const id of LOGOS){
    const img = $(id);
    if(!img) continue;
    if(safeImage) {
      img.onerror = () => { img.hidden = true; img.removeAttribute('src'); };
      if(img.getAttribute('src') !== logo) img.src = logo;
      img.hidden = false;
    }else{
      img.hidden = true;
      img.removeAttribute('src');
    }
  }
  text('siteHeadline',branding.site_headline);
  text('siteDescription',branding.site_description);
  text('siteFooterNote',branding.footer_note);
  text('previewHeadline',branding.site_headline);
  text('previewDescription',branding.site_description);

  const whatsapp = $('siteContactWhatsApp');
  const phone = String(branding.contact_whatsapp||'').replace(/\D/g,'');
  if(whatsapp) {
    const valid = /^[1-9][0-9]{10,12}$/.test(phone);
    whatsapp.hidden = !valid;
    if(valid) whatsapp.href = 'https://wa.me/'+phone;
    else whatsapp.removeAttribute('href');
  }
}

async function load() {
  try {
    const response = await fetch(PUBLIC_API,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error('Branding unavailable');
    const data = await response.json();
    if(data?.branding) apply(data.branding);
  } catch {
    // A logo do banco não é substituída por símbolos ou letras.
    // Caso o serviço esteja fora do ar, a próxima abertura repetirá a leitura.
  }
  return lastLoaded;
}
window.CIVOLTEN_SITE_BRANDING={apply,reload:load,getCurrent:()=>lastLoaded};
load();
})();
