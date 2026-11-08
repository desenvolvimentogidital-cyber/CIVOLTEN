import test from 'node:test';
import assert from 'node:assert/strict';
import {ADDITIONAL_REFERENCES} from '../src/productivity-reference-additional.mjs';
import {REFERENCE_SERVICES,referenceService,referenceToBudgetItem} from '../src/productivity-reference.mjs';
import {CATALOG_SECTIONS,CATALOG_PRESETS,catalogByCode,catalogRows,catalogReady,catalogStats,
 catalogHours,catalogToBudgetItem,validateCatalogRecord} from '../src/service-catalog.mjs';
import {validateBudget,validateBudgetItem,priceBudget} from '../src/budget.mjs';
import {fresh} from '../src/calc.mjs';

const snap={monthlyCostCents:1600000,productiveHours:320,productiveDays:20,
 hoursPerDay:8,productivePeople:2,taxPct:10,marginPct:20,
 companyName:'CIVOLTEN',capturedOn:'2026-11-08'};
test('segunda tabela inclui exatamente 63 serviços, onze grupos, unidades e faixas originais',()=>{
 assert.equal(ADDITIONAL_REFERENCES.length,63);
 assert.equal(CATALOG_SECTIONS.length,11);
 const expected={'01':5,'02':8,'03':6,'04':4,'05':8,'06':6,'07':5,'08':10,'09':6,'10':3,'11':2};
 for(const [cat,count] of Object.entries(expected))
  assert.equal(ADDITIONAL_REFERENCES.filter(r=>r.category===cat).length,count,cat);
 assert.equal(new Set(ADDITIONAL_REFERENCES.map(r=>r.code)).size,63);
 assert.ok(ADDITIONAL_REFERENCES.every(r=>r.description&&!/^\d+\.\d+/.test(r.description)));
 assert.ok(ADDITIONAL_REFERENCES.every(r=>r.hhMin>0&&r.hhMax>=r.hhMin&&r.hhMid>=r.hhMin&&r.hhMid<=r.hhMax));
 assert.ok(ADDITIONAL_REFERENCES.every(r=>r.unit&&r.origin.includes('não homologada pelo SINAPI')));
 const find=name=>ADDITIONAL_REFERENCES.find(r=>r.description===name);
 assert.deepEqual([find('Limpeza, capina e roçada do terreno').unit,
  find('Limpeza, capina e roçada do terreno').hhMin,
  find('Limpeza, capina e roçada do terreno').hhMax],['m²',.1,.2]);
 assert.deepEqual([find('Fiação Pesada (Cabos de alimentação > 10mm²)').unit,
  find('Fiação Pesada (Cabos de alimentação > 10mm²)').hhMin,
  find('Fiação Pesada (Cabos de alimentação > 10mm²)').hhMax],['m',.15,.25]);
 assert.deepEqual([find('Infraestrutura para Ar-Condicionado (Dreno + Cobre)').unit,
  find('Infraestrutura para Ar-Condicionado (Dreno + Cobre)').hhMin,
  find('Infraestrutura para Ar-Condicionado (Dreno + Cobre)').hhMax],['pt',3,5]);
 assert.equal(find('Testes de Estanqueidade (Pressurização de rede)').unit,'cj');
 assert.equal(find('Inspeção final, testes e retoques'),undefined,'Mantido separadamente da primeira relação');
});
test('revisão mantém serviços complementares antigos sem duplicar genéricos superados',()=>{
 const old=REFERENCE_SERVICES.filter(r=>Number(r.code.split('-')[2])<200);
 assert.ok(old.length>0&&old.length<27);
 assert.equal(REFERENCE_SERVICES.length,63+old.length);
 assert.equal(new Set(REFERENCE_SERVICES.map(r=>r.code)).size,REFERENCE_SERVICES.length);
 assert.ok(!old.some(r=>r.description==='Aplicação de chapisco'));
 assert.ok(!old.some(r=>r.description==='Instalação de portas (kit porta pronta)'));
 assert.ok(REFERENCE_SERVICES.some(r=>r.description==='Inspeção final, testes e retoques'&&r.category==='11'));
 assert.ok(REFERENCE_SERVICES.some(r=>r.description==='Impermeabilização com manta asfáltica'));
 const allCodes=CATALOG_PRESETS.map(r=>r.code);
 assert.equal(new Set(allCodes).size,allCodes.length,'Todos os códigos internos devem ser únicos');
 assert.ok(CATALOG_PRESETS.length>REFERENCE_SERVICES.length);
 assert.equal(catalogRows([]).length,CATALOG_PRESETS.length);
 assert.equal(catalogStats([]).ready,0,'Sem inventar custo direto de materiais');
});
test('faixas geram ponto médio HH por unidade, e preço por m² usa custo interno',()=>{
 const ref=ADDITIONAL_REFERENCES.find(r=>r.description==='Chapisco (Traço convencional ou industrializado)');
 assert.equal(ref.unit,'m²');
 assert.equal(ref.hhMin,.15);assert.equal(ref.hhMax,.25);assert.equal(ref.hhMid,.2);
 const item=referenceToBudgetItem(ref,'item-01');
 assert.equal(item.laborHours,.2);
 assert.equal(item.directCost,null,'Não inventar custo direto por m²');
 assert.throws(()=>validateBudgetItem(item),/Custo direto/);
 const configured=validateBudgetItem({...item,quantity:100,directCost:12});
 assert.equal(configured.unit,'m²');
 assert.equal(configured.hhMin,.15);assert.equal(configured.hhMax,.25);
 const draft=validateBudget({id:'budget-01',title:'Reforma',customer:'Cliente',items:[configured],
  pricing:snap,demo:false,commercial:{}});
 const result=priceBudget(draft);
 assert.equal(result.totalHours,20);
 assert.equal(result.rows[0].labor,100000);
 assert.equal(result.rows[0].materials,120000);
 assert.equal(result.totalCost,220000);
 assert.equal(result.totalSale,314286);
 assert.equal(Math.round(result.rows[0].unitSelling),3143,'Preço por unidade em centavos');
});
test('referência SINAPI não é atribuída sem código/competência verificados',()=>{
 const template=catalogByCode('CV-08-201');
 assert.ok(template);
 assert.equal(template.unit,'m²');
 assert.equal(catalogHours(template),.2);
 assert.equal(catalogReady(template),false);
 const fields={description:template.description,unit:template.unit,source:'internal',
  role1:'Pedreiro',hours1:'0.12',role2:'Ajudante',hours2:'0.08',directCost:'15'};
 const record=validateCatalogRecord(fields,template);
 assert.equal(record.roles.length,2);
 assert.equal(record.directCost,15);
 assert.equal(catalogHours(record),.2);
 const [combined]=catalogRows([{...record,id:'11111111-1111-4111-8111-111111111111'}])
  .filter(row=>row.code===template.code);
 assert.equal(combined.hhMin,.15);
 assert.equal(combined.hhMax,.25);
 assert.equal(catalogReady(combined),true);
 const budgetItem=catalogToBudgetItem(combined,'item-02');
 assert.equal(budgetItem.laborHours,.2);
 assert.equal(budgetItem.roles.length,2);
 assert.equal(budgetItem.reference.system,'INTERNO');
 assert.throws(()=>validateCatalogRecord({...fields,source:'sinapi'},template),
  /Referência SINAPI exige código/);
});
test('base de dados existente mantém orçamentos, equipe e custos sem alterações',()=>{
 const state=fresh();
 assert.deepEqual(state.catalog,[]);
 assert.deepEqual(state.budgets,[]);
 assert.deepEqual(state.fixed,[]);
 assert.deepEqual(state.variable,[]);
 assert.deepEqual(state.employees,[]);
 const ref=referenceService('CV-05-204');
 assert.match(ref.description,/Quadros de Distribuição/);
 assert.equal(ref.unit,'un');
 assert.equal(ref.hhMid,5);
});
