// Apenas chave pública; nenhuma credencial service_role.
export const SUPABASE='https://rvhnuowqfdugcecgmxnv.supabase.co',KEY='sb_publishable_UpkP7prNZFMBacZw31SuRg_8E-ea3TP',EDGE=SUPABASE+'/functions/v1/civolten-beta';
const COOKIE='__Host-civolten_session';
export const json=(v,status=200,h={})=>Response.json(v,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Cookie',...h}});
export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin&&r.headers.get('sec-fetch-site')!=='cross-site';
export const browserAllowed=r=>r.headers.get('sec-fetch-site')!=='cross-site';
export const cookieToken=r=>{const v=(r.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';return /^[A-Za-z0-9._~-]{60,8192}$/.test(v)?v:null};
export const sessionCookie=(v,age)=>COOKIE+'='+v+'; Path=/; Max-Age='+age+'; Secure; HttpOnly; SameSite=Strict';
export const clearCookie=()=>COOKIE+'=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict';
export async function readBody(r,max=60000){
 if(Number(r.headers.get('content-length')||0)>max||!/^application\/json(?:\s*;|$)/i.test(r.headers.get('content-type')||''))throw Error('Formato ou tamanho inválido');
 // Nunca leia um corpo inteiro sem limite: Content-Length pode estar ausente
 // ou ser falso em requisicoes enviadas diretamente a API.
 if(!r.body)throw Error('JSON inválido');
 const reader=r.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let raw='',bytes=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>max){await reader.cancel();throw Error('Requisição grande demais')}
   raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
 }finally{reader.releaseLock()}
 const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('JSON inválido');
 return data;
}
export async function authorized(jwt){
 if(!jwt)return false;const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
 try{const r=await fetch(EDGE+'?api=admin-me',{headers:{Authorization:'Bearer '+jwt},signal:c.signal});return r.ok&&(await r.json()).authenticated===true}
 catch{return false}finally{clearTimeout(timer)}
}
