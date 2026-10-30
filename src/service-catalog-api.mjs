/* Catálogo real de serviços SIURB: somente leitura e acesso autenticado.
   Lista paginada evita transferir milhares de preços ao celular.
   O preço usado na gravação é reconsultado no servidor. */
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function searchParams(req){return new URL(req.url,'https://civolten-gj91.vercel.app').searchParams}
export async function handleServiceCatalog({req,res,sql,parts,method,send}){
 if(parts[0]!=='services'||parts[1]!=='search')return false;
 const done=(status,value)=>{send(res,status,value);return true};
 if(method!=='GET'||parts.length!==2)return done(405,{error:'Apenas pesquisa GET'});
 const qs=searchParams(req),id=qs.get('budget_id');
 if(!uuid(id))return done(400,{error:'Abra um orçamento válido para consultar o catálogo'});
 const budgetRows=await sql.query('SELECT reference_month,regime FROM budgets WHERE id=$1 LIMIT 1',[id]);
 if(!budgetRows.length)return done(404,{error:'Orçamento não encontrado'});
 const budget=budgetRows[0],raw=(qs.get('q')||'').trim(),category=qs.get('category')||'';
 if(raw.length>100)return done(400,{error:'Busca deve ter até 100 caracteres'});
 if(category&&!['Edificações','Infraestrutura'].includes(category))return done(400,{error:'Categoria não reconhecida'});
 const offset=Number(qs.get('offset')||0),limit=Number(qs.get('limit')||25);
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000||!Number.isSafeInteger(limit)||limit<1||limit>50)
  return done(400,{error:'Paginação inválida'});
 const term=raw.replace(/[\\%_]/g,'');
 const pattern='%'+term+'%';
 const args=[budget.reference_month,budget.regime,category||null,pattern,raw,limit,offset];
 const filter=" FROM reference_prices p JOIN reference_price_versions v ON v.id=p.version_id LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id WHERE v.source='SIURB' AND v.reference_month=$1 AND v.regime=$2 AND ($3::text IS NULL OR v.scope=$3) AND (p.code ILIKE $4 OR p.description ILIKE $4)";
 const rows=await sql.query(
  'SELECT p.id,p.code,p.description,p.unit,p.unit_cost,p.workforce_hh_direct,p.productivity_status,'+
  '(d.reference_price_id IS NOT NULL) AS composition_available,'+
  'v.scope AS category,v.reference_month,v.regime'+filter+
  " ORDER BY CASE WHEN p.code=$5 THEN 0 WHEN p.code ILIKE $5 || '%' THEN 1 ELSE 2 END, p.description,p.code,v.scope,p.id LIMIT $6::int OFFSET $7::int",args);
 const totalRows=await sql.query('SELECT count(*)::int AS total'+filter,args.slice(0,4));
 const total=Number(totalRows[0]?.total||0);
 return done(200,{items:rows,total,offset,limit,has_more:offset+rows.length<total,
  reference_month:budget.reference_month,regime:budget.regime,source:'SIURB',commercial_release:false});
}
