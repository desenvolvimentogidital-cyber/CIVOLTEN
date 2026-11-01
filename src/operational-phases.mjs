/* Checklist de implantação. Nunca converter contagens de banco em homologação.
 * Um recurso implementado não significa que foi aprovado ou utilizado em produção.
 */
export function summarizeSevenPhases({schema={},counts={},account={},evidence={}}={}){
 const n=k=>Number(counts?.[k])||0;
 const flag=k=>evidence?.[k]===true;
 const items=[
  {id:1,name:'Segurança e recuperação dos dados',checks:[
   ['Banco e estrutura validados',schema.ready===true],
   ['Senha temporária substituída',!!account.administrator_present&&!account.administrator_password_change_pending],
   ['Backup cifrado real com restauração confirmada',flag('backup_restored')],
   ['Acesso e permissões homologados em celular e desktop',flag('browser_authenticated')]]},
  {id:2,name:'Tabela SIURB: preços, composições e produtividade',checks:[
   ['Preços oficiais carregados',n('reference_prices')>0],
   ['Fichas de composição carregadas',n('reference_compositions')>0],
   ['Componentes auxiliares, preços horistas e equipamentos reconciliados',flag('siurb_supplements_reconciled')],
   ['Conferência das composições dos serviços do orçamento',n('active_budget_items')>0&&n('items_pending_cost_review')===0],
   ['Produtividade por serviço revisada tecnicamente',n('active_budget_items')>0&&n('items_pending_productivity_review')===0]]},
  {id:3,name:'Custos reais, encargos e tributos da empresa',checks:[
   ['Equipe ou custos-hora cadastrados',n('company_hourly_rates')>0||n('active_company_workers')>0],
   ['Despesas gerais cadastradas',n('company_overhead_profiles')>0],
   ['Custos, margem, BDI e tributos aprovados',n('budgets')>0&&n('budgets_pending_cost_approval')===0&&flag('tax_accountant_approved')]]},
  {id:4,name:'Orçamentos automáticos das duas modalidades',checks:[
   ['Orçamento e itens reais persistidos',n('budgets')>0&&n('active_budget_items')>0],
   ['Quantidade e custo de todos os itens revisados',n('active_budget_items')>0&&n('items_pending_cost_review')===0],
   ['Modalidades e preço final reconciliados',flag('both_modes_financially_approved')]]},
  {id:5,name:'Cronograma e execução real da obra',checks:[
   ['Atividades executivas vinculadas ao orçamento e homologadas',flag('schedule_recorded_and_reviewed')],
   ['Medição e financeiro integrados e homologados',flag('real_measurements_reconciled')]]},
  {id:6,name:'Propostas, contratos, emissão e aceite',checks:[
   ['Propostas e PDFs homologados em dispositivos reais',flag('proposal_pdf_approved')],
   ['Envio, aceite e assinaturas com evidência verificável',flag('contract_acceptance_approved')],
   ['Emissão comercial autorizada',flag('commercial_release_authorized')]]},
  {id:7,name:'Homologação ponta a ponta e publicação definitiva',checks:[
   ['CI e testes de integração homologados para a versão',flag('ci_production_sha_verified')],
   ['Backup, restauração e permissões validados',flag('backup_restored')&&flag('browser_authenticated')],
   ['Percurso orçamento até execução homologado',flag('full_e2e_verified')],
   ['Responsável aprovou a liberação comercial',flag('production_signoff_verified')]]}
 ];
 return items.map(p=>{
  const checks=p.checks.map(([label,complete])=>({label,complete:complete===true}));
  const passed=checks.filter(c=>c.complete).length;
  return {phase:p.id,title:p.name,passed,total:checks.length,
   status:passed===checks.length?'evidencias_declaradas':'pendente',
   checks};
 });
}
