// Ordem de Serviço CIVOLTEN, modelo 3 aprovado: documento operacional A4.
// O preço aprovado permanece no banco e na proposta; NÃO aparece na OS entregue.
import {e,icon} from './views.mjs';
import {numberBR} from './operations.mjs';

const logo='/assets/civolten-logo.png';
const symbol='/assets/civolten-simbolo.png';
const date=value=>{
 const match=/^(\d{4})-(\d\d)-(\d\d)/.exec(String(value||''));
 return match?match[3]+'/'+match[2]+'/'+match[1]:'Não informado';
};
const value=(v,fallback='Não informado')=>{
 const text=String(v??'').trim();
 return e(text||fallback);
};
const serviceLines=item=>Math.max(1,Math.ceil(String(item.description||'').length/52));
const rowWeight=item=>1+Math.max(0,serviceLines(item)-1)*.65;

// Reserva espaço para aceite, notas e assinaturas; não cortar os serviços.
export function splitWorkOrderServices(items){
 const all=Array.isArray(items)?items:[];
 if(!all.length)return [[]];
 const pages=[];
 let buffer=[],weight=0;
 const flush=()=>{if(buffer.length){pages.push(buffer);buffer=[];weight=0;}};
 for(const item of all){
  const max=pages.length===0?8:12;
  const burden=rowWeight(item);
  if(buffer.length && (buffer.length>=8||weight+burden>max))flush();
  buffer.push(item);weight+=burden;
 }
 flush();
 // A última folha sempre contém observações e assinaturas.
 // Se ela ficar cheia demais, reserve uma folha final curta para o aceite.
 const last=pages.at(-1);
 if(pages.length>1 && last.length>5){
  const moved=last.splice(5);
  pages.push(moved);
 }
 return pages;
}
const field=(iconName,label,text,modifier='')=>
 '<div class="work-pdf-field '+modifier+'">'+
 '<div class="work-pdf-field-label">'+icon(iconName,16)+'<span>'+label+'</span></div>'+
 '<div class="work-pdf-field-value">'+value(text)+'</div></div>';

const header=(page,total)=>'<header class="work-pdf-header">'+
 '<div class="work-pdf-brand"><img class="work-pdf-symbol" src="'+symbol+
  '" alt="Símbolo da CIVOLTEN"><span class="work-pdf-brand-divider"></span>'+
 '<img class="work-pdf-wordmark" src="'+logo+
  '" alt="CIVOLTEN — Elétrica &amp; Construção Civil"></div>'+
 '<div class="work-pdf-header-building" aria-hidden="true"></div>'+
 '<div class="work-pdf-header-rule" aria-hidden="true"></div>'+
 '</header>';

const title=(continuation=false)=>
 '<section class="work-pdf-title">'+
 '<div class="work-pdf-title-icon">'+icon('clipboard',28)+'</div>'+
 '<div class="work-pdf-title-copy"><h1>CIVOLTEN — ORDEM DE SERVIÇO</h1>'+
 '<p>'+(continuation?'Continuação da relação de serviços':
 'Prestação exclusivamente de mão de obra')+'</p></div></section>'+
 '<div class="work-pdf-title-rule" aria-hidden="true"></div>';

const metadata=order=>'<section class="work-pdf-metadata" aria-label="Dados da ordem de serviço">'+
 field('clipboard','OS Nº',order.contractRef)+
 field('users','CLIENTE',order.customer)+
 field('hardhat','OBRA',order.project,'work-pdf-field-wide')+
 field('check','ACEITE INFORMADO',order.acceptanceRef,'work-pdf-field-wide work-pdf-acceptance')+
 field('calendar','APROVAÇÃO REGISTRADA',date(order.approvedOn))+
 field('calendar','INÍCIO PREVISTO',date(order.startOn))+
 '</section>';

const continuation=order=>'<div class="work-pdf-continuation-meta"><span>OS Nº <b>'+value(order.contractRef)+'</b></span>'+
 '<span>Cliente <b>'+value(order.customer)+'</b></span></div>';

const table=services=>'<section class="work-pdf-services" aria-label="Serviços contratados">'+
 '<table><thead><tr><th scope="col">SERVIÇO</th><th scope="col">UNIDADE</th>'+
 '<th scope="col">QUANTIDADE</th></tr></thead><tbody>'+
 (services.length?services.map(item=>'<tr><td>'+value(item.description)+'</td>'+
 '<td>'+value(item.unit,'—')+'</td><td>'+numberBR(Number(item.quantity)||0)+'</td></tr>').join(''):
 '<tr><td colspan="3">Nenhum serviço informado no contrato.</td></tr>')+
 '</tbody></table></section>';

const notes=()=>'<section class="work-pdf-notes" aria-label="Observações da execução">'+
 '<div class="work-pdf-note"><span class="work-pdf-note-icon">'+icon('hardhat',20)+'</span>'+
 '<p>Materiais e insumos de aplicação são fornecidos pelo contratante. Máquinas especiais, '+
 'autorizações e alterações de escopo exigem acordo específico.</p></div>'+
 '<div class="work-pdf-note"><span class="work-pdf-note-icon">'+icon('file',20)+'</span>'+
 '<p>As condições comerciais e o prazo são os registrados na proposta aprovada, '+
 'que integra esta ordem de serviço.</p></div></section>';

const signatures=()=>'<section class="work-pdf-signatures" aria-label="Conferência e assinaturas">'+
 '<div><span>Representante da CIVOLTEN</span></div>'+
 '<div><span>Cliente / Contratante</span></div></section>';

const footer=(page,total)=>'<footer class="work-pdf-footer">'+
 '<p>Documento gerencial para conferência. O aceite eletrônico informado deve ser validado com o responsável.</p>'+
 '<span>ORDEM DE SERVIÇO <b>·</b> '+page+' / '+total+'</span>'+
 '<div class="work-pdf-footer-art" aria-hidden="true"></div></footer>';

export function workPrintable(order){
 if(!order?.budgetSnapshot||!Array.isArray(order.budgetSnapshot.items))
  throw Error('Esta ordem de serviço não possui serviços contratados.');
 const pages=splitWorkOrderServices(order.budgetSnapshot.items);
 const total=pages.length;
 return '<section class="work-print-document" aria-label="Ordem de serviço CIVOLTEN para impressão">'+
 pages.map((items,index)=>{
  const first=index===0,last=index===total-1;
  return '<article class="work-print-page '+(first?'work-print-page-first':'work-print-page-cont')+
   '" data-work-pdf-page="'+(index+1)+'">'+
   header(index+1,total)+
   '<div class="work-pdf-page-body">'+title(!first)+
   (first?metadata(order):continuation(order))+
   table(items)+
   (last?notes()+'<div class="work-pdf-page-bottom">'+signatures()+'</div>':'')+
   '</div>'+footer(index+1,total)+'</article>';
 }).join('')+'</section>';
}
