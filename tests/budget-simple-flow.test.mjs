import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBudgetStaff,staffAlreadyAdded} from '../lib/civolten-team.mjs';
import {calculateBudget} from '../lib/civolten-calc.mjs';
import {companyRates} from '../lib/civolten-capacity.mjs';
const staff=[
 {id:'1',active:true,cost_mode:'monthly',name:'Funcionário fixo',profession:'Eletricista',daily_cents:30000,days_month:22,charges_pct:15},
 {id:'2',active:true,cost_mode:'project',name:'Autônomo',profession:'Pedreiro',daily_cents:25000,days_month:22,charges_pct:10}
];
const fixed=[{active:true,monthly_cents:1200000}];
const pricing=()=>({fixed_monthly_cents:companyRates(fixed,{billable_days_month:22},staff).monthly_cents,billable_days_month:22,tax_pct:10,margin_pct:20});
test('seleciona funcionario fixo mas nao cobra duas vezes o custo mensal',()=>{
 const monthly=createBudgetStaff(staff[0],5);
 assert.equal(monthly.name,'Funcionário fixo');
 assert.equal(monthly.profession,'Eletricista');
 assert.equal(monthly.cost_mode,'monthly');
 assert.equal(monthly.daily_cents,0);
 assert.equal(monthly.daily_reference_cents,30000);
 assert.equal(monthly.charges_pct,0);
 const base=calculateBudget({days:5,pricing:pricing(),staff:[],expenses:[]});
 const selected=calculateBudget({days:5,pricing:pricing(),staff:[monthly],expenses:[]});
 assert.equal(selected.labor_cents,0);
 assert.equal(selected.fixed_cents,base.fixed_cents);
 assert.equal(selected.cost_cents,base.cost_cents);
});
test('seleciona autonomo com diaria e encargos cadastrados',()=>{
 const project=createBudgetStaff(staff[1],4);
 assert.equal(project.profession,'Pedreiro');
 assert.equal(project.charges_pct,10);
 assert.equal(project.daily_cents,25000);
 const r=calculateBudget({days:4,staff:[project],expenses:[],pricing:pricing()});
 assert.equal(r.labor_cents,110000);
 assert.ok(r.cost_cents>r.fixed_cents);
});
test('selecionar varios profissionais da obra nao insere duplicados',()=>{
 const worker=createBudgetStaff(staff[0],4);
 assert.equal(staffAlreadyAdded([worker],staff[0].id),true);
 assert.equal(staffAlreadyAdded([worker],staff[1].id),false);
});
test('sem funcionario ativo nao permite inserir na obra',()=>{
 assert.throws(()=>createBudgetStaff({...staff[1],active:false},5),/ativo/);
 assert.throws(()=>createBudgetStaff(staff[1],0),/dias/);
});
test('configuracao geral governa margem e tributos sem formulario duplicado em orçamento',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const editor=app.slice(app.indexOf('function editor(){'),app.indexOf('function summary(){'));
 const settings=app.slice(app.indexOf('function settings(){'),app.indexOf('function accessList(){'));
 assert.match(editor,/workerOptions\(workers\.sort/);
 assert.match(editor,/Lista de todos os profissionais cadastrados/);
 assert.match(editor,/Escolha os profissionais da obra/);
 assert.match(editor,/Configurações financeiras/);
 assert.doesNotMatch(editor,/data-pricing="tax_pct"/);
 assert.doesNotMatch(editor,/data-pricing="margin_pct"/);
 assert.doesNotMatch(editor,/data-pricing="billable_days_month"/);
 assert.doesNotMatch(editor,/data-pricing="fixed_monthly_reais"/);
 assert.match(settings,/name="margin_pct"/);
 assert.match(settings,/name="tax_pct"/);
 assert.match(settings,/name="billable_days_month"/);
 assert.match(settings,/name="hours_day"/);
 assert.match(app,/pricing:defaultPricing\(\)/);
});
test('fluxo em quatro passos e materiais opcionais preservam memorial, PDF e legado',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const editor=app.slice(app.indexOf('function editor(){'),app.indexOf('function summary(){'));
 const positions=['Dados da obra','Escolha os profissionais da obra','Serviços e quantidades','Materiais e outras despesas'];
 const indices=positions.map(x=>editor.indexOf(x));
 assert.ok(indices.every((x,i)=>x>=0&&(i===0||x>indices[i-1])));
 assert.match(editor,/data-action="add-scope"/);
 assert.match(editor,/data-action="add-variable"/);
 assert.match(editor,/data-draft="manual_price"/);
 assert.match(app,/row\?structuredClone\(row\.content\)/);
 assert.match(editor,/data-draft="days"/);
 const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.budget-team-monthly/);
 assert.match(css,/@media\(max-width:680px\)/);
});
