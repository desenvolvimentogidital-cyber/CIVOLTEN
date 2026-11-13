// CIVOLTEN | NFS-e: formulário preparatório. Não transmite ao governo.
// Nenhum valor de exemplo vira dado fiscal salvo automaticamente.
import {e,icon} from './views.mjs';

const digits=value=>String(value??'').replace(/\D/g,'');
const displayMoney=value=>{
 const n=Number(String(value??'').replace(',','.'));
 return Number.isFinite(n)&&n>=0?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
};
const input=(title,name,value='',opts={})=>'<label class="nfse-field '+(opts.wide?'nfse-wide':'')+'"><span>'+e(title)+(opts.required?' <b aria-label="obrigatório">*</b>':'')+'</span>'+
 '<input name="'+e(name)+'" value="'+e(value)+'" type="'+(opts.type||'text')+'" '+(opts.type==='number'?'min="0" step="0.01" ':'')+
 (opts.max?'maxlength="'+opts.max+'" ':'')+(opts.placeholder?'placeholder="'+e(opts.placeholder)+'" ':'')+(opts.required?'required ':'')+'autocomplete="off"></label>';
const textarea=(title,name,value='',required=false)=>'<label class="nfse-field nfse-wide"><span>'+e(title)+(required?' <b>*</b>':'')+'</span><textarea name="'+e(name)+'" rows="3" maxlength="2000" '+(required?'required':'')+'>'+e(value)+'</textarea></label>';
const select=(title,name,value,choices,wide=false)=>
 '<label class="nfse-field '+(wide?'nfse-wide':'')+'"><span>'+e(title)+'</span><select name="'+e(name)+'">'+choices.map(([v,label])=>
 '<option value="'+e(v)+'"'+(value===v?' selected':'')+'>'+e(label)+'</option>').join('')+'</select></label>';
const yesNo=[['nao','Não'],['sim','Sim']];
const regimeOptions=[['mei','MEI / SIMEI'],['simples','Simples Nacional — ME/EPP'],['presumido','Lucro Presumido'],['real','Lucro Real'],['outro','Outro / a verificar']];
const addressOptions=[['endereco','Endereço no Brasil'],['cno','Código de obra (CNO)'],['cib','Cadastro Imobiliário Brasileiro (CIB)']];
const flag=d=>d==='sim'?'Sim':d==='nao'?'Não':'Conferir';
const fieldGroup=(title,body,description='')=>
 '<section class="nfse-card"><div class="nfse-card-title">'+title+'</div>'+(description?'<p class="nfse-helper">'+description+'</p>':'')+'<div class="nfse-fields">'+body+'</div></section>';

