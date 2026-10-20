/* CIVOLTEN: base técnica SIURB julho/2026, disponível somente no painel admin.
   Insumos e custos são referências; não configuram automaticamente o preço de venda. */
(function(){
'use strict';
const el=(tag,attrs={},children=[])=>{
 const out=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){
  if(k==='text')out.textContent=String(v);
  else if(k==='class')out.className=v;
  else out.setAttribute(k,String(v));
 }
 for(const c of children)out.append(c);
 return out;
};
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
async function api(action,params=null,payload=null){
 const url='/api/admin?action='+encodeURIComponent(action)+(params?'&'+new URLSearchParams(params):'');
 const r=await fetch(url,{
  method:payload?'POST':'GET',credentials:'same-origin',
  headers:payload?{'Content-Type':'application/json'}:{},
  body:payload?JSON.stringify(payload):undefined,cache:'no-store'
 });
 const d=await r.json().catch(()=>({error:'Resposta inválida do servidor.'}));
 if(!r.ok)throw Error(d.error||'Erro na consulta da tabela');
 return d;
}
function searchInto(editor,onSelect){
 const wrap=el('section',{class:'pro-reference'});
 wrap.append(el('h4',{text:'Pesquisar serviços SIURB — 07/2026'}));
 wrap.append(el('p',{class:'hint',text:'Catálogo de custo de referência, separado dos preços de venda da CIVOLTEN. Pesquise código, material ou serviço.'}));
 const bar=el('div',{class:'pro-ref-bar'});
 const query=el('input',{type:'search',placeholder:'Ex.: cabo, pintura, 9003070','aria-label':'Pesquisar na tabela SIURB'});
 const source=el('select',{'aria-label':'Base de referência'});
 for(const [val,label] of [['','EDIF + INFRA'],['EDIF','Edificações (EDIF)'],['INFRA','Infraestrutura (INFRA)']]){
  source.append(el('option',{value:val,text:label}));
 }
 const run=el('button',{type:'button',text:'Buscar',class:'goldbtn'});
 bar.append(query,source,run);wrap.append(bar);
 const notice=el('div',{class:'hint','aria-live':'polite'}),list=el('div',{class:'pro-ref-results'});
 wrap.append(notice,list);
 async function find(){
  const q=query.value.trim();
  if(q.length<2){notice.textContent='Digite pelo menos dois caracteres.';return;}
  run.disabled=true;notice.textContent='Pesquisando...';list.replaceChildren();
  try{
   const r=await api('admin-reference-search',{q,source:source.value});
   notice.textContent=r.results.length+' serviço(s) encontrado(s). Exibindo no máximo 40; refine a busca se necessário.';
   for(const s of r.results){
    const item=el('article',{class:'pro-ref-item'});
    item.append(el('strong',{text:s.description}));
    item.append(el('small',{text:s.source+' • código '+s.code+' • '+s.base_month+' • '+s.unit}));
    item.append(el('p',{text:'Custo unitário de referência: '+money(s.unit_cost)}));
    const actions=el('div',{class:'row'});
    const detail=el('button',{type:'button',text:'Ver composição analítica'});
    const add=el('button',{type:'button',text:'+ Adicionar ao orçamento',class:'goldbtn'});
    const sub=el('div',{class:'pro-ref-insumos hidden'});
    detail.onclick=async()=>{
     if(!sub.classList.contains('hidden')){sub.classList.add('hidden');return;}
     try{
      detail.disabled=true;
      const d=await api('admin-reference-detail',{source:s.source,code:s.code});
      sub.replaceChildren();
      sub.append(el('p',{class:'hint',text:'Insumos, coeficientes e custos de julho/2026; valores de referência, sem preço de venda.'}));
      for(const x of d.service.inputs){
       sub.append(el('p',{text:x.code+' • '+x.description+' | '+x.coefficient+' '+x.unit+' × '+money(x.unit_cost)+' = '+money(x.partial_cost)}));
      }
      sub.classList.remove('hidden');
     }catch(e){notice.textContent=e.message;}finally{detail.disabled=false;}
    };
    add.onclick=()=>{
     onSelect({description:'['+s.source+' '+s.code+'] '+s.description,
      quantity:1,unit:s.unit,unit_price:0});
     notice.textContent='Serviço adicionado com preço R$ 0,00. Defina e revise seu preço comercial antes de salvar.';
    };
    actions.append(detail,add);item.append(actions,sub);list.append(item);
   }
  }catch(e){notice.textContent=e.message;}finally{run.disabled=false;}
 }
 run.onclick=find;query.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find();}};
 source.onchange=()=>{if(query.value.trim().length>=2)find();};
 editor.append(wrap);
 window.CIVOLTEN_SINAPI_ADMIN?.searchInto?.(editor,onSelect);
}
function importHub(dashboard){
 if(dashboard.querySelector('.pro-siurb-import'))return;
 const box=el('section',{class:'order pro-siurb-import'});
 box.append(el('h3',{text:'Bases técnicas SIURB — julho/2026'}));
 box.append(el('p',{class:'hint',text:'Importe EDIF e INFRA usando um único arquivo JSON preparado (ou os dois arquivos separadamente). A importação é segura e pode ser retomada; não remove preços ou orçamentos da CIVOLTEN.'}));
 const stats=el('p',{class:'hint','aria-live':'polite',text:'Consultando bases...'});
 const file=el('input',{type:'file',accept:'.json,application/json',multiple:'multiple','aria-label':'Selecione os arquivos JSON EDIF e INFRA'});
 const btn=el('button',{type:'button',text:'Importar / atualizar bases',class:'goldbtn'});
 const cancel=el('button',{type:'button',text:'Interromper importação'});cancel.disabled=true;
 const progress=el('p',{class:'hint','aria-live':'polite',text:'Nenhum arquivo escolhido.'});
 let stop=false;
 async function updateStats(){
  const d=await api('admin-reference-stats');
  stats.textContent='EDIF: '+d.edif+' composições | INFRA: '+d.infra+' composições | referência: '+d.reference_month+'.';
 }
 btn.onclick=async()=>{
  const selected=[...(file.files||[])];
  if(!selected.length){progress.textContent='Selecione os arquivos JSON de EDIF e/ou INFRA.';return;}
  if(!confirm('Importar custos SIURB 07/2026 como referências sem alterar o catálogo atual de preços?'))return;
  btn.disabled=true;cancel.disabled=false;stop=false;
  try{
   for(const f of selected){
    if(stop)break;
    if(f.size>5000000)throw Error('Arquivo muito grande: '+f.name);
    const payload=JSON.parse(await f.text());
    const datasets=payload.schema==='civolten.siurb.bundle.v1'&&Array.isArray(payload.datasets)?payload.datasets:[payload];
    if(datasets.length<1||datasets.length>2)throw Error('O arquivo não contém as bases SIURB esperadas.');
    for(const data of datasets){
     if(data.schema!=='civolten.siurb.v1'||data.period!=='2026-07'||data.regime!=='com_desoneracao'||
        !['INFRA','EDIF'].includes(data.source)||!Array.isArray(data.services)||data.services.length>4000)
      throw Error('Formato ou período inválido no arquivo '+f.name);
     let loaded=0;
     for(let i=0;i<data.services.length;i+=25){
      if(stop)break;
      const services=data.services.slice(i,i+25);
      await api('admin-reference-import',null,{source:data.source,period:data.period,regime:data.regime,items:services});
      loaded+=services.length;
      progress.textContent=data.source+': '+loaded+' de '+data.services.length+' serviços enviados.';
     }
    }
   }
   progress.textContent=stop?'Importação interrompida; selecione os arquivos novamente para continuar.':'Importação concluída! Faça uma pesquisa no editor.';
   await updateStats();
  }catch(e){progress.textContent='Falha: '+e.message+' — é seguro tentar novamente.';}
  finally{btn.disabled=false;cancel.disabled=true;file.value='';}
 };
 cancel.onclick=()=>{stop=true;progress.textContent='Interrompendo ao terminar o lote atual...';};
 box.append(stats,file,btn,cancel,progress);
 dashboard.append(box);
 window.CIVOLTEN_SINAPI_ADMIN?.mount?.(dashboard);
 window.CIVOLTEN_CUB_ADMIN?.mount?.(dashboard);
 updateStats().catch(e=>stats.textContent='Não foi possível consultar as bases: '+e.message);
}
window.CIVOLTEN_SIURB={searchInto,importHub};
})();