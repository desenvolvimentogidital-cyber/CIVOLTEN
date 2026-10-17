// SIURB JUL/2026 (EDIF + INFRA): busca pública de descrições SEM insumos, custos
// ou preços unitários. Os custos são consultados apenas dentro da simulação no servidor.
const CODE=/^siurb:(EDIF|INFRA):([0-9]{5,12})$/;
const idFor=row=>'siurb:'+row.source+':'+row.code;
const qtyWhole=unit=>/^(UN|UNID|UNIDADE|CJ|CONJ|JG|PÇ|PC|PAR|KIT|VB|PTO|POSTO)$/i.test(String(unit).trim());
export const isWholeUnit=qtyWhole;
export function isPublicReferenceId(id){return typeof id==='string'&&CODE.test(id)}
export function publicReferenceItem(row){
 return {id:idFor(row),descricao:row.description,unidade:qtyWhole(row.unit)?'unidade':row.unit,
  unidade_original:row.unit,categoria:row.source==='EDIF'?'construcao_civil':'infraestrutura',fonte:row.source};
}
export async function publicReferenceSearch({db,query,source=''}){
 if(typeof query!=='string'||query.length<2||query.length>65)return [];
 const q=query.trim().normalize('NFKC').replace(/[^\p{L}\p{N}\s.\/-]/gu,'').replace(/\s+/g,' ');
 if(q.length<2)return [];
 if(source&&!['EDIF','INFRA'].includes(source))throw Error('Base de pesquisa inválida.');
 let queryDb=db.from('siurb_reference_services')
  .select('source,code,description,unit')
  .eq('base_month','2026-07').eq('regime','com_desoneracao');
 if(source)queryDb=queryDb.eq('source',source);
 const {data,error}=await queryDb.or('code.ilike.%'+q+'%,description.ilike.%'+q+'%').order('description',{ascending:true}).limit(30);
 if(error)throw Error('Pesquisa de serviços temporariamente indisponível.');
 return (data||[]).map(publicReferenceItem);
}
// Paginação de nomes/códigos para o seletor público. Nunca enviar preços,
 // composição de custos, coeficientes ou insumos ao visitante.
export async function publicReferencePage({db,offset=0,size=400}){
 if(!Number.isInteger(offset)||offset<0||offset>10000||
    !Number.isInteger(size)||size<1||size>500)
  throw Error('Paginação inválida.');
 const {data,error,count}=await db.from('siurb_reference_services')
  .select('source,code,description,unit',{count:'exact'})
  .eq('base_month','2026-07').eq('regime','com_desoneracao')
  .order('source',{ascending:true}).order('code',{ascending:true})
  .range(offset,offset+size-1);
 if(error)throw Error('Não foi possível carregar a lista de serviços.');
 return {items:(data||[]).map(publicReferenceItem),total:count??0,offset,next_offset:offset+(data||[]).length};
}
export async function referencePricingServices(db,selected,conf){
 if(!Array.isArray(selected)||selected.length>60)throw Error('Quantidade de serviços inválida.');
 const ids=[...new Set(selected.map(item=>item?.servico_id).filter(isPublicReferenceId))];
 if(!ids.length)return [];
 const codes=[...new Set(ids.map(id=>CODE.exec(id)[2]))];
 const {data,error}=await db.from('siurb_reference_services')
  .select('source,code,description,unit,unit_cost')
  .eq('base_month','2026-07').eq('regime','com_desoneracao').in('code',codes);
 if(error)throw Error('Base SIURB indisponível para esta simulação.');
 const byId=new Map((data||[]).map(row=>[idFor(row),row]));
 const margin=Number(conf?.margem_minima_alvo);
 if(!Number.isFinite(margin)||margin<0||margin>=.8)throw Error('Margem comercial inválida no servidor.');
 const results=[];
 for(const id of ids){
  const row=byId.get(id);
  if(!row)throw Error('Serviço SIURB não encontrado. Atualize a pesquisa.');
  const cost=Number(row.unit_cost);
  if(!Number.isFinite(cost)||cost<=0||cost>100000000)throw Error('Serviço SIURB sem custo-base válido.');
  // Modelo preliminar: custo de referência / (1 - margem alvo).
  // baixo/médio/alto conservam o formato do catálogo já existente.
  // impostos, logística e custo indireto são acrescentados por calc() no servidor.
  const value=mult=>{
   const target=Math.min(.79,margin*mult);
   const amount=Math.round(cost/(1-target)*100)/100;
   if(!Number.isFinite(amount)||amount<=0||amount>100000000)
    throw Error('Preço de referência elevado demais. Solicite avaliação.');
   return amount;
  };
  results.push({
   service_id:id,description:'['+row.source+' '+row.code+'] '+row.description,
   unit:qtyWhole(row.unit)?'unidade':row.unit,
   baixo:value(.75),medio:value(1),alto:value(1.25)
  });
 }
 return results;
}
