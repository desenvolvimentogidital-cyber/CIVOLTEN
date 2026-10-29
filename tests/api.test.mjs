import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'civolten-test-'));
const port=33000+Math.floor(Math.random()*1000);
const server=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:data},stdio:'ignore'});
let cookie='';const base=`http://127.0.0.1:${port}`;
async function request(route,method='GET',body){
 const r=await fetch(base+'/api/'+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const setCookie=r.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
 return {code:r.status,data:await r.json()};
}
async function ready(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,65))}throw Error('Servidor não iniciou')}
test('fluxo completo HTTP de ponta a ponta, sem dependências externas',async()=>{
 try{
 await ready();
 let r=await request('auth/status');assert.equal(r.data.setupRequired,true);
 r=await request('auth/setup','POST',{username:'admin',password:'SenhaSeguraDeTeste1234'});assert.equal(r.code,200);
 r=await request('auth/login','POST',{username:'admin',password:'SenhaSeguraDeTeste1234'});assert.equal(r.code,200);assert.ok(cookie);
 let c=await request('clients','POST',{name:'Empresa Teste',doc:'00000000000100'});assert.equal(c.code,201);
 let p=await request('projects','POST',{client_id:c.data.id,name:'Obra Teste'});assert.equal(p.code,201);
 let b=await request('budgets','POST',{client_id:c.data.id,project_id:p.data.id,title:'Orçamento Teste',bdi:25,safety_pct:20,start_date:'2026-11-02'});assert.equal(b.code,201);
 let item=await request(`budgets/${b.data.id}/items`,'POST',{description:'Serviço Teste',qty:100,unit_cost:35.5,hh_unit:0.8,unit:'m²'});assert.equal(item.code,201);
 let details=await request('budgets/'+b.data.id);assert.equal(details.data.summary.cost,3550);assert.equal(details.data.summary.total,4437.5);assert.equal(details.data.summary.laborHours,80);assert.ok(details.data.totalDays>details.data.baseDays);
 item=await request(`budgets/${b.data.id}/items/${item.data.id}`,'PUT',{qty:200});assert.equal(item.data.qty,200);
 let proposal=await request('proposals','POST',{budget_id:b.data.id});
 assert.equal(proposal.code,400);assert.match(proposal.data.error,/auditoria/i);
 // A emissão deve funcionar somente depois da revisão dos dados contratuais.
 let updateProject=await request('projects/'+p.data.id,'PUT',{address:'Rua Exemplo 100, São Paulo/SP'});assert.equal(updateProject.code,200);
 let updateSettings=await request('settings','PUT',{company:'CIVOLTEN',cnpj:'12345678000195',email:'comercial@example.com',phone:'11999999999'});assert.equal(updateSettings.code,200);
 let updateBudget=await request('budgets/'+b.data.id,'PUT',{payment_terms:'30% na entrada e 70% na entrega',validity_days:30,notes:'Escopo validado; exclusões: licenças, reforço estrutural e serviços imprevistos.'});assert.equal(updateBudget.code,200);
 item=await request(`budgets/${b.data.id}/items/${item.data.id}`,'PUT',{code:'CIV-101'});assert.equal(item.code,200);
 proposal=await request('proposals','POST',{budget_id:b.data.id});assert.equal(proposal.code,201);assert.match(proposal.data.code,/PROP-\d{4}-\d{4}/);
 let catalog=await request('catalog/import','POST',{source:'PRÓPRIA',reference_month:'2026-07',regime:'Próprio',entries:[{code:'DEMO-1',description:'Serviço exemplo',cost:20,hh_per_unit:.2}]});assert.equal(catalog.code,200);
 let fake=await request('catalog/import','POST',{source:'SIURB',reference_month:'2026-07',regime:'Sem desoneração',entries:[{code:'DEMO-1',description:'Serviço exemplo',cost:20,hh_per_unit:.2}]});assert.equal(fake.code,400);
 const dash=await request('dashboard');assert.equal(dash.data.counts.clients,1);
 }finally{server.kill();fs.rmSync(data,{recursive:true,force:true});}
});