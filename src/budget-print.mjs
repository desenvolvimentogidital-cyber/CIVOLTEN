// CIVOLTEN • modelo aprovado V4 de proposta comercial para PDF/impressão.
// HTML e CSS com logotipo verdadeiro: texto, linhas e valores continuam dinâmicos.
// Nesta fase todos os orçamentos são demonstrativos — identificação obrigatória.
import {brl} from './calc.mjs';
import {priceBudget} from './budget.mjs';
import {e,icon} from './views.mjs';

const dateBR=date=>{
 if(!date)return 'Não definida';
 if(/^\d{4}-\d{2}-\d{2}$/.test(date))return date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4);
 return 'Não definida';
};
const createdBR=date=>{
 if(!date)return 'Prévia';
 const t=new Date(date);
 return Number.isNaN(t.getTime())?'Prévia':t.toLocaleDateString('pt-BR');
};
const info=(symbol,label,value)=>'<div class="budget-pdf-info-row">'+
 '<span class="budget-pdf-info-icon">'+icon(symbol,17)+'</span>'+
 '<span class="budget-pdf-info-value"><b>'+label+'</b><span>'+e(value||'—')+'</span></span></div>';

export function printableBudget(b){
 let p;
 try{p=priceBudget(b)}catch{return '';}
 if(!p)return '';
 const isDemo=b.demo!==false;
 const ref=b.id?'CV-'+String(b.id).slice(0,8).toUpperCase():'Prévia';
 const origin=p.snapshot.companyName?.trim()||'CIVOLTEN';
 return '<div class="budget-print budget-pdf-v4" role="document" aria-label="Proposta comercial CIVOLTEN para impressão">'+
  '<div class="budget-pdf-watermark" aria-hidden="true">'+
   '<img class="budget-pdf-watermark-icon" src="/assets/civolten-simbolo.png" alt="">'+
   '<img class="budget-pdf-watermark-logo" src="/assets/civolten-logo.png" alt=""></div>'+
  '<div class="budget-pdf-content">'+
   '<header class="budget-pdf-header">'+
    '<span class="budget-pdf-header-accent" aria-hidden="true"></span>'+
    '<img class="budget-pdf-brand" src="/assets/civolten-logo.png" alt="CIVOLTEN — Elétrica & Construção Civil">'+
    '<span class="budget-pdf-header-divider" aria-hidden="true"></span>'+
    '<img class="budget-pdf-symbol" src="/assets/civolten-simbolo.png" alt="Ícone da CIVOLTEN">'+
   '</header>'+
   '<section class="budget-pdf-heading"><span class="budget-pdf-heading-bar" aria-hidden="true"></span>'+
    '<div class="budget-pdf-heading-copy"><p class="budget-pdf-overline">CIVOLTEN · ELÉTRICA & CONSTRUÇÃO CIVIL</p>'+
    '<h1>'+(isDemo?'ORÇAMENTO DEMONSTRATIVO':'PROPOSTA COMERCIAL')+'</h1>'+
    (isDemo?'<span class="budget-pdf-test-tag">NÃO ENVIAR AO CLIENTE</span>'+
     '<p class="budget-pdf-subtitle">Serviços fictícios utilizados para validação do sistema.</p>':
     '<p class="budget-pdf-subtitle">Proposta de execução de serviços de elétrica e construção civil.</p>')+
    '</div></section>'+
   '<section class="budget-pdf-client" aria-label="Dados da proposta">'+
     '<div class="budget-pdf-client-col">'+
      info('file','Proposta',b.title)+
      info('building','Obra',b.project||'Não informada')+
      info('calendar','Validade',dateBR(b.expiresOn))+
     '</div>'+
     '<div class="budget-pdf-client-col">'+
      info('user','Cliente',b.customer)+
      info('home','Local da obra',b.location||'Não informado')+
      info('clipboard','Referência',ref)+
     '</div>'+
   '</section>'+
   '<section class="budget-pdf-services" aria-label="Serviços da proposta">'+
    '<div class="budget-pdf-section-label"><span>01</span><h2>Descrição dos serviços</h2></div>'+
    '<table class="budget-pdf-table"><colgroup><col class="budget-pdf-col-service"><col class="budget-pdf-col-qty"><col class="budget-pdf-col-unit"><col class="budget-pdf-col-total"></colgroup>'+
     '<thead><tr><th>Serviço</th><th>Qtd.</th><th>Un.</th><th>Preço total</th></tr></thead><tbody>'+
      p.rows.map(item=>'<tr><td>'+e(item.description)+'</td><td>'+e(item.quantity.toLocaleString('pt-BR'))+'</td>'+
       '<td>'+e(item.unit)+'</td><td>'+brl(item.selling)+'</td></tr>').join('')+
     '</tbody></table>'+
   '</section>'+
   '<section class="budget-pdf-summary" aria-label="Valor total da proposta">'+
    '<div class="budget-pdf-total"><span>TOTAL</span><strong>'+brl(p.totalSale)+'</strong></div>'+
   '</section>'+
   '<section class="budget-pdf-notes"><div class="budget-pdf-notes-title">'+
    '<span class="budget-pdf-notes-icon">'+icon('clipboard',15)+'</span><h2>OBSERVAÇÕES</h2>'+
   '</div><div class="budget-pdf-notes-body">'+(b.notes?e(b.notes):'')+'</div></section>'+
   '<footer class="budget-pdf-footer">'+
    '<p><strong>'+(isDemo?'DOCUMENTO DE TESTE.':'PROPOSTA COMERCIAL.')+'</strong> '+
      (isDemo?'Não é proposta comercial válida nem contém referência oficial de preços.':
       'Valores e condições sujeitos à validade indicada nesta proposta.')+'</p>'+
    '<p class="budget-pdf-origin">Emitido por '+e(origin)+' · '+e(createdBR(b.createdAt))+'</p>'+
   '</footer>'+
  '</div></div>';
}