export function nfseNewDraft(company={}){
 const now=new Date();
 const localDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 return {issuerName:company.companyName||'',issuerCnpj:'',regime:company.taxRegime||'mei',
  clientName:'',clientCnpj:'',clientEmail:'',description:'',amount:'',competence:localDate,
  serviceCode:'',nbs:'',serviceCity:'',workType:'endereco',workCode:'',cep:'',street:'',number:'',district:'',city:'',uf:'',complement:'',
  taxStatus:'tributavel',specialRegime:'nenhum',issSuspended:'nao',issRetention:'conferir',
  issBenefit:'nao',issDeduction:'nao',ibsCbs:'conferir',
  techReference:'',reference:'',order:'',observations:''};
}
export const nfseStorageKey=userId=>'civolten:nfse-draft:'+String(userId||'').replace(/[^a-zA-Z0-9-]/g,'');
export function nfseHasCnpj(value){
 const n=digits(value);if(n.length!==14||/^(\d)\1{13}$/.test(n))return false;
 const check=(slice,weights)=>{let sum=0;for(let i=0;i<weights.length;i++)sum+=Number(slice[i])*weights[i];let mod=sum%11;return mod<2?0:11-mod;};
 return check(n,[5,4,3,2,9,8,7,6,5,4,3,2])===Number(n[12])&&check(n,[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(n[13]);
}
// Cada erro possui o nome exato de um campo visível. A interface usa este mapa
// para destacar, explicar e focar o primeiro problema em vez de mostrar um toast.
export function nfseFieldErrors(d,step=3){
 const errors={};
 const add=(name,valid,message)=>{if(!valid)errors[name]=message;};
 const required=value=>Boolean(String(value??'').trim());
 const isRealDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return year>=2000&&date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day;
 };
 const ufs=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
 add('issuerName',required(d.issuerName),'Informe o nome da empresa emissora.');
 add('issuerCnpj',nfseHasCnpj(d.issuerCnpj),'Informe um CNPJ válido da empresa emissora.');
 add('regime',regimeOptions.some(([value])=>value===d.regime),'Selecione o regime tributário da empresa.');
 add('clientName',required(d.clientName),'Informe a razão social do cliente.');
 add('clientCnpj',nfseHasCnpj(d.clientCnpj),'Informe um CNPJ válido do tomador.');
 add('clientEmail',!required(d.clientEmail)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.clientEmail).trim()),'Confira o e-mail do cliente ou deixe em branco.');
 add('description',required(d.description),'Descreva o serviço realizado.');
 const amount=Number(String(d.amount??'').replace(',','.'));
 add('amount',Number.isFinite(amount)&&amount>0,'Informe um valor do serviço maior que zero.');
 add('competence',isRealDate(d.competence),'Informe uma data de competência válida.');
 if(d.workType==='endereco'){
  add('cep',digits(d.cep).length===8,'Informe o CEP de 8 dígitos do local da obra.');
  add('city',required(d.city),'Informe o município da obra.');
  add('uf',ufs.includes(String(d.uf||'').toUpperCase()),'Informe a UF válida da obra (ex.: SP).');
  add('street',required(d.street),'Informe o logradouro da obra.');
  add('number',required(d.number),'Informe o número do endereço da obra.');
 }else if(d.workType==='cno'||d.workType==='cib'){
  add('workCode',required(d.workCode),'Informe o código de obra/CIB fornecido pelo cliente.');
 }else add('workType',false,'Selecione como a obra será identificada.');
 if(step>=2){
  add('serviceCode',digits(d.serviceCode).length===6,'Informe o código de tributação nacional com seis dígitos.');
  add('nbs',digits(d.nbs).length===9,'Informe a NBS do serviço com nove dígitos.');
  add('serviceCity',required(d.serviceCity),'Informe o município da prestação.');
  add('issRetention',['sim','nao'].includes(d.issRetention),'Confirme a retenção do ISS com base no regime e contrato.');
  add('ibsCbs',['sim','nao'].includes(d.ibsCbs),'Confirme a informação de IBS/CBS aplicável à competência.');
 }
 return errors;
}
export function nfseIssues(d,step=3){
 return Object.values(nfseFieldErrors(d,step));
}
const row=(label,value)=>'<div class="nfse-review-row"><span>'+e(label)+'</span><strong>'+e(value||'—')+'</strong></div>';

