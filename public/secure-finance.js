/* CIVOLTEN Etapa 4: propostas RASCUNHO e custos realizados privados. */
const reviewer=state=>['administrador','revisor'].includes(state.user?.role);
const m=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(x)||0);
const field=(label,name,type='text',required=true,value='',attrs='')=>
 '<div class="field"><label>'+label+'</label><input name="'+name+'" type="'+type+'" value="'+String(value??'').replace(/"/g,'&quot;')+'" '+(required?'required':'')+' '+attrs+'></div>';
const buttons='<div class="actions"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-action="close-dialog">Cancelar</button></div>';
export function financePage({state,esc,writeable}){
 const model=state.finance;
 if(!model)return '<div class="card"><p>Carregando dados financeiros...</p></div>';
 const {summary,drafts,actuals}=model;
 const budget=summary.budget,edit=writeable()&&budget.status==='rascunho',
   canApprove=reviewer(state)&&budget.status==='rascunho';
 const errors=summary.estimate.errors||[];
 const totals=summary.comparison;
 const closeout=model.closeout||{metrics:{}},metrics=closeout.metrics||{},
  receipts=model.receipts?.records||[],forecasts=model.forecasts?.records||[];
 const approved=(s)=>s==='validado'?'Validado':s==='rejeitado'?'Rejeitado':'Pendente';
 const receiptRows=receipts.map(x=>'<tr><td>'+esc(x.payer_name)+'</td><td>'+m(x.amount)+'</td>'+
   '<td>'+esc(String(x.received_on).slice(0,10))+'</td><td>'+esc(x.evidence_ref)+'</td>'+
   '<td>'+approved(x.status)+'</td><td>'+(canApprove&&x.status==='pendente'&&x.created_by!==state.user?.id?
    '<button class="btn" data-action="finance-review-receipt" data-id="'+esc(x.id)+'">Conferir</button>':'—')+'</td></tr>').join('');
 const forecastRows=forecasts.map(x=>'<tr><td>'+esc(String(x.as_of).slice(0,10))+'</td><td>'+m(x.expected_remaining_cost)+'</td>'+
   '<td>'+esc(x.evidence_ref)+'</td><td>'+approved(x.status)+'</td>'+
   '<td>'+(canApprove&&x.status==='pendente'&&x.created_by!==state.user?.id?
    '<button class="btn" data-action="finance-review-forecast" data-id="'+esc(x.id)+'">Conferir</button>':'—')+'</td></tr>').join('');
 const readiness=model.readiness||{ready:false,reasons:[]};
 const closeoutPanel='<div class="card"><h2>Recebimentos e custo a concluir</h2>'+
    '<p class="muted tiny">Valores recebidos e evidenciados são diferentes de faturamento e lucro; previsões sem revisão não entram no fechamento.</p>'+
    '<div class="grid"><div class="card"><div class="muted">Recebimentos validados</div><div class="metric">'+m(metrics.receipt_validated_reais)+'</div></div>'+
    '<div class="card"><div class="muted">Recebimentos pendentes</div><div class="metric">'+m(metrics.receipt_pending_reais)+'</div></div>'+
    '<div class="card"><div class="muted">Custo ainda a completar, validado</div><div class="metric">'+
       (metrics.approved_remaining_cost_reais==null?'Não determinado':m(metrics.approved_remaining_cost_reais))+'</div></div>'+
    '<div class="card"><div class="muted">Custo projetado ao terminar</div><div class="metric">'+
       (metrics.projected_cost_at_completion_reais==null?'Não determinado':m(metrics.projected_cost_at_completion_reais))+'</div></div>'+
    '<div class="card"><div class="muted">Contribuição hipotética sobre preço estimado</div><div class="metric">'+
       (metrics.hypothetical_contribution_at_estimated_price_reais==null?'Não determinada':
         m(metrics.hypothetical_contribution_at_estimated_price_reais))+'</div></div></div>'+
    (closeout.needs_forecast_refresh?'<div class="notice">Novo custo validado após previsão: refazer o custo a completar.</div>':'')+
    '<h3>Comprovantes de recebimentos</h3>'+
    (receiptRows?'<div class="table-wrap"><table><thead><tr><th>Pagador</th><th>Valor</th><th>Data</th><th>Documento</th><th>Status</th><th>Conferência</th></tr></thead><tbody>'+receiptRows+'</tbody></table></div>':
       '<p class="muted">Nenhum recebimento registrado.</p>')+
    '<h3>Projeções de custo restante</h3>'+
    (forecastRows?'<div class="table-wrap"><table><thead><tr><th>Data-base</th><th>Saldo previsto</th><th>Evidência</th><th>Status</th><th>Conferência</th></tr></thead><tbody>'+forecastRows+'</tbody></table></div>':
       '<p class="muted">Nenhuma projeção documentada.</p>')+'</div>';
 const readinessPanel='<div class="card"><h2>Condições para emitir proposta comercial</h2>'+
   '<div class="notice"><strong>Emissão, envio, assinatura e aceite bloqueados</strong>. Não substituir análise técnica, tributária ou assinatura do cliente por clique interno.</div>'+
   '<ul>'+readiness.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';
 const draftRows=(drafts.drafts||[]).map(d=>'<tr><td>'+esc(d.version)+'</td><td>'+
   esc(String(d.created_at||'').slice(0,10))+'</td><td>'+
   (d.stale?'Desatualizado: orçamento modificado':'Atual na versão do orçamento')+'</td>'+
   '<td>'+esc(d.snapshot_sha256.slice(0,14))+'…</td><td>'+
   '<button class="btn" data-action="finance-open-draft" data-id="'+esc(d.id)+'">Consultar snapshot</button></td></tr>').join('');
 const actualRows=(actuals.costs||[]).map(a=>'<tr><td>'+esc(a.description)+'</td><td>'+m(a.amount)+'</td>'+
  '<td>'+esc(String(a.incurred_on).slice(0,10))+'</td><td>'+esc(a.evidence_ref)+'</td>'+
  '<td>'+esc(a.status)+'</td><td>'+(a.status==='pendente'&&canApprove?
    '<button class="btn" data-action="finance-review-actual" data-id="'+esc(a.id)+'">Revisar</button>':'—')+'</td></tr>').join('');
 return '<div class="row"><div><h1>Propostas e finanças</h1><p class="muted">Etapa 4 — '+esc(budget.code)+'</p></div></div>'+
  '<div class="actions"><button class="btn" data-action="finance-back">Voltar ao orçamento</button>'+
  (edit?'<button class="btn primary" data-action="finance-create-draft">+ Versão de proposta</button><button class="btn" data-action="finance-add-actual">+ Custo realizado</button><button class="btn" data-action="finance-add-receipt">+ Recebimento</button><button class="btn" data-action="finance-add-forecast">+ Custo a completar</button>':'')+'</div>'+
  '<div class="notice"><strong>Somente desenvolvimento.</strong> Rascunhos são internos; não são documentos comerciais. A contribuição estimada não significa lucro líquido. Não usar valores não homologados para contratar.</div>'+
  '<div class="grid"><div class="card"><div class="muted">Preço de venda estimado</div><div class="metric">'+m(totals.budget_sell_reais)+'</div></div>'+
  '<div class="card"><div class="muted">Custo direto orçado</div><div class="metric">'+m(totals.budget_direct_reais)+'</div></div>'+
  '<div class="card"><div class="muted">Contribuição orçada indicativa</div><div class="metric">'+m(totals.budget_contribution_reais)+'</div></div>'+
  '<div class="card"><div class="muted">Custo realizado e validado</div><div class="metric">'+m(summary.actuals.validated_reais)+'</div></div>'+
  '<div class="card"><div class="muted">Custo pendente de revisão</div><div class="metric">'+m(summary.actuals.pending_reais)+'</div></div>'+
  '<div class="card"><div class="muted">Lucro líquido real</div><div class="metric">Não determinado</div></div></div>'+
  '<p class="muted tiny">'+esc(summary.note)+'</p>'+
  (errors.length?'<div class="notice"><strong>Custos que impedem aprovação comercial:</strong><ul>'+
    errors.slice(0,15).map(x=>'<li>'+esc(x.message)+'</li>').join('')+'</ul></div>':'')+
  '<div class="card"><h2>Versões internas da proposta</h2>'+
   (draftRows?'<div class="table-wrap"><table><thead><tr><th>Versão</th><th>Data</th><th>Situação</th><th>SHA-256</th><th>Detalhes</th></tr></thead><tbody>'+draftRows+'</tbody></table></div>':'<p class="muted">Nenhum rascunho registrado.</p>')+'</div>'+
  '<div class="card"><h2>Custos realizados e documentos</h2>'+
   (actualRows?'<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Valor</th><th>Data</th><th>Evidência</th><th>Situação</th><th>Conferência</th></tr></thead><tbody>'+actualRows+'</tbody></table></div>':'<p class="muted">Nenhum custo realizado registrado.</p>')+'</div>'+closeoutPanel+readinessPanel;
}
export function financeDialog(action,{state,dialog,esc}){
 if(action==='finance-add-receipt'){
  dialog('Registrar recebimento com comprovante','<form id="finance-receipt-form">'+
   field('Valor recebido (R$)','amount','number',true,'','min="0.01" max="100000000" step="0.01"')+
   field('Data do recebimento','received_on','date',true,new Date().toISOString().slice(0,10))+
   '<div class="field"><label>Meio do recebimento</label><select name="method"><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></div>'+
   field('Nome do pagador','payer_name')+field('Referência do comprovante','evidence_ref')+
   '<div class="field"><label>Descrição da evidência</label><textarea name="evidence_notes" required minlength="15" maxlength="1500"></textarea></div>'+
   '<p class="muted tiny">O recebimento fica pendente até revisão de outra pessoa. Não emite nota fiscal.</p>'+buttons+'</form>');
  return true;
 }
 if(action==='finance-add-forecast'){
  dialog('Previsão do custo restante','<form id="finance-forecast-form">'+
   field('Custo a completar (R$)','expected_remaining_cost','number',true,'0','min="0" max="100000000" step="0.01"')+
   field('Data-base da previsão','as_of','date',true,new Date().toISOString().slice(0,10))+
   field('Referência técnica','evidence_ref')+
   '<div class="field"><label>Premissas e memória de cálculo</label><textarea name="assumptions" required minlength="20" maxlength="3000"></textarea></div>'+
   '<div class="field"><label>Custos pendentes estão incluídos no saldo previsto?</label><select name="includes_pending_costs"><option value="true">Sim</option><option value="false">Não — exige conferência</option></select></div>'+
   '<p class="muted tiny">O saldo restante não é custo realizado, requer validação por pessoa diferente.</p>'+buttons+'</form>');
  return true;
 }
 if(action==='finance-review-receipt'||action==='finance-review-forecast'){
  const table=action==='finance-review-receipt'?'receipts':'forecasts';
  const entry=(state.finance?.[table]?.records||[]).find(x=>x.id===state.financeSelected);
  if(!entry||entry.status!=='pendente')throw Error('Evidência não está pendente');
  dialog('Revisar evidência financeira','<form id="'+(table==='receipts'?'finance-receipt-review-form':'finance-forecast-review-form')+
   '" data-id="'+esc(entry.id)+'">'+
   '<p><strong>'+esc(entry.evidence_ref)+'</strong></p>'+
   '<div class="field"><label>Resultado</label><select name="status"><option value="validado">Validar</option><option value="rejeitado">Rejeitar</option></select></div>'+
   '<div class="field"><label>Justificativa</label><textarea name="review_notes" required minlength="15" maxlength="1500"></textarea></div>'+buttons+'</form>');
  return true;
 }
 if(action==='finance-create-draft'){
  dialog('Criar snapshot de proposta em rascunho',
   '<form id="finance-draft-form">'+
    '<div class="field"><label>Escopo completo da proposta</label><textarea name="scope" required minlength="15" maxlength="5000"></textarea></div>'+
    '<div class="field"><label>Exclusões e responsabilidades</label><textarea name="exclusions" required minlength="10" maxlength="3000"></textarea></div>'+
    '<div class="field"><label>Condições de pagamento</label><textarea name="payment_terms" required minlength="10" maxlength="1000"></textarea></div>'+
    field('Validade em dias','validity_days','number',true,30,'min="1" max="365" step="1"')+
    '<p class="muted tiny">Gera apenas uma versão interna auditável, nunca uma proposta emitida.</p>'+buttons+'</form>');
  return true;
 }
 if(action==='finance-add-actual'){
  dialog('Registrar custo realizado','<form id="finance-actual-form">'+
   '<div class="field"><label>Categoria</label><select name="category"><option value="material">Material</option>'+
   '<option value="mao_de_obra">Mão de obra</option><option value="equipamento">Equipamento</option>'+
   '<option value="frete">Frete</option><option value="servico_terceiro">Terceiros</option><option value="outro">Outros</option></select></div>'+
   field('Descrição','description')+field('Valor realizado (R$)','amount','number',true,'','min="0.01" max="100000000" step="0.01"')+
   field('Data do custo','incurred_on','date',true,new Date().toISOString().slice(0,10))+
   field('Documento ou referência','evidence_ref')+
   '<div class="field"><label>Descrição e justificativa da evidência</label><textarea name="evidence_notes" required minlength="15" maxlength="1500"></textarea></div>'+
   '<p class="muted tiny">Somente após revisão por outra pessoa o valor entra nos custos validados.</p>'+buttons+'</form>');
  return true;
 }
 if(action==='finance-review-actual'){
  const a=state.finance?.actuals?.costs?.find(x=>x.id===state.financeSelected);
  if(!a||a.status!=='pendente')throw Error('Documento não está pendente');
  dialog('Revisar lançamento financeiro','<form id="finance-review-form" data-id="'+esc(a.id)+'">'+
   '<p><strong>'+esc(a.description)+'</strong>: '+m(a.amount)+' — '+esc(a.evidence_ref)+'</p>'+
   '<div class="field"><label>Resultado</label><select name="status"><option value="validado">Validar</option><option value="rejeitado">Rejeitar</option></select></div>'+
   '<div class="field"><label>Justificativa</label><textarea name="review_notes" required minlength="15" maxlength="1500"></textarea></div>'+buttons+'</form>');
  return true;
 }
 if(action==='finance-view-draft'){
  const d=state.financeDraft;
  if(!d)throw Error('Versão de proposta indisponível');
  const s=d.snapshot;
  const lines=(s.items||[]).map(i=>'<li>'+esc(i.name)+' — '+esc(i.quantity)+' '+esc(i.unit)+'</li>').join('');
  dialog('Proposta interna — versão '+esc(d.version),
    '<div class="notice"><strong>RASCUNHO • NÃO EMITIDO</strong> — '+(d.stale?'Versão desatualizada':'Versão do orçamento atual')+'</div>'+
    '<p><strong>Cliente:</strong> '+esc(s.client?.name)+'</p>'+
    '<p><strong>Obra:</strong> '+esc(s.project?.title||'Sem obra')+'</p>'+
    '<p><strong>Escopo:</strong> '+esc(s.scope)+'</p>'+
    '<p><strong>Exclusões:</strong> '+esc(s.exclusions)+'</p>'+
    '<p><strong>Pagamento:</strong> '+esc(s.payment_terms)+'</p>'+
    '<p><strong>Preço calculado não aprovado:</strong> '+m(s.costs?.total_reais)+'</p>'+
    '<p><strong>Hash:</strong> <code>'+esc(d.snapshot_sha256)+'</code></p>'+
    '<h3>Serviços</h3><ul>'+lines+'</ul>'+
    '<div class="actions"><a class="btn" href="/api/v1/budgets/'+esc(state.detail.id)+'/proposal-drafts/'+esc(d.id)+'/pdf">Baixar PDF RASCUNHO</a><button type="button" class="btn" data-action="close-dialog">Fechar</button></div>');
  return true;
 }
 return false;
}
export async function financeHandleForm(form,{state,api,refresh,toast}){
 if(!form.id.startsWith('finance-'))return false;
 const body=Object.fromEntries(new FormData(form).entries());
 const budget=state.detail?.id;
 if(!budget)throw Error('Orçamento não selecionado');
 body.lock_version=state.finance.summary.budget.lock_version;
 let endpoint=null,method='POST';
 if(form.id==='finance-receipt-form')endpoint='financial-receipts';
 else if(form.id==='finance-forecast-form'){
  endpoint='financial-forecasts';
  body.includes_pending_costs=body.includes_pending_costs==='true';
 }
 else if(form.id==='finance-receipt-review-form'){endpoint='financial-receipts/'+form.dataset.id;method='PUT';}
 else if(form.id==='finance-forecast-review-form'){endpoint='financial-forecasts/'+form.dataset.id;method='PUT';}
 else if(form.id==='finance-draft-form')endpoint='proposal-drafts';
 else if(form.id==='finance-actual-form')endpoint='financial-actuals';
 else if(form.id==='finance-review-form'){
  endpoint='financial-actuals/'+form.dataset.id;method='PUT';
 }else return false;
 await api('budgets/'+budget+'/'+endpoint,method,body);
 document.querySelector('#secure-dialog')?.remove();
 await refresh();
 toast('Registro financeiro salvo com histórico; emissão comercial permanece bloqueada.');
 return true;
}
