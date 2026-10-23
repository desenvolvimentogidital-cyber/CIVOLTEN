import {contractDefaults} from '/lib/civolten-contract.mjs';
const legalProfile=['company_name','company_document','company_address','company_representative','company_phone','company_email','city'];
export const defaultCompanyProfile=()=>({
 company_name:'CIVOLTEN — Construção & Elétrica',company_document:'',company_address:'',
 company_representative:'',company_phone:'',company_email:'',city:''
});
export function contractList(rows,esc,brl,title,budgets=[]){
 const labels={rascunho:'Rascunho',emitido:'Emitido',assinado:'Assinado (manual)',cancelado:'Cancelado'};
 return title('Contratos','Elabore, revise e imprima contratos com as informações de cada serviço.',
  '<button class="primary" data-action="new-contract">+ Novo contrato</button>')+
 '<div class="contract-intro"><div><strong>Modelo de prestação de serviços</strong>'+
 '<p>Dados da sua empresa são preenchidos automaticamente. Informe a outra parte, o escopo, os valores e os prazos. Você poderá revisar cada cláusula antes de emitir.</p></div>'+
 '<span class="fin-tag">Privado por conta</span></div>'+
 '<section class="card"><h2>Contratos cadastrados ('+rows.length+')</h2>'+
 (rows.length?rows.map(x=>'<div class="entry"><div><strong>'+esc(x.title)+'</strong>'+
 '<small>'+esc(x.counterparty||'Contratante a preencher')+' · '+esc(labels[x.status]||x.status)+
 ' · '+new Date(x.created_at).toLocaleDateString('pt-BR')+'</small></div>'+
 '<div class="actions"><span class="price">'+brl(x.content?.value_cents)+'</span>'+
 '<button type="button" class="subtle small" data-action="open-contract" data-id="'+esc(x.id)+'">Abrir</button>'+
 '<button type="button" class="danger small" data-action="delete-contract" data-id="'+esc(x.id)+'">Excluir</button></div></div>').join(''):
 '<div class="fin-empty-graph">Nenhum contrato cadastrado. Crie um novo ou importe os dados comerciais de um orçamento salvo.</div>')+'</section>'+
 (budgets.length?'<section class="card"><h2>Criar a partir de um orçamento</h2><p class="hint">Importa apenas escopo, cliente, local e preço final; não copia salários, encargos ou margens.</p>'+
 '<div class="pick"><select id="contractFromBudgetSelect" aria-label="Selecionar orçamento para contrato"><option value="">Selecionar orçamento</option>'+
 budgets.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+' — '+esc(x.customer||'Sem cliente')+'</option>').join('')+
 '</select><button class="secondary" type="button" data-action="contract-from-selected-budget">Criar contrato</button></div></section>':'');
}
const entry=(key,label,value='',options={})=>{
 const data='data-contract="'+key+'"',required=options.required?' required':'',max=options.max||250;
 if(options.type==='textarea')return '<label class="'+(options.wide?'contract-field-wide':'')+'">'+label+'<textarea '+data+' maxlength="'+max+'" rows="'+(options.rows||3)+'"'+required+'>'+escBasic(value)+'</textarea></label>';
 if(options.type==='select')return '<label>'+label+'<select '+data+'>'+options.items.map(([v,n])=>'<option value="'+v+'" '+(value===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label>';
 return '<label class="'+(options.wide?'contract-field-wide':'')+'">'+label+'<input '+data+' type="'+(options.type||'text')+'" '+(options.type==='date'?'':'maxlength="'+max+'"')+(options.type==='number'?' min="0.01" step="0.01"':'')+' value="'+escBasic(value)+'"'+required+'></label>';
};
const escBasic=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function contractEditor(c,id,profile,budgets,esc,brl,title){
 const p=c.company||defaultCompanyProfile();
 const budgetId=c.budget_id||'';
 const companyConfigured=Boolean(p.company_name&&p.company_document);
 const standard=contractDefaults();
 const editTerms=[['materials','Fornecimento de materiais'],['obligations','Responsabilidades das partes'],
 ['changes','Alterações no escopo e prazo'],['termination','Rescisão e encerramento'],
 ['warranty','Garantias e correções'],['special_terms','Condições particulares'],['jurisdiction','Foro (opcional)']];
 return title(id?'Editar contrato':'Novo contrato',
 'Preencha as informações da contratação. As cláusulas já aparecem com sugestões revisáveis.',
 '<button class="subtle" data-view="contracts">← Todos os contratos</button>')+
 '<div class="contract-editor"><div class="stack">'+
 '<section class="card contract-editor-card"><div class="budget-step-title"><span class="budget-step-number">1</span><div><h2>Tipo e participantes</h2>'+
 '<p>Selecione se a CIVOLTEN vai executar ou contratar o serviço.</p></div></div>'+
 '<div class="contract-form-grid">'+
 entry('role','Papel da sua empresa',c.role,{type:'select',items:[['prestadora','CIVOLTEN presta o serviço'],['contratante','CIVOLTEN contrata o serviço']]})+
 entry('title','Título do contrato',c.title,{required:true,max:180})+
 entry('counterparty_name','Nome / razão social da outra parte',c.counterparty_name,{required:true})+
 entry('counterparty_document','CPF ou CNPJ da outra parte',c.counterparty_document,{required:true})+
 entry('counterparty_address','Endereço da outra parte',c.counterparty_address,{wide:true})+
 entry('counterparty_representative','Representante (se empresa)',c.counterparty_representative)+
 entry('counterparty_contact','Telefone / e-mail',c.counterparty_contact)+
 '</div></section>'+
 '<section class="card contract-editor-card"><div class="budget-step-title"><span class="budget-step-number">2</span><div><h2>Serviço, local e prazo</h2>'+
 '<p>Descreva exatamente o que será realizado.</p></div></div>'+
 '<div class="contract-form-grid">'+entry('scope','Descrição do serviço e escopo',c.scope,{type:'textarea',wide:true,max:12000,rows:6,required:true})+
 entry('location','Endereço / local da execução',c.location,{required:true,wide:true,max:500})+
 entry('start_on','Início previsto',c.start_on,{type:'date',required:true})+
 entry('end_on','Término previsto',c.end_on,{type:'date',required:true})+
 '</div></section>'+
 '<section class="card contract-editor-card"><div class="budget-step-title"><span class="budget-step-number">3</span><div><h2>Valor e pagamento</h2>'+
 '<p>Informe o valor global e como o pagamento será realizado.</p></div></div>'+
 '<div class="contract-form-grid">'+
 entry('value_reais','Valor total do contrato (R$)',(c.value_cents/100).toFixed(2),{type:'number',required:true})+
 entry('payment_terms','Condições de pagamento',c.payment_terms,{type:'textarea',wide:true,rows:4,required:true,max:2000})+
 '</div></section>'+
 '<section class="card contract-editor-card"><div class="budget-step-title"><span class="budget-step-number">4</span><div><h2>Revisão das cláusulas</h2><p>O modelo vem preenchido. Abra para alterar quando necessário.</p></div></div>'+
 '<details class="contract-advanced"><summary>Editar materiais, obrigações, rescisão, garantias e disposições especiais</summary>'+
 '<div class="contract-form-grid">'+editTerms.map(([key,label])=>entry(key,label,c[key]??standard[key],{type:'textarea',wide:true,max:4000,rows:key==='special_terms'?4:3})).join('')+'</div></details>'+
 '<div class="contract-company-review"><h3>Dados da sua empresa (automáticos)</h3>'+
 '<p><strong>'+esc(p.company_name||'Razão social pendente')+'</strong>'+
 (p.company_document?' · '+esc(p.company_document):' · Documento não configurado')+'</p>'+
 '<button type="button" class="subtle small" data-view="settings">Editar em Configurações</button>'+
 (!companyConfigured?'<p class="warning">Antes de imprimir, preencha nome legal e CPF/CNPJ da empresa nas Configurações.</p>':'')+
 '</div></section></div>'+
 '<aside class="summary contract-summary"><h2>Resumo do contrato</h2>'+
 '<div class="sumrow"><span>Outra parte</span><strong id="contractSummaryParty">'+esc(c.counterparty_name||'A preencher')+'</strong></div>'+
 '<div class="sumrow"><span>Valor global</span><strong id="contractSummaryValue">'+brl(c.value_cents)+'</strong></div>'+
 '<div class="sumrow"><span>Prazo</span><strong id="contractSummaryDates">'+esc(c.start_on||'—')+' até '+esc(c.end_on||'—')+'</strong></div>'+
 '<label>Situação<select id="contractStatus">'+Object.entries({rascunho:'Rascunho',emitido:'Emitido',assinado:'Assinado (marcação manual)',cancelado:'Cancelado'}).map(([value,label])=>
 '<option value="'+value+'" '+((c.status||'rascunho')===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
 '<p class="hint">“Assinado” é apenas um registro administrativo. Este módulo não faz assinatura eletrônica.</p>'+
 (budgetId?'<p class="hint">Vinculado ao orçamento '+esc(budgets.find(x=>x.id===budgetId)?.title||'selecionado')+'</p>':'')+
 '<div class="buttons"><button type="button" class="primary" data-action="save-contract">Salvar contrato</button>'+
 '<button type="button" class="secondary" data-action="print-contract">Gerar contrato / salvar em PDF</button></div>'+
 '<p class="hint">Confira CPF/CNPJ, escopo, prazos, condições e cláusulas antes de assinar. Este é um modelo editável e não substitui revisão jurídica.</p></aside></div>';
}
export function contractProfilePanel(profile,esc){
 const p=profile||defaultCompanyProfile();
 const fields=[
 ['company_name','Razão social ou nome legal'],['company_document','CPF / CNPJ'],['company_address','Endereço completo'],
 ['company_representative','Representante legal (opcional)'],['company_phone','Telefone comercial'],['company_email','E-mail profissional'],
 ['city','Cidade / UF']
 ];
 return '<section class="card contract-profile-settings"><h2>Dados para contratos</h2>'+
 '<p class="hint">Cadastre uma vez. Seus próximos contratos utilizarão esses dados automaticamente; contratos já salvos preservam as informações originais.</p>'+
 '<form id="contractProfileForm"><div class="contract-form-grid">'+fields.map(([key,label])=>
 '<label>'+label+'<input name="'+key+'" type="'+(key==='company_email'?'email':'text')+'" maxlength="250" value="'+esc(p[key]||'')+'"></label>').join('')+
 '</div><div class="buttons"><button type="submit" class="primary">Salvar dados dos contratos</button></div></form>'+
 '</section>';
}
