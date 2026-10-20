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
 const upload=node('input',{type:'file',accept:'.json,application/json'});
 const importOne=node('button',{type:'button',class:'goldbtn',text:'Importar composição individual'});
 const importFile=node('button',{type:'button',text:'Importar arquivo JSON em lotes'});
 const notice=node('p',{class:'hint','aria-live':'polite'});
 panel.append(label('Código SINAPI',code),label('Descrição técnica',description),
  label('Unidade original',unit),label('Competência',period),label('Encargos',regime),
  label('Custo unitário verificado (opcional)',cost),label('URL oficial do custo (se houver)',source));
 const checked=label('Confirmo a conferência da fonte oficial para preço positivo',confirm);
 panel.append(checked,importOne,label('Arquivo preparado (JSON)',upload),importFile,notice);
 root.append(panel);
 async function importBatch(data){
  if(data.schema!=='civolten.sinapi.v1'||!Array.isArray(data.items)||data.items.length>12000)
   throw Error('Arquivo inválido. Use schema civolten.sinapi.v1 com serviços.');
  let n=0;
  for(let i=0;i<data.items.length;i+=25){
   const items=data.items.slice(i,i+25);
   await api('admin-sinapi-import',null,{schema:data.schema,uf:data.uf,period:data.period,regime:data.regime,items});
   n+=items.length;notice.textContent=n+' de '+data.items.length+' composições importadas.';
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
   notice.textContent='Composição registrada. Sem valor validado, ficará pendente para simulação.';
  }catch(e){notice.textContent='Não foi possível importar: '+e.message;}
  finally{importOne.disabled=false;}
 });
 importFile.addEventListener('click',async()=>{
  const file=upload.files?.[0];if(!file){notice.textContent='Selecione o JSON primeiro.';return;}
  if(file.size>5000000){notice.textContent='Arquivo muito grande (limite 5 MB).';return;}
  try{
   importFile.disabled=true;
   await importBatch(JSON.parse(await file.text()));
   notice.textContent='Importação concluída. Consulte o código na pesquisa abaixo.';
  }catch(e){notice.textContent='Importação incompleta: '+e.message;}
  finally{importFile.disabled=false;}
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