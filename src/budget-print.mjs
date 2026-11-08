// CIVOLTEN Signature · proposta comercial A4 em 3+ páginas.
 // Os valores por item servem apenas ao cálculo administrativo.
 // PDF comercial: serviços SEM preços; valor total EXCLUSIVAMENTE na última folha.
import {brl} from './calc.mjs';
import {priceBudget,validateCommercial} from './budget.mjs';
import {e,icon} from './views.mjs';

const logo='/assets/civolten-logo.png';
const mark='/assets/civolten-simbolo.png';
const show=(value,empty='Não informado')=>e(String(value||'').trim()||empty);
const dateBR=value=>{
 if(!value)return 'Não informada';
 const match=/^(\d{4})-(\d\d)-(\d\d)/.exec(value);
 return match?match[3]+'/'+match[2]+'/'+match[1]:'Não informada';
};
const proposalRef=b=>{
 const year=(b.createdAt||new Date().toISOString()).slice(0,4);
 return b.id?'PC-'+year+'-'+String(b.id).slice(0,8).toUpperCase():'PRÉVIA';
};
export function splitServicePages(rows){
 const groups=[];let buffer=[],weight=0;
 for(const row of rows){
  const description=String(row.description||'');
  const unitWeight=Math.max(3,Math.ceil(description.length/46)+1);
  if(buffer.length && (weight+unitWeight>21||buffer.length>=8)){
   groups.push(buffer);buffer=[];weight=0;
  }
  buffer.push(row);weight+=unitWeight;
 }
 if(buffer.length)groups.push(buffer);
 return groups;
}
const imageBrand=()=>'<img class="proposal-wordmark" src="'+logo+'" alt="CIVOLTEN · Elétrica e Construção Civil">'+
 '<img class="proposal-brand-icon" src="'+mark+'" alt="">';
const watermark=()=>'<div class="proposal-watermark" aria-hidden="true">'+
 '<img class="budget-pdf-watermark-icon" src="'+mark+'" alt="">'+
 '<img class="budget-pdf-watermark-logo" src="'+logo+'" alt=""></div>';
const header=(kind,number,total,ref,demo)=>{
 const caption=kind.includes('SERVIÇOS')
  ?'<b>PROPOSTA <strong>COMERCIAL</strong></b><small>DESCRIÇÃO DOS SERVIÇOS</small>'
  :kind.includes('INVESTIMENTO')
   ?'<b>INVESTIMENTO E<br><strong>CONDIÇÕES COMERCIAIS</strong></b>'
   :'<b>PROPOSTA COMERCIAL</b>';
 return '<header class="proposal-header">'+
 '<div class="proposal-brand-area">'+imageBrand()+'</div>'+
 '<div class="proposal-header-art" aria-hidden="true"></div>'+
 '<div class="proposal-header-caption">'+
 '<div class="proposal-header-caption-title">'+caption+'</div>'+
 '<div class="proposal-header-caption-meta"><b>Proposta nº '+show(ref)+'</b>'+
 '<small>Página '+number+' de '+total+'</small></div></div>'+
 '</header>';
};
const footer=(number,total,demo)=>'<footer class="proposal-footer">'+
 '<div class="proposal-footer-accent" aria-hidden="true"></div>'+
 (number===total?
 '<div class="proposal-footer-slogan"><span>'+icon('zap',22)+'</span>'+
 '<div>SOLUÇÕES EM ELÉTRICA E CONSTRUÇÃO CIVIL<br>'+
 '<strong>COM SEGURANÇA, QUALIDADE E RESULTADO.</strong></div></div>':
 '<div class="proposal-footer-three"><span>'+icon('hardhat',16)+' Segurança em cada etapa</span>'+
 '<span>'+icon('check',16)+' Qualidade nos serviços</span>'+
 '<span>'+icon('calendar',16)+' Compromisso com o prazo</span></div>')+
 (demo?'<small>DOCUMENTO DE TESTE · Serviços fictícios, sem referência oficial de preços · '+number+'/'+total+'</small>':'')+
 '</footer>';
const page=(cls,no,total,ref,demo,body,tag='PROPOSTA COMERCIAL')=>
 '<section class="proposal-page '+cls+'" data-pdf-page="'+no+'">'+
 watermark()+header(tag,no,total,ref,demo)+
 '<div class="proposal-page-content">'+
 (demo?'<div class="proposal-demo-ribbon">DEMONSTRAÇÃO · NÃO ENVIAR AO CLIENTE</div>':'')+
 body+'</div>'+
 footer(no,total,demo)+'</section>';
const coverInfo=(symbol,label,value)=>'<div class="proposal-cover-info-row">'+
 '<span>'+icon(symbol,20)+'</span><div><b>'+label+'</b><em>'+show(value)+'</em></div></div>';
