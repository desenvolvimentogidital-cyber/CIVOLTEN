// Base SIURB 07/2026. Invocada somente após autenticação administrativa.
// Nunca mistura custos de referência com preços configurados ou propostas comerciais.
const SOURCES=new Set(['EDIF','INFRA']);
function bad(message){throw Object.assign(new Error(message),{status:400})}
function clean(v,max=1200){return typeof v==='string'?v.trim().slice(0,max):''}
function dec(v,max=100000000,precision=7){
 if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)bad('Valor numérico inválido na planilha.');
 const x=Math.round(v*Math.pow(10,precision))/Math.pow(10,precision);
 return x;
}
export function normalizeReferenceBatch(data){
 if(!SOURCES.has(data?.source)||data?.period!=='2026-07'||data?.regime!=='com_desoneracao')bad('A importação aceita apenas SIURB julho/2026, com desoneração, EDIF ou INFRA.');
 if(!Array.isArray(data.items)||!data.items.length||data.items.length>30)bad('Envie lotes de 1 a 30 serviços.');
 const codes=new Set();
 const rows=data.items.map((r,i)=>{
  const code=String(r?.code||'').trim(),description=clean(r?.description),unit=clean(r?.unit,24);
  if(!/^[0-9]{5,12}$/.test(code)||codes.has(code))bad('Código inválido ou repetido no lote '+(i+1)+'.');
  codes.add(code);
  if(description.length<3||description.length>1200||!unit||unit.length>24)bad('Descrição ou unidade inválida no serviço '+code+'.');
  if(!Array.isArray(r.inputs)||r.inputs.length>150)bad('Composição analítica inválida no serviço '+code+'.');
  const inputs=r.inputs.map((v,j)=>{
   const inputCode=String(v?.code||'').trim(),name=clean(v?.description),iu=clean(v?.unit,24);
   if(!/^[0-9]{1,15}$/.test(inputCode)||name.length<2||!iu)bad('Insumo inválido no serviço '+code+', linha '+(j+1)+'.');
   return {code:inputCode,description:name,unit:iu,
    unit_cost:dec(v.unit_cost),coefficient:dec(v.coefficient,10000000),partial_cost:dec(v.partial_cost)};
  });
  return {source:data.source,base_month:data.period,regime:data.regime,code,
   description,unit,unit_cost:dec(r.cost,100000000,2),inputs};
 });
 return rows;
}
export async function handleReference({api,req,url,db,out,err,body}){
 if(api==='admin-reference-search'&&req.method==='GET'){
  const q=clean(url.searchParams.get('q'),120).replace(/[%_\\]/g,'').trim();
  const source=clean(url.searchParams.get('source'),5);
  if(q.length<2)return out({results:[],help:'Digite pelo menos 2 caracteres.'});
  if(source&&!SOURCES.has(source))return err('Base inválida.',400);
  let query=db.from('siurb_reference_services').select('source,base_month,regime,code,description,unit,unit_cost');
  if(source)query=query.eq('source',source);
  query=query.or('code.ilike.%'+q+'%,description.ilike.%'+q+'%').order('description',{ascending:true}).limit(40);
  const {data,error}=await query;
  if(error)throw error;
  return out({results:data,base_month:'2026-07',regime:'com_desoneracao'});
 }
 if(api==='admin-reference-detail'&&req.method==='GET'){
  const source=clean(url.searchParams.get('source'),5),code=clean(url.searchParams.get('code'),15);
  if(!SOURCES.has(source)||!/^[0-9]{5,12}$/.test(code))return err('Código ou base inválida.',400);
  const {data,error}=await db.from('siurb_reference_services').select('source,base_month,regime,code,description,unit,unit_cost,inputs').eq('source',source).eq('base_month','2026-07').eq('code',code).maybeSingle();
  if(error)throw error;if(!data)return err('Serviço não encontrado.',404);
  return out({service:data});
 }
 if(api==='admin-reference-stats'&&req.method==='GET'){
  const [infra,edif]=await Promise.all(
   ['INFRA','EDIF'].map(s=>db.from('siurb_reference_services').select('code',{head:true,count:'exact'}).eq('source',s).eq('base_month','2026-07'))
  );
  if(infra.error||edif.error)throw Error('Não foi possível consultar as bases.');
  return out({infra:infra.count||0,edif:edif.count||0,reference_month:'07/2026'});
 }
 if(api==='admin-reference-import'&&req.method==='POST'){
  const payload=await body(req,180000);
  const normalized=normalizeReferenceBatch(payload);
  const {error}=await db.from('siurb_reference_services').upsert(normalized,{onConflict:'source,base_month,regime,code',ignoreDuplicates:false});
  if(error)throw error;
  return out({ok:true,imported:normalized.length,source:payload.source});
 }
 return err('Rota de referência inválida.',404);
}
