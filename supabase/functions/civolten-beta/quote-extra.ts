// Rotas comerciais CIVOLTEN — não confiam em preços nem em autenticação vindos do navegador.
const required=(condition,msg)=>{if(!condition)throw Object.assign(new Error(msg),{status:400})};
const invalid=(msg,status=409)=>Object.assign(new Error(msg),{status});
const text=(v,max=800)=>typeof v==='string'?v.trim().slice(0,max):'';
const cents=n=>Math.round(n*100);
function validateItems(raw){
 required(Array.isArray(raw)&&raw.length>0&&raw.length<=60,'Inclua entre 1 e 60 serviços no orçamento.');
 let total=0;
 const items=raw.map((r,i)=>{
  const description=text(r.description,280),unit=text(r.unit,18)||'serv.';
  const qty=Number(r.quantity),unitPrice=Number(r.unit_price);
  required(description.length>=3,'Falta descrição no serviço '+(i+1)+'.');
  required(unit.length<=18,'Unidade inválida no serviço '+(i+1)+'.');
  required(Number.isFinite(qty)&&qty>0&&qty<=100000&&Math.abs(Math.round(qty*1000)-qty*1000)<1e-7,'Quantidade inválida no serviço '+(i+1)+'.');
  required(Number.isFinite(unitPrice)&&unitPrice>=0&&unitPrice<=100000000&&Math.abs(Math.round(unitPrice*100)-unitPrice*100)<1e-7,'Preço unitário inválido no serviço '+(i+1)+'.');
  const value=Math.round(qty*cents(unitPrice));
  required(Number.isSafeInteger(value),'Valor inválido no serviço '+(i+1)+'.');
  total+=value;
  return {description,unit,quantity:qty,unit_price:unitPrice,line_total:Number((value/100).toFixed(2))};
 });
 required(total>0&&total<=10000000000,'O orçamento precisa ter valor total positivo.');
 return {items,total:Number((total/100).toFixed(2))};
}
function validateTerms(obj){
 const input=obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{};
 const days=Number(input.validity_days||15);
 required(Number.isInteger(days)&&days>=1&&days<=180,'A validade deve ser entre 1 e 180 dias.');
 return {validity_days:days,deadline:text(input.deadline,120),payment:text(input.payment,250),
  included:text(input.included,800),excluded:text(input.excluded,800)};
}
const log=async(db,request_id,revision,action,snapshot,actor=null)=>{
 const {error}=await db.from('commercial_quote_history').insert({request_id,revision,action,snapshot,actor_user_id:actor});
 if(error)throw error;
};
const getActor=async(db,req)=>{
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 const {data}=await db.auth.getUser(token||'');
 return data?.user?.id||null;
};
async function quote(db,id){
 const {data,error}=await db.from('commercial_quotes').select('*').eq('request_id',id).maybeSingle();
 if(error)throw error;return data;
}
const getBranding=async(db)=>{
 const {data,error}=await db.from('civolten_branding').select('*').eq('id',1).maybeSingle();
 if(error)throw error;return data;
};
export async function handleAdminExtra({req,api,db,out,err,body,hash}){
 const b=req.method==='POST'?await body(req,api==='admin-branding'?380000:80000):null;
 const url=new URL(req.url),id=b?.id||url.searchParams.get('id');
 if(api==='admin-branding'&&req.method==='GET')return out({branding:await getBranding(db)});
 if(api==='admin-branding'&&req.method==='POST'){
  required(typeof b.company_name==='string'&&b.company_name.trim().length>=2&&b.company_name.trim().length<=80,'Informe o nome da empresa.');
  const color=/^#[0-9A-Fa-f]{6}$/;
  required(color.test(b.color_primary)&&color.test(b.color_accent),'Escolha cores válidas.');
  const logo=b.logo_data_url??null;
  const width=Number(b.logo_width_px??160);
  required(Number.isInteger(width)&&width>=60&&width<=320,'Largura da logo deve ficar entre 60 e 320 pixels.');
  const headline=text(b.site_headline,125),description=text(b.site_description,260),footer=text(b.footer_note,220);
  const phone=text(b.contact_whatsapp,13).replace(/\D/g,'');
  required(headline.length>=8&&description.length>=15&&footer.length>=5,'Preencha os textos do site corretamente.');
  required(!phone||/^[1-9][0-9]{10,12}$/.test(phone),'WhatsApp comercial inválido. Use código do país, DDD e número.');
  required(logo===null||(typeof logo==='string'&&logo.length<=300000&&/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)),'Logo deve ser uma imagem PNG/JPEG pequena.');
  const {data,error}=await db.from('civolten_branding').update({
   company_name:b.company_name.trim(),color_primary:b.color_primary,color_accent:b.color_accent,logo_data_url:logo,logo_width_px:width,site_headline:headline,site_description:description,footer_note:footer,contact_whatsapp:phone,updated_at:new Date().toISOString()
  }).eq('id',1).select().single();
  if(error)throw error;
  return out({branding:data});
 }
 required(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id),'Pedido inválido.');
 const {data:request,error:re}=await db.from('quote_requests').select('id,customer_name,description,phone,status,submitted_at').eq('id',id).not('submitted_at','is',null).maybeSingle();
 if(re)throw re;
 if(!request)return err('Pedido não encontrado.',404);
 if(api==='admin-commercial'&&req.method==='GET'){
  const commercial=await quote(db,id);
  const {data:sim,error}=await db.from('quote_pricing_snapshots').select('itens,total_bruto').eq('request_id',id).maybeSingle();
  if(error)throw error;
  if(commercial){delete commercial.token_hash;delete commercial.token_expires_at;}
  return out({pedido:request,commercial,simulacao:sim??null,branding:await getBranding(db)});
 }
 if(api==='admin-commercial-history'&&req.method==='GET'){
  const {data,error}=await db.from('commercial_quote_history')
   .select('revision,action,actor_user_id,created_at').eq('request_id',id).order('id',{ascending:false}).limit(40);
  if(error)throw error;return out({history:data});
 }
 if(api==='admin-save-commercial'&&req.method==='POST'){
  required(request.customer_name?.trim()?.length>=2,'Falta o nome do cliente.');
  required(request.description?.trim()?.length>=12,'Falta uma descrição completa no pedido.');
  const {items,total}=validateItems(b.items);
  const terms=validateTerms(b.terms);
  const current=await quote(db,id);
  const expected=Number(b.expected_revision||0);
  required(Number.isInteger(expected)&&expected>=0,'Versão esperada inválida.');
  if(expected!==(current?.revision||0))return err('O orçamento foi alterado. Reabra o editor para não sobrescrever alterações.',409);
  if(current?.decision==='approved'&&b.new_revision!==true)return err('Esta proposta já foi aprovada. Confirme a criação de uma nova revisão para editar.',409);
  const revision=expected+1;
  const record={items,total,terms,revision,decision:'draft',decision_at:null,token_hash:null,token_expires_at:null,sent_at:null,updated_at:new Date().toISOString()};
  if(current){
   const {data,error}=await db.from('commercial_quotes').update(record).eq('request_id',id).eq('revision',expected).select('request_id').maybeSingle();
   if(error)throw error;if(!data)return err('Edição concorrente: atualize o orçamento.',409);
  }else{
   const {error}=await db.from('commercial_quotes').insert({request_id:id,...record});
   if(error)return err('Este orçamento já foi criado; atualize o editor.',409);
  }
  // Preserva preço total único na tabela legada e invalida links antigos ao editar.
  const {error:qe}=await db.from('quote_requests').update({estimate_min:total,estimate_max:total,updated_at:new Date().toISOString()}).eq('id',id);
  if(qe)throw qe;
  await log(db,id,revision,'edited',{items,terms,total},await getActor(db,req));
  return out({ok:true,revision,total});
 }
 if(api==='admin-share-commercial'&&req.method==='POST'){
  const commercial=await quote(db,id);
  if(!commercial)return err('Prepare e salve os serviços antes de compartilhar.',409);
  if(commercial.decision==='approved')return err('Esta proposta já foi aprovada.',409);
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
  const expiration=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const {data,error}=await db.from('commercial_quotes').update({
   token_hash:await hash(token),token_expires_at:expiration,decision:'pending',decision_at:null,
   sent_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq('request_id',id).eq('revision',commercial.revision).select('request_id').maybeSingle();
  if(error||!data)return err('Não foi possível preparar o link. Tente novamente.',409);
  const {error:qe}=await db.from('quote_requests').update({status:'orcamento_enviado',updated_at:new Date().toISOString()}).eq('id',id);
  if(qe)throw qe;
  await log(db,id,commercial.revision,'sent',{total:commercial.total},await getActor(db,req));
  return out({url:'https://civolten.vercel.app/proposta.html#id='+encodeURIComponent(id)+'&token='+token,expires_at:expiration});
 }
 return err('Rota comercial inválida.',404);
}

export async function handleClientExtra({req,api,db,out,err,body,hash,rate}){
 if(req.method!=='POST')return err('Método não permitido.',405);
 await rate(req,api==='client-view'?'client_view':'client_decision',api==='client-view'?40:15);
 const b=await body(req);
 const id=text(b.id,64),token=text(b.token,100);
 if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/.test(token))return err('Link inválido ou incompleto.',403);
 const commercial=await quote(db,id);
 if(!commercial||!commercial.token_hash||commercial.token_hash!==await hash(token)||
    !commercial.token_expires_at||Date.parse(commercial.token_expires_at)<Date.now()||
    !['pending','approved','rejected','changes_requested'].includes(commercial.decision))
  return err('Este link está inválido ou expirou. Solicite uma nova proposta.',403);
 if(api==='client-view'){
  const {data:request,error}=await db.from('quote_requests').select('customer_name,description').eq('id',id).single();
  if(error)throw error;
  return out({proposal:{name:request.customer_name,description:request.description,
   items:commercial.items,terms:commercial.terms,total:commercial.total,revision:commercial.revision,
   decision:commercial.decision,expires_at:commercial.token_expires_at}});
 }
 if(api==='client-decision'){
  const action=b.action;
  if(!['approved','rejected','changes_requested'].includes(action))return err('Escolha aprovar, recusar ou pedir alterações.',400);
  if(commercial.decision!=='pending')return err('Esta proposta já recebeu uma resposta.',409);
  const {data,error}=await db.from('commercial_quotes').update({
   decision:action,decision_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq('request_id',id).eq('revision',commercial.revision).eq('decision','pending').select('request_id').maybeSingle();
  if(error)throw error;if(!data)return err('Esta proposta já foi respondida.',409);
  if(action==='approved'){
   // Concluído fica reservado para execução concluída; aprovação mantém o atendimento rastreável.
   const {error:qe}=await db.from('quote_requests').update({status:'analisando',updated_at:new Date().toISOString()}).eq('id',id);
   if(qe)throw qe;
  }else if(action==='rejected'){
   const {error:qe}=await db.from('quote_requests').update({status:'recusado',updated_at:new Date().toISOString()}).eq('id',id);
   if(qe)throw qe;
  }else{
   const {error:qe}=await db.from('quote_requests').update({status:'analisando',updated_at:new Date().toISOString()}).eq('id',id);
   if(qe)throw qe;
  }
  await log(db,id,commercial.revision,action,{decision:action},null);
  return out({ok:true,decision:action});
 }
 return err('Rota não encontrada.',404);
}
