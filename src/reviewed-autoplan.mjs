/* Persistable work plan derived only from reviewed SIURB hours and registered active workers.
 * This is a DRAFT: not a reservation of employees, execution order, start date or contract.
 * Do not divide all labor by an undifferentiated headcount: every skill must be present.
 */
const reviewed=new Set(['revisado','aprovado','validado']);
const finite=(x)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const positive=x=>finite(x)&&Number(x)>0;
const int=(x,min,max)=>finite(x)&&Number.isSafeInteger(Number(x))&&Number(x)>=min&&Number(x)<=max;
const text=x=>String(x??'').trim();
export function buildReviewedAutoplan({items=[],workers=[],hours_day,efficiency_pct}={}){
 const issues=[];
 if(!finite(hours_day)||Number(hours_day)<4||Number(hours_day)>12)
  issues.push('Informe jornada real de 4 a 12 horas por dia');
 if(!int(efficiency_pct,50,100))
  issues.push('Informe eficiência de 50% a 100% para esta obra');
 if(!Array.isArray(items)||items.length<1||items.length>100)
  issues.push('O orçamento deve possuir de 1 a 100 serviços ativos');
 if(issues.length)return {ready:false,issues,tasks:[],roles:[],requires_technical_review:true};
 const capacity=Number(hours_day)*Number(efficiency_pct)/100;
 const staff=new Map();
 for(const person of workers||[]){
  if(person.active!==true)continue;
  const code=text(person.role_code),name=text(person.role_name);
  if(!code||!name)continue;
  const existing=staff.get(code);
  if(existing)existing.workers++;
  else staff.set(code,{role_code:code,role_name:name.slice(0,160),workers:1});
 }
 if(!staff.size)issues.push('Cadastre funcionários ativos com profissão antes de registrar o cronograma');
 const usedRoles=new Map(),tasks=[];
 for(const [i,item] of (items||[]).entries()){
  const code=text(item.source_code),label=text(item.source_name);
  const id=text(item.id);
  if(!id||!label||!positive(item.quantity)||item.source_matches_budget!==true||
   !item.reference_price_id){
   issues.push('Serviço '+(code||String(i+1))+': vincule a composição SIURB correta');continue;
  }
  if(!reviewed.has(text(item.labor_review_state).toLowerCase())||
   !positive(item.direct_labor_hh_unit)){
   issues.push('Serviço '+code+': produtividade e horas-homem precisam de revisão técnica');continue;
  }
  const labor=Array.isArray(item.labor)?item.labor:[];
  if(!labor.length){issues.push('Serviço '+code+': profissões da ficha SIURB indisponíveis');continue}
  const byRole=new Map();let bad=false;
  for(const entry of labor){
   const role=text(entry.code),unit=text(entry.unit).toUpperCase(),coefficient=Number(entry.coef);
   if(!role||unit!=='H'||!positive(entry.coef)){
    bad=true;continue;
   }
   const old=byRole.get(role)||{code:role,coef:0};
   old.coef+=coefficient;byRole.set(role,old);
  }
  const summed=[...byRole.values()].reduce((s,r)=>s+r.coef,0);
  const approved=Number(item.direct_labor_hh_unit);
  if(bad||byRole.size===0||Math.abs(summed-approved)/approved>0.05){
   issues.push('Serviço '+code+': composição por profissão diverge do total de h-h revisado');continue;
  }
  const missing=[...byRole.keys()].filter(role=>!staff.has(role));
  if(missing.length){issues.push('Serviço '+code+': funcionários ativos ausentes para códigos '+missing.join(', '));continue}
  let duration=1;
  for(const r of byRole.values()){
   const pool=staff.get(r.code);
   usedRoles.set(r.code,pool);
   duration=Math.max(duration,Math.ceil(Number(item.quantity)*r.coef/(pool.workers*capacity)));
  }
  if(duration>9000){issues.push('Serviço '+code+': duração excede o limite de segurança');continue}
  tasks.push({item_id:id,title:label.slice(0,200),duration_workdays:duration,position:i+1});
 }
 return {ready:issues.length===0&&tasks.length===items.length,issues,
  tasks:issues.length?[]:tasks,
  roles:issues.length?[]:[...usedRoles.values()].sort((a,b)=>a.role_code.localeCompare(b.role_code)),
  hours_day:Number(hours_day),efficiency:Number(efficiency_pct)/100,
  planned_headcount:[...usedRoles.values()].reduce((n,r)=>n+r.workers,0),
  requires_technical_review:true,
  assigns_real_workers:false,
  starts_execution:false,commercial_release:false,
  notice:'Pré-planejamento com profissões disponíveis, sem reserva individual, datas ou contratação. Todas as durações exigem revisão técnica posterior.'};
}
