/* CIVOLTEN — modelos editáveis de despesas 2026.
   São estimativas fictícias de planejamento, NÃO comprovantes ou custos reais.
   Dados existentes e orçamentos emitidos não são sobrescritos. */
(function(){
 'use strict';
 const fmt=v=>cash(Number(v)||0);
 const amount=v=>{const n=Number(String(v??0).replace(',','.'));return Number.isFinite(n)&&n>=0?n:0};
 const fixedCodes=[
  {code:'prolabore',name:'Pró-labore desejado — meta mensal',category:'Gestão / retirada desejada',cost:10000,unit:'mês',kind:'owner-target'},
  {code:'das-mei',name:'DAS MEI — serviços (2026)',category:'Tributos fixos',cost:86.05,unit:'mês'},
  {code:'contabilidade',name:'Contabilidade / assessoria',category:'Administração',cost:250,unit:'mês'},
  {code:'celular',name:'Celular e comunicação',category:'Comunicação',cost:100,unit:'mês'},
  {code:'internet',name:'Internet e conectividade',category:'Comunicação',cost:130,unit:'mês'},
  {code:'software',name:'Aplicativos e softwares',category:'Administração',cost:95,unit:'mês'},
  {code:'epi',name:'Reposição de EPIs e uniformes',category:'Segurança',cost:200,unit:'mês'},
  {code:'ferramentas',name:'Manutenção e reposição de ferramentas',category:'Equipamentos',cost:280,unit:'mês'},
  {code:'seguro',name:'Reserva para seguro operacional',category:'Seguros',cost:180,unit:'mês'},
  {code:'veiculo-fixo',name:'Seguro / IPVA / manutenção fixa do veículo',category:'Veículo',cost:400,unit:'mês'},
  {code:'administracao',name:'Escritório e despesas administrativas',category:'Administração',cost:300,unit:'mês'},
  {code:'energia',name:'Água e energia da base',category:'Estrutura',cost:140,unit:'mês'}
 ];
 const jobCodes=[
  {code:'almoco',name:'Almoço da equipe (por refeição)',category:'Alimentação',cost:32,unit:'refeição',applyDefault:true,qty:1,people:1,days:1},
  {code:'km-obra',name:'Deslocamento com veículo (por km)',category:'Transporte',cost:1.10,unit:'km',applyDefault:true,qty:20,people:1,days:1},
  {code:'agua',name:'Água e lanches na obra',category:'Alimentação',cost:8,unit:'pessoa/dia',applyDefault:false,qty:1,people:1,days:1},
  {code:'estacionamento',name:'Estacionamento da obra',category:'Transporte',cost:22,unit:'diária',applyDefault:false,qty:1,people:1,days:1},
  {code:'pedagio',name:'Pedágios da obra',category:'Transporte',cost:18,unit:'passagem',applyDefault:false,qty:1,people:1,days:1},
  {code:'frete',name:'Frete e retirada de materiais',category:'Logística',cost:150,unit:'viagem',applyDefault:false,qty:1,people:1,days:1},
  {code:'locacao',name:'Locação de equipamento',category:'Equipamentos',cost:95,unit:'diária',applyDefault:false,qty:1,people:1,days:1},
  {code:'hospedagem',name:'Hospedagem da equipe',category:'Viagem',cost:180,unit:'pessoa/noite',applyDefault:false,qty:1,people:1,days:1},
  {code:'descarte',name:'Descarte de resíduos e entulho',category:'Resíduos',cost:140,unit:'viagem',applyDefault:false,qty:1,people:1,days:1}
 ];
 const presetVersion='2026-11-05';
 function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
 function seedOnce(){
  if(db.company?.expensePresetVersion)return false;
  let added=0;
  const existing=db.expenses||[];
  for(const o of [...fixedCodes,...jobCodes]){
   if(o.code==='das-mei'&&db.company?.taxRegime!=='MEI')continue;
   if(existing.some(e=>e.presetCode===o.code))continue;
   const owned= o.code==='prolabore'?existing.find(e=>normalize(e.name).includes('pro-labore')||normalize(e.name).includes('prolabore')):null;
   if(owned){
    owned.scope='fixed';owned.kind='owner-target';owned.presetCode='prolabore';
    owned.cost=10000; // meta expressamente solicitada pelo usuário
    continue;
   }
   const das=o.code==='das-mei'?existing.find(e=>normalize(e.name).includes('das mei')):null;
   if(das){das.scope='fixed';das.presetCode='das-mei';continue;}
   const meal=o.code==='almoco'?existing.find(e=>/almoco|almoco da equipe/.test(normalize(e.name))&&/refeicao/i.test(normalize(e.unit))):null;
   if(meal){
    meal.scope='job';meal.autoApply=true;meal.presetCode='almoco';
    meal.presetQty=amount(meal.presetQty)||1;meal.presetPeople=1;meal.presetDays=1;
    continue;
   }
   const isFixed=fixedCodes.some(f=>f.code===o.code);
   existing.push({id:'expense-'+o.code, name:o.name,category:o.category,cost:o.code==='das-mei'&&amount(db.company?.das)>0?amount(db.company.das):o.cost,
    unit:o.unit,scope:isFixed?'fixed':'job',kind:o.kind||'expense',autoApply:!!o.applyDefault,
    presetQty:o.qty||1,presetPeople:o.people||1,presetDays:o.days||1,presetCode:o.code,
    isIllustrative:true,updatedAt:presetVersion});
   added++;
  }
  db.company.expensePresetVersion=presetVersion;
  if(!amount(db.company.monthlyProductiveHours))db.company.monthlyProductiveHours=160;
  if(!save())return false;
  return added;
 }
 seedOnce();
 function fixedEntries(){return (db.expenses||[]).filter(e=>e.scope==='fixed'||e.scope==='monthly');}
 function fixedMonthly(){return fixedEntries().reduce((sum,x)=>sum+amount(x.cost),0);}
 function capacity(){return amount(db.company.monthlyProductiveHours)||160;}
 function snapshot(q){
  if(!q||q.costModel==='fixed_hourly_v1'||q.id)return;
  q.costModel='fixed_hourly_v1';
  q.fixedMonthlySnapshot=+fixedMonthly().toFixed(2);
  q.fixedCapacitySnapshot=capacity();
  q.fixedExpenseSnapshot=fixedEntries().map(e=>({id:e.id,name:e.name,value:amount(e.cost),scope:'fixed'}));
  q.fixedHoursOverride='';
  q.rateModelDate=new Date().toISOString();
 }
 function defaultJobEntries(q,force=false){
  if(!q||q.id)return;
  q.expenseItems??=[];
  if(q.expensePresetApplied&&!force)return;
  // Preserva custos extras já informados no rascunho antes de adicionar sugestões.
  if(q.manualExtraCost===undefined)q.manualExtraCost=Math.max(0,amount(q.extraCost)-totalVariable(q));
  for(const d of (db.expenses||[]).filter(x=>x.scope==='job'&&x.autoApply)){
   if(q.expenseItems.some(e=>e.expenseId===d.id))continue;
   q.expenseItems.push({
    id:'qe-'+Math.random().toString(36).slice(2),expenseId:d.id,name:d.name,unitCost:amount(d.cost),
    qty:amount(d.presetQty)||1,people:amount(d.presetPeople)||1,days:amount(d.presetDays)||1,
    presetAuto:true,presetCode:d.presetCode||'',assumed:true
   });
  }
  q.expensePresetApplied=true;
  updateJobExpenseTotal(q);
 }
 function totalVariable(q){return (q.expenseItems||[]).reduce((sum,x)=>sum+amount(x.unitCost)*amount(x.qty)*amount(x.people||1)*amount(x.days||1),0);}
 function updateJobExpenseTotal(q){
  if(q.manualExtraCost===undefined)q.manualExtraCost=Math.max(0,amount(q.extraCost)-totalVariable(q));
  q.extraCost=+(amount(q.manualExtraCost)+totalVariable(q)).toFixed(2);
  keepTemp();
 }
 function workHours(q){
  return (q.items||[]).reduce((total,i)=>{
   const qty=amount(i.qty);
   const hr=amount(i.productivity?.hoursPerUnit)||amount(i.hoursUnit)*(amount(i.workersCount)||1);
   return total+qty*hr;
  },0);
 }
 function activeHours(q){
  const v=amount(q.fixedHoursOverride);
  return v>0?v:workHours(q);
 }
 function derivePeople(q){
  const ids=new Set();
  for(const it of q.items||[]){
   for(const m of it.productivity?.crew||[])ids.add(m.workerId);
   if(it.workerId)ids.add(it.workerId);
  }
  return Math.max(1,ids.size);
 }
 function autoAdjust(q){
  if(!q||q.id||!q.expensePresetApplied||!q.expenseItems)return;
  const people=derivePeople(q);
  const hh=workHours(q);
  if(hh<=0)return;
  const days=Math.max(1,Math.ceil(hh/(8*people)));
  let changed=false;
  for(const x of q.expenseItems){
   if(!x.presetAuto)continue;
   const expectedDays=days, expectedPeople=x.presetCode==='almoco'?people:1;
   if(x.days!==expectedDays||x.people!==expectedPeople){x.days=expectedDays;x.people=expectedPeople;changed=true;}
  }
  if(changed)updateJobExpenseTotal(q);
 }
 const priorStart=startNew;
 startNew=function(){
  priorStart();
  if(s.wizard&&!s.wizard.id){
   // Não migrar silenciosamente orçamentos antigos já iniciados.
   const fresh=!s.wizard.title&&!s.wizard.clientId&&!(s.wizard.items||[]).length&&!(s.wizard.expenseItems||[]).length;
   if(!s.wizard.costModel&&fresh)snapshot(s.wizard);
   if(s.wizard.costModel==='fixed_hourly_v1'){
    defaultJobEntries(s.wizard);
    keepTemp();render();
   }
  }
 };
 const priorModal=modalUI,priorModalSubmit=modalSubmit;
 modalUI=function(){
  let html=priorModal();
  if(s.modal==='addexpense'){
   const e=s.edit||{},scope=e.scope||'job';
   const fields='<div class="qa-expense-config">'+
    '<label class="label">Onde será aplicada?</label>'+
    '<select class="input" name="scope"><option value="job" '+(scope==='job'?'selected':'')+'>Despesa variável por obra</option>'+
    '<option value="fixed" '+(scope==='fixed'?'selected':'')+'>Despesa mensal da empresa</option></select>'+
    '<label class="qa-check"><input type="checkbox" name="autoApply" value="yes" '+(e.autoApply?'checked':'')+'> Incluir automaticamente em novos orçamentos (apenas despesas da obra)</label>'+
    '<div class="grid-duo">'+
    field('Quantidade padrão','presetQty','1',e.presetQty||1,'number')+
    field('Pessoas padrão','presetPeople','1',e.presetPeople||1,'number')+
    field('Dias padrão','presetDays','1',e.presetDays||1,'number')+'</div>'+
    '<p class="qa-help">As despesas mensais serão rateadas pelas horas previstas da obra. As variáveis são lançadas por orçamento e você pode editar cada valor.</p></div>';
   const pos=html.lastIndexOf('<div class="form-actions">');
   if(pos>=0)html=html.slice(0,pos)+fields+html.slice(pos);
  }
  return html;
 };
 modalSubmit=function(form){
  if(s.modal==='addexpense'){
   const selectedExpense=s.edit;
   const oldCount=db.expenses.length;
   const formdata=new FormData(form);
   const scope=formdata.get('scope')==='fixed'?'fixed':'job';
   priorModalSubmit(form);
   // O formulário legado persiste os novos campos, mas checkbox desmarcado
   // não é enviado: garantir que seja desmarcado quando editado.
   const saved=selectedExpense?.id?db.expenses.find(x=>x.id===selectedExpense.id):
    db.expenses[oldCount];
   if(saved){
    saved.scope=scope;saved.autoApply=scope==='job'&&formdata.has('autoApply');
    saved.presetQty=amount(formdata.get('presetQty'))||1;
    saved.presetPeople=amount(formdata.get('presetPeople'))||1;
    saved.presetDays=amount(formdata.get('presetDays'))||1;
    if(saved.presetCode==='prolabore'&&saved.scope==='fixed')saved.kind='owner-target';
    save();render();
   }
   return;
  }
  return priorModalSubmit(form);
 };
 const previousExpenseRoute=ROUTES.expenses;
 ROUTES.expenses=function(){
  const html=previousExpenseRoute();
  const items=fixedEntries(),total=fixedMonthly();
  const capacityH=capacity();
  const pro=items.find(x=>x.presetCode==='prolabore'||x.kind==='owner-target');
  const fixedList=items.map(x=>'<div class="qa-cost-row"><span>'+esc(x.name)+'</span><strong>'+fmt(x.cost)+'/mês</strong></div>').join('');
  const panel='<section class="form-card qa-financial-panel"><h3>Estrutura mensal da CIVOLTEN</h3>'+
   '<p class="qa-help">Valores demonstrativos e editáveis. Salários dos empregados e terceirizados usados nos serviços são calculados separadamente em Profissionais.</p>'+
   '<div class="qa-highlight"><span>Pró-labore desejado (meta mensal)</span><strong>'+fmt(pro?.cost||0)+'</strong></div>'+
   '<div class="qa-cost-row"><span>Total de despesas fixas + meta de pró-labore</span><strong>'+fmt(total)+'</strong></div>'+
   '<label class="label">Horas produtivas faturáveis da EMPRESA por mês</label>'+
   '<input type="number" min="1" max="2000" step="1" class="input" id="qa-monthly-hours" value="'+esc(capacityH)+'">'+
   '<button class="btn btn-outline block" data-action="qa-save-hours">Salvar capacidade mensal</button>'+
   '<div class="qa-cost-row"><span>Rateio aproximado por hora faturável</span><strong>'+fmt(total/capacityH)+'/h</strong></div>'+
   '<p class="qa-help">O rateio inclui a meta de retirada do titular, sem tratá-la como salário CLT. Para não duplicar, não conte também sua própria remuneração no custo horário de um profissional. Os orçamentos antigos conservam seus dados.</p>'+
   '<h4>Despesas fixas mensais</h4>'+fixedList+
   '<p class="qa-help">Edite os valores na lista de despesas abaixo. Você também pode cadastrar ou excluir despesas.</p>'+
   '<h4>Despesas variáveis padrão por obra</h4>'+
   (db.expenses||[]).filter(x=>x.scope==='job').map(x=>'<div class="qa-cost-row"><span>'+esc(x.name)+(x.autoApply?' <em>pré-preenchida</em>':'')+'</span><strong>'+fmt(x.cost)+'</strong></div>').join('')+
   '<p class="qa-help">Almoço e deslocamento usam suposições iniciais que serão revisadas para cada obra. Refeição não deve ser cobrada de novo se já estiver paga nos benefícios da equipe.</p>'+
   '</section>';
  return html.replace('<main class="sheet full">','<main class="sheet full">'+panel);
 };
 const priorStep2=wizardStep2,priorStep3=wizardStep3,priorPersist=persistWizard;
 wizardStep2=function(){
  if(s.wizard?.costModel==='fixed_hourly_v1')autoAdjust(s.wizard);
  let html=priorStep2();
  if(s.wizard?.costModel!=='fixed_hourly_v1')return html;
  const q=s.wizard,hrs=activeHours(q),varTotal=totalVariable(q);
  const data='<div class="form-card qa-job-preset"><h3>Despesas pré-configuradas desta obra</h3>'+
   '<p class="qa-help">Almoço e deslocamento já vêm preenchidos; toque no lápis para ajustar quantidade, pessoas, dias e preço. Despesas opcionais podem ser adicionadas. Não inclua benefícios que já estão no custo CLT.</p>'+
   '<div class="qa-cost-row"><span>Variáveis lançadas na obra</span><strong>'+fmt(varTotal)+'</strong></div>'+
   '<div class="qa-cost-row"><span>Horas de execução cadastradas</span><strong>'+hrs.toLocaleString('pt-BR',{maximumFractionDigits:2})+' hh</strong></div>'+
   '<div class="qa-cost-row"><span>Fixos mensais desta proposta</span><strong>'+fmt(q.fixedMonthlySnapshot)+'</strong></div>'+
   '<div class="qa-cost-row"><span>Rateio fixo estimado</span><strong>'+fmt(hrs*(amount(q.fixedMonthlySnapshot)/Math.max(1,amount(q.fixedCapacitySnapshot))))+'</strong></div>'+
   '<button class="btn btn-outline block" type="button" data-action="qa-reapply-expenses">Repor despesas padrão que faltarem</button>'+
   '</div>';
  const pos=html.lastIndexOf('<div class="form-actions">');
  return pos<0?data+html:html.slice(0,pos)+data+html.slice(pos);
 };
 wizardStep3=function(){
  if(s.wizard?.costModel==='fixed_hourly_v1')autoAdjust(s.wizard);
  let html=priorStep3();
  if(s.wizard?.costModel!=='fixed_hourly_v1')return html;
  const q=s.wizard,c=calc(q),hasHours=activeHours(q)>0;
  const panel='<div class="form-card qa-financial-panel"><h3>Rateio das despesas mensais</h3>'+
   '<p class="qa-help">A meta de pró-labore de R$ 10 mil e os custos fixos foram considerados na base mensal. Este valor é distribuído pelas horas previstas da obra, em vez de adicionar novamente o percentual genérico de indiretos.</p>'+
   '<div class="qa-cost-row"><span>Estrutura mensal (fotografia ao criar orçamento)</span><strong>'+fmt(q.fixedMonthlySnapshot)+'</strong></div>'+
   '<div class="qa-cost-row"><span>Capacidade mensal</span><strong>'+fmt(q.fixedCapacitySnapshot)+' horas</strong></div>'+
   '<div class="qa-cost-row"><span>Rateio neste orçamento</span><strong>'+fmt(c.overhead)+'</strong></div>'+
   '<label class="label">Horas para rateio (opcional — altere se necessário)</label>'+
   '<input class="input" type="number" min="0" step="0.25" name="fixedHoursOverride" placeholder="Automático: '+activeHours(q)+' horas" value="'+esc(q.fixedHoursOverride??'')+'">'+
   '<button class="btn btn-outline block" data-action="qa-refresh-monthly">Atualizar custos mensais desta proposta</button>'+
   (hasHours?'':'<div class="qa-warning">Informe uma produtividade ou horas de rateio. Sem elas, o preço ainda não contempla os custos fixos mensais.</div>')+
   '</div>';
  const pos=html.indexOf('<div class="price-card">');
  return pos<0?panel+html:html.slice(0,pos)+panel+html.slice(pos);
 };
 persistWizard=function(){
  if(s.wizard?.costModel==='fixed_hourly_v1'&&s.wizard.status!=='Rascunho'&&activeHours(s.wizard)<=0){
   toast('Informe horas produtivas ou horas de rateio antes de emitir a proposta.');return;
  }
  priorPersist();
 };
 document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-action]');if(!btn)return;
  const action=btn.dataset.action;
  if(action==='qa-save-hours'){
   e.preventDefault();e.stopPropagation();
   const v=amount(document.getElementById('qa-monthly-hours')?.value);
   if(v<1||v>2000){toast('Informe de 1 a 2000 horas produtivas por mês.');return}
   db.company.monthlyProductiveHours=v;save();render();toast('Capacidade mensal atualizada para novos orçamentos.');
  }
  if(action==='qa-refresh-monthly'){
   e.preventDefault();e.stopPropagation();if(!s.wizard)return;
   s.wizard.fixedMonthlySnapshot=+fixedMonthly().toFixed(2);
   s.wizard.fixedCapacitySnapshot=capacity();
   s.wizard.fixedExpenseSnapshot=fixedEntries().map(x=>({id:x.id,name:x.name,value:amount(x.cost)}));
   keepTemp();render();toast('Custos mensais atualizados apenas neste orçamento.');
  }
  if(action==='qa-reapply-expenses'){
   e.preventDefault();e.stopPropagation();
   if(!s.wizard)return;
   defaultJobEntries(s.wizard,true);keepTemp();render();toast('Despesas padrão faltantes repostas sem alterar as existentes.');
  }
 },true);
 document.addEventListener('input',e=>{
  if(e.target.name==='fixedHoursOverride'&&s.wizard){
   s.wizard.fixedHoursOverride=e.target.value;
   keepTemp();
  }
 },true);
 const css=document.createElement('style');
 css.textContent='.qa-financial-panel,.qa-job-preset{margin:12px 0}.qa-financial-panel h3,.qa-job-preset h3{font-size:17px;margin:7px 0 10px}.qa-financial-panel h4{font-size:14px;margin:16px 0 9px}.qa-help{font-size:12px;line-height:1.5;color:#7a6a4d;margin:8px 0 12px}.qa-cost-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #e9e1d5;font-size:12px}.qa-cost-row span{flex:1}.qa-cost-row strong{white-space:nowrap;font-size:12px}.qa-cost-row em{font-size:10px;color:#16805d}.qa-highlight{padding:12px 14px;border-radius:13px;background:#fff1cc;margin:10px 0;display:flex;justify-content:space-between;align-items:center;gap:9px;font-size:12px}.qa-highlight strong{font-size:18px;color:#4e3610;white-space:nowrap}.qa-expense-config{background:#fff7e6;border:1px solid #ead39c;border-radius:14px;padding:10px;margin:12px 0}.qa-check{display:flex;gap:10px;align-items:center;font-size:12px;margin:13px 0}.qa-warning{background:#fff0dd;color:#99451b;padding:12px;border-radius:12px;font-size:12px;margin:10px 0}';
 document.head.append(css);
})();