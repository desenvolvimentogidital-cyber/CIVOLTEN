// Clientes pessoa física: cadastro separado de NFS-e, protegido por auth.uid() via RLS.
export const INDIVIDUAL_CLIENTS_TABLE='cv_individual_clients_v1';
export const digits=v=>String(v??'').replace(/\D/g,'');
export function validCpf(input){
 const cpf=digits(input);
 if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
 for(let size=9;size<=10;size++){
  const sum=Array.from(cpf.slice(0,size)).reduce((n,c,i)=>n+Number(c)*(size+1-i),0);
  const check=(sum*10)%11;
  if(Number(cpf[size])!==(check===10?0:check))return false;
 }
 return true;
}
export async function loadIndividualClients(client,userId){
 const {data,error}=await client.from(INDIVIDUAL_CLIENTS_TABLE).select('*').eq('user_id',userId).order('updated_at',{ascending:false}).range(0,499);
 if(error)throw Error('Falha ao carregar clientes CPF: '+error.message);
 return (data||[]).map(x=>({id:x.id,cpf:x.cpf,legal_name:x.legal_name,email:x.email||'',kind:'cpf'}));
}
export async function saveIndividualClient(client,userId,fields){
 if(!validCpf(fields.cpf))throw Error('CPF inválido. Confira os dígitos verificadores.');
 const name=String(fields.legal_name||'').trim();
 if(name.length<2||name.length>180)throw Error('Informe o nome completo.');
 const email=String(fields.email||'').trim().slice(0,160);
 const id=/^[a-f0-9-]{36}$/i.test(fields.id||'')?fields.id:crypto.randomUUID();
 const {data,error}=await client.from(INDIVIDUAL_CLIENTS_TABLE).upsert({id,user_id:userId,cpf:digits(fields.cpf),legal_name:name,email,updated_at:new Date().toISOString()}).select('id');
 if(error)throw Error('Não foi possível salvar o cliente CPF: '+error.message);
 if(data?.length!==1)throw Error('O banco não confirmou o cadastro CPF.');
 return id;
}
export async function deleteIndividualClient(client,userId,id){
 if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('Identificador inválido.');
 const {data,error}=await client.from(INDIVIDUAL_CLIENTS_TABLE).delete().eq('id',id).eq('user_id',userId).select('id');
 if(error)throw Error('Falha ao excluir cliente CPF: '+error.message);
 if(data?.length!==1)throw Error('O banco não confirmou a exclusão.');
 return true;
}
