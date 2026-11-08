// Referências iniciais fornecidas pela CIVOLTEN em 08/11/2026.
// NÃO são coeficientes SINAPI verificados; a faixa representa HH totais por unidade
// do serviço/equipe, sem distribuição fictícia de HH entre funções.
// O ponto médio é usado só como estimativa inicial ajustável do cronograma.
const data=[
 ['03','Forma de madeira (montagem/desforma)','m²',1.20,1.50,'Carpinteiro + Ajudante'],
 ['03','Armação de aço (corte, dobra, montagem)','kg',0.08,0.12,'Armador + Ajudante'],
 ['03','Concretagem mecânica (lançamento/adensamento)','m³',1.50,2.00,'Pedreiro + Ajudantes'],
 ['03','Montagem de laje pré-moldada','m²',0.40,0.60,'Pedreiro + Ajudante'],
 ['04','Alvenaria de bloco cerâmico/concreto','m²',1.00,1.40,'Pedreiro + Ajudante'],
 ['04','Execução de vergas e contravergas','m',0.80,1.00,'Pedreiro + Ajudante'],
 ['05','Instalação de eletrodutos embutidos','m',0.30,0.45,'Eletricista + Ajudante'],
 ['05','Enfiação de cabos/fios','m',0.05,0.10,'Eletricista + Ajudante'],
 ['05','Montagem de quadro de distribuição (médio)','un',4.00,6.00,'Eletricista'],
 ['05','Instalação de tomadas/interruptores/luminárias','un',0.40,0.60,'Eletricista'],
 ['06','Tubulação de água fria/quente (soldável/pvc)','m',0.40,0.60,'Encanador + Ajudante'],
 ['06','Tubulação de esgoto/águas pluviais','m',0.60,0.90,'Encanador + Ajudante'],
 ['06','Teste de estanqueidade/pressão hidráulica','un',2.00,3.00,'Encanador'],
 ['07','Estrutura de madeira para telhado','m²',1.20,1.60,'Carpinteiro + Ajudante'],
 ['07','Trama de aço/calhas e rufos','m',0.80,1.20,'Calheiro'],
 ['07','Cobertura com telhas (cerâmica/fibrocimento)','m²',0.40,0.70,'Pedreiro/Telhadista + Ajudante'],
 ['07','Impermeabilização com manta asfáltica','m²',0.60,0.90,'Aplicador + Ajudante'],
 ['08','Aplicação de chapisco','m²',0.10,0.15,'Pedreiro + Ajudante'],
 ['08','Execução de reboco/emboço','m²',0.60,0.80,'Pedreiro + Ajudante'],
 ['08','Execução de contrapiso','m²',0.50,0.70,'Pedreiro + Ajudante'],
 ['08','Assentamento de piso cerâmico/porcelanato','m²',1.00,1.50,'Azulejista + Ajudante'],
 ['08','Pintura interna/externa (2 demãos + selador)','m²',0.35,0.50,'Pintor'],
 ['09','Instalação de portas (kit porta pronta)','un',2.00,3.50,'Carpinteiro/Instalador'],
 ['09','Instalação de janelas/vidros','m²',1.50,2.50,'Serralheiro/Vidraceiro'],
 ['09','Montagem de forro (gesso/PVC)','m²',0.60,0.90,'Gesseiro/Montador'],
 ['10','Limpeza pós-obra fina','m²',0.40,0.70,'Auxiliar de Limpeza'],
 ['10','Inspeção final, testes e retoques','h',1.00,1.00,'Engenheiro/Mestre de Obras']
];
export const REFERENCE_SERVICES=Object.freeze(data.map(([category,description,unit,hhMin,hhMax,team],index)=>{
 const sequence=data.slice(0,index+1).filter(x=>x[0]===category).length;
 return Object.freeze({
  code:'CV-'+category+'-'+String(100+sequence).padStart(3,'0'),
  category,description,unit,hhMin,hhMax,
  hhMid:Math.round((hhMin+hhMax)/2*100000)/100000,
  team,origin:'CIVOLTEN - referência fornecida pela empresa (não verificada no SINAPI)'
 });
}));
export function referenceService(code){
 return REFERENCE_SERVICES.find(x=>x.code===code)||null;
}
export function referenceToBudgetItem(reference,id){
 if(!reference||!id)throw Error('Serviço de referência inválido.');
 return {
  id,source:'internal',sourceCode:reference.code,description:reference.description,
  unit:reference.unit,quantity:1,laborHours:reference.hhMid,directCost:null,
  roles:[],crewComposition:reference.team,
  hhMin:reference.hhMin,hhMax:reference.hhMax,
  reference:{system:'INTERNO',code:reference.code,month:'',
   validation:'Faixa HH informada pela CIVOLTEN; estimativa inicial, revisar por obra'}
 };
}
