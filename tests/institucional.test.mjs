import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../servicos.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/servicos.css',import.meta.url),'utf8');
const cfg=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('landing da CIVOLTEN tem dez serviços atuais sem as ofertas futuras',()=>{
  assert.match(html, /CIVOLTEN/);
  assert.match(html, /Sua obra com/);
  assert.match(html, /rigor técnico/);
  assert.equal((html.match(/class="service-card"/g)||[]).length,10);
  assert.doesNotMatch(html, /Sistemas de segurança|Sistemas de seguran[cç]a|Automa[cç][aã]o residencial|Automa[cç][aã]o predial/i);
  for(const desc of ['Instalações','Manutenção','Iluminação','Energia','Construção','Reformas','Pisos','Pintura','hidráulicos','Alvenaria']){
    assert.match(html,new RegExp(desc,'i'));
  }
});

test('nova página não altera formulário e respeita CSP',()=>{
  assert.match(home,/href="\/servicos"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /site-branding\.js\?v=1/);
  assert.match(html, /id="siteLogo"/);
  assert.match(html, /id="footerLogo"/);
  assert.match(html, /id="siteContactWhatsApp"/);
  assert.doesNotMatch(html, /<style|<script(?![^>]*src=)|\sonclick=|\sstyle=/i);
  assert.ok(css.length>2000);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  const policy=cfg.headers.flatMap(x=>x.headers).find(x=>x.key==='Content-Security-Policy');
  assert.match(policy.value,/img-src[^;]*https:\/\/images\.pexels\.com/);
  assert.doesNotMatch(policy.value,/'unsafe-inline'/);
});
