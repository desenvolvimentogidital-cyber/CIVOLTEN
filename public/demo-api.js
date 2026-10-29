/* CIVOLTEN — modo de demonstração exclusivamente no navegador (Vercel/static).
 * Não substitui autenticação nem banco persistente. Não cadastre dados reais aqui.
 */
(function () {
  const isLocal = ['localhost','127.0.0.1','::1'].includes(location.hostname);
  if (isLocal && !new URLSearchParams(location.search).has('demo')) return;
  window.CIVOLTEN_DEMO = true;
  const storeKey = 'civolten-demo-v1';
  const today = () => new Date().toISOString().slice(0,10);
  const initial = () => ({
    nextId: 10,
    clients: [
      {id:1,name:'Cliente Exemplo A',type:'Pessoa jurídica',doc:'',contact:'Contato de demonstração',email:'',phone:'',address:'',city:'São Paulo',status:'Ativo',created_at:today()},
      {id:2,name:'Cliente Exemplo B',type:'Condomínio',doc:'',contact:'',email:'',phone:'',address:'',city:'São Paulo',status:'Ativo',created_at:today()}
    ],
    projects:[{id:3,client_id:1,name:'Reforma demonstrativa',type:'Reforma',address:'São Paulo/SP',status:'Planejamento',notes:'Projeto de teste',created_at:today()}],
    budgets:[{id:4,code:`ORC-${new Date().getFullYear()}-0001`,client_id:1,project_id:3,title:'Orçamento de demonstração',status:'Rascunho',reference_month:'2026-07',regime:'Sem desoneração',bdi:25,safety_pct:15,workers:2,hours_day:8,efficiency:.8,work_days_week:5,start_date:today(),payment_terms:'A negociar',validity_days:30,notes:'Valores totalmente fictícios',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],
    items:[{id:5,budget_id:4,code:'DEMO-001',description:'Serviço de exemplo — NÃO É SIURB',unit:'m²',qty:100,unit_cost:65,hh_unit:0.8,team:'2 profissionais',sort_order:1}],
    catalog:[{id:6,code:'DEMO-001',description:'Serviço de exemplo — NÃO É SIURB',unit:'m²',cost:65,hh_per_unit:.8,source:'PRÓPRIA',reference_month:'',regime:'Próprio',category:'Demonstração'}],
    proposals:[],
    settings:{company:'CIVOLTEN — Elétrica & Construção Civil',cnpj:'',phone:'',email:'',address:'',footer:'Demonstração. Valores não oficiais.',proposalIntro:'Proposta de exemplo gerada no modo demonstração.',proposalWarranty:'Conforme contrato.'}
  });
  let state;
  try { state=JSON.parse(localStorage.getItem(storeKey)) || initial(); } catch { state=initial(); }
  const persist=()=>localStorage.setItem(storeKey,JSON.stringify(state));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const id = () => ++state.nextId;
  const trim=x=>String(x??'').trim();
  function calc(b){
    const items=state.items.filter(x=>x.budget_id===b.id).sort((a,z)=>(a.sort_order||0)-(z.sort_order||0));
    const rows=items.map(i=>({...i,subtotal:Math.round(i.qty*i.unit_cost*100)/100,laborHours:Math.round(i.qty*i.hh_unit*100)/100}));
    const cost=Math.round(rows.reduce((s,x)=>s+x.subtotal,0)*100)/100;
    const bdiValue=Math.round(cost*(Number(b.bdi)||0))/100;
    const total=Math.round((cost+bdiValue)*100)/100;
    const laborHours=rows.reduce((s,x)=>s+x.laborHours,0);
    const capacityDay=Math.max(1,(Number(b.workers)||2)*(Number(b.hours_day)||8)*(Number(b.efficiency)||.8));
    const missingProductivity=rows.filter(x=>!(Number(x.hh_unit)>0)).length;const tasks=rows.map((x,ix)=>({...x,name:x.description,hours:x.laborHours,cost:x.subtotal,durationDays:Number(x.hh_unit)>0?Math.max(1,Math.ceil(x.laborHours/capacityDay)):0,step:ix+1}));
    const baseDays=tasks.reduce((s,x)=>s+x.durationDays,0), safetyDays=missingProductivity?0:Math.ceil(baseDays*(Number(b.safety_pct)||0)/100),totalDays=missingProductivity?0:baseDays+safetyDays;
    const start=b.start_date||today(),daysWeek=Number(b.work_days_week)===6?6:5;
    function addDays(num){const d=new Date(start+'T12:00:00Z');let count=0;while(count<num){if(d.getUTCDay()!==0 && (daysWeek===6 || d.getUTCDay()!==6))count++;if(count<num)d.setUTCDate(d.getUTCDate()+1);}return d.toISOString().slice(0,10);}
    let offset=0;for(const task of tasks){task.start=task.durationDays?addDays(offset+1):null;offset+=task.durationDays;task.end=task.durationDays?addDays(offset):null;}
    return {...b,items,client_name:state.clients.find(x=>x.id===b.client_id)?.name||'',client_doc:state.clients.find(x=>x.id===b.client_id)?.doc||'',project_name:state.projects.find(x=>x.id===b.project_id)?.name||'',project_address:state.projects.find(x=>x.id===b.project_id)?.address||'',summary:{rows,cost,bdi:Number(b.bdi)||0,bdiValue,total,laborHours},total,baseDays,safetyDays,totalDays,capacityDay,workers:b.workers,hoursDay:b.hours_day,efficiency:b.efficiency,safetyPct:b.safety_pct,start,finish:totalDays?addDays(totalDays):null,tasks,missingProductivity,methodology:missingProductivity?'Prazo pendente: há serviços sem coeficiente de produtividade validado.':'Demonstração com sequenciamento conservador; não substitui planejamento executivo.'};
  }
  const withNames=(b)=>({ ...b,client_name:state.clients.find(x=>x.id===b.client_id)?.name||'',project_name:state.projects.find(x=>x.id===b.project_id)?.name||'',total:calc(b).total });
  function handle(path,method,b){
    const u=new URL(path,location.origin),p=u.pathname.split('/').filter(Boolean),kind=p[1],key=p[2],sub=p[3],entry=p[4],which=Number(key);
    if(kind==='auth') return key==='status'?{setupRequired:false,authenticated:true}:{ok:true};
    if(kind==='settings') { if(method==='PUT'){Object.assign(state.settings,b);persist()}return clone(state.settings); }
    if(kind==='dashboard'){
      const budgets=state.budgets.map(withNames).reverse();
      return {counts:{active:budgets.filter(x=>!['Aprovado','Perdido'].includes(x.status)).length,sent:budgets.filter(x=>x.status==='Enviado').length,works:state.projects.filter(x=>x.status==='Em andamento').length,negotiation:budgets.filter(x=>['Enviado','Em análise'].includes(x.status)).reduce((s,x)=>s+x.total,0),clients:state.clients.length},budgets:budgets.slice(0,7),pipeline:['Rascunho','Enviado','Em análise','Aprovado','Perdido'].map(status=>({status,count:budgets.filter(x=>x.status===status).length}))};
    }
    if(kind==='catalog'){
      if(key==='import' && method==='POST'){
        if(!Array.isArray(b.entries) || b.entries.length>3000)throw Error('Máximo de 3000 registros');
        if(b.source==='SIURB'&&b.entries.some(x=>/^DEMO-/i.test(trim(x.code))||/NÃO É SIURB/i.test(trim(x.description))))throw Error('Demonstrações não podem ser SIURB');
        for(const x of b.entries){if(!trim(x.code)||!trim(x.description))continue;const matching=state.catalog.find(c=>c.code===x.code&&c.source===b.source&&c.reference_month===b.reference_month&&c.regime===b.regime);const obj={code:trim(x.code),description:trim(x.description),unit:x.unit||'un',cost:Number(x.cost)||0,hh_per_unit:Number(x.hh_per_unit)||0,category:x.category||'Geral',source:b.source||'PRÓPRIA',reference_month:b.reference_month||'',regime:b.regime||''}; if(matching) Object.assign(matching,obj); else state.catalog.push({...obj,id:id()});}
        persist();return {inserted:b.entries.length};
      }
      const q=(u.searchParams.get('q')||'').toLowerCase();return clone([...state.catalog,...(officialCatalog||[])].filter(x=>(x.description+' '+x.code+' '+x.category+' '+x.regime).toLowerCase().includes(q)));
    }
    if(['clients','projects','budgets'].includes(kind)){
      const arr=state[kind];
      if(kind==='budgets'&&sub==='items'){
        const items=state.items,idx=items.findIndex(x=>x.id===Number(entry)&&x.budget_id===which);
        if(!arr.some(x=>x.id===which))throw Error('Orçamento não encontrado');
        if(method==='POST'){const x={...b,id:id(),budget_id:which,qty:Number(b.qty)||0,unit_cost:Number(b.unit_cost)||0,hh_unit:Number(b.hh_unit)||0};items.push(x);persist();return clone(x);}
        if(method==='PUT'&&idx>=0){Object.assign(items[idx],b,{qty:Number(b.qty)||0,unit_cost:Number(b.unit_cost)||0,hh_unit:Number(b.hh_unit)||0});persist();return clone(items[idx]);}
        if(method==='DELETE'&&idx>=0){items.splice(idx,1);persist();return {ok:true};}
        throw Error('Item não encontrado');
      }
      if(method==='GET'){
        if(key){const row=arr.find(x=>x.id===which);if(!row)throw Error('Registro não encontrado');return clone(kind==='budgets'?calc(row):row);}
        return clone([...arr].reverse().map(row=>kind==='budgets'?withNames(row):kind==='projects'?{...row,client_name:state.clients.find(c=>c.id===row.client_id)?.name||''}:row));
      }
      if(method==='POST'){if(!trim(b.name||b.title))throw Error('Nome/título obrigatório');const row={...b,id:id(),created_at:new Date().toISOString()};if(kind==='budgets'){row.client_id=Number(b.client_id);row.project_id=Number(b.project_id)||null;row.code=`ORC-${new Date().getFullYear()}-${String(arr.length+1).padStart(4,'0')}`;row.bdi=Number(b.bdi)||0;row.workers=Number(b.workers)||2;row.hours_day=Number(b.hours_day)||8;row.efficiency=Number(b.efficiency)||.8;row.safety_pct=Number(b.safety_pct)||0;row.updated_at=new Date().toISOString();}if(kind==='projects')row.client_id=Number(b.client_id);arr.push(row);persist();return clone(kind==='budgets'?calc(row):row);}
      const idx=arr.findIndex(x=>x.id===which);if(idx<0)throw Error('Registro não encontrado');
      if(method==='PUT'){Object.assign(arr[idx],b);if(kind==='budgets'){arr[idx].client_id=Number(arr[idx].client_id);arr[idx].project_id=Number(arr[idx].project_id)||null;arr[idx].updated_at=new Date().toISOString();}if(kind==='projects')arr[idx].client_id=Number(arr[idx].client_id);persist();return clone(kind==='budgets'?calc(arr[idx]):arr[idx]);}
      if(method==='DELETE'){arr.splice(idx,1);if(kind==='budgets')state.items=state.items.filter(x=>x.budget_id!==which);persist();return {ok:true};}
    }
    if(kind==='proposals'){
      if(method==='GET' && !key)return clone([...state.proposals].reverse().map(p=>({id:p.id,budget_id:p.budget_id,code:p.code,created_at:p.created_at,title:state.budgets.find(b=>b.id===p.budget_id)?.title||'',client_name:state.clients.find(x=>x.id===state.budgets.find(b=>b.id===p.budget_id)?.client_id)?.name||''})));
      if(method==='GET'&&key){const p=state.proposals.find(x=>x.id===which);if(!p)throw Error('Proposta não encontrada');return clone(p);}
      if(method==='POST'){
        const budget=state.budgets.find(x=>x.id===Number(b.budget_id));if(!budget)throw Error('Orçamento não encontrado');const data=calc(budget);const report=globalThis.CIVOLTEN_AUDIT(data,state.settings,{demo:true});if(!report.ready)throw Error('Proposta bloqueada pela auditoria: '+report.errors.map(x=>x.message).join(' | '));const p={id:id(),budget_id:budget.id,code:`PROP-${new Date().getFullYear()}-${String(state.proposals.length+1).padStart(4,'0')}`,content:JSON.stringify({...data,company:state.settings,issued_at:new Date().toISOString()}),created_at:new Date().toISOString()};state.proposals.push(p);persist();return clone(p);
      }
    }
    throw Error('Rota de demonstração indisponível');
  }
  const realFetch=window.fetch.bind(window);
  let officialCatalog=null;
  async function loadOfficialCatalog(){
    if(officialCatalog!==null)return;
    try{
      const response=await realFetch('/data/siurb-2026-07.json',{cache:'force-cache'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const payload=await response.json();
      if(payload.meta?.reference_month!=='2026-07'||!Array.isArray(payload.items)||payload.items.length<5000){
        throw Error('Catálogo SIURB incompleto ou inválido');
      }
      officialCatalog=payload.items;
      window.CIVOLTEN_SIURB_META=payload.meta;
    }catch(err){
      officialCatalog=[];
      window.CIVOLTEN_SIURB_META={error:String(err.message||err)};
      console.warn('Catálogo SIURB indisponível; não serão exibidos valores oficiais.',err);
    }
  }
  window.fetch=async function(resource,options={}){
    const url=typeof resource==='string'?resource:resource.url;
    if(!url.startsWith('/api/'))return realFetch(resource,options);
    try {if(url.startsWith('/api/catalog')&&(!options.method||options.method.toUpperCase()==='GET'))await loadOfficialCatalog();const body=options.body?JSON.parse(options.body):{};const result=handle(url,options.method||'GET',body);return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});}
    catch(e){return new Response(JSON.stringify({error:e.message||'Erro de demonstração'}),{status:400,headers:{'Content-Type':'application/json'}});}
  };
  persist();
})();