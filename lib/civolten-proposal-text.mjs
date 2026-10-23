// Modelo apenas de texto: preenchido nos campos existentes da proposta, sem alterar seu PDF.
export function electricalProposalPreset(){
 return {
  services:'Prezado cliente, apresentamos nossa proposta técnico-comercial para a execução de serviços de instalações elétricas e infraestrutura civil. O planejamento considera desempenho, segurança, condições do imóvel e atendimento às normas técnicas aplicáveis, inclusive à ABNT NBR 5410 quando pertinente às instalações elétricas de baixa tensão.',
  scope_items:[
   {description:'Instalação e montagem de Quadro de Distribuição de Circuitos (QDC)',unit:'un',quantity:1},
   {description:'Passagem de condutores e cabos elétricos isolados',unit:'m',quantity:1500},
   {description:'Substituição e testes de tomadas de energia, mecanismos e espelhos',unit:'un',quantity:150}
  ],
  notes:[
   'DIFERENCIAIS TÉCNICOS E SEGURANÇA OPERACIONAL',
   'Responsabilidade técnica: a supervisão por profissional habilitado, o registro no conselho competente (CFT/CRT ou CREA/CAU, conforme o caso) e a emissão da TRT/ART/RRT aplicável deverão ser confirmados de acordo com as atribuições e o escopo da obra.',
   'Seguro de responsabilidade civil: eventual cobertura depende de apólice vigente contratada, riscos cobertos, limites, franquias e exclusões. A existência de seguro não está presumida nesta proposta.',
   'Segurança do trabalho: as equipes designadas deverão atender aos requisitos aplicáveis, incluindo a NR-10 em serviços com eletricidade e a NR-35 quando houver trabalho em altura.',
   '',
   'CONDIÇÕES COMERCIAIS E FINANCEIRAS',
   'Validade da proposta: 10 (dez) dias corridos a partir da emissão, condicionada à disponibilidade de insumos e à confirmação das condições comerciais.',
   'Pagamento: 40% de entrada para mobilização da equipe; os 60% restantes serão pagos mediante medições de avanço físico, com marcos e vencimentos a definir por escrito antes da contratação.',
   'Materiais: esta proposta compreende mão de obra técnica e ferramentaria. Caberá ao contratante fornecer os materiais de instalação conforme lista quantitativa e especificações do projeto, salvo ajuste expresso em sentido diverso.',
   'Quantidades, cronograma e condições técnicas deverão ser conferidos e ajustados às características reais da obra antes do envio ao cliente.'
  ].join('\n')
 };
}
