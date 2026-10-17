import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../supabase/functions/civolten-beta/public-siurb.ts',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(src.replace(/^export /gm,'')+
 '\nglobalThis.utils={isPublicReferenceId,publicReferenceItem,publicReferenceSearch,publicReferencePage,referencePricingServices,isWholeUnit};',context);
const {isPublicReferenceId,publicReferenceItem,publicReferenceSearch,referencePricingServices,isWholeUnit}=context.utils;
const sample={source:'EDIF',code:'9003070',description:'Cabo flexível isolado 750 V',unit:'M',unit_cost:7.04};
test('código composto de referência identifica serviços sem colidir com o catálogo original',()=>{
 assert.ok(isPublicReferenceId('siurb:EDIF:9003070'));
 assert.ok(isPublicReferenceId('siurb:INFRA:10001001'));
 for(const x of ['9003070','siurb:SINAPI:9003070','siurb:EDIF:x','siurb:EDIF:9003070%20'])assert.equal(isPublicReferenceId(x),false);
});
test('busca pública não inclui custo-base nem insumos',async()=>{
 const first={select:()=>first,eq:()=>first,or:()=>first,order:()=>first,limit:()=>Promise.resolve({data:[{...sample,inputs:[{unit_cost:50}]}],error:null})};
 const result=await publicReferenceSearch({db:{from:()=>first},query:'cabo'});
 assert.equal(result.length,1);
 const item=result[0];
 assert.equal(item.id,'siurb:EDIF:9003070');
 assert.equal(item.unidade,'M');
 assert.equal(Object.hasOwn(item,'unit_cost'),false);
 assert.equal(Object.hasOwn(item,'inputs'),false);
 assert.equal(Object.hasOwn(item,'preco_unitario'),false);
});
test('busca pública limita termos e evita consultas sem descrição',async()=>{
 let calls=0;
 const r=await publicReferenceSearch({db:{from:()=>{calls++;throw Error('unexpected')}},query:'x'});
 assert.equal(r.length,0);assert.equal(calls,0);
});
test('cálculo do servidor usa custo somente internamente, adiciona margem e mantém unidade',async()=>{
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({in:async()=>({data:[sample],error:null})})})})})};
 const services=await referencePricingServices(db,[{servico_id:'siurb:EDIF:9003070',quantidade:12}],{margem_minima_alvo:.2});
 assert.equal(services.length,1);
 const s=services[0];
 assert.equal(s.service_id,'siurb:EDIF:9003070');
 assert.equal(s.medio,8.8);
 assert.equal(s.description,'[EDIF 9003070] Cabo flexível isolado 750 V');
 assert.ok(s.baixo<s.medio&&s.medio<s.alto);
 assert.equal(s.unit,'M');
});
test('unidades discretas mantêm quantidade inteira',()=>{
 assert.equal(publicReferenceItem({...sample,unit:'UN'}).unidade,'unidade');
 assert.equal(isWholeUnit('CJ'),true);
 assert.equal(isWholeUnit('M²'),false);
});
test('pesquisa pública não acrescenta custos ao JavaScript do visitante',()=>{
 const client=readFileSync(new URL('../assets/civolten.js',import.meta.url),'utf8');
 assert.match(client,/api=siurb-list/);
 assert.doesNotMatch(client,/api=siurb-search|siurbPublicResults/);
 assert.doesNotMatch(client,/unit_cost|partial_cost|coefficient/);
});

test('listagem paginada retorna todos os nomes sem expor custos',async()=>{
 let requestedRange;
 const builder={
  select:()=>builder,eq:()=>builder,order:()=>builder,
  range:async(a,b)=>{
   requestedRange=[a,b];
   return {data:[sample],error:null,count:3463};
  }
 };
 const {publicReferencePage}=context.utils;
 const result=await publicReferencePage({db:{from:()=>builder},offset:800,size:400});
 assert.equal(result.total,3463);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].id,'siurb:EDIF:9003070');
 assert.equal(Object.hasOwn(result.items[0],'unit_cost'),false);
 assert.equal(Object.hasOwn(result.items[0],'inputs'),false);
 assert.equal(requestedRange[0],800);
 assert.equal(requestedRange[1],1199);
 await assert.rejects(()=>publicReferencePage({db:{from:()=>builder},offset:-1}));
});
test('formulário público carrega composições em lotes e agrupa EDIF e INFRA no mesmo campo',()=>{
 const src=readFileSync(new URL('../assets/civolten.js',import.meta.url),'utf8');
 assert.match(src,/api=siurb-list/);
 assert.match(src,/document\.createElement\('optgroup'\)/);
 assert.match(src,/EDIF — Edificações/);
 assert.match(src,/INFRA — Infraestrutura/);
 assert.match(src,/async function loadSiurbCatalog/);
});
