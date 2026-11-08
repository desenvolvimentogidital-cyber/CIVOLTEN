// Interface responsiva de orçamento demonstrativo. Sem consulta à SINAPI/SIURB.
import {summary,brl} from './calc.mjs';
import {priceBudget,DEMO_SERVICES} from './budget.mjs';
import {icon,e} from './views.mjs';
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
 return '<article class="budget-item" data-budget-item="'+e(item.id)+'">'+
  '<div class="budget-item-top"><span>'+e(item.sourceCode||'PERSONALIZADO')+' · item '+(index+1)+'</span>'+
  '<button type="button" class="budget-remove" data-action="budget-remove-item" data-id="'+e(item.id)+'" aria-label="Remover serviço">'+icon('trash',16)+' Remover</button></div>'+
  field('Descrição do serviço','description',item.description,'text','maxlength="180" required')+
  '<div class="budget-item-fields">'+field('Unidade','unit',item.unit,'text','maxlength="20" required')+
  field('Quantidade','quantity',item.quantity,'number','max="100000" required')+
  field('Horas/unidade','laborHours',item.laborHours,'number','max="10000" required')+
  field('Custo direto/un. (R$)','directCost',item.directCost,'number','max="999999999" required')+'</div></article>';
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
function printable(b){
 let p;try{p=priceBudget(b)}catch{return '';}
 if(!p)return '';
 return '<div class="budget-print"><header><h1>'+e(p.snapshot.companyName||'CIVOLTEN')+'</h1>'+
 '<h2>ORÇAMENTO DEMONSTRATIVO — NÃO ENVIAR AO CLIENTE</h2>'+
 '<p>Serviços fictícios utilizados apenas para validação do sistema.</p></header>'+
 '<section class="budget-print-details"><p><b>Proposta:</b> '+e(b.title)+'</p><p><b>Cliente:</b> '+e(b.customer||'—')+
 '</p><p><b>Obra:</b> '+e(b.project||'—')+'</p><p><b>Local:</b> '+e(b.location||'—')+
 '</p><p><b>Validade:</b> '+dateBR(b.expiresOn)+'</p></section>'+
 '<table><thead><tr><th>Serviço</th><th>Qtd.</th><th>Un.</th><th>Preço total</th></tr></thead><tbody>'+
 p.rows.map(item=>'<tr><td>'+e(item.description)+'</td><td>'+e(item.quantity)+'</td><td>'+e(item.unit)+
 '</td><td>'+money(item.selling)+'</td></tr>').join('')+'</tbody></table>'+
 '<p class="budget-print-total">TOTAL: '+money(p.totalSale)+'</p>'+
 '<p class="budget-print-notes">'+e(b.notes||'')+'</p>'+
 '<footer>DOCUMENTO DE TESTE. Não é proposta comercial válida nem contém referência oficial de preços.</footer></div>';
}
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
 '<div class="budget-section-heading"><h2>Serviços</h2><span>'+draft.items.length+' item(ns)</span></div>'+
 '<div class="budget-picker"><label class="modal-field"><span>Adicionar serviço fictício</span>'+
 '<select id="budget-catalog" aria-label="Catálogo de teste">'+DEMO_SERVICES.map(x=>
 '<option value="'+x.code+'">'+e(x.code)+' · '+e(x.description)+'</option>').join('')+
 '<option value="manual">Serviço personalizado de teste</option></select></label>'+
 '<button type="button" class="outlined-button" data-action="budget-add-item">'+icon('plus',19)+' Adicionar</button></div>'+
 '<p class="fin-helper">Quantidades, horas e custos diretos são editáveis. As estimativas do catálogo são inventadas para teste, não são valores oficiais de engenharia.</p>'+
 (draft.items.length?'<div class="budget-items">'+draft.items.map(itemRow).join('')+'</div>':
 '<div class="fin-empty">Inclua ao menos um serviço para salvar o orçamento.</div>')+
 '<div class="budget-section-heading"><h2>Formação do preço</h2></div>'+
 '<p class="fin-helper">O preço utiliza a fotografia do custo mensal, capacidade produtiva, alíquota e margem salvos no rascunho. Mudanças na configuração geral não modificam os orçamentos antigos automaticamente.</p>'+
 '<button type="button" data-action="budget-refresh-pricing" class="budget-refresh">'+icon('chart',18)+' Atualizar base de preços</button>'+
 '<div id="budget-price-preview" aria-live="polite">'+preview(draft)+'</div>'+
 (err?error(err):'')+
 '<button class="gold-button budget-save-button" type="submit">'+icon('check',19)+' Salvar rascunho</button></form>'+
 '<div class="budget-secondary-actions"><button type="button" class="outlined-button" data-action="budget-print"'+(priced?'':' disabled')+'>'+icon('file',18)+' Visualizar / PDF</button>'+
 '<button type="button" class="outlined-button" data-action="budget-export"'+(priced?'':' disabled')+'>'+icon('file',18)+' Exportar CSV</button></div>'+
 (draft.id?'<button type="button" class="fin-delete" data-action="budget-delete">'+icon('trash',18)+' Excluir orçamento</button>':'')+
 '<div class="fin-link-row"><button type="button" data-go="company">Configurar custo, imposto e margem '+icon('chevron',17)+'</button></div>'+
 printable(draft)+'</section>';
}
