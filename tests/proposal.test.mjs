import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProposalHtml, proposalReference} from '../lib/civolten-proposal.mjs';

const sample={
 title:'Instalação elétrica e reforma',
 customer:'Cliente CIVOLTEN',
 address:'São Paulo - SP',
 services:'Instalação dos circuitos.\nRevisão do quadro de distribuição.',
 notes:'Pagamento e início a combinar.',
 days:12,
 status:'enviado',
 staff:[{name:'Nome interno segredo', daily_cents:87654321}],
 expenses:[{name:'Custo material interno segredo',unit_cents:23456789}],
 pricing:{tax_pct:22,margin_pct:35,fixed_monthly_cents:7654321},
 manual_price_cents:1199000
};
const options={
 priceCents:1199000,
 id:'550e8400-e29b-41d4-a716-446655440000',
 date:new Date('2026-10-21T12:00:00Z')
};

test('proposta comercial A4 tem identificacao, escopo, valor, prazo, aceite e referencia',()=>{
 const html=buildProposalHtml(sample,options);
 assert.match(html,/PROPOSTA<br>COMERCIAL/);
 assert.match(html,/CV-550E8400/);
 assert.match(html,/21 de outubro de 2026/);
 assert.match(html,/Instalação elétrica e reforma/);
 assert.match(html,/Cliente CIVOLTEN/);
 assert.match(html,/12 dias de execução/);
 assert.match(html,/Escopo dos serviços/);
 assert.match(html,/Instalação dos circuitos.\nRevisão do quadro de distribuição/);
 assert.match(html,/Condições e observações/);
 assert.match(html,/Aceite da proposta/);
 assert.match(html,/R\$\s*11\.990,00/);
});

test('nunca inclui salarios, margens, impostos, itens internos ou custos na proposta',()=>{
 const html=buildProposalHtml(sample,options);
 for(const confidential of ['Nome interno segredo','Custo material interno segredo','87.654.321','23.456.789','7654321','tax_pct','margin_pct','daily_cents','staff','expenses','lucro','impostos sobre venda']){
  assert.ok(!html.includes(confidential),'vazamento de dado privado: '+confidential);
 }
});

test('escapa texto do cliente e nao aceita logo com atributos ou codigo malicioso',()=>{
 const unsafe={...sample,title:'<img src=x onerror=alert(1)>',customer:'" onclick="run()',services:'<script>alert(1)</script>',notes:"'<b>ruim</b>"};
 const html=buildProposalHtml(unsafe,{...options,logoDataUrl:'data:image/svg+xml,<svg onload=alert(1)>'});
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('data:image/svg+xml'));
 assert.match(html,/proposal-monogram/);
});

test('usa logo original quando for PNG ou JPEG incorporado valido',()=>{
 const html=buildProposalHtml(sample,{...options,logoDataUrl:'data:image/png;base64,aGVsbG8='});
 assert.match(html,/class="proposal-logo"/);
 assert.match(html,/data:image\/png;base64,aGVsbG8=/);
 assert.doesNotMatch(html,/proposal-monogram/);
});

test('orcamento nao salvo tem referencia explicita, sem inventar numero oficial',()=>{
 assert.equal(proposalReference(null),'Prévia sem número');
 const html=buildProposalHtml({...sample,notes:'',days:1}, {...options,id:null});
 assert.match(html,/Prévia sem número/);
 assert.match(html,/1 dia de execução/);
 assert.doesNotMatch(html,/Condições e observações/);
});

test('dados minimos geram documento valido e entradas incorretas sao recusadas',()=>{
 const html=buildProposalHtml({title:'Obra A',days:0},{priceCents:0});
 assert.match(html,/A confirmar/);
 assert.match(html,/Obra A/);
 assert.throws(()=>buildProposalHtml({title:''},{priceCents:100}),/Informe o nome/);
 assert.throws(()=>buildProposalHtml({title:'Obra'}, {priceCents:-2}),/Valor comercial/);
});

