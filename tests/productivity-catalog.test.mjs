import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDelimited,parseDecimal,suggestColumns,buildCatalogImport} from '../src/catalog-import.mjs';
import {CATALOG_PRESETS,catalogByCode,catalogRows,catalogHours,catalogReady,
 catalogStats,validateCatalogRecord,catalogToBudgetItem} from '../src/service-catalog.mjs';
import {validateBudgetItem,validateBudget,priceBudget} from '../src/budget.mjs';

test('catalogo inicia vazio: sem servicos ficticios, predefinidos ou precos inventados',()=>{
 assert.deepEqual(CATALOG_PRESETS,[]);
 assert.deepEqual(catalogRows([]),[]);
 assert.deepEqual(catalogStats([]),{total:0,ready:0,pending:0});
 assert.equal(catalogByCode([], 'CV-05-204'),null);
});
test('CSV oficial traz codigo, unidade, mao de obra; ignora coluna de preco',()=>{
 const rows=parseDelimited('Codigo;Descricao;Unidade;Profissional;Coeficiente HH;Preco de tabela\n'+
  'A100;Quadro de distribuicao;un;Eletricista;3,5;999,99\n'+
  'A100;Quadro de distribuicao;un;Ajudante;1,5;999,99\n'+
  'A200;Limpeza da obra;m²;Servente;0,25;4,99\n');
 assert.equal(rows.length,4);
 assert.equal(parseDecimal('1.234,56'),1234.56);
 const mapping=suggestColumns(rows);
 assert.deepEqual([mapping.code,mapping.description,mapping.unit,mapping.role,mapping.hours],[0,1,2,3,4]);
 const result=buildCatalogImport(rows,{source:'siurb',month:'2026-07',headerIndex:0,mapping});
 assert.equal(result.items.length,2);
 assert.equal(result.items[0].code,'SIURB:A100');
 assert.equal(result.items[0].source,'siurb');
 assert.equal(result.items[0].sinapiCode,'A100');
 assert.equal(result.items[0].referenceMonth,'2026-07');
 assert.equal(result.items[0].directCost,null);
 assert.equal(catalogHours(result.items[0]),5);
 assert.equal(catalogReady(result.items[0]),true,'HH basta para serviço de mão de obra, sem exigir material');
 assert.deepEqual(result.items[0].roles,[{role:'Eletricista',hours:3.5},{role:'Ajudante',hours:1.5}]);
 assert.equal(result.loadedLabor,3);
});
test('reimportacao nao sobrescreve custo/produtividade editados e fontes nao se misturam',()=>{
 const lines=[['Codigo','Descricao','Unidade','Profissional','HH'],
  ['100','Alvenaria','m²','Pedreiro','1.1']];
 const mapping={code:0,description:1,unit:2,role:3,hours:4,category:-1};
 const existing=[{id:'11111111-1111-4111-8111-111111111111',code:'SIURB:100',
  description:'Alvenaria ajustada',unit:'m²',source:'siurb',category:'SIURB',
  roles:[{role:'Pedreiro',hours:0.8}],directCost:12}];
 const siurb=buildCatalogImport(lines,{source:'siurb',month:'2026-07',mapping,existing});
 assert.equal(siurb.items[0].id,existing[0].id);
 assert.equal(siurb.items[0].directCost,12);
 assert.equal(catalogHours(siurb.items[0]),.8);
 assert.equal(siurb.items[0].description,'Alvenaria ajustada');
 const sinapi=buildCatalogImport(lines,{source:'sinapi',month:'2026-09',mapping,existing});
 assert.equal(sinapi.items[0].code,'SINAPI:100');
 assert.equal(sinapi.items[0].directCost,null);
});
test('editar importado sem perder identidade e referenciar SIURB no orcamento da empresa',()=>{
 const imported={id:'22222222-2222-4222-8222-222222222222',code:'SIURB:A100',
  source:'siurb',category:'SIURB',description:'Quadro',unit:'un',sinapiCode:'A100',
  referenceMonth:'2026-07',roles:[],directCost:null};
 const configured=validateCatalogRecord({description:'Quadro',unit:'un',
  coefficients:'Eletricista; 3,5\nAjudante; 1,5',directCost:'35'},imported,imported.id);
 assert.equal(catalogHours(configured),5);
 assert.equal(configured.directCost,35);
 assert.equal(catalogReady(configured),true);
 const item=validateBudgetItem({...catalogToBudgetItem(configured,'i1'),quantity:2});
 assert.equal(item.reference.system,'SIURB');
 assert.equal(item.reference.code,'A100');
 assert.equal(item.laborHours,5);
 const pricing={monthlyCostCents:1600000,productiveHours:320,productiveDays:20,
  hoursPerDay:8,productivePeople:2,taxPct:10,marginPct:20,companyName:'CIVOLTEN',capturedOn:'2026-11-08'};
 const priced=priceBudget(validateBudget({id:'b1',title:'Instalacao',customer:'Cliente',
  demo:false,items:[item],pricing,commercial:{}}));
 assert.equal(priced.totalHours,10);
 assert.equal(priced.rows[0].labor,50000);
 assert.equal(priced.rows[0].materials,7000);
});
test('planilha sem coeficiente nao ganha HH presumida; entrada incorreta falha fechada',()=>{
 const rows=parseDelimited('codigo;descricao;unidade;preco\n100;Piso;m²;99,00');
 const mapping={code:0,description:1,unit:2,role:-1,hours:-1,category:-1};
 const result=buildCatalogImport(rows,{source:'sinapi',month:'2026-10',mapping});
 assert.equal(catalogHours(result.items[0]),null);
 assert.equal(result.items[0].directCost,null);
 assert.throws(()=>buildCatalogImport(rows,{source:'siurb',month:'',mapping}),/competencia/);
 assert.throws(()=>buildCatalogImport(rows,{source:'sinapi',month:'2026-10',mapping:{code:0,description:-1,unit:2}}),/colunas/);
});
