/* CIVOLTEN — Etapa 3: cronograma privado responsivo, sem datas contratuais. */
const fmt=x=>String(x??'');
const isReviewer=state=>['administrador','revisor'].includes(state.user?.role);
const select=(name,options,esc,placeholder='Selecione')=>
 '<div class="field"><label for="schedule-'+esc(name)+'">'+esc(name.replaceAll('_',' '))+'</label>'+
 '<select id="schedule-'+esc(name)+'" name="'+esc(name)+'" required><option value="">'+esc(placeholder)+'</option>'+
 options.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title||x.source_name||x.name)+'</option>').join('')+'</select></div>';
const formInput=(label,name,type,required,value,esc,attrs='')=>'<div class="field"><label for="schedule-'+esc(name)+'">'+esc(label)+'</label>'+
 '<input id="schedule-'+esc(name)+'" name="'+esc(name)+'" type="'+esc(type)+'" value="'+esc(value??'')+'" '+(required?'required':'')+' '+attrs+'></div>';
const actions='<div class="actions"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-action="close-dialog">Cancelar</button></div>';
export function schedulePage({state,esc,writeable}){
 const p=state.schedulePlan;
 if(!p)return '<div class="card"><p>Carregando planejamento...</p></div>';
 const crew=p.crews||[],tasks=p.tasks||[],deps=p.dependencies||[];
 const preview=state.schedulePreview?.schedule;
 const canEdit=writeable()&&p.budget.status==='rascunho';
 const canApprove=isReviewer(state)&&p.budget.status==='rascunho';
 const names=new Map(crew.map(c=>[c.id,c.title]));
 const taskNames=new Map(tasks.map(t=>[t.id,t.title]));
 const actionsRow='<div class="actions"><button class="btn" data-action="schedule-back">Voltar ao orçamento</button>'+
 (canEdit?'<button class="btn primary" data-action="schedule-add-crew">+ Equipe</button><button class="btn" data-action="schedule-add-task">+ Atividade</button><button class="btn" data-action="schedule-add-dependency">+ Dependência</button>':'')+'</div>';
 const rows=tasks.map(t=>'<tr><td><strong>'+esc(t.title)+'</strong>'+
   (t.budget_service?'<div class="tiny muted">Serviço: '+esc(t.budget_service)+'</div>':'')+'</td>'+
   '<td>'+esc(names.get(t.crew_id)||'Sem equipe')+'</td><td>'+esc(t.days_estimated||'—')+' dias</td>'+
   '<td>'+esc(t.duration_review_state)+'</td><td>'+(canApprove?'<button class="btn" data-action="schedule-review-task" data-id="'+esc(t.id)+'">Revisar duração</button>':'—')+'</td></tr>').join('');
 const dependencyList=deps.map(d=>'<li>'+esc(taskNames.get(d.predecessor_id)||'Atividade')+' → '+esc(taskNames.get(d.successor_id)||'Atividade')+'</li>').join('');
 const errors=preview?.errors?.length?'<div class="notice" role="alert"><strong>Cálculo bloqueado:</strong><ul>'+preview.errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'';
 const warnings=preview?.warnings?.length?'<div class="notice"><strong>Avisos:</strong><ul>'+preview.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'';
 const summary=preview?.ready?'<div class="grid"><div class="card"><div class="muted">Início previsto</div><div class="metric">'+esc(preview.start)+'</div></div>'+
  '<div class="card"><div class="muted">Conclusão estimada</div><div class="metric">'+esc(preview.finish)+'</div></div>'+
  '<div class="card"><div class="muted">Dias úteis + segurança</div><div class="metric">'+esc(preview.total_workdays)+'</div></div></div>':'';
 const productivity=state.schedulePreview?.productivity||[];
 const productivityRows=productivity.map(p=>'<tr><td>'+esc(tasks.find(x=>x.id===p.task_id)?.title||p.task_id)+'</td>'+
   '<td>'+esc(p.labor_reference_verified?'Coeficiente conferido':'Pendente')+'</td>'+
   '<td>'+esc(p.projected_hh??'—')+'</td><td>'+esc(p.team_capacity_hh_per_day??'—')+'</td>'+
   '<td>'+esc(p.derived_workdays??'—')+'</td></tr>').join('');
 const productivityPanel=state.schedulePreview?'<div class="card"><h2>Conferência de produtividade (hora-homem)</h2>'+
   '<p class="muted tiny">Sem coeficiente de mão de obra aprovado, não há rendimento calculado; a duração manual permanece apenas uma estimativa.</p>'+
   '<div class="table-wrap"><table><thead><tr><th>Atividade</th><th>Evidência</th><th>h-h totais</th><th>h-h/dia da equipe</th><th>Dias por h-h</th></tr></thead><tbody>'+productivityRows+'</tbody></table></div></div>':'';
 const span=preview?.ready?Math.max(...preview.tasks.map(t=>t.endExclusive),1):1;
 const gantt=preview?.ready?'<div class="card"><h2>Linha do tempo preliminar</h2><div class="table-wrap"><div class="schedule-gantt">'+preview.tasks.map(t=>{
   const left=(t.startIndex/span*100).toFixed(3),width=((t.endExclusive-t.startIndex)/span*100).toFixed(3);
   return '<div class="schedule-gantt-row"><div class="schedule-gantt-name">'+esc(t.title)+'</div>'+
    '<div class="schedule-gantt-track"><div class="schedule-gantt-bar" style="left:'+left+'%;width:'+width+'%" role="img" aria-label="'+esc(t.title+' de '+t.start+' até '+t.finish)+'"></div></div>'+
    '<div class="tiny">'+esc(t.start)+' — '+esc(t.finish)+'</div></div>';
  }).join('')+'</div></div><p class="tiny muted">Barras em dias úteis; o detalhamento oficial de calendário e recursos depende da revisão da obra.</p></div>':'';
 const today=new Date().toISOString().slice(0,10);
 const inputs='<form id="schedule-simulate-form" class="card"><h2>Simular cronograma</h2>'+
  '<div class="grid">'+formInput('Data de início','start_date','date',true,state.scheduleSettings?.start_date||today,esc)+
  formInput('Dias por semana (5 ou 6)','work_days_week','number',true,state.scheduleSettings?.work_days_week||5,esc,'min="5" max="6" step="1"')+
  formInput('Margem de segurança (%)','safety_pct','number',true,state.scheduleSettings?.safety_pct??15,esc,'min="0" max="100" step="1"')+
  formInput('Feriados (AAAA-MM-DD separados por vírgula)','holidays','text',false,state.scheduleSettings?.holidays||'',esc)+'</div>'+
  '<div class="actions"><button class="btn primary" type="submit">Calcular prévia</button></div></form>';
 return '<div class="row"><div><h1>Cronograma da obra</h1><p class="muted">Etapa 3 — equipes, produtividade e dependências · '+esc(state.detail?.code||'')+'</p></div></div>'+
  actionsRow+
  '<div class="notice"><strong>Ambiente de homologação.</strong> Somente atividades com duração revisada recebem datas. Não é prazo contratual aprovado; a estimativa não libera propostas comerciais.</div>'+
  '<div class="grid"><div class="card"><div class="muted">Equipes cadastradas</div><div class="metric">'+esc(crew.length)+'</div></div><div class="card"><div class="muted">Atividades</div><div class="metric">'+esc(tasks.length)+'</div></div><div class="card"><div class="muted">Dependências</div><div class="metric">'+esc(deps.length)+'</div></div></div>'+
  '<div class="card"><h2>Equipes</h2>'+(crew.length?'<div class="table-wrap"><table><thead><tr><th>Equipe</th><th>Profissionais</th><th>Jornada</th><th>Eficiência</th></tr></thead><tbody>'+
   crew.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc((x.roles||[]).map(r=>r.role_name+' ('+r.workers+')').join(', ')||x.workers)+'</td><td>'+esc(x.workday_hours)+' h/dia</td><td>'+esc(Math.round(Number(x.efficiency)*100))+'%</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Cadastre uma equipe antes de criar atividades.</p>')+'</div>'+
  '<div class="card"><h2>Atividades e revisões</h2>'+(tasks.length?'<div class="table-wrap"><table><thead><tr><th>Atividade</th><th>Equipe</th><th>Duração</th><th>Situação</th><th>Revisão</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="muted">Nenhuma atividade cadastrada.</p>')+
  (deps.length?'<h3>Precedências</h3><ul>'+dependencyList+'</ul>':'')+'</div>'+
  inputs+errors+warnings+summary+productivityPanel+gantt;
}
export function scheduleDialog(action,{state,dialog,field,esc}){
 const plan=state.schedulePlan||{},crews=plan.crews||[],tasks=plan.tasks||[];
 if(action==='schedule-add-crew'){
  dialog('Cadastrar equipe','<form id="schedule-crew-form">'+
    field('Nome da equipe','title','text',true)+
    formInput('Jornada diária (horas)','workday_hours','number',true,8,esc,'min="1" max="12" step="0.5"')+
    formInput('Eficiência (0,01 a 1)','efficiency','number',true,0.85,esc,'min="0.01" max="1" step="0.01"')+
    field('Código da profissão (letras minúsculas)','role_code','text',true,'pedreiro')+
    field('Profissão','role_name','text',true,'Pedreiro')+
    formInput('Número de profissionais','workers','number',true,2,esc,'min="1" max="100" step="1"')+actions+'</form>');
  return true;
 }
 if(action==='schedule-add-task'){
  if(!crews.length)throw Error('Cadastre uma equipe primeiro.');
  dialog('Nova atividade','<form id="schedule-task-form">'+field('Título da atividade','title','text',true)+
   select('crew_id',crews,esc,'Equipe da atividade')+
   '<div class="field"><label>Serviço do orçamento (opcional)</label><select name="budget_item_id"><option value="">Sem serviço vinculado</option>'+
    (state.detail?.items||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.source_name)+'</option>').join('')+'</select></div>'+
   formInput('Duração prevista (dias úteis, pendente de aprovação)','duration_workdays','number',true,1,esc,'min="1" max="9000" step="1"')+
   '<p class="tiny muted">Uma nova atividade não será considerada no cálculo de datas até a revisão de duração.</p>'+actions+'</form>');
  return true;
 }
 if(action==='schedule-add-dependency'){
  if(tasks.length<2)throw Error('Cadastre ao menos duas atividades.');
  dialog('Dependência entre atividades','<form id="schedule-dependency-form">'+
   select('predecessor_id',tasks,esc,'Atividade predecessora')+select('successor_id',tasks,esc,'Atividade sucessora')+
   '<p class="tiny muted">Tipo fim-início (FS), sem defasagem. Ciclos são bloqueados.</p>'+actions+'</form>');
  return true;
 }
 if(action==='schedule-review-task'){
  const x=tasks.find(t=>t.id===state.scheduleTaskId);
  if(!x)throw Error('Atividade não encontrada');
  dialog('Validar duração da atividade','<form id="schedule-review-form" data-id="'+esc(x.id)+'"><p>'+esc(x.title)+'</p>'+
   formInput('Duração revisada (dias úteis)','duration_workdays','number',true,x.days_estimated,esc,'min="1" max="9000" step="1"')+
   '<div class="field"><label for="schedule-review-note">Justificativa técnica e premissas</label><textarea id="schedule-review-note" name="review_note" minlength="12" maxlength="1500" required></textarea></div>'+
   '<p class="tiny muted">A revisão é registrada no histórico. Não valida automaticamente tributos ou preços.</p>'+actions+'</form>');
  return true;
 }
 return false;
}
export async function scheduleHandleForm(form,{state,api,refresh,toast}){
 if(!form.id.startsWith('schedule-'))return false;
 const body=Object.fromEntries(new FormData(form).entries()),budget=state.detail?.id;
 if(!budget)throw Error('Selecione um orçamento.');
 if(form.id==='schedule-simulate-form'){
  state.scheduleSettings={...body};
  const query=new URLSearchParams(body);
  state.schedulePreview=await api('budgets/'+budget+'/schedule-preview?'+query.toString());
  await refresh(false);
  return true;
 }
 body.lock_version=state.schedulePlan.budget.lock_version;
 let route=null,method='POST';
 if(form.id==='schedule-crew-form')route='schedule-crews';
 else if(form.id==='schedule-task-form')route='schedule-tasks';
 else if(form.id==='schedule-dependency-form')route='schedule-dependencies';
 else if(form.id==='schedule-review-form'){
  route='schedule-tasks/'+form.dataset.id;
  method='PUT';
 } else return false;
 await api('budgets/'+budget+'/'+route,method,body);
 document.querySelector('#secure-dialog')?.remove();
 state.schedulePreview=null;
 await refresh(true);
 toast('Planejamento salvo no PostgreSQL e registrado no histórico.');
 return true;
}
