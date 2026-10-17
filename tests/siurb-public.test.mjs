import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../supabase/functions/civolten-beta/public-siurb.ts',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(src.replace(/^export /gm,'')+
 '\nglobalThis.utils={isPublicReferenceId,publicReferenceItem,publicReferenceSearch,publicReferencePage,referencePricingServices,isWholeUnit,laborCostFromInputs,selectedMode};',context);
const {isPublicReferenceId,publicReferenceItem,publicReferenceSearch,referencePricingServices,isWholeUnit,laborCostFromInputs,selectedMode}=context.utils;
const sample={source:'EDIF',code:'9003070',description:'Cabo flexível isolado 750 V',unit:'M',unit_cost:7.04,
 inputs:[
  {code:'2041',description:'Eletricista (SGSP)',unit:'H',partial_cost:1.1145},
  {code:'2099',description:'Servente (SGSP)',unit:'H',partial_cost:.7703},
  {code:'52910',description:'Cabo isolado',unit:'M',partial_cost:5.151},
  {code:'94010',description:'Máquina de corte',unit:'H',partial_cost:1.95}
 ]};
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


test('modalidade aceita apenas mão de obra e serviço completo, sendo completo o padrão legado',()=>{
 assert.equal(selectedMode({servico_id:'siurb:EDIF:9003070'}),'completo');
 assert.equal(selectedMode({modalidade:'mao_obra'}),'mao_obra');
 assert.equal(selectedMode({modalidade:'completo'}),'completo');
 assert.throws(()=>selectedMode({modalidade:'materiais'}));
 assert.throws(()=>selectedMode({modalidade:'gratuito'}));
});

test('mão de obra identifica profissionais pelo código e unidade H, sem materiais e máquinas',()=>{
 const cost=laborCostFromInputs(sample.inputs);
 assert.equal(cost,1.88);
 assert.equal(laborCostFromInputs([{code:'94010',unit:'H',partial_cost:4},{code:'52910',unit:'M',partial_cost:5}]),0);
 assert.equal(laborCostFromInputs([
  {code:'2020',unit:'H',partial_cost:18.5102},
  {code:'2099',unit:'H',partial_cost:14.8929},
  {code:'10562',unit:'Kg',partial_cost:8.82}
 ]),33.40);
});
test('modalidades conservam valor completo e dão preço de mão de obra separado',async()=>{
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({in:async()=>({data:[sample],error:null})})})})})};
 const [svc]=await referencePricingServices(db,[{servico_id:'siurb:EDIF:9003070',modalidade:'mao_obra'}],{margem_minima_alvo:.2});
 assert.equal(svc.medio,8.8,'Custo completo tem de permanecer igual ao preço anterior');
 assert.equal(svc.labor_prices.medio,2.35,'Somente mão de obra sem equipamento e cabo');
 assert.ok(svc.labor_prices.medio<svc.medio);
});
test('serviço sem profissional identificado não inventa custo de mão de obra',async()=>{
 const noWorker={...sample,inputs:[{code:'52910',unit:'M',partial_cost:7.04}]};
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({in:async()=>({data:[noWorker],error:null})})})})})};
 const [svc]=await referencePricingServices(db,[{servico_id:'siurb:EDIF:9003070'}],{margem_minima_alvo:.2});
 assert.equal(svc.labor_prices,null);
 assert.equal(svc.medio,8.8);
});
test('interface permite somente duas modalidades e as envia na simulação',()=>{
 const script=readFileSync(new URL('../assets/civolten.js',import.meta.url),'utf8');
 assert.match(script,/Somente mão de obra/);
 assert.match(script,/Serviço completo \(mão de obra \+ materiais\)/);
 assert.match(script,/modalidade:row\._modeSelect/);
 assert.match(script,/if\(!hasComposition\)modeSelect\.value='completo'/);
 assert.doesNotMatch(script,/Somente materiais|Somente material/);
});


test('motor real da simulação aplica modalidade correta e guarda descrição do serviço',async()=>{
 const edge=readFileSync(new URL('../supabase/functions/civolten-beta/index.ts',import.meta.url),'utf8');
 const from=edge.indexOf('function calc('),to=edge.indexOf('function publicQuote(');
 assert.ok(from>0&&to>from);
 const calcCtx=vm.createContext({
  num:(v,min=0,max=1e8)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('Número inválido');return v;},
  cents:n=>Math.round(n*100),money:n=>Number((n/100).toFixed(2)),
  selectedMode,isPublicReferenceId
 });
 vm.runInContext(edge.slice(from,to)+'\nglobalThis.calc=calc;',calcCtx);
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({in:async()=>({data:[sample],error:null})})})})})};
 const [service]=await referencePricingServices(db,[{servico_id:'siurb:EDIF:9003070'}],{margem_minima_alvo:.2});
 const conf={
  limiar_soma_medidas:0,logistica_diaria_obra_pequena:0,limite_distancia_km:15,
  sobretaxa_distancia_sobre_servicos:0,pro_labore_mensal:0,
  despesas_operacionais_mensais:0,dias_produtivos_mes:22,imposto_sobre_valor_final:0
 };
 const complete=calcCtx.calc([{servico_id:service.service_id,quantidade:1,modalidade:'completo'}],'medio',1,0,[service],conf);
 const labor=calcCtx.calc([{servico_id:service.service_id,quantidade:1,modalidade:'mao_obra'}],'medio',1,0,[service],conf);
 assert.equal(complete.total_bruto,8.8);
 assert.equal(labor.total_bruto,2.35);
 assert.match(complete.itens[0].descricao,/Serviço completo/);
 assert.match(labor.itens[0].descricao,/Somente mão de obra/);
 assert.equal(labor.itens[0].modalidade,'mao_obra');
 const noWorker={...service,labor_prices:null};
 assert.throws(()=>calcCtx.calc([{servico_id:service.service_id,quantidade:1,modalidade:'mao_obra'}],'medio',1,0,[noWorker],conf),/PRECIFICACAO_PENDENTE/);
 assert.throws(()=>calcCtx.calc([{servico_id:'legado',quantidade:1,modalidade:'mao_obra'}],'medio',1,0,[{service_id:'legado',medio:10,unit:'unidade',description:'Legado'}],conf),/PRECIFICACAO_PENDENTE/);
});
