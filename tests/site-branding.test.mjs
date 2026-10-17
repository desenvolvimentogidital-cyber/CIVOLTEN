import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PDFDocument} from 'pdf-lib';
import {generateQuotePdf} from '../lib/civolten-pdf.mjs';

test('visual público não mostra nome escrito nem ícone substituto',()=>{
 const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const proposal=readFileSync(new URL('../proposta.html',import.meta.url),'utf8');
 for(const html of [home,proposal]){
  assert.doesNotMatch(html,/<div class="brand">|⚡ CIVOL<b>TEN<\/b>/);
  assert.match(html,/Logo CIVOLTEN/);
 }
 assert.match(home,/siteSettingsToggle/);
 assert.match(proposal,/assets\/proposta.css/);
 assert.doesNotMatch(proposal,/<style>|style="/);
});
test('identidade pública não inclui rotas privilegiadas, nem insumos e preços',()=>{
 const edge=readFileSync(new URL('../supabase/functions/civolten-beta/index.ts',import.meta.url),'utf8');
 const js=readFileSync(new URL('../assets/site-branding.js',import.meta.url),'utf8');
 assert.match(edge,/api==='site-branding'/);
 assert.match(edge,/select\('logo_data_url,logo_width_px,color_primary,color_accent,site_headline,site_description,footer_note,contact_whatsapp'\)/);
 assert.match(js,/siteLogo/);
 assert.match(js,/proposalLogo/);
 assert.match(js,/footerLogo/);
 assert.match(js,/siteHeadline/);
 assert.match(js,/siteDescription/);
 assert.match(js,/--brand-logo-width/);
 assert.doesNotMatch(js,/innerHTML|unit_cost|service_role|access_token|localStorage/);
 new vm.Script(js);
});
test('PDF com logo é válido, preserva dimensões e não contém raio substituto',async()=>{
 const model={
  pedido:{id:'a0912d32-4444-4444-8444-444444444444',customer_name:'Cliente Modelo',
   description:'Reforma e pintura do escritório completo',request_details:{itens:[]},estimate_min:420,estimate_max:420},
  simulacao:{total_bruto:420,itens:[]},servicos:[],
  branding:{company_name:'CIVOLTEN',color_primary:'#08182B',color_accent:'#DCA629',logo_width_px:210,
   logo_data_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='}
 };
 const bytes=await generateQuotePdf(model,'preview');
 assert.ok(bytes.length>1000);
 const document=await PDFDocument.load(bytes);
 assert.ok(document.getPageCount()>0);
 const source=readFileSync(new URL('../lib/civolten-pdf.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/else bolt\(|text\(wrap\(company|text\('ELÉTRICA/);
 assert.match(source,/scaleToFit/);
});
test('admin valida tamanho de logo e campos de identidade',()=>{
 const code=readFileSync(new URL('../supabase/functions/civolten-beta/quote-extra.ts',import.meta.url),'utf8');
 assert.match(code,/logo_width_px:width/);
 assert.match(code,/site_headline:headline/);
 assert.match(code,/contact_whatsapp:phone/);
});
