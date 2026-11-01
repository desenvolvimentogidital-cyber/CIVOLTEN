/* SIURB 2026-07: direct labor reference, audited hourly tariffs.
 * A partial composition may omit indirect and auxiliary labor. Showing direct
 * labor is NOT a decomposition of the full SIURB service price or a quotation.
 */
const round4=n=>Math.round((n+Number.EPSILON)*10000)/10000;
const validPositive=x=>x!==null&&x!==undefined&&x!==''&&
 Number.isFinite(Number(x))&&Number(x)>0;
export function compareSiurbDirectLabor({labor=[],tariffs=[],regime=null,reference_month=null}={}){
 const list=Array.isArray(labor)?labor:[];
 const selected=(Array.isArray(tariffs)?tariffs:[]).filter(x=>
  x.kind==='horista'&&x.variant==='com_encargos'&&
  String(x.unit||'').trim().toUpperCase()==='H'&&
  x.regime===regime&&x.reference_month===reference_month);
 const byCode=new Map();
 for(const t of selected){
  const key=String(t.code??'');
  const rows=byCode.get(key)||[];
  rows.push(t);byCode.set(key,rows);
 }
 let sum=0;
 const missing=[],components=[];
 for(const laborPart of list){
  const code=String(laborPart?.code??'');
  const coef=Number(laborPart?.coef);
  const options=byCode.get(code)||[];
  const unit=String(laborPart?.unit??'').trim().toUpperCase();
  const validRole=!!code&&unit==='H'&&validPositive(coef);
  const price=options.length===1?options[0]:null;
  const matched=validRole&&price!==null&&validPositive(price.unit_cost);
  if(!matched)missing.push({code,reason:!validRole?'coeficiente_ou_unidade_invalida':
   options.length>1?'tarifa_duplicada':options.length===0?'tarifa_horista_ausente':'preco_invalido'});
  const total=matched?round4(coef*Number(price.unit_cost)):null;
  if(total!==null)sum+=total;
  components.push({code,name:String(laborPart?.name??''),unit,coefficient:validRole?coef:null,
   hourly_tariff_with_charges_reais:matched?Number(price.unit_cost):null,
   direct_labor_cost_reais_per_unit:total,source_sha256:matched?price.source_sha256:null,
   match_status:matched?'tarifa_horista_encontrada':'revisao_necessaria'});
 }
 const directComplete=components.length>0&&missing.length===0;
 return {
  reference_month,regime,tariff_variant:'com_encargos',direct_labor_reference_only:true,
  direct_labor_rates_complete:directComplete,
  direct_labor_cost_reais_per_service_unit:directComplete?round4(sum):null,
  missing,components,
  full_service_composition_reconciled:false,
  commercially_approved:false,
  note:'Preço oficial parcial de mão de obra DIRETA por unidade do serviço. Auxiliares, materiais, equipamentos e composições indiretas não foram automaticamente incorporados. Não somar ao preço integral SIURB nem substituir custos-hora próprios ou proposta comercial.'
 };
}
