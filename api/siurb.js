// Proxy de download de quatro planilhas oficiais da SIURB/SP (julho de 2026).
const FILES={onerada:{edif:'onerada-sem-des-custos-unit-edif-julho-2026-2-xls',infra:'onerada-sem-des-custos-unit-infra-julho-2026-2-xls'},desonerada:{edif:'desonerada-com-des-custos-unit-edif-julho-2026-2-xls',infra:'desonerada-com-des-custos-unid-infra-julho-2026-2-xls'}};

const COMPLEMENTOS={
 onerada:{
  mensalista:'onerada-sem-des-mobra-mensalista-julho-2026-1-xlsx',
  horista:'onerada-sem-des-mobra-horista-julho-2026-1-xlsx',
  insumos:'onerada-sem-des-insumos-julho-2026-1-xlsx',
  composicoesEdif:'onerada-sem-des-comp-custos-unit-edif-julho-2026-2-xls',
  composicoesInfra:'onerada-sem-des-comp-custos-unit-infra-julho-2026-2-xls'
 },
 desonerada:{
  mensalista:'desonerada-com-des-mobra-mensalista-julho-2026-1-xlsx',
  horista:'desonerada-com-des-mobra-horista-julho-2026-1-xlsx',
  insumos:'desonerada-com-des-insumos-julho-2026-1-xlsx',
  composicoesEdif:'desonerada-com-des-comp-custos-unit-edif-julho-2026-2-xls',
  composicoesInfra:'desonerada-com-des-comp-custos-unit-infra-julho-2026-2-xls'
 }
};
const BASE='https://prefeitura.sp.gov.br/documents/d/obras/';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({erro:'Método não permitido'});
 const grupo=String(req.query.grupo||'').toLowerCase(),regime=String(req.query.regime||'onerada').toLowerCase();
 const tipo=String(req.query.tipo||'');const file=tipo?COMPLEMENTOS[regime]?.[tipo]:FILES[regime]?.[grupo];if(!file)return res.status(400).json({erro:'Informe tipo válido ou grupo edif/infra e regime onerada/desonerada'});
 try{
  const upstream=await fetch(BASE+file,{headers:{'User-Agent':'CIVOLTEN-Orcamentos/1.0 (+Consulta de Tabela Publica)','Accept':'application/vnd.ms-excel,application/octet-stream,*/*'},signal:AbortSignal.timeout(22000)});
  if(!upstream.ok)throw new Error('Prefeitura retornou HTTP '+upstream.status);
  const array=await upstream.arrayBuffer();
  if(!array.byteLength||array.byteLength>40*1024*1024)throw new Error('Arquivo vazio ou acima do limite');
  const bytes=new Uint8Array(array.slice(0,8));const isXLS=bytes[0]===0xD0&&bytes[1]===0xCF,isXLSX=bytes[0]===0x50&&bytes[1]===0x4B;
  if(!isXLS&&!isXLSX)throw new Error('O servidor de origem não retornou uma planilha Excel.');
  if(req.query.health==='1')return res.status(200).json({ok:true,grupo,regime,bytes:array.byteLength,format:isXLS?'XLS':'XLSX',base:'07/2026'});
  res.setHeader('Content-Type',isXLSX?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.ms-excel');
  res.setHeader('Content-Disposition','inline; filename="siurb-'+(tipo||grupo)+'-'+regime+'-jul2026.'+(isXLSX?'xlsx':'xls')+'"');
  res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=432000');
  return res.status(200).send(Buffer.from(array));
 }catch(e){
  console.error('Falha SIURB:',e.message);
  res.setHeader('Cache-Control','no-store');
  return res.status(502).json({erro:'Não foi possível obter a planilha da Prefeitura neste momento. Baixe o XLS na página oficial e importe manualmente.',detalhe:String(e.message).slice(0,130)});
 }
}