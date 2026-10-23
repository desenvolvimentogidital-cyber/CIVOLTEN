// Selecao da equipe do orçamento com fonte unica no cadastro dos funcionarios.
// A folha fixa mensal ja consta do rateio da empresa: selecionar quem trabalhara
// na obra nao pode cobrar uma segunda diaria.
export function createBudgetStaff(worker,jobDays){
 if(!worker||!worker.active)throw Error('Selecione um funcionário ativo.');
 const days=Number(jobDays);
 if(!Number.isFinite(days)||days<=0||days>10000)throw Error('Informe os dias previstos para a obra.');
 const mode=worker.cost_mode??'monthly';
 if(!['monthly','project'].includes(mode))throw Error('Tipo de contratação inválido.');
 const daily=Number(worker.daily_cents),charges=Number(worker.charges_pct??0);
 if(!Number.isSafeInteger(daily)||daily<0||!Number.isFinite(charges)||charges<0||charges>200)
  throw Error('Revise diária e encargos no cadastro do profissional.');
 return {
  worker_id:worker.id,
  name:worker.name,
  profession:worker.profession,
  cost_mode:mode,
  daily_reference_cents:daily,
  daily_cents:mode==='monthly'?0:daily,
  charges_pct:mode==='monthly'?0:charges,
  days
 };
}
export function staffAlreadyAdded(staff=[],workerId){
 return staff.some(row=>row.worker_id===workerId);
}
