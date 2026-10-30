/* CIVOLTEN Etapa 5 — fail-closed preview writes on wrong Neon branch.
 * A marca deve ser semeada EXCLUSIVAMENTE no banco QA, jamais na produção.
 * Esse controle é defesa complementar à variável DATABASE_URL isolada.
 */
export async function authorizePreviewMutation(sql,{environment,previewBranchId}={}){
 const runtime=environment??process.env.VERCEL_ENV;
 if(runtime!=='preview')return {permitted:true,mode:'non-preview'};
 const id=previewBranchId??process.env.CIVOLTEN_QA_DB_BRANCH_ID;
 if(typeof id!=='string'||!/^br-[a-z0-9-]{8,80}$/.test(id))
  return {permitted:false,reason:'preview_branch_not_configured'};
 try{
  const rows=await sql.query(
   "SELECT branch_id FROM deployment_environment_guards WHERE environment=$1 LIMIT 1",['preview']);
  if(rows.length!==1||rows[0].branch_id!==id)
   return {permitted:false,reason:'preview_branch_mismatch'};
 }catch{
  return {permitted:false,reason:'preview_guard_missing'};
 }
 return {permitted:true,mode:'isolated-preview',branch_id:id};
}
