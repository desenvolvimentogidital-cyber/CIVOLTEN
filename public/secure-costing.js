/* CIVOLTEN — Interface da engenharia de custos (homologação). */
const fmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const fields=['administracaoCentral','seguro','garantia','risco','despesasFinanceiras','lucro','tributosSobreReceita'];
const labels={administracaoCentral:'Administração central',seguro:'Seguros',garantia:'Garantias',risco:'Riscos',despesasFinanceiras:'Despesas financeiras',lucro:'Lucro',tributosSobreReceita:'Tributos sobre faturamento'};
const categories={mobilizacao:'Mobilização',frete:'Frete',equipamento:'Equipamentos',descarte:'Descarte',indireto_local:'Custo indireto local',outro:'Outro'};
const checkbox=(name,label,checked=false,disabled=false)=>'<label style="display:flex;align-items:center;gap:8px;margin:10px 0"><input type="checkbox" name="'+name+'" '+(checked?'checked ':'')+(disabled?'disabled':'')+'>'+label+'</label>';
const txt=(x)=>String(x??'');
export function costPage({state,esc,writeable}){
 const data=state.costs;
 if(!data)return '<div class="card"><p>Carregando custos…</p></div>';
 const est=data.estimate,profile=data.config||{},items=data.items||[],extra=data.extra||[];
 const canApprove=['administrador','revisor'].includes(state.user?.role);
 const errors=(est.errors||[]).slice(0,35).map(x=>'<li class="danger"><strong>'+esc(x.code)+'</strong> — '+esc(x.message)+'</li>').join('');
 const warnings=(est.warnings||[]).slice(0,25).map(x=>'<li>'+esc(x.message)+'</li>').join('');
 const rowButtons=writeable()?'<button class="btn primary" data-action="cost-add-siurb">+ SIURB</button> <button class="btn" data-action="cost-add-extra">+ Custo extra</button> <button class="btn" data-action="cost-bdi-form">Configurar BDI</button>':'';
 const tableRows=items.map((x,index)=>{
   const rev=x.source||'MANUAL';
   return '<tr><td><strong>'+esc(x.source_code||'Próprio')+'</strong> '+esc(x.source_name)+'</td><td>'+esc(rev)+'</td>'+
   '<td>'+esc(x.quantity)+' '+esc(x.unit)+'</td><td>'+fmt(x.direct_unit_cost)+'</td>'+
   '<td>'+fmt(est.lines?.[index]?.cost_reais||0)+'</td>'+
   '<td>'+esc(x.quantity_verified?'Conferido':'Medição pendente')+'</td><td>'+ (x.reference_price_id?'<button class="btn" data-action="cost-composition" data-id="'+esc(x.reference_price_id)+'">Ver insumos</button> ':'')+ (writeable()||canApprove?'<button class="btn" data-action="cost-evidence" data-id="'+esc(x.id)+'">Evidências</button>':'—')+'</td></tr>'
 }).join('');
 const rowsExtra=extra.map(x=>'<tr><td>'+esc(categories[x.category]||x.category)+' — '+esc(x.description)+'</td><td>'+fmt(x.amount)+'</td><td>'+ (x.included_in_unit_prices?'Possível duplicação':'Separado')+'</td><td>'+(writeable()?'<button class="btn danger" data-action="cost-remove-extra" data-id="'+esc(x.id)+'">Remover</button>':'—')+'</td></tr>').join('');
 const ready=est.ready;
 return '<div class="row"><div><h1>Engenharia de custos</h1><p class="muted">'+esc(state.detail?.code||'')+' · Data-base '+esc(data.budget.reference_month)+' · '+esc(data.budget.regime)+'</p></div><button class="btn" data-action="cost-back">Voltar ao orçamento</button></div>'+
 '<div class="notice"><strong>Prévia para conferência — não é proposta comercial.</strong> '+esc(data.disclaimer)+'</div>'+
 '<div class="notice tiny"><strong>Como precificar:</strong> a SIURB serve como referência. Composição sem insumos comprovados fica bloqueada para aprovação. Para serviços próprios, informe uma cotação identificada, data, fornecedor, quantidades medidas e revise o BDI. Preços, tributos e premissas de teste não autorizam emissão contratual.</div>'+
 '<div class="grid"><div class="card"><div class="muted">Custo direto (serviços + extras)</div><div class="metric">'+fmt(est.direct_cost_reais)+'</div></div>'+
 '<div class="card"><div class="muted">BDI discriminado</div><div class="metric">'+fmt(est.bdi_amount_reais)+'</div><div class="muted tiny">'+esc(est.bdi_effective_pct)+'%</div></div>'+
 '<div class="card"><div class="muted">Contingência financeira</div><div class="metric">'+fmt(est.contingency_reais)+'</div></div>'+
 '<div class="card"><div class="muted">Preço calculado (não aprovado)</div><div class="metric">'+fmt(est.total_reais)+'</div></div>'+
 '<div class="card"><div class="muted">Pendências bloqueantes</div><div class="metric">'+esc(est.errors.length)+'</div></div>'+
 '<div class="card"><div class="muted">Conferência do cálculo</div><div class="metric">'+(ready?'Sem bloqueios':'Pendente')+'</div></div></div>'+
 '<div class="actions" style="margin-top:18px">'+rowButtons+'</div>'+
 '<div class="card"><h2>Serviços e evidências</h2><div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Fonte</th><th>Quantidade</th><th>Unitário direto</th><th>Medição</th><th>Ação</th></tr></thead><tbody>'+
 (tableRows||'<tr><td colspan="7">Adicione serviços com preço e fonte verificáveis.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="card"><h2>Outros custos diretos</h2><div class="table-wrap"><table><thead><tr><th>Custo</th><th>Valor</th><th>Critério</th><th>Ação</th></tr></thead><tbody>'+
 (rowsExtra||'<tr><td colspan="4">Sem custos extras registrados. Verifique frete, mobilização, descarte e equipamentos.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="card"><h2>Revisões e riscos</h2><p class="muted">BDI: '+esc(profile.bdi_reviewed?'Revisado':'Pendente')+' · Técnica: '+esc(profile.technical_reviewed?'Revisada':'Pendente')+' · Comercial: '+esc(profile.commercial_reviewed?'Revisada':'Pendente')+'</p>'+
 (est.errors.length?'<h2 class="danger">Impedimentos</h2><ul>'+errors+'</ul>':'<p class="ok">Sem erros matemáticos ou documentais identificados por esta rotina.</p>')+
 (est.warnings.length?'<h2>Avisos para avaliação</h2><ul>'+warnings+'</ul>':'')+
 '<h2>Sensibilidade de custos</h2><div class="table-wrap"><table><thead><tr><th>Aumento do custo direto</th><th>Novo custo</th><th>Diferença indicativa com preço fixo</th></tr></thead><tbody>'+
 est.scenarios.map(x=>'<tr><td>+'+esc(x.cost_increase_pct)+'%</td><td>'+fmt(x.estimated_direct_cost_reais)+'</td><td>'+fmt(x.contribution_reais)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="muted tiny">Essas diferenças não representam lucro líquido nem incluem automaticamente tributos, despesas de execução ou risco de prazo.</p></div>';
}
export function costDialog(action,{state,dialog,field,esc,writeable,toast}){
 const data=state.costs; if(!data){toast('Carregue o cálculo primeiro.',true);return true}
 if(action==='cost-bdi-form'){
   const p=data.config||{},bdi=p.bdi_components||{};
   const rates=fields.map(k=>field(labels[k]+' (%)',k,'number',true,bdi[k]??0,'step="0.01" min="0" max="99.99"')).join('');
   const allow=['administrador','revisor'].includes(state.user.role);
   const checks=checkbox('bdi_reviewed','BDI revisado por responsável habilitado',p.bdi_reviewed,!allow)+
     checkbox('technical_reviewed','Quantitativos e composição revisados',p.technical_reviewed,!allow)+
     checkbox('commercial_reviewed','Condições comerciais revisadas',p.commercial_reviewed,!allow);
   dialog('Composição analítica do BDI','<form id="cost-settings-form"><div class="two">'+rates+'</div>'+
      field('Contingência financeira (%)','contingency_pct','number',true,p.contingency_pct??0,'step="0.01" min="0" max="100"')+
      field('Memória de cálculo / justificativa das aprovações','review_notes','text',false,p.review_notes||'')+checks+
      '<div class="notice tiny">O BDI é calculado pela fórmula composta, não pela simples soma das parcelas. Não declare revisão sem conferir tributos e escopo.</div>'+
      '<div class="actions"><button class="btn primary" type="submit">Salvar composição do BDI</button><button class="btn" type="button" data-action="close-dialog">Cancelar</button></div></form>');
   return true;
 }
 if(action==='cost-add-extra'){
   const opts=Object.entries(categories).map(([id,label])=>'<option value="'+esc(id)+'">'+esc(label)+'</option>').join('');
   dialog('Adicionar custo direto extra','<form id="cost-extra-form"><div class="field"><label>Categoria</label><select name="category">'+opts+'</select></div>'+
     field('Descrição do custo','description','text',true)+field('Total estimado (R$)','amount','number',true,'','step="0.01" min="0"')+
     field('Fornecedor (se houver)','supplier_name')+field('Referência da cotação','quote_reference')+
     field('Data da cotação','quote_date','date')+
     checkbox('included_in_unit_prices','Já está incluso nos preços unitários? (gera bloqueio)')+
     '<div class="actions"><button class="btn primary" type="submit">Adicionar custo</button><button class="btn" data-action="close-dialog" type="button">Cancelar</button></div></form>');
   return true;
 }
 if(action==='cost-add-siurb'){
   dialog('Buscar serviço na SIURB — julho/2026','<form id="cost-siurb-search-form">'+
     field('Código ou descrição (mín. 2 caracteres)','q','text',true)+
     '<div class="field"><label>Categoria</label><select name="category"><option value="">Todas</option><option>Edificações</option><option>Infraestrutura</option></select></div>'+
     '<button class="btn primary" type="submit">Buscar preço oficial</button></form><div id="cost-search-results" class="table-wrap" style="margin-top:12px"></div>');
   return true;
 }
 return false;
}
export function costEvidenceDialog(id,{state,dialog,field,esc}){
 const x=state.costs?.items?.find(z=>z.id===id);
 if(!x)return false;
 const isOfficial=x.source==='SIURB'||!!x.reference_price_id;
 const source=x.source||'MANUAL';
 const options=['MANUAL','COTACAO',...(isOfficial?['SIURB']:[])].map(v=>'<option value="'+v+'" '+(source===v?'selected':'')+'>'+v+'</option>').join('');
 dialog('Evidência do serviço '+(x.source_code||''),'<form id="cost-evidence-form" data-id="'+esc(x.id)+'">'+
 '<p class="muted">Serviço: '+esc(x.source_name)+' · Unitário '+fmt(x.direct_unit_cost)+'</p>'+
 '<div class="field"><label>Fonte</label><select name="source">'+options+'</select></div>'+
 (isOfficial?'<p class="muted tiny">Preço oficial vinculado: '+esc(x.reference_price_id)+'</p>':'')+
 checkbox('quantity_verified','Quantidade conferida e memória de medição registrada',x.quantity_verified)+
 checkbox('composition_reviewed','Insumos da composição SIURB revisados',x.composition_reviewed)+
 checkbox('supplier_quote_verified','Cotação de fornecedor verificada',x.supplier_quote_verified)+
 field('Nome do fornecedor','supplier_name','text',false,x.supplier_name)+
 field('Referência/identificação da cotação','quote_reference','text',false,x.quote_reference)+
 field('Data da cotação','quote_date','date',false,x.quote_date?String(x.quote_date).slice(0,10):'')+
 field('Preço unitário da cotação','quote_unit_cost','number',false,x.quote_unit_cost??'','step="0.0001" min="0"')+
 '<div class="two">'+field('Perda (%)','loss_pct','number',true,x.loss_pct??0,'min="0" max="100" step="0.01"')+
 field('Frete por unidade (R$)','freight_unit_cost','number',true,x.freight_unit_cost??0,'min="0" step="0.0001"')+'</div>'+
 field('Outros custos por unidade (R$)','other_unit_cost','number',true,x.other_unit_cost??0,'min="0" step="0.0001"')+
 field('Observações técnicas','notes','text',false,x.notes??'')+
 '<p class="tiny muted">Revisões e aprovações registradas no histórico. Para serviços próprios, informe fornecedor e cotação rastreável.</p>'+
 '<div class="actions"><button class="btn primary" type="submit">Salvar evidência</button><button type="button" class="btn" data-action="close-dialog">Cancelar</button></div></form>');
 return true;
}
export async function costHandleForm(form,{state,api,esc,refresh,toast}){
 if(!form.id.startsWith('cost-'))return false;
 const data=Object.fromEntries(new FormData(form).entries()),id=state.detail?.id;
 if(form.id==='cost-siurb-search-form'){
   const params=new URLSearchParams({q:data.q,regime:state.detail?.regime||'',category:data.category||''});
   const rows=await api('siurb/search?'+params.toString());
   state.costCatalog=rows;
   const el=document.getElementById('cost-search-results');
   if(el)el.innerHTML=rows.length?'<table><thead><tr><th>Código e descrição</th><th>Preço</th><th>Categoria</th><th></th></tr></thead><tbody>'+
     rows.map(x=>'<tr><td><strong>'+esc(x.code)+'</strong> '+esc(x.description)+'</td><td>'+fmt(x.unit_cost)+'/'+esc(x.unit)+'</td><td>'+esc(x.category)+'</td>'+
       '<td><button class="btn" data-action="cost-select-siurb" data-id="'+esc(x.id)+'" type="button">Selecionar</button></td></tr>').join('')+'</tbody></table>':
     '<p>Nenhum serviço encontrado para o regime deste orçamento.</p>';
   return true;
 }
 if(!id)throw Error('Orçamento não selecionado');
 const version=state.costs.budget.lock_version;
 if(form.id==='cost-settings-form'){
   const bdi=Object.fromEntries(fields.map(k=>[k,data[k]]));
   await api('budgets/'+id+'/cost-settings','PUT',{lock_version:version,bdi,contingency_pct:data.contingency_pct,
     bdi_reviewed:!!data.bdi_reviewed,technical_reviewed:!!data.technical_reviewed,
     commercial_reviewed:!!data.commercial_reviewed,review_notes:data.review_notes});
 }else if(form.id==='cost-evidence-form'){
   const item=state.costs.items.find(x=>x.id===form.dataset.id);
   await api('budgets/'+id+'/cost-review/'+form.dataset.id,'PUT',{
     ...data,lock_version:version,source:data.source,reference_price_id:item.reference_price_id||null,
     quantity_verified:!!data.quantity_verified,composition_reviewed:!!data.composition_reviewed,
     supplier_quote_verified:!!data.supplier_quote_verified,quote_unit_cost:data.quote_unit_cost||null
   });
 }else if(form.id==='cost-extra-form'){
   await api('budgets/'+id+'/extra-costs','POST',{...data,lock_version:version,included_in_unit_prices:!!data.included_in_unit_prices,quote_date:data.quote_date||null});
 }else if(form.id==='cost-siurb-add-form'){
   await api('budgets/'+id+'/siurb-items','POST',{lock_version:version,reference_price_id:data.reference_price_id,
     position:Number(data.position),quantity:data.quantity});
 }else return false;
 document.querySelector('#secure-dialog')?.remove();await refresh();toast('Custos atualizados e conferência recalculada.');return true;
}
export async function costHandleClick(btn,{state,api,dialog,field,esc,refresh,toast}){
 const act=btn.dataset.action;
 if(act==='cost-composition'){
   const x=await api('siurb/'+btn.dataset.id+'/composition');
   const labor=(x.labor||[]).map(z=>'<tr><td>'+esc(z.code||'')+'</td><td>'+esc(z.name||'')+'</td><td>'+esc(z.unit||'')+'</td><td>'+esc(z.coef||'')+'</td></tr>').join('');
   const other=(x.other||[]).map(z=>'<tr><td>'+esc(z.code||'')+'</td><td>'+esc(z.name||'')+'</td><td>'+esc(z.unit||'')+'</td><td>'+esc(z.coef||'')+'</td></tr>').join('');
   const table=rows=>'<div class="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Unidade</th><th>Coeficiente</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">Nenhum item direto listado</td></tr>')+'</tbody></table></div>';
   const audit=x.inspection||{};
   const audited=(audit.nodes||[]).map(z=>'<tr><td>'+esc(z.path||z.code)+'</td><td>'+esc(z.kind)+'</td><td>'+esc(z.unit)+'</td><td>'+esc(z.coefficient)+'</td><td>'+esc(z.status)+'</td></tr>').join('');
   const auditTable='<h2>Auditoria de auxiliares e insumos</h2><p class="notice"><strong>Não homologada para custo comercial.</strong> Componentes sem preço reconciliado: '+esc(audit.unpriced_components??'não apurado')+'. Esta lista não substitui a planilha oficial de insumos e mão de obra.</p>'+
     '<div class="table-wrap"><table><thead><tr><th>Cadeia</th><th>Grupo</th><th>Unidade</th><th>Coeficiente</th><th>Verificação</th></tr></thead><tbody>'+ (audited||'<tr><td colspan="5">Composição sem componentes verificáveis</td></tr>')+'</tbody></table></div>';
   dialog('Composição SIURB '+x.code,'<p><strong>'+esc(x.description)+'</strong></p>'+
      '<p class="notice">'+esc(x.notice)+'</p>'+
      '<p><strong>Hora-homem direta:</strong> '+esc(x.direct_hh_per_unit??'não informada')+' h-h/'+esc(x.unit)+'</p>'+
      '<h2>Profissionais</h2>'+table(labor)+'<h2>Materiais, equipamentos e auxiliares</h2>'+table(other)+
      '<p class="tiny muted">Horas de equipamentos não são horas-homem. Verifique complementos e critérios de medição antes de aprovar.</p>'+
      auditTable+
      '<button class="btn" type="button" data-action="close-dialog">Fechar</button>');
   return true;
 }
 if(act==='cost-select-siurb'){
   const row=state.costCatalog?.find(x=>x.id===btn.dataset.id);
   if(!row)throw Error('Seleção expirada; pesquise novamente.');
   const position=(state.costs.items||[]).length+1;
   dialog('Adicionar serviço oficial','<form id="cost-siurb-add-form">'+
      '<p>'+esc(row.code)+' — '+esc(row.description)+'</p><p><strong>'+fmt(row.unit_cost)+'</strong> / '+esc(row.unit)+'</p>'+
      '<input type="hidden" name="reference_price_id" value="'+esc(row.id)+'">'+
      field('Quantidade medida','quantity','number',true,'1','min="0.000001" step="0.000001"')+
      field('Posição no orçamento','position','number',true,position,'min="1" step="1"')+
      '<div class="actions"><button class="btn primary" type="submit">Adicionar ao orçamento</button><button class="btn" type="button" data-action="close-dialog">Cancelar</button></div></form>');
   return true;
 }
 if(act==='cost-remove-extra'){
   if(!window.confirm('Remover custo extra? A ação será registrada no histórico.'))return true;
   await api('budgets/'+state.detail.id+'/extra-costs/'+btn.dataset.id,'DELETE',{lock_version:state.costs.budget.lock_version});
   await refresh();toast('Custo adicional removido do cálculo.');return true;
 }
 return false;
}
