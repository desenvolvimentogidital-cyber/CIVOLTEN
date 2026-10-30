/* CIVOLTEN: cadeia crítica preliminar sob restrições das equipes.
 * O caminho inclui precedências FS e ordem de tarefas na MESMA equipe.
 * Não atribuir folgas sem calendário ou duração revisados.
 */
export function inspectCriticalChain(schedule){
 if(!schedule?.ready||!Array.isArray(schedule.tasks)||!schedule.tasks.length)
  return {ready:false,critical_task_ids:[],activities:[],project_workdays:null};
 const tasks=schedule.tasks;
 const byId=new Map(tasks.map(t=>[String(t.id),t]));
 if(byId.size!==tasks.length)throw new Error('Identificadores de atividades repetidos');
 const outgoing=new Map(tasks.map(t=>[String(t.id),new Set()]));
 const incoming=new Map(tasks.map(t=>[String(t.id),new Set()]));
 const add=(a,b)=>{
  const from=String(a),to=String(b);
  if(from===to||!byId.has(from)||!byId.has(to))
   throw new Error('Relação crítica inválida');
  outgoing.get(from).add(to);incoming.get(to).add(from);
 };
 for(const task of tasks)for(const d of task.depends_on||[])add(d,task.id);
 const groups=new Map();
 for(const task of tasks){
  const key=String(task.crew_id);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(task);
 }
 // A mesma equipe nunca executa duas frentes simultâneas na saída do motor.
 for(const set of groups.values()){
  set.sort((a,b)=>a.startIndex-b.startIndex||String(a.id).localeCompare(String(b.id)));
  for(let i=1;i<set.length;i++){
   if(set[i-1].endExclusive>set[i].startIndex)
    throw new Error('Conflito de equipe no cronograma');
   add(set[i-1].id,set[i].id);
  }
 }
 const topological=[...tasks].sort((a,b)=>a.startIndex-b.startIndex||a.endExclusive-b.endExclusive);
 const workdays=Math.max(...tasks.map(t=>t.endExclusive));
 const earliest=new Map(),latest=new Map();
 // Mais cedo: precedência e restrição dos recursos.
 for(const task of topological){
  const start=Math.max(0,...[...incoming.get(String(task.id))].map(d=>earliest.get(d).finish));
  const length=task.endExclusive-task.startIndex;
  if(!Number.isSafeInteger(length)||length<1)throw new Error('Duração inconsistente');
  if(start>task.startIndex)throw new Error('Precedência inconsistente com as datas');
  earliest.set(String(task.id),{start,finish:start+length});
 }
 // Mais tarde: término global sem atrasar tarefas sucessoras.
 for(const task of [...topological].reverse()){
  const successors=[...outgoing.get(String(task.id))];
  const finish=successors.length?Math.min(...successors.map(d=>latest.get(d).start)):workdays;
  const start=finish-(task.endExclusive-task.startIndex);
  latest.set(String(task.id),{start,finish});
 }
 const activities=tasks.map(t=>{
  const l=latest.get(String(t.id));
  const slack=Math.max(0,l.start-t.startIndex);
  return {id:String(t.id),title:t.title,crew_id:String(t.crew_id),
   start:t.start,finish:t.finish,workdays:t.duration_workdays,
   free_float_workdays:slack,critical:slack===0};
 });
 return {ready:true,project_workdays:workdays,
  critical_task_ids:activities.filter(t=>t.critical).map(t=>t.id),
  activities,commercial_release:false,
  warning:'Cadeia crítica preliminar considera equipes e dependências FS. Não substitui revisão de acesso, equipamentos e riscos.'};
}
