// Modelo de contrato de obra certa baseado no documento de referência enviado.
// Não copia nomes, documentos pessoais, valores nem assinaturas do contrato original.
import {e} from './views.mjs';
const val=(v)=>e(String(v??'').trim()||'________________________');
const date=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'____/____/________';
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function printableServiceContract(order,company={}){
 if(!order?.budgetSnapshot?.items?.length||!(Number(order.contractValue)>0))
  throw Error('Abra uma obra aprovada com serviços e valor contratual.');
 const items=order.budgetSnapshot.items;
 const scope=items.map(i=>'<li>'+val(i.description)+' — '+val(i.quantity)+' '+val(i.unit)+'</li>').join('');
 const companyName=company.legalName||company.name||'CIVOLTEN';
 return '<style id="cv-contract-print-css">@media screen{#work-print-root{position:fixed;inset:0;z-index:9999;background:#fff;overflow:auto;padding:20px;color:#111}}'+
 '@media print{body>*:not(#work-print-root){display:none!important}#work-print-root{display:block!important;position:static!important;background:white!important;color:black!important}'+
 '@page{size:A4;margin:18mm 16mm}}'+
 '#work-print-root .cv-contract{font:12px/1.5 Arial,sans-serif;color:#111;max-width:800px;margin:auto}'+
 '#work-print-root .cv-contract h1{text-align:center;font-size:18px}#work-print-root .cv-contract h2{font-size:13px;margin:17px 0 5px}'+
 '#work-print-root .cv-contract p{text-align:justify;margin:7px 0}#work-print-root .cv-contract li{margin:3px 0}'+
 '#work-print-root .cv-contract .cv-signatures{display:flex;gap:25px;margin-top:65px}'+
 '#work-print-root .cv-contract .cv-signatures div{flex:1;border-top:1px solid #333;text-align:center;padding-top:8px}'+
 '#work-print-root .cv-contract .cv-warning{border:1px solid #aaa;padding:10px;margin-bottom:18px}'+
 '@media print{#work-print-root .cv-contract .cv-warning{display:none}}'+
 '</style><article class="cv-contract">'+
 '<div class="cv-warning"><b>MINUTA PARA CONFERÊNCIA:</b> complete qualificação, local, prazo, pagamentos e responsabilidades antes de assinar. Revisão jurídica recomendada. Não representa contrato assinado.</div>'+
 '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE OBRA CERTA</h1>'+
 '<p><b>CONTRATANTE:</b> '+val(order.customer)+' — CNPJ/CPF: '+val(order.customerRef?.document)+'. Endereço: ________________________.</p>'+
 '<p><b>CONTRATADO:</b> '+val(companyName)+' — CNPJ/CPF: '+val(company.cnpj||company.document)+'. Endereço: ________________________.</p>'+
 '<h2>1 – OBJETO DA PRESTAÇÃO DE SERVIÇOS</h2>'+
 '<p>Prestação dos serviços descritos na proposta comercial aprovada, vinculada à ordem de serviço nº <b>'+val(order.contractRef)+'</b>, integrante deste contrato:</p><ol>'+scope+'</ol>'+
 '<p>Obra/projeto: '+val(order.project)+'. Local de execução: ________________________.</p>'+
 '<h2>2 – VALOR E CONDIÇÕES DE PAGAMENTO</h2>'+
 '<p>Valor total contratado: <b>'+money(order.contractValue)+'</b>. Condições e vencimentos: ________________________. Descontos ou retenções somente conforme a legislação e acordo escrito entre as partes.</p>'+
 '<h2>3 – LOCAL DA PRESTAÇÃO DOS SERVIÇOS</h2>'+
 '<p>Os serviços serão prestados no endereço da obra indicado pelas partes, respeitadas as regras de acesso e segurança aplicáveis.</p>'+
 '<h2>4 – PRAZO DE EXECUÇÃO</h2>'+
 '<p>Início previsto: '+date(order.startOn)+'. Prazo de execução: ______ dias. O cronograma aprovado integra este contrato. Interrupções determinadas pelo contratante, inadimplemento impeditivo ou força maior poderão justificar prorrogação proporcional, formalizada por escrito.</p>'+
 '<h2>5 – OBRIGAÇÕES DO CONTRATANTE</h2>'+
 '<p>Disponibilizar os materiais necessários ao escopo contratado, quando previsto na proposta; prestar informações; assegurar acesso ao local e efetuar os pagamentos ajustados.</p>'+
 '<h2>6 – OBRIGAÇÕES DO CONTRATADO</h2>'+
 '<p>Executar os serviços com qualidade técnica, zelo e observância das normas de segurança; cumprir o cronograma; empregar profissionais habilitados quando exigido; respeitar regras do local; manter a organização e destinação adequada dos resíduos sob sua responsabilidade.</p>'+
 '<p>Subcontratações, fornecimento de equipamentos especiais e responsabilidades trabalhistas, previdenciárias e securitárias deverão observar a legislação e os ajustes escritos. A natureza da relação será determinada pelas condições efetivas de execução, não apenas por declaração contratual.</p>'+
 '<h2>7 – RESCISÃO E PENALIDADES</h2>'+
 '<p>O descumprimento contratual poderá ensejar rescisão, observadas a notificação, oportunidade de regularização quando cabível e a legislação aplicável. Multa rescisória, se pactuada: ______% sobre a base ________________________. Perdas e danos dependerão de comprovação e limites legais.</p>'+
 '<h2>8 – DISPOSIÇÕES FINAIS E FORO</h2>'+
 '<p>Alterações de escopo, prazo e valor deverão ser registradas por escrito. Foro competente: ________________________, ressalvadas as regras legais de competência obrigatória.</p>'+
 '<p>Local e data: ________________________, ____/____/________.</p>'+
 '<div class="cv-signatures"><div>CONTRATANTE<br>'+val(order.customer)+'</div><div>CONTRATADO<br>'+val(companyName)+'</div></div>'+
 '<div class="cv-signatures"><div>TESTEMUNHA 1<br>Nome / CPF</div><div>TESTEMUNHA 2<br>Nome / CPF</div></div>'+
 '</article>';
}
