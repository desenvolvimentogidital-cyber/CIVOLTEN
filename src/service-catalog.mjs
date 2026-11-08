// Catálogo CIVOLTEN: serviços de construção civil e elétrica, fundação à entrega.
// Os nomes e unidades são apenas estrutura interna de trabalho, não códigos SINAPI.
// Nenhuma produtividade nem custo é presumido. Só utilizar após cadastrar coeficientes.
import {decimal} from './calc.mjs';
import {REFERENCE_SERVICES} from './productivity-reference.mjs';
const raw=[
 ['01','Preparação e terreno',[
  ['Limpeza manual do terreno','m²'],['Limpeza mecanizada do terreno','m²'],
  ['Demolição de alvenaria','m³'],['Demolição de piso e contrapiso','m²'],
  ['Retirada de revestimento','m²'],['Locação de obra com gabarito','m'],
  ['Escavação manual de vala','m³'],['Escavação mecanizada','m³'],
  ['Aterro e compactação','m³'],['Carga e transporte de solo','m³'],
  ['Regularização do terreno','m²']]],
 ['02','Fundações',[
  ['Escavação de sapata','m³'],['Lastro de concreto magro','m³'],
  ['Forma de sapata','m²'],['Armação de sapata','kg'],
  ['Concretagem de sapata','m³'],['Broca de concreto moldada no local','m'],
  ['Estaca escavada','m'],['Armação de bloco de fundação','kg'],
  ['Concretagem de bloco de fundação','m³'],['Viga baldrame - forma','m²'],
  ['Viga baldrame - armação','kg'],['Viga baldrame - concreto','m³'],
  ['Impermeabilização de baldrame','m²']]],
 ['03','Estrutura',[
  ['Forma de pilares','m²'],['Armação de pilares','kg'],['Concretagem de pilares','m³'],
  ['Forma de vigas','m²'],['Armação de vigas','kg'],['Concretagem de vigas','m³'],
  ['Forma de lajes','m²'],['Armação de lajes','kg'],['Concretagem de lajes','m³'],
  ['Montagem de laje pré-moldada','m²'],['Escoramento de laje','m²'],
  ['Desforma de elementos estruturais','m²']]],
 ['04','Alvenaria e vedações',[
  ['Alvenaria de bloco cerâmico','m²'],['Alvenaria de bloco de concreto','m²'],
  ['Alvenaria estrutural','m²'],['Execução de verga','m'],
  ['Execução de contraverga','m'],['Fixação de alvenaria','m'],
  ['Divisória de drywall','m²'],['Parede de bloco de gesso','m²'],
  ['Fechamento de shafts','m²'],['Encunhamento de alvenaria','m']]],
 ['05','Instalações elétricas e sistemas',[
  ['Rasgo em parede para eletroduto','m'],['Instalação de eletroduto embutido','m'],
  ['Instalação de eletroduto aparente','m'],['Instalação de eletrocalha','m'],
  ['Passagem de cabos elétricos','m'],['Instalação de caixa elétrica','un'],
  ['Instalação de tomada','un'],['Instalação de interruptor','un'],
  ['Instalação de luminária','un'],['Montagem de quadro de distribuição','un'],
  ['Instalação de disjuntor','un'],['Instalação de DPS','un'],
  ['Instalação de DR','un'],['Montagem de padrão de entrada','un'],
  ['Sistema de aterramento','un'],['Sistema SPDA - captores e descidas','m'],
  ['Instalação de eletrodutos enterrados','m'],['Teste de continuidade e isolamento','circuito'],
  ['Instalação de infraestrutura de dados','ponto'],['Instalação de circuito elétrico','circuito']]],
 ['06','Instalações hidrossanitárias',[
  ['Instalação de tubulação de água fria','m'],['Instalação de tubulação de água quente','m'],
  ['Instalação de tubulação de esgoto','m'],['Instalação de tubo de águas pluviais','m'],
  ['Instalação de registro hidráulico','un'],['Instalação de caixa sifonada','un'],
  ['Instalação de ralo','un'],['Instalação de vaso sanitário','un'],
  ['Instalação de lavatório','un'],['Instalação de torneira','un'],
  ['Instalação de reservatório de água','un'],['Teste de estanqueidade','trecho']]],
 ['07','Cobertura e impermeabilização',[
  ['Montagem de estrutura de telhado','m²'],['Instalação de telha cerâmica','m²'],
  ['Instalação de telha metálica','m²'],['Instalação de cumeeira','m'],
  ['Instalação de calha','m'],['Instalação de rufo','m'],
  ['Impermeabilização com manta asfáltica','m²'],['Impermeabilização cimentícia','m²'],
  ['Tratamento de junta de dilatação','m'],['Instalação de isolamento térmico','m²']]],
 ['08','Revestimentos e acabamentos',[
  ['Chapisco em alvenaria','m²'],['Emboço em paredes','m²'],
  ['Reboco em paredes','m²'],['Regularização de piso','m²'],
  ['Execução de contrapiso','m²'],['Assentamento de piso cerâmico','m²'],
  ['Assentamento de porcelanato','m²'],['Assentamento de revestimento de parede','m²'],
  ['Rejuntamento','m²'],['Aplicação de massa corrida','m²'],
  ['Pintura de parede','m²'],['Pintura de teto','m²'],
  ['Aplicação de textura','m²'],['Instalação de rodapé','m']]],
 ['09','Esquadrias e complementares',[
  ['Instalação de porta de madeira','un'],['Instalação de porta metálica','un'],
  ['Instalação de janela de alumínio','m²'],['Instalação de vidro','m²'],
  ['Instalação de fechadura','un'],['Instalação de forro de gesso','m²'],
  ['Instalação de forro PVC','m²'],['Instalação de guarda-corpo','m'],
  ['Instalação de corrimão','m'],['Execução de passeio de concreto','m²']]],
 ['10','Urbanização e serviços complementares',[
  ['Execução de calçada e passeio externo','m²'],
  ['Execução de muro de divisa','m²'],
  ['Assentamento de piso intertravado externo','m²'],
  ['Plantio de grama','m²'],
  ['Preparo de solo para paisagismo','m²'],
  ['Execução de rampa de acesso','m²']]],
 ['11','Limpeza, testes e entrega da obra',[
  ['Limpeza grossa de obra','m²'],['Limpeza fina de obra','m²'],
  ['Remoção de entulho','m³'],['Teste de circuitos elétricos','circuito'],
  ['Teste de aterramento','un'],['Teste de instalações hidráulicas','trecho'],
  ['Vistoria de acabamentos','ambiente'],['Correção de não conformidade','un'],
  ['Comissionamento de sistemas','sistema'],['Entrega técnica de instalações','un']]]
];
export const CATALOG_SECTIONS=Object.freeze(raw.map(([id,title,items])=>
 Object.freeze({id,title,count:items.length+REFERENCE_SERVICES.filter(s=>s.category===id).length})));
