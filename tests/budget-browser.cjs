// Teste de integração dos orçamentos fictícios no Chromium gratuito.
// Usa exclusivamente cliente Supabase simulado no localhost.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

const {deflateRawSync}=require('node:zlib');
function excelFixture(){
 // Planilha XLSX minima e compactada, sem bibliotecas pagas ou CDN.
 const workbook='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Composicoes" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
 const row=(n,values)=>'<row r="'+n+'">'+values.map((value,i)=>
  '<c r="'+String.fromCharCode(65+i)+n+'" t="inlineStr"><is><t>'+value+'</t></is></c>').join('')+'</row>';
 const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
  row(1,['Codigo','Descricao','Unidade','Profissional','Coeficiente HH'])+
  row(2,['S100','Instalacao eletrica','un','Eletricista','2.25'])+
  '</sheetData></worksheet>';
 const inputs=[['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',rels],
  ['xl/worksheets/sheet1.xml',sheet]];
 const local=[],central=[];let offset=0,centralSize=0;
 const crc32=buffer=>{
  let crc=0xffffffff;
  for(const byte of buffer){crc^=byte;for(let j=0;j<8;j++)
   crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}
  return (crc^0xffffffff)>>>0;
 };
 for(const [name,text] of inputs){
  const data=Buffer.from(text),compressed=deflateRawSync(data),nameBytes=Buffer.from(name);
  const crc=crc32(data);
  const localHeader=Buffer.alloc(30+nameBytes.length);
  localHeader.writeUInt32LE(0x04034b50,0);localHeader.writeUInt16LE(20,4);
  localHeader.writeUInt16LE(8,8);localHeader.writeUInt32LE(crc,14);
  localHeader.writeUInt32LE(compressed.length,18);localHeader.writeUInt32LE(data.length,22);
  localHeader.writeUInt16LE(nameBytes.length,26);nameBytes.copy(localHeader,30);
  local.push(localHeader,compressed);
  const cd=Buffer.alloc(46+nameBytes.length);cd.writeUInt32LE(0x02014b50,0);
  cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(8,10);
  cd.writeUInt32LE(crc,16);cd.writeUInt32LE(compressed.length,20);
  cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(nameBytes.length,28);
  cd.writeUInt32LE(offset,42);nameBytes.copy(cd,46);
  central.push(cd);centralSize+=cd.length;offset+=localHeader.length+compressed.length;
 }
 const eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50,0);
 eocd.writeUInt16LE(inputs.length,8);eocd.writeUInt16LE(inputs.length,10);
 eocd.writeUInt32LE(centralSize,12);eocd.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,eocd]);
}

