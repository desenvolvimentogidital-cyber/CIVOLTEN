// Catalogo tecnico importado pelo usuario: sem dados de exemplo ou precos oficiais.
import {catalogRows,catalogReady,catalogHours,catalogStats} from './service-catalog.mjs';
import {FIELD_NAMES} from './catalog-import.mjs';
import {icon,e} from './views.mjs';
import {brl} from './calc.mjs';
const opt=(value,label,current)=>'<option value="'+e(value)+'"'+(String(value)===String(current)?' selected':'')+'>'+e(label)+'</option>';
const field=(label,name,value='',type='text',extra='')=>
 '<label class="modal-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" value="'+e(value??'')+'" '+extra+'></label>';
function importer(importData){
 let html='<section class="catalog-import"><h2>Importar tabela SIURB ou SINAPI</h2>'+
 '<p class="fin-helper">Selecione o arquivo oficial XLS, XLSX ou CSV. O processamento e feito no seu aparelho. Nao importamos precos: somente codigos, servicos, unidades e coeficientes HH quando existirem e forem mapeados.</p>'+
 '<div class="catalog-import-fields">'+
 '<label class="modal-field"><span>Fonte oficial</span><select id="catalog-import-source">'+
 opt('siurb','SIURB · Prefeitura de Sao Paulo',importData?.source||'siurb')+
 opt('sinapi','SINAPI · CAIXA',importData?.source||'siurb')+'</select></label>'+
 '<label class="modal-field"><span>Competencia da planilha</span><input type="month" id="catalog-import-month" value="'+e(importData?.month||'')+'" required></label>'+
 '<label class="modal-field"><span>Arquivo XLS, XLSX, CSV ou TSV</span><input type="file" id="catalog-import-file" accept=".xls,.xlsx,.csv,.tsv,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"></label></div>';
 if(!importData?.sheets?.length)return html+
 '<p class="fin-helper">Use a planilha de composicoes para obter coeficientes de mao de obra. Arquivos Excel .xls da SIURB sao identificados e organizados automaticamente. Em planilhas so de custos unitarios, a produtividade pode nao estar presente.</p></section>';
 const sheet=importData.sheets[importData.selectedSheet]||importData.sheets[0];
 const header=sheet.rows[importData.headerIndex]||[];
 const columns=Math.min(45,Math.max(header.length,...sheet.rows.slice(0,15).map(row=>row.length),0));
 const labels=Array.from({length:columns},(_,i)=>String.fromCharCode(65+i%26)+(i>=26?' (coluna '+(i+1)+')':'')+
  ' · '+String(header[i]??'').slice(0,50));
 html+='<p class="fin-helper">Arquivo carregado: <b>'+e(importData.fileName)+'</b>. Confira abaixo as colunas antes de salvar.</p>'+
 '<label class="modal-field"><span>Aba da planilha</span><select id="catalog-import-sheet">'+
 importData.sheets.map((s,i)=>opt(i,s.name+' ('+s.rows.length+' linhas)',importData.selectedSheet)).join('')+'</select></label>'+
 '<label class="modal-field"><span>Linha dos cabecalhos (a partir de 1)</span><input type="number" min="1" max="'+Math.min(30,sheet.rows.length)+'" id="catalog-import-header" value="'+(importData.headerIndex+1)+'"></label>'+
 '<div class="catalog-import-map">'+FIELD_NAMES.map(([name,label])=>
 '<label class="modal-field"><span>'+e(label)+'</span><select data-catalog-map="'+e(name)+'">'+
 opt(-1,'Nao importar este campo',importData.mapping[name])+
 labels.map((label,i)=>opt(i,label,importData.mapping[name])).join('')+'</select></label>').join('')+'</div>'+
 '<p class="fin-helper">Confira se as colunas estao corretas. Para horas, use SOMENTE coeficientes de mao de obra por funcao; nunca selecione coluna de preco, material ou total. Se o arquivo nao trouxer HH/un separado, deixe as colunas opcionais sem mapear.</p>'+
 '<button class="gold-button" type="button" data-action="catalog-import-save">'+icon('check',18)+' Importar servicos no Supabase</button>';
 const example=sheet.rows.slice(importData.headerIndex+1,importData.headerIndex+4);
 html+='<div class="catalog-sample"><strong>Amostra de linhas para conferencia</strong>'+
 example.map(row=>'<p>'+row.slice(0,Math.min(columns,7)).map(x=>e(String(x??'').slice(0,100))).join(' | ')+'</p>').join('')+'</div>';
 return html+'</section>';
}
export function catalogView(data,category='all',back='budgets',importData=null,search=''){
 const entries=catalogRows(data.catalog),stats=catalogStats(data.catalog);
 const groups=[...new Set(entries.map(x=>x.category||x.source?.toUpperCase()||'Outros'))].sort();
 const filtered=entries.filter(x=>(category==='all'||x.category===category)&&
  (x.description+' '+x.code+' '+x.sinapiCode).normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .includes(String(search||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
 const rows=filtered.slice(0,150);
 return '<section class="fin-screen catalog-screen">'+
 '<div class="page-heading"><button class="small-square" data-go="'+e(back)+'" aria-label="Voltar">'+icon('back',23)+'</button>'+
 '<h1>Catalogo tecnico CIVOLTEN</h1><span class="small-square is-empty"></span></div>'+
 '<p class="fin-intro">Catalogo vazio por padrao. Somente os servicos importados por voce entram aqui. O custo da proposta continua sendo calculado com os dados da CIVOLTEN.</p>'+
 '<div class="catalog-status"><b>'+stats.total+' servicos</b><b>'+stats.ready+' com produtividade</b><span>'+stats.pending+' sem HH</span></div>'+
 importer(importData)+
 (entries.length?
 '<label class="modal-field catalog-category"><span>Grupo ou fonte</span><select id="catalog-category">'+opt('all','Todos os importados ('+entries.length+')',category)+
 groups.map(g=>opt(g,g+' ('+entries.filter(x=>x.category===g).length+')',category)).join('')+'</select></label>'+
 '<label class="catalog-filter"><span>Buscar por codigo ou nome</span><input id="catalog-search" type="search" placeholder="Pesquisar servico" autocomplete="off" value="'+e(search)+'"></label>'+
 '<p class="fin-helper">Exibindo '+rows.length+' de '+filtered.length+
 ' servicos encontrados. Pesquise por nome ou codigo para localizar qualquer outro.</p>'+
 '<div class="catalog-list">'+rows.map(x=>{
  const ready=catalogReady(x),hh=catalogHours(x);
  const search=(x.description+' '+x.code+' '+x.sinapiCode).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return '<button class="catalog-row" type="button" data-action="catalog-edit" data-code="'+e(x.code)+'" data-catalog-search="'+e(search)+'">'+
   '<span class="catalog-row-head"><b>'+e(x.description)+'</b><small>'+e(x.source.toUpperCase())+' '+e(x.sinapiCode||x.code)+' · unidade '+e(x.unit)+'</small></span>'+
   '<span class="catalog-row-coeff">'+(hh===null?'HH nao configurado':e(String(hh))+' HH/'+e(x.unit))+'</span>'+
   '<span class="'+(ready?'catalog-row-ready':'catalog-row-pending')+'">'+
   (ready?'Produtividade disponível':'Revise produtividade HH/un')+'</span></button>';
 }).join('')+'</div>':
 '<div class="fin-empty">Nenhum servico cadastrado. Importe o XLS, XLSX ou CSV SIURB ou SINAPI acima para iniciar.</div>')+
 '<p class="fin-helper">A importacao nao altera funcionarios, contratos, custos mensais nem orcamentos ja salvos. Servicos antigos permanecem somente dentro dos orcamentos historicos.</p>'+
 '<button class="outlined-button" type="button" data-go="'+e(back)+'">Voltar</button></section>';
}
export function catalogEditorDialog(item){
 const roles=(item.roles||[]).map(r=>r.role+'; '+r.hours).join('\n');
 return '<div class="modal-inner catalog-editor"><div class="modal-heading"><h2 id="catalog-form-title">Revisar servico importado</h2>'+
 '<button class="small-square" type="button" data-action="close-modal" aria-label="Fechar">×</button></div>'+
 '<form id="catalog-form" aria-labelledby="catalog-form-title">'+
 '<p class="helper-text">Origem '+e(item.source.toUpperCase())+' · codigo '+e(item.sinapiCode||item.code)+' · competencia '+e(item.referenceMonth||'a informar')+'</p>'+
 field('Descricao','description',item.description,'text','maxlength="180" required')+
 field('Unidade','unit',item.unit,'text','maxlength="20" required')+
 '<label class="modal-field"><span>Coeficientes da equipe: Funcao; HH/un (uma por linha)</span>'+
 '<textarea name="coefficients" rows="6" placeholder="Eletricista; 0,30&#10;Ajudante; 0,20">'+e(roles)+'</textarea></label>'+
 '<p class="helper-text">Confirme se os coeficientes vieram da composicao analitica. Servicos auxiliares podem exigir calculo adicional. Ajustes proprios ficam salvos somente na sua conta.</p>'+
 '<p class="helper-text">Esta etapa utiliza somente a produtividade da mão de obra. Nenhum preço de material é solicitado ou importado.</p>'+
 '<p class="helper-text">Nao inclua salarios e encargos ja considerados no custo mensal da empresa. Nenhum preco oficial e copiado.</p>'+
 '<p class="form-error" id="catalog-form-error" role="alert" hidden></p>'+
 '<div class="modal-buttons"><button class="outlined-button" type="button" data-action="close-modal">Cancelar</button>'+
 '<button class="gold-button" type="submit">'+icon('check',18)+' Salvar no Supabase</button></div></form></div>';
}
