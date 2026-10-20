// CUB-SP: banco de custos básicos unitários R1 (não valores finais de obra).
const CUB_MONTH=/^20[0-9]{2}-(?:0[1-9]|1[0-2])$/;
const CUB_PATTERNS=new Set(['R1B','R1N','R1A']);
const CUB_REGIMES=new Set(['sem_desoneracao','com_desoneracao']);
const CUB_SOURCES=/^https:\/\/(?:[a-z0-9-]+\.)*(?:sindusconsp\.com\.br|portaldori\.com\.br)\//i;
export function normalizeCubBatch(data){
 if(data?.schema!=='civolten.cub.v1'||data?.uf!=='SP'||!CUB_MONTH.test(data?.period))
  throw Error('CUB inválido: informe SP, competência e schema civolten.cub.v1.');
 if(!Array.isArray(data.items)||!data.items.length||data.items.length>24)
  throw Error('Envie de 1 a 24 valores CUB por lote.');
 const keys=new Set();
 return data.items.map(item=>{
  const pattern=String(item?.pattern||'').trim().toUpperCase();
  const regime=String(item?.regime||'').trim();
  const raw=item?.cost;
  const cost=Number(raw);
  const url=String(item?.source_url||'').trim();
  if(!CUB_PATTERNS.has(pattern)||!CUB_REGIMES.has(regime)||
    !Number.isFinite(cost)||cost<=0||cost>100000||
    Math.abs(cost*100-Math.round(cost*100))>1e-7||!CUB_SOURCES.test(url)||url.length>500)
   throw Error('Valor, padrão, regime ou fonte oficial CUB inválidos.');
  const key=pattern+':'+regime;if(keys.has(key))throw Error('Padrão e regime CUB duplicados.');keys.add(key);
  return {uf:'SP',base_month:data.period,pattern,regime,
   unit_cost:Math.round(cost*100)/100,source_url:url};
 });
}
export async function publicCubReference(db){
 const {data,error}=await db.from('cub_reference_rates')
  .select('base_month,pattern,regime,unit_cost,source_url')
  .eq('uf','SP').order('base_month',{ascending:false}).limit(72);
 if(error)throw Error('Referências CUB momentaneamente indisponíveis.');
 return {uf:'SP',rates:data||[],note:'CUB é custo básico referencial, não valor final da construção.'};
}
export async function cubAdmin({api,req,url,db,out,err,body}){
 if(api==='admin-cub-import'&&req.method==='POST'){
  const rows=normalizeCubBatch(await body(req,160000));
  const {error}=await db.from('cub_reference_rates')
   .upsert(rows,{onConflict:'uf,base_month,pattern,regime'});
  if(error)throw error;
  return out({ok:true,imported:rows.length,period:rows[0].base_month});
 }
 if(api==='admin-cub-list'&&req.method==='GET'){
  const month=String(url.searchParams.get('period')||'');
  if(month&&!CUB_MONTH.test(month))return err('Competência inválida.',400);
  let q=db.from('cub_reference_rates')
   .select('uf,base_month,pattern,regime,unit_cost,source_url,updated_at')
   .eq('uf','SP');
  if(month)q=q.eq('base_month',month);
  const {data,error}=await q.order('base_month',{ascending:false}).limit(72);
  if(error)throw error;
  return out({rates:data||[]});
 }
 return err('Rota CUB inexistente.',404);
}
