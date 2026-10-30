import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleServiceCatalog} from '../src/service-catalog-api.mjs';
import {catalogOptionHtml,catalogFormHtml,estimateServiceSubtotal,fmtServicePrice}
 from '../public/secure-service-picker.js';
const bid='00000000-0000-4000-8000-000000000014',sid='00000000-0000-4000-8000-000000000015';
const known=[{id:sid,code:'10001001',description:'SERVIÇO DE PINTURA',unit:'M2',unit_cost:'30.2500',category:'Edificações',reference_month:'2026-07',regime:'Sem desoneração'}];
const budget={reference_month:'2026-07',regime:'Sem desoneração'};
const send=(res,status,data)=>{res.statusCode=status;res.result=data};
async function request(path,{method='GET',rows=known,budgetRows=[budget],total=1}={}){
 const calls=[],res={};
 const sql={query:async(q,values)=>{
   calls.push({q,values});
   if(q.startsWith('SELECT reference_month,regime FROM budgets'))return budgetRows;
   if(q.startsWith('SELECT count(*)'))return [{total}];
   if(q.includes('SELECT p.id,p.code,p.description'))return rows;
   throw Error('SQL inesperado: '+q.slice(0,80));
 }};
 const done=await handleServiceCatalog({req:{url:path},res,sql,parts:['services','search'],method,send});
 return {done,code:res.statusCode,body:res.result,calls};
}
test('Catálogo consulta todas as categorias com busca vazia e paginação',async()=>{
 const x=await request('/api/v1/services/search?budget_id='+bid);
 assert.equal(x.done,true);assert.equal(x.code,200);
 assert.equal(x.body.source,'SIURB');assert.equal(x.body.total,1);
 assert.equal(x.body.reference_month,'2026-07');
 assert.deepEqual(x.body.items,known);
 assert.equal(x.calls[1].values[0],'2026-07');
 assert.equal(x.calls[1].values[1],'Sem desoneração');
 assert.equal(x.calls[1].values[2],null);
 assert.equal(x.calls[1].values[3],'%%');
 assert.match(x.calls[1].q,/reference_prices/);
 assert.match(x.calls[1].q,/LIMIT \$6::int OFFSET \$7::int/);
 assert.ok(!x.calls[1].q.includes(bid),'ID de orçamento deve ser parâmetro, não interpolado');
});
test('Pesquisa aceita nome, filtra categoria e informa mais resultados',async()=>{
 const url='/api/v1/services/search?budget_id='+bid+'&q=pintura&category=Edifica%C3%A7%C3%B5es&offset=25&limit=25';
 const x=await request(url,{total:80});
 assert.equal(x.code,200);assert.equal(x.body.has_more,true);
 assert.equal(x.calls[1].values[2],'Edificações');
 assert.equal(x.calls[1].values[3],'%pintura%');
 assert.equal(x.calls[1].values[5],25);
 assert.equal(x.calls[1].values[6],25);
});
test('Paginação, categoria e UUID inválidos são recusados sem ler o catálogo',async()=>{
 for(const url of [
  '/api/v1/services/search?budget_id=bad',
  '/api/v1/services/search?budget_id='+bid+'&offset=-2',
  '/api/v1/services/search?budget_id='+bid+'&limit=60',
  '/api/v1/services/search?budget_id='+bid+'&category=SemSentido']){
  const x=await request(url);assert.equal(x.code,400);
  assert.ok(!x.calls.some(c=>c.q.includes('SELECT p.id,p.code')));}
});
test('Orçamento ausente resulta 404, não expõe serviços de outro orçamento',async()=>{
 const x=await request('/api/v1/services/search?budget_id='+bid,{budgetRows:[]});
 assert.equal(x.code,404);assert.equal(x.calls.length,1);
});
test('Somente GET retorna catálogo',async()=>{
 const x=await request('/api/v1/services/search?budget_id='+bid,{method:'POST'});
 assert.equal(x.code,405);assert.equal(x.calls.length,0);
});
test('Busca ignora caracteres curingas de ILIKE',async()=>{
 const x=await request('/api/v1/services/search?budget_id='+bid+'&q=%25_');
 assert.equal(x.code,200);assert.equal(x.calls[1].values[3],'%%');
});
test('HTML do catálogo mostra nome, código, unidade, preço e protege texto externo',()=>{
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const s=catalogOptionHtml({...known[0],description:'Pintura <script>'},esc);
 assert.match(s,/10001001/);assert.match(s,/M2/);
 assert.match(s,/30,25/);assert.doesNotMatch(s,/<script>/);assert.match(s,/&lt;script&gt;/);
});
test('Formulário preenche campos oficiais como leitura e permite quantidade e serviço próprio',()=>{
 const field=(label,name,type,required,value,extra)=>'<input name="'+name+'" type="'+type+'" '+(extra||'')+'>';
 const s=catalogFormHtml({field,esc:x=>String(x),state:{detail:{reference_month:'2026-07',regime:'Sem desoneração',items:[]}}});
 assert.match(s,/name="reference_price_id"/);
 assert.match(s,/id="catalog-name"/);
 assert.match(s,/readonly/);
 assert.match(s,/id="catalog-manual"/);
 assert.match(s,/id="service-options"/);
 assert.match(s,/name="quantity"/);
 assert.match(s,/name="position"/);
});
test('Subtotal de serviço é quantidade vezes unitário sem aplicar BDI indevidamente',()=>{
 assert.equal(estimateServiceSubtotal('2.5','30.25'),75.625);
 assert.equal(estimateServiceSubtotal(-1,20),null);
 assert.equal(estimateServiceSubtotal('NaN',20),null);
 assert.match(fmtServicePrice(75.625),/75,63/);
});
test('UI e API garantem criação oficial e preservam referência ao editar quantidade',()=>{
 const frontend=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 const cost=readFileSync(new URL('../src/costing-api.mjs',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.mjs',import.meta.url),'utf8');
 assert.match(frontend,/showServiceCatalog/);
 assert.match(frontend,/catalog-item-form/);
 assert.match(frontend,/catalog-edit-form/);
 assert.match(frontend,/reference_price_id:b.reference_price_id/);
 assert.match(cost,/sub==='siurb-items'&&method==='PUT'/);
 assert.match(cost,/SET position=\$3,quantity=\$5/);
 assert.match(cost,/quantity_verified=false,composition_reviewed=false/);
 assert.match(api,/handleServiceCatalog/);
 assert.match(api,/reference_price_id IS NULL AND EXISTS/);
});
