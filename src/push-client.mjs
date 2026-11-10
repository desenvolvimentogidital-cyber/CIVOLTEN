// CIVOLTEN — avisos Web Push e contadores dos pedidos públicos.
export const newSiteLeadCount = rows=>
 Array.isArray(rows)?rows.filter(x=>x.status==='novo').length:0;
export const newSiteLeadIds = (before,after)=>{
 const seen=new Set((Array.isArray(before)?before:[]).map(x=>x.id));
 return (Array.isArray(after)?after:[]).filter(x=>x.status==='novo'&&!seen.has(x.id)).map(x=>x.id);
};
const pushURL='https://rvhnuowqfdugcecgmxnv.supabase.co/functions/v1/civolten-push';
const supported=()=>typeof window!=='undefined'&&window.isSecureContext&&
 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function keyBytes(b64){
 const padded=b64.replace(/-/g,'+').replace(/_/g,'/');
 const decoded=atob(padded+'='.repeat((4-padded.length%4)%4));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
export async function pushStatus(){
 if(!supported())return 'unsupported';
 if(Notification.permission==='denied')return 'blocked';
 if(Notification.permission!=='granted')return 'inactive';
 try{
  const reg=await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription()?'active':'inactive';
 }catch{return 'inactive';}
}
export async function activatePush(client,userId){
 if(!supported())throw Error('Este navegador não aceita notificações em segundo plano. Use o Chrome no Android.');
 // A solicitação de permissão começa diretamente no clique do usuário.
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('Permissão não concedida. Ative notificações nas configurações do celular.');
 const response=await fetch(pushURL,{headers:{Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw Error('Servidor de notificações indisponível. Tente novamente.');
 const info=await response.json();
 if(!/^[A-Za-z0-9_-]{80,100}$/.test(info.publicKey||''))throw Error('Chave pública de notificações inválida.');
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 let created=false;
 if(!sub){
  sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(info.publicKey)});
  created=true;
 }
 const json=sub.toJSON(),p256dh=json.keys?.p256dh,auth=json.keys?.auth;
 if(!p256dh||!auth)throw Error('O celular não forneceu as chaves de inscrição.');
 const result=await client.from('cv_push_subscriptions_v1').upsert({
  user_id:userId,endpoint:sub.endpoint,p256dh,auth,updated_at:new Date().toISOString()
 },{onConflict:'endpoint'}).select('id').single();
 if(result.error||!result.data?.id){
  if(created)await sub.unsubscribe().catch(()=>{});
  throw Error('Não foi possível registrar este celular no Supabase: '+(result.error?.message||'sem confirmação'));
 }
 return true;
}
export async function deactivatePush(client,userId){
 if(!supported())return false;
 const reg=await navigator.serviceWorker.ready;
 const sub=await reg.pushManager.getSubscription();
 if(!sub)return true;
 const removed=await client.from('cv_push_subscriptions_v1').delete()
  .eq('endpoint',sub.endpoint).eq('user_id',userId);
 if(removed.error)throw Error('Falha ao desativar notificações: '+removed.error.message);
 await sub.unsubscribe();
 return true;
}
export function updateDeviceBadge(number){
 try{
  if(typeof navigator.setAppBadge==='function'){
   const p=number>0?navigator.setAppBadge(number):navigator.clearAppBadge?.();
   p?.catch?.(()=>{});
  }
 }catch{/* API opcional no Android */}
}
export function playNewLeadTone(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return;
  const ctx=new Ctx();
  if(ctx.state==='suspended'){void ctx.close();return;}
  const t=ctx.currentTime;
  for(const [start,freq] of [[0,660],[0.16,880]]){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';osc.frequency.value=freq;
   gain.gain.setValueAtTime(.0001,t+start);
   gain.gain.exponentialRampToValueAtTime(.11,t+start+.025);
   gain.gain.exponentialRampToValueAtTime(.0001,t+start+.13);
   osc.connect(gain);gain.connect(ctx.destination);
   osc.start(t+start);osc.stop(t+start+.14);
  }
  setTimeout(()=>void ctx.close().catch(()=>{}),700);
  if(typeof navigator.vibrate==='function')navigator.vibrate([140,70,140]);
 }catch{/* Autoplay e áudio dependem das permissões do navegador. */}
}
