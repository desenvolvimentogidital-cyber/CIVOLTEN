import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {authorizePreviewMutation} from '../src/stage5-preview-guard.mjs';
import {createApi} from '../api/index.mjs';
const branch='br-crimson-fog-b6pyoiov';
const sqlResult=id=>({query:async()=>[{branch_id:id}]});
test('Etapa 5: preview nunca grava quando falta variável de ambiente',async()=>{
 const r=await authorizePreviewMutation(sqlResult(branch),{environment:'preview'});
 assert.equal(r.permitted,false);
 assert.equal(r.reason,'preview_branch_not_configured');
});
test('Etapa 5: preview não grava quando banco conectado tem marcador de outra branch',async()=>{
 const r=await authorizePreviewMutation(sqlResult('br-wrong-preview-database'),{
  environment:'preview',previewBranchId:branch});
 assert.equal(r.permitted,false);
 assert.equal(r.reason,'preview_branch_mismatch');
});
test('Etapa 5: preview não grava se marcador/tabela não existir ou se SQL falhar',async()=>{
 const r=await authorizePreviewMutation({query:async()=>{throw Error('no table')}},{
  environment:'preview',previewBranchId:branch});
 assert.equal(r.permitted,false);
 assert.equal(r.reason,'preview_guard_missing');
});
test('Etapa 5: preview permite escrita somente se marcador da QA coincide',async()=>{
 const r=await authorizePreviewMutation(sqlResult(branch),{
  environment:'preview',previewBranchId:branch});
 assert.equal(r.permitted,true);assert.equal(r.mode,'isolated-preview');
});
test('Etapa 5: restrição de preview não interfere em operações no ambiente local',async()=>{
 const r=await authorizePreviewMutation({query:async()=>{throw Error('never called')}},{
  environment:'development'});
 assert.equal(r.permitted,true);
});
const request=async(api,method,path)=>{
 const req=Readable.from([]);req.url='/api/v1/'+path;req.method=method;
 req.headers={host:'localhost:3000','x-civolten-request':'1'};
 const res={statusCode:200,setHeader(){},end(data){this.body=JSON.parse(data)}};
 await api(req,res);
 return {status:res.statusCode,body:res.body};
};
test('Etapa 5: API de homologação retorna 503 em POST quando preview não foi isolada',async()=>{
 const api=createApi({query:async()=>{throw Error('should never run SQL')}},{
  environment:'preview'});
 const result=await request(api,'POST','auth/logout');
 assert.equal(result.status,503);
 assert.equal(result.body.commercial_release,false);
});
test('Etapa 5: API permite POST autorizado na preview isolada',async()=>{
 const api=createApi(sqlResult(branch),{environment:'preview',previewBranchId:branch});
 const result=await request(api,'POST','auth/logout');
 assert.equal(result.status,200);assert.equal(result.body.ok,true);
});
test('Etapa 5: GET não depende de variável de escrita',async()=>{
 const api=createApi({query:async()=>[{connected:1}]},{environment:'preview'});
 const result=await request(api,'GET','health');
 assert.equal(result.status,200);assert.equal(result.body.ok,true);
});
