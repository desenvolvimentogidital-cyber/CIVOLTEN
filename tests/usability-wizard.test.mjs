import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BUDGET_STEPS,clampBudgetStep,budgetStepIndex,mountBudgetWizard} from '../assets/budget-wizard.js';

const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../assets/dashboard.js',import.meta.url),'utf8');

test('etapas do orçamento continuam na ordem correta e valores inválidos são limitados',()=>{
 assert.deepEqual(BUDGET_STEPS.map(x=>x.id),[
  'budget-step-project','budget-step-services','budget-step-team',
  'budget-step-materials','budget-step-commercial'
 ]);
 assert.equal(clampBudgetStep(-1),0);
 assert.equal(clampBudgetStep(99),4);
 assert.equal(clampBudgetStep('2'),2);
 assert.equal(clampBudgetStep('x'),0);
 assert.equal(budgetStepIndex('budget-step-materials'),3);
 assert.equal(budgetStepIndex('inexistente'),-1);
});

function browserMock(){
 const makeNode=(tag='div')=>({
  tagName:tag,attributes:new Map(),children:[],dataset:{},
  append(...items){this.children.push(...items)},
  setAttribute(k,v){this.attributes.set(k,v)},
  removeAttribute(k){this.attributes.delete(k)},
  getAttribute(k){return this.attributes.get(k)||null},
  matches(query){return query==='[data-budget-go]'?'budgetGo' in this.dataset:
   query==='[data-budget-summary]'?'budgetSummary' in this.dataset:false},
  closest(){return this},scrollIntoView(){this.scrolled=true},
  focus(){this.focused=true},querySelector(){return null}
 });
 const cards=BUDGET_STEPS.map(x=>{
  const card=makeNode();card.id=x.id;card.hidden=false;
  const heading=makeNode('h2');card.querySelector=q=>q==='h2'?heading:null;
  card.heading=heading;return card;
 });
 const nav=BUDGET_STEPS.map(x=>{
  const link=makeNode('a');link.setAttribute('href','#'+x.id);
  return link;
 });
 const summary=makeNode(),listeners={};
 let invalid=null;
 const root={
  ownerDocument:{createElement:makeNode},
  querySelector(q){
   if(q.startsWith('#'))return cards.find(x=>x.id===q.slice(1));
   if(q==='.budget-summary-panel')return summary;
   if(q==='.cv-field-error,.cv-validation-group-error')return invalid;
   return null;
  },
  querySelectorAll(q){return q==='.budget-jump-nav a'?nav:[]},
  addEventListener(event,handler){listeners[event]=handler},
  contains(){return true}
 };
 const click=target=>listeners.click({
  target:{closest(){return target}},
  preventDefault(){}
 });
 const setInvalidAt=index=>{
  invalid=makeNode('input');
  invalid.closest=query=>query==='.budget-step-card'?cards[index]:null;
 };
 return {root,cards,nav,summary,click,setInvalidAt,get invalid(){return invalid}};
}

test('somente uma etapa aparece por vez, com próximo, voltar e navegação direta',()=>{
 const page=browserMock(),visited=[];
 const wizard=mountBudgetWizard(page.root,{step:0,onStep:x=>visited.push(x)});
 assert.ok(wizard);
 assert.deepEqual(page.cards.map(x=>x.hidden),[false,true,true,true,true]);
 assert.equal(page.nav[0].getAttribute('aria-current'),'step');
 page.click(page.cards[0].children[0].children[1]); // Continuar
 assert.equal(wizard.getStep(),1);
 assert.deepEqual(page.cards.map(x=>x.hidden),[true,false,true,true,true]);
 page.click(page.cards[1].children[0].children[1]); // Voltar
 assert.equal(wizard.getStep(),0);
 page.click(page.nav[4]);
 assert.equal(wizard.getStep(),4);
 assert.equal(page.nav[4].getAttribute('aria-current'),'step');
 assert.ok(visited.includes(4));
 page.click(page.cards[4].children[0].children[2]); // Ver resumo
 assert.equal(page.summary.scrolled,true);
});

test('erro em etapa escondida revela e foca o campo, sem perder a proposta',()=>{
 const page=browserMock();
 const wizard=mountBudgetWizard(page.root,{step:4});
 page.setInvalidAt(1);
 assert.equal(wizard.focusFirstError(),true);
 assert.equal(wizard.getStep(),1);
 assert.equal(page.invalid.focused,true);
 assert.equal(page.invalid.scrolled,true);
});

test('integração mantém validação do PDF e rascunhos em etapa segura',()=>{
 assert.match(app,/mountBudgetWizard\(\$\('#content'\)/);
 assert.match(app,/focus:false/);
 assert.match(app,/budgetWizard\?\.focusFirstError\(\)/);
 assert.match(app,/state\.budgetStep=0/);
 assert.match(app,/Salvar como PDF/);
 assert.match(css,/budget-step-card\[hidden\]\{display:none!important\}/);
 assert.match(index,/<nav aria-label="Navegação">/);
 assert.doesNotMatch(index,/mobileMenuToggle|civoltenMainNav/);
 assert.doesNotMatch(app,/setMobileMenu|mobileMenuToggle/);
 assert.doesNotMatch(css,/mobile-menu-open|mobile-menu-toggle/);
 assert.match(css,/#app \.sidebar nav\{display:flex;overflow-x:auto/);
 assert.match(css,/#app \.sidebar \.nav\{flex:none;white-space:nowrap/);
 assert.match(css,/#app \.sidebar \.logout\{\s*display:block!important/);
 assert.match(dashboard,/quickStartGuide\(data\)\+settingsWarning/);
 assert.match(dashboard,/Comece em 3 passos/);
});
