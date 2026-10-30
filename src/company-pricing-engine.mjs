/* CIVOLTEN — reconciliação sem dupla contagem.
 * 30% é margem sobre faturamento (lucro/receita), não markup sobre custo.
 * Tributos sobre a receita devem ser fornecidos e revisados; nunca presumidos.
 * BDI SIURB já pode contemplar administração e lucro. Nada aqui atualiza BDI.
 */
function invalid(message){throw Object.assign(new Error(message),{status:400})}
const finite=(v,name,low,high)=>{
 if(v===null||v===undefined||v==='')invalid(name+' obrigatório');
 const n=Number(v);
 if(!Number.isFinite(n)||n<low||n>high)invalid(name+' inválido');
 return n;
};
const brl=n=>Math.round((n+Number.EPSILON)*100)/100;
export function marginOnSale({cost_base,margin_pct=30,taxes_on_revenue_pct}){
 const cost=finite(cost_base,'Custo base',0,1e12);
 const margin=finite(margin_pct,'Margem desejada',0,80);
 // Null is not zero: unknown tax is not authorized as 0%.
 if(taxes_on_revenue_pct===null||taxes_on_revenue_pct===undefined||taxes_on_revenue_pct==='')
  return {ready:false,margin_pct:margin,taxes_on_revenue_pct:null,cost_base:brl(cost),
    sale_price:null,profit_before_income_tax:null,
    explanation:'Informe a alíquota efetiva de tributos sobre a receita antes de formar um preço comercial.'};
 const tax=finite(taxes_on_revenue_pct,'Tributos sobre receita',0,60);
 const denominator=1-margin/100-tax/100;
 if(denominator<=0)invalid('Margem e tributos não deixam espaço para cobrir o custo');
 const value=cost/denominator;
 return {ready:true,margin_pct:margin,taxes_on_revenue_pct:tax,cost_base:brl(cost),
  sale_price:brl(value),profit_before_income_tax:brl(value*margin/100),
  markup_effective_pct:brl((value/cost-1)*100)||0,
  explanation:'Preço indicativo = custo completo / (1 - margem sobre venda - tributos sobre receita). Impostos sobre o lucro, outras obrigações e aprovações comerciais não estão automaticamente considerados.'};
}
export function reconcileCostSources({reference_direct_cost=null,
 internal_labor_cost=null,owner_prolabore_allocation=null,other_overhead_allocation=null,
 material_cost=null,equipment_cost=null,other_direct_cost=null,
 source_mode='reference',reference_includes_labor=true,
 reference_includes_admin=undefined,approval=false}={}){
 const allowed=['reference','own_cost'];
 if(!allowed.includes(source_mode))invalid('Fonte do custo inválida');
 const required=(n,label)=>n===null||n===undefined?null:finite(n,label,0,1e12);
 const ref=required(reference_direct_cost,'Preço direto SIURB');
 const labor=required(internal_labor_cost,'Custo real de pessoal');
 const owner=required(owner_prolabore_allocation,'Pró-labore rateado');
 const admin=required(other_overhead_allocation,'Administração rateada');
 const material=required(material_cost,'Materiais');
 const equipment=required(equipment_cost,'Equipamentos');
 const extras=required(other_direct_cost,'Outros custos diretos');
 // SIURB direct includes labor/material/equipment; DON'T add them twice.
 const duplicateItems=[];
 if(source_mode==='reference'){
  if(labor!==null&&reference_includes_labor)duplicateItems.push('Mão de obra própria já integra o serviço SIURB');
  if(reference_includes_admin!==false&&(owner!==null||admin!==null))
   duplicateItems.push('Pró-labore/administração podem estar incluídos no BDI ou administração central');
  return {mode:'reference',base_direct_cost:ref,combined_cost:null,
   counted_components:ref===null?[]:['Referência SIURB total de serviços'],
   separately_monitored:{internal_labor_cost:labor,owner_prolabore_allocation:owner,
    other_overhead_allocation:admin},
   duplicate_risks:duplicateItems,
   ready_for_sale:false,approved:!!approval,
   note:'Preço SIURB e BDI não podem ser somados cegamente a salários, pró-labore ou custos próprios. Conciliar as fichas item a item e a administração central primeiro.'};
 }
 // Internal method: explicit complete cost categories, NEVER adds reference.
 const missing=[['mão de obra',labor],['materiais',material],['equipamentos',equipment],
  ['outros custos',extras],['pró-labore',owner],['demais indiretos',admin]]
  .filter(([,v])=>v===null).map(([label])=>label);
 const amount=missing.length?null:labor+material+equipment+extras+owner+admin;
 return {mode:'own_cost',base_direct_cost:null,combined_cost:amount===null?null:brl(amount),
  counted_components:['Mão de obra própria','Materiais próprios','Equipamentos próprios',
   'Outros custos próprios','Pró-labore rateado','Outras despesas rateadas'],
  missing_categories:missing,duplicate_risks:[],
  ready_for_sale:missing.length===0&&!!approval,approved:!!approval,
  note:'Custo próprio exige composição completa e revisão explícita. Não acumular com o preço total SIURB.'};
}
