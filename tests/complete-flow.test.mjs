import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {estimateBudget} from '../src/estimate-engine.mjs';
import {buildWorkSchedule} from '../src/schedule-engine.mjs';
import {renderProposalPdf} from '../src/proposal-pdf.mjs';

const costs=JSON.parse(readFileSync(new URL('../public/data/siurb-2026-07.json',import.meta.url),'utf8')).items;
const compositions=JSON.parse(readFileSync(new URL('../public/data/siurb-compositions-2026-07.json',import.meta.url),'utf8')).items;
test('Fluxo integrado: SIURB → custos/BDI → produtividade → prazo → PDF versionado',async()=>{
 const item=costs.find(x=>x.code==='1001001'&&x.category==='Edificações'&&x.regime==='Sem desoneração');
 const comp=compositions.find(x=>x.code===item.code&&x.category===item.category&&x.regime===item.regime);
 assert.ok(item&&comp&&comp.direct_hh_per_unit>0);
 assert.ok(comp.other.some(x=>x.code==='94061'),'Equipamento não pode entrar no coeficiente de trabalhadores');
 const quote=estimateBudget({
  reference_month:'2026-07',regime:'Sem desoneração',
  items:[{code:item.code,description:item.description,unit:item.unit,quantity:1000,unit_cost:item.cost,source:'SIURB',
    reference_month:item.reference_month,regime:item.regime,quantity_verified:true,composition_reviewed:true,reference_price_id:'00000000-0000-4000-8000-000000000001'}],
  bdi:{administracaoCentral:4,seguro:0,garantia:0,risco:1,despesasFinanceiras:1,lucro:6,tributosSobreReceita:7},
  contingency_pct:0,bdi_reviewed:true,technical_reviewed:true,commercial_reviewed:true
 });
 assert.equal(quote.ready,true);
 assert.equal(quote.direct_cost_reais,1810);
 assert.ok(quote.total_reais>quote.direct_cost_reais);
 const plan=buildWorkSchedule({start_date:'2026-11-03',work_days_week:5,holidays:['2026-11-20'],
  safety_pct:20,teams:[{id:'equipe-qa',workers:2,hours_day:8,efficiency:0.8}],
  tasks:[{id:'A',title:item.description,crew_id:'equipe-qa',quantity:1000,hh_per_unit:comp.direct_hh_per_unit,depends_on:[]}]});
 assert.equal(plan.ready,true);
 assert.ok(plan.total_workdays>=1);
 const snapshot={
  code:'PROP-QA-2026-0001',version:1,issued_on:'2026-10-29',
  review:{technical:true,commercial:true,costs:true,scope:true,payment:true,schedule:true},
  company:{name:'CIVOLTEN TESTES',tax_id:'11.222.333/0001-81'},
  client:{name:'CLIENTE FICTÍCIO',tax_id:'529.982.247-25'},
  project:{name:'Obra QA',address:'Rua Fictícia 100, São Paulo'},
  scope:'Execução técnica de teste com medição revisada, equipamentos verificados e composições auditadas.',
  exclusions:'Fora do escopo: serviços não previstos, acessos adicionais e projetos complementares.',
  validity_days:30,payment_terms:'50% na contratação e 50% após medição',
  execution_term:plan.total_workdays+' dias úteis, com margem explícita',
  items:[{code:item.code,description:item.description,quantity:1000,unit:item.unit,unit_cost:item.cost}],
  bdi_amount:quote.bdi_amount_reais,contingency_amount:quote.contingency_reais,total:quote.total_reais
 };
 snapshot.snapshot_sha256=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const result=await renderProposalPdf(snapshot);
 assert.equal(result.subarray(0,5).toString(),'%PDF-');
 assert.ok((await PDFDocument.load(result)).getPageCount()>=1);
});
test('Fluxo não pode avançar com coeficiente de produtividade ausente',()=>{
 const plan=buildWorkSchedule({start_date:'2026-11-03',teams:[{id:'eletrica',workers:2,hours_day:8,efficiency:0.85}],
  tasks:[{id:'1',title:'Item sem composição verificada',crew_id:'eletrica',quantity:100,hh_per_unit:null}]});
 assert.equal(plan.ready,false);
 assert.equal(plan.finish,null);
});
