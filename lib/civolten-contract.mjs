// Contrato com dados comerciais: nunca importar salários, impostos, folha ou margem.
const clean=(v,n=4000)=>String(v??'').trim().slice(0,n);
export const defaultContractCompany=()=>({
 company_name:'CIVOLTEN — Construção & Elétrica',company_document:'',
 company_address:'',company_representative:'',company_phone:'',company_email:'',city:''
});
export const contractDefaults=()=>({
 title:'',role:'prestadora',counterparty_name:'',counterparty_document:'',
 counterparty_address:'',counterparty_representative:'',counterparty_contact:'',
 scope:'',location:'',start_on:'',end_on:'',value_cents:0,payment_terms:'',payment_schedule:'',
 materials:'As partes definirão por escrito quais materiais e insumos serão fornecidos por cada uma, incluindo aquisição, transporte, armazenamento, perdas e destinação dos resíduos. Nenhum fornecimento não previsto será presumido.',
 obligations:'A prestadora executará o escopo acordado com segurança e diligência, observadas as normas técnicas aplicáveis. A contratante providenciará acesso ao local, informações e autorizações sob sua responsabilidade. As partes comunicarão obstáculos relevantes por escrito.',
 changes:'Acréscimos, exclusões ou alterações no escopo, preço ou prazo dependerão de aprovação prévia por escrito, com descrição dos serviços e seus impactos. A execução de serviços adicionais não será presumida.',
 termination:'O encerramento antecipado será comunicado por escrito. As partes apurarão os serviços comprovadamente executados, materiais adquiridos para o contrato, pagamentos já realizados e obrigações legais aplicáveis. Eventuais valores devidos serão discriminados, sem afastar direitos legalmente assegurados.',
 warranty:'Falhas e pedidos de correção serão comunicados por escrito com descrição do problema e condições de acesso para vistoria. Prazos e procedimentos específicos poderão ser acordados pelas partes, sem excluir ou reduzir garantias e responsabilidades legais aplicáveis.',
 delays:'Ocorrências que possam alterar o cronograma (por exemplo, falta de acesso, condições imprevistas ou interrupções) serão comunicadas por escrito, com justificativa e avaliação conjunta do novo prazo, sem afastar direitos legais.',
 acceptance:'Ao concluir o escopo, a prestadora comunicará a entrega para vistoria. As partes registrarão por escrito o recebimento, pendências objetivas, eventuais correções e suas datas, sem prejuízo das garantias legais.',
 technical:'Quando exigível para o serviço contratado, serão indicados o responsável técnico, o registro profissional e a ART/RRT ou documento pertinente antes da execução da atividade regulada.',
 privacy:'Os dados pessoais das partes e representantes serão utilizados apenas para formalização e execução deste contrato, obrigações legais e exercício regular de direitos, observada a legislação aplicável.',
 special_terms:'',jurisdiction:'',revision_of:'',revision_reason:''
});
// Aceita também o CNPJ alfanumérico implantado pela Receita Federal em 2026.
// Os 12 primeiros caracteres são alfanuméricos e os dois verificadores permanecem numéricos.
export function validBrazilDocument(value){
 const raw=String(value??'').toUpperCase().replace(/[.\\/\\-\\s]/g,'');
 if(/^\\d{11}$/.test(raw)){
  if(/^(.)\\1{10}$/.test(raw))return false;
  let sum=0;for(let i=0;i<9;i++)sum+=Number(raw[i])*(10-i);
  let digit=(sum*10)%11;if(digit===10)digit=0;
  if(digit!==Number(raw[9]))return false;
  sum=0;for(let i=0;i<10;i++)sum+=Number(raw[i])*(11-i);
  digit=(sum*10)%11;if(digit===10)digit=0;
  return digit===Number(raw[10]);
 }
 if(!/^[A-Z0-9]{12}\\d{2}$/.test(raw)||/^(.)\\1{11}$/.test(raw.slice(0,12)))return false;
 const chars=raw.slice(0,12).split('').map(char=>char.charCodeAt(0)-48);
 const calc=(numbers,weights)=>{const sum=numbers.reduce((acc,v,i)=>acc+v*weights[i],0);const rest=sum%11;return rest<2?0:11-rest};
 const one=calc(chars,[5,4,3,2,9,8,7,6,5,4,3,2]);
 const two=calc([...chars,one],[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 return one===Number(raw[12])&&two===Number(raw[13]);
}
const isoDate=value=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
};
export function sanitizeContract(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Contrato inválido.');
 const defaults=contractDefaults(),result={};
 for(const key of Object.keys(defaults)){
  if(key==='value_cents'){
   const val=Number(input[key]??0);
   if(!Number.isSafeInteger(val)||val<0||val>100000000000)throw Error('Valor do contrato inválido.');
   result[key]=val;
  }else if(key==='role'){
   result[key]=input[key]??'prestadora';
   if(!['prestadora','contratante'].includes(result[key]))throw Error('Selecione o papel da sua empresa.');
  }else result[key]=clean(input[key]??defaults[key],key==='scope'?12000:key==='obligations'||key==='termination'||key==='special_terms'?4000:2000);
 }
 const companyInput=input.company||{};
 if(!companyInput||typeof companyInput!=='object'||Array.isArray(companyInput))throw Error('Dados da empresa inválidos.');
 result.company={};
 for(const key of Object.keys(defaultContractCompany()))result.company[key]=clean(companyInput[key]??defaultContractCompany()[key],250);
 result.budget_id=typeof input.budget_id==='string'?input.budget_id:null;
 result.revision_of=typeof input.revision_of==='string'?input.revision_of:'';
 result.revision_reason=clean(input.revision_reason,500);
 if(JSON.stringify(result).length>40000)throw Error('Contrato muito extenso.');
 return result;
}
export function validateContractForExport(input){
 const c=sanitizeContract(input);
 if(c.title.length<3)throw Error('Informe o título do contrato.');
 if(!c.company.company_name||!validBrazilDocument(c.company.company_document))throw Error('Configure um CPF ou CNPJ válido para a empresa em Configurações.');
 if(!c.counterparty_name||!validBrazilDocument(c.counterparty_document))throw Error('Preencha o nome e um CPF ou CNPJ válido da outra parte.');
 if(c.scope.length<12)throw Error('Descreva o objeto e o escopo dos serviços.');
 if(!c.location)throw Error('Informe o local de execução.');
 if(!isoDate(c.start_on)||!isoDate(c.end_on)||c.end_on<c.start_on)throw Error('Informe datas válidas de início e término.');
 if(!c.value_cents)throw Error('Informe o valor global do contrato.');
 if(c.payment_terms.length<6)throw Error('Informe as condições de pagamento.');
 if(c.payment_schedule.length<8)throw Error('Detalhe parcelas, valores, vencimentos ou marcos de medição/pagamento.');
 if(c.revision_of&&(!/^[0-9a-f-]{36}$/i.test(c.revision_of)||c.revision_reason.length<5))throw Error('Justifique a revisão deste contrato.');
 return c;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const when=v=>isoDate(v)?new Date(v+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC'}):'';
const rich=v=>esc(v).replace(/\r?\n/g,'<br>');
export function contractFromBudget(b,profile={}){
 const content=b?.content||{},scope=(content.scope_items||[]).filter(x=>x?.description).map(x=>
  '- '+x.description+' — '+x.quantity+' '+(x.unit||'')).join('\n');
 const base=contractDefaults();
 return {...base,title:clean(b?.title||'',180),counterparty_name:clean(b?.customer||'',200),
  scope:clean([content.services,scope].filter(Boolean).join('\n'),12000),
  location:clean(content.address),value_cents:Number(b?.price_cents)||0,
  payment_terms:'',payment_schedule:'',budget_id:b?.id||null,company:{...defaultContractCompany(),...profile}};
}
export function buildContractHtml(input,{id=null}={}){
 const c=validateContractForExport(input);
 const reference=typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)?'CT-'+id.slice(0,8).toUpperCase():'MINUTA — sem registro';
 const company={name:c.company.company_name,document:c.company.company_document,address:c.company.company_address,
  representative:c.company.company_representative,contact:c.company.company_phone||c.company.company_email};
 const other={name:c.counterparty_name,document:c.counterparty_document,address:c.counterparty_address,
  representative:c.counterparty_representative,contact:c.counterparty_contact};
 const contractor=c.role==='prestadora'?other:company;
 const performer=c.role==='prestadora'?company:other;
 const party=(p)=>'<strong>'+esc(p.name)+'</strong>, documento '+esc(p.document)+
  (p.address?', com endereço em '+esc(p.address):'')+
  (p.representative?', representada por '+esc(p.representative):'')+
  (p.contact?', contato '+esc(p.contact):'')+'.';
 const clause=(n,label,body)=>'<section class="contract-clause"><h2>Cláusula '+n+' — '+label+'</h2><p>'+rich(body)+'</p></section>';
 return '<article class="contract-document"><header class="contract-document-head">'+
  '<img src="/assets/civolten-logo.png" alt="CIVOLTEN" class="contract-logo">'+
  '<div><span>DOCUMENTO COMERCIAL</span><h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>'+
  '<p>Referência: '+esc(reference)+(c.revision_of?' · Revisão de CT-'+esc(c.revision_of.slice(0,8).toUpperCase()):'')+'</p></div></header>'+
  '<div class="contract-document-parties"><h2>IDENTIFICAÇÃO DAS PARTES</h2>'+
  '<p><strong>CONTRATANTE:</strong> '+party(contractor)+'</p>'+
  '<p><strong>CONTRATADA / PRESTADORA:</strong> '+party(performer)+'</p></div>'+
  clause(1,'Objeto',c.title+'.\n'+c.scope)+
  clause(2,'Local e prazo','Local de execução: '+c.location+'.\nInício previsto: '+when(c.start_on)+'.\nTérmino previsto: '+when(c.end_on)+'.')+
  clause(3,'Preço global e pagamento','Valor total contratado: '+money(c.value_cents)+'.\\nCondições de pagamento: '+c.payment_terms+'\\nCronograma de parcelas / medições: '+c.payment_schedule)+
  clause(4,'Materiais e insumos',c.materials)+
  clause(5,'Obrigações das partes',c.obligations)+
  clause(6,'Alterações contratuais',c.changes)+
  clause(7,'Encerramento antecipado',c.termination)+
  clause(8,'Garantias e correções',c.warranty)+
  clause(9,'Atrasos, suspensão e prorrogações',c.delays)+
  clause(10,'Vistoria e aceite da entrega',c.acceptance)+
  clause(11,'Responsabilidade técnica, quando exigível',c.technical)+
  clause(12,'Tratamento de dados pessoais',c.privacy)+
  (c.special_terms?clause(13,'Disposições particulares',c.special_terms):'')+
  (c.jurisdiction?clause(14,'Foro e solução de controvérsias','Foro indicado pelas partes: '+c.jurisdiction+'. Aplicam-se as normas legais pertinentes.'): '')+
  '<footer class="contract-signatures"><p>Local e data da assinatura: _____________________________________________</p>'+
  '<div class="contract-signature-grid"><div><span></span><strong>CONTRATANTE</strong><small>'+esc(contractor.name)+'</small></div>'+
  '<div><span></span><strong>CONTRATADA / PRESTADORA</strong><small>'+esc(performer.name)+'</small></div></div>'+
  '<div class="contract-signature-grid witnesses"><div><span></span><small>Testemunha 1 — nome e documento</small></div>'+
  '<div><span></span><small>Testemunha 2 — nome e documento</small></div></div></footer>'+
  '<div class="contract-foot">Documento elaborado a partir das informações fornecidas pelas partes. '+esc(reference)+
  '. Assinaturas devem ser realizadas pelas partes; status no sistema não constitui assinatura eletrônica.</div></article>';
}
