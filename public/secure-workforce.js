/* CIVOLTEN — pré-dimensionamento automático a partir do orçamento.
 * Sem registro de equipes, prazos contratuais ou alteração de dados.
 */
const nfmt=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(n)||0);
export function workforcePanel(data,esc){
 if(!data)return '<section class="card workforce-panel"><h2>Serviços do orçamento e equipes sugeridas</h2><p class="muted">Carregando a sugestão de mão de obra…</p></section>';
 if(data.error)return '<section class="card workforce-panel"><h2>Serviços do orçamento e equipes sugeridas</h2><p class="danger">'+esc(data.error)+'</p></section>';
 const sum=data.summary||{},cfg=data.settings||{};
 const services=data.services||[];
 const cards=[['Serviços no orçamento',sum.total_services??0],
  ['Profissionais · paralelo',sum.simultaneous_workers??0],
  ['Equipes · paralelo',sum.simultaneous_crews??0],
  ['Equipes · sequencial',sum.sequential_peak_crews??0]];
 const summaryCards='<div class="grid workforce-kpis">'+cards.map(([label,value])=>
  '<div class="card stat-card"><div><div class="stat-label">'+esc(label)+'</div><div class="stat-value">'+esc(value)+'</div></div></div>').join('')+'</div>';
 const rows=services.map(service=>{
  const roles=service.roles?.length?service.roles.map(r=>'<span class="tag">'+esc(r.name)+' · '+esc(r.workers)+'</span>').join(' '):
   '<span class="muted tiny">Divisão por profissão não identificada</span>';
  const estimate=service.workers===null?
   '<span class="workforce-pending">Produtividade pendente</span>':
   '<strong>'+esc(service.workers)+' profissionais</strong><div class="tiny muted">'+esc(service.crews)+' equipe(s) de até '+esc(cfg.crew_size)+' pessoas</div>';
  return '<tr><td><strong>'+esc(service.code||'Próprio')+'</strong><div>'+esc(service.title)+'</div>'+
   '<div class="tiny muted">'+esc(nfmt(service.quantity))+' '+esc(service.unit)+'</div></td>'+
   '<td>'+esc(service.hh_per_unit===null?'—':nfmt(service.hh_per_unit))+' h-h/'+esc(service.unit)+'</td>'+
   '<td>'+esc(service.estimated_hh===null?'—':nfmt(service.estimated_hh))+'</td>'+
   '<td>'+estimate+'</td><td>'+roles+'</td><td><span class="tag">'+esc(service.reviewed?'Coeficiente revisado':service.workers!==null?'SIURB parcial':'Sem coeficiente')+'</span></td></tr>';
 }).join('');
 const forms='<form id="workforce-settings-form" class="workforce-settings">'+
  '<div class="workforce-fields"><div class="field"><label for="wf-days">Prazo hipotético (dias úteis por serviço)</label><input id="wf-days" type="number" min="1" max="365" step="1" name="target_days" value="'+esc(cfg.target_days)+'" required></div>'+
  '<div class="field"><label for="wf-hours">Jornada (h/dia)</label><input id="wf-hours" type="number" min="4" max="12" step="0.5" name="hours_day" value="'+esc(cfg.hours_day)+'" required></div>'+
  '<div class="field"><label for="wf-efficiency">Eficiência hipotética (%)</label><input id="wf-efficiency" type="number" min="50" max="100" step="1" name="efficiency_pct" value="'+esc(cfg.efficiency_pct)+'" required></div>'+
  '<div class="field"><label for="wf-crew">Tamanho máximo de cada equipe</label><input id="wf-crew" type="number" min="1" max="20" step="1" name="crew_size" value="'+esc(cfg.crew_size)+'" required></div></div>'+
  '<button class="btn primary" type="submit">Recalcular equipes</button></form>';
 const notice= '<div class="notice tiny" role="note"><strong>Estimativa, não escala de trabalho:</strong> '+esc(data.notice||'')+
  '<p><strong>Hipótese:</strong> '+esc(data.assumptions||'')+'</p>'+
  (sum.without_productivity?'<p class="danger"><strong>'+esc(sum.without_productivity)+' serviço(s) sem coeficiente.</strong> Os totais podem estar subestimados.</p>':'')+
  '<p><strong>Paralelo:</strong> todos os serviços usam pessoal simultaneamente. <strong>Sequencial:</strong> o mesmo grupo pode ser reaproveitado, sem prometer prazo de obra. Profissões e disponibilidade devem ser confirmadas.</p></div>';
 return '<section class="workforce-section"><div class="page-title"><div><div class="breadcrumb">CRONOGRAMA / DIMENSIONAMENTO AUTOMÁTICO</div><h2>Serviços e equipes sugeridas</h2><p>Os serviços vêm automaticamente do seu orçamento. Não é necessário cadastrar uma equipe para estimar quantas pessoas serão necessárias.</p></div></div>'+
  forms+
  summaryCards+
  (services.length?'<div class="card workforce-table"><div class="row"><h3>Serviços que serão executados</h3><span class="tag">'+esc(data.budget?.code||'Orçamento')+'</span></div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Serviço</th><th>h-h por unidade</th><th>h-h total</th><th>Dimensionamento</th><th>Profissões sugeridas</th><th>Confiabilidade</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>':
   '<div class="card"><p class="muted">Seu orçamento ainda não tem serviços. Adicione os serviços no orçamento para que apareçam aqui.</p></div>')+
  notice+
  '<p class="tiny muted">Para definir datas, dependências e registrar medições, use o planejamento detalhado abaixo. A sugestão não cadastra equipes automaticamente nem altera o banco.</p></section>';
}
