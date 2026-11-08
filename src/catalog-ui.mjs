// Interface do catálogo próprio — coeficientes SINAPI entram por função, nunca preço SINAPI.
import {CATALOG_SECTIONS,catalogRows,catalogReady,catalogHours,catalogStats} from './service-catalog.mjs';
import {icon,e} from './views.mjs';
import {brl} from './calc.mjs';
const opt=(v,label,current)=>'<option value="'+e(v)+'"'+(String(v)===String(current)?' selected':'')+'>'+e(label)+'</option>';
export function catalogView(data,category='01',back='budgets'){
 const entries=catalogRows(data.catalog);
 const list=entries.filter(x=>x.category===category);
 const stats=catalogStats(data.catalog);
 return '<section class="fin-screen catalog-screen">'+
 '<div class="page-heading"><button class="small-square" data-go="'+back+'" aria-label="Voltar">'+icon('back',23)+'</button>'+
 '<h1>Catálogo CIVOLTEN</h1><span class="small-square is-empty"></span></div>'+
 '<p class="fin-intro">Serviços próprios da fundação à entrega. A produtividade por função pode ser informada com os coeficientes HH/un da composição analítica SINAPI, usando o custo interno da empresa.</p>'+
 '<div class="catalog-status"><b>'+stats.total+' serviços</b><b>'+stats.ready+' configurados</b><span>'+stats.pending+' sem produtividade/custo completo</span></div>'+
 '<p class="cost-pending-note">'+icon('clipboard',16)+' Nenhuma produtividade SINAPI foi presumida. Preencha o coeficiente de cada profissional e a competência da composição. Um serviço só entra no orçamento após ser configurado.</p>'+
 '<label class="modal-field catalog-category"><span>Etapa da obra</span><select id="catalog-category">'+
 CATALOG_SECTIONS.map(s=>opt(s.id,s.id+' · '+s.title+' ('+s.count+')',category)).join('')+
 '</select></label>'+
 '<label class="catalog-filter"><span>Buscar serviço da etapa</span><input id="catalog-search" placeholder="Filtrar por nome ou código" type="search" autocomplete="off"></label>'+
 '<div class="catalog-list">'+list.map(x=>{
  const ready=catalogReady(x),hh=catalogHours(x);
  const roles=x.roles?.length?x.roles.map(r=>e(r.role)+' '+e(r.hours)+' HH/'+e(x.unit)).join(' · '):'Produtividade ainda não informada';
  const value=ready?'HH por '+e(x.unit)+': '+e(hh.toLocaleString('pt-BR'))+' · custo direto '+brl(Math.round(x.directCost*100)):'Preencher produtividade e custo interno';
  const search=(x.description+' '+x.code).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return '<button class="catalog-row" data-action="catalog-edit" data-code="'+e(x.code)+'" data-catalog-search="'+e(search)+'" type="button">'+
   '<span class="catalog-row-head"><b>'+e(x.description)+'</b><small>'+e(x.code)+' · '+e(x.unit)+'</small></span>'+
   '<span class="catalog-row-coeff">'+roles+'</span>'+
   '<span class="'+(ready?'catalog-row-ready':'catalog-row-pending')+'">'+value+'</span>'+
   (x.source==='sinapi'&&x.sinapiCode?'<small>Referência informada: SINAPI '+e(x.sinapiCode)+' · '+e(x.referenceMonth)+' (conferir)</small>':'')+
   '</button>';
 }).join('')+'</div>'+
 '<p class="fin-helper">Produtividade SINAPI é por função e composição, não uma medição individual de funcionário. Após executar a obra, poderão ser medidos os resultados de cada equipe.</p>'+
 '<div class="fin-link-row"><button type="button" data-go="budget-edit">Voltar ao orçamento '+icon('chevron',17)+'</button></div></section>';
}
const textField=(label,name,value='',type='text',extra='')=>
 '<label class="modal-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" value="'+e(value??'')+'" '+
 (type==='number'?'step="any" min="0" inputmode="decimal" ':'')+extra+'></label>';
export function catalogEditorDialog(item){
 const roles=Array.isArray(item.roles)?item.roles:[];
 const coefficient=(i)=>'<div class="catalog-role-grid">'+
  textField('Função / profissional '+i,'role'+i,roles[i-1]?.role||'','text','maxlength="80" placeholder="Ex.: eletricista"')+
  textField('Coeficiente HH por '+e(item.unit),'hours'+i,roles[i-1]?.hours??'','number','max="10000"')+'</div>';
 const source=item.source==='sinapi'?'sinapi':'internal';
 return '<div class="modal-inner catalog-editor"><div class="modal-heading"><h2 id="catalog-form-title">Produtividade do serviço</h2>'+
 '<button type="button" class="small-square" data-action="close-modal" aria-label="Fechar">×</button></div>'+
 '<form id="catalog-form" aria-labelledby="catalog-form-title">'+
 '<p class="helper-text">Código CIVOLTEN: '+e(item.code)+'. Os valores abaixo são salvos apenas na sua conta e podem ser revisados depois.</p>'+
 textField('Descrição','description',item.description,'text','maxlength="180" required')+
 textField('Unidade de medida','unit',item.unit,'text','maxlength="20" required')+
 '<label class="modal-field"><span>Origem da produtividade</span><select name="source">'+
 opt('internal','Base própria CIVOLTEN',source)+
 opt('sinapi','Coeficientes consultados no SINAPI',source)+'</select></label>'+
 textField('Código da composição SINAPI (se utilizado)','sinapiCode',item.sinapiCode||'','text','maxlength="48" placeholder="Código oficial da composição"')+
 textField('Competência de referência (AAAA-MM)','referenceMonth',item.referenceMonth||'','month','')+
 '<p class="helper-text">Os coeficientes são horas-homem por unidade para cada função. Copie os valores da composição analítica correspondente ao método de execução e depois confira no caderno técnico da CAIXA.</p>'+
 coefficient(1)+coefficient(2)+coefficient(3)+
 textField('Custo direto interno por '+e(item.unit)+' (R$)','directCost',item.directCost??'','number','max="999999999" placeholder="0 se não houver material/equipamento"')+
 '<p class="helper-text">Este custo direto não inclui salários/encargos já considerados nos custos mensais da CIVOLTEN. Se não houver materiais ou equipamentos, informe 0.</p>'+
 '<p class="form-error" id="catalog-form-error" role="alert" hidden></p>'+
 '<div class="modal-buttons"><button class="outlined-button" type="button" data-action="close-modal">Cancelar</button>'+
 '<button class="gold-button" type="submit">'+icon('check',18)+' Salvar no Supabase</button></div>'+
 '</form></div>';
}
