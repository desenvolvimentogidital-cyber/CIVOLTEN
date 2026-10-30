/* CIVOLTEN Etapa 5 — diagnóstico autenticado e somente leitura.
 * Não vaza credenciais, clientes, valores de produção ou identidade pessoal.
 * Somente admin. O retorno NUNCA é assinatura de aprovação comercial.
 */
import {validateSchema,evaluateReleaseGates} from './stage5-release-gates.mjs';
export async function handleStage5Readiness({req,res,user,sql,parts,method,send}){
 if(parts[0]!=='release-readiness')return false;
 const done=(status,data)=>{send(res,status,data);return true};
 if(method!=='GET'||parts.length!==1)return done(405,{error:'Diagnóstico disponível somente por GET'});
 if(user.role!=='administrador')return done(403,{error:'Somente administrador consulta estado de homologação'});
 const [tables,columns]=await Promise.all([
  sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",[]),
  sql.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",[])
 ]);
 const schema=validateSchema({tables,columns});
 const evidence=schema.ready?{schema_ready:{passed:true,reference:'consulta interna information_schema'}}:{};
 const gates=evaluateReleaseGates(evidence);
 return done(200,{schema,
  gates,
  application_mode:'homologacao',
  source:'read-only metadata',
  commercial_release:false,
  note:'Banco com esquema correto não equivale a CI, backup, navegador, custo SIURB, tributação, contrato e aceite homologados.'});
}
