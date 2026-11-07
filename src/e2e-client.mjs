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
    return {eq:(_key,owner)=>({order:async()=>{
     if(!user||owner!==user.id)return {data:[],error:null};
     return {data:(read()[table]||[]).filter(r=>r.user_id===user.id),error:null};
    }})};
   },
   upsert(row){
    return {select:()=>({single:async()=>{
     if(!user||row.user_id!==user.id)return {data:null,error:{message:'RLS: usuário não autorizado'}};
     const db=read(),all=db[table]||[],i=all.findIndex(x=>x.id===row.id);
     if(i>=0)all[i]=row;else all.push(row);
     db[table]=all;save(db);
     return {data:{id:row.id},error:null};
    }})};
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
 return {auth,from};
}
