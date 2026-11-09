// Simulação exclusiva para testes automatizados locais (não ativar em produção).
export function createE2EClient(){
 let user=null;
 const KEY='cv_e2e_supabase_v1';
 function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
 function save(data){localStorage.setItem(KEY,JSON.stringify(data))}
 const auth={
  getUser:async()=>({data:{user},error:null}),
  getSession:async()=>({data:{session:user?{user}:null},error:null}),
  signUp:async({email,password,options})=>{
   const key='cv_e2e_registered_emails';
   const registered=JSON.parse(localStorage.getItem(key)||'{}');
   if(registered[email]){
    // Supabase, com Confirm Email desligado, retorna erro de conta existente.
    return {data:{user:null,session:null},
     error:{code:'user_already_exists',message:'User already registered'}};
   }
   registered[email]={password,name:options?.data?.name||'Teste CIVOLTEN'};
   localStorage.setItem(key,JSON.stringify(registered));
   user={id:'00000000-0000-4000-8000-000000000001',
    email,identities:[{provider:'email'}],
    user_metadata:{name:registered[email].name}};
   // Com Confirm Email desativado, cadastro conclui com sessão autenticada.
   return {data:{user,session:{user}},error:null};
  },
  signInWithPassword:async({email,password})=>{
   const registered=JSON.parse(localStorage.getItem('cv_e2e_registered_emails')||'{}');
   if(registered[email]&&registered[email].password!==password){
    return {data:{user:null,session:null},
     error:{code:'invalid_credentials',message:'Invalid login credentials'}};
   }
   user={id:'00000000-0000-4000-8000-000000000001',
    email,user_metadata:{name:registered[email]?.name||'Teste CIVOLTEN'},
    name:registered[email]?.name||'Teste CIVOLTEN'};
   return {data:{user,session:{user}},error:null};
  },
  resetPasswordForEmail:async()=>({data:{},error:null}),
  updateUser:async()=>({data:{user},error:null}),
  signOut:async()=>{user=null;return {error:null}},
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 };
 function from(table){
  return {
   select(){
    return {eq:(_key,owner)=>{
     const query={
      from:0,to:Number.MAX_SAFE_INTEGER,
      order(){return query},
      range(from,to){query.from=from;query.to=to;return query},
      then(resolve,reject){return query.run().then(resolve,reject)},
      async run(){
       if(!user||owner!==user.id)return {data:[],error:null};
       const rows=(read()[table]||[]).filter(r=>r.user_id===user.id);
       return {data:rows.slice(query.from,query.to+1),error:null};
      }
     };
     // order() sem range tambem precisa ser awaitable.
     query.order=()=>query;
     return query;
    }};
   },
   upsert(value){
    const rows=Array.isArray(value)?value:[value];
    const apply=async()=>{
     if(!user||rows.some(row=>row.user_id!==user.id))
      return {data:null,error:{message:'RLS: usuário não autorizado'}};
     const db=read(),all=db[table]||[];
     for(const row of rows){
      const i=all.findIndex(x=>x.id===row.id);
      if(i>=0)all[i]=row;else all.push(row);
     }
     db[table]=all;save(db);
     const data=rows.map(row=>({id:row.id,user_id:row.user_id}));
     return {data:Array.isArray(value)?data:data[0],error:null};
    };
    return {select:()=>({
     single:apply,
     then:(resolve,reject)=>apply().then(resolve,reject)
    })};
   },
   delete(){
    const where={};
    const query={eq:(key,val)=>{where[key]=val;return query},
     select:async()=>{
      if(!user||where.user_id!==user.id)return {data:[],error:null};
      const db=read(),all=db[table]||[],removed=all.filter(x=>x.id===where.id&&x.user_id===user.id);
      db[table]=all.filter(x=>!removed.includes(x));save(db);
      return {data:removed.map(x=>({id:x.id})),error:null};
     }};
    return query;
   }
  };
 }
 const rpc=async(name,args)=>{
  if(name==='cv_proposal_lookup_v1'){
   const invite=(read().cv_proposal_invites_v1||[]).find(x=>x.token===args.p_token);
   if(!invite||invite.status==='revoked')return {data:{available:false},error:null};
   const b=invite.budget_snapshot;
   const today=new Date().toISOString().slice(0,10);
   return {error:null,data:{available:true,
    status:invite.status==='pending'&&today>invite.valid_until?'expired':invite.status,
    reference:'PC-'+invite.budget_id.slice(0,8),title:b.title,customer:b.customer,
    project:b.project,location:b.location,totalCents:invite.total_cents,
    validUntil:invite.valid_until,companyName:b.pricing?.companyName||'CIVOLTEN',
    paymentTerms:b.commercial?.paymentTerms,executionTerm:b.commercial?.executionTerm,
    warrantyTerms:b.commercial?.warrantyTerms,scopeNotes:b.commercial?.scopeNotes,
    laborOnly:true,services:(b.items||[]).map(x=>({description:x.description,unit:x.unit,quantity:x.quantity})),
    respondedAt:invite.responded_at||null}};
  }
  if(name==='cv_proposal_respond_v1'){
   const db=read(),invite=(db.cv_proposal_invites_v1||[]).find(x=>x.token===args.p_token);
   if(!invite||invite.status!=='pending')
    return {data:null,error:{message:'Link indisponível ou já respondido'}};
   if(new Date().toISOString().slice(0,10)>invite.valid_until)
    return {data:null,error:{message:'Prazo expirado'}};
   if(!['accepted','declined'].includes(args.p_decision)||args.p_confirmed!==true||
    String(args.p_name||'').trim().length<3||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args.p_email||'')))
    return {data:null,error:{message:'Informe a decisão, nome, e-mail e confirmação'}};
   invite.status=args.p_decision;invite.respondent_name=String(args.p_name).trim();
   invite.respondent_email=String(args.p_email).trim().toLowerCase();
   invite.decline_reason=args.p_decision==='declined'?String(args.p_reason||''):'';
   invite.responded_at=new Date().toISOString();
   save(db);
   return {data:{ok:true,status:invite.status},error:null};
  }
  if(name==='cv_proposal_revoke_v1'){
   const db=read(),invite=(db.cv_proposal_invites_v1||[]).find(x=>
    x.budget_id===args.p_budget_id&&x.user_id===user?.id&&x.status==='pending');
   if(!invite)return {data:null,error:{message:'Convite não encontrado ou já respondido'}};
   invite.status='revoked';save(db);return {data:true,error:null};
  }
  if(name!=='cv_bill_measurement_v1')
   return {data:null,error:{message:'Função não disponível no simulador'}};
  const db=read(),m=(db.cv_measurements_v1||[]).find(x=>x.id===args.p_measurement_id&&x.user_id===user?.id);
  if(!m||m.status!=='approved')return {data:null,error:{message:'Medição não aprovada'}};
  const w=(db.cv_work_orders_v1||[]).find(x=>x.id===m.work_order_id&&x.user_id===user?.id);
  if(!w)return {data:null,error:{message:'Obra não encontrada'}};
  const ref='MED:'+m.id,existing=(db.cv_financial_entries_v1||[]).find(x=>x.reference===ref&&x.user_id===user.id);
  if(existing)return {data:existing.id,error:null};
  const id=crypto.randomUUID();
  db.cv_financial_entries_v1=db.cv_financial_entries_v1||[];
  db.cv_financial_entries_v1.push({id,user_id:user.id,kind:'income',
   title:'Medicao da obra '+w.contract_ref,party:w.customer,project:w.project,
   category:'Mao de obra',amount:m.amount,due_date:args.p_due_date,
   paid_date:null,reference:ref,notes:'Recebivel gerencial vinculado a medicao aprovada.',
   created_at:new Date().toISOString()});
  save(db);
  return {data:id,error:null};
 };
 return {auth,from,rpc};
}
