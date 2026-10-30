/* CIVOLTEN – cadastro interno opcional de profissionais e despesas.
 * Não é cadastro de equipes, não altera preços do orçamento.
 */
const cur=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const input=(label,name,value='',type='text',extra='')=>'<div class="field"><label>'+label+
 '</label><input name="'+name+'" type="'+type+'" value="'+String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')+'" '+extra+' required></div>';
const buttons='<div class="actions"><button class="btn primary" type="submit">Salvar custos internos</button><button class="btn" type="button" data-action="company-config">Voltar</button></div>';
const clean=dialog=>{document.querySelector('#secure-dialog')?.remove();return dialog};
export async function companyCostsDialog(action,{state,api,dialog,esc,id}){
 const show=clean(dialog);
 if(!state.detail?.id)throw Error('Abra um orçamento primeiro');
 const data=await api('company-costs');
 const roles=(state.scheduleWorkforce?.roles||[]),names=new Map(roles.map(x=>[x.code,x.name]));
 if(action==='company-config'){
  const rateRows=roles.map(r=>{
   const rate=data.rates.find(x=>x.role_code===r.code);
   return '<tr><td>'+esc(r.name)+'</td><td>'+esc(rate?cur(rate.hourly_employer_cost):'Sem custo-hora cadastrado')+
   '</td><td><button class="btn" type="button" data-action="company-edit-rate" data-id="'+esc(r.code)+'">Definir custo-hora</button></td></tr>';
  }).join('');
  const extraRates=data.rates.filter(x=>!names.has(x.role_code)).map(r=>
   '<tr><td>'+esc(r.role_name)+'</td><td>'+esc(cur(r.hourly_employer_cost))+'</td><td><button class="btn" type="button" data-action="company-edit-rate" data-id="'+esc(r.role_code)+'">Editar</button></td></tr>').join('');
  const workers=data.workers.map(w=>'<tr><td>'+esc(w.display_name)+'</td><td>'+esc(w.role_name)+'</td>'+
   '<td>'+esc(cur(w.monthly_employer_cost))+'</td><td>'+esc(w.active?'Ativo':'Inativo')+'</td><td>'+
   '<button class="btn" type="button" data-action="company-edit-worker" data-id="'+esc(w.id)+'">Editar</button></td></tr>').join('');
  show('Custos internos da CIVOLTEN','<div class="notice tiny"><strong>Uso interno:</strong> informe o custo completo da empresa por profissional, incluindo salário, encargos e benefícios. Não é necessário cadastrar profissionais para fazer o cronograma.</div>'+
   '<div class="actions"><button class="btn primary" type="button" data-action="company-edit-overhead">Despesas fixas da empresa</button>'+
   '<button class="btn" type="button" data-action="company-add-worker">+ Cadastrar profissional</button>'+
   (state.user?.role==='administrador'?'<button class="btn" type="button" data-action="company-edit-pricing">Margem e pró-labore</button>'+
    '<button class="btn primary" type="button" data-action="company-simulate-sale">Simular preço com custos próprios</button>':'')+'</div>'+
   '<div class="notice tiny"><strong>Metas comerciais internas:</strong> '+
   (data.pricing?'Margem '+esc(Number(data.pricing.target_margin_pct))+'% sobre a venda · Pró-labore mensal '+esc(cur(data.pricing.owner_prolabore_monthly)):'Configuração ainda não instalada no banco')+
   '. Não somar automaticamente ao BDI da SIURB ou emitir preço final sem impostos informados e conferência técnica.</div>'+
   '<p class="muted tiny">Despesas mensais: '+esc(data.overhead?cur(data.overhead.monthly_overhead):'Não configuradas')+
   ' · Dias úteis/mês: '+esc(data.overhead?.workdays_per_month??22)+'. Inclua aluguel, escritório, veículos e pró-labore, sem repetir parcelas já computadas.</p>'+
   '<h3>Custo-hora por profissão</h3><div class="table-wrap"><table><thead><tr><th>Profissão</th><th>Custo-hora</th><th>Ação</th></tr></thead><tbody>'+
   (rateRows+extraRates||'<tr><td colspan="3">Nenhum serviço com profissão identificada.</td></tr>')+'</tbody></table></div>'+
   '<h3>Base dos profissionais</h3><p class="muted tiny">Cadastro opcional. A média dos custos mensais ativos pode ser usada quando não houver custo-hora específico. Nenhum profissional é alocado automaticamente.</p>'+
   '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Função</th><th>Custo mensal</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+
   (workers||'<tr><td colspan="5">Nenhum profissional cadastrado.</td></tr>')+'</tbody></table></div>');
  return;
 }
 if(action==='company-simulate-sale'){
  if(state.user?.role!=='administrador')throw Error('Somente administrador acessa a simulação comercial');
  if(!data.pricing)throw Error('Configure a margem e o pró-labore antes de simular');
  const fields=[
   ['Mão de obra da obra, com encargos (R$)','internal_labor_cost'],
   ['Materiais da obra (R$)','material_cost'],
   ['Equipamentos e locações da obra (R$)','equipment_cost'],
   ['Outros custos diretos, inclusive mobilização (R$)','other_direct_cost'],
   ['Pró-labore RATEADO para esta obra (R$)','owner_prolabore_allocation'],
   ['Outras despesas indiretas RATEADAS para esta obra (R$)','other_overhead_allocation']
  ];
  show('Simular preço de venda com custos próprios',
   '<div class="notice"><strong>Simulação, sem emissão comercial.</strong> A conta parte apenas dos custos próprios informados, não soma a tabela SIURB nem adiciona BDI. Preencha cada categoria, usando 0 somente quando for realmente inexistente.</div>'+
   '<p class="muted tiny">Margem atual: '+esc(data.pricing.target_margin_pct)+'% da receita. Pró-labore mensal configurado: '+esc(cur(data.pricing.owner_prolabore_monthly))+
   '. Informe abaixo o valor justificável alocado a ESTA obra, sem duplicar administração.</p>'+
   '<form id="company-simulate-form">'+
   fields.map(([label,name])=>input(label,name,'','number','min="0" max="100000000" step="0.01"')).join('')+
   input('Tributos efetivos sobre a receita (%) — confirme com a contabilidade','taxes_on_revenue_pct','','number','min="0" max="60" step="0.01"')+
   '<p class="muted tiny">Sem impostos confirmados não há formação de preço confiável. Esta operação não altera orçamentos, fichas SIURB, contratos ou cadastros.</p>'+
   '<div class="actions"><button class="btn primary" type="submit">Calcular cenário indicativo</button>'+
   '<button class="btn" type="button" data-action="company-config">Cancelar</button></div></form>');
  return;
 }
 if(action==='company-edit-pricing'){
  if(state.user?.role!=='administrador')throw Error('Somente administrador pode alterar a margem e o pró-labore');
  if(!data.pricing)throw Error('A configuração de preços ainda não foi instalada no banco');
  show('Margem e pró-labore CIVOLTEN','<form id="company-pricing-form">'+
   input('Margem desejada sobre faturamento (%)','target_margin_pct',data.pricing.target_margin_pct,'number','min="0" max="80" step="0.01"')+
   input('Pró-labore mensal do proprietário (R$)','owner_prolabore_monthly',data.pricing.owner_prolabore_monthly,'number','min="0" max="10000000" step="0.01"')+
   '<p class="muted tiny">Esta configuração serve para estudo gerencial. O pró-labore é separado das despesas fixas e não entra automaticamente no BDI. Tributos sobre a receita devem ser informados e preços comerciais precisam de revisão antes da aprovação.</p>'+buttons+'</form>');return;
 }
 if(action==='company-edit-overhead'){
  const o=data.overhead||{};
  show('Despesas fixas mensais','<form id="company-overhead-form">'+
   input('Despesas fixas totais da empresa por mês (R$)','monthly_overhead',o.monthly_overhead??'','number','min="0" step="0.01"')+
   input('Dias úteis por mês para rateio','workdays_per_month',o.workdays_per_month??22,'number','min="15" max="31" step="1"')+
   '<p class="tiny muted">O rateio considera a duração estimada da obra. Não significa que esse valor será automaticamente adicionado aos serviços SIURB.</p>'+buttons+'</form>');return;
 }
 if(action==='company-edit-rate'){
  const r=data.rates.find(x=>x.role_code===id),suggested=roles.find(x=>x.code===id);
  if(!id||(!r&&!suggested))throw Error('Profissão não encontrada');
  show('Custo-hora interno por profissão','<form id="company-rate-form">'+
   input('Código da profissão','role_code',id,'text','readonly maxlength="40"')+
   input('Profissão','role_name',r?.role_name||suggested?.name||'','text','maxlength="140"')+
   input('Custo total da empresa por hora (R$)','hourly_employer_cost',r?.hourly_employer_cost??'','number','min="0" step="0.01"')+
   '<p class="muted tiny">Inclua encargos e benefícios no custo-hora. Se já embutidos em outro campo, não some novamente.</p>'+buttons+'</form>');return;
 }
 if(action==='company-add-worker'||action==='company-edit-worker'){
  const w=action==='company-edit-worker'?data.workers.find(x=>x.id===id):null;
  if(action==='company-edit-worker'&&!w)throw Error('Profissional não encontrado');
  const selectedRole=w?.role_code||roles[0]?.code||'';
  const codeSuggestions=roles.map(r=>'<option value="'+esc(r.code)+'">'+esc(r.name)+'</option>').join('');
  show(w?'Editar profissional':'Cadastrar profissional da empresa',
   '<form id="'+(w?'company-worker-edit-form':'company-worker-form')+'" '+(w?'data-id="'+esc(w.id)+'"':'')+'>'+
   input('Nome profissional','display_name',w?.display_name||'','text','maxlength="160"')+
   input('Código da profissão SIURB (ex.: 2020)','role_code',selectedRole,'text','maxlength="40" list="company-role-codes"')+
   '<datalist id="company-role-codes">'+codeSuggestions+'</datalist>'+
   input('Profissão','role_name',w?.role_name||roles.find(r=>r.code===selectedRole)?.name||'','text','maxlength="140"')+
   input('Custo mensal completo para a empresa (R$)','monthly_employer_cost',w?.monthly_employer_cost??'','number','min="0" step="0.01"')+
   (w?'<div class="field"><label>Situação</label><select name="active"><option value="true" '+(w.active?'selected':'')+'>Ativo</option>'+
    '<option value="false" '+(!w.active?'selected':'')+'>Inativo</option></select></div>':'')+
   '<p class="tiny muted">Não informe CPF, telefone ou dados sensíveis. O registro serve apenas como base de custo e não significa alocação nesta obra.</p>'+buttons+'</form>');return;
 }
}
export async function companyCostsSubmit(form,{state,api,toast,refresh,dialog,esc}) {
 const b=Object.fromEntries(new FormData(form).entries());
 if(form.id==='company-simulate-form'){
  if(state.user?.role!=='administrador')throw Error('Somente administrador acessa a simulação comercial');
  const scenario=await api('company-costs/pricing/simulate','POST',b);
  if(scenario.commercial_release!==false||scenario.can_issue!==false)
   throw Error('Simulação não pode emitir proposta comercial');
  document.querySelector('#secure-dialog')?.remove();
  dialog('Resultado da simulação de custos próprios',
   '<div class="notice"><strong>Estimativa não contratual</strong><p>Preço de venda indicativo: '+
   esc(cur(scenario.price.sale_price))+'</p><p>Custo completo informado: '+esc(cur(scenario.complete_cost_reais))+
   '</p><p>Margem configurada: '+esc(scenario.price.margin_pct)+'% · Tributos informados: '+
   esc(scenario.taxes_on_revenue_pct)+'% · Valor indicativo da margem: '+
   esc(cur(scenario.price.profit_before_income_tax))+'</p></div>'+
   '<p class="muted tiny">Nenhum orçamento foi alterado nem documento emitido. Os valores não representam lucro líquido.</p>'+
   '<div class="notice tiny">'+scenario.warnings.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>'+
   '<div class="actions"><button class="btn" type="button" data-action="company-simulate-sale">Recalcular</button>'+
   '<button class="btn" type="button" data-action="company-config">Voltar aos custos</button></div>');
  toast('Cenário calculado com os custos próprios e tributos informados; nenhum valor foi gravado.');
  return true;
 }

 if(form.id==='company-pricing-form')await api('company-costs/pricing','PUT',b);
 else if(form.id==='company-overhead-form')await api('company-costs/overhead','PUT',b);
 else if(form.id==='company-rate-form')await api('company-costs/rates','PUT',b);
 else if(form.id==='company-worker-form')await api('company-costs/workers','POST',b);
 else if(form.id==='company-worker-edit-form'){
  if(!form.dataset.id)throw Error('Profissional não identificado');
  await api('company-costs/workers/'+form.dataset.id,'PUT',{...b,active:b.active==='true'});
 }else return false;
 document.querySelector('#secure-dialog')?.remove();
 await refresh();
 toast('Cadastro de custos internos salvo. Estimativas atualizadas.');
 return true;
}
