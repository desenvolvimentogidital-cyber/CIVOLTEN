// Caixa de entrada das propostas: separada dos rascunhos de orçamento.
import {e,icon} from './views.mjs';
import {brl} from './calc.mjs';
import {replyCounts,responseRecords,selectResponses,responded} from './proposal-inbox.mjs';
const whenBR=v=>{
 if(!v)return 'Data indisponível';
 const d=new Date(v);
 if(!Number.isFinite(d.getTime()))return 'Data indisponível';
 return new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit'
 }).format(d);
};
const filters=[['all','Todas'],['new','Não lidas'],['accepted','Aceitas'],
 ['declined','Recusadas'],['pending','Aguardando']];
const statusCopy=i=>i.status==='accepted'?'ACEITOU a proposta':
 i.status==='declined'?'RECUSOU a proposta':
 i.status==='pending'?'Aguardando resposta do cliente':
 i.status==='revoked'?'Link revogado':'Prazo encerrado';
const stateClass=r=>['accepted','declined','pending','revoked'].includes(r.status)?
 r.status:'other';
export function responseResultHtml(data,filter='all',search=''){
 const rows=selectResponses(data,filter,search);
 if(!rows.length)return '<p class="fin-empty inbox-empty">Nenhuma proposta encontrada'+
  (search?' com essa pesquisa.':' neste filtro.')+'</p>';
 return '<div class="inbox-cards">'+rows.map(r=>{
  const i=r.invite;
  return '<button type="button" class="inbox-card '+stateClass(r)+(r.unread?' is-new':'')+
   '" data-action="inbox-open" data-id="'+e(i.id)+'" aria-label="Ver resposta de '+e(r.customer)+'">'+
   '<span class="inbox-card-top"><span class="inbox-card-status">'+
   (r.unread?'<span class="inbox-unread-dot" aria-label="Nova resposta"></span>':'')+
   (r.unread?'Nova resposta · ':'')+e(i.status==='accepted'?'Aceita':
     i.status==='declined'?'Recusada':i.status==='pending'?'Aguardando':'Encerrada')+
    '</span><time>'+e(whenBR(r.when))+'</time></span>'+
   '<strong class="inbox-customer">'+e(r.customer)+'</strong>'+
   '<span class="inbox-project">'+e(r.project)+'</span>'+
   '<span class="inbox-reply">'+
    (responded(i)?'Quem respondeu: '+e(r.responder||'Não informado'):
     'Proposta enviada, aguardando decisão')+'</span>'+
   '<span class="inbox-bottom"><b>'+brl(i.totalCents)+'</b>'+
   '<span>Ver detalhes '+icon('chevron',15)+'</span></span></button>';
 }).join('')+'</div>';
}
export function responseInboxView(data,filter='all',search=''){
 const counts=replyCounts(data);
 const buttons=filters.map(([value,label])=>
  '<button type="button" data-reply-filter="'+value+'" class="inbox-tab '+
  (filter===value?'active':'')+'" aria-pressed="'+(filter===value?'true':'false')+'">'+
  e(label)+' <span>'+counts[value]+'</span></button>').join('');
 return '<section class="fin-screen inbox-screen">'+
  '<div class="page-heading"><button class="small-square" type="button" data-go="home" aria-label="Voltar">'+
   icon('back',22)+'</button><h1>Central de Respostas</h1><span class="small-square is-empty"></span></div>'+
  '<p class="fin-intro">Aqui ficam os aceites, recusas e propostas aguardando resposta. Toque no cliente certo para ver o registro e continuar o atendimento.</p>'+
  '<div class="inbox-stats">'+
    '<div><strong>'+counts.new+'</strong><span>Novas respostas</span></div>'+
    '<div><strong>'+counts.accepted+'</strong><span>Aceitas</span></div>'+
    '<div><strong>'+counts.declined+'</strong><span>Recusadas</span></div>'+
  '</div>'+
  '<label class="inbox-search-label" for="inbox-search">'+icon('search',18)+' Pesquisar cliente ou obra</label>'+
  '<input id="inbox-search" type="search" autocomplete="off" placeholder="Nome, obra, proposta ou respondente" value="'+e(search)+'" aria-controls="inbox-results">'+
  '<div class="inbox-tabs" role="group" aria-label="Filtrar respostas">'+buttons+'</div>'+
  '<div id="inbox-results" aria-live="polite">'+responseResultHtml(data,filter,search)+'</div>'+
  '<div class="fin-link-row"><button type="button" data-go="budgets">'+icon('clipboard',17)+' Criar e enviar orçamentos '+icon('chevron',17)+'</button></div>'+
  '<p class="fin-helper">As respostas são guardadas na sua conta. Marcar como lida não altera a decisão do cliente nem o valor aprovado.</p></section>';
}
export function responseDetailView(data,id){
 const r=responseRecords(data).find(x=>x.invite.id===id);
 if(!r)return '<section class="fin-screen inbox-screen">'+
  '<div class="page-heading"><button class="small-square" data-go="inbox">'+icon('back',22)+'</button>'+
  '<h1>Resposta não encontrada</h1></div><p class="fin-empty">Atualize o aplicativo e consulte a Central de Respostas.</p></section>';
 const i=r.invite,contract=r.work;
 const isAnswered=responded(i);
 const statusTitle=i.status==='accepted'?'Cliente ACEITOU sua proposta':
   i.status==='declined'?'Cliente RECUSOU sua proposta':statusCopy(i);
 const n=String(r.budget.id||i.budgetId).slice(0,8).toUpperCase();
 return '<section class="fin-screen inbox-screen inbox-detail">'+
 '<div class="page-heading"><button class="small-square" type="button" data-go="inbox" aria-label="Voltar">'+
 icon('back',22)+'</button><h1>Resposta do cliente</h1><span class="small-square is-empty"></span></div>'+
 '<div class="inbox-decision '+stateClass(r)+'"><span>'+
  icon(i.status==='declined'?'mail':'check',23)+'</span><div><small>PROPOSTA Nº PC-'+e(n)+'</small>'+
  '<h2>'+e(statusTitle)+'</h2>'+
  '<p>'+e(isAnswered?'Resposta registrada em '+whenBR(i.respondedAt):
    'Convite criado em '+whenBR(i.createdAt))+'</p></div></div>'+
 '<div class="inbox-details">'+
   '<h3>'+e(r.customer)+'</h3><p>'+e(r.project)+'</p>'+
   '<div class="inbox-detail-row"><span>Orçamento</span><strong>'+e(r.title)+'</strong></div>'+
   '<div class="inbox-detail-row"><span>Valor enviado</span><strong>'+brl(i.totalCents)+'</strong></div>'+
   '<div class="inbox-detail-row"><span>Validade do link</span><strong>'+e(i.validUntil||'Não definida')+'</strong></div>'+
   (isAnswered?'<div class="inbox-detail-row"><span>Quem respondeu</span><strong>'+e(r.responder||'Não informado')+'</strong></div>'+
    '<div class="inbox-detail-row"><span>E-mail informado</span><strong>'+e(i.respondentEmail||'Não informado')+'</strong></div>':'')+
   (i.status==='declined'&&i.declineReason?'<div class="inbox-decline-reason"><b>Mensagem do cliente</b><p>'+e(i.declineReason)+'</p></div>':'')+
 '</div>'+
 '<div class="inbox-next-actions">'+
 (contract?'<button type="button" class="gold-button" data-action="work-open" data-id="'+e(contract.id)+'">'+
  icon('building',19)+' Abrir obra · '+e(contract.contractRef)+'</button>':
  i.status==='accepted'?'<button type="button" class="gold-button" data-action="work-approve-budget" data-id="'+e(i.budgetId)+'">'+
   icon('check',19)+' Formalizar aceite e abrir obra</button>':'')+
 (i.status==='declined'?'<button type="button" class="gold-button" data-action="budget-clone" data-id="'+e(i.budgetId)+'">'+
   icon('file',19)+' Criar nova proposta para este cliente</button>':'')+
 '<button type="button" class="outlined-button" data-action="inbox-open-budget" data-id="'+e(i.budgetId)+'">'+
   icon('clipboard',18)+' Abrir orçamento deste cliente</button>'+
 (i.status==='pending'?'<button type="button" class="outlined-button" data-action="budget-invite-copy" data-id="'+e(i.budgetId)+'">'+
    icon('file',18)+' Copiar link de resposta</button>':'')+
 '<button type="button" class="outlined-button" data-go="inbox">'+icon('back',18)+' Voltar à Central de Respostas</button></div>'+
 (i.status==='accepted'?'<p class="fin-helper">Esse é um registro de aceite eletrônico simples. Antes de iniciar o contrato, confirme a identidade e autorização de quem respondeu.</p>':'')+
 '</section>';
}
