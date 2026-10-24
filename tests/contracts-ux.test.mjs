import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTRACT_STEPS,clampContractStep,contractStepIndex,mountContractWizard} from '../assets/contract-wizard.js';

const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const contracts=fs.readFileSync(new URL('../assets/contracts.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');

test('contratos mantêm quatro etapas na sequência correta',()=>{
 assert.deepEqual(CONTRACT_STEPS.map(s=>s.id),[
  'contract-step-parties','contract-step-work','contract-step-payment','contract-step-terms'
 ]);
 assert.equal(clampContractStep(-1),0);
 assert.equal(clampContractStep(19),3);
 assert.equal(clampContractStep('2'),2);
 assert.equal(clampContractStep('texto'),0);
 assert.equal(contractStepIndex('contract-step-payment'),2);
 assert.equal(contractStepIndex('nao-existe'),-1);
});
function mock(){
 const make=(tag='div')=>({
  tagName:tag,dataset:{},children:[],attributes:new Map(),hidden:false,
  append(...children){this.children.push(...children)},
  setAttribute(k,v){this.attributes.set(k,v)},
  removeAttribute(k){this.attributes.delete(k)},
  getAttribute(k){return this.attributes.get(k)||null},
  matches(s){return s==='[data-contract-go]'?'contractGo' in this.dataset:
   s==='[data-contract-summary]'?'contractSummary' in this.dataset:false},
  scrollIntoView(){this.scrolled=true},focus(){this.focused=true},
  closest(){return this},querySelector(){return null}
 });
 const cards=CONTRACT_STEPS.map(s=>{
  const card=make();card.id=s.id;
  const heading=make('h2');
  card.heading=heading;card.querySelector=q=>q==='h2'?heading:null;
  return card;
 });
 const nav=CONTRACT_STEPS.map(s=>{
  const link=make('a');link.setAttribute('href','#'+s.id);return link;
 });
 const summary=make(),listeners={},area=make();
 let invalid=null;
 area.querySelector=q=>q==='.contract-summary'?summary:
  q==='.cv-field-error,.cv-validation-group-error'?invalid:
  cards.find(x=>q==='#'+x.id)||null;
 const root={
  ownerDocument:{createElement:make},
  querySelector:q=>q==='.contract-editor'?area:null,
  querySelectorAll:q=>q==='.contract-jump-nav a'?nav:[],
  addEventListener:(type,handler)=>listeners[type]=handler,
  contains:()=>true
 };
 const click=target=>listeners.click({target:{closest(){return target}},preventDefault(){}});
 const setInvalid=index=>{
  invalid=make('input');
  invalid.closest=query=>query==='.contract-editor-card'?cards[index]:null;
 };
 return {root,cards,nav,summary,click,setInvalid,get invalid(){return invalid}};
}

test('continua, volta e navega diretamente sem descartar o rascunho',()=>{
 const dom=mock(),selected=[];
 const wizard=mountContractWizard(dom.root,{onStep:n=>selected.push(n)});
 assert.ok(wizard);
 assert.deepEqual(dom.cards.map(x=>x.hidden),[false,true,true,true]);
 dom.click(dom.cards[0].children[0].children[1]);
 assert.equal(wizard.getStep(),1);
 assert.deepEqual(dom.cards.map(x=>x.hidden),[true,false,true,true]);
 dom.click(dom.cards[1].children[0].children[1]);
 assert.equal(wizard.getStep(),0);
 dom.click(dom.nav[3]);
 assert.equal(wizard.getStep(),3);
 assert.equal(dom.nav[3].getAttribute('aria-current'),'step');
 assert.ok(selected.includes(3));
 dom.click(dom.cards[3].children[0].children[2]);
 assert.equal(dom.summary.scrolled,true);
});

test('erro encontrado em outra etapa é revelado e recebe foco',()=>{
 const dom=mock();
 const wizard=mountContractWizard(dom.root,{step:3});
 dom.setInvalid(1);
 assert.equal(wizard.focusFirstError(),true);
 assert.equal(wizard.getStep(),1);
 assert.equal(dom.invalid.focused,true);
 assert.equal(dom.invalid.scrolled,true);
});

test('código mantém campos originais, revisão de cláusulas e exportação',()=>{
 for(const id of CONTRACT_STEPS.map(s=>s.id))assert.ok(contracts.includes('id="'+id+'"'),id);
 assert.match(contracts,/contract-advanced/);
 assert.match(contracts,/contract-company-review/);
 assert.match(contracts,/data-action="revise-open-contract"/);
 assert.match(contracts,/data-action="print-contract"/);
 assert.match(contracts,/Salvar como PDF/);
 assert.match(app,/import \{mountContractWizard\} from '\/assets\/contract-wizard.js'/);
 assert.match(app,/contractWizard\?\.focusFirstError\(\)/);
 assert.match(app,/contractStep:0/);
 assert.match(app,/contractWizard=state.view==='contract-editor'\?mountContractWizard/);
 assert.match(css,/contract-editor-card\[hidden\]\{display:none!important\}/);
 assert.match(css,/contract-jump-nav/);
});
