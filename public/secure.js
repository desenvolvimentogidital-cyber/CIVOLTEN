import {costPage,costDialog,costEvidenceDialog,costHandleForm,costHandleClick} from './secure-costing.js';
/* Painel privado CIVOLTEN — desenvolvimento/homologação
 * Jamais usar localStorage para informações comerciais ou tokens de sessão.
 */
const state={user:null,view:'inicio',clients:[],projects:[],budgets:[],detail:null,users:[],costs:null,costCatalog:[],mode:'login',busy:false};
const app=document.querySelector('#secure-app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BRL=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const writeable=()=>state.user&&['administrador','orcamentista'].includes(state.user.role);
const theme=()=>{const pref=localStorage.getItem('civolten-theme')||'auto';document.documentElement.classList.toggle('dark',pref==='dark'||(pref==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches))};
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
 '<div class="notice tiny">Ambiente de desenvolvimento. Não utilizar dados pessoais reais até a homologação de segurança e backup.</div>'+
 '<form id="authForm">'+(setup?field('Código de inicialização','bootstrap_secret','password',true):'')+
 field('Usuário','login','text',true)+field('Senha','password','password',true)+
 '<button class="btn primary block" type="submit">'+(setup?'Criar administrador':'Entrar')+'</button></form>'+
 '<p class="muted tiny">O sistema não envia senhas nem dados para o armazenamento local do navegador.</p>'+
 '<button class="btn block" type="button" data-action="'+(setup?'login-view':'setup-view')+'">'+(setup?'Voltar ao login':'Primeira configuração do administrador')+'</button>'+
 '<p class="fallback"><a href="/">Voltar à demonstração</a></p></div></section>';
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
const nav=[['inicio','Painel'],['clientes','Clientes'],['obras','Obras'],['orcamentos','Orçamentos'],['usuarios','Usuários']];
function navHTML(){
 return nav.filter(([id])=>id!=='usuarios'||state.user?.role==='administrador').map(([id,text])=>'<button class="nav '+(state.view===id?'active':'')+'" data-action="view" data-view="'+id+'">'+esc(text)+'</button>').join('');
}
function shell(){
 app.innerHTML='<div class="layout"><aside class="sidebar">'+brand()+'<div class="muted tiny">GESTÃO SEGURA · DESENVOLVIMENTO</div>'+navHTML()+
 '<div class="bottom"><button class="btn block" style="margin-bottom:8px" data-action="password-modal">Alterar senha</button><button class="btn block" data-action="logout">Sair da conta</button></div></aside>'+
 '<div class="main"><header class="topbar"><div><strong>CIVOLTEN</strong><div class="muted tiny">Banco PostgreSQL • Neon</div></div><div class="actions"><span class="tag">'+esc(state.user.login)+' · '+esc(state.user.role)+'</span><button class="btn" data-action="theme">Aparência</button><button class="btn" data-action="logout">Sair</button></div></header><div class="container" id="private-content"></div></div>'+
 '<nav class="menu-mobile">'+navHTML()+'</nav></div>';
}
async function loadLists(){
 const [a,b,c]=await Promise.all([api('clients'),api('projects'),api('budgets')]);
 state.clients=a;state.projects=b;state.budgets=c;
 state.users=state.user?.role==='administrador'?await api('users'):[];
}
function heading(title,subtitle,button='',action=''){
 return '<div class="row"><div><h1>'+esc(title)+'</h1><p class="muted">'+esc(subtitle)+'</p></div>'+
 (button&&writeable()?'<button class="btn primary" data-action="'+esc(action)+'">+ '+esc(button)+'</button>':'')+'</div>';
}
function empty(message){return '<div class="card"><p class="muted">'+esc(message)+'</p></div>'}
function listRows(items,cols){
 return '<div class="card table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+esc(c.title)+'</th>').join('')+'</tr></thead><tbody>'+
 items.map(item=>'<tr>'+cols.map(c=>'<td>'+c.render(item)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function statusPill(x){return '<span class="tag">'+esc(x||'rascunho')+'</span>'}
function actions(x,kind){
 let btn='<button class="btn" data-action="edit-'+kind+'" data-id="'+esc(x.id)+'">Editar</button>';
 if(kind==='budget')btn='<button class="btn" data-action="detail-budget" data-id="'+esc(x.id)+'">Abrir</button> '+btn;
 return writeable()?btn+' <button class="btn danger" data-action="archive-'+kind+'" data-id="'+esc(x.id)+'">'+(kind==='budget'?'Cancelar':'Arquivar')+'</button>':kind==='budget'?'<button class="btn" data-action="detail-budget" data-id="'+esc(x.id)+'">Abrir</button>':'—';
}
function dashboard(){
 return heading('Painel administrativo','Informações salvas no PostgreSQL, acessíveis com sua conta.')+
 '<div class="grid"><div class="card"><div class="muted">Clientes</div><div class="metric">'+state.clients.length+'</div></div>'+
 '<div class="card"><div class="muted">Obras</div><div class="metric">'+state.projects.length+'</div></div>'+
 '<div class="card"><div class="muted">Orçamentos</div><div class="metric">'+state.budgets.length+'</div></div></div>'+
 '<div class="card"><h2>Controle de qualidade</h2><p>Os orçamentos persistidos nesta etapa são <strong>rascunhos</strong>. A proposta contratual e o cronograma definitivo continuam bloqueados até a homologação.</p>'+
 '<p class="muted">A gestão nesta área não utiliza os dados fictícios da demonstração. Fonte oficial SIURB, BDI e engenharia de custos serão integrados por etapas e terão revisão obrigatória.</p></div>';
}
function clientPage(){
 return heading('Clientes','Cadastro persistente com histórico no banco de desenvolvimento.','Novo cliente','new-client')+
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
 '<div class="actions"><button class="btn" data-action="back-budget">Voltar</button><button class="btn primary" data-action="open-costing">Conferir custos e BDI</button>'+ (writeable()?'<button class="btn" data-action="new-item">+ Serviço</button>':'')+'</div>'+
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
 ]):empty('Sem serviços cadastrados.'));
}
function render(){
 if(!state.user){authView();return}
 if(state.user.must_change_password){forcedPasswordView();return}
 shell();const body=document.querySelector('#private-content');
 body.innerHTML=state.view==='clientes'?clientPage():state.view==='obras'?projectPage():state.view==='orcamentos'?budgetPage():state.view==='usuarios'?usersPage():state.view==='detalhe'?budgetDetail():state.view==='custos'?costPage({state,esc,writeable}):dashboard();
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
function modalItem(x={}){
 const form=field('Descrição do serviço','source_name','text',true,x.source_name)+field('Código referência','source_code','text',false,x.source_code)+
 '<div class="two">'+field('Unidade','unit','text',true,x.unit||'m²')+field('Posição','position','number',true,x.position??(state.detail?.items?.length||0)+1,'min="1" step="1"')+'</div>'+
 '<div class="two">'+field('Quantidade medida','quantity','number',true,x.quantity??1,'min="0.000001" step="any"')+
 field('Custo unitário direto (R$)','direct_unit_cost','number',true,x.direct_unit_cost??0,'min="0" step="any"')+'</div>'+submitButtons;
 dialog(x.id?'Editar serviço':'Novo serviço','<form id="item-form" data-id="'+esc(x.id||'')+'">'+form+'</form>');
}
async function changeView(view){state.view=view;state.detail=null;render()}
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
  else if(form.id==='item-form'){
   b.position=Number(b.position);b.quantity=Number(b.quantity);b.direct_unit_cost=Number(b.direct_unit_cost);
   await api('budgets/'+state.detail.id+'/items'+(id?'/'+id:''),id?'PUT':'POST',b);
   state.detail=await api('budgets/'+state.detail.id);
  }
  document.querySelector('#secure-dialog')?.remove();
  await loadLists();render();toast('Registro salvo no PostgreSQL.');
 }catch(err){toast(err.message,true)}finally{if(send)send.disabled=false}
});
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const act=btn.dataset.action;
 try{
  if(act==='retry'){await init();return}
  if(act==='login-view'||act==='setup-view'){state.mode=act==='setup-view'?'setup':'login';render();return}
  if(act==='theme'){const order=['auto','light','dark'],next=order[(order.indexOf(localStorage.getItem('civolten-theme')||'auto')+1)%3];localStorage.setItem('civolten-theme',next);theme();toast('Aparência: '+(next==='auto'?'automático':next==='light'?'claro':'escuro'));return}
  if(act==='close-dialog'){document.querySelector('#secure-dialog')?.remove();return}
  if(act==='logout'){await api('auth/logout','POST',{});state.user=null;state.mode='login';render();return}
  if(act==='view'){await changeView(btn.dataset.view);return}
  if(act==='password-modal'){passwordModal();return}
  if(act==='new-user'){userModal();return}
  if(act==='edit-user'){const found=state.users.find(u=>u.id===btn.dataset.id);if(found)userModal(found);return}
  if(['archive-client','archive-project','archive-budget','remove-item'].includes(act)){
    const label=act==='remove-item'?'Este serviço será retirado do orçamento, mantendo a auditoria.':act==='archive-budget'?'O orçamento será cancelado, sem excluir seu histórico.':'O cadastro será arquivado, preservando vínculos e histórico.';
    if(!window.confirm(label+' Confirma?'))return;
    const target=act==='archive-client'?'clients/'+btn.dataset.id:act==='archive-project'?'projects/'+btn.dataset.id:act==='archive-budget'?'budgets/'+btn.dataset.id:'budgets/'+state.detail.id+'/items/'+btn.dataset.id;
    await api(target,'DELETE');
    if(act==='remove-item')state.detail=await api('budgets/'+state.detail.id);
    await loadLists();render();toast('Ação registrada na auditoria.');return;
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
  if(act==='detail-budget'){state.detail=await api('budgets/'+btn.dataset.id);state.view='detalhe';render();return}
  if(act==='back-budget'){await changeView('orcamentos');return}
 }catch(err){toast(err.message,true)}
});
async function init(){
 theme();
 try{const status=await api('auth/status');if(status.authenticated){state.user=status.user;if(!state.user.must_change_password)await loadLists()}}
 catch(err){console.warn('[CIVOLTEN] Painel seguro indisponível:',err.message);app.innerHTML='<section class="login"><div class="login-card">'+brand()+'<h1>API indisponível</h1><p class="error">'+esc(err.message)+'</p><button class="btn primary" data-action="retry">Tentar novamente</button></div></section>';return}
 render();
}
init();
