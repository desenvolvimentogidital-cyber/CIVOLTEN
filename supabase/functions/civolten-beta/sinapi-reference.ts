// SINAPI SP — dados mensais de composições separadas do preço comercial.
// Preços oficiais indisponíveis/zerados = NULL, nunca "gratuito".
const SINAPI_ID=/^sinapi:SP:([0-9]{4,10})$/;
const SINAPI_MONTH=/^20[0-9]{2}-(?:0[1-9]|1[0-2])$/;
const SINAPI_REGIMES=new Set(['com_desoneracao','sem_desoneracao']);
const COST_SOURCE=/^https:\/\/(?:[a-z0-9-]+\.)*(?:caixa\.gov\.br|ibge\.gov\.br)\//i;
const NUM_UNIT={M:'metro',M2:'m²',M3:'m³',UN:'unidade',UNID:'unidade',UNIDADE:'unidade',KG:'kg',H:'h',L:'l',CJ:'unidade'};
const normalUnit=s=>{
 const raw=String(s||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/²/g,'2').replace(/³/g,'3').toUpperCase();
 return NUM_UNIT[raw]||String(s||'').trim().toLowerCase();
};
export function isSinapiId(v){return typeof v==='string'&&SINAPI_ID.test(v)}
function sinapiPublic(row){return {id:'sinapi:SP:'+row.code,descricao:row.description,
 unidade:normalUnit(row.unit),unidade_original:row.unit,categoria:'construcao_civil',
 fonte:'SINAPI',mes_base:row.base_month,regime:row.regime};}
