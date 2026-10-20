import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('supabase/functions/civolten-beta/sinapi-reference.ts');
const ctx=vm.createContext({URL,Number,Set,Map});
vm.runInContext(source.replace(/^export /gm,'')+
 '\nglobalThis.funcs={normalizeSinapiBatch,isSinapiId,sinapiAdmin,sinapiPage,sinapiPricingServices};',ctx);
const {normalizeSinapiBatch,isSinapiId,sinapiAdmin,sinapiPage,sinapiPricingServices}=ctx.funcs;
const data=(items=[{code:'123456',description:'Serviço completo de parede',unit:'M2',cost:null}])=>({
 schema:'civolten.sinapi.v1',uf:'SP',period:'2026-09',regime:'sem_desoneracao',items
});
test('SINAPI incompleto aceita composição mas não finge preço zero',()=>{
 const list=normalizeSinapiBatch(data());
 assert.equal(list.length,1);
 assert.equal(list[0].unit_cost,null);
 assert.equal(list[0].price_verified,false);
 assert.equal(isSinapiId('sinapi:SP:123456'),true);
 assert.equal(isSinapiId('siurb:EDIF:123456'),false);
});
test('custos SINAPI positivos precisam de origem e verificação',()=>{
 const raw={code:'123456',description:'Serviço completo de parede',unit:'M2',cost:75.91};
 assert.throws(()=>normalizeSinapiBatch(data([raw])),/fonte oficial|confirmação/i);
 assert.throws(()=>normalizeSinapiBatch(data([{...raw,price_verified:true,source_url:'https://example.com/prices'}])),/fonte oficial|confirmação/i);
 const items=normalizeSinapiBatch(data([{...raw,price_verified:true,source_url:'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx'}]));
 assert.equal(items[0].unit_cost,75.91);
 assert.equal(items[0].price_verified,true);
 assert.throws(()=>normalizeSinapiBatch(data([{...raw,cost:-8}])),/Custo SINAPI inválido/i);
});
test('nunca aceitar base misturada ou arquivo sem competência',()=>{
 for(const changes of [{uf:'RJ'},{period:'2026-13'},{regime:'desconhecido'},{schema:'siurb.v1'}]){
  assert.throws(()=>normalizeSinapiBatch({...data(),...changes}));
 }
 assert.throws(()=>normalizeSinapiBatch(data(Array(31).fill(data().items[0]))));
});
test('administração mostra diferença só com unidade, mês, encargos, preço e escopo compatíveis',async()=>{
 const records={
  siurb_reference_services:{description:'PAREDE SIMILAR',unit:'M2',unit_cost:100,base_month:'2026-07',regime:'com_desoneracao'},
  sinapi_reference_services:{description:'PAREDE COM MESMO ESCOPO',unit:'M2',unit_cost:95,price_verified:true,
   source_url:'https://www.caixa.gov.br/SINAPI',base_month:'2026-09',regime:'sem_desoneracao'}
 };
 const db={from:table=>{
  const query={select(){return this},eq(){return this},maybeSingle:async()=>({data:records[table],error:null})};
  return query;
 }};
 const url=new URL('https://local.invalid/?siurb_source=EDIF&siurb_code=123456&sinapi_code=234567&month=2026-09&regime=sem_desoneracao&scope_confirmed=1');
 const result=await sinapiAdmin({api:'admin-sinapi-compare',req:{method:'GET'},url,db,out:data=>data,
  err:msg=>({error:msg})});
 assert.equal(result.comparable,false);
 assert.equal(result.lower_reference,null);
 assert.equal(result.difference,null);
 assert.match(result.reasons.join(' '),/Competências diferentes/);
 assert.match(result.reasons.join(' '),/desoneração diferentes/);
 records.sinapi_reference_services.base_month='2026-07';
 records.sinapi_reference_services.regime='com_desoneracao';
 url.searchParams.set('month','2026-07');
 url.searchParams.set('regime','com_desoneracao');
 const result2=await sinapiAdmin({api:'admin-sinapi-compare',req:{method:'GET'},url,db,out:x=>x,
  err:msg=>({error:msg})});
 assert.equal(result2.comparable,true);
 assert.equal(result2.lower_reference,'SINAPI');
 assert.equal(result2.difference,5);
 url.searchParams.set('scope_confirmed','0');
 const result3=await sinapiAdmin({api:'admin-sinapi-compare',req:{method:'GET'},url,db,out:x=>x,err:msg=>({error:msg})});
 assert.equal(result3.lower_reference,null);
 assert.match(result3.reasons.join(' '),/Escopo técnico/);
});
test('CUB-SP casa R1-N calcula custo básico, jamais preço final comercial',()=>{
 const fields={};
 function el(){
  return {value:'',textContent:'',children:[],listeners:{},
   addEventListener(name,fn){this.listeners[name]=fn},
   replaceChildren(){this.children=[]},append(...children){this.children.push(...children)}
  };
 }
 for(const id of ['projectBuildArea','cubPattern','cubRegime','cubResult'])fields[id]=el();
 fields.cubPattern.value='R1N';fields.cubRegime.value='sem_desoneracao';
 vm.runInNewContext(read('assets/civolten-cub.js'),{
  window:{location:{pathname:'/orcamento'}},
  document:{getElementById:id=>fields[id]||null,createElement:el},
  Number,Intl
 });
 fields.projectBuildArea.value='120';
 fields.projectBuildArea.listeners.input();
 assert.match(fields.cubResult.children[0].textContent,/322\.839,60/);
 assert.match(fields.cubResult.children[1].textContent,/NÃO é valor final/);
 const markup=read('orcamento.html');
 assert.match(markup,/id="cubPattern"/);
 assert.match(markup,/id="cubRegime"/);
 assert.match(markup,/id="cubResult"/);
 assert.match(markup,/civolten-cub\.js\?v=2/);
});
test('sinapi fica separado dos preços comerciais; navegação e backend possuem rotas corretas',()=>{
 const sql=read('supabase/migrations/20261020_sinapi_reference_services.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/unit_cost numeric\(14,2\) null/);
 const backend=read('supabase/functions/civolten-beta/index.ts');
 assert.match(backend,/sinapiPricingServices\(db,b\.itens,conf\)/);
 assert.match(backend,/admin-sinapi-compare/);
 assert.match(backend,/sinapi-list/);
 assert.match(read('assets/civolten.js'),/sinapi-list/);
 assert.match(read('assets/civolten-reference.js'),/CIVOLTEN_SINAPI_ADMIN/);
 assert.match(read('index.html'),/civolten-sinapi-admin\.js\?v=2/);
 assert.doesNotMatch(read('assets/civolten-sinapi-admin.js'),/localStorage|sessionStorage|\.innerHTML/);
});
