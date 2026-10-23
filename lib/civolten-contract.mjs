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
 warranty:'A contratada responderá pelas garantias legais aplicáveis à natureza do serviço e, quando expressamente concedida, pela garantia contratual adicional, a ser descrita por escrito. Vícios, falhas e pedidos de correção serão comunicados com descrição da ocorrência e acesso para vistoria. Nos casos abrangidos pelo art. 618 do Código Civil, aplicam-se as exigências legais relativas à solidez e segurança da obra; este prazo não se aplica indistintamente a pequenos reparos. Nenhuma disposição reduz ou elimina direitos de consumidores ou outras garantias legais.',
 delays:'Ocorrências que possam alterar o cronograma (por exemplo, falta de acesso, condições imprevistas ou interrupções) serão comunicadas por escrito, com justificativa e avaliação conjunta do novo prazo, sem afastar direitos legais.',
 acceptance:'Ao concluir o escopo, a prestadora comunicará a entrega para vistoria. As partes registrarão por escrito o recebimento, pendências objetivas, eventuais correções e suas datas, sem prejuízo das garantias legais.',
 technical:'Quando a atividade exigir responsabilidade técnica legalmente habilitada, deverão ser identificados profissional responsável, conselho e registro pertinente, com ART, RRT ou TRT, conforme a habilitação e a atividade. Os registros exigíveis serão providenciados no momento legalmente devido, antes da execução da atividade correspondente. Não se presume habilitação ou emissão de documento que não tenha sido comprovado.',
 privacy:'Os dados pessoais das partes e representantes serão utilizados apenas para formalização e execução deste contrato, obrigações legais e exercício regular de direitos, observada a legislação aplicável.',

 contract_template_version:'2',
 scope_limits:'Integram o contrato somente os serviços, quantitativos, locais, projetos e anexos identificados e aceitos pelas partes. Serviços não descritos, demolições adicionais, adequações de redes existentes ou acabamentos não especificados exigem orçamento e autorização próprios. Havendo divergência entre documentos, as partes deverão esclarecê-la por escrito antes de executar o item afetado.',
 documentation:'Projetos, memoriais, plantas, especificações, levantamento de quantitativos, proposta aprovada e aditivos assinados integram o contrato quando identificados em anexo. A responsabilidade por elaboração, compatibilização e aprovação dos projetos deve constar da documentação da contratação; a execução não presume contratação de projeto ou fiscalização independente.',
 site_access:'A contratante disponibilizará acesso seguro ao imóvel, condições de entrada e saída de pessoal e equipamentos, informações sobre instalações existentes e a disponibilidade de água e energia, quando necessárias e previamente ajustadas. Restrições de horário, circulação, condomínio ou condomínio edilício deverão ser comunicadas antecipadamente.',
 permits:'As partes identificarão por escrito quem obterá alvarás, autorizações do proprietário ou condomínio, licenças, liberações da concessionária e demais documentos exigíveis, antes da etapa correspondente. Nenhuma atividade que exija autorização poderá iniciar sem sua obtenção.',
 work_schedule:'A execução observará as datas e os horários pactuados e poderá ser organizada por etapas compatíveis com o acesso, a segurança, os materiais e os demais serviços no local. Impedimentos relevantes serão registrados e tratados conforme a cláusula de atrasos.',
 measurements:'Se houver medições por etapa, a contratada apresentará o relatório dos serviços efetivamente executados, com descrição e quantitativos pertinentes. A contratante poderá apontar divergências fundamentadas antes da aprovação, preservados os direitos legais.',
 billing:'Os pagamentos ocorrerão nas datas ou marcos de medição expressamente previstos no cronograma financeiro. A nota fiscal ou documento equivalente e os comprovantes serão fornecidos quando exigíveis, conforme o regime tributário e as obrigações legais aplicáveis. Quaisquer retenções obrigatórias serão identificadas na documentação de cobrança.',
 adjustments:'Alterações de preço, reajustes, reequilíbrios ou custos extraordinários não serão automáticos: dependerão de fundamento contratual ou legal e de negociação documentada, com indicação dos motivos, valor e impacto no cronograma, preservados os direitos previstos na legislação.',
 electrical_safety:'Os serviços elétricos serão planejados e executados por profissionais legalmente habilitados, qualificados, capacitados ou autorizados, conforme a atividade. Serão observadas as medidas aplicáveis da NR-10 e as normas técnicas pertinentes, inclusive desenergização, impedimento de reenergização, verificação de ausência de tensão, identificação de circuitos e controle de acesso, conforme a análise de risco. Trabalhos energizados somente ocorrerão nas hipóteses legalmente permitidas e com os requisitos específicos de segurança.',
 worksite_safety:'A execução seguirá as medidas de prevenção de riscos compatíveis com as atividades contratadas, inclusive NR-18 quando aplicável, procedimentos de proteção coletiva e individual, sinalização, isolamento de áreas, trabalho em altura e demais exigências pertinentes. Perigo grave e iminente poderá exigir interrupção imediata da atividade e comunicação à contratante.',
 subcontracting:'A eventual contratação de terceiros para serviços integrantes do escopo observará a legislação, as habilitações exigidas e as responsabilidades correspondentes. A contratação de terceiros não afasta as obrigações da parte responsável perante a outra, ressalvadas as condições legalmente aplicáveis.',
 damage_and_insurance:'As partes registrarão as condições preexistentes do imóvel e de equipamentos quando necessário. Danos comprovadamente causados por culpa, dolo ou descumprimento de dever legal serão apurados nos termos da legislação. Seguros específicos somente serão exigidos quando previstos por escrito ou legalmente obrigatórios.',
 waste_management:'A destinação de entulho, sucata, embalagens, componentes elétricos e demais resíduos observará as normas ambientais e exigências locais aplicáveis. A divisão de custos de caçambas, transporte, retirada e descarte deverá seguir o escopo e o ajuste de materiais e insumos.',
 unforeseen:'Interferências ocultas, deterioração não aparente, ausência de infraestrutura, vícios preexistentes ou condições não identificáveis razoavelmente antes do início serão documentados e comunicados. A execução de providências fora do escopo dependerá de avaliação técnica, aprovação e eventual ajuste de preço ou prazo, salvo medidas urgentes para evitar risco imediato.',
 late_payment:'Em caso de atraso de pagamento, a parte credora comunicará a pendência e concederá oportunidade razoável de regularização, observados o cronograma e os direitos previstos em lei. Juros, multa ou correção somente poderão ser cobrados se pactuados validamente ou legalmente devidos; eventual suspensão de atividades observará as condições legais.',
 liability:'Cada parte responderá por prejuízos que lhe sejam juridicamente imputáveis conforme sua conduta, o nexo causal e a legislação aplicável. Esta cláusula não exclui direitos do consumidor, reparação por vícios, obrigações de segurança ou responsabilidades que a lei não permita limitar.',
 confidentiality:'Informações técnicas, comerciais, plantas e dados não públicos compartilhados exclusivamente para a contratação serão usados para executar o objeto ou cumprir obrigações legais, com acesso restrito a quem necessitar. Esta obrigação não impede divulgações exigidas por lei, autoridades competentes ou exercício regular de direitos.',
 communications:'Aprovações de etapas, alterações de escopo, comunicações de impedimentos, solicitações de vistoria e notificações serão registradas por meio capaz de comprovar conteúdo, data e destinatário, inclusive e-mail ou outro canal acordado por escrito. As partes manterão seus contatos atualizados.',
 dispute_resolution:'Havendo divergência, as partes procurarão solução documentada e consensual, sem impedir medidas urgentes nem o acesso ao Poder Judiciário. Direitos do consumidor, regras de competência e foro legalmente aplicáveis prevalecem sobre indicação contratual incompatível.',
 general_provisions:'A tolerância eventual quanto ao cumprimento de obrigação não implica renúncia definitiva. A nulidade de disposição isolada não prejudica as demais cláusulas válidas, se preservado o equilíbrio contratual. Prevalecem as garantias legais, normas de ordem pública e direitos irrenunciáveis. Alterações relevantes deverão constar de aditivo identificado.',
 special_terms:'',jurisdiction:'',revision_of:'',revision_reason:''
});
// Aceita também o CNPJ alfanumérico implantado pela Receita Federal em 2026.
// Os 12 primeiros caracteres são alfanuméricos e os dois verificadores permanecem numéricos.
export function validBrazilDocument(value){
 const raw=String(value??'').toUpperCase().replace(/[.\/\-\s]/g,'');
 if(/^\d{11}$/.test(raw)){
  if(/^(.)\1{10}$/.test(raw))return false;
  let sum=0;for(let i=0;i<9;i++)sum+=Number(raw[i])*(10-i);
  let digit=(sum*10)%11;if(digit===10)digit=0;
  if(digit!==Number(raw[9]))return false;
  sum=0;for(let i=0;i<10;i++)sum+=Number(raw[i])*(11-i);
  digit=(sum*10)%11;if(digit===10)digit=0;
  return digit===Number(raw[10]);
 }
 if(!/^[A-Z0-9]{12}\d{2}$/.test(raw)||/^(.)\1{11}$/.test(raw.slice(0,12)))return false;
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
  }else if(key==='contract_template_version'){
   result[key]=input[key]??'1';
   if(!['1','2'].includes(result[key]))throw Error('Versão de contrato inválida.');
  }else if(key==='role'){
   result[key]=input[key]??'prestadora';
   if(!['prestadora','contratante'].includes(result[key]))throw Error('Selecione o papel da sua empresa.');
  }else{
   const current=String(input[key]??defaults[key]).trim();
   const nextModel=(input.contract_template_version??'1')==='2';
   const max=key==='scope'?12000:
    key==='title'?180:
    nextModel?4000:
    key==='obligations'||key==='termination'||key==='special_terms'?4000:2000;
   if(nextModel&&current.length>max)
    throw Error('Texto de '+key+' excede o limite de '+max+' caracteres. Revise antes de salvar.');
   result[key]=current.slice(0,max);
  }
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
 if(c.contract_template_version==='2'){
  const documentDigits=v=>String(v??'').toUpperCase().replace(/[.\/\-\s]/g,'');
  if(documentDigits(c.company.company_document)===documentDigits(c.counterparty_document))
   throw Error('Os documentos da contratante e da contratada são iguais. Confira os dados de identificação antes de emitir.');
  if(c.company.company_address.length<6)throw Error('Informe o endereço completo da empresa em Configurações.');
  if(c.counterparty_address.length<6)throw Error('Informe o endereço completo da outra parte.');
 }

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
export function buildLegacyContractHtml(input,{id=null}={}){
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
  clause(3,'Preço global e pagamento','Valor total contratado: '+money(c.value_cents)+'.\nCondições de pagamento: '+c.payment_terms+'\nCronograma de parcelas / medições: '+c.payment_schedule)+
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


/** Contratos já emitidos com o modelo legado permanecem exatamente na versão original. */
export function buildContractHtml(input,{id=null}={}){
 const c=validateContractForExport(input);
 return c.contract_template_version==='1'
  ?buildLegacyContractHtml({...c,contract_template_version:'1'},{id})
  :buildComprehensiveContractHtml(c,{id});
}

export function buildComprehensiveContractHtml(input,{id=null}={}){
 const c=validateContractForExport(input);
 const reference=typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)
  ?'CT-'+id.slice(0,8).toUpperCase():'MINUTA — sem registro';
 const company={
  name:c.company.company_name,document:c.company.company_document,
  address:c.company.company_address,representative:c.company.company_representative,
  contact:[c.company.company_phone,c.company.company_email].filter(Boolean).join(' · ')
 };
 const other={
  name:c.counterparty_name,document:c.counterparty_document,address:c.counterparty_address,
  representative:c.counterparty_representative,contact:c.counterparty_contact
 };
 const contractor=c.role==='prestadora'?other:company;
 const performer=c.role==='prestadora'?company:other;
 const party=p=>'<strong>'+esc(p.name)+'</strong>, CPF/CNPJ '+esc(p.document)+
  ', endereço: '+esc(p.address)+
  (p.representative?', representada(o) por '+esc(p.representative):'')+
  (p.contact?', contato: '+esc(p.contact):'')+'.';
 const sections=[];
 const add=(title,body)=>sections.push({title,body});
 add('Objeto e escopo contratado',c.title+'.\n'+c.scope);
 add('Limites do escopo, exclusões e prioridades dos anexos',c.scope_limits);
 add('Local, início e término dos trabalhos',
   'Local de execução: '+c.location+'.\nInício previsto: '+when(c.start_on)+
   '.\nTérmino previsto: '+when(c.end_on)+'.');
 add('Projetos, memorial descritivo e documentos integrantes',c.documentation);
 add('Materiais, insumos e responsabilidades de fornecimento',c.materials);
 add('Acesso ao imóvel e infraestrutura de apoio',c.site_access);
 add('Licenças, autorizações e aprovações',c.permits);
 add('Planejamento, horários e execução por etapas',c.work_schedule);
 add('Medições, comprovação dos serviços e verificações',c.measurements);
 add('Preço total, pagamento e documentação fiscal',
   'Valor global contratado: '+money(c.value_cents)+'.\nCondições de pagamento: '+
   c.payment_terms+'\nCronograma de parcelas / medições: '+c.payment_schedule+
   '\n'+c.billing+'\nNas relações de consumo, o orçamento prévio e seus detalhamentos deverão observar as exigências legais aplicáveis, inclusive quanto à discriminação de materiais, mão de obra e condições de execução.');
 add('Reajustes e revisão de valores',c.adjustments);
 add('Obrigações recíprocas',c.obligations);
 add('Segurança do trabalho e proteção do canteiro',c.worksite_safety);
 add('Segurança em instalações e serviços elétricos',c.electrical_safety);
 add('Responsabilidade técnica e registros profissionais',c.technical);
 add('Equipe, terceiros e subcontratação',c.subcontracting);
 add('Proteção do imóvel, riscos, danos e seguros',c.damage_and_insurance);
 add('Resíduos, limpeza e responsabilidade ambiental',c.waste_management);
 add('Condições ocultas e imprevistos de execução',c.unforeseen);
 add('Alterações, acréscimos e aditivos contratuais',c.changes);
 add('Atrasos, interrupções e força maior',c.delays);
 add('Inadimplemento e pagamento em atraso',c.late_payment);
 add('Vistoria e aceite da entrega, testes e correções',c.acceptance);
 add('Garantias legais, correções e assistência',c.warranty);
 add('Responsabilidade civil e direitos irrenunciáveis',c.liability);
 add('Rescisão e acerto financeiro da execução',c.termination);
 add('Dados pessoais e confidencialidade',c.privacy+'\n'+c.confidentiality);
 add('Notificações e registros de comunicação',c.communications);
 add('Solução de controvérsias e foro',
   c.dispute_resolution+(c.jurisdiction?'\nForo indicado pelas partes (sujeito à competência legal aplicável): '+c.jurisdiction+'.':''));
 add('Disposições gerais',c.general_provisions);
 if(c.special_terms)add('Condições particulares acordadas',c.special_terms);
 const clauses=sections.map((p,i)=>'<section class="contract-clause contract-clause-v2">'+
  '<h2>Cláusula '+(i+1)+' — '+esc(p.title)+'</h2><p>'+rich(p.body)+'</p></section>').join('');
 return '<article class="contract-document contract-document-v2">'+
  '<header class="contract-document-head"><img src="/assets/civolten-logo.png" alt="Símbolo CIVOLTEN" class="contract-logo">'+
  '<div><span>CIVOLTEN · INSTRUMENTO PARTICULAR</span>'+
  '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1><p>Referência: '+esc(reference)+
  (c.revision_of?' · Revisão de CT-'+esc(c.revision_of.slice(0,8).toUpperCase()):'')+
  '</p></div></header>'+
  '<div class="contract-document-parties"><h2>IDENTIFICAÇÃO DAS PARTES</h2>'+
  '<p><strong>CONTRATANTE:</strong> '+party(contractor)+'</p>'+
  '<p><strong>CONTRATADA / PRESTADORA:</strong> '+party(performer)+'</p></div>'+
  '<p class="contract-document-intro">As partes acima qualificadas acordam as seguintes condições para a execução dos serviços descritos neste instrumento e nos anexos expressamente identificados, observada a legislação aplicável.</p>'+
  clauses+
  '<footer class="contract-signatures">'+
  '<p>Local e data da assinatura: ______________________________________________</p>'+
  '<div class="contract-signature-grid"><div><span></span><strong>CONTRATANTE</strong>'+
  '<small>'+esc(contractor.name)+'</small><small>Assinatura e identificação</small></div>'+
  '<div><span></span><strong>CONTRATADA / PRESTADORA</strong>'+
  '<small>'+esc(performer.name)+'</small><small>Assinatura e identificação</small></div></div>'+
  '<div class="contract-signature-grid witnesses"><div><span></span><small>Testemunha 1 — nome e documento</small></div>'+
  '<div><span></span><small>Testemunha 2 — nome e documento</small></div></div></footer>'+
  '<div class="contract-foot">Modelo técnico-comercial com cláusulas gerais para construção civil e instalações elétricas. '+esc(reference)+
  '. As partes devem conferir documentos, escopo, materiais, habilitações e condições particulares. Direitos legais e normas imperativas prevalecem. Registro no sistema não equivale a assinatura.</div>'+
  '</article>';
}
