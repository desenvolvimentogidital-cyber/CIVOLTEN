#!/usr/bin/env node
/* Read-only Stage 5 schema check; safe on all Neon branches. Secrets never printed.
   Usage: DATABASE_URL=... npm run preflight:stage5
   This is NOT deployment, migration, or commercial approval. */
import {neon} from '@neondatabase/serverless';
import {validateSchema,evaluateReleaseGates} from '../src/stage5-release-gates.mjs';
async function main(){
 if(!process.env.DATABASE_URL){
  console.error('DATABASE_URL não configurada; execute em terminal privado com secret de ambiente.');
  process.exitCode=2;return;
 }
 const sql=neon(process.env.DATABASE_URL,{fullResults:false});
 const tables=await sql`SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE'`;
 const columns=await sql`SELECT table_name,column_name FROM information_schema.columns
   WHERE table_schema='public'`;
 const result=validateSchema({tables,columns});
 const gates=evaluateReleaseGates({schema_ready:result.ready?
  {passed:true,reference:'metadados consultados em SQL'}:null});
 const report={
  purpose:'stage5-db-schema-readonly',
  schema_ready:result.ready,
  missing_tables:result.missing_tables,
  missing_columns:result.missing_columns,
  commercial_release:gates.commercial_release,
  other_gates_unverified:gates.failed.map(x=>x.key)
 };
 console.log(JSON.stringify(report,null,2));
 if(!result.ready)process.exitCode=1;
}
main().catch(err=>{
 console.error('Falha de conferência do esquema: '+String(err?.code||'query-failed')+
  '. Não serão exibidos credenciais, URL ou dados de clientes.');
 process.exitCode=1;
});