export function nfseView(d,step=1,budgets=[]){
 const issues=nfseIssues(d,step);
 const steps=['Dados','Tributação','Conferência'];
 const stage=steps.map((t,i)=>'<div class="nfse-step'+(step===i+1?' is-current':'')+(step>i+1?' is-done':'')+'"><span>'+String(i+1)+'</span><b>'+t+'</b></div>').join('');
 const count=issues.length;
 const side='<aside class="nfse-validation"><h3>'+icon('check',22)+' Conferência da nota</h3>'+
 '<p>Verifique as informações antes do envio oficial.</p>'+
 '<div class="nfse-review-list">'+
 row('Cliente',d.clientName||'Pendente')+
 row('Serviço',d.description?'Informado':'Pendente')+
 row('Endereço da obra',d.workType==='endereco'?(d.city||'Pendente'):(d.workCode||'Pendente'))+
 row('Tributação',d.serviceCode||'Pendente')+
 row('Valor',displayMoney(d.amount))+
 '</div><div class="nfse-validation-summary">'+(count?'Há '+count+' item(ns) para revisar.':'Campos básicos conferidos.')+'</div>'+
 '<p class="nfse-api-note">A emissão pela API Nacional ainda não está habilitada. Esta tela prepara um rascunho, não uma NFS-e oficial.</p></aside>';
 const budgetSelect=budgets.length?'<div class="nfse-import"><label for="nfse-budget">Preencher a partir de um orçamento</label>'+
 '<select id="nfse-budget"><option value="">Selecione para aproveitar dados existentes</option>'+
 budgets.map(b=>'<option value="'+e(b.id)+'">'+e((b.customer||'Cliente')+' — '+(b.project||b.title||'Orçamento'))+'</option>').join('')+'</select>'+
 '<p>Confira dados, valor e escopo antes de continuar. O orçamento não define automaticamente a tributação.</p></div>':'';
 let body='';
 if(step===1){
  body='<form id="nfse-form" class="nfse-form" novalidate>'+budgetSelect+
  fieldGroup('Empresa emissora',input('Razão social / nome','issuerName',d.issuerName,{required:true,wide:true,max:160})+
   input('CNPJ','issuerCnpj',d.issuerCnpj,{required:true,placeholder:'00.000.000/0000-00',max:18})+
   select('Regime tributário','regime',d.regime,regimeOptions),
   'Use o mesmo regime que consta no cadastro fiscal da empresa.')+
  fieldGroup('Cliente / Tomador do serviço',input('Razão social','clientName',d.clientName,{required:true,wide:true,max:180})+
   input('CNPJ','clientCnpj',d.clientCnpj,{required:true,placeholder:'00.000.000/0000-00',max:18})+
   input('E-mail (opcional)','clientEmail',d.clientEmail,{type:'email',max:160}))+
  fieldGroup('Serviço prestado',textarea('Descrição do serviço','description',d.description,true)+
   input('Valor total (R$)','amount',d.amount,{type:'number',required:true})+
   input('Data de competência','competence',d.competence,{type:'date',required:true}))+
  fieldGroup('Local da prestação / obra',
   select('Identificação da obra','workType',d.workType,addressOptions,true)+
   (d.workType==='endereco'?
    input('CEP da obra','cep',d.cep,{required:true,placeholder:'00000-000',max:9})+
    input('Município da obra','city',d.city,{required:true,max:100})+
    input('UF','uf',d.uf,{required:true,max:2})+
    input('Bairro','district',d.district,{max:100})+
    input('Logradouro','street',d.street,{required:true,max:180,wide:true})+
    input('Número','number',d.number,{required:true,max:20})+
    input('Complemento','complement',d.complement,{max:100}):
    input(d.workType==='cno'?'Número do CNO':'Número do CIB','workCode',d.workCode,{required:true,wide:true,max:60})),
   'Use o endereço efetivo da execução ou o identificador oficial da obra, se aplicável.')+
  fieldGroup('Informações complementares',
   input('Documento técnico (ART/TRT/RRT), se houver','techReference',d.techReference,{max:100})+
   input('Documento de referência','reference',d.reference,{max:120})+
   input('Número do pedido / OS','order',d.order,{max:120,wide:true})+
   textarea('Observações','observations',d.observations))+
   '<div class="nfse-actions"><button class="nfse-primary" type="submit">'+icon('chevron',20)+' Continuar para tributação</button>'+
   '<button type="button" class="nfse-secondary" data-action="nfse-save">Salvar rascunho</button></div></form>';
 }else if(step===2){
  body='<form id="nfse-form" class="nfse-form" novalidate>'+
  fieldGroup('Classificação do serviço',
   input('Código de Tributação Nacional','serviceCode',d.serviceCode,{required:true,max:8,placeholder:'Ex.: 07.02.02'})+
   input('Item NBS','nbs',d.nbs,{required:true,max:14,placeholder:'Ex.: 1.0106.11.00'})+
   input('Município de prestação (ISS)','serviceCity',d.serviceCity||d.city,{required:true,wide:true,max:100}),
   'Os códigos devem corresponder à atividade realmente executada. Não são definidos apenas pelo nome do cliente.')+
  fieldGroup('Tributação municipal',
   select('Tributação do ISSQN','taxStatus',d.taxStatus,[['tributavel','Operação tributável'],['outra','Outra — revisar']])+
   select('Regime especial','specialRegime',d.specialRegime,[['nenhum','Nenhum'],['verificar','Verificar enquadramento']])+
   select('Exigibilidade do ISS suspensa','issSuspended',d.issSuspended,yesNo)+
   select('Retenção de ISS pelo tomador','issRetention',d.issRetention,[['conferir','A conferir'],...yesNo])+
   select('Benefício municipal','issBenefit',d.issBenefit,yesNo)+
   select('Dedução / redução da base','issDeduction',d.issDeduction,yesNo),
   'Retenção e deduções exigem confirmação das regras aplicáveis. MEI/SIMEI não usa uma alíquota comum do Simples por nota.')+
  fieldGroup('Reforma tributária / IBS-CBS',
   select('Preencher informações IBS/CBS?','ibsCbs',d.ibsCbs,[['conferir','A conferir'],...yesNo],true),
   'Considere a competência, o regime tributário e as orientações vigentes do emissor nacional.')+
   '<div class="nfse-actions"><button class="nfse-primary" type="submit">'+icon('check',20)+' Ir para conferência</button>'+
   '<button class="nfse-secondary" type="button" data-action="nfse-prev">Voltar e revisar dados</button>'+
   '<button class="nfse-secondary" type="button" data-action="nfse-save">Salvar rascunho</button></div></form>';
 }else{
  body='<section class="nfse-card nfse-confirm"><div class="nfse-card-title">Conferência antes da emissão</div>'+
   row('Emissor',d.issuerName)+' '+row('CNPJ emissor',d.issuerCnpj)+
   row('Tomador',d.clientName)+' '+row('CNPJ tomador',d.clientCnpj)+
   row('Descrição',d.description)+
   row('Valor da nota',displayMoney(d.amount))+
   row('Competência',d.competence)+
   row('Local da obra',d.workType==='endereco'?[d.street,d.number,d.district,d.city,d.uf,d.cep].filter(Boolean).join(', '):d.workCode)+
   row('Código tributário',d.serviceCode)+row('NBS',d.nbs)+
   row('ISS retido?',flag(d.issRetention))+row('IBS/CBS?',flag(d.ibsCbs))+
   (issues.length?'<div class="nfse-problems" role="alert"><b>Revise antes da emissão:</b><ul>'+issues.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul></div>':
   '<div class="nfse-ok">'+icon('check',19)+' Dados básicos preenchidos. A validação fiscal oficial ainda será necessária.</div>')+
   '<div class="nfse-actions"><button class="nfse-primary" type="button" data-action="nfse-save">Salvar rascunho</button>'+
   '<button class="nfse-secondary" type="button" data-action="nfse-prev">Voltar e editar</button>'+
   '<button class="nfse-disabled" type="button" disabled title="Integração com a API oficial pendente">Emitir NFS-e — integração pendente</button></div></section>';
 }
 return '<section class="nfse-page"><div class="nfse-head"><div class="nfse-title-icon">'+icon('file',27)+'</div><div><h1>Emitir NFS-e</h1>'+
 '<p>Nota Fiscal de Serviço • preenchimento simplificado</p></div></div>'+
 '<div class="nfse-progress">'+stage+'</div>'+
 '<div class="nfse-pending">'+icon('lock',17)+' Modo preparação: nenhuma nota será transmitida ao governo.</div>'+
 '<div class="nfse-layout"><main class="nfse-main">'+body+'</main>'+side+'</div></section>';
}