export function normalizeSinapiBatch(payload){
 if(payload?.schema!=='civolten.sinapi.v1'||payload?.uf!=='SP'||!SINAPI_MONTH.test(payload?.period)||
  !SINAPI_REGIMES.has(payload?.regime))throw Error('Informe SINAPI SP, competência válida, regime e schema civolten.sinapi.v1.');
 if(!Array.isArray(payload.items)||payload.items.length<1||payload.items.length>30)
  throw Error('Importe entre 1 e 30 composições por lote.');
 const codes=new Set();
 return payload.items.map(item=>{
  const code=String(item?.code||'').trim(),description=String(item?.description||'').trim();
  const unit=String(item?.unit||'').trim();
  if(!/^[0-9]{4,10}$/.test(code)||codes.has(code)||description.length<3||description.length>1200||
    !unit||unit.length>24)throw Error('Código, descrição ou unidade SINAPI inválidos.');
  codes.add(code);
  const raw=item.cost;
  const cost=raw===null||raw===undefined||raw===0?null:Number(raw);
  if(cost!==null&&(!Number.isFinite(cost)||cost<=0||cost>100000000||Math.round(cost*100)!==cost*100))
   throw Error('Custo SINAPI inválido ou com mais de duas casas.');
  const url=String(item.source_url||'').trim();
  if(cost!==null&&(!item.price_verified||!COST_SOURCE.test(url)))
   throw Error('Preço positivo exige confirmação explícita e URL de fonte oficial CAIXA/IBGE.');
  if(url.length>500)throw Error('URL de referência longa demais.');
  const inputs=Array.isArray(item.inputs)?item.inputs:[];
  if(inputs.length>150)throw Error('Insumos SINAPI em excesso.');
  return {uf:'SP',base_month:payload.period,regime:payload.regime,code,description,unit,
   unit_cost:cost,price_verified:cost!==null,source_url:url,inputs};
 });
}
export async function sinapiPage({db,offset=0,size=400}){
 if(!Number.isInteger(offset)||offset<0||offset>20000||!Number.isInteger(size)||size<1||size>500)
  throw Error('Paginação SINAPI inválida.');
 // A lista publicada usa uma competência e um regime consistentes.
 const first=await db.from('sinapi_reference_services').select('base_month').eq('uf','SP')
  .order('base_month',{ascending:false}).limit(1);
 if(first.error)throw Error('Referências SINAPI indisponíveis.');
 const period=first.data?.[0]?.base_month;
 if(!period)return {items:[],total:0,offset,base_month:null,regime:null};
 const regime='sem_desoneracao';
 const {data,error,count}=await db.from('sinapi_reference_services')
  .select('code,description,unit,base_month,regime',{count:'exact'}).eq('uf','SP')
  .eq('base_month',period).eq('regime',regime).order('code',{ascending:true})
  .range(offset,offset+size-1);
 if(error)throw Error('Não foi possível listar as referências SINAPI.');
 return {items:(data||[]).map(sinapiPublic),total:count||0,offset,
  next_offset:offset+(data||[]).length,base_month:period,regime};
}
export async function sinapiPricingServices(db,selected,conf){
 if(!Array.isArray(selected)||selected.length>60)throw Error('Quantidade de serviços inválida.');
 const ids=[...new Set(selected.map(x=>x?.servico_id).filter(isSinapiId))];
 if(!ids.length)return [];
 const codes=ids.map(id=>SINAPI_ID.exec(id)[1]);
 const latest=await sinapiPage({db,offset:0,size:1});
 if(!latest.base_month)throw Error('PRECIFICACAO_PENDENTE: Base SINAPI ainda não importada.');
 const {data,error}=await db.from('sinapi_reference_services').select('code,description,unit,unit_cost,price_verified,source_url')
  .eq('uf','SP').eq('base_month',latest.base_month).eq('regime','sem_desoneracao').in('code',codes);
 if(error)throw Error('PRECIFICACAO_PENDENTE: Consulta SINAPI indisponível.');
 const byCode=new Map((data||[]).map(row=>[row.code,row]));
 const margin=Number(conf?.margem_minima_alvo);
 if(!Number.isFinite(margin)||margin<0||margin>=0.8)throw Error('Margem comercial inválida no servidor.');
 return ids.map(id=>{
  const row=byCode.get(SINAPI_ID.exec(id)[1]);
  if(!row||!row.price_verified||!(Number(row.unit_cost)>0)||!COST_SOURCE.test(row.source_url||''))
   throw Error('PRECIFICACAO_PENDENTE: Composição SINAPI sem custo oficial verificável. Solicite avaliação técnica.');
  const cost=Number(row.unit_cost);
  const values=Object.fromEntries([['baixo',.75],['medio',1],['alto',1.25]].map(([key,mult])=>{
   const target=Math.min(.79,margin*mult);
   return [key,Math.round(cost/(1-target)*100)/100];
  }));
  return {service_id:id,description:'[SINAPI SP '+row.code+'] '+row.description,
   unit:normalUnit(row.unit),...values,labor_prices:null};
 });
}
export async function sinapiAdmin({api,req,url,db,out,err,body}){
 if(api==='admin-sinapi-import'&&req.method==='POST'){
  const rows=normalizeSinapiBatch(await body(req,180000));
  const {error}=await db.from('sinapi_reference_services')
   .upsert(rows,{onConflict:'uf,base_month,regime,code'});
  if(error)throw error;
  return out({ok:true,imported:rows.length});
 }
 if(api==='admin-sinapi-search'&&req.method==='GET'){
  const q=String(url.searchParams.get('q')||'').trim().replace(/[^\p{L}\p{N}\s.\/-]/gu,'').slice(0,65);
  if(q.length<2)return out({results:[]});
  const response=await db.from('sinapi_reference_services')
   .select('uf,base_month,regime,code,description,unit,unit_cost,price_verified,source_url')
   .eq('uf','SP').or('code.ilike.%'+q+'%,description.ilike.%'+q+'%')
   .order('base_month',{ascending:false}).limit(40);
  if(response.error)throw response.error;
  return out({results:response.data||[]});
 }
 if(api==='admin-sinapi-compare'&&req.method==='GET'){
  const source=url.searchParams.get('siurb_source')||'',siurbCode=url.searchParams.get('siurb_code')||'';
  const code=url.searchParams.get('sinapi_code')||'',month=url.searchParams.get('month')||'';
  const regime=url.searchParams.get('regime')||'';
  if(!['EDIF','INFRA'].includes(source)||!/^[0-9]{5,12}$/.test(siurbCode)||
   !/^[0-9]{4,10}$/.test(code)||!SINAPI_MONTH.test(month)||!SINAPI_REGIMES.has(regime))
   return err('Informe os códigos, competência e regime de ambas as composições.',400);
  const [a,b]=await Promise.all([
   db.from('siurb_reference_services').select('description,unit,unit_cost,base_month,regime')
    .eq('source',source).eq('code',siurbCode).eq('base_month','2026-07')
    .eq('regime','com_desoneracao').maybeSingle(),
   db.from('sinapi_reference_services').select('description,unit,unit_cost,price_verified,source_url,base_month,regime')
    .eq('uf','SP').eq('code',code).eq('base_month',month).eq('regime',regime).maybeSingle()
  ]);
  if(a.error||b.error)throw Error('Não foi possível buscar as composições.');
  if(!a.data||!b.data)return err('Composição não cadastrada. Confira os códigos.',404);
  const left=a.data,right=b.data,reasons=[];
  if(normalUnit(left.unit)!==normalUnit(right.unit))reasons.push('Unidades diferentes.');
  if(left.base_month!==right.base_month)reasons.push('Competências diferentes.');
  if(left.regime!==right.regime)reasons.push('Encargos/desoneração diferentes.');
  if(!(Number(left.unit_cost)>0)||!right.price_verified||!(Number(right.unit_cost)>0))
   reasons.push('Preço SINAPI não verificado ou custo indisponível.');
  if(url.searchParams.get('scope_confirmed')!=='1')reasons.push('Escopo técnico/equivalência não confirmado.');
  const comparable=reasons.length===0,siurb=Number(left.unit_cost),sinapi=Number(right.unit_cost);
  return out({comparable,reasons,
   siurb:{source,code:siurbCode,description:left.description,unit:left.unit,month:left.base_month,
    regime:left.regime,cost:siurb},
   sinapi:{source:'SINAPI',code,description:right.description,unit:right.unit,month:right.base_month,
    regime:right.regime,cost:sinapi,verified:right.price_verified},
   lower_reference:comparable?(siurb<sinapi?'SIURB':sinapi<siurb?'SINAPI':'EMPATE'):null,
   difference:comparable?Math.round(Math.abs(siurb-sinapi)*100)/100:null,
   note:'Somente comparação de custos unitários de referência; não é preço de venda. Conferir coeficientes, inclusões e método executivo.'});
 }
 return err('Rota SINAPI não encontrada.',404);
}
