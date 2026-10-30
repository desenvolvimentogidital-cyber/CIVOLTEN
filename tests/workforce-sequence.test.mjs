import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWorkforceEstimate} from '../src/workforce-estimate.mjs';
import {summarizeWorkforce} from '../src/workforce-costing.mjs';
import {planExecutionSequence,constructionStage} from '../src/workforce-sequence.mjs';
import {workforcePanel} from '../public/secure-workforce.js';
const data=[
 {id:'reboco',position:1,source_code:'11002013',source_name:'REBOCO INTERNO - ARGAMASSA PRÉ-FABRICADA',unit:'M2',quantity:200,
  direct_hh_per_unit:.62,labor:[{code:'2020',name:'PEDREIRO',unit:'H',coef:.34},{code:'2099',name:'SERVENTE',unit:'H',coef:.28}]},
 {id:'alvenaria',position:2,source_code:'4001070',source_name:'ALVENARIA EM BLOCO CERÂMICO COMUM',unit:'M2',quantity:100,
  direct_hh_per_unit:2.5,labor:[{code:'2020',name:'PEDREIRO',unit:'H',coef:1.4},{code:'2099',name:'SERVENTE',unit:'H',coef:1.1}]}
];
const chapisco={id:'chapisco',position:3,source_code:'QA-CHAP',source_name:'CHAPISCO APLICADO NA PAREDE',
  quantity:100,unit:'M2',direct_hh_per_unit:.34,labor:[
   {code:'2020',name:'PEDREIRO',unit:'H',coef:.20},{code:'2099',name:'SERVENTE',unit:'H',coef:.14}]};
test('Reconhece as etapas pelo nome SIURB mesmo sem acento',()=>{
 assert.equal(constructionStage({title:'Alvenaria de blocos'}).key,'alvenaria');
 assert.equal(constructionStage({title:'CHAPISCO aplicado'}).key,'chapisco');
 assert.equal(constructionStage({title:'Reboco interno'}).key,'reboco');
 assert.equal(constructionStage({title:'Massa única'}).key,'reboco');
 assert.equal(constructionStage({title:'Instalação elétrica'}),null);
});
test('Ordem alvenaria depois chapisco depois reboco, mesmo com orçamento fora de ordem',()=>{
 const model=buildWorkforceEstimate([data[0],chapisco,data[1]]);
 const sequence=planExecutionSequence(model.services);
 assert.deepEqual(sequence.steps.map(x=>x.stage_key),['alvenaria','chapisco','reboco']);
 assert.equal(sequence.missing.length,0);
 assert.equal(sequence.complete,true);
 assert.equal(sequence.sequence_workdays_estimated,22);
 assert.equal(sequence.steps[0].duration_workdays,10);
 assert.equal(sequence.steps[1].duration_workdays,3);
 assert.equal(sequence.steps[2].duration_workdays,9);
});
test('Sem chapisco, não inventa serviço nem fecha prazo e custo total',()=>{
 const model=buildWorkforceEstimate(data);
 const x=summarizeWorkforce(model,{
  rates:[{role_code:'2020',hourly_employer_cost:'30'},{role_code:'2099',hourly_employer_cost:'20'}],
  overhead:{monthly_overhead:22000,workdays_per_month:22}
 });
 assert.equal(x.execution_sequence.missing[0].code,'missing_chapisco');
 assert.deepEqual(x.execution_sequence.steps.map(x=>x.stage_key),['alvenaria','reboco']);
 assert.equal(x.execution_sequence.sequence_workdays_estimated,19);
 assert.equal(x.execution_sequence.complete,false);
 assert.equal(x.duration.complete,false);
 assert.equal(x.costs.total_sequential,null);
 assert.equal(x.costs.available,false);
 assert.equal(x.role_totals.sequential_workers,5);
});
test('Para serviço sem horas-homem, sequência é parcial mesmo que chapisco exista',()=>{
 const a=buildWorkforceEstimate([...data,chapisco,{id:'sem',source_name:'Instalação elétrica',quantity:5,unit:'UN'}]);
 const x=planExecutionSequence(a.services);
 assert.equal(x.complete,false);assert.ok(x.steps.some(y=>y.duration_workdays===null));
 assert.ok(x.missing.length===0);
});
test('Aviso de chapisco fica visível no celular e oferece retorno ao orçamento',()=>{
 const original=buildWorkforceEstimate(data);
 const x={...original,...summarizeWorkforce(original),budget:{code:'ORC-TESTE'}};
 const escape=v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
 const html=workforcePanel(x,escape);
 assert.match(html,/Ordem de execução da obra/);
 assert.ok(html.indexOf('Alvenaria')<html.indexOf('Reboco'), 'precedência vem na ordem correta');
 assert.match(html,/Chapisco não encontrado no orçamento/);
 assert.match(html,/Ver serviços do orçamento/);
 assert.match(html,/Mínimo parcial: 19 dias úteis/);
 assert.doesNotMatch(html,/Profissionais · paralelo/);
 assert.doesNotMatch(html,/Equipes cadastradas/);
});
test('Nenhum alerta de etapa ausente se chapisco fizer parte do orçamento',()=>{
 const original=buildWorkforceEstimate([...data,chapisco]);
 const x={...original,...summarizeWorkforce(original),budget:{code:'ORC-TESTE'}};
 const escape=v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
 const html=workforcePanel(x,escape);
 assert.match(html,/22 dias úteis/);
 assert.doesNotMatch(html,/Chapisco não encontrado no orçamento/);
});