export const CATALOG_PRESETS=Object.freeze(raw.flatMap(([category,name,services])=>
 services.map(([description,unit],i)=>Object.freeze({
  code:'CV-'+category+'-'+String(i+1).padStart(3,'0'),category,categoryName:name,
  description,unit,roles:Object.freeze([]),
  source:'pending',sinapiCode:'',referenceMonth:'',directCost:null
 })).concat(REFERENCE_SERVICES.map(item=>Object.freeze({
  ...item,categoryName:raw.find(g=>g[0]===item.category)?.[1]||'',
  roles:Object.freeze([]),source:'internal',sinapiCode:'',referenceMonth:'',directCost:null
 }))));
export const catalogByCode=(code)=>CATALOG_PRESETS.find(x=>x.code===code)||null;
export const catalogRows=(overrides=[])=>{
 const map=new Map((overrides||[]).map(x=>[x.code,x]));
 return CATALOG_PRESETS.map(template=>({...template,...map.get(template.code)}));
};
export function catalogHours(record){
 if(!record?.roles?.length){
  const defaultHours=decimal(record?.hhMid);
  return defaultHours!==null&&defaultHours>0?defaultHours:null;
 }
 let value=0;
 for(const r of record.roles){
  const n=decimal(r.hours);
  if(!String(r.role||'').trim()||n===null||n<=0)return null;
  value+=n;
 }
 return Math.round(value*100000)/100000;
}
export const catalogReady=item=>catalogHours(item)!==null&&
 decimal(item.directCost)!==null&&decimal(item.directCost)>=0;
export function catalogStats(overrides){
 const entries=catalogRows(overrides);
 return {total:entries.length,ready:entries.filter(catalogReady).length,
  pending:entries.filter(x=>!catalogReady(x)).length};
}
export function validateCatalogRecord(fields,template,oldId){
 if(!template)throw Error('Selecione um serviço do catálogo.');
 const source=fields.source==='sinapi'?'sinapi':'internal';
 const roles=[];
 for(let i=1;i<=3;i++){
  const role=String(fields['role'+i]??'').trim();
  const hours=decimal(fields['hours'+i]);
  if(role||hours!==null){
   if(!role||hours===null||hours<=0||hours>10000)
    throw Error('Informe função e coeficiente HH/un válidos para cada profissional.');
   if(role.length>80)throw Error('Nome da função muito longo.');
   roles.push({role,hours});
  }
 }
 const unit=String(fields.unit??template.unit).trim();
 if(!unit||unit.length>20)throw Error('Informe uma unidade válida.');
 const desc=String(fields.description??template.description).trim();
 if(!desc||desc.length>180)throw Error('Descrição inválida.');
 const cost=decimal(fields.directCost);
 if(cost!==null&&(cost<0||cost>999999999||Math.abs(cost*100-Math.round(cost*100))>1e-6))
  throw Error('Custo direto por unidade inválido.');
 const sinapiCode=String(fields.sinapiCode||'').trim();
 const referenceMonth=String(fields.referenceMonth||'').trim();
 if(sinapiCode.length>48||referenceMonth&&!/^\d{4}-\d{2}$/.test(referenceMonth))
  throw Error('Código ou competência de referência inválidos.');
 if(source==='sinapi'&&roles.length&&(!sinapiCode||!referenceMonth))
  throw Error('Referência SINAPI exige código da composição e competência YYYY-MM.');
 return {id:oldId||null,code:template.code,category:template.category,categoryName:template.categoryName,
  description:desc,unit,source,roles,directCost:cost,
  sinapiCode,referenceMonth};
}
export function catalogToBudgetItem(record,id){
 if(!catalogReady(record))throw Error('Configure coeficientes e custo direto antes de usar o serviço.');
 return {
  id,source:'internal',sourceCode:record.code,
  description:record.description,unit:record.unit,quantity:1,
  laborHours:catalogHours(record),directCost:record.directCost,
  roles:(record.roles||[]).map(r=>({...r})),
  ...(record.team?{crewComposition:record.team}:{}),
  ...(record.hhMin!=null?{hhMin:record.hhMin,hhMax:record.hhMax}:{}),
  reference:record.source==='sinapi'?{
   system:'SINAPI',code:record.sinapiCode,month:record.referenceMonth,
   validation:'informado pelo usuário; conferir composição analítica'
  }:{system:'INTERNO',validation:record.hhMin!=null?'Faixa HH fornecida pela CIVOLTEN, não validada pelo SINAPI':'coeficientes próprios da empresa'}
 };
}
