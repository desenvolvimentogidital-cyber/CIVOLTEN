import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {createProposalToken,proposalResponseUrl,proposalValidUntil,
 proposalResponseLabel} from '../src/proposal-link.mjs';
import {printableBudget} from '../src/budget-print.mjs';
import {priceBudget} from '../src/budget.mjs';
import {workApprovalDialog} from '../src/operations-ui.mjs';
import {fetchInvitesRemote,fetchRemote,putRemote,revokeProposalRemote} from '../src/cloud.mjs';
import {createE2EClient} from '../src/e2e-client.mjs';
const uid='00000000-0000-4000-8000-000000000001';
const snapshot={monthlyCostCents:2115335,productiveHours:352,productiveDays:22,
 hoursPerDay:8,productivePeople:2,taxPct:6,marginPct:30,
 companyName:'CIVOLTEN',capturedOn:'2026-11-09'};
function budget(){
 return {id:randomUUID(),title:'Instalação CIVOLTEN',
 customer:'Cliente da proposta',project:'Obra residencial',location:'São Paulo',
 notes:'Sem materiais',demo:false,
 items:[{id:randomUUID(),source:'manual',description:'Instalação elétrica',unit:'m²',
 quantity:150,laborHours:1.78,directCost:0}],
 pricing:snapshot,commercial:{laborOnly:true,
  paymentTerms:'40% na assinatura e 60% na entrega',executionTerm:'20 dias úteis',
  warrantyTerms:'12 meses',scopeNotes:'Materiais fornecidos pelo cliente',
  schedule:{goal:'crew',crew:2,pricingMode:'hours'}},
 expiresOn:null,createdAt:'2026-11-09T12:00:00.000Z'};
}
test('link é aleatório com 256 bits e não expõe segredo no caminho da URL',()=>{
 const a=createProposalToken(webcrypto),b=createProposalToken(webcrypto);
 assert.match(a,/^[0-9a-f]{64}$/);
 assert.notEqual(a,b);
 assert.equal(proposalResponseUrl(a),'https://civolten.vercel.app/aceite.html#t='+a);
 assert.throws(()=>proposalResponseUrl('invalido'));
 assert.equal(proposalResponseLabel('accepted'),'Proposta aceita pelo cliente');
});
test('prazo de resposta respeita a validade da proposta e não usa vencimento antigo',()=>{
 const now=new Date('2026-11-09T12:00:00');
 assert.equal(proposalValidUntil({expiresOn:'2026-11-15'},now),'2026-11-15');
 assert.equal(proposalValidUntil({},now),'2026-12-09');
 assert.throws(()=>proposalValidUntil({expiresOn:'2026-10-30'},now),/expirou/);
});
test('PDF tem botão clicável só após envio e mantém a última página com valor total',()=>{
 const b=budget(),invite={id:randomUUID(),budgetId:b.id,token:createProposalToken(webcrypto),status:'pending'};
 const pdf=printableBudget(b,invite);
 assert.match(pdf,/RESPONDER À PROPOSTA ONLINE/);
 assert.match(pdf,new RegExp('aceite\\.html#t='+invite.token));
 assert.match(pdf,/target="_blank"/);
 assert.equal((pdf.match(/data-pdf-page=/g)||[]).length,3);
 assert.match(pdf,/25\.070,79/);
 assert.doesNotMatch(printableBudget(b),/RESPONDER À PROPOSTA ONLINE/);
});
test('OS com aceite eletrônico preenche nome, e-mail, ID e data do registro',()=>{
 const b=budget(),invite={id:randomUUID(),status:'accepted',respondentName:'Maria Contratante',
 respondentEmail:'maria@cliente.com',respondedAt:'2026-11-09T13:15:00+00:00'};
 const dialog=workApprovalDialog(b,invite);
 assert.match(dialog,/Aceite eletrônico CIVOLTEN/);
 assert.match(dialog,/maria@cliente.com/);
 assert.match(dialog,/2026-11-09/);
 assert.match(dialog,/readonly/);
});
test('simulador: resposta anônima é salva e proprietária vê imediatamente aceite ou recusa',async()=>{
 const old=globalThis.localStorage,store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 try{
  const owner=createE2EClient();
  await owner.auth.signInWithPassword({email:'empresa@civolten.local',password:'qualquer-senha'});
  const b=budget(),inv={id:randomUUID(),budgetId:b.id,token:createProposalToken(webcrypto),
   budgetSnapshot:b,totalCents:priceBudget(b).totalSale,status:'pending',
   validUntil:proposalValidUntil(b,new Date())};
  await putRemote(owner,uid,'budgets',b);
  await putRemote(owner,uid,'invites',inv);
  const visitor=createE2EClient();
  const lookup=await visitor.rpc('cv_proposal_lookup_v1',{p_token:inv.token});
  assert.equal(lookup.error,null);
  assert.equal(lookup.data.totalCents,2507079);
  assert.equal(lookup.data.services.length,1);
  assert.equal(lookup.data.status,'pending');
  const response=await visitor.rpc('cv_proposal_respond_v1',{
   p_token:inv.token,p_decision:'accepted',
   p_name:'Maria Contratante',p_email:'maria@cliente.com',
   p_reason:'',p_confirmed:true});
  assert.equal(response.data.ok,true);
  assert.equal(response.data.status,'accepted');
  const dupe=await visitor.rpc('cv_proposal_respond_v1',{
   p_token:inv.token,p_decision:'declined',
   p_name:'Outra Pessoa',p_email:'outra@cliente.com',p_confirmed:true});
  assert.ok(dupe.error,'uma resposta não pode ser substituída por outra');
  const reloaded=await fetchInvitesRemote(owner,uid);
  assert.equal(reloaded.length,1);
  assert.equal(reloaded[0].status,'accepted');
  assert.equal(reloaded[0].respondentEmail,'maria@cliente.com');
  assert.equal((await fetchRemote(owner,uid)).invites.length,1);
  const inv2={...inv,id:randomUUID(),budgetId:randomUUID(),token:createProposalToken(webcrypto)};
  await putRemote(owner,uid,'invites',inv2);
  const reject=await visitor.rpc('cv_proposal_respond_v1',{
   p_token:inv2.token,p_decision:'declined',
   p_name:'João Contratante',p_email:'joao@cliente.com',
   p_reason:'Prazo incompatível',p_confirmed:true});
  assert.equal(reject.data.status,'declined');
  const saved=await fetchInvitesRemote(owner,uid);
  assert.equal(saved.find(x=>x.id===inv2.id).declineReason,'Prazo incompatível');
  const inv3={...inv,id:randomUUID(),budgetId:randomUUID(),token:createProposalToken(webcrypto)};
  await putRemote(owner,uid,'invites',inv3);
  await revokeProposalRemote(owner,uid,inv3.budgetId);
  const unavailable=await visitor.rpc('cv_proposal_lookup_v1',{p_token:inv3.token});
  assert.equal(unavailable.data.available,false);
 }finally{globalThis.localStorage=old;}
});
