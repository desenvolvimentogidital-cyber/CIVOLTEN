/**
 * Prévia em tela da proposta comercial CIVOLTEN.
 * A imagem mostrada é gerada pelo MESMO HTML e pelas MESMAS regras de impressão.
 * O iframe isolado só recebe o HTML comercial; custos internos nunca são inseridos.
 */
import {buildProposalHtml} from '/lib/civolten-proposal.mjs';

const logo='/assets/civolten-logo.png';
const wordmark='/assets/civolten-proposal-header.png';
let preview=null;

function previewScale() {
 const width=Math.min(window.innerWidth,1100)-55;
 return Math.min(1,Math.max(.28,width/794));
}
function previewBudget(b) {
 // Não força dados fictícios no orçamento: substituição visual apenas para a prévia.
 return {...b,title:String(b?.title||'').trim()||'Novo projeto — prévia não finalizada'};
}
function priceForPreview(cents) {
 return Number.isSafeInteger(cents)&&cents>=0?cents:0;
}
function createPreviewDocument(budget, priceCents, id, printStyles) {
 const start=printStyles.indexOf('/* =============================================================');
 if(start<0)throw Error('O modelo visual CIVOLTEN não foi encontrado. Atualize o sistema.');
 // Usa as mesmas regras das páginas A4; só muda a mídia, de impressora para tela.
 const css=printStyles.slice(start).replace(/@media print\s*\{/g,'@media screen {');
 const html=buildProposalHtml(previewBudget(budget),{
  priceCents:priceForPreview(priceCents),id,
  logoDataUrl:logo,headerArtUrl:wordmark
 });
 // Toda informação do usuário é escapada pelo gerador compartilhado.
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#e8edf3;'+
  'color:#08182b;font-family:Arial,sans-serif}#printArea{display:block!important;'+
  'zoom:'+previewScale()+';margin:0 auto!important;padding:0!important}'+
  '.cv-page{box-shadow:0 3px 14px #08182b33;margin:0 0 12px!important}'+css+
  '</style></head><body><div id="printArea">'+html+'</div></body></html>';
}
export function closeProposalPreview() {
 if(!preview)return;
 preview.remove();
 preview=null;
 document.body.classList.remove('cv-preview-open');
}
export async function openProposalPreview({budget,priceCents,id}={}) {
 if(!budget)throw Error('Abra um orçamento antes de visualizar a proposta.');
 closeProposalPreview();
 const response=await fetch('/assets/proposal-print.css',{cache:'no-store'});
 if(!response.ok)throw Error('Não foi possível carregar o modelo CIVOLTEN. Atualize a página.');
 const css=await response.text();
 const overlay=document.createElement('div');
 overlay.className='cv-preview-overlay';
 overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Pré-visualização das páginas da proposta CIVOLTEN');
 const top=document.createElement('div');
 top.className='cv-preview-toolbar';
 top.innerHTML='<div><strong>PROPOSTA COMERCIAL <span>CIVOLTEN</span></strong>'+
 '<small>Pré-visualização das páginas A4 • construção civil e elétrica</small></div>';
 const close=document.createElement('button');
 close.type='button';close.className='cv-preview-close';
 close.textContent='Fechar prévia ✕';close.setAttribute('aria-label','Fechar pré-visualização');
 close.addEventListener('click',closeProposalPreview);
 top.appendChild(close);
 const warning=document.createElement('p');
 warning.className='cv-preview-warning';
 warning.textContent='Esta é uma prévia para conferência. Para emitir o PDF, use "Exportar Proposta Comercial (PDF)" no orçamento; os campos obrigatórios serão verificados.';
 const frame=document.createElement('iframe');
 frame.className='cv-preview-frame';
 frame.title='Visualização da proposta comercial CIVOLTEN em páginas A4';
 frame.setAttribute('sandbox','');
 frame.setAttribute('loading','eager');
 frame.srcdoc=createPreviewDocument(budget,priceCents,id,css);
 overlay.append(top,warning,frame);
 overlay.addEventListener('click',ev=>{if(ev.target===overlay)closeProposalPreview()});
 const keydown=ev=>{
  if(ev.key==='Escape'){closeProposalPreview();document.removeEventListener('keydown',keydown)}
 };
 document.addEventListener('keydown',keydown);
 document.body.appendChild(overlay);
 document.body.classList.add('cv-preview-open');
 preview=overlay;
 close.focus();
}