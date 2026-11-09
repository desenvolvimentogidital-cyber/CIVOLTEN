import test from 'node:test';
import assert from 'node:assert/strict';
import {workPrintable,splitWorkOrderServices} from '../src/work-order-print.mjs';

function order(n=1){
 return {id:'11111111-1111-4111-8111-111111111111',
  contractRef:'OS-2026-6FC50FC4',
  customer:'Larissa',project:'Reformas',
  acceptanceRef:'Aceite eletrônico CIVOLTEN nº 8c9d0f4f-a613-4a07-9160-52bb451889f6 por Cristiano Alessandro (nome@cliente.com)',
  approvedOn:'2026-11-09',startOn:'2026-11-10',
  contractValue:35916,status:'in_progress',
  budgetSnapshot:{commercial:{laborOnly:true},
   items:Array.from({length:n},(_,i)=>({
    id:String(i),description:i?'Serviço elétrico de infraestrutura '+i:
     'ALVENARIA EM BLOCO CERÂMICO COMUM - 19CM',unit:i?'m':'M2',quantity:i?22:150,
    laborHours:1.78,directCost:0
   }))},
  pricedRows:[{id:'0',selling:3591600,cost:10000}]};
}
test('Modelo 3: logo, símbolo, dados reais, tabela e assinaturas, sem valores',()=>{
 const html=workPrintable(order());
 for(const token of [
  '/assets/civolten-logo.png','/assets/civolten-simbolo.png',
  'CIVOLTEN — ORDEM DE SERVIÇO','Prestação exclusivamente de mão de obra',
  'OS-2026-6FC50FC4','Larissa','Reformas','ACEITE INFORMADO',
  'Cristiano Alessandro','09/11/2026','10/11/2026',
  'ALVENARIA EM BLOCO CERÂMICO COMUM - 19CM',
  'SERVIÇO','UNIDADE','QUANTIDADE','150',
  'Materiais e insumos','Representante da CIVOLTEN','Cliente / Contratante',
  'Documento gerencial para conferência'
 ])assert.ok(html.includes(token),'Campo ou identidade ausente: '+token);
 assert.match(html,/data-work-pdf-page="1"/);
 assert.equal((html.match(/data-work-pdf-page=/g)||[]).length,1);
 assert.doesNotMatch(html,/R\$|Valor contratado|35\.916|35916|selling|contractValue|price|Preço do serviço|preço por item/i,
  'Ordem operacional nunca deve divulgar os preços da proposta ou gestão');
});
test('Não muda o contrato nem apresenta valores mesmo se armazenados nas linhas',()=>{
 const original=order(3),before=structuredClone(original);
 const html=workPrintable(original);
 assert.deepEqual(original,before,'Imprimir não pode reprecificar nem alterar OS');
 assert.doesNotMatch(html,/R\$|35\.916|35916|selling/i);
 assert.equal((html.match(/<tbody>/g)||[]).length,1);
 assert.equal((html.match(/<tr><td>/g)||[]).length,3);
});
test('Dá continuidade em múltiplas folhas sem omitir serviços longos',()=>{
 const w=order(27);
 w.budgetSnapshot.items[13].description='INSTALAÇÃO E EXECUÇÃO DE INFRAESTRUTURA COMPLEXA DE CONSTRUÇÃO CIVIL E ELÉTRICA COM ACESSO AO SUBSOLO E PREPARAÇÃO DE ALVENARIA PARA REFORMA RESIDENCIAL';
 const groups=splitWorkOrderServices(w.budgetSnapshot.items);
 assert.ok(groups.length>=3);
 assert.deepEqual(groups.flat().map(x=>x.id),w.budgetSnapshot.items.map(x=>x.id));
 const html=workPrintable(w);
 assert.equal((html.match(/data-work-pdf-page=/g)||[]).length,groups.length);
 assert.equal((html.match(/<tr><td>/g)||[]).length,27);
 assert.equal((html.match(/work-pdf-signatures/g)||[]).length,1);
 assert.equal((html.match(/work-pdf-notes/g)||[]).length,1);
 assert.doesNotMatch(html,/Valor contratado|R\$/);
});
test('Dados fornecidos pelo cliente são escapados em HTML impresso',()=>{
 const w=order(),evil='<img src=x onerror=alert(1)>';
 w.customer=evil;w.budgetSnapshot.items[0].description=evil;
 const html=workPrintable(w);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.match(html,/&lt;img/);
 assert.throws(()=>workPrintable({}),/não possui serviços/);
});
