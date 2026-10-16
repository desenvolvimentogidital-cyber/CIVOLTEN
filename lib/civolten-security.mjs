// CIVOLTEN — somente no backend Vercel. Nenhuma chave de serviço aqui.
export const SUPABASE='https://rvhnuowqfdugcecgmxnv.supabase.co';
export const PUBLIC_KEY='sb_publishable_UpkP7prNZFMBacZw31SuRg_8E-ea3TP';
export const EDGE=SUPABASE+'/functions/v1/civolten-beta';
export const COOKIE='__Host-civolten_session';
export const securityHeaders={
 'Cache-Control':'no-store, private','Pragma':'no-cache',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY','Vary':'Cookie'
};
export function json(data,status=200,extra={}){
 return Response.json(data,{status,headers:{...securityHeaders,...extra}});
}
export function sameOrigin(request){
 return request.headers.get('origin')===new URL(request.url).origin
  && request.headers.get('sec-fetch-site')!=='cross-site';
}
export function browserAllowed(request){
 return request.headers.get('sec-fetch-site')!=='cross-site';
}
export async function readBody(req,max=8000){
 const cl=Number(req.headers.get('content-length')||0);
 if(cl>max)throw Error('Requisição grande demais');
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw Error('É obrigatório enviar JSON');
 const raw=await req.text();
 if(raw.length>max)throw Error('Requisição grande demais');
 let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('JSON inválido')}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Objeto JSON inválido');
 return parsed;
}
export function cookieToken(request){
 const raw=request.headers.get('cookie')||'';
 const pair=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
 const value=pair?.slice(COOKIE.length+1)||'';
 return /^[A-Za-z0-9._~-]{60,8192}$/.test(value)?value:null;
}
export function sessionCookie(token,maxAge){
 return COOKIE+'='+token+'; Path=/; Max-Age='+maxAge+'; Secure; HttpOnly; SameSite=Strict';
}
export function clearCookie(){
 return COOKIE+'=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict';
}
export async function authorized(jwt){
 if(!jwt)return false;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(EDGE+'?api=admin-me',{
   headers:{Authorization:'Bearer '+jwt,'Cache-Control':'no-store'},signal:ctrl.signal
  });
  return r.ok&&(await r.json()).authenticated===true;
 }catch{return false}finally{clearTimeout(timer)}
}
