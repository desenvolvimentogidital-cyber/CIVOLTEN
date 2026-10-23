// Somente campos comerciais podem entrar no documento do cliente.
// Não serializar objetos de funcionários, despesas, impostos ou margens nesta proposta.
const text = value => String(value ?? '').trim();
const escapeHtml = value => text(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatMoney = cents => (cents / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const safeLogo = url => url === '/assets/civolten-logo.png' ? url : (
  typeof url === 'string' && url.length <= 360000 &&
  /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(url) ? url : '');
// Apenas arte hospedada nos arquivos da própria CIVOLTEN.
const safeHeaderArt = url => typeof url === 'string' &&
  /^\/assets\/civolten-proposal-header\.(?:png|jpe?g|webp)$/.test(url) ? url : '';

export function proposalReference(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)
    ? 'CV-' + id.slice(0, 8).toUpperCase()
    : 'Prévia sem número';
}

const scopeUnits = ['m²', 'm', 'm³', 'un', 'ponto', 'serviço'];

// Validacao do memorial descritivo: nunca mistura custos internos com quantitativos.
export function normalizeScopeItems(items = []) {
  if (!Array.isArray(items) || items.length > 100) throw Error('Quantidade de servicos invalida');
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Servico '+(index+1)+' invalido');
    const description = text(item.description);
    const unit = text(item.unit || 'm²');
    const quantity = Number(item.quantity);
    if (!description || description.length > 180) throw Error('Descreva o servico '+(index+1)+' (ate 180 caracteres)');
    if (!scopeUnits.includes(unit)) throw Error('Unidade invalida no servico '+(index+1));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || Math.abs(Math.round(quantity * 100) - quantity * 100) > 1e-7) {
      throw Error('Informe quantidade positiva com ate duas casas decimais no servico '+(index+1));
    }
    return {description, unit, quantity, category: ['civil','eletrica','geral'].includes(text(item.category)) ? text(item.category) : 'geral'};
  });
}


const proposalParagraph = value => '<p class="proposal-rich">' + escapeHtml(value) + '</p>';
const field = (label, value) =>
  '<div class="cv-detail"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value || 'Não informado') + '</strong></div>';
const heading = (number, title, subtitle = '') =>
  '<div class="cv-heading"><span class="cv-heading-number">' + escapeHtml(number) +
  '</span><div><small>CIVOLTEN • PROPOSTA TÉCNICO-COMERCIAL</small><h2>' +
  escapeHtml(title) + '</h2>' + (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div></div>';
const feature = (symbol, label, description) =>
  '<div class="cv-feature"><span class="cv-feature-icon" aria-hidden="true">' + symbol +
  '</span><div><strong>' + escapeHtml(label) + '</strong><p>' + escapeHtml(description) + '</p></div></div>';
const quantityTable = items => items.length ?
  '<table class="proposal-quantity-table" aria-label="Serviços e quantidades"><thead><tr><th>Serviço / descrição</th><th>Un.</th><th>Quantidade</th></tr></thead><tbody>' +
  items.map(item => '<tr><td>' + escapeHtml(item.description) + '</td><td>' +
  escapeHtml(item.unit) + '</td><td>' +
  escapeHtml(item.quantity.toLocaleString('pt-BR', {maximumFractionDigits:2})) +
  '</td></tr>').join('') + '</tbody></table>' : '';
const segment = (items, size) => {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i,i+size));
  return groups.length ? groups : [[]];
};
const shortText = (value, max=5000) => text(value).slice(0,max);

/**
 * Gerador comercial de sete páginas A4 (mais páginas de continuação quando necessário).
 * Somente dados explicitamente comerciais. Valores unitários, custos, impostos, folha
 * e margem jamais entram neste documento nem em atributos HTML.
 */
