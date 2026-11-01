import {workforcePanel} from './secure-workforce.js';
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
 if(!state.scheduleAdvanced){
  return '<div class="schedule-auto-header"><div><span class="breadcrumb">ORÇAMENTOS / CRONOGRAMA</span>'+
    '<h1>Cronograma automático</h1><p class="muted">Serviços e quantidade de profissionais calculados a partir do orçamento '+esc(state.detail?.code||'')+'.</p></div>'+
    '<button type="button" class="btn" data-action="schedule-back">Voltar ao orçamento</button></div>'+
    workforcePanel(state.scheduleWorkforce,esc,{config:state.schedulePlanning,canEdit:writeable()})+
    (writeable()&&state.detail?.status==='rascunho'?'<div class="card"><h3>Registrar cronograma-base automaticamente</h3>'+
     '<p class="muted tiny">Usa somente serviços com produtividade revisada e profissões com funcionários ativos cadastrados. Não inventa equipes ou datas. Salva atividades para validação técnica, sem iniciar a obra.</p>'+
     '<button type="button" class="btn primary" data-action="schedule-autogenerate">Gerar cronograma-base no banco</button></div>':'')+
    '<div class="schedule-technical-link"><button type="button" class="btn" data-action="schedule-advanced-open">Acompanhamento técnico (opcional)</button>'+
    '<p class="muted tiny">Só para quem quiser registrar equipes reais, medições ou dependências. A estimativa acima não exige nada disso.</p></div>';
 }
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
   '<td>'+esc(t.duration_review_state)+'</td><td>'+(canApprove?'<button class="btn" data-action="schedule-review-task" data-id="'+esc(t.id)+'">Revisar duração</button>':'')+(canEdit?'<button class="btn" data-action="schedule-edit-task" data-id="'+esc(t.id)+'">Editar</button><button class="btn danger" data-action="schedule-archive-task" data-id="'+esc(t.id)+'">Arquivar</button>':'')+'</td></tr>').join('');
 const dependencyList=deps.map(d=>'<li>'+esc(taskNames.get(d.predecessor_id)||'Atividade')+' → '+esc(taskNames.get(d.successor_id)||'Atividade')+' '+(canEdit?'<button class="btn danger" data-action="schedule-remove-dependency" data-id="'+esc(d.predecessor_id)+'" data-successor="'+esc(d.successor_id)+'">Remover vínculo</button>':'')+'</li>').join('');
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
 const criticalTaskIds=new Set(state.schedulePreview?.critical_chain?.critical_task_ids||[]);
 const gantt=preview?.ready?'<div class="card"><h2>Linha do tempo preliminar</h2><div class="table-wrap"><div class="schedule-gantt">'+preview.tasks.map(t=>{
   const left=(t.startIndex/span*100).toFixed(3),width=((t.endExclusive-t.startIndex)/span*100).toFixed(3);
   return '<div class="schedule-gantt-row"><div class="schedule-gantt-name">'+esc(t.title)+'</div>'+
    '<div class="schedule-gantt-track"><div class="schedule-gantt-bar" style="left:'+left+'%;width:'+width+'%" role="img" aria-label="'+esc(t.title+' de '+t.start+' até '+t.finish)+'"></div></div>'+
    '<div class="tiny">'+esc(t.start)+' — '+esc(t.finish)+(criticalTaskIds.has(String(t.id))?'<strong> · Crítica</strong>':'')+'</div></div>';
  }).join('')+'</div></div><p class="tiny muted">Barras em dias úteis; o detalhamento oficial de calendário e recursos depende da revisão da obra.</p></div>':'';
 const report=state.scheduleProgress||{summaries:[],measurements:[]};
 const canReport=canEdit&&tasks.length>0;
 const recorded=report.measurements||[];
 const metrics=(report.summaries||[]).map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.completed_quantity)+' '+esc(x.unit||'')+
   '</td><td>'+esc(x.validated_person_hours)+' h-h</td><td>'+esc(x.observed_hh_per_unit??'—')+'</td>'+
   '<td>'+esc(x.progress_pct===null?'—':x.progress_pct+'%')+'</td></tr>').join('');
 const measurements=recorded.map(m=>'<tr><td>'+esc(String(m.worked_on).slice(0,10))+'</td><td>'+esc(m.task_title)+'</td>'+
   '<td>'+esc(m.completed_quantity)+'</td><td>'+esc(m.actual_person_hours)+'</td><td>'+esc(m.review_status)+'</td>'+
   '<td>'+esc(m.evidence_ref)+'</td><td>'+(canApprove&&m.review_status==='pendente'?
    '<button class="btn" type="button" data-action="schedule-review-progress" data-id="'+esc(m.id)+'">Validar / rejeitar</button>':'—')+'</td></tr>').join('');
 const diary='<div class="card"><div class="row"><h2>Diário de execução e medição</h2>'+
    (canReport?'<button class="btn primary" type="button" data-action="schedule-add-progress">+ Registrar medição</button>':'')+'</div>'+
    '<p class="muted tiny">As horas e quantidades são informadas pela equipe. Só registros validados por revisor entram na produtividade observada. Evidências rejeitadas permanecem no histórico.</p>'+
    (metrics?'<div class="table-wrap"><table><thead><tr><th>Atividade</th><th>Quantidade validada</th><th>Horas-homem</th><th>h-h por unidade</th><th>Avanço do orçamento</th></tr></thead><tbody>'+metrics+'</tbody></table></div>':'')+
    (measurements?'<h3>Lançamentos</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Atividade</th><th>Quantidade</th><th>Horas-homem</th><th>Estado</th><th>Evidência</th><th>Revisão</th></tr></thead><tbody>'+measurements+'</tbody></table></div>':
      '<p class="muted">Nenhuma medição registrada neste orçamento.</p>')+'</div>';
 const today=new Date().toISOString().slice(0,10);
 const inputs='<form id="schedule-simulate-form" class="card"><h2>Simular cronograma</h2>'+
  '<div class="grid">'+formInput('Data de início','start_date','date',true,state.scheduleSettings?.start_date||today,esc)+
  formInput('Dias por semana (5 ou 6)','work_days_week','number',true,state.scheduleSettings?.work_days_week||5,esc,'min="5" max="6" step="1"')+
  formInput('Margem de segurança (%)','safety_pct','number',true,state.scheduleSettings?.safety_pct??15,esc,'min="0" max="100" step="1"')+
  formInput('Feriados (AAAA-MM-DD separados por vírgula)','holidays','text',false,state.scheduleSettings?.holidays||'',esc)+'</div>'+
  '<div class="actions"><button class="btn primary" type="submit">Calcular prévia</button><button class="btn" type="button" data-action="schedule-run-remaining">Prever prazo restante (medições)</button></div></form>';
 const forecast=state.scheduleRemaining;
 const forecastPanel=forecast?'<div class="card"><h2>Previsão operacional do trabalho restante</h2>'+
   '<p class="muted tiny">Somente produção validada ou coeficientes de mão de obra revisados. Nunca usar como prazo contratual sem conferência.</p>'+
   (forecast.ready?'<div class="metric">'+esc(forecast.completed?'Concluído':forecast.schedule?.finish||'Sem término')+'</div>':
    '<div class="notice"><strong>Previsão bloqueada:</strong><ul>'+forecast.errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>')+
   '<div class="table-wrap"><table><thead><tr><th>Atividade</th><th>Falta executar</th><th>Origem do rendimento</th><th>Dias restantes</th></tr></thead><tbody>'+
   (forecast.items||[]).map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.remaining_quantity??'—')+'</td><td>'+esc(x.coefficient_source||'Sem evidência')+'</td><td>'+esc(x.estimated_remaining_workdays??'—')+'</td></tr>').join('')+'</tbody></table></div></div>':'';
 return '<div class="actions"><button type="button" class="btn" data-action="schedule-advanced-close">Voltar ao cronograma automático</button></div><div class="card schedule-advanced"><div class="row"><div><h2>Planejamento detalhado e medições</h2><p class="muted tiny">Opcional: aqui você pode cadastrar equipes reais, revisar atividades, criar dependências e registrar execução.</p></div></div></div>'+
  '<div class="row"><div><h1>Cronograma da obra</h1><p class="muted">Etapa 3 — equipes, produtividade e dependências · '+esc(state.detail?.code||'')+'</p></div></div>'+
  actionsRow+
  '<div class="notice"><strong>Ambiente de homologação.</strong> Somente atividades com duração revisada recebem datas. Não é prazo contratual aprovado; a estimativa não libera propostas comerciais.</div>'+
  '<div class="grid"><div class="card"><div class="muted">Equipes cadastradas (opcional)</div><div class="metric">'+esc(crew.length)+'</div></div><div class="card"><div class="muted">Atividades</div><div class="metric">'+esc(tasks.length)+'</div></div><div class="card"><div class="muted">Dependências</div><div class="metric">'+esc(deps.length)+'</div></div></div>'+
  '<div class="card"><h2>Equipes</h2>'+(crew.length?'<div class="table-wrap"><table><thead><tr><th>Equipe</th><th>Profissionais</th><th>Jornada</th><th>Eficiência</th></tr></thead><tbody>'+
   crew.map(x=>'<tr><td>'+esc(x.title)+(canEdit?'<div class="actions"><button class="btn" data-action="schedule-edit-crew" data-id="'+esc(x.id)+'">Editar</button><button class="btn danger" data-action="schedule-archive-crew" data-id="'+esc(x.id)+'">Arquivar</button></div>':'')+'</td><td>'+esc((x.roles||[]).map(r=>r.role_name+' ('+r.workers+')').join(', ')||x.workers)+'</td><td>'+esc(x.workday_hours)+' h/dia</td><td>'+esc(Math.round(Number(x.efficiency)*100))+'%</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Nenhuma equipe real cadastrada. A estimativa de equipes acima funciona sem esse cadastro; cadastre somente se quiser detalhar a execução.</p>')+'</div>'+
  '<div class="card"><h2>Atividades e revisões</h2>'+(tasks.length?'<div class="table-wrap"><table><thead><tr><th>Atividade</th><th>Equipe</th><th>Duração</th><th>Situação</th><th>Revisão</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="muted">Nenhuma atividade cadastrada.</p>')+
  (deps.length?'<h3>Precedências</h3><ul>'+dependencyList+'</ul>':'')+'</div>'+
  diary+inputs+errors+warnings+summary+forecastPanel+productivityPanel+gantt;
}
export function scheduleDialog(action,{state,dialog,field,esc}){
 if(action==='schedule-autogenerate'){
  dialog('Registrar cronograma-base revisável',
   '<p class="notice">Serão usadas as profissões dos funcionários ATIVOS e horas-homem já revisadas para cada serviço. A geração é bloqueada quando faltar qualquer uma delas.</p>'+
   '<form id="schedule-autogenerate-form">'+
   field('Jornada de trabalho da equipe (horas/dia)','hours_day','number',true,'','min="4" max="12" step="0.5"')+
   field('Eficiência planejada (%)','efficiency_pct','number',true,'','min="50" max="100" step="1"')+
   '<p class="muted tiny">Não reserva funcionários, não cria datas contratuais, não marca durações como aprovadas e não registra medições fictícias.</p>'+
   actions+'</form>');
  return true;
 }
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
 if(action==='schedule-edit-crew'){
  const x=crews.find(c=>c.id===state.scheduleTaskId);
  if(!x)throw Error('Equipe indisponível');
  dialog('Editar equipe (sem medições anteriores)','<form id="schedule-crew-edit-form" data-id="'+esc(x.id)+'">'+
    field('Nome da equipe','title','text',true,x.title)+
    formInput('Jornada diária','workday_hours','number',true,x.workday_hours,esc,'min="1" max="12" step="0.5"')+
    formInput('Eficiência','efficiency','number',true,x.efficiency,esc,'min="0.01" max="1" step="0.01"')+
    '<p class="muted tiny">Alocação com medições anteriores fica preservada e não pode ser alterada.</p>'+actions+'</form>');
  return true;
 }
 if(action==='schedule-edit-task'){
  const x=tasks.find(t=>t.id===state.scheduleTaskId);
  if(!x)throw Error('Atividade indisponível');
  dialog('Editar atividade (requer nova revisão)','<form id="schedule-task-edit-form" data-id="'+esc(x.id)+'">'+
    field('Nome da atividade','title','text',true,x.title)+
    '<div class="field"><label>Equipe</label><select name="crew_id" required>'+crews.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===x.crew_id?'selected':'')+'>'+esc(c.title)+'</option>').join('')+'</select></div>'+
    '<div class="field"><label>Serviço do orçamento</label><select name="budget_item_id"><option value="">Não vincular</option>'+
    (state.detail?.items||[]).map(i=>'<option value="'+esc(i.id)+'" '+(i.id===x.budget_item_id?'selected':'')+'>'+esc(i.source_name)+'</option>').join('')+'</select></div>'+
    formInput('Dias úteis previstos','duration_workdays','number',true,x.days_estimated,esc,'min="1" max="9000" step="1"')+
    '<p class="muted tiny">A edição revoga a revisão de duração. Atividades já medidas não poderão ser alteradas.</p>'+actions+'</form>');
  return true;
 }
 if(action==='schedule-add-progress'){
  if(!tasks.length)throw Error('Cadastre uma atividade antes da medição.');
  dialog('Registrar medição da execução','<form id="schedule-progress-form">'+
    select('task_id',tasks,esc,'Atividade executada')+
    formInput('Data efetiva','worked_on','date',true,new Date().toISOString().slice(0,10),esc)+
    formInput('Quantidade executada','completed_quantity','number',true,1,esc,'min="0.0001" max="1000000" step="0.0001"')+
    formInput('Profissionais presentes','workers','number',true,2,esc,'min="1" max="100" step="1"')+
    formInput('Horas trabalhadas por profissional','hours_per_worker','number',true,8,esc,'min="0.0001" max="12" step="0.0001"')+
    field('Referência da evidência (diário / documento)','evidence_ref','text',true)+
    '<div class="field"><label>Descrição da medição, local e método</label><textarea name="evidence_notes" minlength="15" maxlength="1500" required></textarea></div>'+
    '<p class="muted tiny">O lançamento fica pendente até conferência independente, sem alterar o preço orçado.</p>'+actions+'</form>');
  return true;
 }
 if(action==='schedule-review-progress'){
  const measurement=(state.scheduleProgress?.measurements||[]).find(x=>x.id===state.scheduleTaskId);
  if(!measurement||measurement.review_status!=='pendente')throw Error('Medição não pendente');
  dialog('Conferir evidência de execução','<form id="schedule-progress-review-form" data-id="'+esc(measurement.id)+'">'+
    '<p><strong>'+esc(measurement.task_title)+'</strong>: '+esc(measurement.completed_quantity)+' unidades, '+esc(measurement.actual_person_hours)+' h-h</p>'+
    '<p class="muted">'+esc(measurement.evidence_ref)+' — '+esc(measurement.evidence_notes)+'</p>'+
    '<div class="field"><label>Resultado</label><select name="review_status"><option value="validado">Validar medição</option><option value="rejeitado">Rejeitar medição</option></select></div>'+
    '<div class="field"><label>Justificativa</label><textarea name="review_notes" required minlength="15" maxlength="1500"></textarea></div>'+actions+'</form>');
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
 if(form.id==='schedule-progress-form')route='schedule-progress';
 else if(form.id==='schedule-progress-review-form'){route='schedule-progress/'+form.dataset.id;method='PUT';}
 else if(form.id==='schedule-crew-edit-form'){route='schedule-crews/'+form.dataset.id;method='PUT';}
 else if(form.id==='schedule-task-edit-form'){route='schedule-tasks/'+form.dataset.id;method='PUT';body.action='edit';}
 else if(form.id==='schedule-crew-form')route='schedule-crews';
 else if(form.id==='schedule-task-form')route='schedule-tasks';
 else if(form.id==='schedule-autogenerate-form')route='schedule-autogenerate';
 else if(form.id==='schedule-dependency-form')route='schedule-dependencies';
 else if(form.id==='schedule-review-form'){
  route='schedule-tasks/'+form.dataset.id;
  method='PUT';
 } else return false;
 await api('budgets/'+budget+'/'+route,method,body);
 document.querySelector('#secure-dialog')?.remove();
 state.schedulePreview=null;
 if(route==='schedule-autogenerate')state.scheduleAdvanced=true;
 await refresh(true);
 toast('Planejamento salvo no PostgreSQL e registrado no histórico.');
 return true;
}
