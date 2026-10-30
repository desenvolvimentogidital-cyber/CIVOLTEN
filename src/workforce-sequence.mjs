/* Sugestão de sequenciamento: não inventa serviços, quantidade, prazo de cura
 * ou dependências definitivas. Reordena somente a cadeia de revestimento.
 * As demais atividades permanecem na posição prevista no orçamento.
 */
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export function constructionStage(service){
 const s=normalize(service?.title||service?.source_name);
 if(/\b(?:CHAPISCO|CHAPISCAMENTO)\b/.test(s))return {key:'chapisco',label:'Chapisco',order:20};
 if(/\b(?:REBOCO|MASSA UNICA|EMBOCO)\b/.test(s))return {key:'reboco',label:'Reboco / revestimento',order:30};
 if(/\b(?:ALVENARIA|ASSENTAMENTO DE BLOCO|EXECUCAO DE PAREDE)\b/.test(s))return {key:'alvenaria',label:'Alvenaria',order:10};
 return null;
}
export function planExecutionSequence(services=[]){
 const original=[...services];
 const indexed=original.map((service,index)=>({
   ...service,__index:index,__stage:constructionStage(service)
 }));
 const present=new Set(indexed.filter(x=>x.__stage).map(x=>x.__stage.key));
 const hasMasonry=present.has('alvenaria'),hasPlaster=present.has('reboco');
 const hasCoat=present.has('chapisco');
 // Topological ordering: only inject edges for steps with known construction
 // precedence. Different services otherwise keep budget order when possible.
 const nodes=indexed.map((service,i)=>({service,i,edges:[],incoming:0}));
 for(let i=0;i<nodes.length;i++){
  for(let j=0;j<nodes.length;j++){
   if(i===j)continue;
   const a=nodes[i].service.__stage?.order,b=nodes[j].service.__stage?.order;
   if(a&&b&&a<b){nodes[i].edges.push(j);nodes[j].incoming++}
  }
 }
 const ready=nodes.filter(n=>n.incoming===0).sort((a,b)=>a.i-b.i);
 const ordered=[];
 while(ready.length){
  const next=ready.shift();
  ordered.push(next.service);
  for(const j of next.edges){
   const n=nodes[j];n.incoming--;
   if(!n.incoming){ready.push(n);ready.sort((a,b)=>a.i-b.i)}
  }
 }
 const steps=ordered.map((service,i)=>({
  item_id:service.item_id||service.id,sequence:i+1,
  title:service.title||service.source_name,stage:service.__stage?.label||'Serviço do orçamento',
  stage_key:service.__stage?.key||null,
  duration_workdays:service.workers===null?null:Number(service.days_at_suggested_staff)||null,
  workers:service.workers??null,
  roles:service.roles||[],
  quantity:service.quantity,unit:service.unit,
  code:service.code||service.source_code
 }));
 const missing=[];
 if(hasMasonry&&hasPlaster&&!hasCoat)missing.push({
  code:'missing_chapisco',label:'Chapisco não encontrado no orçamento',
  message:'Para a sequência alvenaria → chapisco → reboco, adicione o chapisco ao orçamento, se ele fizer parte do escopo. Sem esse serviço não é possível fechar o prazo e o custo total.'
 });
 const incomplete=steps.some(x=>x.duration_workdays===null);
 const days=steps.reduce((sum,x)=>sum+(x.duration_workdays||0),0);
 return {steps,missing,sequence_workdays_estimated:days,
  complete:steps.length>0&&!incomplete&&!missing.length,
  planning_note:'Sequência inicial sugerida por tipo de serviço. Confirmar frentes de trabalho, liberação de superfícies, cura/secagem e dependências com o responsável técnico; nenhuma espera foi presumida.',
  automated:true};
}