export function buildProposalHtml(budget, {priceCents, id = null, date = new Date(),
 logoDataUrl = '', headerArtUrl = ''} = {}) {
 if (!budget || typeof budget !== 'object' || !text(budget.title)) throw Error('Informe o nome da obra');
 if (!Number.isSafeInteger(priceCents) || priceCents < 0) throw Error('Valor comercial inválido');
 const issued = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
 const dateString = issued.toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'});
 const reference = proposalReference(id);
 const title = text(budget.title);
 const customer = text(budget.customer);
 const location = text(budget.address);
 const services = shortText(budget.services);
 const civil = shortText(budget.civil_services);
 const electrical = shortText(budget.electrical_services);
 const notes = shortText(budget.notes);
 const methodology = shortText(budget.methodology);
 const companyIntro = shortText(budget.company_intro) ||
    'A CIVOLTEN atua em construção civil e instalações elétricas, com foco em planejamento, qualidade, segurança e execução responsável.';
 const payment = shortText(budget.payment_terms,1000);
 const warranties = shortText(budget.warranty_terms,1000);
 const responsible = shortText(budget.technical_responsible,150);
 const days = Number(budget.days);
 const duration = Number.isFinite(days) && days > 0
  ? days.toLocaleString('pt-BR',{maximumFractionDigits:2}) + (days === 1 ? ' dia de execução':' dias de execução')
  : 'A confirmar';
 const validity = Number(budget.validity_days);
 const validityText = Number.isInteger(validity) && validity > 0 && validity <= 365 ?
  validity + (validity === 1 ? ' dia':' dias') : 'Não informado';
 const scopeItems = normalizeScopeItems(budget.scope_items || []);
 const civilItems = scopeItems.filter(x => x.category !== 'eletrica');
 const electricalItems = scopeItems.filter(x => x.category === 'eletrica');
 const logo = safeLogo(logoDataUrl);
 const art = safeHeaderArt(headerArtUrl);
 const brand = logo ? '<img class="proposal-logo" src="' + logo + '" alt="Símbolo CIVOLTEN">' :
   '<span class="proposal-monogram" aria-hidden="true">C<span>.</span></span>';
 const wordmark = art ? '<img class="proposal-header-art" src="' + art + '" alt="CIVOLTEN — Elétrica &amp; Construção Civil">' : '';
 const brandHeader = '<header class="proposal-masthead"><div class="proposal-brand-mark">' +
    brand + '<div class="proposal-header-art-slot">' + wordmark + '</div></div>' +
    '<div class="proposal-header-side"><span class="proposal-header-label">DOCUMENTO COMERCIAL</span>' +
    '<strong>PROPOSTA<br>COMERCIAL</strong><span class="proposal-header-id">' + escapeHtml(reference) + '</span></div></header>';
 const pages = [];
 const add = (type, body) => pages.push({type,body});
 add('cv-cover',
   '<div class="cv-cover-hero"><span class="cv-kicker">ELÉTRICA &amp; CONSTRUÇÃO CIVIL</span>' +
   '<h1>PROPOSTA<br><em>COMERCIAL</em></h1><p>Serviços de Construção Civil<br>e Instalações Elétricas</p>' +
   '<div class="cv-cover-details">' +
     field('Cliente',customer) + field('Projeto',title) + field('Emissão',dateString) +
     field('Proposta nº',reference) + '</div></div>' +
   '<div class="cv-cover-caption">Soluções completas com <strong>qualidade, segurança e eficiência.</strong></div>');
 add('cv-content cv-about',
   heading('01','Apresentação da empresa','Quem somos e como conduzimos cada projeto.') +
   '<div class="cv-columns"><div class="cv-paper"><h3>Quem <em>somos</em></h3>' +
   proposalParagraph(companyIntro) + '<h3>Diferenciais</h3>' +
   feature('◉','Planejamento','Organização das etapas e alinhamento do escopo com o cliente.') +
   feature('◇','Segurança','Procedimentos adequados às atividades contratadas.') +
   feature('✓','Qualidade','Atenção aos acabamentos e às verificações de entrega.') +
   feature('▦','Compromisso','Acompanhamento dos prazos definidos para a obra.') + '</div>' +
   '<aside class="cv-aside"><div class="cv-picture cv-construction"></div>' +
   '<div class="cv-dark-box"><h3>Dados da proposta</h3>' +
   field('Cliente',customer) + field('Projeto',title) + field('Local da obra',location) +
   field('Responsável técnico',responsible || 'Não indicado') + '</div></aside></div>');
 const civilChunks = segment(civilItems,10);
 civilChunks.forEach((items,index) => add('cv-content cv-scope',
   heading('02','Escopo técnico — Construção Civil',index ? 'Continuação do memorial descritivo.' : 'Descrição dos serviços civis e atividades previstas.') +
   '<div class="cv-columns"><div class="cv-paper"><h3>Escopo dos serviços</h3>' +
   (index===0 ? (services ? proposalParagraph(services) : '') + (civil ? proposalParagraph(civil) : '') : '') +
   (items.length ? '<h4>Serviços e quantitativos</h4>' + quantityTable(items) :
     (!services && !civil ? '<p class="cv-muted">Nenhum serviço civil foi discriminado nesta proposta.</p>' : '')) +
   '</div><aside class="cv-aside"><div class="cv-picture cv-construction"></div>' +
   '<div class="cv-dark-box"><h3>Observações técnicas</h3>' +
   feature('✓','Escopo contratado','Somente os serviços e quantidades descritos fazem parte desta proposta.') +
   feature('◇','Alterações','Serviços adicionais exigem aprovação das partes.') +
   '</div></aside></div>'));
 const electricalChunks = segment(electricalItems,10);
 electricalChunks.forEach((items,index) => add('cv-content cv-scope',
   heading('03','Escopo técnico — Instalações Elétricas',index ? 'Continuação dos serviços elétricos.' : 'Infraestrutura, circuitos e instalações efetivamente contratados.') +
   '<div class="cv-columns"><div class="cv-paper"><h3>Instalações elétricas</h3>' +
   (index===0 && electrical ? proposalParagraph(electrical) : '') +
   (items.length ? '<h4>Serviços e quantitativos</h4>' + quantityTable(items) :
    (!electrical ? '<p class="cv-muted">Nenhum serviço elétrico específico foi discriminado nesta proposta.</p>' : '')) +
   '</div><aside class="cv-aside"><div class="cv-picture cv-electrical"></div>' +
   '<div class="cv-dark-box"><h3>Critérios de execução</h3>' +
   feature('⚡','Segurança operacional','Execução com medidas de segurança compatíveis com as atividades.') +
   feature('✓','Verificações finais','Testes e conferências pertinentes ao escopo contratado.') +
   '</div></aside></div>'));
 add('cv-content cv-process',
   heading('04','Metodologia de execução e cronograma','Organização e acompanhamento das etapas da obra.') +
   '<div class="cv-columns"><div class="cv-paper"><h3>Etapas de <em>execução</em></h3>' +
   feature('01','Planejamento','Análise do serviço e definição das etapas com o cliente.') +
   feature('02','Mobilização','Organização da equipe, ferramentas e local de execução.') +
   feature('03','Execução','Realização dos serviços incluídos na proposta.') +
   feature('04','Inspeção','Conferências e eventuais ajustes previstos no escopo.') +
   feature('05','Entrega','Finalização e apresentação dos serviços executados.') +
   (methodology ? '<h4>Observações de execução</h4>' + proposalParagraph(methodology) : '') +
   '</div><aside class="cv-aside"><div class="cv-picture cv-construction"></div>' +
   '<div class="cv-dark-box"><h3>Cronograma estimado</h3>' +
   field('Duração prevista',duration) +
   '<p>O detalhamento das etapas e das datas será alinhado conforme o escopo aprovado.</p>' +
   '</div></aside></div>');
 add('cv-content cv-financial',
   heading('05','Investimento e condições comerciais','Resumo financeiro da proposta.') +
   '<div class="cv-columns"><div class="cv-paper"><h3>Resumo <em>financeiro</em></h3>' +
   '<p>O investimento considera exclusivamente os serviços e as condições especificados nesta proposta.</p>' +
   '<table class="cv-price-table"><thead><tr><th>Descrição</th><th>Valor</th></tr></thead><tbody>' +
   '<tr><td>Serviços contratados — preço global</td><td>' + escapeHtml(formatMoney(priceCents)) + '</td></tr>' +
   '<tr class="cv-price-total"><td>Investimento total</td><td>' + escapeHtml(formatMoney(priceCents)) + '</td></tr>' +
   '</tbody></table>' +
   '<p class="cv-muted">Os custos internos, os encargos e as margens da CIVOLTEN não integram esta proposta comercial.</p>' +
   '</div><aside class="cv-aside"><div class="cv-picture cv-electrical"></div>' +
   '<div class="cv-dark-box"><h3>Condições comerciais</h3>' +
   field('Validade da proposta',validityText) + field('Prazo de execução',duration) +
   '<h4>Condições de pagamento</h4>' +
   (payment ? proposalParagraph(payment) : '<p>Não informadas.</p>') +
   '</div></aside></div>');
 add('cv-content cv-final',
   heading('06','Garantias, responsabilidades e aceite','Condições para a formalização desta proposta.') +
   '<div class="cv-columns"><div class="cv-paper"><h3>Garantias</h3>' +
   (warranties ? proposalParagraph(warranties) : '<p>Aplicam-se as garantias legais e as condições expressamente acordadas entre as partes.</p>') +
   '<h3>Responsabilidades</h3>' +
   feature('✓','CIVOLTEN','Executar os serviços aprovados conforme o escopo comercial.') +
   feature('◇','Contratante','Viabilizar o acesso ao local e aprovar eventuais alterações.') +
   (notes ? '<h4>Condições e observações</h4>' + proposalParagraph(notes) : '') +
   '<h3>Aceite da proposta</h3><p>Declaro estar de acordo com as condições desta proposta comercial.</p>' +
   '<div class="proposal-signatures"><div><span class="proposal-signature-line"></span><strong>Contratante</strong>' +
   '<small>Nome, assinatura e data</small></div><div><span class="proposal-signature-line"></span>' +
   '<strong>CIVOLTEN — Contratada</strong><small>Nome, assinatura e data</small></div></div>' +
   '</div><aside class="cv-aside"><div class="cv-picture cv-construction"></div>' +
   '<div class="cv-dark-box cv-thanks"><h3>Obrigado pela confiança!</h3>' +
   '<p>Agradecemos a oportunidade e permanecemos à disposição para esclarecimentos.</p>' +
   '</div></aside></div>');
 const totalPages=pages.length;
 return '<article class="proposal-sheet cv-proposal" aria-label="Proposta comercial CIVOLTEN">' +
   pages.map((page,index) =>
    '<section class="cv-page ' + page.type + '" aria-label="Página ' + (index+1) +
    ' de ' + totalPages + '">' + brandHeader +
    '<div class="cv-page-body">' + page.body + '</div>' +
    '<footer class="cv-footer"><span>CIVOLTEN <i>│</i> ELÉTRICA &amp; CONSTRUÇÃO CIVIL</span>' +
    '<span>' + escapeHtml(reference) + ' · ' + escapeHtml(dateString) + '</span>' +
    '<strong>' + String(index+1).padStart(2,'0') + ' / ' + String(totalPages).padStart(2,'0') +
    '</strong></footer></section>'
   ).join('') + '</article>';
}
