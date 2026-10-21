// Somente campos comerciais podem entrar no documento do cliente.
// Não serializar objetos de funcionários, despesas, impostos ou margens nesta proposta.
const text = value => String(value ?? '').trim();
const escapeHtml = value => text(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatMoney = cents => (cents / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const safeLogo = url => typeof url === 'string' && url.length <= 360000 &&
  /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(url) ? url : '';
// Apenas arte hospedada nos arquivos da própria CIVOLTEN (a imagem será enviada depois).
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
    return {description, unit, quantity};
  });
}

export function buildProposalHtml(budget, {priceCents, id = null, date = new Date(), logoDataUrl = '', headerArtUrl = ''} = {}) {
  if (!budget || typeof budget !== 'object' || !text(budget.title)) throw Error('Informe o nome da obra');
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) throw Error('Valor comercial inválido');

  const published = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  const issueDate = published.toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'});
  const name = escapeHtml(budget.title);
  const customer = escapeHtml(budget.customer || 'A definir');
  const address = escapeHtml(budget.address || 'A confirmar');
  const scopeItems = normalizeScopeItems(budget.scope_items || []);
  const services = escapeHtml(budget.services || (scopeItems.length ? '' : 'Os serviços serão detalhados conforme o escopo acordado.'));
  const notes = escapeHtml(budget.notes);
  const days = Number(budget.days);
  const duration = Number.isFinite(days) && days > 0
    ? days.toLocaleString('pt-BR', {maximumFractionDigits:2}) + (days === 1 ? ' dia de execução' : ' dias de execução')
    : 'A confirmar';
  const reference = escapeHtml(proposalReference(id));
  const logo = safeLogo(logoDataUrl);
  const brand = logo
    ? '<img class="proposal-logo" src="' + logo + '" alt="Logotipo CIVOLTEN">'
    : '<span class="proposal-monogram" aria-hidden="true">C<span>.</span></span>';
  const headerArt = safeHeaderArt(headerArtUrl);
  const headerArtImg = headerArt
    ? '<img class="proposal-header-art" src="' + headerArt + '" alt="Arte institucional CIVOLTEN">'
    : '';
  const scopeTable = scopeItems.length
    ? '<table class="proposal-quantity-table" aria-label="Serviços e quantidades"><thead><tr><th scope="col">SERVIÇO / DESCRIÇÃO</th><th scope="col">UN.</th><th scope="col">QUANTIDADE</th></tr></thead><tbody>' +
        scopeItems.map(item => '<tr><td>' + escapeHtml(item.description) + '</td><td>' + escapeHtml(item.unit) + '</td><td>' +
          escapeHtml(item.quantity.toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:2})) +
        '</td></tr>').join('') + '</tbody></table>'
    : '';
  const scopeIntroduction = services ? '<p class="proposal-rich">' + services + '</p>' : '';
  const observations = notes
    ? '<section class="proposal-section proposal-observations">' +
      '<div class="proposal-section-heading"><span class="proposal-step">02</span><div><span class="proposal-section-kicker">DETALHES IMPORTANTES</span><h2>Condições e observações</h2></div></div>' +
      '<div class="proposal-section-content"><p class="proposal-rich">' + notes + '</p></div></section>'
    : '';

  return '<article class="proposal-sheet" aria-label="Proposta comercial CIVOLTEN">' +
    '<header class="proposal-masthead">' +
      '<div class="proposal-brand-mark">' + brand +
        '<div class="proposal-header-art-slot">' + headerArtImg + '</div></div>' +
      '<div class="proposal-header-side"><span class="proposal-header-label">DOCUMENTO COMERCIAL</span>' +
        '<strong>PROPOSTA<br>COMERCIAL</strong><span class="proposal-header-id">' + reference + '</span></div>' +
    '</header>' +
    '<div class="proposal-gold-rule"></div>' +
    '<div class="proposal-intro"><span class="proposal-overline">CONSTRUÇÃO • INSTALAÇÕES • SERVIÇOS</span>' +
      '<h1 class="proposal-title">' + name + '</h1>' +
      '<p>Planejamento, execução e compromisso com cada detalhe do seu projeto.</p></div>' +
    '<section class="proposal-facts" aria-label="Informações da proposta">' +
      '<div class="proposal-fact"><span>CLIENTE</span><strong>' + customer + '</strong></div>' +
      '<div class="proposal-fact"><span>EMISSÃO</span><strong>' + escapeHtml(issueDate) + '</strong></div>' +
      '<div class="proposal-fact proposal-fact-address"><span>LOCAL DA OBRA</span><strong>' + address + '</strong></div>' +
      '<div class="proposal-fact"><span>PRAZO ESTIMADO</span><strong>' + escapeHtml(duration) + '</strong></div>' +
    '</section>' +
    '<section class="proposal-section proposal-services">' +
      '<div class="proposal-section-heading"><span class="proposal-step">01</span><div><span class="proposal-section-kicker">O QUE ESTÁ INCLUÍDO</span><h2>' + (scopeItems.length ? 'Serviços e quantitativos' : 'Escopo dos serviços') + '</h2></div></div>' +
      '<div class="proposal-section-content">' + scopeIntroduction + scopeTable + '</div></section>' +
    observations +
    '<section class="proposal-investment"><div><span class="proposal-investment-label">INVESTIMENTO PREVISTO</span>' +
      '<p>Valor total da proposta</p><small>Conforme o escopo e as condições descritos neste documento.</small></div>' +
      '<strong class="proposal-investment-value">' + escapeHtml(formatMoney(priceCents)) + '</strong></section>' +
    '<section class="proposal-acceptance"><div class="proposal-acceptance-head"><span>FORMALIZAÇÃO</span><h2>Aceite da proposta</h2>' +
      '<p>Espaço reservado para confirmação e assinatura após a revisão das condições comerciais.</p></div>' +
      '<div class="proposal-signatures"><div><span class="proposal-signature-line"></span><span>Cliente / responsável</span></div>' +
      '<div><span class="proposal-signature-line"></span><span>CIVOLTEN</span></div></div></section>' +
    '<footer class="proposal-footer"><div><strong>CIVOLTEN</strong> <span>Construção &amp; Elétrica</span></div>' +
      '<p>Esta proposta está sujeita à confirmação do escopo e das condições acordadas entre as partes.</p>' +
      '<span>' + escapeHtml(reference) + ' • ' + escapeHtml(issueDate) + '</span></footer>' +
    '</article>';
}
