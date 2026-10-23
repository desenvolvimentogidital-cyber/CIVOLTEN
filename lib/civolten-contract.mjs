// Contrato com dados comerciais: nunca importar salários, impostos, folha ou margem.
const clean=(v,n=4000)=>String(v??'').trim().slice(0,n);
export const defaultContractCompany=()=>({
 company_name:'CIVOLTEN — Construção & Elétrica',company_document:'',
 company_address:'',company_representative:'',company_phone:'',company_email:'',city:''
});
export const contractDefaults=()=>({
 title:'',role:'prestadora',counterparty_name:'',counterparty_document:'',
 counterparty_address:'',counterparty_representative:'',counterparty_contact:'',
 scope:'',location:'',start_on:'',end_on:'',value_cents:0,payment_terms:'',
 materials:'A responsabilidade pelo fornecimento de materiais deve seguir o que as partes definirem por escrito.',
 obligations:'A execução seguirá o escopo e o cronograma acordados. As partes deverão permitir acesso ao local, colaborar e informar obstáculos relevantes.',
 changes:'Alterações de escopo, valor ou prazo deverão ser acordadas por escrito antes da execução dos serviços adicionais.',
 termination:'Eventual encerramento antecipado será documentado pelas partes, com apuração dos serviços executados, valores pagos e obrigações legalmente aplicáveis.',
 warranty:'Eventuais correções e garantias observarão o escopo contratado e a legislação aplicável.',
 special_terms:'',jurisdiction:''
});
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
 if(JSON.stringify(result).length>40000)throw Error('Contrato muito extenso.');
 return result;
}
export function validateContractForExport(input){
 const c=sanitizeContract(input);
 if(c.title.length<3)throw Error('Informe o título do contrato.');
 if(!c.company.company_name||!c.company.company_document)throw Error('Preencha o nome legal e o CPF/CNPJ da sua empresa em Configurações.');
 if(!c.counterparty_name||!c.counterparty_document)throw Error('Preencha o nome e CPF/CNPJ da outra parte.');
 if(c.scope.length<12)throw Error('Descreva o objeto e o escopo dos serviços.');
 if(!c.location)throw Error('Informe o local de execução.');
 if(!isoDate(c.start_on)||!isoDate(c.end_on)||c.end_on<c.start_on)throw Error('Informe datas válidas de início e término.');
 if(!c.value_cents)throw Error('Informe o valor global do contrato.');
 if(c.payment_terms.length<6)throw Error('Informe as condições de pagamento.');
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
  payment_terms:'',budget_id:b?.id||null,company:{...defaultContractCompany(),...profile}};
}
export function buildContractHtml(input,{id=null}={}){
 const c=validateContractForExport(input);
 const reference=typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)?'CT-'+id.slice(0,8).toUpperCase():'Minuta sem número';
 const provider=c.role==='prestadora'?c.company:c;
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
  '<p>Referência: '+esc(reference)+'</p></div></header>'+
  '<div class="contract-document-parties"><h2>IDENTIFICAÇÃO DAS PARTES</h2>'+
  '<p><strong>CONTRATANTE:</strong> '+party(contractor)+'</p>'+
  '<p><strong>CONTRATADA / PRESTADORA:</strong> '+party(performer)+'</p></div>'+
  clause(1,'Objeto',c.title+'.\n'+c.scope)+
  clause(2,'Local e prazo','Local de execução: '+c.location+'.\nInício previsto: '+when(c.start_on)+'.\nTérmino previsto: '+when(c.end_on)+'.')+
  clause(3,'Preço global e pagamento','Valor total contratado: '+money(c.value_cents)+'.\nCondições de pagamento: '+c.payment_terms)+
  clause(4,'Materiais e insumos',c.materials)+
  clause(5,'Obrigações das partes',c.obligations)+
  clause(6,'Alterações contratuais',c.changes)+
  clause(7,'Encerramento antecipado',c.termination)+
  clause(8,'Garantias e correções',c.warranty)+
  (c.special_terms?clause(9,'Disposições particulares',c.special_terms):'')+
  (c.jurisdiction?clause(c.special_terms?10:9,'Foro e solução de controvérsias','Foro indicado pelas partes: '+c.jurisdiction+'. Aplicam-se as normas legais pertinentes.'): '')+
  '<footer class="contract-signatures"><p>Local e data da assinatura: _____________________________________________</p>'+
  '<div class="contract-signature-grid"><div><span></span><strong>CONTRATANTE</strong><small>'+esc(contractor.name)+'</small></div>'+
  '<div><span></span><strong>CONTRATADA / PRESTADORA</strong><small>'+esc(performer.name)+'</small></div></div>'+
  '<div class="contract-signature-grid witnesses"><div><span></span><small>Testemunha 1 — nome e documento</small></div>'+
  '<div><span></span><small>Testemunha 2 — nome e documento</small></div></div></footer>'+
  '<div class="contract-foot">Documento elaborado pelas partes a partir das informações fornecidas. '+esc(reference)+'</div></article>';
}
