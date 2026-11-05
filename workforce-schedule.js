/* CIVOLTEN • Planejamento de equipe e cronograma
 * Cinco CARGOS PLANEJADOS (não admissões), cenário Simples IV apenas para simulação.
 * Não usa custo SIURB composto como salário base e não altera propostas antigas. */
(function(){
'use strict';
const money=v=>cash(Number(v)||0), positive=v=>{const n=Number(String(v??'0').replace(',','.'));return Number.isFinite(n)&&n>0?n:0};
const round=v=>Math.round((Number(v)||0)*100)/100;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const roleKey=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'profissional';
const roleName=v=>v?.role||v?.name||'Profissional';
const wageProfiles=[
 {id:'model-elect-01',name:'Modelo • Eletricista 01',role:'Eletricista',salary:3500},
 {id:'model-mason-01',name:'Modelo • Pedreiro 01',role:'Pedreiro',salary:3200},
 {id:'model-mason-02',name:'Modelo • Pedreiro 02',role:'Pedreiro',salary:3200},
 {id:'model-helper-01',name:'Modelo • Ajudante 01',role:'Ajudante',salary:2200},
 {id:'model-helper-02',name:'Modelo • Ajudante 02',role:'Ajudante',salary:2200}
];
const profiles={mei:{label:'MEI (até 1 empregado, na forma legal)',cpp:3,rat:0},
 simples4:{label:'Simples Nacional — Anexo IV (simulação)',cpp:20,rat:2},
 simplesDemais:{label:'Simples Nacional — outros anexos (confirmar)',cpp:0,rat:0},
 custom:{label:'Personalizado por contador',cpp:20,rat:2}};
function currentProfile(){return profiles[db.company.workforceScenario]||profiles.simples4}
function defaultsForScenario(){const v=currentProfile();return {fgts:8,employerInss:v.cpp,employerExtraPercent:v.rat};}
function payroll(w){
 const base=positive(w.salary),thirteenth=base/12,third=base/36,benefits=positive(w.mealBenefit)+positive(w.transportBenefit)+positive(w.otherBenefit)+positive(w.monthlyReserve);
 const fgts=w.fgts!==undefined?positive(w.fgts):8,cpp=w.employerInss!==undefined?positive(w.employerInss):defaultsForScenario().employerInss,other=positive(w.employerExtraPercent);
 const charges=(base+thirteenth+third)*(fgts+cpp+other)/100;
 const total=base+thirteenth+third+charges+benefits;
 const hours=positive(w.productiveHours)||160;
 return {base,thirteenth,third,charges,benefits,total:round(total),hourly:total/hours,hours};
}
function hourly(w){
 if(!w)return 0;
 if(w.link==='Empregado'||w.employmentType==='CLT')return positive(w.salary)?payroll(w).hourly:positive(w.cost)/(positive(w.productiveHours)||160);
 if(w.unit==='mês')return positive(w.cost)/(positive(w.productiveHours)||160);
 if(w.unit==='diária')return positive(w.cost)/(positive(w.dailyHours)||8);
 return positive(w.cost);
}
function initialize(){
 db.company.workforceScenario ||= 'simples4'; // Apenas cenário; NÃO altera o enquadramento tributário atual.
 if(db.company.workforceModelVersion)return;
 const extras=defaultsForScenario();
 for(const demo of wageProfiles){
  if(db.workers.some(w=>w.id===demo.id||w.presetModelId===demo.id))continue;
  const worker={...demo,presetModelId:demo.id,employmentStatus:'planejado',
   link:'Empregado',employmentType:'CLT',costModel:'demonstracao',unit:'mês',
   fgts:extras.fgts,employerInss:extras.employerInss,employerExtraPercent:extras.employerExtraPercent,
   productiveHours:160,mealBenefit:0,transportBenefit:0,otherBenefit:0,monthlyReserve:0,
   notes:'Perfil de planejamento, não significa empregado contratado. Valores salariais ilustrativos.'};
  const p=payroll(worker);worker.cost=p.total;worker.costPerHour=round(p.hourly);
  db.workers.push(worker);
 }
 db.company.workforceModelVersion='2026-11-05-demo-1';
 save();
}
initialize();
function countStatus(status){return db.workers.filter(w=>(w.employmentStatus||'cadastrado')===status&&w.link==='Empregado').length}
const oldWorkerRoute=ROUTES.workers;
ROUTES.workers=function(){
 let html=oldWorkerRoute();
 const team=db.workers.filter(w=>w.presetModelId||w.employmentStatus==='planejado');
 const planned=team.reduce((n,w)=>n+(w.link==='Empregado'?payroll(w).total:positive(w.cost)),0);
 const personRows=team.map(w=>{const p=w.link==='Empregado'?payroll(w):{total:positive(w.cost),hourly:hourly(w),base:positive(w.cost),charges:0};
  return '<div class="wp-line"><span><b>'+esc(w.role)+'</b><small>'+esc(w.name)+' • '+esc(w.employmentStatus||'planejado')+'</small></span><span><b>'+money(p.total)+'/mês</b><small>'+money(p.hourly)+'/h</small></span></div>';
 }).join('');
 const selection='<option value="mei" '+(db.company.workforceScenario==='mei'?'selected':'')+'>MEI — máximo 1 empregado</option>'+
 '<option value="simples4" '+(db.company.workforceScenario==='simples4'?'selected':'')+'>Simples Nacional — Anexo IV (simulado)</option>'+
 '<option value="simplesDemais" '+(db.company.workforceScenario==='simplesDemais'?'selected':'')+'>Simples — demais anexos (confirmar)</option>'+
 '<option value="custom" '+(db.company.workforceScenario==='custom'?'selected':'')+'>Personalizado pelo contador</option>';
 const catalog=(db.siurbLabor||[]),matching=catalog.slice(0,25);
 const refs='<section class="form-card wp-panel"><h3>Profissões e custos de referência SIURB</h3>'+
 '<p class="wp-muted">Consulte as profissões importadas da SIURB (mensalistas e horistas). O valor divulgado pode incluir encargos: NÃO é salário-base automaticamente.</p>'+
 '<input class="input" id="wp-siurb-search" placeholder="Buscar profissão na SIURB..." autocomplete="off">'+
 '<div id="wp-siurb-results">'+matching.map(wpLaborHit).join('')+'</div>'+
 '<p class="wp-muted">'+catalog.length+' registros de referência importados neste dispositivo. Importe a planilha na ficha do profissional se ainda estiver vazio.</p></section>';
 const panel='<section class="form-card wp-panel"><h3>Equipe modelo • Planejamento mensal</h3>'+
 '<p class="wp-muted">Cinco postos fictícios: 1 eletricista, 2 pedreiros e 2 ajudantes. NÃO são empregados admitidos. Edite salários e encargos em cada cadastro para simular sua empresa.</p>'+
 '<label class="label">Cenário de encargos da equipe (sem mudar o cadastro tributário da empresa)</label><select id="wp-regime" class="input">'+selection+'</select>'+
 '<button type="button" class="btn btn-outline block" data-action="wp-apply-regime">Aplicar encargos deste cenário apenas aos modelos planejados</button>'+
 (db.company.taxRegime==='MEI'&&countStatus('ativo')>1?'<p class="wp-warning">Atenção: mais de um empregado ativo não é compatível com MEI. Confirme regularização com contador.</p>':'')+
 '<p class="wp-warning">MEI permite até 1 empregado. Para 5 CLT, este painel usa cenário empresarial de simulação. Construção civil no Anexo IV pode recolher CPP fora do DAS. RAT e outras incidências exigem validação profissional.</p>'+
 '<div class="wp-headline"><span>Folha mensal simulada (5 postos)</span><strong>'+money(planned)+'</strong></div>'+
 '<p class="wp-muted">Não some esta folha mais uma vez aos custos fixos: as horas desses profissionais já entram como mão de obra nos serviços e orçamentos. Alimentação e deslocamento de cada obra continuam separados se não forem benefícios já provisionados.</p>'+
 personRows+
 '<p class="wp-muted">SIURB: as referências importadas de mensalistas/horistas ficam disponíveis na consulta, mas seus custos publicados não são tratados como salário-base CLT automaticamente.</p></section>';
 return html.replace('<main class="sheet full">','<main class="sheet full">'+panel+refs);
};
function wpLaborHit(w){
 return '<div class="wp-line"><span><b>'+esc(w.name)+'</b><small>'+esc(w.kind||'SIURB')+' · '+esc(w.unit||'un')+'</small></span>'+
 '<span><b>'+money(w.cost)+'</b><button class="btn btn-outline" type="button" data-action="wp-copy-role" data-id="'+esc(w.id)+'">Criar cargo modelo</button></span></div>';
}
const oldExpenseRoute=ROUTES.expenses;
ROUTES.expenses=function(){
 const html=oldExpenseRoute();
 const planned=db.workers.filter(w=>w.presetModelId||w.employmentStatus==='planejado');
 const payrollCost=planned.reduce((sum,w)=>sum+(w.link==='Empregado'?payroll(w).total:positive(w.cost)),0);
 const generalFixed=(db.expenses||[]).filter(e=>e.scope==='fixed').reduce((sum,e)=>sum+positive(e.cost),0);
 return html.replace('<main class="sheet full">','<main class="sheet full"><section class="form-card wp-panel"><h3>Equipe e despesas da empresa</h3><div class="wp-headline"><span>Folha mensal estimada da equipe planejada</span><strong>'+money(payrollCost)+'</strong></div>'+
 '<div class="wp-line"><span>Despesas fixas e meta de pró-labore</span><b>'+money(generalFixed)+'</b></div>'+
 '<div class="wp-headline"><span>Necessidade de caixa mensal simulada (se os 5 forem contratados)</span><strong>'+money(generalFixed+payrollCost)+'</strong></div><p class="wp-muted">Este valor está separado dos fixos e pró-labore para evitar dupla contagem. É recuperado pelos custos/hora dos serviços efetivamente orçados. Para funcionários sem alocação e pagos no mês, considere a ociosidade no planejamento financeiro geral.</p></section>');
};
const origModal=modalUI,origSubmit=modalSubmit;
modalUI=function(){
 let html=origModal();
 if(s.modal!=='addworker')return html;
 const w=s.edit||{};
 const current=w.employmentStatus||'cadastrado';
 const preset='<label class="label">Situação do posto</label><select name="employmentStatus" class="input">'+
 ['planejado','ativo','cadastrado'].map(v=>'<option value="'+v+'" '+(v===current?'selected':'')+'>'+({planejado:'Planejado (não admitido)',ativo:'Empregado ativo — confirmar registro',cadastrado:'Cadastro de referência'}[v])+'</option>').join('')+'</select>'+
 '<p class="wp-muted">Salário e encargos são recalculados ao salvar. Este registro não substitui eSocial nem folha de pagamento.</p>';
 const ix=html.lastIndexOf('<div class="form-actions">');if(ix>=0)html=html.slice(0,ix)+preset+html.slice(ix);
 // Novos CLT adotam parâmetros simulados selecionados, sem alterar pessoas já existentes.
 if(!s.edit&&db.company.taxRegime!=='MEI'&&db.company.workforceScenario!=='mei'){
  html=html.replace(/(name="employerInss"[^>]*value=")3(")/,'$1'+currentProfile().cpp+'$2');
  html=html.replace(/(name="employerExtraPercent"[^>]*value=")0(")/,'$1'+currentProfile().rat+'$2');
 }
 return html;
};
modalSubmit=function(form){
 if(s.modal!=='addworker')return origSubmit(form);
 const previously=s.edit?.id;
 origSubmit(form);
 if(previously){
  const w=db.workers.find(x=>x.id===previously);
  if(w&&w.link==='Empregado'&&positive(w.salary)){
   const p=payroll(w);w.cost=p.total;w.costPerHour=round(p.hourly);save();
  }
 }
};
function changeScenario(){
 const el=document.getElementById('wp-regime');if(!el)return;
 const value=el.value;if(!profiles[value])return;
 db.company.workforceScenario=value;
 const p=profiles[value];
 for(const w of db.workers.filter(w=>w.presetModelId&&w.employmentStatus==='planejado')){
  w.employerInss=p.cpp;w.employerExtraPercent=p.rat;w.fgts=8;
  const c=payroll(w);w.cost=c.total;w.costPerHour=round(c.hourly);
 }
 save();render();toast('Parâmetros aplicados somente aos cargos planejados.');
}
/* Cronograma considera as necessidades de cargo independentemente do número de cadastros. */
function workDate(input){
 const d=new Date((input||new Date().toISOString().slice(0,10))+'T12:00:00');
 if(!Number.isFinite(d.getTime()))return workDate(new Date().toISOString().slice(0,10));
 while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1);
 return d;
}
function nextDay(d){
 const dt=new Date(d.getTime());dt.setDate(dt.getDate()+1);
 while(dt.getDay()===0||dt.getDay()===6)dt.setDate(dt.getDate()+1);
 return dt;
}
function workdayAfter(d,days){
 let date=workDate(d.toISOString().slice(0,10));
 for(let i=1;i<Math.max(1,Math.ceil(days));i++)date=nextDay(date);
 return date;
}
function iso(d){return d.toISOString().slice(0,10)}
function dateBR(d){return new Date(iso(d)+'T12:00:00').toLocaleDateString('pt-BR')}
function roleOf(workerId,fall){return db.workers.find(w=>w.id===workerId)?.role||fall||'Profissional não definido'}
function cleanItemCrew(item){
 const snapshot=item.productivity?.crew||[];
 if(snapshot.length)return snapshot.map(row=>({role:roleOf(row.workerId,row.workerName),workerId:row.workerId,
  perUnitHours:positive(row.perUnitHours??row.hours),count:positive(row.count)||1,rate:positive(row.rate)||hourly(db.workers.find(w=>w.id===row.workerId))}))
 .filter(x=>x.perUnitHours>0);
 if(item.workerId&&positive(item.hoursUnit))return [{role:roleOf(item.workerId),workerId:item.workerId,
  perUnitHours:positive(item.hoursUnit),count:positive(item.workersCount)||1,rate:hourly(db.workers.find(w=>w.id===item.workerId))}];
 return [];
}
function ensureSchedule(q){
 if(!q)return null;
 if(!q.schedule){
  const defaults={startDate:new Date().toISOString().slice(0,10),targetDays:15,productiveHoursDay:7,
  paidHoursDay:8,mode:'parallel',staffOverrides:{},dedicated:false,confirmed:false};
  if(q.id&&q!==s.wizard)return defaults; // Consulta não altera orçamento salvo.
  q.schedule=defaults;
 }
 return q.schedule;
}
function calculate(q){
 const sch=ensureSchedule(q);const days=Math.max(1,Math.min(365,Math.ceil(positive(sch.targetDays)||15)));
 const productive=positive(sch.productiveHoursDay)||7,paid=positive(sch.paidHoursDay)||8,parallel=sch.mode!=='sequential';
 const lines=[],roles=new Map();let missing=0;
 for(const item of q.items||[]){
  const crew=cleanItemCrew(item),qty=positive(item.qty);
  if(!crew.length){missing++;lines.push({item,missing:true,roles:[],qty,duration:0});continue}
  const demands=crew.map(x=>({role:x.role,key:roleKey(x.role),hours:qty*x.perUnitHours*x.count,rate:x.rate,baseCount:x.count}));
  for(const r of demands){
   if(!roles.has(r.key))roles.set(r.key,{key:r.key,name:r.role,hours:0,rates:[],baseCount:0});
   const o=roles.get(r.key);o.hours+=r.hours;o.baseCount=Math.max(o.baseCount,r.baseCount);
   if(r.rate>0)o.rates.push(r.rate);
  }
  lines.push({item,qty,roles:demands,missing:false});
 }
 const staffing=[...roles.values()].map(r=>{
  const recommended=Math.max(1,Math.ceil(r.hours/(days*productive)));
  const assigned=Math.max(1,Math.ceil(positive(sch.staffOverrides?.[r.key])||recommended));
  const profilesForRole=db.workers.filter(w=>roleKey(w.role)===r.key);
  const planned=profilesForRole.filter(w=>w.employmentStatus==='planejado').length;
  const active=profilesForRole.filter(w=>w.employmentStatus==='ativo').length;
  const validRates=r.rates.filter(x=>x>0),ref=validRates.length?Math.max(...validRates):0;
  return {...r,recommended,assigned,planned,active,shortfall:Math.max(0,assigned-active),
   rate:ref};
 });
 const assignedByRole=new Map(staffing.map(x=>[x.key,x.assigned]));
 const begin=workDate(sch.startDate);
 // Escalonamento conservador de recursos: frentes com a MESMA função não
 // ocupam simultaneamente a mesma equipe. Frentes com funções distintas podem
 // ocorrer em paralelo. Este é um cronograma estimado, não caminho crítico CPM.
 const roleAvailable=new Map();let serialOffset=0,projectDays=0,last=begin;
 for(const row of lines){
  if(row.missing)continue;
  const duration=Math.max(1,Math.ceil(Math.max(...row.roles.map(x=>x.hours/((assignedByRole.get(x.key)||1)*productive)))));
  const earliest=parallel?Math.max(0,...row.roles.map(x=>roleAvailable.get(x.key)||0)):serialOffset;
  row.duration=duration;row.startOffset=earliest;row.endOffset=earliest+duration;
  row.start=workdayAfter(begin,earliest+1);row.end=workdayAfter(begin,row.endOffset);
  for(const role of row.roles)roleAvailable.set(role.key,row.endOffset);
  if(!parallel)serialOffset=row.endOffset;
  projectDays=Math.max(projectDays,row.endOffset);
  if(row.end>last)last=row.end;
 }
 const budgetLabor=(q.items||[]).reduce((sum,item)=>sum+positive(item.qty)*positive(item.labor),0);
 const unknownCost=staffing.some(x=>x.rate<=0);
 const committedDays=Math.max(days,projectDays);
 const committed=(sch.dedicated&&!missing&&!unknownCost)?staffing.reduce((sum,r)=>sum+r.assigned*committedDays*paid*r.rate,0):0;
 const reserve=sch.dedicated&&!unknownCost&&!missing?Math.max(0,committed-budgetLabor):0;
 return {days,committedDays,productive,paid,parallel,lines,staffing,missing,begin,last,projectDays,budgetLabor,committed,reserve,unknownCost};
}
function updateReserve(q){
 if(!q||q!==s.wizard)return;
 const sc=calculate(q);
 if(q.schedule){q.schedule.estimatedDays=sc.projectDays;q.schedule.recommendedPeople=sc.staffing.reduce((sum,r)=>sum+r.assigned,0);}
 q.scheduleExtraCost=(q.schedule?.dedicated&&!sc.missing&&!sc.unknownCost)?round(sc.reserve):0;
 keepTemp();
}
function chooseQuote(){if(s.wizard?.items)return s.wizard;
 const q=db.quotes.find(x=>x.id===selectedQuoteId)||db.quotes[0];
 return q||null;}
let selectedQuoteId='';
function scheduleView(){
 const q=chooseQuote(),editable=!!s.wizard?.items;
 if(!q)return '<section class="screen">'+pageTop('Cronograma','Planejamento por produtividade')+'<main class="sheet full"><div class="empty">Crie um orçamento com serviços para gerar o cronograma.</div></main></section>';
 const schedule=ensureSchedule(q),forecast=calculate(q);
 if(editable)updateReserve(q);
 const formatTime=hours=>hours.toLocaleString('pt-BR',{maximumFractionDigits:1});
 const label='<div class="wp-warning">Cronograma estimado por coeficientes de produtividade. Dias úteis de segunda a sexta, sem considerar feriados, chuva, deslocamentos, acesso ou folgas. Ajuste e confirme antes da proposta.</div>';
 const hdr='<div class="form-card"><h3>Obra: '+esc(q.title||q.number||'Orçamento em elaboração')+'</h3>'+label+
 (editable?'<div class="grid-duo">'+field('Início previsto','wfStartDate','',''+schedule.startDate,'date')+
 field('Prazo desejado (dias úteis)','wfDays','15',schedule.targetDays,'number')+
 field('Horas produtivas/dia por pessoa','wfProductive','7',schedule.productiveHoursDay,'number')+
 field('Horas remuneradas/dia','wfPaid','8',schedule.paidHoursDay,'number')+'</div>'+
 '<label class="label">Modelo de execução</label><select class="input" name="wfMode">'+
 '<option value="parallel" '+(schedule.mode==='parallel'?'selected':'')+'>Frentes paralelas (sem sobrepor a mesma função)</option>'+
 '<option value="sequential" '+(schedule.mode==='sequential'?'selected':'')+'>Etapas sequenciais</option></select>':
 '<p>Início: '+esc(schedule.startDate)+' · Prazo desejado: '+forecast.days+' dias úteis</p>')+'</div>';
 const resourceTable='<div class="form-card"><h3>Equipe necessária por função</h3>'+
 (forecast.staffing.length?forecast.staffing.map(r=>'<div class="wp-role"><strong>'+esc(r.name)+'</strong>'+
 '<div><span>Carga: '+formatTime(r.hours)+' horas-homem</span><span>Equipe sugerida: '+r.recommended+'</span><span>Postos planejados: '+r.planned+'</span><span>Registrados como ativos: '+r.active+'</span></div>'+
 (editable?'<label>Equipe a alocar: <input type="number" min="1" max="100" step="1" class="input" data-wf-role="'+esc(r.key)+'" value="'+r.assigned+'"></label>':'<p>Equipe calculada: '+r.assigned+'</p>')+
 '<small>Valor de referência do posto: '+money(r.rate)+'/hora. A necessidade independe dos profissionais cadastrados.</small></div>').join(''):'<p class="wp-warning">Nenhuma produtividade encontrada para os serviços. Configure a equipe e as horas por unidade em Mais → Serviços.</p>')+
 '</div>';
 const rows=forecast.lines.map((t,i)=>'<div class="wp-schedule-row"><b>'+esc(t.item.service)+'</b>'+
 (t.missing?'<small class="wp-warning">Sem produtividade conferida — duração não calculada.</small>':
 '<small>'+t.qty+' '+esc(t.item.unit)+' · '+t.duration+' dia(s) úteis · '+dateBR(t.start)+' a '+dateBR(t.end)+'</small>'+
 '<div class="wp-gantt-track"><span class="wp-gantt-bar" style="left:'+Math.max(0,100*t.startOffset/Math.max(1,forecast.projectDays))+
 '%;width:'+Math.min(100,100*t.duration/Math.max(1,forecast.projectDays))+'%"></span></div>')+'</div>').join('');
 const deadline=forecast.projectDays>forecast.days?'O cronograma estimado excede o prazo desejado. Ajuste equipe, dependências ou prazo.':'Estimativa dentro do prazo desejado, sujeita a validação de campo.';
 const summary='<div class="form-card"><h3>Cronograma por serviço</h3>'+
 '<div class="wp-headline"><span>Duração calculada</span><strong>'+forecast.projectDays+' dias úteis</strong></div>'+
 '<p class="'+(forecast.projectDays>forecast.days?'wp-warning':'wp-muted')+'">'+deadline+'</p>'+
 (forecast.missing?'<p class="wp-warning">'+forecast.missing+' item(ns) sem produtividade. Não é possível garantir o prazo.</p>':'')+
 rows+'</div>';
 const extra=editable?'<div class="form-card"><h3>Alocação e proteção do orçamento</h3>'+
 '<label class="wp-check"><input type="checkbox" name="wfDedicated" '+(schedule.dedicated?'checked':'')+'> Equipe exclusiva e remunerada durante todos os '+forecast.days+' dias úteis</label>'+
 '<p class="wp-muted">Se ativado, considera '+forecast.paid+' horas pagas por pessoa e dia pelo maior período entre o prazo desejado e o calculado; a diferença acima da mão de obra já orçada vira custo adicional de disponibilidade. Se a equipe trabalhar só nas horas produtivas do serviço, mantenha desligado.</p>'+
 '<div class="wp-headline"><span>Adicional de equipe dedicada</span><strong>'+money(forecast.reserve)+'</strong></div>'+
 (forecast.unknownCost?'<p class="wp-warning">Há função sem custo/hora cadastrado. Complete o valor antes de contratar equipe dedicada.</p>':'')+
 '<label class="wp-check"><input type="checkbox" name="wfConfirmed" '+(schedule.confirmed?'checked':'')+'> Conferi produtividade, equipe, calendário e despesas desta obra</label>'+
 '<button class="btn btn-gold block" type="button" data-action="wf-save">Salvar cronograma no orçamento</button>'+
 '<button class="btn btn-outline block" type="button" data-action="wf-back">Voltar ao orçamento</button></div>':
 '<div class="form-card"><p class="wp-muted">Cronograma salvo como planejamento. Para editar equipe ou custo, abra o orçamento em modo de edição.</p>'+
 '<button class="btn btn-outline block" data-action="wf-edit-quote" data-id="'+esc(q.id)+'">Editar orçamento e cronograma</button></div>';
 const selector=!editable&&db.quotes.length>1?'<div class="form-card"><label class="label">Escolher orçamento</label><select class="input" id="wfQuote">'+
 db.quotes.map(x=>'<option value="'+esc(x.id)+'" '+(q.id===x.id?'selected':'')+'>'+esc(x.number||x.title)+'</option>').join('')+'</select></div>':'';
 return '<section class="screen">'+pageTop('Cronograma da obra','Equipe, produtividade, prazo e custos',true)+
 '<main class="sheet full">'+selector+hdr+resourceTable+summary+extra+'</main></section>';
}
ROUTES.schedule=scheduleView;
const moreRoute=ROUTES.more;
ROUTES.more=function(){
 const html=moreRoute();
 const card='<button class="simple-item config-row" data-page="schedule"><span class="simple-ic">'+I('calendar')+'</span>'+
 '<span class="simple-content"><strong>Cronograma e equipe</strong><small>Dias úteis, produtividade, pessoal e custo</small></span>'+I('chevron')+'</button>';
 return html.replace('<div class="group-list">','<div class="group-list">'+card);
};
const step2Original=wizardStep2;
wizardStep2=function(){
 let html=step2Original();
 if(!s.wizard)return html;
 const schedule=ensureSchedule(s.wizard),view=calculate(s.wizard);
 const card='<div class="form-card"><h3 class="card-title">'+I('calendar')+' Cronograma e dimensionamento</h3>'+
 '<p class="wp-muted">Prazo desejado: '+view.days+' dias úteis · previsão com a equipe: '+view.projectDays+' dias. Serviços sem produtividade: '+view.missing+'.</p>'+
 '<button class="btn btn-outline block" type="button" data-action="wf-open">Abrir cronograma e ajustar equipe</button></div>';
 const anchor=html.lastIndexOf('<div class="form-actions">');
 return anchor>=0?html.slice(0,anchor)+card+html.slice(anchor):card+html;
};
const previousReview=wizardStep3;
wizardStep3=function(){
 if(s.wizard?.schedule?.dedicated)updateReserve(s.wizard);
 const html=previousReview();
 if(s.wizard?.schedule?.dedicated){
  const c=calculate(s.wizard);
  const msg='<div class="form-card"><h3>Custo de equipe alocada</h3>'+
   '<div class="wp-headline"><span>Custo adicional de dedicação da equipe</span><strong>'+money(c.reserve)+'</strong></div>'+
   '<p class="wp-muted">O complemento da equipe exclusiva à obra já entra no custo total, sem duplicar a mão de obra por produtividade.</p>'+
   (c.projectDays>c.days?'<p class="wp-warning">O cronograma excede '+c.days+' dias úteis desejados.</p>':'')+'</div>';
  return msg+html;
 }
 return html;
};
const workerSubmit=modalSubmit;
modalSubmit=function(form){
 if(s.modal==='addworker'){
  const roleNameInput=form.elements.role?.value;
  if(form.elements.link?.value==='Empregado'&&form.elements.employmentStatus?.value==='ativo'&&db.company.taxRegime==='MEI'){
   const otherActives=countStatus('ativo')-(s.edit?.employmentStatus==='ativo'?1:0);
   if(otherActives>=1){toast('MEI permite apenas um empregado ativo. Marque como planejado ou revise o regime tributário.');return}
  }
 }
 return workerSubmit(form);
};
const persistOriginal=persistWizard;
persistWizard=function(){
 if(s.wizard?.schedule?.dedicated){
  const view=calculate(s.wizard);
  if((view.missing||view.unknownCost)&&s.wizard.status!=='Rascunho'){toast('Há produtividade ou custo da equipe faltando no cronograma.');return}
  if(view.projectDays>view.days&&s.wizard.status!=='Rascunho'){toast('O cronograma excede o prazo desejado. Confira a equipe e as datas antes de emitir.');return}
  updateReserve(s.wizard);
 }
 return persistOriginal();
};
document.addEventListener('change',e=>{
 if(e.target.id==='wfQuote'){selectedQuoteId=e.target.value;render();return}
 if(s.page!=='schedule'||!s.wizard?.items)return;
 const sch=ensureSchedule(s.wizard);
 if(e.target.name==='wfMode'){sch.mode=e.target.value;sch.confirmed=false;updateReserve(s.wizard);render();return}
 if(e.target.name==='wfDedicated'){sch.dedicated=e.target.checked;sch.confirmed=false;updateReserve(s.wizard);render();return}
 if(e.target.name==='wfConfirmed'){sch.confirmed=e.target.checked;keepTemp();return}
 if(['wfStartDate','wfDays','wfProductive','wfPaid'].includes(e.target.name)||e.target.dataset.wfRole){
  sch.confirmed=false;updateReserve(s.wizard);render();return;
 }
},true);
document.addEventListener('input',e=>{
 if(e.target.id==='wp-siurb-search'){
  const q=norm(e.target.value),list=(db.siurbLabor||[]).filter(x=>norm(x.name+' '+x.code).includes(q)).slice(0,25);
  const box=document.getElementById('wp-siurb-results');
  if(box)box.innerHTML=list.map(wpLaborHit).join('')||'<p class="wp-muted">Nenhuma profissão encontrada.</p>';
  return;
 }
 if(s.page!=='schedule'||!s.wizard?.items)return;
 const sch=ensureSchedule(s.wizard);
 if(e.target.name==='wfStartDate')sch.startDate=e.target.value;
 if(e.target.name==='wfDays')sch.targetDays=Math.max(1,Math.min(365,positive(e.target.value)||15));
 if(e.target.name==='wfProductive')sch.productiveHoursDay=Math.max(1,Math.min(12,positive(e.target.value)||7));
 if(e.target.name==='wfPaid')sch.paidHoursDay=Math.max(1,Math.min(12,positive(e.target.value)||8));
 if(e.target.dataset.wfRole)sch.staffOverrides[e.target.dataset.wfRole]=Math.max(1,Math.ceil(positive(e.target.value)||1));
 sch.confirmed=false;updateReserve(s.wizard);
},true);
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(action==='wp-apply-regime'){e.preventDefault();e.stopPropagation();changeScenario();return}
 if(action==='wp-copy-role'){
  e.preventDefault();e.stopPropagation();
  const reference=(db.siurbLabor||[]).find(w=>w.id===el.dataset.id);
  if(!reference)return;
  const role=reference.name;
  const example={id:'model-siurb-'+Math.random().toString(36).slice(2),name:'Modelo • '+role,role,
   employmentStatus:'planejado',link:'Empregado',employmentType:'CLT',salary:0,fgts:8,
   employerInss:currentProfile().cpp,employerExtraPercent:currentProfile().rat,productiveHours:160,
   cost:0,costPerHour:0,siurbReferenceId:reference.id,siurbReferenceCost:reference.cost,
   notes:'SIURB usada apenas como custo de referência, NÃO como salário-base.'};
  db.workers.push(example);save();s.edit=example;s.modal='addworker';render();
  toast('Cargo modelo criado. Informe o salário-base antes de usar no orçamento.');return;
 }
 if(action==='wf-open'){e.preventDefault();e.stopPropagation();go('schedule');return}
 if(action==='wf-back'){e.preventDefault();e.stopPropagation();go('newquote');s.step=2;render();return}
 if(action==='wf-save'){e.preventDefault();e.stopPropagation();if(!s.wizard)return;
  const sch=ensureSchedule(s.wizard);const view=calculate(s.wizard);
  if(view.missing){toast('Há itens sem produtividade. Configure os serviços antes de confirmar.');return}
  if(view.projectDays>view.days){toast('Prazo estimado acima do desejado. Ajuste equipe ou prazo.');return}
  if(!sch.confirmed){toast('Confirme produtividade, equipe, calendário e despesas.');return}
  if(sch.dedicated&&view.unknownCost){toast('Equipe dedicada exige custo/hora para cada função.');return}
  sch.savedAt=new Date().toISOString();
  updateReserve(s.wizard);keepTemp();go('newquote');s.step=2;render();
  toast('Cronograma salvo no rascunho.');return;
 }
 if(action==='wf-edit-quote'){e.preventDefault();e.stopPropagation();
  const q=db.quotes.find(x=>x.id===el.dataset.id);if(!q)return;
  editQuote(q);go('schedule');return;
 }
},true);
const style=document.createElement('style');
style.textContent='.wp-panel{margin:12px 0}.wp-panel h3{font-size:17px;margin:7px 0 12px}.wp-muted{font-size:12px;line-height:1.5;color:#746b5a;margin:8px 0}.wp-warning{background:#fff0df;color:#8a3c14;font-size:12px;border-radius:11px;padding:11px;margin:9px 0;line-height:1.5}.wp-headline{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:13px;background:#fff3d9;border-radius:12px;font-size:13px;margin:12px 0}.wp-headline strong{font-size:15px}.wp-line{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e8e3da;padding:10px 0}.wp-line span{flex:1}.wp-line span:last-child{text-align:right}.wp-line b{display:block;font-size:12px}.wp-line small{display:block;color:#726b5e;font-size:10px}.wp-role{padding:13px 0;border-bottom:1px solid #e0d8ca}.wp-role strong{font-size:14px}.wp-role div{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;font-size:11px;color:#666}.wp-role small{display:block;color:#666;font-size:11px}.wp-role input{max-width:90px}.wp-check{display:flex;gap:10px;align-items:flex-start;margin:11px 0;font-size:12px}.wp-check input{accent-color:#bc8b24;min-width:19px;min-height:19px}.wp-schedule-row{padding:12px 0;border-bottom:1px solid #eee}.wp-schedule-row b{display:block;font-size:13px}.wp-schedule-row small{display:block;color:#6c6354;font-size:11px;margin-top:5px}.wp-gantt-track{position:relative;display:block;height:13px;border-radius:6px;background:#eee9df;margin:9px 0 2px;overflow:hidden}.wp-gantt-bar{display:block;position:absolute;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#bf8d24,#eac16e)}';
document.head.append(style);
})();