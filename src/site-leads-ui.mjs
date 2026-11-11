// CIVOLTEN — caixa de entrada das solicitações do site institucional.
import {e,icon} from './views.mjs';
const labels={
 novo:'Novo pedido',em_contato:'Em contato',orcamento_enviado:'Orçamento enviado',
 concluido:'Concluído',arquivado:'Arquivado'
};
const date=value=>{
 const n=new Date(value||'');
 return Number.isFinite(n.getTime())?n.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Data indisponível';
};
export function siteLeadsView(list=[],loading=false,error=''){
 const rows=Array.isArray(list)?[...list].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))):[];
 const pending=rows.filter(r=>r.status==='novo').length;
 const entries=rows.map(r=>{
  const status=Object.prototype.hasOwnProperty.call(labels,r.status)?r.status:'novo';
  const phone=String(r.phone||'').replace(/\D/g,'');
  const dial=phone.startsWith('55')?phone:'55'+phone;
  const validPhone=/^\d{12,13}$/.test(dial);
  return '<article class="site-lead-card">'+
   '<div class="site-lead-head"><div><strong>'+e(r.name)+'</strong>'+
   '<small>'+e(date(r.created_at))+' · '+e(r.service)+'</small></div>'+
   '<span class="site-lead-state '+e(status)+'">'+e(labels[status])+'</span></div>'+
   '<p><b>Local da obra:</b> '+e(r.city)+'</p>'+
   '<p><b>WhatsApp:</b> '+e(r.phone)+'</p>'+
   (r.email?'<p><b>E-mail:</b> '+e(r.email)+'</p>':'')+
   '<p class="site-lead-description">'+e(r.description)+'</p>'+
   '<div class="site-lead-actions">'+
   (validPhone?'<a class="outlined-button" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+dial+'">'+icon('mail',16)+' Conversar</a>':'')+
   '<button type="button" class="outlined-button" data-action="site-lead-photos" data-id="'+e(r.id)+'">'+icon('file',16)+' Ver fotos e anexos</button>'+
   (status==='novo'?'<button type="button" class="outlined-button" data-action="site-lead-status" data-status="em_contato" data-id="'+e(r.id)+'">Em contato</button>':'')+
   (status!=='concluido'&&status!=='arquivado'?'<button type="button" class="outlined-button" data-action="site-lead-status" data-status="concluido" data-id="'+e(r.id)+'">Concluir</button>':'')+
   (status!=='arquivado'?'<button type="button" class="outlined-button" data-action="site-lead-status" data-status="arquivado" data-id="'+e(r.id)+'">Arquivar</button>':'')+
   '</div></article>';
 }).join('');
 return '<section class="fin-screen site-leads-screen">'+
  '<div class="page-heading"><button type="button" class="small-square" data-go="more" aria-label="Voltar">'+icon('back',23)+'</button>'+
  '<h1>Solicitações do site</h1><span class="small-square is-empty"></span></div>'+
  '<p class="fin-helper">Pedidos recebidos pelo site institucional CIVOLTEN, separados de orçamentos aprovados e da execução das obras.</p>'+
  '<div class="site-lead-summary"><b>'+rows.length+'</b> pedido(s) · <b>'+pending+'</b> novo(s)'+
  '<button type="button" class="outlined-button" data-action="site-leads-refresh">Atualizar</button></div>'+
  (error?'<p class="form-error" role="alert">'+e(error)+'</p>':'')+
  (loading?'<p class="fin-empty">Consultando solicitações no Supabase...</p>':
   entries||'<p class="fin-empty">Nenhuma solicitação recebida ainda. O formulário público está disponível em /site/index.html.</p>')+
  '<p class="fin-helper">Solicitações não geram contratos, medições ou cobranças automaticamente. Confira os dados com o cliente antes de elaborar a proposta.</p></section>';
}
