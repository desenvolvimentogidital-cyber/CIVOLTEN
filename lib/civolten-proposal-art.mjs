/**
 * Proposta CIVOLTEN com as sete artes ORIGINAIS como camada de fundo.
 * Requer assets/proposal-art/{01..07}.png no mesmo commit de integração.
 * Não ativar em produção sem as sete imagens e verificação de impressão.
 */
const tx=v=>String(v??'').trim();
const esc=v=>tx(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=v=>Number(v);
const validQty=v=>Number.isFinite(num(v))&&num(v)>0&&num(v)<=1000000;
const overlay=(cls,body)=>'<div class="cv-art-over '+cls+'">'+body+'</div>';
const field=(key,value)=>'<div class="cv-art-field"><small>'+esc(key)+'</small><strong>'+esc(value||'Não informado')+'</strong></div>';
const itemTable=items=>'<div class="cv-art-table-head"><span>DESCRIÇÃO</span><span>UN.</span><span>QTD.</span></div>'+
 items.map(it=>'<div class="cv-art-table-row"><span>'+esc(it.description)+'</span><span>'+esc(it.unit)+'</span><strong>'+esc(num(it.quantity).toLocaleString('pt-BR',{maximumFractionDigits:2}))+'</strong></div>').join('');
const brief=v=>'<p>'+esc(v).replace(/\n/g,'<br>')+'</p>';
const page=(n,body)=>'<section class="cv-art-page" aria-label="Proposta CIVOLTEN, página '+n+' de 7">'+
 '<img class="cv-art-back" src="/assets/proposal-art/'+String(n).padStart(2,'0')+'.png" alt="">'+body+'</section>';
export const proposalArtPaths=Object.freeze(Array.from({length:7},(_,i)=>'/assets/proposal-art/'+String(i+1).padStart(2,'0')+'.png'));
export function buildArtProposalHtml(budget,{priceCents,id=null,date=new Date()}={}){
 if(!budget||!tx(budget.title))throw Error('Informe o nome da obra');
 if(!Number.isSafeInteger(priceCents)||priceCents<0)throw Error('Valor comercial inválido');
 const dateString=date instanceof Date&&!Number.isNaN(date.valueOf())?date.toLocaleDateString('pt-BR'):'A confirmar';
 const reference=id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)?'CV-'+id.slice(0,8).toUpperCase():'Prévia sem número';
 const days=Number(budget.days);
 const duration=Number.isFinite(days)&&days>0?
  days.toLocaleString('pt-BR',{maximumFractionDigits:2})+(days===1?' dia de execução':' dias de execução'):'A confirmar';
 const validity=Number(budget.validity_days);
 const validText=Number.isInteger(validity)&&validity>=1&&validity<=365?validity+' dias':'A confirmar';
 const items=Array.isArray(budget.scope_items)?budget.scope_items.filter(x=>x&&tx(x.description)&&validQty(x.quantity)):[];
 const civ=items.filter(x=>tx(x.category)!=='eletrica');
 const ele=items.filter(x=>tx(x.category)==='eletrica');
 if(civ.length>8||ele.length>8)throw Error('A arte original comporta até 8 itens em cada página de escopo. Distribua o memorial em páginas adicionais antes de emitir.');
 const limits=[
  ['title',75,'Nome da obra'],['customer',65,'Cliente'],['address',100,'Local da obra'],
  ['technical_responsible',90,'Responsável técnico'],['civil_services',320,'Descrição civil'],
  ['electrical_services',320,'Descrição elétrica'],['payment_terms',160,'Condições de pagamento']
 ];
 for(const [key,max,label] of limits){
  if(tx(budget[key]).length>max)throw Error(label+': limite de '+max+' caracteres para esta arte. Revise o texto antes de exportar.');
 }
 if(!tx(budget.civil_services)&&tx(budget.services).length>320)
  throw Error('Descrição dos serviços: limite de 320 caracteres para esta arte.');
 const price=money(priceCents);
 const introC=tx(budget.civil_services)||tx(budget.services)||'Serviços civis conforme o escopo contratado.';
 const introE=tx(budget.electrical_services)||'Instalações elétricas conforme o escopo contratado.';
 const terms=tx(budget.payment_terms)||'A confirmar';
 // O gerador recebe SOMENTE informações destinadas ao cliente; não serializar budget completo.
 return '<article class="cv-art-proposal" aria-label="Proposta comercial CIVOLTEN — artes originais">'+
 page(1,overlay('cv-art-cover-values',
  field('Cliente',budget.customer)+field('Projeto',budget.title)+field('Data',dateString)+field('Proposta nº',reference)))+
 page(2,overlay('cv-art-proposal-values',
  field('Cliente',budget.customer)+field('Projeto',budget.title)+field('Local da obra',budget.address)+
  field('Responsável técnico',budget.technical_responsible||'Não indicado')))+
 page(3,'<div class="cv-art-clean cv-art-clean-scope" aria-hidden="true"></div>'+overlay('cv-art-scope-fields',
  '<h3>Serviços de construção civil</h3>'+brief(introC)+
  itemTable(civ)))+
 page(4,'<div class="cv-art-clean cv-art-clean-scope" aria-hidden="true"></div>'+overlay('cv-art-scope-fields',
  '<h3>Serviços de instalações elétricas</h3>'+brief(introE)+
  itemTable(ele)))+
 page(5,overlay('cv-art-duration',field('Prazo previsto',duration)))+
 page(6,'<div class="cv-art-clean cv-art-clean-pricing" aria-hidden="true"></div>'+overlay('cv-art-pricing','<h3>Investimento total</h3><p>Preço global dos serviços contratados</p>'+
  '<strong class="cv-art-price">'+esc(price)+'</strong><p>Sem divulgação de custos e margens internos.</p>')+
  overlay('cv-art-terms',field('Validade da proposta',validText)+field('Prazo de execução',duration)+
  field('Condições de pagamento',terms)))+
 page(7,overlay('cv-art-signatures',field('Contratante',budget.customer)+field('Data da proposta',dateString)))+'</article>';
}