const cover=(b,no,total,ref,demo)=>
 '<div class="proposal-cover-visual" aria-hidden="true"></div>'+
 '<div class="proposal-cover-band"><b>'+icon('file',16)+' Proposta nº '+show(ref)+'</b>'+
 '<span>Página '+no+' de '+total+'</span></div>'+
 '<div class="proposal-cover-text"><span class="proposal-mini-line"></span>'+
 '<h1>Proposta<br><strong>Comercial</strong></h1>'+
 '<p>Apresentamos nossa proposta de execução de serviços, com solução técnica, qualidade, segurança e compromisso.</p></div>'+
 '<div class="proposal-cover-card">'+
 coverInfo('user','Cliente',b.customer)+
 coverInfo('home','Obra / Local',[b.project,b.location].filter(Boolean).join(' · '))+
 coverInfo('calendar','Data da proposta',dateBR(b.createdAt?.slice(0,10)))+
 coverInfo('clock','Validade',dateBR(b.expiresOn))+'</div>'+
 '<div class="proposal-cover-bottom">'+
 '<div>'+icon('wrench',19)+' Instalações elétricas</div>'+
 '<div>'+icon('building',19)+' Construção civil</div>'+
 '<div>'+icon('clipboard',19)+' Projetos técnicos</div>'+
 '<div>'+icon('check',19)+' Consultoria e execução</div></div>';
const services=(rows,index,count,ref)=>
 '<div class="proposal-section-heading"><h1>Descrição dos serviços</h1>'+
 '<p>Escopo previsto para execução conforme o orçamento informado.</p></div>'+
 '<div class="proposal-services-table-wrap"><table class="proposal-services-table">'+
 '<colgroup><col style="width:73%"><col style="width:13%"><col style="width:14%"></colgroup>'+
 '<thead><tr><th>Descrição do serviço</th><th>Unidade</th><th>Quantidade</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td>'+e(r.description)+'</td><td>'+e(r.unit)+'</td>'+
 '<td>'+e(Number(r.quantity).toLocaleString('pt-BR',{maximumFractionDigits:3}))+'</td></tr>').join('')+
 '</tbody></table></div>'+
 '<div class="proposal-services-caption"><span>'+icon('check',16)+
 ' Descrições e quantitativos</span><span>Relação '+index+' de '+count+'</span></div>'+
 '<div class="proposal-services-watermark-note">CIVOLTEN · ELÉTRICA E CONSTRUÇÃO CIVIL</div>';
const card=(symbol,label,value)=>'<div class="proposal-term">'+
 '<span class="proposal-term-icon">'+icon(symbol,21)+'</span>'+
 '<div><h2>'+label+'</h2><p>'+show(value,'A definir entre as partes')+'</p></div></div>';
const conditions=(b,p,c)=>
 '<div class="proposal-conditions-heading"><h1>Investimento e<br><strong>Condições Comerciais</strong></h1></div>'+
 '<div class="proposal-investment"><div><span>'+icon('coins',29)+'</span>'+
 '<b>INVESTIMENTO TOTAL<br>DA PROPOSTA</b></div>'+
 '<strong>'+brl(p.totalSale)+'</strong></div>'+
 '<div class="proposal-terms">'+
 card('coins','Condições de Pagamento',c.paymentTerms)+
 card('calendar','Prazo de Execução',c.executionTerm)+
 card('check','Validade da Proposta',dateBR(b.expiresOn))+
 card('settings','Garantia dos Serviços',c.warrantyTerms)+
 '</div>'+
 (c.scopeNotes?'<div class="proposal-scope"><b>Escopo e exclusões</b><p>'+e(c.scopeNotes)+'</p></div>':'')+
 '<div class="proposal-notes"><h2>'+icon('file',19)+' Observações</h2>'+
 '<p>'+show(b.notes,'Sem observações adicionais.')+'</p></div>'+
 '<div class="proposal-accept"><h2>'+icon('check',19)+' Aceite da Proposta</h2>'+
 '<p>Declaro ciência do escopo, valor e condições descritos nesta proposta.</p>'+
 '<div class="proposal-signatures"><div><span></span><b>'+show(p.snapshot.companyName||'CIVOLTEN')+
 '</b><small>Responsável pela proposta</small></div><div><span></span><b>Cliente / Contratante</b>'+
 '<small>Nome e assinatura</small></div></div></div>'+
 (c.companyContact||c.companyDocument?'<div class="proposal-contact">'+
 (c.companyContact?'<span>Contato: '+e(c.companyContact)+'</span>':'')+
 (c.companyDocument?'<span>Documento: '+e(c.companyDocument)+'</span>':'')+
 '</div>':'');
export function printableBudget(b){
 let priced;
 try{priced=priceBudget(b)}catch{return '';}
 if(!priced)return '';
 const c=validateCommercial(b.commercial),groups=splitServicePages(priced.rows);
 const total=groups.length+2,ref=proposalRef(b),demo=b.demo!==false;
 const pages=[page('proposal-cover',1,total,ref,demo,cover(b,1,total,ref,demo))];
 groups.forEach((chunk,i)=>pages.push(page('proposal-services',i+2,total,ref,demo,
  services(chunk,i+1,groups.length,ref),'PROPOSTA COMERCIAL · SERVIÇOS')));
 pages.push(page('proposal-conditions',total,total,ref,demo,conditions(b,priced,c),
  'INVESTIMENTO E CONDIÇÕES COMERCIAIS'));
 return '<div class="budget-print budget-pdf-v5" role="document" aria-label="Proposta CIVOLTEN Signature para impressão">'+
 pages.join('')+'</div>';
}