const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8','.png':'image/png','.svg':'image/svg+xml',
 '.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(file,(err,buffer)=>{
  if(err){res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  res.end(buffer);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},
   isMobile:true,hasTouch:true,acceptDownloads:true});
  page.on('pageerror',err=>errors.push(err.message));
  const login=async()=>{
   await page.locator('.auth-page').waitFor();
   await page.locator('#auth-form [name="email"]').fill('orcamento-test@example.com');
   await page.locator('#auth-form [name="password"]').fill('senha-de-teste-local');
   await page.locator('#auth-form [type="submit"]').click();
   await page.locator('.dashboard').waitFor();
  };
  await page.goto(base,{waitUntil:'networkidle'});
  await login();
  await page.locator('[data-go="costs"]').last().click();
  await page.locator('[data-action="new-cost"]').last().click();
  await page.locator('#record-form [name="name"]').fill('Custo administrativo de teste');
  await page.locator('#record-form [name="amount"]').fill('1000');
  await page.locator('#record-form [type="submit"]').click();
  await page.locator('.cost-row').first().waitFor();
  await page.locator('.bottom-nav [data-go="more"]').click();
  await page.locator('[data-go="company"]').click();
  await page.locator('#company-form [name="taxPct"]').fill('10');
  await page.locator('#company-form [name="marginPct"]').fill('20');
  await page.locator('#company-form [name="productiveDays"]').fill('20');
  await page.locator('#company-form [name="hoursPerDay"]').fill('8');
  await page.locator('#company-form [name="productivePeople"]').fill('2');
  await page.locator('#company-form [type="submit"]').click();
  await page.locator('.pricing-capacity').waitFor();
  await page.locator('.bottom-nav [data-go="home"]').click();
  await page.locator('[data-go="budgets"]').first().click();
  assert.doesNotMatch(await page.locator('.budget-screen').innerText(),/orçamentos de teste|demonstração|serviços fictícios/i);

  assert.equal(await page.locator('.budget-demo-flag').count(),0,'Novo orçamento não deve ser marcado como fictício');
  assert.equal(await page.locator('.budget-list-item').count(),0);
  await page.locator('[data-go="catalog"]').first().click();
  assert.ok((await page.locator('#catalog-import-file').getAttribute('accept')).includes('.xls'));

  assert.equal(await page.locator('.catalog-screen').count(),1);
  assert.match(await page.locator('.fin-empty').last().innerText(),/Nenhum servico cadastrado/);
  const content='Codigo;Descricao;Unidade;Profissional;Coeficiente HH;Preco de tabela\n'+
   'A100;Quadro de distribuicao;un;Eletricista;5;999,99\n'+
   'B200;Pintura de parede;m²;Pintor;0,4;12,50\n';
  await page.locator('#catalog-import-file').setInputFiles({
   name:'siurb-composicoes.csv',mimeType:'text/csv',buffer:Buffer.from(content)});
  await page.locator('#catalog-import-sheet').waitFor();
  await page.locator('#catalog-import-month').fill('2026-07');
  assert.equal(await page.locator('[data-catalog-map="hours"]').inputValue(),'4');
  await page.locator('[data-action="catalog-import-save"]').click();
  await page.locator('.catalog-row').first().waitFor();
  assert.equal(await page.locator('.catalog-row').count(),2);
  assert.match(await page.locator('.catalog-list').innerText(),/Quadro de distribuicao/);
  assert.equal((await page.evaluate(()=>window.CIVOLTENPreview.data.catalog))[0].directCost,null);
  assert.equal((await page.evaluate(()=>window.CIVOLTENPreview.data.catalog))[0].roles[0].hours,5);

  // XLSX real (ZIP Deflate + XML), validando a importacao direta da planilha.
  await page.locator('#catalog-import-file').setInputFiles({
   name:'sinapi-composicoes.xlsx',
   mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   buffer:excelFixture()});
  await page.locator('#catalog-import-sheet').waitFor();
  await page.locator('#catalog-import-source').selectOption('sinapi');
  await page.locator('#catalog-import-month').fill('2026-10');
  await page.locator('[data-action="catalog-import-save"]').click();
  await page.locator('.catalog-row').nth(2).waitFor();
  const importedCatalog=await page.evaluate(()=>window.CIVOLTENPreview.data.catalog);
  assert.equal(importedCatalog.length,3);
  assert.equal(importedCatalog.find(x=>x.code==='SINAPI:S100').roles[0].hours,2.25);
  assert.equal(importedCatalog.find(x=>x.code==='SINAPI:S100').directCost,null);

  await page.locator('[data-go="budgets"]').last().click();
  await page.locator('[data-action="budget-new"]').click();
  await page.locator('#budget-form [name="customer"]').fill('Cliente fictício');
  await page.locator('#budget-form [name="paymentTerms"]').fill('40% na assinatura e 60% na entrega');
  await page.locator('#budget-form [name="executionTerm"]').fill('Até 18 dias úteis após liberação');
  await page.locator('#budget-form [name="warrantyTerms"]').fill('Conforme contrato');
  await page.locator('#budget-form [name="project"]').fill('Reforma do Centro Comercial');
  // Os serviços vêm do catálogo sincronizado com o Supabase e devem ser pesquisáveis.
  assert.equal(await page.locator('.budget-catalog-row').count(),3);
  const colors=await page.locator('.budget-catalog-row').evaluateAll(rows=>
   rows.slice(0,3).map(row=>getComputedStyle(row).backgroundColor));
  assert.equal(colors[0],'rgb(255, 255, 255)','Primeira linha com fundo branco');
  assert.notEqual(colors[1],colors[0],'Segunda linha com fundo escuro');
  assert.equal(colors[2],colors[0],'Terceira linha novamente branca');
  await page.locator('#budget-catalog-search').fill('quadro');
  assert.equal(await page.locator('.budget-catalog-row').count(),1);
  assert.match(await page.locator('.budget-catalog-row').first().innerText(),/Quadro de distribuicao/);
  await page.locator('#budget-catalog-search').fill('a100');
  assert.equal(await page.locator('.budget-catalog-row').count(),1,'Pesquisa por codigo');
  await page.locator('#budget-catalog-search').fill('servico inexistente');
  assert.equal(await page.locator('.budget-catalog-row').count(),0);
  await page.locator('[data-action="budget-catalog-clear"]').click();
  assert.equal(await page.locator('.budget-catalog-row').count(),3);
  await page.locator('[data-action="budget-choose-service"][data-code="SIURB:A100"]').click();
  assert.equal(await page.locator('#budget-service-form').count(),1);
  assert.equal(await page.locator('.budget-item').count(),0,'Abrir o modal não deve adicionar o serviço');
  assert.equal(await page.locator('#budget-service-form [name="quantity"]').inputValue(),'1');
  assert.equal(await page.locator('#budget-service-form [name="laborHours"]').inputValue(),'5');
  assert.equal(await page.locator('#budget-service-form [name="directCost"]').count(),0,'Não pedir material em nova proposta');
  assert.match(await page.locator('.budget-labor-scope').innerText(),/Somente mão de obra/);
  assert.match(await page.locator('#budget-service-estimate').innerText(),/Despesa mensal da empresa/);
  assert.match(await page.locator('#budget-service-estimate').innerText(),/Custo por HH/);
  assert.match(await page.locator('#budget-service-estimate').innerText(),/PREÇO TOTAL DOS 1 un/);
  await page.locator('#budget-service-form [name="laborHours"]').fill('6');
  assert.match(await page.locator('#budget-service-estimate').innerText(),/6 HH\/un = 6 HH/);
  await page.locator('#budget-service-form [name="laborHours"]').fill('5');
   await page.locator('#budget-service-form [name="quantity"]').fill('150');
   const totalBox=await page.locator('#budget-service-estimate').innerText();
   assert.match(totalBox,/150 un × 5 HH\/un = 750 HH/);
   assert.match(totalBox,/PREÇO TOTAL DOS 150 un/);
   const advertisedTotal=await page.locator('.budget-full-quote strong').innerText();
   assert.notEqual(advertisedTotal,'R$ 0,00');
   await page.locator('#budget-service-form [name="quantity"]').fill('1');
  assert.equal(await page.locator('#budget-service-form [name="description"]').inputValue(),'Quadro de distribuicao');
  await fs.promises.mkdir(path.join(__dirname,'../test-artifacts'),{recursive:true});
  await page.screenshot({path:'test-artifacts/orcamento-modal-servico.png',fullPage:true});
  await page.locator('#budget-service-form [data-action="close-modal"]').click();
  assert.equal(await page.locator('.budget-item').count(),0,'Cancelar o modal não insere item');
  // O mesmo serviço pode ser cadastrado com validação antes de alterar o rascunho.
  await page.locator('[data-action="budget-choose-service"][data-code="SIURB:A100"]').click();
  await page.locator('#budget-service-form [name="quantity"]').fill('0');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.match(await page.locator('#budget-service-error').innerText(),/quantidade válido/);
  assert.equal(await page.locator('.budget-item').count(),0);
  await page.locator('#budget-service-form [name="quantity"]').fill('2');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.equal(await page.locator('.budget-item').count(),1);
  assert.match(await page.locator('.budget-item').first().innerText(),/2 un/);
  assert.equal(await page.locator('.budget-item input').count(),0,'A lista fica compacta, sem formulário embutido');
  await page.locator('[data-action="budget-edit-item"]').first().click();
  assert.match(await page.locator('.modal-heading h2').innerText(),/Editar serviço/);
  assert.equal(await page.locator('#budget-service-form [name="quantity"]').inputValue(),'2');
  await page.locator('#budget-service-form [name="quantity"]').fill('4');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.match(await page.locator('.budget-item').first().innerText(),/4 un/);
  await page.locator('#budget-catalog-search').fill('pintura');
  assert.equal(await page.locator('.budget-catalog-row').count(),1);
  await page.locator('[data-action="budget-choose-service"][data-code="SIURB:B200"]').click();
  await page.locator('#budget-service-form [name="quantity"]').fill('1');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.equal(await page.locator('.budget-item').count(),2);
  assert.match(await page.locator('.budget-item').last().innerText(),/somente mão de obra/);
  // Equipe atual = 2; uma obra longa precisa retornar dias e equipe, sem erro vermelho.
  await page.locator('[data-action="budget-edit-item"]').first().click();
  await page.locator('#budget-service-form [name="quantity"]').fill('2500');
  await page.locator('#budget-service-form [type="submit"]').click();
  const longText=await page.locator('#budget-schedule-preview').innerText();
  assert.match(longText,/Prazo com a equipe atual/);
  assert.match(longText,/Como reduzir o prazo/);
  assert.doesNotMatch(longText,/Prazo estimado excede 730/);
  await page.locator('[data-action="budget-edit-item"]').first().click();
  await page.locator('#budget-service-form [name="quantity"]').fill('4');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.match(await page.locator('#budget-schedule-preview').innerText(),/Duração estimada/);
  assert.match(await page.locator('#budget-schedule-preview').innerText(),/Profissionais usados no cálculo/);
  await page.locator('[data-schedule-field="goal"]').selectOption('days');
  await page.locator('[data-schedule-field="days"]').fill('20');
  assert.match(await page.locator('#budget-schedule-preview').innerText(),/20 dias úteis/);
  assert.match(await page.locator('#budget-schedule-preview').innerText(),/Custo diário da empresa/);
  await page.locator('[data-schedule-field="pricingMode"]').selectOption('days');
  assert.match(await page.locator('#budget-price-preview').innerText(),/Por dias de execução/);
  // A proposta respeita o prazo comercial manual até o usuário decidir substituí-lo.
  page.once('dialog',d=>d.dismiss());
  await page.locator('[data-action="budget-schedule-term"]').click();
  assert.equal(await page.locator('#budget-form [name="executionTerm"]').inputValue(),
   'Até 18 dias úteis após liberação');
  await page.locator('#budget-form [name="executionTerm"]').fill('');
  await page.locator('[data-action="budget-schedule-term"]').click();
  assert.match(await page.locator('#budget-form [name="executionTerm"]').inputValue(),
   /20 dias úteis estimados/);
  const downloadPlan=page.waitForEvent('download');
  await page.locator('[data-action="budget-schedule-export"]').click();
  assert.match((await downloadPlan).suggestedFilename(),/cronograma-preliminar.csv/);
  // O cronograma A4 tem um botão separado do CSV para a equipe marcar em campo.
  await page.evaluate(()=>{
   window.__fieldScheduleHtml='';
   window.print=()=>{
    window.__fieldScheduleHtml=document.querySelector('#field-schedule-print-root')?.innerHTML||'';
    window.dispatchEvent(new Event('afterprint'));
   };
  });
  await page.locator('[data-action="budget-schedule-pdf"]').click();
  await page.waitForFunction(()=>Boolean(window.__fieldScheduleHtml));
  const fieldHtml=await page.evaluate(()=>window.__fieldScheduleHtml);
  assert.match(fieldHtml,/CRONOGRAMA DE CAMPO/);
  assert.match(fieldHtml,/field-schedule-check/);
  assert.match(fieldHtml,/20 dias úteis/);
  assert.match(fieldHtml,/civolten-logo.png/);
  assert.doesNotMatch(fieldHtml,/Valor contratado|R\\$/);
  assert.equal(await page.locator('#field-schedule-print-root').count(),0);
  assert.match(await page.locator('#budget-price-preview').innerText(),/Preço final para o cliente/);
  await fs.promises.mkdir(path.join(__dirname,'../test-artifacts'),{recursive:true});
  await page.screenshot({path:'test-artifacts/orcamento-editor.png',fullPage:true});
  await page.locator('#budget-form [type="submit"]').click();
  await page.locator('.budget-list-item').first().waitFor();
  assert.equal(await page.locator('.budget-list-item').count(),1);
  await page.locator('[data-action="budget-open"]').first().click();
  assert.equal(await page.locator('.budget-item').count(),2);
  assert.equal(await page.locator('[data-schedule-field="goal"]').inputValue(),'days');
  assert.equal(await page.locator('[data-schedule-field="days"]').inputValue(),'20');
  assert.equal(await page.locator('[data-schedule-field="pricingMode"]').inputValue(),'days');
  assert.match(await page.locator('#budget-price-preview').innerText(),/Por dias de execução/);
  assert.doesNotMatch(await page.locator('.budget-print').innerText(),/DOCUMENTO DE TESTE|DEMONSTRAÇÃO · NÃO ENVIAR/);
  assert.match(await page.locator('.budget-pdf-model-label').innerText(),/Signature/);
  assert.equal(await page.locator('.proposal-page').count(),3);
  assert.equal(await page.locator('.proposal-cover-background').count(),1);
  assert.equal(await page.locator('.proposal-services .proposal-cover-background').count(),0);
  assert.match(await page.locator('.proposal-cover-background').getAttribute('src'),/file_000000007df8820eb700b32dbfca9c55\.png/);
  assert.match(await page.locator('.proposal-conditions').innerText(),/40% na assinatura/);
  assert.match(await page.locator('.proposal-conditions').innerText(),/EXCLUSIVAMENTE DE MÃO DE OBRA/);
  assert.equal((await page.evaluate(()=>window.CIVOLTENPreview.data.budgets))[0].commercial.laborOnly,true);
  assert.match(await page.locator('.proposal-conditions').innerText(),/20 dias úteis estimados/);
  assert.doesNotMatch(await page.locator('.proposal-services').innerText(),/R\$\s*[\d.]/);
  assert.match(await page.locator('.proposal-conditions').innerText(),/R\$\s*[\d.]/);
  assert.match(await page.locator('link[rel="stylesheet"]').getAttribute('href'),/civolten-cronograma-pdf-campo-20261109/);
  assert.match(await page.locator('script[src*="app.js"]').getAttribute('src'),/civolten-cronograma-pdf-campo-20261109/);
  await page.evaluate(()=>{
   window.print=()=>{window.__civoltenPrintTest={
    v5:!!document.querySelector('.budget-print.budget-pdf-v5'),
    pages:document.querySelectorAll('.proposal-page').length,
    logo:!!document.querySelector('.proposal-wordmark'),
    watermark:!!document.querySelector('.proposal-watermark')
   }};
  });
  await page.locator('[data-action="budget-print"]').click();
  assert.deepEqual(await page.evaluate(()=>window.__civoltenPrintTest),
   {v5:true,pages:3,logo:true,watermark:true},'O botão deve chamar o Signature novo');
  // Exportação PDF real (sem chamar impressão do Android), validando o modelo escolhido.
  await page.emulateMedia({media:'print'});
  const marks=await page.locator('.proposal-wordmark,.proposal-brand-icon,.proposal-watermark img')
   .evaluateAll(list=>list.map(img=>({ok:img.complete&&img.naturalWidth>0,src:img.getAttribute('src')})));
  assert.equal(marks.length,12,'Logo e marca-d’água em cada uma das três páginas');
  assert.ok(marks.every(m=>m.ok),'O PDF não pode sair sem as imagens oficiais');
  const photo=await page.locator('.proposal-cover-background').evaluate(img=>({
   loaded:img.complete&&img.naturalWidth>0,ratio:img.naturalWidth/img.naturalHeight,
   coverage:img.getBoundingClientRect().width/img.parentElement.getBoundingClientRect().width,
   position:getComputedStyle(img).position,fit:getComputedStyle(img).objectFit
  }));
  assert.ok(photo.loaded,'A imagem PNG enviada ao GitHub deve carregar antes do PDF');
  assert.equal(photo.position,'absolute');
  assert.equal(photo.fit,'cover');
  assert.ok(photo.coverage>.99&&photo.coverage<1.01,'O fundo fotográfico ocupa a largura A4 inteira');
  const helmet=await page.locator('.proposal-cover>.proposal-helmet-brand').evaluate(node=>{
   const pageBox=node.parentElement.getBoundingClientRect(),box=node.getBoundingClientRect();
   const images=[...node.querySelectorAll('img')];
   return {
    images:images.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0})),
    left:(box.left-pageBox.left)/pageBox.width,
    top:(box.top-pageBox.top)/pageBox.height,
    blend:getComputedStyle(node).mixBlendMode
   };
  });
  assert.equal(helmet.images.length,2,'Capacete deve ter símbolo e logotipo oficiais');
  assert.ok(helmet.images.every(img=>img.loaded),'Marca no capacete deve carregar no PDF');
  assert.ok(helmet.images[0].src.endsWith('/civolten-simbolo.png'));
  assert.ok(helmet.images[1].src.endsWith('/civolten-logo.png'));
  assert.ok(helmet.left>.70&&helmet.left<.90,'Logo deve ficar na área do capacete, à direita');
  assert.ok(helmet.top>.56&&helmet.top<.73,'Logo deve ficar sobre o capacete, não em outro setor');
  assert.equal(helmet.blend,'multiply','Marca deve parecer impressa na superfície do capacete');
  assert.equal(await page.locator('.proposal-watermark').first().evaluate(el=>getComputedStyle(el).position),'absolute');
  assert.equal(await page.locator('.proposal-cover .proposal-page-content').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  const coverFont=await page.locator('.proposal-cover-card').evaluate(card=>{
   const values=[...card.querySelectorAll('.proposal-cover-info-row em')];
   const project=values[1],client=values[0];
   const box=card.getBoundingClientRect(),
    footer=card.closest('.proposal-cover').querySelector('.proposal-cover-bottom').getBoundingClientRect();
   return {
    project:parseFloat(getComputedStyle(project).fontSize),
    client:parseFloat(getComputedStyle(client).fontSize),
    fit:box.bottom<footer.top
   };
  });
  assert.ok(coverFont.project>coverFont.client,'Obra / Local deve se destacar na capa');
  assert.ok(coverFont.client>14,'Os dados do cliente devem estar maiores e legíveis');
  assert.ok(coverFont.fit,'O cartão de informações não pode encobrir o rodapé da capa');
  await page.screenshot({path:'test-artifacts/proposta-signature-preview.png',fullPage:true});
  const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
  await fs.promises.writeFile('test-artifacts/proposta-signature-3-paginas.pdf',pdf);
  const pageCount=bytes=>(Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  assert.equal(pageCount(pdf),3,'Proposta de dois serviços deve ter exatamente 3 páginas A4');
  await page.emulateMedia({media:'screen'});
  const pending=page.waitForEvent('download');
  await page.locator('[data-action="budget-export"]').click();
  assert.match((await pending).suggestedFilename(),/orcamento-civolten\.csv/);
  await page.locator('[data-action="budget-edit-item"]').first().click();
  await page.locator('#budget-service-form [name="quantity"]').fill('3');
  await page.locator('#budget-service-form [type="submit"]').click();
  await page.locator('#budget-form [type="submit"]').click();
  await page.locator('.budget-list-item').first().waitFor();
  await page.reload({waitUntil:'networkidle'});
  await login();
  await page.locator('[data-go="budgets"]').first().click();
  assert.equal(await page.locator('.budget-list-item').count(),1);
  await page.locator('[data-action="budget-open"]').first().click();
  assert.match(await page.locator('.budget-item').first().innerText(),/3 un/);
  await page.locator('[data-action="budget-edit-item"]').first().click();
  assert.equal(await page.locator('#budget-service-form [name="quantity"]').inputValue(),'3');
  await page.locator('#budget-service-form [data-action="close-modal"]').click();
  assert.equal(await page.locator('#budget-form [name="paymentTerms"]').inputValue(),'40% na assinatura e 60% na entrega');
  assert.match(await page.locator('#budget-form [name="executionTerm"]').inputValue(),/20 dias úteis estimados/);
  // Fluxo completo da prestação de mão de obra: aceite -> OS -> execução -> HH -> medição -> recebível.
  await page.locator('.bottom-nav [data-go="team"]').click();
  await page.locator('[data-action="new-employee"]').click();
  await page.locator('#record-form [name="name"]').fill('Profissional eletricista');
  await page.locator('#record-form [name="role"]').fill('Eletricista');
  await page.locator('#record-form [name="salary"]').fill('2800');
  await page.locator('#record-form [type="submit"]').click();
  await page.locator('.employee-card').first().waitFor();
  await page.locator('.bottom-nav [data-go="home"]').click();
  await page.locator('[data-go="budgets"]').first().click();
  await page.locator('[data-action="work-approve-budget"]').first().click();
  assert.equal(await page.locator('#work-form [name="acceptanceRef"]').count(),1);
  await page.locator('#work-form [name="acceptanceRef"]').fill('Aceite registrado por e-mail do cliente');
  await page.locator('#work-form [name="acceptanceConfirmed"]').check();
  await page.locator('#work-form [type="submit"]').click();
  await page.locator('.work-header').waitFor();
  assert.equal(await page.locator('[data-action="work-start"]').count(),1);
  assert.equal(await page.locator('.work-line').count(),2);
  assert.equal((await page.evaluate(()=>window.CIVOLTENPreview.data.works)).length,1);
  // Conferir o botão real do Android antes de iniciar a obra.
  await page.evaluate(()=>{
   window.__civoltenOSPrintHtml='';
   window.print=()=>{
    window.__civoltenOSPrintHtml=document.querySelector('#work-print-root')?.innerHTML||'';
    window.dispatchEvent(new Event('afterprint'));
   };
  });
  await page.locator('[data-action="work-contract-print"]').click();
  await page.waitForFunction(()=>Boolean(window.__civoltenOSPrintHtml));
  const osHtml=await page.evaluate(()=>window.__civoltenOSPrintHtml);
  assert.match(osHtml,/work-pdf-header/);
  assert.ok(osHtml.includes('/assets/civolten-logo.png'));
  assert.ok(osHtml.includes('/assets/civolten-simbolo.png'));
  assert.match(osHtml,/SERVIÇO/);
  assert.match(osHtml,/Representante da CIVOLTEN/);
  assert.ok(!osHtml.includes('Valor contratado')&&!osHtml.includes('R$')&&!osHtml.includes('selling'),
   'A OS não deve conter valores administrativos');
  assert.equal(await page.locator('#work-print-root').count(),0,'Impressão limpa após fechar prévia');
  // O cronograma da obra deve usar a proposta congelada e as datas da OS.
  await page.evaluate(()=>{
   window.__workScheduleHtml='';
   window.print=()=>{
    window.__workScheduleHtml=document.querySelector('#field-schedule-print-root')?.innerHTML||'';
    window.dispatchEvent(new Event('afterprint'));
   };
  });
  await page.locator('[data-action="work-schedule-print"]').click();
  await page.waitForFunction(()=>Boolean(window.__workScheduleHtml));
  const workSchedule=await page.evaluate(()=>window.__workScheduleHtml);
  assert.match(workSchedule,/CRONOGRAMA DE CAMPO/);
  assert.match(workSchedule,/field-schedule-checkout/);
  assert.match(workSchedule,/civolten-simbolo.png/);
  assert.doesNotMatch(workSchedule,/Valor contratado|R\\$/);
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="work-start"]').click();
  await page.locator('[data-action="work-log-new"]').waitFor();
  await page.locator('[data-action="work-log-new"]').click();
  await page.locator('#work-form [name="hours"]').fill('8');
  await page.locator('#work-form [type="submit"]').click();
  await page.locator('.work-lines').last().getByText('Profissional eletricista').waitFor();
  assert.equal((await page.evaluate(()=>window.CIVOLTENPreview.data.workLogs)).length,1);
  await page.locator('[data-action="work-measure-new"]').click();
  await page.locator('#work-form [name="quantity"]').fill('3');
  await page.locator('#work-form [type="submit"]').click();
  await page.locator('[data-action="work-measure-approve"]').first().waitFor();
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="work-measure-approve"]').first().click();
  await page.locator('[data-action="work-measure-bill"]').first().waitFor();
  await page.locator('[data-action="work-measure-bill"]').first().click();
  await page.locator('#work-form [name="dueDate"]').fill('2026-12-05');
  await page.locator('#work-form [type="submit"]').click();
  await page.locator('.work-header').waitFor();
  const billed=await page.evaluate(()=>window.CIVOLTENPreview.data.ledger);
  assert.equal(billed.length,1,'Gerou só uma conta a receber gerencial');
  assert.equal(billed[0].paidDate,null,'Cobrança não equivale a recebimento');
  assert.match(billed[0].reference,/^MED:/);
  await page.locator('[data-action="work-measure-new"]').click();
  assert.equal(await page.locator('#work-form [name="itemId"] option').count(),1,
   'Serviços com quantidade totalmente medida deixam de estar disponíveis');
  await page.locator('#work-form [name="quantity"]').fill('1');
  await page.locator('#work-form [type="submit"]').click();
  await page.locator('[data-action="work-measure-approve"]').first().waitFor();
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="work-measure-approve"]').first().click();
  await page.locator('[data-action="work-complete"]').waitFor();
  assert.equal(await page.locator('[data-action="work-complete"]').isDisabled(),false);
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="work-complete"]').click();
  assert.match(await page.locator('.work-header').innerText(),/Concluída/);
  const downloadWork=page.waitForEvent('download');
  await page.locator('[data-action="work-export"]').click();
  assert.match((await downloadWork).suggestedFilename(),/civolten-obra-/);
  await page.reload({waitUntil:'networkidle'});
  await login();
  await page.locator('[data-go="works"]').first().click();
  await page.locator('[data-action="work-open"]').first().click();
  assert.match(await page.locator('.work-header').innerText(),/Concluída/);
  assert.equal(await page.locator('.work-line').count(),5,
   'Duas linhas de serviço, duas medições e um apontamento reais persistidos');
  await page.locator('.bottom-nav [data-go="home"]').click();
  await page.locator('[data-go="budgets"]').first().click();
  await page.locator('[data-action="budget-open"]').first().click();
  await page.locator('[data-action="budget-delete"]').click();
  assert.equal(await page.locator('.budget-item').count(),2,
   'O orçamento vinculado ao contrato não pode ser apagado');
  assert.equal(await page.locator('.budget-list-item').count(),0,
   'O orçamento continua aberto para leitura');

  assert.deepEqual(errors,[],'Não pode haver erros no navegador');
  console.log('PASSOU: serviços CIVOLTEN, HH por unidade, orçamento, PDF, cronograma, banco simulado e CSV.');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
