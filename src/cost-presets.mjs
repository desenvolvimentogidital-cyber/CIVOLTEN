// Catálogo gerencial de custos comuns para empresas de elétrica e construção civil.
// Valores reais não são inventados: itens novos começam pendentes e só entram
// financeiramente após o usuário informar seu valor/quantidade.
// Não inclui salários e encargos CLT nem impostos sobre venda, calculados em outros módulos.
const fixed=[
 ['Aluguel do escritório','Infraestrutura','monthly',['Aluguel']],
 ['Condomínio da sede','Infraestrutura','monthly',['Condomínio']],
 ['Energia elétrica da sede','Infraestrutura','monthly',['Energia elétrica','Luz']],
 ['Água e esgoto da sede','Infraestrutura','monthly',['Água','Água e esgoto']],
 ['Internet da empresa','Comunicação','monthly',['Internet']],
 ['Telefonia e dados móveis','Comunicação','monthly',['Telefone','Telefonia']],
 ['Serviços de contabilidade','Administrativo','monthly',['Contabilidade','Honorários contábeis']],
 ['Sistema de gestão empresarial','Tecnologia','monthly',['Software de gestão','Sistema de gestão']],
 ['Hospedagem, domínios e e-mail','Tecnologia','annual',['Hospedagem de site','Domínios']],
 ['Pró-labore dos sócios','Administração','monthly',['Pró-labore']],
 ['Seguro empresarial patrimonial','Seguros','annual',['Seguro empresarial']],
 ['Seguro de responsabilidade civil','Seguros','annual',[]],
 ['Seguro anual da frota','Frota','annual',['Seguro de veículos']],
 ['IPTU da empresa','Tributos patrimoniais','annual',['IPTU']],
 ['Licenças e alvarás da empresa','Regularização','annual',['Alvarás']],
 ['Anuidade CREA / CAU','Regularização','annual',['CREA','CAU']],
 ['Manutenção preventiva da sede','Infraestrutura','monthly',[]],
 ['Limpeza e conservação da sede','Infraestrutura','monthly',[]],
 ['Monitoramento e segurança','Infraestrutura','monthly',[]],
 ['Locação fixa de veículos','Frota','monthly',[]],
 ['Locação fixa de máquinas','Operacional','monthly',[]],
 ['Mensalidade e tarifas bancárias fixas','Financeiro','monthly',[]],
 ['Assessoria jurídica recorrente','Administrativo','monthly',[]],
 ['Marketing e publicidade mensal','Comercial','monthly',[]],
 ['Segurança do trabalho recorrente (SST)','Segurança do trabalho','monthly',[]],
 ['Depreciação de máquinas e ferramentas','Patrimônio','monthly',[]],
 ['Associações e entidades profissionais','Regularização','annual',[]],
 ['Material de limpeza recorrente','Infraestrutura','monthly',[]],
 ['Certificados digitais e assinaturas','Tecnologia','annual',[]]
];
const variable=[
 ['Materiais elétricos por obra','Materiais',['Materiais elétricos']],
 ['Materiais de construção civil','Materiais',['Materiais de construção']],
 ['Materiais hidráulicos por obra','Materiais',['Materiais hidráulicos']],
 ['Ferramentas e consumíveis de reposição','Ferramentas',[]],
 ['Equipamentos de proteção individual (EPI)','Segurança',['EPI']],
 ['Equipamentos de proteção coletiva (EPC)','Segurança',['EPC']],
 ['Uniformes e identificação da equipe','Segurança',['Uniformes']],
 ['Combustível e lubrificantes','Transporte',['Combustível']],
 ['Pedágios','Transporte',[]],
 ['Estacionamentos de obra','Transporte',['Estacionamento']],
 ['Transporte da equipe de campo','Transporte',[]],
 ['Fretes e entregas de materiais','Logística',['Frete']],
 ['Locação de equipamentos por obra','Equipamentos',[]],
 ['Locação de andaimes e escoras','Equipamentos',[]],
 ['Manutenção de veículos por uso','Frota',[]],
 ['Peças, pneus e reparos da frota','Frota',[]],
 ['Manutenção corretiva de ferramentas','Ferramentas',[]],
 ['Serviços terceirizados por obra','Terceirização',[]],
 ['Alimentação da equipe em campo','Equipe',[]],
 ['Hospedagem da equipe em viagem','Equipe',[]],
 ['Deslocamentos e viagens a serviço','Viagens',[]],
 ['Caçambas e retirada de entulho','Descarte',[]],
 ['Descarte de resíduos especiais','Descarte',[]],
 ['Ensaios, testes e laudos técnicos','Técnico',[]],
 ['Projetos e desenhos terceirizados','Técnico',[]],
 ['Impressões e plotagens de projetos','Técnico',[]],
 ['Cartório e documentação de obras','Regularização',[]],
 ['Taxas de transações bancárias','Financeiro',[]],
 ['Comissões de vendas','Comercial',[]],
 ['Campanhas de marketing avulsas','Comercial',[]],
 ['Seguros específicos por obra','Seguros',[]],
 ['Retrabalho e garantia de execução','Qualidade',[]],
 ['Limpeza final e entrega de obra','Obras',[]],
 ['Tapumes e sinalização temporária','Obras',[]],
 ['Compras emergenciais de obra','Obras',[]],
 ['Armazenagem e logística de obra','Logística',[]],
 ['Material de escritório de consumo','Administrativo',[]]
];
const freezeEntry=entry=>Object.freeze(entry);
export const COST_PRESETS=Object.freeze({
 fixed:Object.freeze(fixed.map(([name,category,frequency,aliases])=>
  freezeEntry({name,category,frequency,aliases:Object.freeze(aliases)}))),
 variable:Object.freeze(variable.map(([name,category,aliases])=>
  freezeEntry({name,category,unit:'un',aliases:Object.freeze(aliases)})))
});
const norm=name=>String(name??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function costPresetsMissing(data){
 const missing={fixed:[],variable:[]};
 for(const kind of ['fixed','variable']){
  const names=new Set((data[kind]||[]).map(item=>norm(item.name)));
  missing[kind]=COST_PRESETS[kind].filter(preset=>
   ![preset.name,...preset.aliases].some(label=>names.has(norm(label))));
 }
 return missing;
}
export function prepareCostPresets(data,makeId){
 const missing=costPresetsMissing(data);
 return {
  fixed:missing.fixed.map(item=>({
   id:makeId(),name:item.name,category:item.category,frequency:item.frequency,amount:0
  })),
  variable:missing.variable.map(item=>({
   id:makeId(),name:item.name,category:item.category,unit:item.unit,unitCost:0,monthQty:null
  }))
 };
}
