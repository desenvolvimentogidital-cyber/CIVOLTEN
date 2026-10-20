/* Painel CUB: importar planilha CSV/JSON e salvar referências reais em Supabase.
 * PDF/XLSX precisam ser convertidos para CSV (ou valores lançados manualmente).
 */
(function(){
'use strict';
const parser=window.CIVOLTEN_TABLE_IMPORT;
const node=(tag,attrs={})=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){
 if(k==='text')e.textContent=String(v);else if(k==='class')e.className=v;else e.setAttribute(k,String(v));}return e;};
async function api(action,data=null){
 const r=await fetch('/api/admin?action='+encodeURIComponent(action),{
  method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',
  headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined
 });
 const j=await r.json().catch(()=>({error:'Resposta inválida da API.'}));
 if(!r.ok)throw Error(j.error||'Não foi possível salvar os dados.');return j;
}
const defaultUrl='https://sindusconsp.com.br/cub-paulista-sobe-013-em-setembro/';
const rates=['R1B','R1N','R1A'];
const regimes=['sem_desoneracao','com_desoneracao'];
function mount(host){
 if(host.querySelector('.cub-importer'))return;
 if(!parser){host.append(node('p',{text:'Carregue novamente a página para ativar a importação CUB.'}));return;}
 const root=node('section',{class:'order cub-importer'});
 root.append(node('h3',{text:'Importar CUB-SP — custos básicos de construção por m²'}));
 root.append(node('p',{class:'hint',text:'Pelo celular: baixe a tabela, exporte como CSV ou use o cadastro manual. Confira padrões R1 e fonte oficial antes de salvar. PDF/XLSX não são importados diretamente.'}));
 const sourceLink=node('a',{href:'https://sindusconsp.com.br/servicos/cub/',target:'_blank',rel:'noopener noreferrer',text:'Consultar referência oficial SindusCon-SP'});
 root.append(sourceLink);
 const form=node('div',{class:'cub-import-fields'});
 const field=(title,control)=>{const label=node('label',{class:'field'});label.append(node('span',{text:title}),control);return label;};
 const month=node('input',{type:'month',value:'2026-09'});
 const pattern=node('select'),regime=node('select');
 for(const type of rates)pattern.append(node('option',{value:type,text:type}));
 for(const val of regimes)regime.append(node('option',{value:val,text:val==='sem_desoneracao'?'Sem desoneração':'Com desoneração'}));
 const cost=node('input',{type:'number',min:'0.01',max:'100000',step:'0.01',inputmode:'decimal',placeholder:'R$/m² conforme a fonte'});
 const url=node('input',{type:'url',value:defaultUrl,placeholder:'Link SindusCon-SP ou Portal do RI'});
 const checked=node('input',{type:'checkbox'});
 const status=node('p',{class:'hint','aria-live':'polite'});
 const saveOne=node('button',{type:'button',class:'goldbtn',text:'Salvar esta referência CUB'});
 form.append(field('Competência',month),field('Padrão de casa',pattern),field('Regime / encargos',regime),
  field('Valor básico (R$/m²)',cost),field('Endereço da fonte oficial',url),
  field('Conferi o valor no arquivo oficial',checked),saveOne,status);
 root.append(form);
 saveOne.addEventListener('click',async()=>{
  try{
   saveOne.disabled=true;
   if(!checked.checked)throw Error('Confira a tabela oficial e marque a confirmação antes de salvar.');
   const n=parser.numberBR(cost.value);
   if(!(n>0))throw Error('Informe custo por m² maior que zero.');
   const data={schema:'civolten.cub.v1',uf:'SP',period:month.value,
    items:[{pattern:pattern.value,regime:regime.value,cost:n,source_url:url.value.trim()}]};
   await api('admin-cub-import',data);
   status.textContent='Referência CUB salva no banco para '+month.value+'. Não altera automaticamente o preço comercial da obra.';
   checked.checked=false;await refresh();
  }catch(e){status.textContent=e.message;}finally{saveOne.disabled=false;}
 });
 const fileBox=node('div',{class:'cub-import-file'});
 fileBox.append(node('h4',{text:'Importar uma tabela do celular'}));
 const file=node('input',{type:'file',accept:'.csv,.json,text/csv,application/json'});
 const template=node('button',{type:'button',text:'Baixar modelo CSV do CUB'});
 const previewButton=node('button',{type:'button',text:'Conferir arquivo selecionado'});
 const fileStatus=node('p',{class:'hint','aria-live':'polite'});
 const preview=node('div',{class:'cub-import-preview'});
 const approved=node('input',{type:'checkbox'});
 const importButton=node('button',{type:'button',class:'goldbtn',text:'Salvar valores conferidos no Supabase'});importButton.disabled=true;
 let pending=[];
 template.addEventListener('click',()=>parser.download('civolten-modelo-cub.csv',
  'competencia;padrao;regime;valor;fonte\n2026-09;R1N;sem_desoneracao;;https://sindusconsp.com.br/servicos/cub/\n'));
 previewButton.addEventListener('click',async()=>{
  pending=[];importButton.disabled=true;approved.checked=false;preview.replaceChildren();
  try{
   const {json,rows}=await parser.loadFile(file.files?.[0]);
   if(json){
    const data=Array.isArray(json)?json:(json.items||json.rates);
    if(!Array.isArray(data)||!data.length)throw Error('JSON precisa de uma lista de valores CUB.');
    pending=data.map(x=>({period:x.period||x.base_month||json.period||month.value,
     pattern:String(x.pattern||x.padrao||'').toUpperCase().replace(/-/g,''),
     regime:x.regime||regime.value,cost:parser.numberBR(x.cost??x.unit_cost??x.valor),
     source_url:x.source_url||x.fonte||json.source_url||url.value.trim()}));
   }else{
    pending=rows.map(row=>({
     period:parser.field(row,'competencia','periodo','mesbase')||month.value,
     pattern:String(parser.field(row,'padrao','pattern','tipologia')).toUpperCase().replace(/[-\s]/g,''),
     regime:parser.field(row,'regime','desoneracao')||regime.value,
     cost:parser.numberBR(parser.field(row,'valor','custo','custo m2','cub','unit_cost')),
     source_url:parser.field(row,'fonte','url','source_url')||url.value.trim()
    }));
   }
   if(pending.length>200)throw Error('Limite de 200 linhas CUB por arquivo.');
   if(pending.some(x=>!/^20\d\d-(?:0[1-9]|1[0-2])$/.test(x.period)||
     !rates.includes(x.pattern)||!regimes.includes(x.regime)||!(x.cost>0)||!x.source_url))
    throw Error('Confira competência AAAA-MM, R1B/R1N/R1A, regime, custo maior que zero e URL oficial em todas as linhas.');
   const uniques=new Set(pending.map(x=>x.period+':'+x.pattern+':'+x.regime));
   if(uniques.size!==pending.length)throw Error('Arquivo contém padrão, mês e regime repetidos.');
   const sample=pending.slice(0,20);
   for(const x of sample)preview.append(node('p',{text:x.period+' · '+x.pattern+' · '+x.regime+
    ' · R$ '+x.cost.toFixed(2).replace('.',',')+'/m²'}));
   fileStatus.textContent=pending.length+' linha(s) lidas. Confira os valores e confirme a origem antes de salvar.';
   importButton.disabled=false;
  }catch(e){pending=[];fileStatus.textContent='Não foi possível ler: '+e.message;}
 });
 importButton.addEventListener('click',async()=>{
  if(!pending.length)return;
  if(!approved.checked){fileStatus.textContent='Marque a confirmação depois de conferir o arquivo.';return;}
  importButton.disabled=true;
  try{
   let imported=0;const groups=new Map();
   for(const record of pending){
    const arr=groups.get(record.period)||[];arr.push(record);groups.set(record.period,arr);
   }
   for(const [period,rows] of groups){
    for(let i=0;i<rows.length;i+=24){
     await api('admin-cub-import',{schema:'civolten.cub.v1',uf:'SP',period,
      items:rows.slice(i,i+24).map(x=>({pattern:x.pattern,regime:x.regime,cost:x.cost,source_url:x.source_url}))});
     imported+=Math.min(24,rows.length-i);
     fileStatus.textContent=imported+' de '+pending.length+' valores CUB gravados.';
    }
   }
   fileStatus.textContent='Importação concluída: '+imported+' valores CUB salvos. A calculadora pública utilizará a referência mais recente disponível.';
   pending=[];approved.checked=false;await refresh();
  }catch(e){fileStatus.textContent='Importação interrompida: '+e.message+'. Valores de lotes anteriores permanecem salvos.';}
  finally{importButton.disabled=pending.length===0;}
 });
 fileBox.append(field('Arquivo CSV ou JSON',file),template,previewButton,fileStatus,preview,
  field('Confirmo que os valores correspondem à fonte e competência informadas',approved),importButton);
 root.append(fileBox);
 const saved=node('div',{class:'cub-import-saved'});root.append(saved);
 async function refresh(){
  saved.replaceChildren();
  try{
   const response=await api('admin-cub-list');
   saved.append(node('h4',{text:'Referências CUB salvas: '+response.rates.length}));
   if(!response.rates.length)saved.append(node('p',{class:'hint',text:'Ainda sem importações; a calculadora mantém a referência básica incorporada de 09/2026.'}));
   for(const x of response.rates.slice(0,24))saved.append(node('p',{
    text:x.base_month+' · '+x.pattern+' · '+x.regime+' · R$ '+Number(x.unit_cost).toFixed(2).replace('.',',')+'/m²'}));
  }catch(e){saved.append(node('p',{text:'Não foi possível listar CUB: '+e.message}));}
 }
 host.append(root);refresh();
}
window.CIVOLTEN_CUB_ADMIN={mount};
})();