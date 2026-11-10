import {brl,employeeCost,fixedMonthly,variableMonthly,variableQuantity,summary,fmt} from './calc.mjs';
import {costPresetsMissing} from './cost-presets.mjs';
import {unreadReplies} from './proposal-inbox.mjs';
import {payrollConfig,payrollPreset} from './payroll.mjs';
const SHAPES={
 zap:'<path d="m13 2-9 11h7l-1 9 10-12h-7l1-8z"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 coins:'<ellipse cx="8" cy="6" rx="5" ry="2.5"/><path d="M3 6v5c0 1.5 2 2.5 5 2.5s5-1 5-2.5V6M3 11v5c0 1.5 2 2.5 5 2.5 1.1 0 2-.1 2.8-.3"/><ellipse cx="17" cy="12" rx="5" ry="2.5"/><path d="M12 12v6c0 1.5 2 2.5 5 2.5s5-1 5-2.5v-6"/>',
 users:'<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="6" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75"/>',
 chart:'<path d="M4 20V9h4v11M10 20V4h4v16M16 20v-8h4v8M2 20h20"/>',
 calendar:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
 building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-5h6v5M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 17v-4M12 17v-6M16 17v-3"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-1.92 1.92-.06-.06A1.65 1.65 0 0 0 16 18.4a1.65 1.65 0 0 0-1 1.5V20H9v-.1a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.82.33l-.06.06-1.92-1.92.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.5-1H3v-4h.1a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 1.92-1.92.06.06A1.65 1.65 0 0 0 8 5.6a1.65 1.65 0 0 0 1-1.5V4h6v.1a1.65 1.65 0 0 0 1 1.5 1.65 1.65 0 0 0 1.82-.33l.06-.06 1.92 1.92-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.5 1h.1v4h-.1a1.65 1.65 0 0 0-1.5 1z"/>',
 mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 8L22 6"/>',
 lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="m3 3 18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3 3.7M6.1 6.1A16 16 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 4-.7"/>',
 back:'<path d="m15 18-6-6 6-6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 wrench:'<path d="M14.7 6.3a4.7 4.7 0 0 0-6.3 6.3L3 18l3 3 5.4-5.4a4.7 4.7 0 0 0 6.3-6.3L14 13l-3-3z"/>',
 hardhat:'<path d="M3 18h18M5 18v-3a7 7 0 0 1 14 0v3M9 8V5h6v3M12 5v8"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="m8 12 2 2 4-4M8 18h7"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01"/>',
 laptop:'<rect x="4" y="3" width="16" height="13" rx="1"/><path d="M2 20h20l-2-4H4z"/>',
 arrowup:'<path d="m12 19 0-14m-6 6 6-6 6 6"/>',
 edit:'<path d="M12 20h9M15 4l5 5L8 21H3v-5z"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'
};
export const icon=(name,size=24)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(SHAPES[name]||SHAPES.home)+'</svg>';
export const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BRAND='<img src="/assets/civolten-logo.png" class="brand-wordmark" alt="CIVOLTEN — Elétrica & Construção Civil">';
const MARK='<img src="/assets/civolten-simbolo.png" class="brand-symbol" alt="">';
export function authView(mode='login',error='',busy=false){
 const signup=mode==='signup',reset=mode==='reset',newpass=mode==='newpass';
 const sub=signup?'Crie sua conta para organizar a operação.':reset?
 'Informe seu e-mail para recuperar o acesso.':newpass?
 'Defina uma nova senha para sua conta.':'Gestão inteligente para elétrica e construção civil';
 return '<main class="auth-page"><div class="auth-top-glow"></div><div class="auth-inner">'+
  '<div class="auth-brand">'+MARK+BRAND+'</div>'+
  '<p class="auth-tagline">'+e(sub)+'</p><div class="glow-rule"></div>'+
  '<form id="auth-form" class="auth-form">'+
  (signup?'<label class="auth-field">'+icon('user',23)+'<input name="name" required placeholder="Seu nome" autocomplete="name"></label>':'')+
  (newpass?'':'<label class="auth-field">'+icon('mail',23)+'<input type="email" name="email" placeholder="E-mail" autocomplete="email" required></label>')+
  (reset?'':('<label class="auth-field">'+icon('lock',23)+'<input type="password" id="password" name="password" placeholder="Senha" autocomplete="'+(signup?'new-password':'current-password')+'" minlength="8" required>'+
  '<button type="button" class="icon-button show-password" data-action="toggle-password" aria-label="Mostrar senha">'+icon('eye',22)+'</button></label>'))+
  (error?'<p class="auth-error" role="alert">'+e(error)+'</p>':'')+
  '<button class="gold-button auth-submit" type="submit"'+(busy?' disabled':'')+'>'+
  (busy?'Verificando...':reset?'Enviar instruções':newpass?'Salvar nova senha':signup?'Criar conta':'Entrar')+'</button></form>'+
  '<button type="button" class="outlined-button auth-alt" data-action="auth-mode" data-mode="'+(signup||reset||newpass?'login':'signup')+'">'+
  (signup?'Já tenho conta':reset||newpass?'Voltar ao login':'Criar conta')+'</button>'+
  (!signup&&!reset&&!newpass?'<button type="button" class="auth-forgot" data-action="auth-mode" data-mode="reset">Esqueci minha senha</button>':'')+
  '</div><div class="industrial-skyline" aria-hidden="true"></div>'+
  '<footer class="auth-footer">'+icon('lock',18)+'<span>Acesse sua operação com segurança</span></footer></main>';
}
function nav(view,siteUnread=0){
 const items=[['home','Início','home'],['costs','Custos','coins'],['team','Equipe','users'],['more','Mais','more']];
 return '<nav class="bottom-nav" aria-label="Navegação">'+items.map(([id,label,ic])=>
 '<button type="button" data-go="'+id+'" class="nav-item '+(id===view?'active':'')+'" '+(id===view?'aria-current="page"':'')+'>'+
 icon(ic,24)+'<span>'+label+'</span>'+(id==='more'&&siteUnread?'<span class="nav-notice-badge">'+(siteUnread>99?'99+':siteUnread)+'</span>':'')+'</button>').join('')+'</nav>';
}
function top(){
 return '<header class="app-header">'+BRAND+'</header>';
}
export function shell(view,content,siteUnread=0){
 return '<div class="app-screen">'+top()+'<div class="app-scroll">'+content+'</div>'+
  '<div class="edge-glint" aria-hidden="true"></div><div class="industrial-skyline app-skyline" aria-hidden="true"></div>'+nav(view,siteUnread)+'</div>';
}
function metric(title,iconName,value,accent=false){
 return '<div class="metric-card '+(accent?'is-featured':'')+'"><div class="metric-icon">'+icon(iconName,28)+'</div>'+
 '<div class="metric-text"><span>'+title+'</span><strong>'+value+'</strong></div></div>';
}
function heading(iconName,title){
 return '<div class="section-label"><span class="section-icon">'+icon(iconName,22)+'</span><h2>'+title+'</h2><div class="section-streak"></div></div>';
}
export function homeView(data,user,siteUnread=0){
 const s=summary(data);const first=String(user?.user_metadata?.name||user?.name||user?.email?.split('@')[0]||'').trim().split(/\s+/)[0]||'usuário';
 const count=s.employees;
 const works=(data.works||[]).filter(w=>w.status!=='cancelled');
 const plannedHH=works.reduce((sum,w)=>sum+(w.pricedRows||[]).reduce((a,r)=>a+Number(r.hours||0),0),0);
 const actualHH=(data.workLogs||[]).filter(l=>works.some(w=>w.id===l.workOrderId))
  .reduce((sum,l)=>sum+Number(l.hours||0),0);
 const hh=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:2})+' HH';
 const progress=plannedHH?Math.min(100,Math.round(actualHH*100/plannedHH)):0;
 const replies=(data.invites||[]).filter(x=>x.status==='accepted'||x.status==='declined');
 const accepted=replies.filter(x=>x.status==='accepted').length;
 const declined=replies.length-accepted;
 const unseen=unreadReplies(data);
 const newest=unseen.slice().sort((a,b)=>(b.respondedAt||'').localeCompare(a.respondedAt||''))[0];
 const newestCustomer=newest?((data.budgets||[]).find(b=>b.id===newest.budgetId)?.customer||
   newest.budgetSnapshot?.customer||newest.respondentName||'Cliente'):'';
 return '<div class="dashboard">'+
  '<div class="welcome-row"><div class="avatar-outline">'+icon('user',25)+'</div><div class="welcome-text"><h1>Olá, '+e(first)+'</h1>'+
  '<span>Bem-vindo ao seu painel</span></div><button class="small-square" type="button" data-action="notifications" aria-label="Notificações">'+icon('bell',23)+(unseen.length+siteUnread?'<span class="reply-bell-count">'+(unseen.length+siteUnread>99?'99+':unseen.length+siteUnread)+'</span>':'')+'</button></div>'+
  '<div class="horizontal-glow"></div><section class="metric-grid" aria-label="Resumo da empresa">'+
  metric('Custos fixos','coins',brl(s.fixed))+metric('Custos variáveis','chart',brl(s.variable))+
  metric('Funcionários','users',String(count))+metric('Custo mensal','calendar',brl(s.total),true)+
  '</section>'+heading('wrench','Acesso rápido')+
  '<div class="shortcut-grid">'+[
   ['Orçamentos','clipboard','budgets'],['Solicitações do site','mail','site-leads'],['Central de Respostas','mail','inbox'],['Obras e execução','building','works'],['Equipe','users','team'],['Relatórios','file','reports'],['Financeiro','coins','finance']
  ].map(([title,ic,go])=>'<button type="button" class="shortcut" data-go="'+go+'">'+icon(ic,27)+'<span>'+title+'</span>'+(go==='site-leads'&&siteUnread?'<b class="shortcut-notice-badge">'+(siteUnread>99?'99+':siteUnread)+'</b>':'')+'</button>').join('')+
  '</div>'+
  (replies.length?'<button type="button" class="budget-reply-dashboard" '+(newest?
    'data-action="inbox-open" data-id="'+e(newest.id)+'"':'data-go="inbox"')+'>'+
    icon('mail',21)+' <span><strong>'+(
     unseen.length?unseen.length+' nova(s) resposta(s) de clientes':
     'Respostas dos clientes')+'</strong>'+
    (newest?'<small>'+e(newestCustomer)+' '+(newest.status==='accepted'?'aceitou':'recusou')+
     ' a proposta. Toque para abrir o registro.</small>':
     '<small>'+accepted+' aceita(s) · '+declined+' recusada(s). Abrir Central de Respostas.</small>')+
    '</span>'+icon('chevron',17)+'</button>':'')+
   heading('chart','Horas de mão de obra nas obras')+
  '<div class="monthly-row"><div class="month-progress"><div class="progress-line"><span>HH previstas (obras cadastradas)</span><b>'+hh(plannedHH)+'</b></div>'+
  '<div class="bar-track"><div class="bar-fill" style="width:'+(plannedHH?100:0)+'%"></div></div>'+
  '<div class="progress-line"><span>HH realmente apontadas</span><b>'+hh(actualHH)+'</b></div>'+
  '<div class="bar-track light"><div class="bar-fill" style="width:'+progress+'%"></div></div>'+
  '<span class="small-muted">'+(works.length?'Registros acumulados das ordens de serviço, não despesas pagas.':
   'Abra uma ordem de serviço aprovada para começar a registrar horas reais.')+'</span></div>'+
  '<button class="pending-card" type="button" data-go="more">'+icon('clipboard',28)+
  '<b>'+s.missing+' pendência'+(s.missing===1?'':'s')+'</b><span>para revisar</span>'+
  icon('chevron',20)+'</button></div>'+
  '<p class="dashboard-note">Valores calculados a partir dos seus cadastros. Nenhum valor de exemplo foi incluído.</p>'+
  (s.assumedQuantities?'<p class="dashboard-note cost-quantity-assumption">'+
   icon('clipboard',16)+' '+s.assumedQuantities+' custo(s) variável(is) sem quantidade estão incluídos como 1 unidade por mês. Confira em Custos → Variáveis.</p>':'')+
  '</div>';
}
function costIcon(category){
 const text=String(category||'').toLowerCase();
 if(/internet|comunica|wifi|telefon/.test(text))return 'wifi';
 if(/sistema|software|comput/.test(text))return 'laptop';
 if(/contad|profiss|servi/.test(text))return 'user';
 if(/aluguel|estrutura|predio|escrit/.test(text))return 'home';
 return 'coins';
}
export function costsView(data,tab='fixed'){
 const isFixed=tab==='fixed',all=isFixed?(data.fixed||[]):(data.variable||[]);
 const total=all.reduce((sum,item)=>sum+(isFixed?fixedMonthly(item):variableMonthly(item)||0),0);
 const date=new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const missing=costPresetsMissing(data);
 const templateCount=missing.fixed.length+missing.variable.length;
 const pending=all.filter(item=>isFixed?!(Number(item.amount)>0):
  !(Number(item.unitCost)>0&&variableQuantity(item)!==null)).length;
 const defaultQty=all.filter(item=>!isFixed&&Number(item.unitCost)>0&&item.monthQty===null).length;
 return '<div class="page-heading"><button class="small-square" data-go="home" aria-label="Voltar">'+icon('back',25)+'</button><h1>Custos da empresa</h1>'+
  '<button class="small-square" data-action="new-cost" aria-label="Adicionar custo">'+icon('plus',26)+'</button></div>'+
  '<section class="cost-presets-panel" aria-label="Custos sugeridos para a empresa">'+
  '<strong>'+icon('clipboard',19)+' Plano de custos para elétrica e construção</strong>'+
  '<p>Modelos de despesas fixas e variáveis. Valores ficam em aberto para você preencher com dados reais. Funcionários, encargos CLT e tributos sobre vendas são calculados à parte; evite lançar esses valores novamente.</p>'+
  (templateCount?
   '<button class="outlined-button cost-presets-action" data-action="import-cost-presets" type="button">'+icon('plus',18)+
   ' Salvar '+templateCount+' custos sugeridos</button>'+
   '<small>Adiciona '+missing.fixed.length+' fixos e '+missing.variable.length+' variáveis à sua conta, sem substituir os existentes. Depois você pode editar ou excluir.</small>':
   '<small class="cost-presets-ready">'+icon('check',16)+' Catálogo inicial disponível. Edite ou exclua os custos que não utiliza.</small>')+
  '</section>'+
  '<button class="month-selector" data-action="month-info">'+icon('calendar',20)+'<span>'+e(date.charAt(0).toUpperCase()+date.slice(1))+'</span>'+icon('down',17)+'</button>'+
  '<div class="tab-switch" role="tablist"><button role="tab" aria-selected="'+isFixed+'" data-tab="fixed" class="'+(isFixed?'selected':'')+'">Fixos ('+(data.fixed||[]).length+')</button>'+
  '<button role="tab" aria-selected="'+!isFixed+'" data-tab="variable" class="'+(!isFixed?'selected':'')+'">Variáveis ('+(data.variable||[]).length+')</button></div>'+
  '<div class="total-cost-card"><span class="cost-big-icon">'+icon('coins',35)+'</span><div class="total-copy"><h2>'+(isFixed?'Total fixo mensal':'Total variável previsto')+'</h2>'+
  '<p>'+(isFixed?'Soma dos custos com valor informado':'Preço por unidade × quantidade mensal (padrão 1)')+'</p></div><strong>'+brl(total)+'</strong></div>'+
  (defaultQty?'<p class="cost-pending-note">'+icon('clipboard',16)+' '+defaultQty+
   ' custo(s) com valor salvo e quantidade vazia estão somados como 1 unidade/mês. Toque neles para ajustar.</p>':'')+
  (pending?'<p class="cost-pending-note">'+icon('clipboard',16)+' '+pending+' custo(s) aguardando valor ou quantidade. Não foram somados como despesas reais.</p>':'')+
  (all.length>6?'<label class="cost-search-label"><span>Buscar custo</span><input type="search" id="cost-search" placeholder="Nome ou categoria" autocomplete="off"></label>':'')+
  '<div class="cost-list">'+(all.length?all.map(item=>{
   const amount=isFixed?fixedMonthly(item):variableMonthly(item);
   const ready=isFixed?Number(item.amount)>0:Number(item.unitCost)>0&&variableQuantity(item)!==null;
   const searchable=e((item.name+' '+(item.category||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
   return '<button type="button" class="cost-row" data-cost-search="'+searchable+'" data-action="edit" data-kind="'+tab+'" data-id="'+e(item.id)+'">'+
   '<span class="row-icon">'+icon(costIcon(item.category||item.name),27)+'</span>'+
   '<span class="row-title"><b>'+e(item.name)+'</b><small>'+e(item.category||'Sem categoria')+
   '</small><span class="period-pill">'+icon('calendar',14)+(isFixed?(item.frequency==='annual'?'Anual':'Mensal'):
    !ready?'A preencher':item.monthQty==null?'1 '+e(item.unit||'un')+'/mês (padrão)':
    fmt(item.monthQty)+' '+e(item.unit||'un')+'/mês')+'</span></span>'+
   '<span class="row-price'+(ready?'':' is-pending')+'">'+(ready?brl(amount):'A preencher')+'</span><span class="row-arrow">'+icon('chevron',20)+'</span></button>';
  }).join(''):'<div class="empty-state">'+icon('coins',31)+'<b>Sem custos cadastrados</b>'+
  '<span>Toque em “Salvar custos sugeridos” ou “Novo custo” para começar.</span></div>')+'</div>'+
  '<div class="action-area"><button class="gold-button" type="button" data-action="new-cost">'+icon('plus',25)+' Novo custo</button></div>';
}
export function teamView(data){
 const staff=(data.employees||[]),sum=summary(data);
 return '<div class="page-heading"><button class="small-square is-plain" data-go="home" aria-label="Voltar">'+icon('back',25)+'</button><h1>Funcionários</h1>'+
  '<button class="small-square" data-action="search-people" aria-label="Pesquisar funcionários">'+icon('search',23)+'</button></div>'+
  '<div class="team-total"><span class="team-image">'+icon('hardhat',50)+icon('users',36)+'</span>'+
  '<div><span>Custo da equipe no mês</span><strong>'+brl(sum.team)+'</strong></div></div>'+
  '<div class="team-search" id="team-search" hidden><label>'+icon('search',20)+
  '<input type="search" id="search-people" placeholder="Buscar profissional"></label></div>'+
  '<div class="employee-list">'+(staff.length?staff.map(person=>{
   const c=employeeCost(person,data.payroll),initials=person.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
   return '<button class="employee-card" type="button" data-action="edit" data-kind="employees" data-id="'+e(person.id)+'" data-search-name="'+e(person.name.toLowerCase())+'">'+
   '<span class="employee-top"><span class="employee-avatar"><span>'+e(initials)+'</span></span>'+
   '<span class="employee-info"><b>'+e(person.name)+'</b><em>'+e(person.role||'Profissional')+'</em></span>'+
   '<span class="staff-pill '+(person.active===false?'inactive':'')+'"><span></span>'+(person.active===false?'Inativo':'Ativo')+'</span></span>'+
   '<span class="employee-bottom"><span class="staff-value">'+icon('calendar',19)+'<span>Custo mensal'+(person.contractType==='clt'?' estimado':'')+'<b>'+brl(c.monthly)+'</b></span></span>'+
   '<span class="staff-value">'+icon('clock',19)+'<span>Custo por hora<b>'+brl(c.hourly)+'</b></span></span></span></button>';
  }).join(''):'<div class="empty-state">'+icon('users',32)+'<b>Nenhum funcionário cadastrado</b>'+
  '<span>Cadastre o primeiro profissional para iniciar.</span></div>')+'</div>'+
  '<div class="action-area"><button class="gold-button" data-action="new-employee" type="button">'+icon('plus',26)+' Novo funcionário</button></div>';
}
export function moreView(user,data,siteUnread=0,pushState='inactive',pushBusy=false){
 const sum=summary(data);
 return '<div class="page-heading"><button class="small-square" data-go="home" aria-label="Voltar">'+icon('back',25)+'</button>'+
 '<h1>Configurações</h1><span class="small-square is-empty"></span></div>'+
 '<div class="settings-panel"><div class="settings-user">'+icon('user',34)+'<div><b>'+e(user?.user_metadata?.name||user?.name||'Sua conta')+'</b><span>'+e(user?.email||'')+'</span></div></div>'+
 '<button data-go="costs" class="settings-row">'+icon('coins',21)+' Custos da empresa '+icon('chevron',17)+'</button>'+
 '<button data-go="team" class="settings-row">'+icon('users',21)+' Funcionários '+icon('chevron',17)+'</button>'+ 
  '<button data-go="finance" class="settings-row">'+icon('chart',21)+' Financeiro e faturamento '+icon('chevron',17)+'</button>'+
 '<button data-go="budgets" class="settings-row">'+icon('clipboard',21)+' Orçamentos '+icon('chevron',17)+'</button>'+
 '<button data-go="inbox" class="settings-row">'+icon('mail',21)+' Central de Respostas'+
 (unreadReplies(data).length?' ('+unreadReplies(data).length+' novas)':'')+
 ' '+icon('chevron',17)+'</button>'+
 '<button data-go="site-leads" class="settings-row">'+icon('mail',21)+' Solicitações do site '+(siteUnread?' <span class="settings-notice-badge">'+(siteUnread>99?'99+':siteUnread)+'</span>':'')+icon('chevron',17)+'</button>'+ 
 '<button type="button" data-action="push-toggle" class="settings-row" '+(pushBusy?'disabled':'')+'>'+icon('bell',21)+(pushState==='active'?' Desativar notificações neste celular':pushState==='blocked'?' Permissão bloqueada: consulte o celular':pushState==='unsupported'?' Notificações indisponíveis neste navegador':' Ativar avisos no celular')+icon('chevron',17)+'</button>'+ 
 '<button type="button" data-action="install-app" class="settings-row">'+icon('home',21)+' Instalar CIVOLTEN no celular '+icon('chevron',17)+'</button>'+ 
 '<button data-go="works" class="settings-row">'+icon('building',21)+' Obras, medições e execução '+icon('chevron',17)+'</button>'+ 
 '<button data-go="company" class="settings-row">'+icon('building',21)+' Empresa e precificação '+icon('chevron',17)+'</button>'+
 '<button data-go="appearance" class="settings-row">'+icon('chart',21)+' Cores do aplicativo '+icon('chevron',17)+'</button>'+
 '<button data-action="payroll-settings" class="settings-row">'+icon('settings',21)+' Encargos CLT da empresa '+icon('chevron',17)+'</button>'+
 '<button data-go="reports" class="settings-row">'+icon('file',21)+' Relatórios '+icon('chevron',17)+'</button>'+
 '<button data-action="signout" class="settings-row danger">'+icon('logout',21)+' Sair da conta '+icon('chevron',17)+'</button></div>'+
 '<div class="notice-privacy">Custos e funcionários são salvos no Supabase da sua conta. Os percentuais CLT são estimativas revisáveis nas configurações.</div>'+
 '<div class="notice-privacy">Regime CLT: <b>'+e(payrollLabel(data.payroll?.regime))+'</b>'+(data.payroll?.reviewed?' · Configuração revisada':' · Cenário inicial; confirme com a contabilidade.')+'<p>Cadastros pendentes: '+sum.missing+'</p></div>';
}
const textInput=(label,name,value='',opts={})=>'<label class="modal-field"><span>'+label+'</span>'+
 '<input name="'+name+'" type="'+(opts.type||'text')+'" placeholder="'+(opts.placeholder||'')+'" value="'+e(value??'')+'" '+(opts.required?'required':'')+
 (opts.type==='number'?' step="any" min="0" inputmode="decimal"':'')+'></label>';
const select=(label,name,value,values)=>'<label class="modal-field"><span>'+label+'</span><select name="'+name+'">'+
 values.map(([id,title])=>'<option value="'+id+'" '+(id===String(value)?'selected':'')+'>'+title+'</option>').join('')+'</select></label>';
export function editorView(kind,item={},settings=null){
 const isEmployee=kind==='employees',isFixed=kind==='fixed';
 const title=isEmployee?'Funcionário':isFixed?'Custo fixo':'Custo variável';
 let fields=isEmployee?textInput('Nome completo','name',item.name||'',{required:true})+
 textInput('Função','role',item.role||'',{required:true,placeholder:'Eletricista, pedreiro...'})+
 select('Vínculo','contractType',item.contractType||'clt',[['clt','CLT'],['contractor','Prestador / terceirizado']])+
 '<div class="employee-fields" data-contract="clt">'+
 textInput('Salário-base mensal (R$)','salary',item.salary??'',{type:'number'})+
 '<p class="helper-text">FGTS, 13º, férias e encargos são calculados automaticamente usando as configurações da empresa.</p>'+
 textInput('Horas produtivas por mês (opcional, para custo/hora)','hours',item.hours??'',{type:'number'})+
 '<div class="form-cols">'+textInput('Benefícios (R$)','benefits',item.benefits??'',{type:'number'})+
 textInput('Outros custos (R$)','extras',item.extras??'',{type:'number'})+'</div>'+
 '<div id="clt-preview" class="clt-preview" aria-live="polite"></div></div>'+
 '<div class="employee-fields" data-contract="contractor">'+
 textInput('Valor contratado (R$)','rate',item.rate??'',{type:'number'})+
 select('Cobrança por','rateUnit',item.rateUnit||'hour',[['hour','Hora'],['day','Dia'],['month','Mês']])+
 '<div class="form-cols">'+textInput('Quantidade mensal','quantity',item.quantity??'',{type:'number'})+
 textInput('Horas por dia ou mês','contractHours',item.hours??'',{type:'number'})+'</div></div>'+
 select('Situação','active',item.active===false?'false':'true',[['true','Ativo'],['false','Inativo']]):
 textInput('Descrição','name',item.name||'',{required:true,placeholder:'Aluguel, internet, combustível...'})+
 textInput('Categoria','category',item.category||'')+
 (isFixed?textInput('Valor (R$)','amount',item.amount??'',{type:'number',required:true})+
 select('Periodicidade','frequency',item.frequency||'monthly',[['monthly','Mensal'],['annual','Anual']]):
 textInput('Preço por unidade (R$)','unitCost',item.unitCost??'',{type:'number',required:true})+
 select('Unidade','unit',item.unit||'un',[['un','Unidade'],['km','Quilômetro'],['h','Hora'],['dia','Dia'],['serviço','Serviço']])+
 textInput('Quantidade prevista por mês','monthQty',item.monthQty??(Number(item.unitCost)>0?1:''),{type:'number',placeholder:'Padrão: 1'})+
 '<p class="helper-text">Informe a quantidade usada no mês. Se deixar em branco, 1 unidade por mês será considerada automaticamente. Digite 0 se não houver consumo.</p>'+
 '<div id="variable-cost-preview" class="variable-cost-preview" aria-live="polite"></div>');
 return '<div class="modal-inner"><div class="modal-heading"><h2>'+(item.id?'Editar '+title:'Novo '+title.toLowerCase())+'</h2>'+
 '<button class="small-square" data-action="close-modal" aria-label="Fechar">×</button></div>'+
 '<form id="record-form"><div class="modal-fields">'+fields+'</div>'+
 (isEmployee?'<p class="helper-text">Custo CLT gerencial estimado, não é cálculo definitivo da folha. Ajuste o regime e as alíquotas em Mais → Encargos CLT.</p>':'')+
 '<p class="form-error" role="alert" id="form-error" hidden></p>'+
 '<div class="modal-buttons"><button type="button" class="outlined-button" data-action="close-modal">Cancelar</button>'+
 '<button type="submit" class="gold-button">Salvar</button></div></form>'+
 (item.id?'<button type="button" class="delete-link" data-action="delete-record">Excluir cadastro</button>':'')+'</div>';
}

export function payrollLabel(regime){
 return ({annex_iv:'Simples Nacional — Anexo IV',simples_other:'Simples Nacional — outros anexos',
  general:'Lucro Presumido / Real'})[regime]||'Simples Nacional — Anexo IV';
}
const breakRow=(label,money)=>'<div class="clt-breakdown-row"><span>'+label+'</span><strong>'+brl(money)+'</strong></div>';
export function cltBreakdownHtml(p,settings){
 const cost=employeeCost({...p,contractType:'clt'},settings);
 if(cost.monthly===null)return '<p class="helper-text">Informe o salário-base para visualizar o custo automático.</p>';
 const b=cost.breakdown;
 return '<div class="clt-preview-heading">Custo total mensal estimado<strong>'+brl(cost.monthly)+'</strong></div>'+
  breakRow('Salário-base',b.salary)+breakRow('13º proporcional',b.thirteenth)+
  breakRow('Provisão para férias/cobertura',b.vacation)+
  breakRow('Adicional de 1/3 de férias',b.vacationThird)+
  breakRow('FGTS ('+b.rates.fgtsPct+'%)',b.fgts)+
  breakRow('INSS patronal/CPP ('+b.rates.employerPct+'%)',b.employer)+
  breakRow('RAT estimado ('+b.rates.ratPct+'%)',b.rat)+
  breakRow('Outras entidades ('+b.rates.terceirosPct+'%)',b.terceiros)+
  breakRow('Benefícios informados',b.benefits)+breakRow('Outros custos informados',b.extras)+
  '<p class="helper-text">'+(b.reviewed?'Alíquotas revisadas na empresa.':'Alíquotas iniciais ainda não revisadas com o contador.')+
  ' Férias/cobertura é provisão gerencial, não uma cobrança extra na folha mensal. Não inclui verbas variáveis ou rescisão.</p>';
}
export function payrollSettingsView(settings){
 const cfg=payrollConfig(settings);
 const sel=(name,values,value)=>'<label class="modal-field"><span>Regime da empresa</span><select name="'+name+'">'+
  values.map(([k,label])=>'<option value="'+k+'"'+(value===k?' selected':'')+'>'+label+'</option>').join('')+'</select></label>';
 const pct=(name,label,val)=>textInput(label+' (%)',name,val,{type:'number',required:true});
 return '<div class="modal-inner"><div class="modal-heading"><h2>Encargos CLT da empresa</h2>'+
  '<button type="button" class="small-square" data-action="close-modal" aria-label="Fechar">×</button></div>'+
  '<p class="helper-text">Configure uma vez. O custo de todos os funcionários CLT será recalculado automaticamente a partir do salário-base. Os percentuais abaixo são um cenário inicial para construção civil, não sua classificação tributária confirmada.</p>'+
  '<form id="payroll-form"><div class="modal-fields">'+
  sel('regime',[['annex_iv',payrollLabel('annex_iv')],
   ['simples_other',payrollLabel('simples_other')],['general',payrollLabel('general')]],cfg.regime)+
  '<div class="form-cols">'+pct('fgtsPct','FGTS',cfg.fgtsPct)+
  pct('employerPct','INSS patronal/CPP',cfg.employerPct)+'</div>'+
  '<div class="form-cols">'+pct('ratPct','RAT/FAP estimado',cfg.ratPct)+
  pct('terceirosPct','Outras entidades',cfg.terceirosPct)+'</div></div>'+
  '<p class="helper-text">Se mudar o regime, os percentuais serão sugeridos para aquele cenário; confira RAT/FAP, terceiros e benefícios com a contabilidade antes de usar em orçamentos.</p>'+
  '<p class="form-error" id="form-error" role="alert" hidden></p>'+
  '<div class="modal-buttons"><button type="button" class="outlined-button" data-action="close-modal">Cancelar</button>'+
  '<button type="submit" class="gold-button">Salvar regras</button></div></form></div>';
}
