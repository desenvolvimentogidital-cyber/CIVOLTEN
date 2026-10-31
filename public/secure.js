import {costPage,costDialog,costEvidenceDialog,costHandleForm,costHandleClick} from './secure-costing.js';
import {automaticBudgetPanel} from './secure-automatic.js';
import {schedulePage,scheduleDialog,scheduleHandleForm} from './secure-schedule.js';
import {financePage,financeDialog,financeHandleForm} from './secure-finance.js';
import {showServiceCatalog,showOfficialServiceEdit} from './secure-service-picker.js';
import {companyCostsDialog,companyCostsSubmit} from './secure-company-costs.js';
import {saveBudgetForOffline,getOfflineDraft,pendingChanges} from './offline-store.js';
import {syncOfflineBudget} from './offline-sync.js';
/* Painel privado CIVOLTEN — dados persistidos com validações para operação comercial
 * Jamais usar localStorage para informações comerciais ou tokens de sessão.
 */
const state={user:null,view:'inicio',clients:[],projects:[],budgets:[],detail:null,users:[],costs:null,costCatalog:[],schedulePlan:null,schedulePreview:null,scheduleProgress:null,scheduleRemaining:null,scheduleWorkforce:null,scheduleWorkforceSettings:null,schedulePlanning:null,scheduleAdvanced:false,finance:null,financeSelected:null,financeDraft:null,scheduleSettings:null,scheduleTaskId:null,mode:'login',busy:false,autoBriefing:null};
const app=document.querySelector('#secure-app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BRL=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const writeable=()=>state.user&&['administrador','orcamentista'].includes(state.user.role);
const theme=()=>{const pref=localStorage.getItem('civolten-theme')||'auto';const dark=pref==='dark'||(pref==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light'};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>theme());
const toast=(message,isError=false)=>{document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast'+(isError?' error':'');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4500)};
async function api(path,method='GET',payload){
 const opts={method,credentials:'same-origin',headers:{'X-CIVOLTEN-Request':'1'}};
 if(payload!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(payload)}
 let res;
 try{res=await fetch('/api/v1/'+path,opts)}catch{throw Error('Sem conexão com a API. Confira a publicação e a internet.')}
 let data;try{data=await res.json()}catch{throw Error('Servidor retornou resposta inválida (HTTP '+res.status+').')}
 if(!res.ok)throw Error(data.error||('Erro HTTP '+res.status));
 return data;
}
function brand(){return '<img src="/assets/logo.png" alt="CIVOLTEN" class="logo">'}
function authView(){
 const setup=state.mode==='setup';
 app.innerHTML='<section class="login"><div class="login-card">'+brand()+
 '<h1>'+(setup?'Configuração inicial':'Acesso seguro')+'</h1><p class="muted">'+(setup?'Cadastre o administrador utilizando o código temporário definido na Vercel.':'Entre para acessar os cadastros persistidos no Neon PostgreSQL.')+'</p>'+
 '<div class="notice tiny">Dados persistidos no Neon real. Antes de usar dados pessoais de clientes, conclua backup e homologação de segurança.</div>'+
 '<form id="authForm">'+(setup?field('Código de inicialização','bootstrap_secret','password',true):'')+
 field('Usuário','login','text',true)+field('Senha','password','password',true)+
 '<button class="btn primary block" type="submit">'+(setup?'Criar administrador':'Entrar')+'</button></form>'+
 '<p class="muted tiny">O sistema não envia senhas nem dados para o armazenamento local do navegador.</p>'+
 (setup?'<button class="btn block" type="button" data-action="login-view">Voltar ao login</button>':'<p class="muted tiny">O administrador já está cadastrado. Entre com suas credenciais; se a senha for temporária, será solicitada a troca.</p>')+'</div></section>';
}
function forcedPasswordView(){
 app.innerHTML='<section class="login"><div class="login-card">'+brand()+
 '<h1>Troca de senha obrigatória</h1><p class="muted">Sua senha inicial é temporária. Antes de acessar os clientes e orçamentos, defina uma senha exclusiva, com pelo menos 12 caracteres.</p>'+
 '<form id="password-form">'+field('Senha temporária atual','current_password','password',true)+
 field('Nova senha (mínimo 12 caracteres)','new_password','password',true,'','minlength="12" maxlength="128"')+
 '<button class="btn primary block" type="submit">Salvar nova senha e acessar</button></form>'+
 '<button class="btn block" data-action="logout">Sair</button><p class="tiny muted">Não compartilhe sua senha por mensagens.</p></div></section>';
}
function field(label,name,type='text',required=false,value='',extra=''){
 return '<div class="field"><label for="f_'+esc(name)+'">'+esc(label)+'</label><input id="f_'+esc(name)+'" name="'+esc(name)+'" type="'+esc(type)+'" '+(required?'required':'')+' value="'+esc(value)+'" '+extra+'></div>';
}
function selectField(label,name,items,value='',placeholder='Selecione'){
 return '<div class="field"><label for="f_'+esc(name)+'">'+esc(label)+'</label><select id="f_'+esc(name)+'" name="'+esc(name)+'" required><option value="">'+esc(placeholder)+'</option>'+
 items.map(x=>'<option value="'+esc(x.id)+'" '+(String(x.id)===String(value)?'selected':'')+'>'+esc(x.title||x.name||x.code)+'</option>').join('')+'</select></div>';
}
function textareaField(label,name,value='',required=false){return '<div class="field"><label for="f_'+esc(name)+'">'+esc(label)+'</label><textarea name="'+esc(name)+'" '+(required?'required':'')+'>'+esc(value)+'</textarea></div>'}
const nav=[['inicio','Painel','home'],['clientes','Clientes','users'],['obras','Obras','hardhat'],['orcamentos','Orçamentos','file'],['usuarios','Usuários','settings']];
const iconShapes={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 hardhat:'<path d="M2 18v-2h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM5 16V9a7 7 0 0 1 14 0v7M12 3v8"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
 settings:'<path d="M12 8v8M8 12h8"/><circle cx="12" cy="12" r="9"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M20.8 14A9 9 0 0 1 10 3.2 9 9 0 1 0 20.8 14z"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-3 3 2 2-3 3-2-2-2 2"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>'
};
function ico(name){return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(iconShapes[name]||iconShapes.file)+'</svg>'}
function navHTML(mobile=false){
 return nav.filter(([id])=>id!=='usuarios'||state.user?.role==='administrador')
 .map(([id,text,icon])=>'<button type="button" class="'+(mobile?'mobile-link':'nav-link')+(state.view===id?' active':'')+'" data-action="view" data-view="'+id+'" '+(state.view===id?'aria-current="page"':'')+'>'+ico(icon)+'<span>'+esc(text)+'</span></button>').join('');
}
function shell(){
 const role=state.user.role==='administrador'?'Administrador':state.user.role==='orcamentista'?'Orçamentista':state.user.role==='revisor'?'Revisor':'Consulta';
 app.innerHTML='<div class="layout secure-layout"><aside class="sidebar" aria-label="Navegação principal"><div class="brand">'+brand()+'</div>'+
 '<div class="sidebar-caption">SISTEMA DE ORÇAMENTOS</div><nav class="nav" aria-label="Módulos">'+navHTML()+'</nav>'+
 '<div class="nav-btm"><div class="mini-company"><img src="/assets/icone.png" alt=""/><div><strong>CIVOLTEN</strong><span>Sistema de gestão</span></div></div>'+
 '<button type="button" class="sidebar-action" data-action="password-modal">'+ico('key')+' Alterar senha</button>'+
 '<button type="button" class="sidebar-action" data-action="logout">'+ico('logout')+' Sair da conta</button></div></aside>'+
 '<div class="workarea"><header class="topbar"><div class="mobile-top">'+brand()+'</div>'+
 '<div class="header-identity"><span class="eyebrow">ÁREA DE TRABALHO</span><strong>CIVOLTEN <span class="header-divider">/</span> Orçamentos</strong></div>'+
 '<div class="header-actions"><span class="session-pill">'+ico('shield')+' Banco conectado</span>'+
 '<button type="button" class="icon-btn secure-theme" data-action="theme" aria-label="Alternar entre tema automático, claro e escuro" title="Alternar aparência">'+ico(document.documentElement.dataset.theme==='dark'?'moon':'sun')+'</button>'+
 '<div class="user-chip"><div class="user-dot">'+ico('users')+'</div><span class="user-identity">'+esc(state.user.login)+'<small>'+esc(role)+'</small></span></div>'+
 '<button type="button" class="icon-btn secure-logout" data-action="logout" title="Sair da conta" aria-label="Sair da conta">'+ico('logout')+'</button></div></header>'+
 '<main class="content secure-content"><div class="workspace-note">'+ico('shield')+' <span><strong>Ambiente interno:</strong> dados registrados no banco CIVOLTEN. Propostas contratuais seguem bloqueadas até homologação.</span></div>'+
 '<div id="private-content"></div></main></div><nav class="mobile-nav" aria-label="Navegação no celular">'+navHTML(true)+'</nav></div>';
}

async function loadLists(){
 const [a,b,c]=await Promise.all([api('clients'),api('projects'),api('budgets')]);
 state.clients=a;state.projects=b;state.budgets=c;
 state.users=state.user?.role==='administrador'?await api('users'):[];
}
function heading(title,subtitle,button='',action=''){
 return '<div class="page-title"><div><div class="breadcrumb">CIVOLTEN / '+esc(title)+'</div><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></div>'+
 (button&&writeable()?'<button type="button" class="btn primary btn-primary" data-action="'+esc(action)+'">+ '+esc(button)+'</button>':'')+'</div>';
}
function empty(message){return '<div class="card empty-state">'+ico('file')+'<h2>Nenhum registro por enquanto</h2><p>'+esc(message)+'</p></div>'}
function listRows(items,cols){
 return '<div class="card table-wrap"><table class="table"><thead><tr>'+cols.map(c=>'<th>'+esc(c.title)+'</th>').join('')+'</tr></thead><tbody>'+
 items.map(item=>'<tr>'+cols.map(c=>'<td>'+c.render(item)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function statusPill(x){return '<span class="tag status-pill">'+esc(x||'rascunho')+'</span>'}

function actions(x,kind){
 let btn='<button class="btn" data-action="edit-'+kind+'" data-id="'+esc(x.id)+'">Editar</button>';
 if(kind==='budget')btn='<button class="btn" data-action="detail-budget" data-id="'+esc(x.id)+'">Abrir</button> '+btn;
 return writeable()?btn+' <button class="btn danger" data-action="archive-'+kind+'" data-id="'+esc(x.id)+'">'+(kind==='budget'?'Cancelar':'Arquivar')+'</button>':kind==='budget'?'<button class="btn" data-action="detail-budget" data-id="'+esc(x.id)+'">Abrir</button>':'—';
}
function dashboard(){
 return heading('Visão geral','Acompanhe sua operação e encontre as ferramentas para montar seus orçamentos.')+
 '<div class="grid dashboard-kpis">'+
 [['Clientes',state.clients.length,'users','Cadastros ativos'],['Obras',state.projects.length,'hardhat','Projetos cadastrados'],['Orçamentos',state.budgets.length,'file','Documentos em elaboração']].map(([name,total,icon,detail])=>
 '<div class="card stat-card"><div class="stat-icon">'+ico(icon)+'</div><div><div class="stat-label">'+esc(name)+'</div><div class="stat-value">'+total+'</div><div class="stat-sub">'+esc(detail)+'</div></div></div>').join('')+
 '</div><div class="grid dashboard-panels"><section class="card dashboard-panel"><div class="panel-head">'+ico('file')+'<h2>Comece por aqui</h2></div>'+
 '<p class="muted">Cadastre o cliente, registre a obra e prepare o orçamento com os custos e as informações técnicas.</p>'+
 '<div class="dashboard-steps"><div><span>01</span><strong>Clientes</strong><small>Organize os dados da empresa ou pessoa</small></div>'+
 '<div><span>02</span><strong>Obras</strong><small>Vincule a execução ao cliente</small></div>'+
 '<div><span>03</span><strong>Orçamentos</strong><small>Monte custos e serviços</small></div></div>'+
 '<div class="actions"><button type="button" class="btn primary btn-primary" data-action="view" data-view="clientes">Abrir clientes '+ico('chevron')+'</button>'+
 '<button type="button" class="btn" data-action="view" data-view="orcamentos">Ver orçamentos</button></div></section>'+
 '<section class="card dashboard-panel status-panel"><div class="panel-head">'+ico('shield')+'<h2>Controle e segurança</h2></div>'+
 '<span class="tag status-pill">Banco real conectado · liberação comercial pendente</span>'+
 '<p>Suas alterações neste painel são gravadas no banco PostgreSQL. Cálculos não revisados não são preços nem prazos aprovados. Complete as verificações antes de usar dados pessoais.</p>'+
 '<p class="muted tiny">A emissão comercial de propostas e contratos ainda depende de revisão de custos, tributação e homologação.</p>'+
 (state.user?.role==='administrador'?'<button type="button" class="btn" data-action="release-readiness">Verificar liberação real do sistema</button>':'')+'</section></div>';
}

function clientPage(){
 return heading('Clientes','Cadastro persistente com histórico no PostgreSQL Neon.','Novo cliente','new-client')+
 (state.clients.length?listRows(state.clients,[
 {title:'Cliente',render:x=>'<strong>'+esc(x.name)+'</strong>'},
 {title:'Documento',render:x=>esc(x.tax_id||'—')+'<div>'+statusPill(x.status)+'</div>'},
 {title:'Contato',render:x=>esc(x.email||x.phone||'—')},
 {title:'Ações',render:x=>actions(x,'client')}
 ]):empty('Nenhum cliente cadastrado neste banco.'));
}
function projectPage(){
 return heading('Obras','Endereços e vínculo com cada cliente.','Nova obra','new-project')+
 (state.projects.length?listRows(state.projects,[
 {title:'Obra',render:x=>'<strong>'+esc(x.title)+'</strong>'},
 {title:'Cliente',render:x=>esc(x.client_name||'—')},
 {title:'Local',render:x=>esc(x.address||'—')},
 {title:'Situação',render:x=>statusPill(x.status)},
 {title:'Ações',render:x=>actions(x,'project')}
 ]):empty('Nenhuma obra cadastrada. Cadastre um cliente primeiro.'));
}
function usersPage(){
 return heading('Usuários','Contas protegidas com perfis de acesso; criação somente pelo administrador.','Novo usuário','new-user')+
 (state.users.length?listRows(state.users,[
 {title:'Usuário',render:x=>'<strong>'+esc(x.login)+'</strong>'},
 {title:'Perfil',render:x=>statusPill(x.role)},
 {title:'Situação',render:x=>x.is_active?'<span class="ok">Ativo</span>':'<span class="danger">Desativado</span>'},
 {title:'Ações',render:x=>x.id===state.user.id?'Minha conta':'<button class="btn" data-action="edit-user" data-id="'+esc(x.id)+'">Permissões</button>'}
 ]):empty('Apenas a conta atual foi cadastrada.'));
}
function budgetPage(){
 return heading('Orçamentos','Minutas persistentes, ainda sem emissão contratual.','Novo orçamento','new-budget')+
 (state.budgets.length?listRows(state.budgets,[
 {title:'Código / título',render:x=>'<strong>'+esc(x.code)+'</strong><div>'+esc(x.title)+'</div>'},
 {title:'Cliente',render:x=>esc(x.client_name||'—')},
 {title:'Regime / data-base',render:x=>esc(x.regime)+'<div class="muted">'+esc(x.reference_month)+'</div>'},
 {title:'Situação',render:x=>statusPill(x.status)},
 {title:'Ações',render:x=>actions(x,'budget')}
 ]):empty('Nenhum orçamento salvo. Cadastre um cliente e abra um orçamento.'));
}
function budgetDetail(){
 const b=state.detail;if(!b)return empty('Orçamento não encontrado.');
 const sum=(b.items||[]).reduce((a,x)=>a+Number(x.quantity)*Number(x.direct_unit_cost),0);
 return heading(b.title,b.code+' • '+(b.client_name||'Cliente')+' • orçamento de desenvolvimento')+
 '<div class="actions"><button class="btn" data-action="back-budget">Voltar</button>'+
 '<button class="btn primary" data-action="open-costing">Conferir custos e BDI</button>'+
 '<button class="btn" data-action="open-schedule">Cronograma</button>'+
 '<button type="button" class="btn" data-action="offline-save">Salvar para usar offline</button>'+
 '<button type="button" class="btn" data-action="offline-sync">Sincronizar rascunho offline</button>'+
 '<a class="btn" href="/offline.html">Abrir modo offline</a>'+
 '<button class="btn" data-action="open-finance">Propostas e finanças</button>'+ (writeable()?'<button class="btn" data-action="new-item">+ Adicionar serviço</button>':'')+'</div>'+
 '<div class="grid"><div class="card"><div class="muted">Custo direto preliminar</div><div class="metric">'+BRL(sum)+'</div></div>'+
 '<div class="card"><div class="muted">BDI configurado</div><div class="metric">'+esc(b.bdi_pct)+'%</div></div>'+
 '<div class="card"><div class="muted">Prévia aritmética (não validada)</div><div class="metric">'+BRL(sum*(1+Number(b.bdi_pct)/100))+'</div></div></div>'+
 '<div class="notice"><strong>Não emitir proposta.</strong> A composição detalhada, BDI, encargos, produtividade e prazo ainda requerem conferência. Esta prévia não representa preço aprovado.</div>'+
 ((b.items||[]).length?listRows(b.items,[
 {title:'Serviço',render:x=>esc(x.source_name)},
 {title:'Código',render:x=>esc(x.source_code||'Próprio')},
 {title:'Quantidade',render:x=>esc(x.quantity)+' '+esc(x.unit)},
 {title:'Unitário',render:x=>BRL(x.direct_unit_cost)},
 {title:'Custo direto',render:x=>BRL(Number(x.quantity)*Number(x.direct_unit_cost))},
 {title:'Ações',render:x=>writeable()?'<button class="btn" data-action="edit-item" data-id="'+esc(x.id)+'">Editar</button> <button class="btn danger" data-action="remove-item" data-id="'+esc(x.id)+'">Remover</button>':'—'}
 ]):empty('Sem serviços cadastrados.'))+
 automaticBudgetPanel(state.autoBriefing,esc,{budgetId:b.id});
}
function render(){
 if(!state.user){authView();return}
 if(state.user.must_change_password){forcedPasswordView();return}
 shell();const body=document.querySelector('#private-content');
 body.innerHTML=state.view==='clientes'?clientPage():state.view==='obras'?projectPage():state.view==='orcamentos'?budgetPage():state.view==='usuarios'?usersPage():state.view==='detalhe'?budgetDetail():state.view==='custos'?costPage({state,esc,writeable}):state.view==='cronograma'?schedulePage({state,esc,writeable}):state.view==='financas'?financePage({state,esc,writeable}):dashboard();
}
function dialog(title,contents){
 const pop=document.createElement('div');pop.className='dialog';pop.id='secure-dialog';pop.innerHTML='<section class="dialog-panel" role="dialog" aria-modal="true"><div class="row"><h2>'+esc(title)+'</h2><button class="btn" data-action="close-dialog" aria-label="Fechar">✕</button></div>'+contents+'</section>';
 document.body.append(pop);
}
const submitButtons='<div class="actions" style="margin-top:16px"><button type="submit" class="btn primary">Salvar</button><button type="button" class="btn" data-action="close-dialog">Cancelar</button></div>';
function userModal(x={}){
 const role=x.role||'orcamentista';
 const profiles=['orcamentista','revisor','consulta'];
 const form=x.id?'':field('Identificador de acesso','login','text',true,'','minlength="4" maxlength="120"')+
 field('Senha temporária (mínimo 12 caracteres)','password','password',true,'','minlength="12"');
 const select='<div class="field"><label>Perfil</label><select name="role">'+profiles.map(p=>'<option '+(p===role?'selected':'')+'>'+p+'</option>').join('')+'</select></div>';
 const enabled=x.id?'<div class="field"><label>Conta</label><select name="is_active"><option value="true" '+(x.is_active?'selected':'')+'>Ativa</option><option value="false" '+(!x.is_active?'selected':'')+'>Desativada</option></select></div>':'';
 dialog(x.id?'Permissões do usuário':'Novo usuário','<form id="user-form" data-id="'+esc(x.id||'')+'">'+form+select+enabled+submitButtons+'</form>');
}
function passwordModal(){dialog('Alterar senha','<form id="password-form">'+field('Senha atual','current_password','password',true)+field('Nova senha (mín. 12 caracteres)','new_password','password',true,'','minlength="12"')+submitButtons+'</form>')}
function modalClient(x={}){
 const form=field('Nome / razão social','name','text',true,x.name)+field('CPF/CNPJ (apenas teste)','tax_id','text',false,x.tax_id)+
 field('E-mail','email','email',false,x.email)+field('Telefone','phone','tel',false,x.phone)+field('Endereço','address','text',false,x.address)+submitButtons;
 dialog(x.id?'Editar cliente':'Novo cliente','<form id="client-form" data-id="'+esc(x.id||'')+'">'+form+'</form>');
}
function modalProject(x={}){
 if(!state.clients.length){toast('Cadastre um cliente antes de abrir uma obra.',true);return}
 const form=selectField('Cliente','client_id',state.clients,x.client_id)+field('Nome da obra','title','text',true,x.title)+field('Local de execução','address','text',false,x.address)+submitButtons;
 dialog(x.id?'Editar obra':'Nova obra','<form id="project-form" data-id="'+esc(x.id||'')+'">'+form+'</form>');
}
function modalBudget(x={}){
 if(!state.clients.length){toast('Cadastre um cliente primeiro.',true);return}
 const projectOptions=state.projects.map(p=>({...p,name:p.title+' • '+p.client_name}));
 const form=selectField('Cliente','client_id',state.clients,x.client_id)+
 '<div class="field"><label>Obra (opcional)</label><select name="project_id" class="input"><option value="">Sem vínculo</option>'+
 projectOptions.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===x.project_id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>'+
 field('Título do orçamento','title','text',true,x.title)+
 field('Data-base (AAAA-MM)','reference_month','month',true,x.reference_month||'2026-07')+
 '<div class="field"><label>Regime</label><select name="regime"><option '+(x.regime==='Sem desoneração'?'selected':'')+'>Sem desoneração</option><option '+(x.regime==='Com desoneração'?'selected':'')+'>Com desoneração</option></select></div>'+
 field('BDI preliminar (%)','bdi_pct','number',true,x.bdi_pct??25,'step="0.01" min="0" max="100"')+(x.id?'<input type="hidden" name="lock_version" value="'+esc(x.lock_version)+'">':'')+submitButtons;
 dialog(x.id?'Editar orçamento':'Novo orçamento','<form id="budget-form" data-id="'+esc(x.id||'')+'">'+form+'</form>');
}
function modalItem(x={},forceManual=false){
 if(!x.id&&!forceManual){
  return showServiceCatalog({dialog,api,esc,field,state,toast,manual:()=>modalItem({},true)});
 }
 if(x.id&&x.reference_price_id){
  return showOfficialServiceEdit({dialog,esc,field,item:x,state});
 }
 const form=field('Descrição do serviço','source_name','text',true,x.source_name)+field('Código referência','source_code','text',false,x.source_code)+
 '<div class="two">'+field('Unidade','unit','text',true,x.unit||'m²')+field('Posição','position','number',true,x.position??(state.detail?.items?.length||0)+1,'min="1" step="1"')+'</div>'+
 '<div class="two">'+field('Quantidade medida','quantity','number',true,x.quantity??1,'min="0.000001" step="any"')+
 field('Custo unitário direto (R$)','direct_unit_cost','number',true,x.direct_unit_cost??0,'min="0" step="any"')+'</div>'+submitButtons;
 dialog(x.id?'Editar serviço':'Novo serviço','<form id="item-form" data-id="'+esc(x.id||'')+'">'+form+'</form>');
}
async function changeView(view){state.view=view;state.detail=null;state.autoBriefing=null;render()}
async function refreshAutomaticBriefing(){
 const id=state.detail?.id,version=state.detail?.lock_version;
 if(!id)return;
 try{
  const result=await api('budgets/'+id+'/automatic-briefing');
  if(state.detail?.id===id&&state.detail?.lock_version===version)state.autoBriefing=result;
 }catch(e){if(state.detail?.id===id)state.autoBriefing={error:e.message}}
 if(state.detail?.id===id&&state.view==='detalhe')render();
}
async function refreshAutomaticPlan(){
 const id=state.detail.id,q=new URLSearchParams(state.scheduleWorkforceSettings||{});
 const [estimate,planning]=await Promise.all([
  api('budgets/'+id+'/workforce-estimate?'+q).catch(e=>({error:e.message})),
  api('budgets/'+id+'/planning-config').catch(e=>({error:e.message}))
 ]);
 state.scheduleWorkforce=estimate;state.schedulePlanning=planning;
 state.detail=await api('budgets/'+id);
 render();
}
const formData=form=>Object.fromEntries(new FormData(form).entries());
document.addEventListener('submit',async e=>{
 const form=e.target;if(!form.id)return;e.preventDefault();
 const send=form.querySelector('[type="submit"]');if(send)send.disabled=true;
 try{
  const b=formData(form);
  if(form.id==='authForm'){
   const setup=state.mode==='setup';
   const result=await api('auth/'+(setup?'bootstrap':'login'),'POST',setup?{bootstrap_secret:b.bootstrap_secret,login:b.login,password:b.password}:{login:b.login,password:b.password});
   form.reset();if(setup){state.mode='login';toast('Administrador criado. Faça login.');authView()}else{state.user=result.user;if(!state.user.must_change_password)await loadLists();state.view='inicio';render()}return;
  }
  if(form.id.startsWith('finance-')){
    await financeHandleForm(form,{state,api,toast,refresh:async()=>{
      const base='budgets/'+state.detail.id+'/';
      [state.finance.summary,state.finance.drafts,state.finance.actuals,state.finance.closeout,
       state.finance.receipts,state.finance.forecasts,state.finance.readiness]=await Promise.all([
        api(base+'financial-summary'),api(base+'proposal-drafts'),
        api(base+'financial-actuals'),api(base+'financial-closeout'),
        api(base+'financial-receipts'),api(base+'financial-forecasts'),
        api(base+'commercial-readiness')
      ]);
      render();
    }});return;
  }
  if(form.id.startsWith('company-')){
    await companyCostsSubmit(form,{state,api,toast,dialog,esc,refresh:async()=>{
      const q=new URLSearchParams(state.scheduleWorkforceSettings||{});
      state.scheduleWorkforce=await api('budgets/'+state.detail.id+'/workforce-estimate?'+q);
      render();
    }});return;
  }
  if(form.id.startsWith('planning-front-')||form.id==='planning-link-form'){
    if(!state.schedulePlanning?.budget?.lock_version&&state.schedulePlanning?.budget?.lock_version!==0)throw Error('Plano desatualizado');
    const budget='budgets/'+state.detail.id;
    const path=budget+'/planning-config';
    const payload={...b,lock_version:state.schedulePlanning.budget.lock_version};
    if(form.id.startsWith('planning-front-'))payload.budget_item_id=form.dataset.service;
    if(form.id==='planning-link-form'&&payload.predecessor_item_id===payload.successor_item_id)
      throw Error('Escolha dois serviços diferentes');
    await api(path,form.id==='planning-link-form'?'POST':'PUT',payload);
    await refreshAutomaticPlan();
    toast('Frente e dependências atualizadas.');return;
  }
  if(form.id==='workforce-settings-form'){
    const args=Object.fromEntries(new FormData(form).entries());
    const q=new URLSearchParams(args);
    const estimate=await api('budgets/'+state.detail.id+'/workforce-estimate?'+q);
    state.scheduleWorkforceSettings=args;
    state.scheduleWorkforce=estimate;
    render();toast('Profissionais, dias e frentes recalculados.');return;
  }
  if(form.id.startsWith('schedule-')){
    await scheduleHandleForm(form,{state,api,toast,refresh:async reload=>{
      if(reload)[state.schedulePlan,state.scheduleProgress]=await Promise.all([
        api('budgets/'+state.detail.id+'/schedule-plan'),
        api('budgets/'+state.detail.id+'/schedule-progress')
      ]);
      if(reload)state.scheduleRemaining=null;
      render();
    }});
    return;
  }
  if(form.id.startsWith('cost-')){
    await costHandleForm(form,{state,api,esc,toast,refresh:async()=>{
      state.detail=await api('budgets/'+state.detail.id);
      state.costs=await api('budgets/'+state.detail.id+'/costs');
      render();
    }});
    return;
  }
  const id=form.dataset.id;
  if(form.id==='user-form'){
    if(id)b.is_active=b.is_active==='true';
    await api('users'+(id?'/'+id:''),id?'PUT':'POST',b);
    document.querySelector('#secure-dialog')?.remove();await loadLists();render();toast('Usuário salvo. Compartilhe senha temporária fora do sistema e solicite alteração no primeiro acesso.');return;
  }
  if(form.id==='password-form'){
    await api('auth/change-password','POST',b);
    if(state.user?.must_change_password){state.user.must_change_password=false;await loadLists();state.view='inicio';render()}
    else document.querySelector('#secure-dialog')?.remove();
    toast('Senha alterada. Outras sessões foram encerradas.');return;
  }
  if(form.id==='client-form')await api('clients'+(id?'/'+id:''),id?'PUT':'POST',b);
  else if(form.id==='project-form')await api('projects'+(id?'/'+id:''),id?'PUT':'POST',b);
  else if(form.id==='budget-form'){if(id)b.lock_version=Number(b.lock_version);await api('budgets'+(id?'/'+id:''),id?'PUT':'POST',b);}
  else if(form.id==='catalog-item-form'||form.id==='catalog-edit-form'){
   if(form.id==='catalog-item-form'&&!b.reference_price_id)throw Error('Selecione um serviço do catálogo antes de salvar.');
   if(!state.detail||state.detail.status!=='rascunho')throw Error('Abra um orçamento em rascunho.');
   const route='budgets/'+state.detail.id+'/siurb-items'+(form.id==='catalog-edit-form'?'/'+id:'');
   await api(route,form.id==='catalog-edit-form'?'PUT':'POST',{
    lock_version:state.detail.lock_version,position:Number(b.position),quantity:b.quantity,
    ...(form.id==='catalog-item-form'?{reference_price_id:b.reference_price_id}:{})
   });
   state.detail=await api('budgets/'+state.detail.id);
  }
  else if(form.id==='item-form'){
   b.position=Number(b.position);b.quantity=Number(b.quantity);b.direct_unit_cost=Number(b.direct_unit_cost);
   await api('budgets/'+state.detail.id+'/items'+(id?'/'+id:''),id?'PUT':'POST',b);
   state.detail=await api('budgets/'+state.detail.id);
  }
  document.querySelector('#secure-dialog')?.remove();
  if(['catalog-item-form','catalog-edit-form','item-form'].includes(form.id)){
   state.autoBriefing=null;render();await refreshAutomaticBriefing();
  }
  await loadLists();render();toast('Registro salvo no PostgreSQL; cálculos automáticos atualizados.');
 }catch(err){toast(err.message,true)}finally{if(send)send.disabled=false}
});
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const act=btn.dataset.action;
 try{
  if(act==='retry'){await init();return}
  if(act==='automatic-refresh'){state.autoBriefing=null;render();await refreshAutomaticBriefing();return}
  if(act==='login-view'||act==='setup-view'){state.mode=act==='setup-view'?'setup':'login';render();return}
  if(act==='theme'){const order=['auto','light','dark'],next=order[(order.indexOf(localStorage.getItem('civolten-theme')||'auto')+1)%3];localStorage.setItem('civolten-theme',next);theme();render();toast('Aparência: '+(next==='auto'?'automático':next==='light'?'claro':'escuro'));return}
  if(act==='close-dialog'){document.querySelector('#secure-dialog')?.remove();return}
  if(act==='offline-save'){
    if(!state.detail?.id)throw Error('Abra um orçamento');
    const snapshot=await saveBudgetForOffline(state.detail);
    toast('Orçamento '+snapshot.code+' salvo neste celular. As cópias locais não possuem login próprio.');return;
  }
  if(act==='offline-sync'){
    if(!state.detail?.id)throw Error('Abra um orçamento');
    const draft=await getOfflineDraft(state.detail.id);
    if(!draft)throw Error('Nenhuma cópia offline deste orçamento. Use Salvar para usar offline primeiro.');
    const changes=pendingChanges(draft);
    if(!changes.length){toast('Nenhuma quantidade pendente. Anotações locais continuam somente no celular.');return}
    if(!window.confirm('Sincronizar '+changes.length+' quantidade(s) deste orçamento com o servidor? Se outro usuário alterou os itens, a operação será interrompida.'))return;
    const result=await syncOfflineBudget(state.detail.id,api);
    state.detail=await api('budgets/'+state.detail.id);
    render();toast(result.synced+' quantidade(s) sincronizada(s). Notas locais não são enviadas.');return;
  }
  if(act==='logout'){await api('auth/logout','POST',{});state.user=null;state.mode='login';render();return}
  if(act==='view'){await changeView(btn.dataset.view);return}
  if(act==='password-modal'){passwordModal();return}
  if(act==='release-readiness'){
    if(state.user?.role!=='administrador')throw Error('Acesso reservado ao administrador');
    const report=await api('release-readiness');
    const checks=report.gates?.checks||[];
    const op=report.operational||{},account=op.account_setup||{};
    const rows=checks.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+
      (x.passed?'<span class="ok">Verificado</span>':'<span class="danger">Pendente</span>')+
      '</td></tr>').join('');
    dialog('Liberação operacional CIVOLTEN',
      '<div class="notice"><strong>'+ (report.commercial_release?'Liberado':'Uso comercial ainda não liberado')+
      '</strong><p>Dados deste diagnóstico vêm do banco e das condições de homologação. Não representam assinatura técnica ou autorização para emitir contratos.</p></div>'+
      '<p>Estrutura do banco: '+(report.schema?.ready?'<strong class="ok">Validada</strong>':'<strong class="danger">Incompleta</strong>')+'</p>'+
      (report.schema?.missing_tables?.length?'<p class="muted">Tabelas pendentes: '+esc(report.schema.missing_tables.join(', '))+'</p>':'')+
      '<h3>Situação observada no banco</h3>'+
      '<p>Administrador ativo: '+(account.administrator_present?'<strong class="ok">Sim</strong>':'<strong class="danger">Não</strong>')+'</p>'+
      '<p>Troca de senha inicial: '+(account.administrator_password_change_pending?'<strong class="danger">Pendente</strong>':'<strong class="ok">Nenhuma pendência registrada</strong>')+'</p>'+
      '<p>Orçamentos registrados: '+esc(op.budget_records??'não conferido')+
      ' · Preços de referência: '+esc(op.reference_price_records??'não conferido')+
      ' · Rascunhos de proposta: '+esc(op.proposal_draft_records??'não conferido')+'</p>'+
      '<p class="muted tiny">Backup criptografado periódico e login em dois dispositivos: exigem comprovação operacional independente.</p>'+
      '<div class="table-wrap"><table class="table"><thead><tr><th>Verificação</th><th>Situação</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<p class="muted tiny">Somente a conclusão documentada dos requisitos e a confirmação do responsável podem autorizar o uso contratual.</p>');
    return;
  }
  if(act==='new-user'){userModal();return}
  if(act==='edit-user'){const found=state.users.find(u=>u.id===btn.dataset.id);if(found)userModal(found);return}
  if(['archive-client','archive-project','archive-budget','remove-item'].includes(act)){
    const label=act==='remove-item'?'Este serviço será retirado do orçamento, mantendo a auditoria.':act==='archive-budget'?'O orçamento será cancelado, sem excluir seu histórico.':'O cadastro será arquivado, preservando vínculos e histórico.';
    if(!window.confirm(label+' Confirma?'))return;
    const target=act==='archive-client'?'clients/'+btn.dataset.id:act==='archive-project'?'projects/'+btn.dataset.id:act==='archive-budget'?'budgets/'+btn.dataset.id:'budgets/'+state.detail.id+'/items/'+btn.dataset.id;
    await api(target,'DELETE');
    if(act==='remove-item'){
     state.detail=await api('budgets/'+state.detail.id);
     state.autoBriefing=null;render();await refreshAutomaticBriefing();
    }
    await loadLists();render();toast('Ação registrada na auditoria.');return;
  }
  if(act==='open-finance'){
    const base='budgets/'+state.detail.id+'/';
    const [summary,drafts,actuals,closeout,receipts,forecasts,readiness]=await Promise.all([
      api(base+'financial-summary'),api(base+'proposal-drafts'),api(base+'financial-actuals'),
      api(base+'financial-closeout'),api(base+'financial-receipts'),
      api(base+'financial-forecasts'),api(base+'commercial-readiness')
    ]);
    state.finance={summary,drafts,actuals,closeout,receipts,forecasts,readiness};
    state.view='financas';render();return;
  }
  if(act==='finance-back'){
    state.view='detalhe';state.detail=await api('budgets/'+state.detail.id);render();return;
  }
  if(act==='finance-open-draft'){
    state.financeDraft=await api('budgets/'+state.detail.id+'/proposal-drafts/'+btn.dataset.id);
    financeDialog('finance-view-draft',{state,dialog,esc});return;
  }
  if(['finance-create-draft','finance-add-actual','finance-review-actual',
      'finance-add-receipt','finance-review-receipt','finance-add-forecast','finance-review-forecast'].includes(act)){
    state.financeSelected=btn.dataset.id||null;
    financeDialog(act,{state,dialog,esc});return;
  }
  if(act.startsWith('company-')){
    await companyCostsDialog(act,{state,api,dialog,esc,id:btn.dataset.id||null});
    return;
  }
  if(act==='open-schedule'){
    state.scheduleAdvanced=false;state.schedulePlan=null;state.scheduleProgress=null;
    state.schedulePreview=null;state.scheduleRemaining=null;
    state.view='cronograma';state.scheduleWorkforce=null;render();
    await refreshAutomaticPlan();return;
  }
  if(act==='planning-remove-link'){
    if(!state.schedulePlanning?.budget)throw Error('Recarregue o planejamento');
    await api('budgets/'+state.detail.id+'/planning-config','DELETE',{
      predecessor_item_id:btn.dataset.before,successor_item_id:btn.dataset.after,
      lock_version:state.schedulePlanning.budget.lock_version});
    await refreshAutomaticPlan();toast('Dependência removida.');return;
  }
  if(act==='schedule-advanced-open'){
    const base='budgets/'+state.detail.id+'/';
    [state.schedulePlan,state.scheduleProgress]=await Promise.all([
      api(base+'schedule-plan'),api(base+'schedule-progress')
    ]);
    state.scheduleAdvanced=true;render();return;
  }
  if(act==='schedule-advanced-close'){state.scheduleAdvanced=false;render();return}
  if(act==='schedule-back'){
    state.view='detalhe';state.detail=await api('budgets/'+state.detail.id);render();return;
  }
  if(act==='schedule-run-remaining'){
    const form=document.querySelector('#schedule-simulate-form');
    if(!form||!form.reportValidity())return;
    const query=new URLSearchParams(new FormData(form));
    state.scheduleSettings=Object.fromEntries(new FormData(form));
    state.scheduleRemaining=await api('budgets/'+state.detail.id+'/schedule-remaining?'+query.toString());
    render();return;
  }
  if(['schedule-archive-task','schedule-archive-crew','schedule-remove-dependency'].includes(act)){
    if(!window.confirm('Confirmar alteração? Atividades com medições ou vínculos em uso não serão arquivadas.'))return;
    const base='budgets/'+state.detail.id+'/';
    const route=act==='schedule-archive-task'?'schedule-tasks/'+btn.dataset.id:
      act==='schedule-archive-crew'?'schedule-crews/'+btn.dataset.id:'schedule-dependencies/'+btn.dataset.id;
    const payload={lock_version:state.schedulePlan.budget.lock_version};
    if(act==='schedule-remove-dependency')payload.successor_id=btn.dataset.successor;
    await api(base+route,'DELETE',payload);
    [state.schedulePlan,state.scheduleProgress]=await Promise.all([
      api(base+'schedule-plan'),api(base+'schedule-progress')
    ]);
    state.schedulePreview=null;state.scheduleRemaining=null;render();toast('Alteração auditada.');return;
  }
  if(['schedule-add-crew','schedule-add-task','schedule-add-dependency','schedule-review-task','schedule-add-progress','schedule-review-progress','schedule-edit-crew','schedule-edit-task'].includes(act)){
    state.scheduleTaskId=btn.dataset.id||null;
    scheduleDialog(act,{state,dialog,field,esc});return;
  }
  if(act==='open-costing'){
    state.costs=await api('budgets/'+state.detail.id+'/costs');
    state.view='custos';render();return;
  }
  if(act==='cost-back'){
    state.view='detalhe';state.detail=await api('budgets/'+state.detail.id);render();return;
  }
  if(act==='cost-evidence'){
    costEvidenceDialog(btn.dataset.id,{state,dialog,field,esc});return;
  }
  if(['cost-bdi-form','cost-add-extra','cost-add-siurb'].includes(act)){
    costDialog(act,{state,dialog,field,esc,writeable,toast});return;
  }
  if(act.startsWith('cost-')){
    await costHandleClick(btn,{state,api,dialog,field,esc,toast,refresh:async()=>{
       state.detail=await api('budgets/'+state.detail.id);
       state.costs=await api('budgets/'+state.detail.id+'/costs');
       render();
    }});
    return;
  }
  if(act==='new-client'){modalClient();return}
  if(act==='new-project'){modalProject();return}
  if(act==='new-budget'){modalBudget();return}
  if(act==='new-item'){modalItem();return}
  if(act==='edit-client'){modalClient(state.clients.find(x=>x.id===btn.dataset.id)||{});return}
  if(act==='edit-project'){modalProject(state.projects.find(x=>x.id===btn.dataset.id)||{});return}
  if(act==='edit-budget'){modalBudget(state.budgets.find(x=>x.id===btn.dataset.id)||{});return}
  if(act==='edit-item'){modalItem(state.detail.items.find(x=>x.id===btn.dataset.id)||{});return}
  if(act==='detail-budget'){
   state.detail=await api('budgets/'+btn.dataset.id);
   state.view='detalhe';state.autoBriefing=null;render();
   await refreshAutomaticBriefing();return;
  }
  if(act==='back-budget'){await changeView('orcamentos');return}
 }catch(err){toast(err.message,true)}
});
async function init(){
 theme();
 try{const status=await api('auth/status');if(status.authenticated){state.user=status.user;if(!state.user.must_change_password)await loadLists()}}
 catch(err){console.warn('[CIVOLTEN] Painel seguro indisponível:',err.message);app.innerHTML='<section class="login"><div class="login-card">'+brand()+'<h1>API indisponível</h1><p class="error">'+esc(err.message)+'</p><div class="actions"><button class="btn primary" data-action="retry">Tentar novamente</button><a class="btn" href="/offline.html">Abrir rascunhos offline</a></div></div></section>';return}
 render();
}
init();
