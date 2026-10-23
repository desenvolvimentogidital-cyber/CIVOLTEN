/**
 * CIVOLTEN: as sete artes oficiais são imagens de FUNDO do PDF.
 * Apenas dados do cliente são escritos por cima, nas regiões reservadas.
 * Custos, margem, salários, impostos e equipe nunca são serializados.
 */
const str=v=>String(v??'').trim();
const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=c=>Number(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtQty=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const field=(label,value)=>'<div class="cv-art-field"><small>'+esc(label)+'</small><strong>'+esc(value||'Não informado')+'</strong></div>';
const put=(cls,content)=>'<div class="cv-art-over '+cls+'">'+content+'</div>';
const art=(n,body)=>'<section class="cv-art-page" aria-label="Página '+n+' da proposta CIVOLTEN">'+
 '<img class="cv-art-back" src="/assets/proposal-art/'+String(n).padStart(2,'0')+'.png" '+
 'alt="Arte CIVOLTEN da página '+n+' — construção e elétrica">'+body+'</section>';
export const proposalArtPaths=Object.freeze(Array.from({length:7},(_,i)=>'/assets/proposal-art/'+String(i+1).padStart(2,'0')+'.png'));
const serviceRows=items=>'<div class="cv-art-service-list">'+
 Array.from({length:6},(_,i)=>{
  const it=items[i];
  if(!it)return '<div class="cv-art-service-row cv-art-empty-row" aria-hidden="true"></div>';
  return '<div class="cv-art-service-row"><strong>'+esc(it.description)+'</strong>'+
   '<span>'+esc(it.unit)+' · Quantidade: '+esc(fmtQty(it.quantity))+'</span></div>';
 }).join('')+'</div>';
const permittedItems=items=>(Array.isArray(items)?items:[])
 .filter(x=>x&&str(x.description)&&Number.isFinite(Number(x.quantity))&&Number(x.quantity)>0&&str(x.unit));
const dateOf=d=>d instanceof Date&&!Number.isNaN(d.getTime())?d.toLocaleDateString('pt-BR'):'A confirmar';

/** Validação específica do limite físico das sete artes A4. */
export function artProposalIssues(b){
 const errors=[];
 const max={
  title:72,customer:56,address:75,technical_responsible:64,
  company_intro:420,civil_services:180,electrical_services:180,
  methodology:100,notes:120,payment_terms:120,warranty_terms:180
 };
 for(const [k,v] of Object.entries(max))
  if(str(b?.[k]).length>v)
   errors.push({selector:'[data-draft="'+k+'"]',message:'Texto muito longo para a arte desta página (máximo '+v+' caracteres).'});
 const items=permittedItems(b?.scope_items);
 const civil=items.filter(x=>str(x.category)!=='eletrica');
 const electrical=items.filter(x=>str(x.category)==='eletrica');
 if(civil.length>6||electrical.length>6)
  errors.push({selector:'.scope-list',message:'O design comporta até seis itens por página de escopo. Simplifique os itens ou use o PDF tradicional para um memorial maior.'});
 if(!civil.length&&!str(b?.civil_services)&&str(b?.services).length>180)
  errors.push({selector:'[data-draft="services"]',message:'Resuma o escopo civil em até 180 caracteres para a arte.'});
 if(!str(b?.payment_terms))errors.push({selector:'[data-draft="payment_terms"]',message:'Informe as condições de pagamento.'});
 return errors;
}
export function buildArtProposalHtml(b,{priceCents,id=null,date=new Date()}={}){
 if(!b||!str(b.title))throw Error('Informe o nome da obra');
 if(!Number.isSafeInteger(priceCents)||priceCents<=0)throw Error('O preço final da proposta deve ser maior que R$ 0,00.');
 const problems=artProposalIssues(b);
 if(problems.length)throw Error(problems[0].message);
 const items=permittedItems(b.scope_items);
 const civil=items.filter(x=>str(x.category)!=='eletrica');
 const electrical=items.filter(x=>str(x.category)==='eletrica');
 const ref=id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)?'CV-'+id.slice(0,8).toUpperCase():'Aguardando numeração';
 const issued=dateOf(date);
 const n=Number(b.days);
 const duration=Number.isFinite(n)&&n>0?fmtQty(n)+(n===1?' dia':' dias'):'A confirmar';
 const validity=Number(b.validity_days);
 const validText=Number.isInteger(validity)&&validity>0&&validity<=365?validity+' dias':'A confirmar';
 const globalValue=money(priceCents);
 const civilText=str(b.civil_services)||str(b.services)||'Confira os itens do escopo aprovado.';
 const electricalText=str(b.electrical_services)||'Conforme os serviços elétricos contratados.';
 const defaultIntroduction='A CIVOLTEN oferece soluções de construção civil e instalações elétricas, com foco em qualidade, segurança e planejamento.';
 const about=str(b.company_intro)?put('cv-art-about',esc(b.company_intro)):''; // texto-padrão já pertence à arte
 const warranties=str(b.warranty_terms)?put('cv-art-warranty',esc(b.warranty_terms)):'';
 const method=str(b.methodology);
 const notes=str(b.notes);
 const civilRows=civil.length?civil:[{description:civilText,unit:'serviço',quantity:1,category:'civil'}];
 const electricalRows=electrical.length?electrical:
  (str(b.electrical_services)?[{description:electricalText,unit:'serviço',quantity:1,category:'eletrica'}]:[]);
 return '<article class="cv-art-proposal" aria-label="Proposta comercial CIVOLTEN com sete artes originais">'+
  art(1,put('cv-art-cover-values',
    field('Cliente',b.customer)+field('Projeto',b.title)+field('Data',issued)+field('Proposta nº',ref)))+
  art(2,about+put('cv-art-proposal-values',
    field('Cliente',b.customer)+field('Projeto',b.title)+field('Local da obra',b.address)+
    field('Responsável técnico',b.technical_responsible||'Não indicado')))+
  art(3,put('cv-art-scope-intro',esc(civilText))+
     put('cv-art-scope-fields',serviceRows(civilRows))+
     (notes?put('cv-art-notes',esc(notes)) :''))+
  art(4,put('cv-art-scope-intro',esc(electricalText))+
     put('cv-art-scope-fields',serviceRows(electricalRows)))+
  art(5,put('cv-art-process-note','<strong>Prazo previsto: '+esc(duration)+'</strong>'+
      (method?'<span>'+esc(method)+'</span>':'')))+
  art(6,put('cv-art-pricing',
     '<h3>Resumo do investimento</h3>'+
     '<div class="cv-art-price-table"><div><span>Serviços contratados</span><strong>'+esc(globalValue)+'</strong></div>'+
     '<div class="cv-art-price-total"><span>Investimento global</span><strong>'+esc(globalValue)+'</strong></div></div>'+
     '<p>Valor total conforme escopo aprovado.</p>')+
    put('cv-art-price-note','Valor global da proposta. Valores unitários e custos internos não são apresentados.')+
    put('cv-art-terms',field('Validade da proposta',validText)+field('Prazo de execução',duration)+
     field('Condições de pagamento',b.payment_terms)))+
  art(7,warranties+
    put('cv-art-signature-customer',esc(b.customer))+
    put('cv-art-signature-date',issued))+
  '</article>';
}
