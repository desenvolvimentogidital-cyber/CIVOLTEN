/* Editor opcional do cronograma automático. Cadastro de equipes NÃO é exigido. */
export function planningToolsPanel({config,services,canEdit,esc}){
 if(!config||config.error)return '<p class="muted tiny">'+esc(config?.error||'Carregando frentes de trabalho…')+'</p>';
 const fronts=new Map((config.fronts||[]).map(x=>[String(x.budget_item_id),x]));
 const options=(services||[]).map(s=>'<option value="'+esc(s.item_id)+'">'+esc(s.title)+'</option>').join('');
 const frontRows=(services||[]).map(x=>{
  const front=fronts.get(String(x.item_id))||{};
  return '<form id="planning-front-'+esc(x.item_id)+'" class="planning-front-form" data-service="'+esc(x.item_id)+'">'+
   '<div class="planning-front-name">'+esc(x.title)+'</div>'+
   '<label>Frente de serviço <input name="work_front" maxlength="80" value="'+esc(front.work_front||'Geral')+'" required></label>'+
   '<label>Espera após execução (dias úteis) <input name="wait_workdays" type="number" min="0" max="60" step="1" value="'+esc(front.wait_workdays??0)+'" required></label>'+
   '<button type="submit" class="btn">Salvar frente</button></form>';
 }).join('');
 const depRows=(config.dependencies||[]).map(d=>{
  const names=new Map((services||[]).map(x=>[x.item_id,x.title]));
  return '<li>'+esc(names.get(d.predecessor_item_id)||'Serviço')+
   ' → '+esc(names.get(d.successor_item_id)||'Serviço')+
   ' · espera '+esc(d.lag_workdays)+' dia(s)'+
   '<button type="button" class="btn" data-action="planning-remove-link" data-before="'+esc(d.predecessor_item_id)+
   '" data-after="'+esc(d.successor_item_id)+'">Remover</button></li>';
 }).join('');
 return '<details class="planning-tools"><summary>Frentes e dependências (configuração opcional)</summary>'+
  '<p class="muted tiny">A mesma frente não executa dois serviços simultâneos. Frentes distintas podem avançar juntas, desde que haja profissionais disponíveis. Esperas tecnológicas precisam ser informadas; não são presumidas.</p>'+
  (canEdit?'<section class="planning-front-forms"><h3>Organizar serviços por frente</h3>'+frontRows+'</section>'+
  '<section><h3>Adicionar dependência entre dois serviços</h3><form id="planning-link-form">'+
  '<label>Executar primeiro <select name="predecessor_item_id" required>'+options+'</select></label>'+
  '<label>Executar depois <select name="successor_item_id" required>'+options+'</select></label>'+
  '<label>Espera extra (dias úteis) <input name="lag_workdays" type="number" min="0" max="60" value="0" required></label>'+
  '<button class="btn primary" type="submit">Salvar dependência</button></form></section>':'<p>Apenas orçamentistas e administradores podem alterar este plano.</p>')+
  '<h3>Dependências configuradas</h3><ul class="planning-dependencies">'+(depRows||'<li>Nenhuma dependência manual. As precedências técnicas conhecidas continuam sugeridas automaticamente.</li>')+'</ul>'+
  '</details>';
}