test('folha A4 imprime independentemente do tema escuro e nao exibe painel',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(css,/@page\s*\{\s*size:A4/);
 assert.match(css,/#app,#auth,#flash\s*\{\s*display:none!important/);
 assert.match(css,/print-color-adjust:exact/);
 assert.match(css,/break-inside:avoid/);
 assert.match(css,/\.proposal-rich/);
 assert.match(page,/proposal-print\.css" media="print"/);
 assert.match(app,/import \{buildProposalHtml,normalizeScopeItems\} from '\/lib\/civolten-proposal\.mjs'/);
 assert.match(app,/priceCents:r\.price_cents/);
});


test('logo PNG no PDF não recebe fundo branco, cartão, borda arredondada ou espaçamento',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 const match=css.match(/#printArea\s*\.proposal-logo\s*\{([^}]*)\}/);
 assert.ok(match,'Regra da logo precisa existir');
 const rule=match[1];
 assert.match(rule,/background\s*:\s*transparent\s*;/);
 assert.match(rule,/border-radius\s*:\s*0\s*;/);
 assert.match(rule,/padding\s*:\s*0\s*(?:;|$)/);
 assert.doesNotMatch(rule,/background\s*:\s*#(?:fff|ffffff)\b/i);
});


test('cabecalho mantem logo original mas nao repete o nome textual da empresa',()=>{
 const html=buildProposalHtml(sample,{...options,logoDataUrl:'data:image/png;base64,aGVsbG8='});
 const header=html.match(/<header class="proposal-masthead">[\s\S]*?<\/header>/)?.[0];
 assert.ok(header,'Cabecalho precisa existir');
 assert.match(header,/class="proposal-logo"/);
 assert.match(header,/class="proposal-header-art-slot"/);
 assert.doesNotMatch(header,/proposal-brand-name/);
 assert.doesNotMatch(header,/CONSTRUÇÃO &amp; ELÉTRICA/);
 assert.doesNotMatch(header,/class="proposal-header-art"/);
});

test('arte institucional futura entra no espaco reservado sem alterar a logo atual',()=>{
 const html=buildProposalHtml(sample,{...options,logoDataUrl:'data:image/png;base64,aGVsbG8=',headerArtUrl:'/assets/civolten-proposal-header.png'});
 const header=html.match(/<header class="proposal-masthead">[\s\S]*?<\/header>/)?.[0]||'';
 assert.match(header,/class="proposal-logo"/);
 assert.match(header,/class="proposal-header-art"/);
 assert.match(header,/src="\/assets\/civolten-proposal-header\.png"/);
 assert.doesNotMatch(header,/proposal-brand-name/);
});

test('nao permite fonte externa ou atributos maliciosos como arte de cabecalho',()=>{
 for(const candidate of ['https://evil.example/image.png','/assets/x.png','/assets/civolten-proposal-header.png" onerror="alert(1)']){
  const html=buildProposalHtml(sample,{...options,headerArtUrl:candidate});
  assert.doesNotMatch(html,/class="proposal-header-art"/);
  assert.doesNotMatch(html,/evil\.example/);
  assert.doesNotMatch(html,/onerror=/);
 }
});

test('logo e imagem futura nunca ganham um card branco na folha do PDF',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 for(const classname of ['proposal-logo','proposal-header-art']){
  const block=css.match(new RegExp('#printArea \\.'+classname+'\\s*\\{([^}]+)\\}'));
  assert.ok(block,classname+' tem CSS');
  assert.match(block[1],/background:transparent/);
  assert.match(block[1],/padding:0/);
 }
 const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(page,/<img id="proposalHeaderArt" hidden/);
 assert.match(page,/src="\/assets\/civolten-proposal-header\.png"/);
});


test('identidade visual oficial instalada em login, painel e proposta',()=>{
 const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const html=buildProposalHtml(sample,{
  ...options,logoDataUrl:'/assets/civolten-logo.png',
  headerArtUrl:'/assets/civolten-proposal-header.png'
 });
 assert.equal((page.match(/class="brand-logo"/g)||[]).length,2);
 assert.match(page,/rel="icon" type="image\/png" href="\/assets\/civolten-logo\.png"/);
 assert.match(page,/id="proposalHeaderArt" hidden src="\/assets\/civolten-proposal-header\.png"/);
 assert.match(app,/img\.src='\/assets\/civolten-logo\.png'/);
 assert.doesNotMatch(app,/if\(b\.logo_data_url/);
 assert.match(html,/class="proposal-logo" src="\/assets\/civolten-logo\.png"/);
 assert.match(html,/class="proposal-header-art" src="\/assets\/civolten-proposal-header\.png"/);
 assert.doesNotMatch(html,/<div class="proposal-brand-name">/);
});

test('imagens PNG reais presentes no repositorio',()=>{
 const expected=[['civolten-logo.png',1254,1254],['civolten-proposal-header.png',1448,1086]];
 for(const [name,w,h] of expected){
  const png=fs.readFileSync(new URL('../assets/'+name,import.meta.url));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),w);
  assert.equal(png.readUInt32BE(20),h);
 }
});


test('tela de login e painel exibem icone e imagem horizontal no lugar do texto',()=>{
 const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.equal((page.match(/class="brand-logo"/g)||[]).length,2);
 assert.equal((page.match(/class="brand-wordmark"/g)||[]).length,2);
 assert.equal((page.match(/class="brand-wordmark-frame"/g)||[]).length,2);
 assert.equal((page.match(/src="\/assets\/civolten-logo\.png"/g)||[]).length,2);
 assert.equal((page.match(/src="\/assets\/civolten-proposal-header\.png"/g)||[]).length,3);
 assert.doesNotMatch(page,/<b>CIVOLTEN<small>/);
 assert.match(page,/<strong>Painel interno<\/strong>/);
});

test('recorte do nome na tela preserva a arte PNG transparente e se adapta a celular',()=>{
 const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.brand \.brand-wordmark-frame\{/);
 assert.match(css,/\.brand \.brand-wordmark\{/);
 assert.match(css,/overflow:hidden;background:transparent/);
 assert.match(css,/transform:translateY\(-50%\)/);
 assert.match(css,/@media\(max-width:680px\)\{/);
 assert.match(css,/\.sidebar \.brand \.brand-wordmark-frame/);
});

test('impressao espera carregar o icone e o nome e nao depende da tela de login',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(app,/async function printBudget\(\)/);
 assert.match(app,/logoDataUrl:'\/assets\/civolten-logo\.png'/);
 assert.match(app,/headerArtUrl:'\/assets\/civolten-proposal-header\.png'/);
 assert.match(app,/Promise\.all\(\[\.\.\.div\.querySelectorAll\('img'\)\]\.map\(img=>img\.decode\(\)\)\)/);
 assert.match(app,/else if\(action==='print-budget'\)await printBudget\(\)/);
 assert.doesNotMatch(app,/brandLogo\?\.getAttribute\('src'\)/);
 const html=buildProposalHtml(sample,{
   ...options,
   logoDataUrl:'/assets/civolten-logo.png',
   headerArtUrl:'/assets/civolten-proposal-header.png'
 });
 const masthead=html.match(/<header class="proposal-masthead">[\s\S]*?<\/header>/)?.[0]||'';
 assert.match(masthead,/class="proposal-logo" src="\/assets\/civolten-logo\.png"/);
 assert.match(masthead,/class="proposal-header-art" src="\/assets\/civolten-proposal-header\.png"/);
});

test('PDF conserva as duas marcas lado a lado sem cartao branco',()=>{
 const css=fs.readFileSync(new URL('../assets/proposal-print.css',import.meta.url),'utf8');
 const logo=css.match(/#printArea \.proposal-logo\{([^}]+)\}/)?.[1]||'';
 const art=css.match(/#printArea \.proposal-header-art\{([^}]+)\}/)?.[1]||'';
 assert.match(logo,/background:transparent/);
 assert.match(logo,/padding:0/);
 assert.match(art,/background:transparent/);
 assert.match(art,/padding:0/);
 assert.match(art,/transform:translateY\(-50%\)/);
 assert.match(css,/\.proposal-brand-mark\{display:flex/);
});
