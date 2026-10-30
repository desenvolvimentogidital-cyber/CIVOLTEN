/* CIVOLTEN — cronograma automático em linguagem simples.
 * Exibe serviços reais do orçamento. Não requer equipe ou atividade cadastrada.
 * Não altera preços, contratos, orçamento ou equipe no banco.
 */
const nfmt=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(n)||0);
export function workforcePanel(data,esc){
 if(!data)return '<div class="card workforce-wait"><h2>Serviços e equipes sugeridas</h2><p class="muted">Consultando os serviços do seu orçamento e calculando a mão de obra necessária…</p></div>';
 if(data.error)return '<div class="card workforce-wait" role="alert"><h2>Não foi possível calcular</h2><p class="danger">'+esc(data.error)+'</p><p class="muted">A lista de serviços no orçamento continua preservada. Atualize a página para tentar novamente.</p></div>';
 const s=data.summary||{},cfg=data.settings||{},items=data.services||[];
 const sbox=(label,value,sub)=>'<div class="card workforce-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>';
 const stats='<div class="workforce-stat-grid">'+
  sbox('Serviços no orçamento',s.total_services??0,'Selecionados no orçamento')+
  sbox('Profissionais · paralelo',s.simultaneous_workers??0,'Todos os serviços juntos')+
  sbox('Equipes · paralelo',s.simultaneous_crews??0,'Equipes por frente de serviço')+
  sbox('Equipes · sequencial',s.sequential_peak_crews??0,'Reaproveitando pessoal')+'</div>';
 const services=items.map((item,i)=>{
  const roles=item.roles?.length?item.roles.map(role=>
    '<span class="workforce-role">'+esc(role.name)+' <strong>'+esc(role.workers)+'</strong></span>').join(''):
    '<span class="muted tiny">Composição por profissão não confirmada</span>';
  const has=item.workers!==null;
  const workers=has?'<strong>'+esc(item.workers)+'</strong><small>profissional(is)</small>':
    '<strong class="workforce-pending">—</strong><small>produtividade pendente</small>';
  const crews=has?'<strong>'+esc(item.crews)+'</strong><small>equipe(s) sugerida(s)</small>':
    '<strong class="workforce-pending">—</strong><small>sem estimativa</small>';
  const hh=has?'Cerca de '+esc(nfmt(item.estimated_hh))+' h-h no serviço · '+
    esc(nfmt(item.hh_per_unit))+' h-h/'+esc(item.unit):
    'Ainda não há horas-homem suficientes para dimensionar este serviço.';
  const duration=has&&item.days_at_suggested_staff?
    '<span class="workforce-duration">Prazo indicativo com esse efetivo: '+esc(item.days_at_suggested_staff)+' dia(s) úteis</span>':'';
  return '<article class="card workforce-service"><div class="workforce-service-head">'+
    '<div class="workforce-index">'+esc(i+1)+'</div><div class="workforce-service-title"><span class="muted tiny">'+
    esc(item.code||'Serviço próprio')+' · '+esc(nfmt(item.quantity))+' '+esc(item.unit)+'</span>'+
    '<h3>'+esc(item.title)+'</h3></div></div>'+
    '<div class="workforce-service-counts"><div>'+workers+'</div><div>'+crews+'</div></div>'+
    '<div class="workforce-service-roles"><span class="workforce-mini-label">Profissionais por função</span>'+
    '<div class="workforce-role-list">'+roles+'</div></div>'+
    '<p class="workforce-service-hh">'+hh+'</p>'+duration+
    '<p class="workforce-service-source">'+esc(item.reviewed?'Coeficiente técnico revisado':'Estimativa SIURB parcial ou produtividade pendente')+'</p></article>';
 }).join('');
 const form='<details class="workforce-adjust"><summary>Ajustar prazo e jornada (opcional)</summary>'+
  '<form id="workforce-settings-form" class="workforce-settings">'+
  '<div class="workforce-fields">'+
  '<div class="field"><label for="wf-days">Prazo por serviço (dias úteis)</label><input id="wf-days" type="number" name="target_days" min="1" max="365" step="1" value="'+esc(cfg.target_days)+'" required></div>'+
  '<div class="field"><label for="wf-hours">Horas por dia</label><input id="wf-hours" type="number" name="hours_day" min="4" max="12" step="0.5" value="'+esc(cfg.hours_day)+'" required></div>'+
  '<div class="field"><label for="wf-efficiency">Eficiência estimada (%)</label><input id="wf-efficiency" type="number" name="efficiency_pct" min="50" max="100" step="1" value="'+esc(cfg.efficiency_pct)+'" required></div>'+
  '<div class="field"><label for="wf-crew">Máximo de pessoas por equipe</label><input id="wf-crew" type="number" name="crew_size" min="1" max="20" step="1" value="'+esc(cfg.crew_size)+'" required></div>'+
  '</div><button type="submit" class="btn primary">Recalcular equipes</button></form></details>';
 const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
 const d=data.duration||{},roles=data.roles||[],cost=data.costs;
 const occupationRows=roles.map(r=>'<tr><td><strong>'+esc(r.name)+'</strong></td>'+
   '<td><strong>'+esc(r.parallel_workers)+'</strong></td><td>'+esc(r.sequential_workers)+'</td>'+
   (cost?'<td>'+esc(r.hourly_cost===null?'Não cadastrado':brl(r.hourly_cost))+'</td>':'')+'</tr>').join('');
 const workforceSummary='<div class="card workforce-final-summary"><h2>Resumo final da mão de obra</h2>'+
  '<p class="muted tiny">Os mesmos profissionais podem trabalhar em serviços diferentes. Não somamos o mesmo funcionário duas vezes quando os serviços são sequenciais.</p>'+
  (roles.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Profissão</th><th>Juntos</th><th>Em sequência</th>'+
   (cost?'<th>Custo-hora interno</th>':'')+'</tr></thead><tbody>'+occupationRows+'</tbody></table></div>':
   '<p class="muted">Sem composição por profissão. O total de pessoas por função depende da revisão do serviço.</p>')+
  '<div class="workforce-total-days"><div><span>Tempo total · serviços em sequência</span><strong>'+esc(d.complete?d.sequential_workdays:'Parcial: '+(d.sequential_workdays??0))+' dias úteis</strong></div>'+
  '<div><span>Tempo total · serviços em paralelo</span><strong>'+esc(d.complete?d.parallel_workdays:'Parcial: '+(d.parallel_workdays??0))+' dias úteis</strong></div></div>'+
  '<p class="muted tiny">Prazos de simulação por serviço, sem dependências, retrabalho, cura, logística, clima ou caminho crítico validado.</p></div>';
 const costPanel=cost?'<div class="card workforce-cost-summary"><div class="row"><h2>Custo interno estimado da obra</h2>'+
   '<button type="button" class="btn primary" data-action="company-config">Cadastrar custos e profissionais</button></div>'+
   '<div class="workforce-cost-totals"><div><span>Mão de obra estimada</span><strong>'+esc(cost.labor_estimated===null?'Aguardando custos-hora':brl(cost.labor_estimated))+'</strong></div>'+
   '<div><span>Empresa + mão de obra · sequência</span><strong>'+esc(cost.total_sequential===null?'Aguardando despesas':brl(cost.total_sequential))+'</strong></div>'+
   '<div><span>Empresa + mão de obra · paralelo</span><strong>'+esc(cost.total_parallel===null?'Aguardando despesas':brl(cost.total_parallel))+'</strong></div></div>'+
   (cost.missing_rates?.length?'<p class="muted tiny">Preencha custo-hora das funções: '+cost.missing_rates.map(esc).join(', ')+'.</p>':'')+
   '<p class="muted tiny">Valor gerencial da empresa, sem materiais, equipamentos, impostos, BDI ou margem de lucro. Não adicionar sobre a tabela SIURB sem conciliação, para evitar duplicidade.</p></div>':'';
 const info='<div class="notice tiny workforce-qualification"><strong>Estimativa, não escala de trabalho.</strong> '+
  'Cálculo com '+esc(cfg.target_days)+' dias úteis por serviço, '+esc(cfg.hours_day)+' h/dia, '+
  esc(cfg.efficiency_pct)+'% de eficiência e até '+esc(cfg.crew_size)+' pessoas por equipe. '+
  'Os coeficientes de mão de obra SIURB são parciais; o prazo e as profissões devem ser conferidos na obra.'+
  (s.without_productivity?'<p class="danger"><strong>'+esc(s.without_productivity)+
  ' serviço(s) sem coeficiente:</strong> o total de equipes pode estar subestimado.</p>':'')+
  '<p><strong>Paralelo:</strong> serviços executados ao mesmo tempo. <strong>Sequencial:</strong> reaproveitamento de profissionais entre serviços. '+
  'O cálculo não cria equipes nem define datas contratuais.</p></div>';
 return '<section class="workforce-section" aria-label="Cronograma automático do orçamento">'+
  '<div class="workforce-intro"><div><div class="breadcrumb">SERVIÇOS IMPORTADOS DO ORÇAMENTO</div>'+
  '<h2>Profissionais e equipes necessários</h2>'+
  '<p>Os serviços abaixo foram puxados automaticamente. Você não precisa cadastrar nenhuma equipe.</p></div>'+
  '<span class="tag">'+esc(data.budget?.code||'Orçamento')+'</span></div>'+
  stats+
  (items.length?'<div class="workforce-service-section"><div class="row"><h2>O que será executado</h2>'+
   '<span class="tag">'+esc(items.length)+' serviço(s)</span></div>'+
   '<div class="workforce-service-grid">'+services+'</div></div>':
   '<div class="card workforce-empty"><h3>Nenhum serviço no orçamento</h3><p>Adicione serviços ao orçamento primeiro. Eles aparecerão aqui automaticamente, sem cadastrar equipes.</p></div>')+
  workforceSummary+costPanel+form+info+'</section>';
}
