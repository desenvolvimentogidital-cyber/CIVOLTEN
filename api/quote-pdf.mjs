import {EDGE,cookieToken,browserAllowed} from '../lib/civolten-security.mjs';
import {generateQuotePdf} from '../lib/civolten-pdf.mjs';

// Endpoint de PDF privado, não armazena PDF nem recebe preço arbitrário do navegador.
// Somente o banco da CIVOLTEN define os valores que aparecem no orçamento.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const common={
 'Cache-Control':'private, no-store, max-age=0',
 'Pragma':'no-cache',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Vary':'Cookie',
 'X-Robots-Tag':'noindex, nofollow, noarchive'
};
const error=(message,status)=>Response.json({error:message},{status,headers:common});

export default {async fetch(req){
 if(req.method!=='GET')return error('Método inválido',405);
 if(!browserAllowed(req))return error('Origem bloqueada',403);
 const jwt=cookieToken(req);
 if(!jwt)return error('Entre na Área da empresa para consultar o PDF.',401);
 const url=new URL(req.url),id=url.searchParams.get('id'),mode=url.searchParams.get('mode')||'preview';
 if(!UUID.test(id||''))return error('Identificador do pedido inválido',400);
 if(!['preview','final'].includes(mode))return error('Modo inválido',400);
 const remote=new URL(EDGE);
 remote.searchParams.set('api','admin-quote');
 remote.searchParams.set('id',id);
 const control=new AbortController();
 const timer=setTimeout(()=>control.abort(),15000);
 try{
  const response=await fetch(remote,{
   headers:{Authorization:'Bearer '+jwt,'Cache-Control':'no-store'},signal:control.signal
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)return error(
   response.status===401?'Acesso restrito ao administrador.':response.status===404?'Pedido não encontrado.':'Não foi possível carregar o pedido.',
   [400,401,403,404].includes(response.status)?response.status:502
  );
  if(!data?.pedido||data.pedido.id!==id)return error('Resposta inválida',502);
  let bytes;
  try{bytes=await generateQuotePdf(data,mode)}
  catch(e){
   if(e.status===409)return error(e.message,409);
   throw e;
  }
  const filename='CIVOLTEN-'+id.slice(0,8).toUpperCase()+(mode==='preview'?'-PREVIA':'-ORCAMENTO')+'.pdf';
  return new Response(bytes,{
   status:200,headers:{
    ...common,'Content-Type':'application/pdf',
    'Content-Disposition':(mode==='preview'?'inline':'attachment')+'; filename="'+filename+'"',
    'Content-Length':String(bytes.length)
   }
  });
 }catch(e){
  return error('Erro temporário ao gerar o PDF.',502);
 }finally{clearTimeout(timer)}
}};
