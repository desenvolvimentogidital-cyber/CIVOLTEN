import {buildArtProposalHtml,proposalArtPaths} from '/lib/civolten-proposal-art.mjs';

let overlay=null;
export function closeArtProposalPreview(){
 if(overlay){overlay.remove();overlay=null}
 document.body.classList.remove('cv-art-preview-open');
}
export async function openArtProposalPreview({budget,priceCents,id}={}){
 if(!budget)throw Error('Abra um orçamento para visualizar a proposta.');
 closeArtProposalPreview();
 const cssResponse=await fetch('/assets/proposal-art-print.css',{cache:'no-store'});
 if(!cssResponse.ok)throw Error('O modelo visual da proposta não está disponível.');
 const css=await cssResponse.text();
 const html=buildArtProposalHtml(
  {title:budget.title||'Prévia de proposta',customer:budget.customer,address:budget.address,
   technical_responsible:budget.technical_responsible,scope_items:budget.scope_items,
   civil_services:budget.civil_services,services:budget.services,electrical_services:budget.electrical_services,
   days:budget.days,validity_days:budget.validity_days,payment_terms:budget.payment_terms||'A confirmar'},
  {priceCents:Number.isSafeInteger(priceCents)&&priceCents>=0?priceCents:0,id,preview:true});
 const images=await Promise.all(proposalArtPaths.map(async path=>{
  const response=await fetch(path,{method:'HEAD',cache:'no-store'});
  if(!response.ok)throw Error('Uma das sete artes da CIVOLTEN não carregou. Atualize a página.');
  return path;
 }));
 const back=document.createElement('section');
 back.className='cv-art-preview-overlay';
 back.setAttribute('role','dialog');back.setAttribute('aria-modal','true');
 back.setAttribute('aria-label','Prévia visual da proposta CIVOLTEN');
 const header=document.createElement('header');
 header.className='cv-art-preview-head';
 const left=document.createElement('div');
 left.innerHTML='<strong>Proposta Comercial CIVOLTEN</strong><small>Prévia do documento que o cliente receberá</small>';
 const close=document.createElement('button');close.type='button';close.className='subtle';
 close.textContent='Fechar ✕';close.onclick=closeArtProposalPreview;
 header.append(left,close);
 const hint=document.createElement('p');
 hint.className='cv-art-preview-hint';
 hint.textContent='Teste do novo layout. O modelo anterior continua disponível; revise os dados antes da emissão.';
 const frame=document.createElement('iframe');
 frame.title='Sete páginas da proposta profissional CIVOLTEN';
 frame.className='cv-art-preview-frame';
 frame.setAttribute('sandbox','');
 const scale=Math.max(.29,Math.min(.92,(Math.min(window.innerWidth,960)-56)/794));
 const screenCss=css.replace(/@media print/g,'@media screen');
 frame.srcdoc='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"><base href="'+location.origin+'/">'+
 '<style>html,body{margin:0;padding:0;background:#e5ebf1;font-family:Arial,sans-serif}'+
 '#printArea{display:block!important;zoom:'+scale+'}'+
 '#printArea .cv-art-page{margin:0 auto 14px!important;box-shadow:0 3px 18px #0004}'+
 screenCss+'</style></head><body><div id="printArea">'+html+'</div></body></html>';
 back.append(header,hint,frame);
 back.addEventListener('click',e=>{if(e.target===back)closeArtProposalPreview()});
 document.body.appendChild(back);
 document.body.classList.add('cv-art-preview-open');
 overlay=back;
 close.focus();
}