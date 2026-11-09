import test from 'node:test';
import assert from 'node:assert/strict';
import {filterBudgetCatalog,budgetCatalogResults} from '../src/budget-ui.mjs';

const catalog=Array.from({length:2617},(_,i)=>({
 code:'SIURB:'+String(100000+i),sinapiCode:String(100000+i),
 source:'siurb',category:'EDIF',description:'Servico de edificacoes '+i,
 unit:i%2?'m²':'m³'
}));
catalog[2500].description='DEMOLIÇÃO MECANIZADA DE CONCRETO';
catalog[2511].description='Instalação de cabo elétrico';

test('busca atinge todos os 2617 servicos salvos, mesmo fora dos 60 exibidos',()=>{
 assert.equal(filterBudgetCatalog(catalog).length,2617);
 const byCode=filterBudgetCatalog(catalog,'SIURB:102500');
 assert.equal(byCode.length,1);
 assert.match(byCode[0].description,/DEMOLIÇÃO/);
 assert.equal(filterBudgetCatalog(catalog,'demolicao mecanizada').length,1);
 assert.equal(filterBudgetCatalog(catalog,'INSTALACAO').length,1);
 assert.equal(filterBudgetCatalog(catalog,'m²').length>0,true);
 assert.equal(filterBudgetCatalog(catalog,'servico que nao existe').length,0);
 const html=budgetCatalogResults(catalog);
 assert.match(html,/Exibindo 60 de 2617/);
 assert.equal((html.match(/data-action="budget-choose-service"/g)||[]).length,60);
 assert.doesNotMatch(html,/Servico de edificacoes 2616/,'resultado distante fica fora da lista inicial');
 assert.equal(filterBudgetCatalog(catalog,'SIURB:102616').length,1);
 const results=budgetCatalogResults(catalog,'demolicao');
 assert.equal((results.match(/data-action="budget-choose-service"/g)||[]).length,1);
 assert.match(results,/DEMOLIÇÃO MECANIZADA DE CONCRETO/);
});
test('pesquisa e resultados escapam codigo e descricao sem executar HTML',()=>{
 const html=budgetCatalogResults([{code:'SIURB:1" onclick="alert(1)',
  source:'siurb',sinapiCode:'1',description:'<script>alert(1)</script>',unit:'un'}], '');
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/data-code="SIURB:1" onclick=/);
 assert.match(html,/&lt;script&gt;/);
});
