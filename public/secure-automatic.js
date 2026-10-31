/* Visão automática do orçamento: somente dados retornados pela API autenticada.
 * Nenhuma equipe, atividade, imposto, aprovação ou contrato é criado no navegador.
 */
const currency=value=>value==null?'Não calculado':new Intl.NumberFormat('pt-BR',{
 style:'currency',currency:'BRL'
}).format(Number(value));
const val=(value,esc)=>esc(value==null?'—':String(value));

export function automaticBudgetPanel(model,esc,{budgetId}={}){
 if(!model)return '<div class="card" aria-live="polite"><h2>Resumo automático da obra</h2>'+
   '<p class="muted">Calculando custos, equipes, cronograma e prévia com os serviços adicionados...</p></div>';
 if(model.error)return '<div class="card"><h2>Resumo automático indisponível</h2>'+
   '<p class="error">'+esc(model.error)+'</p><button type="button" class="btn" data-action="automatic-refresh">Recalcular</button></div>';
 if(!model.budget||String(model.budget.id)!==String(budgetId))
  return '<div class="card"><p>Atualizando cálculos do orçamento...</p></div>';
 const cost=model.cost||{},workforce=model.workforce||{},schedule=model.schedule||{},
  services=workforce.services||[],issues=model.issues||[];
 const pending=services.filter(s=>s.workers==null);
 const scheduleRows=(schedule.tasks||[]).map(t=>'<tr><td>'+esc(t.title||'Serviço')+'</td>'+
  '<td>'+val(t.workers,esc)+'</td><td>'+(t.duration==null?'A revisar':val(t.duration,esc)+' dias')+'</td>'+
  '<td>'+(t.start_workday==null?'A definir':'Dia útil '+val(t.start_workday+1,esc))+
  ' – '+(t.finish_workday==null?'A definir':'dia útil '+val(t.finish_workday,esc))+'</td></tr>').join('');
 const serviceRows=services.map(s=>'<tr><td>'+esc(s.title||s.code||'Serviço')+'</td>'+
  '<td>'+val(s.quantity,esc)+' '+val(s.unit,esc)+'</td>'+
  '<td>'+(s.estimated_hh==null?'Sem coeficiente':val(s.estimated_hh,esc)+' h-h')+'</td>'+
  '<td>'+(s.workers==null?'Pendente':val(s.workers,esc))+'</td>'+
  '<td>'+(s.days_at_suggested_staff==null?'Pendente':val(s.days_at_suggested_staff,esc)+' dias úteis')+'</td>'+
  '<td>'+esc((s.roles||[]).map(r=>r.name+' ('+r.workers+')').join(', ')||'A revisar')+'</td></tr>').join('');
 return '<section class="card" aria-label="Resumo automático do orçamento" aria-live="polite">'+
  '<div class="row"><div><h2>Resumo automático da obra</h2>'+
  '<p class="muted tiny">Atualizado a partir dos serviços e quantidades deste orçamento. Sem cadastrar equipes ou atividades.</p></div>'+
  '<button type="button" class="btn" data-action="automatic-refresh">Recalcular</button></div>'+
  '<div class="grid">'+
  '<div class="card"><div class="muted">Custo direto calculado</div><div class="metric">'+esc(currency(cost.direct_reais))+'</div></div>'+
  '<div class="card"><div class="muted">Total preliminar (não aprovado)</div><div class="metric">'+esc(currency(cost.total_preliminary_reais))+'</div></div>'+
  '<div class="card"><div class="muted">Horas-homem diretas calculadas</div><div class="metric">'+val(workforce.total_hh,esc)+' h-h</div></div>'+
  '<div class="card"><div class="muted">Pico de profissionais sugerido</div><div class="metric">'+
   (schedule.ready?val(schedule.peak_workers,esc):'A confirmar')+'</div></div>'+
  '<div class="card"><div class="muted">Duração em dias úteis</div><div class="metric">'+
   (schedule.ready?val(schedule.workdays,esc):schedule.tentative_workdays!=null?'Prévia: '+val(schedule.tentative_workdays,esc)+' (a revisar)':'Pendente')+'</div></div></div>'+
  '<h3>Profissionais e atividades gerados dos serviços</h3>'+
  (serviceRows?'<div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Quantidade</th><th>h-h diretas</th><th>Profissionais</th><th>Duração sugerida</th><th>Funções</th></tr></thead><tbody>'+
   serviceRows+'</tbody></table></div>':'<p class="muted">Adicione o primeiro serviço para começar a calcular.</p>')+
  (scheduleRows?'<h3>Sequência sugerida da obra</h3><div class="table-wrap"><table><thead><tr><th>Atividade</th><th>Equipe</th><th>Duração</th><th>Posição relativa</th></tr></thead><tbody>'+
   scheduleRows+'</tbody></table></div>':'')+
  '<p class="muted tiny">O planejamento considera frentes, dependências e capacidade simultânea. Os dias são relativos, sem data de início nem feriados e não são prazo contratual.</p>'+
  (!schedule.all_productivity_reviewed&&services.length?'<div class="notice"><strong>Prazo ainda não validado.</strong> Revise a produtividade de cada serviço; as horas-homem SIURB são referências parciais.</div>':'')+
  (pending.length?'<div class="notice"><strong>'+pending.length+' serviço(s) sem produtividade aproveitável.</strong> Nenhuma equipe ou prazo foi inventado.</div>':'')+
  (issues.length?'<div class="notice"><strong>Conferências necessárias antes de contratar:</strong><ul>'+
    issues.slice(0,12).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'')+
  (services.length?'<div class="actions"><a class="btn primary" href="'+
   esc(model.proposal_preview?.download_url||'/api/v1/budgets/'+encodeURIComponent(budgetId)+'/automatic-briefing/pdf')+
   '" target="_blank" rel="noopener">Baixar prévia PDF automática</a>'+
   '<button class="btn" type="button" data-action="open-schedule">Ver cronograma completo</button></div>':'')+
  '<p class="muted tiny"><strong>Prévia interna, não emitida.</strong> Não libera valores comerciais, contratos, assinatura ou início de obra. Custos e produtividade sem revisão continuam sinalizados.</p></section>';
}
