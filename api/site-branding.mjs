import {EDGE,json} from '../lib/civolten-security.mjs';
export default {async fetch(r){
 if(r.method!=='GET')return json({error:'Método não permitido'},405);
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),9000);
 try{
  const v=await fetch(EDGE+'?api=site-branding',{signal:c.signal});if(!v.ok)return json({error:'Marca indisponível'},502);
  const b=(await v.json()).branding;if(!b)return json({error:'Marca inválida'},502);
  return json({branding:{company_name:b.company_name,color_primary:b.color_primary,color_accent:b.color_accent,logo_data_url:typeof b.logo_data_url==='string'&&b.logo_data_url.length<=360000&&/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(b.logo_data_url)?b.logo_data_url:null}});
 }catch{return json({error:'Marca indisponível'},502)}finally{clearTimeout(timer)}
}};
