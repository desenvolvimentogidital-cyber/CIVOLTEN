
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {PAGE} from './site.ts';
import {publicReferenceSearch,publicReferencePage,referencePricingServices,selectedMode,isPublicReferenceId} from './public-siurb.ts';
import {handleReference} from './siurb-reference.ts';
import {sinapiPage,sinapiPricingServices,sinapiAdmin} from './sinapi-reference.ts';
import {handleAdminExtra,handleClientExtra} from './quote-extra.ts';
const BASE=Deno.env.get('SUPABASE_URL')||'';
const SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(BASE,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
const ALL=['novo','analisando','aguardando_cliente','orcamento_enviado','visita_necessaria','concluido','recusado'];
const BRAZIL_DDDS=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
const MIME=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a']);
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
function out(data,status=200){return Response.json(data,{status,headers:{...CORS,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function err(m,s=400){return out({error:m},s)}
function num(n,min=0,max=1e8){if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error('Número inválido');return n}
function cents(n){return Math.round(num(n)*100)}
function money(c){return Number((c/100).toFixed(2))}
async function getPricing(){
 const [a,b]=await Promise.all([db.from('pricing_catalog').select('*').eq('enabled',true),db.from('pricing_config').select('*').eq('id',1).single()]);
 if(a.error||b.error)throw new Error('Catálogo indisponível');
 return {catalog:a.data,conf:b.data};
}
function calc(items,standard,days,km,catalog,conf){
 if(!['baixo','medio','alto'].includes(standard))throw new Error('Escolha um padrão');
 if(!Array.isArray(items)||items.length<1||items.length>60)throw new Error('Informe entre 1 e 60 serviços');
 days=num(days,1,365);km=num(km,0,1000);
 if(!Number.isInteger(days))throw new Error('Dias precisam ser inteiros');
 const m=new Map(catalog.map(x=>[x.service_id,x]));
 let subtotal=0,measure=0,hasMeasurement=false;
 const lines=[];
 for(const x of items){
  const svc=m.get(x.servico_id);
  if(!svc)throw new Error('Serviço inválido ou desativado');
  const modalidade=selectedMode(x);
  const siurb=isPublicReferenceId(x.servico_id);
  if(modalidade==='mao_obra'&&!siurb)
   throw new Error('PRECIFICACAO_PENDENTE: Para serviços antigos, a mão de obra precisa de avaliação individual.');
  if(modalidade==='mao_obra'&&!svc.labor_prices)
   throw new Error('PRECIFICACAO_PENDENTE: A composição SIURB não informa mão de obra separada. Solicite avaliação personalizada.');
  const q=num(x.quantidade,0.001,100000);
  if(Math.abs(q*1000-Math.round(q*1000))>1e-7)throw new Error('Use até três casas decimais');
  if(svc.unit==='unidade'&&!Number.isInteger(q))throw new Error('Unidades exigem quantidade inteira');
  const pricing=modalidade==='mao_obra'?svc.labor_prices:svc;
  const unit=cents(Number(pricing[standard]));
  if(unit===0)throw new Error('PRECIFICACAO_PENDENTE: Para esse serviço e padrão, solicite avaliação personalizada.');
  const line=Math.round(unit*q);
  subtotal+=line;if(svc.unit==='m²'||svc.unit==='metro'){hasMeasurement=true;measure+=q}
  lines.push({servico_id:svc.service_id,
   descricao:siurb?svc.description+' — '+(modalidade==='mao_obra'?'Somente mão de obra':'Serviço completo (mão de obra + materiais)'):svc.description,
   modalidade,unidade:svc.unit,quantidade:q,preco_unitario:money(unit),total:money(line)});
 }
 if(subtotal>9e12)throw new Error('Valor elevado demais');
 const fee=(hasMeasurement&&measure<Number(conf.limiar_soma_medidas))?cents(Number(conf.logistica_diaria_obra_pequena))*days:0;
 const travel=(km>Number(conf.limite_distancia_km))?Math.round(subtotal*Number(conf.sobretaxa_distancia_sobre_servicos)):0;
 const indirect=Math.round(cents(Number(conf.pro_labore_mensal)+Number(conf.despesas_operacionais_mensais))/Number(conf.dias_produtivos_mes)*days);
 const base=subtotal+fee+travel+indirect;
 const tax=Number(conf.imposto_sobre_valor_final);
 const total=Math.ceil(base/(1-tax));
 return {padrao:standard,itens:lines,dias_estimados_obra:days,distancia_km:km,subtotal_servicos:money(subtotal),taxa_logistica:money(fee),sobretaxa_distancia:money(travel),imposto:money(total-base),total_bruto:money(total),aviso:'Simulação preliminar. Não é orçamento aprovado nem garantia de margem; depende de análise técnica e custos reais.'};
}
function publicQuote(q){return {total_bruto:q.total_bruto,aviso:q.aviso,padrao:q.padrao};}
function sample(x){return typeof x==='string'?x:''}
async function body(req,max=80000){const s=await req.text();if(s.length>max)throw new Error('Dados muito grandes');try{return JSON.parse(s)}catch{throw new Error('Dados inválidos')}}
async function hash(v){const b=new TextEncoder().encode(v);const d=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function uuidValid(x){return typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)}
async function rate(req,action,max){
 const ip=sample(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].slice(0,90);
 const h=await hash(SECRET+':'+ip);
 const {data,error}=await db.rpc('civolten_consume_limit',{p_ip:h,p_action:action,p_limit:max});
 if(error)throw new Error('Proteção de solicitações indisponível');
 if(!data)throw new Error('Limite de solicitações por hora atingido');
}
async function draft(b){
 if(!uuidValid(b.id)||typeof b.secret!=='string')return null;
 const {data}=await db.from('quote_requests').select('id,access_hash,submitted_at').eq('id',b.id).maybeSingle();
 if(!data||data.submitted_at||b.secret.length>256)return null;
 return (await hash(b.secret))===data.access_hash?data:null;
}
async function admin(req){
 const s=sample(req.headers.get('authorization')).match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
 if(!s)return false;
 const {data,error}=await db.auth.getUser(s);
 if(error||!data?.user?.id||data.user.is_anonymous)return false;
 const {data:a,error:e}=await db.from('admin_users').select('user_id,role,enabled')
  .eq('user_id',data.user.id).eq('enabled',true).maybeSingle();
 // Não confia em role vinda do cliente nem em user_metadata.
 return !e&&!!a&&['owner','admin'].includes(a.role);
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 try{
  const url=new URL(req.url),api=url.searchParams.get('api');
  if(req.method==='GET'&&!api)return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
  if(req.method==='GET'&&api==='health'){
   const {catalog}=await getPricing();return out({online:true,servicos:catalog.length,projeto:'CIVOLTEN'});
  }
  if(req.method==='GET'&&api==='site-branding'){
   const {data,error}=await db.from('civolten_branding')
    .select('logo_data_url,logo_width_px,color_primary,color_accent,site_headline,site_description,footer_note,contact_whatsapp')
    .eq('id',1).maybeSingle();
   if(error)throw Error('Não foi possível carregar a identidade visual.');
   return out({branding:data||{
    logo_data_url:null,logo_width_px:160,color_primary:'#08182B',color_accent:'#DCA629',
    site_headline:'Peça seu orçamento sem sair de casa.',
    site_description:'Descreva o serviço, envie fotos, áudio ou vídeo e faça sua simulação.',
    footer_note:'Atendimento e orçamentos digitais.',contact_whatsapp:''
   }});
  }
  if(req.method==='GET'&&api==='catalog'){
   const {catalog}=await getPricing();
   return out({catalogo:catalog.map(x=>({id:x.service_id,descricao:x.description,categoria:x.category,unidade:x.unit}))});
  }
  if(req.method==='GET'&&api==='siurb-list'){
   const parsedOffset=url.searchParams.get('offset')||'0';
   if(!/^\d{1,5}$/.test(parsedOffset))return err('Paginação inválida.',400);
   const page=await publicReferencePage({db,offset:Number(parsedOffset),size:400});
   return out(page);
  }
  if(req.method==='GET'&&api==='sinapi-list'){
   const raw=url.searchParams.get('offset')||'0';
   if(!/^\d{1,5}$/.test(raw))return err('Paginação SINAPI inválida.',400);
   return out(await sinapiPage({db,offset:Number(raw),size:400}));
  }
  if(req.method==='GET'&&api==='siurb-search'){
   const q=url.searchParams.get('q')||'';
   const source=url.searchParams.get('source')||'';
   const results=await publicReferenceSearch({db,query:q,source});
   return out({results,source:'SIURB',base_month:'2026-07',regime:'com_desoneracao'});
  }
  if(req.method==='POST'&&api==='simulate'){
   const b=await body(req),{catalog,conf}=await getPricing();
   try {
    const [references,sinapi]=await Promise.all([
     referencePricingServices(db,b.itens,conf),
     sinapiPricingServices(db,b.itens,conf)
    ]);
    const quote=calc(b.itens,b.padrao,b.dias,b.km,[...catalog,...references,...sinapi],conf);
    return out({simulacao:publicQuote(quote)});
   } catch(e) {
    if(String(e?.message).startsWith('PRECIFICACAO_PENDENTE:'))
      return out({avaliacao_necessaria:true,mensagem:'Este serviço precisa de avaliação personalizada. Você pode enviar seu pedido normalmente.'});
    throw e;
   }
  }

  if(req.method==='POST'&&api==='bootstrap'){
   const b=await body(req);await rate(req,'start',8);
   const t=sample(b.token),email=sample(b.email).trim().toLowerCase(),password=sample(b.password);
   if(t.length<32||!/^.+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>180||password.length<12||password.length>100||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password))return err('Informe e-mail válido e senha de 12+ caracteres, com maiúsculas, minúsculas e número',400);
   const h=await hash(t);
   const {data:invite,error:ie}=await db.from('admin_bootstrap').select('token_hash,expires_at,used_at').eq('id',1).maybeSingle();
   if(ie||!invite||invite.used_at||Date.parse(invite.expires_at)<Date.now()||invite.token_hash!==h)return err('Link de ativação inválido, usado ou expirado',403);
   const {count,error:ce}=await db.from('admin_users').select('user_id',{head:true,count:'exact'});
   if(ce||count!==0)return err('O painel já tem administrador ou não foi possível conferir o acesso',403);
   const {data:claimed,error:cl}=await db.from('admin_bootstrap').update({used_at:new Date().toISOString()}).eq('id',1).eq('token_hash',h).is('used_at',null).gt('expires_at',new Date().toISOString()).select('id').maybeSingle();
   if(cl||!claimed)return err('Este convite não está mais disponível',403);
   const {data:newUser,error:ue}=await db.auth.admin.createUser({email,password,email_confirm:true});
   if(ue||!newUser?.user?.id)throw new Error('Não foi possível criar o usuário administrador');
   const {error:ae}=await db.from('admin_users').insert({user_id:newUser.user.id});
   if(ae)throw new Error('Não foi possível conceder acesso ao painel');
   return out({ok:true});
  }
  if(req.method==='POST'&&api==='start'){
   const b=await body(req);if(b.website)throw new Error('Pedido inválido');
   await rate(req,'start',8);
   const bytes=crypto.getRandomValues(new Uint8Array(32));const secret=Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('');
   const {data,error}=await db.from('quote_requests').insert({access_hash:await hash(secret)}).select('id').single();
   if(error)throw error;
   return out({id:data.id,secret});
  }
  if(req.method==='POST'&&api==='sign'){
   const b=await body(req);await rate(req,'sign',35);
   if(!await draft(b))return err('Pedido não autorizado',403);
   const size=num(b.size,1,45*1024*1024),mime=sample(b.mime),name=sample(b.name).trim();
   if(!MIME.has(mime)||name.length<1||name.length>150||/[\u0000-\u001f\u007f<>]/.test(name))throw new Error('Arquivo inválido ou não suportado');
   const {data:existing,error:e}=await db.from('quote_media').select('size').eq('request_id',b.id);
   if(e)throw e;
   if(existing.length>=6||existing.reduce((s,x)=>s+Number(x.size),0)+size>120*1024*1024)throw new Error('Limite: 6 arquivos e 120 MB por pedido');
   const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','audio/webm':'webm','audio/mp4':'m4a','audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav','audio/x-m4a':'m4a'})[mime];
   const path=b.id+'/'+crypto.randomUUID()+'.'+ext;
   const {data:r,error:re}=await db.from('quote_media').insert({request_id:b.id,path,original_name:name,mime_type:mime,size}).select('id').single();
   if(re)throw re;
   const {data:upload,error:ue}=await db.storage.from('civolten-media').createSignedUploadUrl(path);
   if(ue){await db.from('quote_media').delete().eq('id',r.id);throw ue}
   return out({path,token:upload.token});
  }
  if(req.method==='POST'&&api==='submit'){
   const b=await body(req);await rate(req,'submit',8);
   if(b.consent!==true||b.privacy_version!=='2026-10')
    throw new Error('Confirme a autorização de tratamento de dados para solicitar orçamento');
   if(!await draft(b))return err('Pedido já enviado ou inválido',403);
   const name=sample(b.name).trim(),desc=sample(b.description).trim();
   const digits=sample(b.phone).replace(/\D/g,'');
   const phone=digits.length===11?'+55'+digits:digits.length===13?'+'.concat(digits):'';
   if(!name)throw new Error('Falta preencher o nome.');
   if(name.length<2||name.length>100)throw new Error('O nome deve ter entre 2 e 100 caracteres.');
   if(!sample(b.phone).trim())throw new Error('Falta preencher o WhatsApp.');
   if(!/^\+55[1-9]\d9\d{8}$/.test(phone)||!BRAZIL_DDDS.has(phone.slice(3,5)))
    throw new Error('WhatsApp inválido: informe DDD e celular de 9 dígitos.');
   if(!desc)throw new Error('Falta preencher a descrição do serviço.');
   if(desc.length<12||desc.length>4000)
    throw new Error('A descrição do serviço precisa ter entre 12 e 4000 caracteres.');
   if(!['eletrica','manutencao','iluminacao','reforma','construcao','pintura','hidraulica','outros'].includes(b.category))throw new Error('Serviço inválido');
   if(!['normal','breve','urgente'].includes(b.urgency))throw new Error('Urgência inválida');
   const {data:media,error:me}=await db.from('quote_media').select('path').eq('request_id',b.id);if(me)throw me;
   if(media.length){
    const {data:stored,error:se}=await db.storage.from('civolten-media').list(b.id,{limit:100});if(se)throw se;
    const s=new Set((stored||[]).map(o=>o.name));
    if(media.some(m=>!s.has(m.path.split('/').at(-1))))throw new Error('Um anexo ainda não terminou de enviar');
   }
   let preview=null,conf=null;
   if(Array.isArray(b.itens)&&b.itens.length){
    const p=await getPricing();conf=p.conf;
    const references=await referencePricingServices(db,b.itens,conf);
    try {
     preview=calc(b.itens,b.padrao,b.dias,b.km,[...p.catalog,...references],conf);
     const {error:pe}=await db.from('quote_pricing_snapshots').upsert({
      request_id:b.id,padrao:preview.padrao,dias_estimados_obra:preview.dias_estimados_obra,distancia_km:preview.distancia_km,
      itens:preview.itens,parametros:conf,calculo:preview,total_bruto:preview.total_bruto
     },{onConflict:'request_id'});if(pe)throw pe;
    } catch(e) {
     if(!String(e?.message).startsWith('PRECIFICACAO_PENDENTE:'))throw e;
     const ids=new Map([...p.catalog,...references].map(x=>[x.service_id,x]));
     for(const item of b.itens){
      const svc=ids.get(item.servico_id);if(!svc)throw new Error('Serviço inválido');
      const modalidade=selectedMode(item);
      if(modalidade==='mao_obra'&&!isPublicReferenceId(item.servico_id))throw new Error('Modalidade não disponível.');
      const q=num(item.quantidade,0.001,100000);
      if(svc.unit==='unidade'&&!Number.isInteger(q))throw new Error('Quantidade inválida');
     }
    }
   }
   const {data:saved,error:qe}=await db.from('quote_requests').update({
    customer_name:name,phone,description:desc,category:b.category,urgency:b.urgency,
    neighborhood:sample(b.neighborhood).slice(0,100),city:sample(b.city).slice(0,100)||'São Paulo',
    request_details:{
     itens:Array.isArray(b.itens)?b.itens.slice(0,60):[],
     padrao:sample(b.padrao).slice(0,10),dias:b.dias,distancia_km:b.km
    },lgpd_consent_at:new Date().toISOString(),privacy_notice_version:'2026-10',
    retention_until:new Date(Date.now()+90*24*3600*1000).toISOString(),
    status:'novo',submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()
   }).eq('id',b.id).is('submitted_at',null).select('id').maybeSingle();
   if(qe)throw qe;if(!saved)return err('Pedido já enviado',409);
   return out({ok:true,protocolo:saved.id.slice(0,8).toUpperCase(),simulacao:preview?.total_bruto??null});
  }
  if(api==='client-view'||api==='client-decision')
   return await handleClientExtra({req,api,db,out,err,body,hash,rate});
  if(api?.startsWith('admin-')){
   if(!await admin(req))return err('Acesso restrito ao administrador',401);
   if(['admin-reference-search','admin-reference-detail','admin-reference-stats','admin-reference-import'].includes(api))
    return await handleReference({api,req,url,db,out,err,body});
   if(['admin-sinapi-import','admin-sinapi-search','admin-sinapi-compare'].includes(api))
    return await sinapiAdmin({api,req,url,db,out,err,body});
   if(['admin-commercial','admin-save-commercial','admin-share-commercial','admin-commercial-history','admin-branding'].includes(api))
    return await handleAdminExtra({req,api,db,out,err,body,hash});
   if(req.method==='GET'&&api==='admin-export'){
    // Exportação explícita somente para admin autenticado; sem tokens de acesso nem custo interno.
    const [q,c,h]=await Promise.all([
     db.from('quote_requests').select('id,customer_name,phone,city,neighborhood,description,status,request_details,submitted_at,updated_at').not('submitted_at','is',null).order('created_at',{ascending:false}).limit(1000),
     db.from('commercial_quotes').select('request_id,revision,items,terms,total,decision,decision_at,updated_at').limit(1000),
     db.from('commercial_quote_history').select('request_id,revision,action,created_at').order('id',{ascending:false}).limit(1000)
    ]);
    if(q.error||c.error||h.error)throw new Error('Exportação temporariamente indisponível.');
    return out({exported_at:new Date().toISOString(),notice:'Backup contém dados pessoais. Armazene em local seguro e não compartilhe publicamente.',
     partial:q.data.length===1000||c.data.length===1000||h.data.length===1000,
     pedidos:q.data,propostas:c.data,historico:h.data});
   }
   if(req.method==='GET'&&api==='admin-me')return out({authenticated:true,role:'admin'});
   if(req.method==='GET'&&api==='admin-pricing'){
    const {data,error}=await db.from('pricing_catalog').select('service_id,description,category,unit,baixo,medio,alto,enabled').order('category').order('description');
    if(error)throw error;
    return out({catalogo:data});
   }
   if(req.method==='POST'&&api==='admin-pricing'){
    const b=await body(req);
    if(typeof b.id!=='string'||!/^[a-z_]{3,80}$/.test(b.id))throw new Error('Serviço inválido');
    const pending=b.pendentes;
    if(!Array.isArray(pending)||pending.some(k=>!['baixo','medio','alto'].includes(k))||new Set(pending).size!==pending.length)
     throw new Error('Informe os padrões pendentes explicitamente');
    const prices={};
    for(const k of ['baixo','medio','alto']){
     const n=b[k];
     if(typeof n!=='number'||!Number.isFinite(n))throw new Error('Preço inválido ou não informado');
     if(pending.includes(k)){if(n!==0)throw new Error('Preço pendente deve ser zero');prices[k]=0;continue}
     if(n<1||n>100000||Math.round(n*100)/100!==n)throw new Error('Preço deve ficar entre R$ 1 e R$ 100.000 com 2 decimais');
     prices[k]=n;
    }
    if((prices.baixo>0&&prices.medio>0&&prices.baixo>prices.medio)||
       (prices.medio>0&&prices.alto>0&&prices.medio>prices.alto)||
       (prices.baixo>0&&prices.alto>0&&prices.baixo>prices.alto))
      throw new Error('Os padrões devem ter preço crescente: baixo ≤ médio ≤ alto');
    const {data,error}=await db.from('pricing_catalog').update({...prices,updated_at:new Date().toISOString()}).eq('service_id',b.id).select('service_id').maybeSingle();
    if(error)throw error;if(!data)return err('Serviço não encontrado',404);
    return out({ok:true});
   }
   if(req.method==='GET'&&api==='admin-quote'){
    const id=url.searchParams.get('id');
    if(!uuidValid(id))return err('Pedido inválido',400);
    const {data:pedido,error:pe}=await db.from('quote_requests')
      .select('id,customer_name,phone,city,neighborhood,category,description,urgency,status,estimate_min,estimate_max,request_details,created_at,submitted_at,updated_at')
      .eq('id',id).not('submitted_at','is',null).maybeSingle();
    if(pe)throw pe;
    if(!pedido)return err('Pedido não encontrado',404);
    const {data:simulacao,error:se}=await db.from('quote_pricing_snapshots')
      .select('padrao,total_bruto,itens').eq('request_id',id).maybeSingle();
    if(se)throw se;
    const {data:catalogo,error:ce}=await db.from('pricing_catalog')
      .select('service_id,description,unit');
    if(ce)throw ce;
    const {data:commercial,error:co}=await db.from('commercial_quotes').select('items,terms,total,revision,decision,decision_at').eq('request_id',id).maybeSingle();
    if(co)throw co;
    const {data:branding,error:be}=await db.from('civolten_branding').select('company_name,logo_data_url,logo_width_px,color_primary,color_accent').eq('id',1).maybeSingle();
    if(be)throw be;
    return out({pedido,simulacao:simulacao??null,servicos:catalogo,commercial:commercial??null,branding:branding??null});
   }
   if(req.method==='GET'&&api==='admin-list'){
    const {data:requests,error:re}=await db.from('quote_requests').select('*').not('submitted_at','is',null).order('submitted_at',{ascending:false}).limit(100);
    if(re)throw re;const ids=requests.map(r=>r.id);
    const [a,b]=await Promise.all([
     ids.length?db.from('quote_media').select('request_id,path,original_name').in('request_id',ids):Promise.resolve({data:[],error:null}),
     ids.length?db.from('quote_pricing_snapshots').select('request_id,padrao,calculo,total_bruto').in('request_id',ids):Promise.resolve({data:[],error:null})
    ]);
    if(a.error||b.error)throw new Error('Falha ao listar anexos');
    const {data:commercial,error:ce}=ids.length?
      await db.from('commercial_quotes').select('request_id,total,revision,decision,updated_at').in('request_id',ids):
      {data:[],error:null};
    if(ce)throw ce;
    return out({pedidos:requests.map(r=>({...r,media:a.data.filter(x=>x.request_id===r.id),simulacao:b.data.find(x=>x.request_id===r.id)||null,commercial:commercial.find(x=>x.request_id===r.id)||null}))});
   }
   if(req.method==='POST'&&api==='admin-status'){
    const b=await body(req);
    if(!uuidValid(b.id)||!ALL.includes(b.status))throw new Error('Pedido ou status inválido');
    const val=x=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e8);
    if(!val(b.min)||!val(b.max)||((b.min===null)!==(b.max===null))||
       (b.min!==null&&(b.min>b.max||b.max>100000000||Math.round(b.min*100)/100!==b.min||Math.round(b.max*100)/100!==b.max)))
      throw new Error('Informe mínimo e máximo juntos, com 2 decimais e mínimo ≤ máximo');
    if(sample(b.notes).length>4000)throw new Error('Anotação longa demais');
    const {data:changed,error}=await db.from('quote_requests').update({status:b.status,estimate_min:b.min,estimate_max:b.max,admin_notes:sample(b.notes),updated_at:new Date().toISOString()}).eq('id',b.id).not('submitted_at','is',null).select('id').maybeSingle();
    if(error)throw error;
    if(!changed)return err('Pedido não encontrado',404);
    return out({ok:true});
   }
   if(req.method==='GET'&&api==='admin-media'){
    const id=url.searchParams.get('id'),path=url.searchParams.get('path');
    if(!uuidValid(id)||!sample(path).startsWith(id+'/'))throw new Error('Anexo inválido');
    const {data:found}=await db.from('quote_media').select('id').eq('request_id',id).eq('path',path).maybeSingle();
    if(!found)return err('Anexo não encontrado',404);
    const {data:signed,error:se}=await db.storage.from('civolten-media').createSignedUrl(path,300,{download:true});
    if(se)throw se;return out({url:signed.signedUrl});
   }
  }
  return err('Rota não encontrada',404);
 }catch(e){console.error('CIVOLTEN edge error:',String(e?.message||e).slice(0,200));return err((e?.message&&['Número inválido','Dados inválidos','Dados muito grandes'].includes(e.message))?e.message:(e?.message?.includes('inválid')||e?.message?.includes('Limite')||e?.message?.includes('Informe')||e?.message?.includes('Um anexo')||e?.message?.includes('Preencha')||e?.message?.includes('arquivos')||e?.message?.includes('padrão')||e?.message?.includes('Dias')||e?.message?.includes('preços')||e?.message?.includes('Preço')||e?.message?.includes('serviço')||[400,409].includes(e?.status)?e.message:'Não foi possível concluir. Tente novamente.'),400)}
});
