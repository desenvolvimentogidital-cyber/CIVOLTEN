import {EDGE,json,sameOrigin,browserAllowed,readBody,cookieToken} from '../lib/civolten-security.mjs';
// O endpoint Supabase revalida o usuário e role a cada operação.
const endpoints={'admin-me':['GET'],'admin-list':['GET'],'admin-quote':['GET'],'admin-pricing':['GET','POST'],'admin-status':['POST'],'admin-media':['GET'],'admin-commercial':['GET'],'admin-save-commercial':['POST'],'admin-share-commercial':['POST'],'admin-commercial-history':['GET'],'admin-branding':['GET','POST'],'admin-export':['GET'],'admin-reference-search':['GET'],'admin-reference-detail':['GET'],'admin-reference-stats':['GET'],'admin-reference-import':['POST'],
 'admin-sinapi-import':['POST'],'admin-sinapi-search':['GET'],'admin-sinapi-compare':['GET'],
 'admin-cub-import':['POST'],'admin-cub-list':['GET']};
export default {async fetch(req){
 const url=new URL(req.url),action=url.searchParams.get('action');
 if(!endpoints[action]?.includes(req.method))return json({error:'Rota não permitida'},404);
 if(req.method==='POST'?!sameOrigin(req):!browserAllowed(req))
  return json({error:'Origem bloqueada'},403);
 const jwt=cookieToken(req);
 if(!jwt)return json({error:'Sessão expirada. Entre novamente.'},401);
 try{
  const dst=new URL(EDGE);dst.searchParams.set('api',action);
  if(['admin-quote','admin-commercial','admin-commercial-history'].includes(action)){
   const id=url.searchParams.get('id');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))
    return json({error:'Pedido inválido'},400);
   dst.searchParams.set('id',id);
  }
  if(['admin-sinapi-search','admin-sinapi-compare','admin-cub-list'].includes(action)){
   const permitted=action==='admin-sinapi-search'?['q']:action==='admin-cub-list'?['period']:
    ['siurb_source','siurb_code','sinapi_code','month','regime','scope_confirmed'];
   for(const name of permitted){
    const value=url.searchParams.get(name);
    if(value)dst.searchParams.set(name,value.slice(0,name==='q'?65:40));
   }
  }
  if(['admin-reference-search','admin-reference-detail'].includes(action)){
   for(const name of ['q','source','code']){
    const value=url.searchParams.get(name);
    if(value)dst.searchParams.set(name,value.slice(0,name==='q'?120:20));
   }
  }
  if(action==='admin-media'){
   const id=url.searchParams.get('id'),path=url.searchParams.get('path');
   if(!/^[0-9a-f-]{36}$/i.test(id||'')||typeof path!=='string'||path.length>400)
    return json({error:'Anexo inválido'},400);
   dst.searchParams.set('id',id);dst.searchParams.set('path',path);
  }
  const headers={Authorization:'Bearer '+jwt};
  let payload;
  if(req.method==='POST'){
   const sizeLimit=action==='admin-branding'?360000:
    ['admin-reference-import','admin-sinapi-import','admin-cub-import'].includes(action)?180000:60000;
   const body=await readBody(req,sizeLimit);
   headers['Content-Type']='application/json';
   payload=JSON.stringify(body);
  }
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  let r;
  try{r=await fetch(dst,{method:req.method,headers,body:payload,signal:ctrl.signal})}
  finally{clearTimeout(timer)}
  const response=await r.json().catch(()=>({error:'Resposta inválida do servidor'}));
  return json(response,r.status);
 }catch{return json({error:'Falha temporária do servidor.'},502)}
}};
