import test from 'node:test';
import assert from 'node:assert/strict';
import {replyCounts,selectResponses,unreadReplies,responseSeen} from '../src/proposal-inbox.mjs';
import {responseInboxView,responseDetailView} from '../src/proposal-inbox-ui.mjs';

const id1='11000000-0000-4000-8000-000000000001',id2='11000000-0000-4000-8000-000000000002';
const inv1='22000000-0000-4000-8000-000000000001',inv2='22000000-0000-4000-8000-000000000002';
function data(){
 return {budgets:[
  {id:id1,title:'Reforma elétrica',customer:'João Ávila',project:'Obra Tamboré'},
  {id:id2,title:'Pintura interna',customer:'Maria Silva',project:'Obra Centro'}],
  invites:[
   {id:inv1,budgetId:id1,status:'accepted',respondentName:'João Ávila',respondentEmail:'joao@cliente.com',
    totalCents:950000,respondedAt:'2026-11-09T12:00:00Z',createdAt:'2026-11-09T11:00:00Z'},
   {id:inv2,budgetId:id2,status:'declined',respondentName:'Maria Silva',respondentEmail:'maria@cliente.com',
    totalCents:250000,respondedAt:'2026-11-09T13:00:00Z',createdAt:'2026-11-09T12:00:00Z',
    declineReason:'Preciso de outro prazo'}],
  reads:[],works:[]};
}
test('central separa clientes e localiza por nome, obra, e-mail e status',()=>{
 const d=data();
 assert.deepEqual(replyCounts(d),{all:2,new:2,accepted:1,declined:1,pending:0});
 assert.equal(selectResponses(d,'all','joao avila').length,1);
 assert.equal(selectResponses(d,'all','obra tamboré')[0].invite.id,inv1);
 assert.equal(selectResponses(d,'all','maria@cliente.com')[0].invite.id,inv2);
 assert.equal(selectResponses(d,'accepted','')[0].invite.id,inv1);
 assert.equal(selectResponses(d,'declined','')[0].invite.id,inv2);
 assert.equal(selectResponses(d,'all','cliente inexistente').length,0);
});
test('lidos não somem do histórico e são vistos após sincronização entre dispositivos',()=>{
 const d=data();
 assert.equal(unreadReplies(d).length,2);
 d.reads=[{id:'33000000-0000-4000-8000-000000000001',inviteId:inv1,seenAt:'2026-11-09T14:00:00Z'}];
 assert.equal(responseSeen(d,d.invites[0]),true);
 assert.equal(unreadReplies(d).length,1);
 assert.deepEqual(replyCounts(d),{all:2,new:1,accepted:1,declined:1,pending:0});
 assert.equal(selectResponses(d,'new','')[0].invite.id,inv2);
 assert.equal(selectResponses(d,'accepted','')[0].invite.id,inv1);
});
test('interface destaca mensagens novas, mostra motivo da recusa e evita HTML não confiável',()=>{
 const d=data();
 const html=responseInboxView(d,'new','Ávila');
 assert.match(html,/Central de Respostas/);
 assert.match(html,/data-action="inbox-open"/);
 assert.match(html,/is-new/);
 assert.match(responseDetailView(d,inv2),/Preciso de outro prazo/);
 d.budgets[0].customer='<script>alert(1)</script>';
 const unsafe=responseInboxView(d,'all','');
 assert.doesNotMatch(unsafe,/<script>/);
 assert.match(unsafe,/&lt;script&gt;/);
});
