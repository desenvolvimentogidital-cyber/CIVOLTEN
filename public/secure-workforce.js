import {planningToolsPanel} from './secure-planning-ui.js';
/* CIVOLTEN — cronograma automático em linguagem simples.
 * Exibe serviços reais do orçamento. Não requer equipe ou atividade cadastrada.
 * Não altera preços, contratos, orçamento ou equipe no banco.
 */
const nfmt=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(n)||0);
const professionLabel=name=>/\bSERVENTE\b/i.test(String(name))?'Ajudante / servente':String(name||'').replace(/\s*\(SGSP\)\s*/gi,'').trim();
export function workforcePanel(data,esc,planning={}){
 if(!data)return '<div class="card workforce-wait"><h2>Serviços e equipes sugeridas</h2><p class="muted">Consultando os serviços do seu orçamento e calculando a mão de obra necessária…</p></div>';
 if(data.error)return '<div class="card workforce-wait" role="alert"><h2>Não foi possível calcular</h2><p class="danger">'+esc(data.error)+'</p><p class="muted">A lista de serviços no orçamento continua preservada. Atualize a página para tentar novamente.</p></div>';
 const s=data.summary||{},cfg=data.settings||{},items=data.services||[];
 const sbox=(label,value,sub)=>'<div class="card workforce-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>';
 const stats='<div class="workforce-stat-grid">'+
  sbox('Serviços no orçamento',s.total_services??0,'Selecionados no orçamento')+
  sbox('Profissionais necessários',data.execution_sequence?.complete?(data.role_totals?.sequential_workers??s.sequential_peak_workers??0):'Mín. '+(data.role_totals?.sequential_workers??s.sequential_peak_workers??0),'Pico das etapas conhecidas')+
  sbox('Equipes necessárias',data.execution_sequence?.complete?(s.sequential_peak_crews??0):'Mín. '+(s.sequential_peak_crews??0),'Pico das etapas conhecidas')+
  sbox('Dias estimados',data.resource_schedule?.ready?data.resource_schedule.workdays:'Parcial','Frentes e profissionais disponíveis')+'</div>';
 const services=items.map((item,i)=>{
  const roles=item.roles?.length?item.roles.map(role=>
    '<span class="workforce-role">'+esc(professionLabel(role.name))+' <strong>'+esc(role.workers)+'</strong></span>').join(''):
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
  '<div class="field"><label for="wf-available">Profissionais disponíveis (sem contar você)</label>'+
  '<input id="wf-available" type="number" name="available_workers" min="1" max="100" step="1" value="'+esc(cfg.available_workers??'')+
  '" placeholder="Ex.: 5 ou 10"><small class="muted">Opcional. Limite por frente/atividade; não pressupõe funcionários atuando ao mesmo tempo em frentes diferentes.</small></div>'+
  '<div class="field"><label for="wf-days">Prazo por serviço (dias úteis)</label><input id="wf-days" type="number" name="target_days" min="1" max="365" step="1" value="'+esc(cfg.target_days)+'" required></div>'+
  '<div class="field"><label for="wf-hours">Horas por dia</label><input id="wf-hours" type="number" name="hours_day" min="4" max="12" step="0.5" value="'+esc(cfg.hours_day)+'" required></div>'+
  '<div class="field"><label for="wf-efficiency">Eficiência estimada (%)</label><input id="wf-efficiency" type="number" name="efficiency_pct" min="50" max="100" step="1" value="'+esc(cfg.efficiency_pct)+'" required></div>'+
  '<div class="field"><label for="wf-crew">Máximo de pessoas por equipe</label><input id="wf-crew" type="number" name="crew_size" min="1" max="20" step="1" value="'+esc(cfg.crew_size)+'" required></div>'+
  '</div><button type="submit" class="btn primary">Recalcular equipes</button></form></details>';
 const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
 const d=data.duration||{},roles=data.roles||[],cost=data.costs;
 const occupationRows=roles.map(r=>'<tr><td><strong>'+esc(professionLabel(r.name))+'</strong></td>'+
   '<td><strong>'+esc(r.sequential_workers)+'</strong></td>'+
   (cost?'<td>'+esc(r.hourly_cost===null?'Não cadastrado':brl(r.hourly_cost))+'</td>':'')+'</tr>').join('');
 const execution=data.execution_sequence||{steps:[],missing:[],complete:false};
 const dynamic=data.resource_schedule?.tasks?.length?data.resource_schedule.tasks:null;
 const rendered=dynamic||execution.steps||[];
 const sequenceCards=rendered.map(x=>
  '<li class="workforce-sequence-step"><span class="workforce-sequence-number">'+esc(x.sequence??(rendered.indexOf(x)+1))+'</span>'+
  '<div class="workforce-sequence-body"><strong>'+esc(x.front||x.stage||'Serviço')+'</strong>'+
  '<div>'+esc(x.title)+'</div>'+
  '<small class="muted">'+esc(x.start_workday!=null?'Dias úteis '+(x.start_workday+1)+' a '+x.finish_workday+
   ' · '+x.workers+' profissionais':x.duration_workdays===null?'Duração pendente':x.duration_workdays+' dia(s) úteis estimados')+
   '</small></div></li>').join('');
 const missingCards=(execution.missing||[]).map(x=>
  '<div class="notice workforce-missing-stage" role="alert"><strong>'+esc(x.label)+'</strong>'+
  '<p>'+esc(x.message)+'</p><button type="button" class="btn primary" data-action="schedule-back">Ver serviços do orçamento</button></div>').join('');
 const sequencePanel='<section class="card workforce-sequence"><h2>Ordem de execução da obra</h2>'+
  '<p class="muted tiny">As etapas técnicas são sugeridas na ordem alvenaria → chapisco → reboco, quando esses serviços constam no orçamento.</p>'+
  '<ol class="workforce-sequence-list">'+sequenceCards+'</ol>'+missingCards+
  '<p class="muted tiny">'+esc(execution.planning_note||'Confirmar precedências e tempo de cura/secagem com o responsável técnico.')+'</p></section>';
 const workforceSummary='<div class="card workforce-final-summary"><h2>Resumo final da mão de obra</h2>'+
  '<p class="muted tiny">Os mesmos profissionais podem trabalhar em serviços diferentes. Não somamos o mesmo funcionário duas vezes quando os serviços são sequenciais.</p>'+
  (roles.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Profissão</th><th>Profissionais no pico</th>'+
   (cost?'<th>Custo-hora interno</th>':'')+'</tr></thead><tbody>'+occupationRows+'</tbody></table></div>':
   '<p class="muted">Sem composição por profissão. O total de pessoas por função depende da revisão do serviço.</p>')+
  '<div class="workforce-total-days"><div><span>Duração estimada da sequência</span><strong>'+esc(d.complete?d.sequential_workdays:'Mínimo parcial: '+(d.sequential_workdays??0))+' dias úteis</strong></div></div>'+
  '<p class="muted tiny">Prazos de simulação por frente, com dependências e limite global de pessoas. Não incluem feriados, clima ou dias tecnológicos não cadastrados.</p></div>';
 const costPanel=cost?'<div class="card workforce-cost-summary"><div class="row"><h2>Custo interno estimado da obra</h2>'+
   '<button type="button" class="btn primary" data-action="company-config">Cadastrar custos e profissionais</button></div>'+
   '<div class="workforce-cost-totals"><div><span>Mão de obra estimada</span><strong>'+esc(cost.labor_estimated===null?'Aguardando custos-hora':brl(cost.labor_estimated))+'</strong></div>'+
   '<div><span>Empresa + mão de obra · sequência</span><strong>'+esc(cost.total_sequential===null?(cost.incomplete_scope?'Orçamento incompleto':'Aguardando despesas'):brl(cost.total_sequential))+'</strong></div>'+
   '</div>'+
   (cost.missing_rates?.length?'<p class="muted tiny">Preencha custo-hora das funções: '+cost.missing_rates.map(esc).join(', ')+'.</p>':'')+
   '<p class="muted tiny">Valor gerencial da empresa, sem materiais, equipamentos, impostos, BDI ou margem de lucro. Não adicionar sobre a tabela SIURB sem conciliação, para evitar duplicidade.</p></div>':'';
 const workfrontPanel=planningToolsPanel({config:planning.config,services:items,
  canEdit:!!planning.canEdit,esc});
 const info='<div class="notice tiny workforce-qualification"><strong>Estimativa, não escala de trabalho.</strong> '+
  (cfg.available_workers!==null&&cfg.available_workers!==undefined?
    'Simulação com até '+esc(cfg.available_workers)+' profissionais por serviço, sem contar você, ':
    'Simulação dimensionada para '+esc(cfg.target_days)+' dias úteis por serviço, ')+
  esc(cfg.hours_day)+' h/dia, '+
  esc(cfg.efficiency_pct)+'% de eficiência e até '+esc(cfg.crew_size)+' pessoas por equipe. '+
  'Os coeficientes de mão de obra SIURB são parciais; o prazo e as profissões devem ser conferidos na obra. A soma simultânea é limitada pelo efetivo global configurado no cronograma.'+
  (s.without_productivity?'<p class="danger"><strong>'+esc(s.without_productivity)+
  ' serviço(s) sem coeficiente:</strong> o total de equipes pode estar subestimado.</p>':'')+
  '<p>Os serviços dependentes são planejados em sequência; o mesmo profissional pode executar etapas diferentes. Não foram computadas esperas de cura ou secagem.</p></div>';
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
  sequencePanel+workforceSummary+workfrontPanel+costPanel+form+info+'</section>';
}
