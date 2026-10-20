/* SINAPI SP — consulta, importação autenticada e comparação de referências.
 * Nunca equipara automaticamente escopos nem trata dados incompletos como preço.
 */
(function(){
'use strict';
const node=(tag,attrs={})=>{
 const el=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){
  if(k==='text')el.textContent=String(v);
  else if(k==='class')el.className=v;
  else el.setAttribute(k,String(v));
 }
 return el;
};
const euro=v=>v>0?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):'Custo indisponível';
async function api(action,params=null,data=null){
 const u='/api/admin?action='+encodeURIComponent(action)+(params?'&'+new URLSearchParams(params):'');
 const res=await fetch(u,{method:data?'POST':'GET',credentials:'same-origin',
  cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},
  body:data?JSON.stringify(data):undefined});
 const result=await res.json().catch(()=>({error:'Resposta inválida do serviço.'}));
 if(!res.ok)throw Error(result.error||'Erro na consulta.');
 return result;
}
function mount(dashboard){
 if(dashboard.querySelector('.pro-sinapi-hub'))return;
 const root=node('section',{class:'order pro-sinapi-hub'});
 root.append(node('h3',{text:'SINAPI SP · Pesquisa e comparação de composições'}));
 root.append(node('p',{class:'hint',text:'Use relatórios CAIXA/IBGE. Custos zerados ou não confirmados são pendentes, nunca obras gratuitas. Referências são separadas dos preços de venda.'}));
 const link=node('a',{href:'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx',
  target:'_blank',rel:'noopener noreferrer',text:'Consultar relatórios oficiais SINAPI (CAIXA)'});
 root.append(link);
 const panel=node('div',{class:'sinapi-reference-fields'});
 const label=(name,control)=>{const l=node('label',{class:'field'});l.append(node('span',{text:name}),control);return l;};
 const text=(placeholder='')=>node('input',{type:'text',placeholder});
 const code=text('Ex.: 103325'),description=text('Descrição da composição'),unit=text('Ex.: M2'),period=node('input',{type:'month',value:'2026-09'});
 const regime=node('select');
 for(const [value,labelText] of [['sem_desoneracao','Sem desoneração'],['com_desoneracao','Com desoneração']]){
  regime.append(node('option',{value,text:labelText}));
 }
 const cost=node('input',{type:'number',min:'0',step:'0.01',placeholder:'Sem custo verificado: deixe vazio'});
 const source=text('https://www.caixa.gov.br/...'),confirm=node('input',{type:'checkbox'});
 const parser=window.CIVOLTEN_TABLE_IMPORT;
 const upload=node('input',{type:'file',accept:'.csv,.json,text/csv,application/json'});
 const importOne=node('button',{type:'button',class:'goldbtn',text:'Salvar composição individual'});
 const template=node('button',{type:'button',text:'Baixar modelo CSV SINAPI'});
 const inspect=node('button',{type:'button',text:'Conferir arquivo selecionado'});
 const importFile=node('button',{type:'button',class:'goldbtn',text:'Salvar arquivo conferido no Supabase'});
 importFile.disabled=true;
 const confirmFile=node('input',{type:'checkbox'});
 const filePeriod=node('input',{type:'month',value:'2026-09'});
 const fileRegime=node('select');
 for(const [v,label] of [['sem_desoneracao','Sem desoneração'],['com_desoneracao','Com desoneração']])
  fileRegime.append(node('option',{value:v,text:label}));
 const fileSource=node('input',{type:'url',value:'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx',
  placeholder:'URL oficial CAIXA/IBGE do relatório'});
 const certify=node('input',{type:'checkbox'});
 const notice=node('p',{class:'hint','aria-live':'polite'});
 const preview=node('div',{class:'sinapi-file-preview'});
 let pending=null;
 panel.append(label('Código SINAPI',code),label('Descrição técnica',description),
  label('Unidade original',unit),label('Competência',period),label('Encargos',regime),
  label('Custo unitário verificado (opcional)',cost),label('URL oficial do custo (se houver)',source));
 const checked=label('Confirmei a fonte oficial do custo positivo',confirm);
 panel.append(checked,importOne,notice);
 root.append(panel);
 const filePanel=node('section',{class:'cub-import-file sinapi-import-file'});
 filePanel.append(node('h4',{text:'Importar composições SINAPI do celular (CSV ou JSON)'}),
  node('p',{class:'hint',text:'Salve planilhas Excel como CSV. PDF/XLSX não são importados diretamente. Confirme UF, competência e encargos; custos zerados são pendentes.'}),
  label('Arquivo SINAPI',upload),label('Mês-base / competência do arquivo',filePeriod),
  label('Regime da planilha',fileRegime),label('Endereço do relatório oficial',fileSource),
  label('Confirmei todos os custos positivos na fonte CAIXA/IBGE',certify),
  template,inspect,preview,label('Conferi a prévia e a competência do arquivo',confirmFile),importFile);
 root.append(filePanel);
 async function importBatch(data){
  if(data.schema!=='civolten.sinapi.v1'||!Array.isArray(data.items)||!data.items.length||
    data.items.length>15000)throw Error('Arquivo incompatível com o modelo SINAPI.');
  let n=0;
  for(let i=0;i<data.items.length;i+=25){
   await api('admin-sinapi-import',null,{
    schema:data.schema,uf:data.uf,period:data.period,regime:data.regime,
    items:data.items.slice(i,i+25)
   });
   n+=Math.min(25,data.items.length-i);
   notice.textContent=n+' de '+data.items.length+' composições SINAPI salvas.';
  }
 }
 importOne.addEventListener('click',async()=>{
  try{
   importOne.disabled=true;
   const raw=cost.value.trim(),amount=raw?Number(raw):null;
   if(raw&&(!confirm.checked||!source.value.trim()))throw Error('Custo positivo exige confirmação e fonte oficial.');
   await api('admin-sinapi-import',null,{schema:'civolten.sinapi.v1',uf:'SP',period:period.value,regime:regime.value,
    items:[{code:code.value,description:description.value,unit:unit.value,cost:amount,
     price_verified:confirm.checked,source_url:source.value}]});
   notice.textContent='Composição registrada no Supabase. Sem custo validado, ficará como avaliação.';
  }catch(e){notice.textContent='Importação individual: '+e.message;}
  finally{importOne.disabled=false;}
 });
 template.addEventListener('click',()=>{
  if(!parser)return;
  parser.download('civolten-modelo-sinapi.csv',
   'codigo;descricao;unidade;custo;fonte\\n123456;PREENCHER COM O SERVIÇO ORIGINAL;M2;;https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx\\n');
 });
 upload.addEventListener('change',()=>{pending=null;importFile.disabled=true;confirmFile.checked=false;preview.replaceChildren();});
 inspect.addEventListener('click',async()=>{
  importFile.disabled=true;confirmFile.checked=false;pending=null;preview.replaceChildren();
  try{
   if(!parser)throw Error('Leitor CSV não carregado. Atualize a página.');
   const {json,rows}=await parser.loadFile(upload.files?.[0]);
   if(json){
    if(json.schema!=='civolten.sinapi.v1'||json.uf!=='SP'||!Array.isArray(json.items))
     throw Error('JSON precisa do modelo civolten.sinapi.v1 e UF SP.');
    pending=json;
   }else{
    const items=rows.map(row=>{
     const raw=parser.field(row,'custo','valor','unit_cost','custo unitario','preco');
     const numeric=parser.numberBR(raw);
     const verified=certify.checked&&numeric>0;
     const official=parser.field(row,'fonte','url','source_url')||fileSource.value.trim();
     return {code:parser.field(row,'codigo','codigo composicao','code'),
      description:parser.field(row,'descricao','description','nome servico','servico'),
      unit:parser.field(row,'unidade','unit','und'),
      cost:verified?numeric:null,
      price_verified:verified,source_url:official};
    });
    pending={schema:'civolten.sinapi.v1',uf:'SP',period:filePeriod.value,
     regime:fileRegime.value,items};
   }
   if(!/^20\\d{2}-(?:0[1-9]|1[0-2])$/.test(pending.period)||
     !['sem_desoneracao','com_desoneracao'].includes(pending.regime)||
     !pending.items.length||pending.items.length>15000)
    throw Error('Confira competência AAAA-MM, regime de encargos e quantidade de composições.');
   if(pending.items.some(x=>!/^\\d{4,10}$/.test(String(x.code||''))||
     String(x.description||'').trim().length<3||!String(x.unit||'').trim()))
    throw Error('Arquivo sem colunas de código, descrição ou unidade válidas. Confira os cabeçalhos.');
   const duplicate=new Set(pending.items.map(x=>String(x.code)));
   if(duplicate.size!==pending.items.length)throw Error('Códigos repetidos no mesmo arquivo. Revise antes de salvar.');
   const withCost=pending.items.filter(x=>Number(x.cost)>0).length;
   preview.append(node('p',{text:'SP · '+pending.period+' · '+pending.regime+' · '+pending.items.length+
    ' composições · '+withCost+' com custo declarado.'}));
   for(const x of pending.items.slice(0,12))preview.append(node('p',{text:String(x.code)+' · '+String(x.description).slice(0,95)+
    ' · '+String(x.unit)+' · '+(Number(x.cost)>0?'R$ '+Number(x.cost).toFixed(2).replace('.',','):'Custo pendente')}));
   notice.textContent='Confira a prévia. Só grave os dados da fonte oficial, e não marque custos como confirmados sem evidência.';
   importFile.disabled=false;
  }catch(e){pending=null;notice.textContent='Não foi possível ler o arquivo: '+e.message;}
 });
 importFile.addEventListener('click',async()=>{
  if(!pending)return;
  if(!confirmFile.checked){notice.textContent='Confirme a conferência do arquivo antes de salvar.';return;}
  importFile.disabled=true;
  try{
   await importBatch(pending);
   notice.textContent=pending.items.length+' composições salvas. Atualize o orçamento para carregar o SINAPI.';
   pending=null;confirmFile.checked=false;
  }catch(e){notice.textContent='Importação interrompida: '+e.message+'. Os lotes anteriores podem ter sido gravados.';}
  finally{importFile.disabled=!pending;}
 });
 const comparison=node('div',{class:'sinapi-compare-panel'});
 comparison.append(node('h4',{text:'Comparar SIURB × SINAPI (mesmo escopo e unidade)'}));
 const siurbSource=node('select');for(const opt of ['EDIF','INFRA'])siurbSource.append(node('option',{value:opt,text:opt}));
 const siurbCode=text('Código SIURB');const sinapiCode=text('Código SINAPI');
 const compareMonth=node('input',{type:'month',value:'2026-09'});
 const compareRegime=node('select');
 for(const [id,name] of [['sem_desoneracao','Sem desoneração'],['com_desoneracao','Com desoneração']])
  compareRegime.append(node('option',{value:id,text:name}));
 const scope=node('input',{type:'checkbox'}),compare=node('button',{type:'button',class:'goldbtn',text:'Conferir diferenças'});
 const result=node('div',{class:'sinapi-comparison-result','aria-live':'polite'});
 comparison.append(label('Origem SIURB',siurbSource),label('Código SIURB',siurbCode),
  label('Código SINAPI',sinapiCode),label('Mês-base SINAPI',compareMonth),label('Regime SINAPI',compareRegime),
  label('Confirmei equivalência técnica do escopo de execução',scope),compare,result);
 compare.addEventListener('click',async()=>{
  compare.disabled=true;result.replaceChildren();
  try{
   const data=await api('admin-sinapi-compare',{
    siurb_source:siurbSource.value,siurb_code:siurbCode.value,sinapi_code:sinapiCode.value,
    month:compareMonth.value,regime:compareRegime.value,scope_confirmed:scope.checked?'1':'0'});
   result.append(node('p',{text:'SIURB: '+data.siurb.description+' · '+euro(data.siurb.cost)+' / '+data.siurb.unit+
    ' · '+data.siurb.month+' · '+data.siurb.regime}));
   result.append(node('p',{text:'SINAPI: '+data.sinapi.description+' · '+euro(data.sinapi.cost)+' / '+data.sinapi.unit+
    ' · '+data.sinapi.month+' · '+data.sinapi.regime}));
   if(data.comparable){
    result.append(node('strong',{text:data.lower_reference==='EMPATE'?'Custos unitários iguais':
     'Menor custo de referência: '+data.lower_reference+' · diferença '+euro(data.difference)}));
   }else result.append(node('strong',{text:'Comparação ainda não válida: '+data.reasons.join(' ')}));
   result.append(node('small',{text:data.note}));
  }catch(e){result.append(node('p',{text:'Comparação indisponível: '+e.message}));}
  finally{compare.disabled=false;}
 });
 root.append(comparison);
 const search=node('div',{class:'sinapi-find'});
 const q=node('input',{type:'search',placeholder:'Pesquisar SINAPI por código ou descrição','aria-label':'Pesquisar composições SINAPI'});
 const btn=node('button',{type:'button',text:'Pesquisar SINAPI'});
 const output=node('div',{class:'pro-ref-results'}),status=node('p',{class:'hint','aria-live':'polite'});
 search.append(node('h4',{text:'Buscar composição SINAPI'}),q,btn,status,output);
 async function run(){
  if(q.value.trim().length<2){status.textContent='Digite pelo menos 2 caracteres.';return;}
  btn.disabled=true;output.replaceChildren();
  try{
   const response=await api('admin-sinapi-search',{q:q.value.trim()});
   status.textContent=response.results.length+' referência(s) encontradas. Custos ausentes não entram na comparação.';
   for(const item of response.results){
    const art=node('article',{class:'pro-ref-item'});
    art.append(node('strong',{text:item.description}),
     node('small',{text:'SINAPI '+item.code+' · '+item.base_month+' · '+item.regime+' · '+item.unit}),
     node('p',{text:item.price_verified?euro(item.unit_cost):'Custo pendente: avaliar tecnicamente.'}));
    const use=node('button',{type:'button',text:'Usar na comparação'});
    use.addEventListener('click',()=>{
     sinapiCode.value=item.code;compareMonth.value=item.base_month;compareRegime.value=item.regime;
     comparison.scrollIntoView?.({behavior:'smooth',block:'center'});
    });
    art.append(use);output.append(art);
   }
  }catch(e){status.textContent='Não foi possível pesquisar: '+e.message;}
  finally{btn.disabled=false;}
 }
 btn.addEventListener('click',run);
 q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
 root.append(search);dashboard.append(root);
}
function searchInto(editor,onSelect){
 // A pesquisa completa e a comparação ficam no painel SIURB; o editor comercial
 // permite adicionar descrição SINAPI com preço inicial zero para conferência manual.
 const box=node('div',{class:'pro-reference'});
 const title=node('h4',{text:'Pesquisar serviços SINAPI SP'});
 const query=node('input',{type:'search',placeholder:'Código ou nome da composição SINAPI'});
 const btn=node('button',{type:'button',text:'Buscar no SINAPI'}),results=node('div',{class:'pro-ref-results'});
 const message=node('p',{class:'hint','aria-live':'polite'});
 btn.addEventListener('click',async()=>{
  results.replaceChildren();
  try{
   const data=await api('admin-sinapi-search',{q:query.value});
   for(const s of data.results){
    const row=node('div',{class:'pro-ref-item'});
    row.append(node('strong',{text:'['+s.code+'] '+s.description}));
    const choose=node('button',{type:'button',text:'Adicionar descrição'});
    choose.addEventListener('click',()=>{
     onSelect({description:'[SINAPI SP '+s.code+'] '+s.description,quantity:1,unit:s.unit,unit_price:0});
     message.textContent='Descrição incluída com preço comercial pendente de conferência.';
    });
    row.append(choose);results.append(row);
   }
  }catch(e){message.textContent=e.message;}
 });
 box.append(title,query,btn,message,results);editor.append(box);
}
window.CIVOLTEN_SINAPI_ADMIN={mount,searchInto};
})();