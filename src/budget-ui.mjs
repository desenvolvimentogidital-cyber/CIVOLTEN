// Interface responsiva de orçamento demonstrativo. Sem consulta à SINAPI/SIURB.
import {summary,brl} from './calc.mjs';
import {priceBudget,DEMO_SERVICES} from './budget.mjs';
import {icon,e} from './views.mjs';
import {printableBudget} from './budget-print.mjs';
const money=brl;
const dateBR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'Não definida';
const header=(text,back)=>'<div class="page-heading"><button type="button" class="small-square" data-go="'+back+'" aria-label="Voltar">'+
 icon('back',22)+'</button><h1>'+text+'</h1><span class="small-square is-empty"></span></div>';
const field=(label,name,value='',type='text',params='')=>
 '<label class="modal-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" data-budget-field="'+name+'" value="'+e(value??'')+'" '+
 (type==='number'?'inputmode="decimal" step="any" min="0" ':'')+params+'></label>';
const textarea=(label,name,value='')=>'<label class="modal-field"><span>'+label+'</span><textarea name="'+name+
 '" data-budget-field="'+name+'" rows="3">'+e(value)+'</textarea></label>';
const m=(value,highlight=false)=>'<div class="fin-kpi'+(highlight?' fin-kpi-featured':'')+'"><span>'+value[0]+'</span><strong>'+value[1]+'</strong></div>';
const status=()=>'<span class="budget-demo-flag">'+icon('wrench',15)+' Demonstração · sem tabela oficial</span>';
function error(msg){return '<p class="form-error" role="alert">'+e(msg)+'</p>';}
export function budgetsView(data){
 const rows=(data.budgets||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 return '<section class="fin-screen budget-screen">'+header('Orçamentos','home')+
 status()+
 '<p class="fin-intro">Monte orçamentos com serviços fictícios para testar o fluxo. Os preços usam a base de custo e o imposto/lucro configurados na empresa. Os exemplos não são SINAPI nem SIURB.</p>'+
 '<button class="gold-button budget-new-button" type="button" data-action="budget-new">'+icon('plus',22)+' Novo orçamento de teste</button>'+
 (rows.length?'<div class="budget-list">'+rows.map(b=>{
  let price=null;try{price=priceBudget(b)}catch{/* registros antigos devem continuar acessíveis */}
  return '<button class="budget-list-item" type="button" data-action="budget-open" data-id="'+e(b.id)+'">'+
   '<span class="budget-list-icon">'+icon('clipboard',22)+'</span>'+
   '<span class="budget-list-copy"><b>'+e(b.title)+'</b><small>'+e(b.customer||'Cliente não informado')+
   '</small><em>'+b.items.length+' serviço(s) · '+dateBR(b.createdAt?.slice(0,10))+'</em></span>'+
   '<span class="budget-list-total"><strong>'+(price?money(price.totalSale):'Sem preço')+'</strong>'+
   '<small>Rascunho</small></span></button>';
 }).join('')+'</div>':
 '<div class="fin-empty">Nenhum orçamento salvo. Os serviços de exemplo aparecem somente quando você cria um novo rascunho.</div>')+
 '<div class="fin-link-row"><button type="button" data-go="company">Ajustar precificação '+icon('chevron',17)+'</button></div></section>';
}
function itemRow(item,index){
 const quantity=Number(item.quantity).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const hours=Number(item.laborHours).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const cost=money(Math.round(Number(item.directCost)*100));
 return '<article class="budget-item budget-item-compact" data-budget-item="'+e(item.id)+'">'+
  '<div class="budget-item-top"><span>'+e(item.sourceCode||'PERSONALIZADO')+' · item '+(index+1)+'</span>'+
  '<button type="button" class="budget-remove" data-action="budget-remove-item" data-id="'+e(item.id)+'" aria-label="Remover serviço">'+icon('trash',16)+' Remover</button></div>'+
  '<h3>'+e(item.description)+'</h3>'+
  '<p class="budget-item-summary">'+quantity+' '+e(item.unit)+' · '+hours+' h/un. · custo direto/un. '+cost+'</p>'+
  '<button type="button" class="budget-item-edit" data-action="budget-edit-item" data-id="'+e(item.id)+'">'+icon('edit',16)+' Editar serviço</button>'+
  '</article>';
}
const serviceField=(label,name,value,type='text',params='')=>
 '<label class="modal-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+e(value??'')+'" '+
 (type==='number'?'inputmode="decimal" min="0" step="any" ':'')+params+'></label>';
export function budgetServiceDialog(service,editing=false){
 return '<div class="modal-inner budget-service-modal">'+
 '<div class="modal-heading"><h2 id="budget-service-title">'+(editing?'Editar serviço':'Adicionar serviço')+'</h2>'+
 '<button type="button" class="small-square" data-action="close-modal" aria-label="Fechar formulário">×</button></div>'+
 '<p class="helper-text">Preencha o serviço aqui mesmo. Ele só entra no orçamento quando você confirmar.</p>'+
 '<form id="budget-service-form" aria-labelledby="budget-service-title">'+
 '<div class="modal-fields">'+
 serviceField('Descrição do serviço','description',service.description,'text','maxlength="180" required')+
 '<div class="budget-service-grid">'+
 serviceField('Unidade','unit',service.unit,'text','maxlength="20" required')+
 serviceField('Quantidade','quantity',service.quantity,'number','max="100000" required')+
 serviceField('Horas por unidade','laborHours',service.laborHours,'number','max="10000" required')+
 serviceField('Custo direto por unidade (R$)','directCost',service.directCost,'number','max="999999999" required')+
 '</div></div>'+
 '<p id="budget-service-error" class="form-error" role="alert" hidden></p>'+
 '<div class="modal-buttons">'+
 '<button type="button" class="outlined-button" data-action="close-modal">Cancelar</button>'+
 '<button type="submit" class="gold-button">'+icon('check',18)+(editing?' Salvar alterações':' Adicionar serviço')+'</button>'+
 '</div></form></div>';
}
const preview=(draft)=>{
 let p;try{p=priceBudget(draft)}catch(err){return error(err.message||'Dados de serviço inválidos.');}
 if(!p)return '<div class="fin-empty">Preço ainda indisponível. Conclua o custo mensal e as configurações em Mais → Empresa e precificação; depois use “Atualizar base de preços”. Você pode salvar o rascunho sem valores.</div>';
 return '<div class="fin-kpi-grid">'+
 m(['Custo total estimado',money(p.totalCost)])+
 m(['Preço final para o cliente',money(p.totalSale)],true)+
 m(['Impostos estimados',money(p.totalTax)])+
 m(['Lucro gerencial',money(p.profit)])+'</div>'+
 '<div class="budget-overview"><div>Horas de mão de obra <b>'+p.totalHours.toLocaleString('pt-BR')+' h</b></div>'+
 '<div>Alíquota aplicada <b>'+e(p.snapshot.taxPct)+'%</b></div>'+
 '<div>Margem desejada <b>'+e(p.snapshot.marginPct)+'%</b></div>'+
 '<div>Base congelada em <b>'+dateBR(p.snapshot.capturedOn)+'</b></div></div>'+
 '<div class="budget-priced-items">'+p.rows.map(row=>'<div><span>'+e(row.description)+'<small>'+e(row.quantity)+' '+e(row.unit)+'</small></span>'+
 '<strong>'+money(row.selling)+'</strong></div>').join('')+'</div>';
};
export function budgetPreview(draft){return preview(draft);}
export function budgetEditorView(data,draft,err=''){
 if(!draft)return budgetsView(data);
 let priced=false;try{priced=!!priceBudget(draft)}catch{/* mostrar erro no preview */}
 return '<section class="fin-screen budget-screen budget-editor">'+header('Montar orçamento','budgets')+
 status()+
 '<form id="budget-form" class="budget-form" novalidate>'+
 '<div class="budget-editor-head"><span>Rascunho · '+(draft.id?'edição':'novo')+'</span>'+
 '<p>Ao salvar, o orçamento fica privado na sua conta. Os itens e custos não alteram Financeiro, contratos ou estoque.</p></div>'+
 field('Título do orçamento','title',draft.title,'text','maxlength="180" required')+
 field('Cliente','customer',draft.customer,'text','maxlength="180" required')+
 field('Obra / projeto','project',draft.project,'text','maxlength="180"')+
 field('Local da obra','location',draft.location,'text','maxlength="240"')+
 field('Validade da proposta','expiresOn',draft.expiresOn||'','date')+
 textarea('Observações','notes',draft.notes)+
 '<div class="budget-section-heading"><h2>Condições comerciais</h2></div>'+ 
 '<p class="fin-helper">São exibidas somente na última página da proposta. Preencha condições reais; campos vazios serão marcados como a definir, sem inventar prazos ou garantias.</p>'+ 
 textarea('Condições de pagamento','paymentTerms',draft.commercial?.paymentTerms||'')+
 textarea('Prazo de execução','executionTerm',draft.commercial?.executionTerm||'')+
 textarea('Garantia dos serviços','warrantyTerms',draft.commercial?.warrantyTerms||'')+
 textarea('Escopo e exclusões','scopeNotes',draft.commercial?.scopeNotes||'')+
 field('Contato comercial da empresa (opcional)','companyContact',draft.commercial?.companyContact||'','text','maxlength="200"')+
 field('CNPJ ou identificação da empresa (opcional)','companyDocument',draft.commercial?.companyDocument||'','text','maxlength="40"')+
 '<div class="budget-section-heading"><h2>Serviços</h2><span>'+draft.items.length+' item(ns)</span></div>'+
 '<div class="budget-picker"><label class="modal-field"><span>Adicionar serviço fictício</span>'+
 '<select id="budget-catalog" aria-label="Catálogo de teste">'+DEMO_SERVICES.map(x=>
 '<option value="'+x.code+'">'+e(x.code)+' · '+e(x.description)+'</option>').join('')+
 '<option value="manual">Serviço personalizado de teste</option></select></label>'+
 '<button type="button" class="outlined-button" data-action="budget-add-item">'+icon('plus',19)+' Abrir formulário</button></div>'+
 '<p class="fin-helper">Toque em Adicionar para preencher o serviço em um formulário. Serviços incluídos podem ser editados pelo botão Editar. As estimativas do catálogo são fictícias, não são valores oficiais de engenharia.</p>'+
 (draft.items.length?'<div class="budget-items">'+draft.items.map(itemRow).join('')+'</div>':
 '<div class="fin-empty">Inclua ao menos um serviço para salvar o orçamento.</div>')+
 '<div class="budget-section-heading"><h2>Formação do preço</h2></div>'+
 (summary(data).missing?'<p class="fin-helper cost-pending-note">Atenção: '+summary(data).missing+' custo(s) da empresa ainda estão a preencher. O cálculo usa somente os valores cadastrados; revise antes de enviar proposta definitiva.</p>':'')+
 (summary(data).assumedQuantities?'<p class="fin-helper cost-pending-note">'+summary(data).assumedQuantities+' custo(s) variáveis estão incluídos com 1 unidade/mês como padrão. Revise as quantidades antes de enviar a proposta.</p>':'')+
 '<p class="fin-helper">O preço utiliza a fotografia do custo mensal, capacidade produtiva, alíquota e margem salvos no rascunho. Mudanças na configuração geral não modificam os orçamentos antigos automaticamente.</p>'+
 '<button type="button" data-action="budget-refresh-pricing" class="budget-refresh">'+icon('chart',18)+' Atualizar base de preços</button>'+
 '<div id="budget-price-preview" aria-live="polite">'+preview(draft)+'</div>'+
 (err?error(err):'')+
 '<button class="gold-button budget-save-button" type="submit">'+icon('check',19)+' Salvar rascunho</button></form>'+
 '<div class="budget-secondary-actions"><button type="button" class="outlined-button" data-action="budget-print"'+(priced?'':' disabled')+'>'+icon('file',18)+' Visualizar / PDF</button>'+
 '<button type="button" class="outlined-button" data-action="budget-export"'+(priced?'':' disabled')+'>'+icon('file',18)+' Exportar CSV</button></div>'+ 
 '<p class="budget-pdf-model-label">'+icon('check',15)+' Proposta Signature · 3 páginas · CIVOLTEN</p>'+
 (draft.id?'<button type="button" class="fin-delete" data-action="budget-delete">'+icon('trash',18)+' Excluir orçamento</button>':'')+
 '<div class="fin-link-row"><button type="button" data-go="company">Configurar custo, imposto e margem '+icon('chevron',17)+'</button></div>'+
 printableBudget(draft)+'</section>';
}
