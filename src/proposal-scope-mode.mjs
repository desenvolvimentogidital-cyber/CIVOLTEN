/* Proposal scope is selected by the operator at draft creation.
 * Never treat the full SIURB service cost as a labour-only quotation:
 * official service rates can contain materials, equipment and statutory charges.
 * Staff calculations use registered internal employer cost and reviewed H-H only.
 */
import {marginOnSale} from './company-pricing-engine.mjs';
export const proposalModes=Object.freeze({
 full:'mao_de_obra_e_materiais',
 labor:'somente_mao_de_obra'
});
const cash=n=>Math.round((n+Number.EPSILON)*100)/100;
const finite=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))&&Number(n)>=0;
export function prepareProposalScope(mode,{budgetItems=[],costing={},workforce=null,saleInputs=null}={}){
 if(!Object.values(proposalModes).includes(mode))
  throw Object.assign(new Error('Escolha mão de obra + materiais ou somente mão de obra'),{status:400});
 if(mode===proposalModes.full){
  return {
   mode,description:'Mão de obra e materiais — serviços SIURB integrais',
   price_source:'preco_unitario_completo_siurb_ou_cotacao_registrada',
   items:budgetItems.map(i=>({code:i.source_code,name:i.source_name,unit:i.unit,
    quantity:String(i.quantity),unit_cost:String(i.direct_unit_cost)})),
   labor_cost_reference_reais:null,price_final_reais:costing.estimate?.ready?
    Number(costing.estimate.total_reais):null,
   complete:!!costing.estimate?.ready,
   issues:(costing.estimate?.errors||[]).map(e=>e.message||String(e)),
   excludes_materials:false,commercial_release:false,
   note:'O preço unitário do serviço SIURB inclui os componentes de sua composição. Não acrescentar novamente salário, material ou equipamento sobre o preço completo.'
  };
 }
 const roles=new Map((workforce?.roles||[]).filter(r=>finite(r.hourly_cost))
  .map(r=>[String(r.code),Number(r.hourly_cost)]));
 const suggestions=new Map((workforce?.services||[]).map(s=>[String(s.item_id),s]));
 const issues=[],items=[];
 for(const i of budgetItems){
  const item=suggestions.get(String(i.id)),qty=Number(i.quantity);
  if(!item||!item.reviewed||!Array.isArray(item.roles)||!item.roles.length||
      !Number.isFinite(qty)||qty<=0||item.workers===null){
   issues.push('Produtividade ou profissões ainda não revisadas: '+i.source_name);
   items.push({code:i.source_code,name:i.source_name,unit:i.unit,
    quantity:String(i.quantity),unit_cost:null,estimated_labor_cost_reais:null});
   continue;
  }
  let sum=0,ok=true;
  for(const role of item.roles){
   const rate=roles.get(String(role.code));
   if(rate===undefined||!finite(role.projected_hh)){
    ok=false;break;
   }
   sum+=Number(role.projected_hh)*rate;
  }
  if(!ok||!Number.isFinite(sum)){
   issues.push('Custo-hora completo da profissão não informado: '+i.source_name);
   items.push({code:i.source_code,name:i.source_name,unit:i.unit,
    quantity:String(i.quantity),unit_cost:null,estimated_labor_cost_reais:null});
   continue;
  }
  const amount=cash(sum);
  items.push({code:i.source_code,name:i.source_name,unit:i.unit,
   quantity:String(i.quantity),unit_cost:null,estimated_labor_cost_reais:amount});
 }
 if(!budgetItems.length)issues.push('Adicione serviços antes de calcular mão de obra.');
 if(!workforce?.costs)issues.push('Custo de pessoal disponível somente para perfis internos autorizados.');
 const complete=items.length>0&&issues.length===0;
 const cost=complete?cash(items.reduce((n,i)=>n+i.estimated_labor_cost_reais,0)):null;
 // A base financeira do serviço é o pessoal remunerado durante o cronograma
 // aprovado, mais despesas gerais rateadas. Diferente das h-h técnicas e sem
 // materiais. Nunca somar ambos os modelos de custo entre si.
 let saleScenario=null;
 if(saleInputs!==null){
  const paid=Number(workforce?.costs?.total_sequential);
  const paidAvailable=workforce?.costs?.available===true&&
   finite(workforce?.costs?.total_sequential)&&paid>0;
  const margin=saleInputs.target_margin_pct,
   tax=saleInputs.service_tax_pct,owner=saleInputs.owner_allocation_reais;
  const missing=[];
  if(!complete)missing.push('Produtividade SIURB ou custo-hora técnico pendente');
  if(!paidAvailable)missing.push('Custos pagos da equipe, despesas e cronograma revisados pendentes');
  if(!finite(margin))missing.push('Margem da empresa não configurada');
  if(!finite(tax))missing.push('Tributação efetiva de serviços não informada');
  if(!finite(owner))missing.push('Pró-labore alocado à obra não informado');
  if(missing.length)saleScenario={ready:false,missing,indicative_sale_reais:null,
   includes_materials:false,tax_accountant_approved:false,commercial_release:false};
  else{
   const ownerCost=Number(owner),paidCost=cash(paid),base=cash(paidCost+ownerCost);
   const quoted=marginOnSale({cost_base:base,margin_pct:margin,
     taxes_on_revenue_pct:tax});
   saleScenario={ready:quoted.ready,paid_labor_and_overhead_reais:paidCost,
    owner_allocation_reais:cash(ownerCost),base_company_cost_reais:base,
    margin_pct:quoted.margin_pct,service_tax_pct:quoted.taxes_on_revenue_pct,
    indicative_sale_reais:quoted.sale_price,missing:[],
    includes_materials:false,tax_accountant_approved:false,
    commercial_release:false,
    note:'Preço apenas indicativo com custos próprios e parâmetros explicitamente informados. Revisão tributária, responsabilidade técnica e autorização comercial permanecem obrigatórias.'};
  }
 }
 return {
  mode,description:'Somente mão de obra — sem fornecimento de materiais',
  price_source:'horas_homem_revisadas_x_custo_hora_proprio',
  items,labor_cost_reference_reais:cost,price_final_reais:null,
  sale_scenario:saleScenario,
  complete,issues,excludes_materials:true,commercial_release:false,
  note:'O valor calculado é custo direto indicativo da mão de obra própria, NÃO preço final. Tributos, BDI, mobilização, encargos não cadastrados, indiretos e margem requerem aprovação específica. Não foi usado o preço integral SIURB.'
 };
}
