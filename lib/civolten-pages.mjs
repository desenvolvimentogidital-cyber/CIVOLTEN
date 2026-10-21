// As tabelas crescem com o uso diario. O limite fixo de 250 registros ocultava
// orcamentos antigos, embora ainda estivessem salvos no Supabase.
// Paginar evita esse desaparecimento silencioso, com limite defensivo de memoria.
export async function listRows(url,headers,{pageSize=250,maxRows=2000}={}){
 if(!Number.isSafeInteger(pageSize)||!Number.isSafeInteger(maxRows)||pageSize<1||maxRows<pageSize||maxRows%pageSize!==0)
  throw Error('Paginação inválida');
 const all=[];
 for(let offset=0;offset<maxRows;offset+=pageSize){
  const page=new URL(url);
  page.searchParams.set('limit',String(pageSize));
  page.searchParams.set('offset',String(offset));
  const response=await fetch(page,{headers,signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw Error('Falha na consulta ao banco');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('Resposta inválida do banco');
  all.push(...rows);
  if(rows.length<pageSize)return all;
 }
 // Nao apresenta uma lista truncada como se fosse o historico completo.
 throw Error('O histórico excedeu o limite de 2.000 registros. Solicite uma ampliação da paginação.');
}
