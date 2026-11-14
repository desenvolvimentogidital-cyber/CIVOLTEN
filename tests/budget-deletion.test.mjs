import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetDeletionContext,budgetDeletionPrompt} from '../src/budget-deletion.mjs';
import {responseDetailView} from '../src/proposal-inbox-ui.mjs';
import {responseRecords} from '../src/proposal-inbox.mjs';

const id='11111111-2222-4333-8444-555555555555';
const b={id,title:'Orçamento para Larissa',customer:'Larissa',items:[{quantity:3}]};
const invite=(status='pending')=>({
 id:'55555555-2222-4333-8444-111111111111',budgetId:id,
 budgetSnapshot:{...b,project:'Reforma comercial',createdAt:'2026-11-09T11:00:00Z'},
 status,totalCents:1250000,validUntil:'2026-11-30',createdAt:'2026-11-09T11:00:00Z',
 respondedAt:status==='accepted'?'2026-11-12T12:00:00Z':null
});
test('sem dependências o orçamento pode ser excluído com confirmação',()=>{
 const context=budgetDeletionContext({budgets:[b],invites:[],works:[]},id);
 assert.equal(context.pending,0);
 assert.equal(context.invites.length,0);
 const text=budgetDeletionPrompt(b,{invites:[],works:[]});
 assert.match(text,/PERMANENTEMENTE/);
 assert.match(text,/não poderá ser desfeita/);
 assert.doesNotMatch(text,/links de aceite/);
});
test('convite pendente precisa ser revogado, resposta e obra preservadas',()=>{
 const data={invites:[invite(),invite('declined')],works:[{id:'obra',budgetId:id}],budgets:[b]};
 const context=budgetDeletionContext(data,id);
 assert.equal(context.pending,1);
 assert.equal(context.invites.length,2);
 assert.equal(context.works.length,1);
 const text=budgetDeletionPrompt(b,data);
 assert.match(text,/revogados/);
 assert.match(text,/PRESERVADOS/);
});
test('aceite confirmado sem obra deve alertar sobre a impossibilidade de formalizar após apagar',()=>{
 const text=budgetDeletionPrompt(b,{invites:[invite('accepted')],works:[]});
 assert.match(text,/não será possível abrir uma nova ordem de serviço/);
});
test('aceite e histórico continuam legíveis quando o orçamento foi excluído',()=>{
 const i=invite('accepted');
 const data={budgets:[],invites:[i],works:[],reads:[]};
 const rows=responseRecords(data);
 assert.equal(rows[0].customer,'Larissa');
 const html=responseDetailView(data,i.id);
 assert.match(html,/Cliente ACEITOU/);
 assert.match(html,/Orçamento excluído/);
 assert.doesNotMatch(html,/data-action="work-approve-budget"/);
 assert.doesNotMatch(html,/data-action="inbox-open-budget"/);
 assert.match(html,/R\$ 12\.500,00/);
});
test('obra continua acessível na central de respostas se o cadastro original foi apagado',()=>{
 const i=invite('accepted'),w={id:'obra-1',budgetId:id,contractRef:'OS-2026-ABC'};
 const html=responseDetailView({budgets:[],invites:[i],works:[w],reads:[]},i.id);
 assert.match(html,/Abrir obra/);
 assert.match(html,/OS-2026-ABC/);
 assert.doesNotMatch(html,/Abrir orçamento deste cliente/);
});
