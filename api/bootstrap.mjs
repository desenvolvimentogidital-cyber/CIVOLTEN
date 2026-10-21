import {SUPABASE,KEY,json,browserAllowed,cookieToken,authorized} from '../lib/civolten-security.mjs';
import {listRows} from '../lib/civolten-pages.mjs';

// Um unico endpoint de inicializacao evita repetir cinco verificacoes de acesso
// e cinco inicializacoes de funcoes serverless ao abrir o painel privado.
// As consultas continuam autenticadas com o JWT do usuario (RLS do Supabase).
const tables={
 settings:'cv_settings',
 workers:'cv_workers',
 fixed:'cv_fixed_costs',
 variable:'cv_variable_costs',
 budgets:'cv_budgets'
};

export default {async fetch(req){
 if(req.method!=='GET')return json({error:'Método não permitido'},405);
 if(!browserAllowed(req))return json({error:'Origem bloqueada'},403);

 const jwt=cookieToken(req);
 if(!await authorized(jwt))return json({error:'Sua sessão expirou. Entre novamente.'},401);

 try{
  const data=Object.fromEntries(await Promise.all(Object.entries(tables).map(async ([key,table])=>{
   const url=new URL(SUPABASE+'/rest/v1/'+table);
   url.searchParams.set('select','*');
   if(key!=='settings')url.searchParams.set('order','created_at.desc,id.desc');
   return [key,await listRows(url,{apikey:KEY,Authorization:'Bearer '+jwt,Accept:'application/json'})];
  })));
  return json({data});
 }catch{
  return json({error:'Não foi possível carregar os dados. Tente novamente.'},502);
 }
}};
