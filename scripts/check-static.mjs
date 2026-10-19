import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const occurrences = (text, pattern) => [...text.matchAll(pattern)].length;
assert.match(html, /CIVOLTEN/i);
assert.equal(occurrences(html, /<\/html>/gi), 1, "Documento HTML duplicado ou truncado");
assert.equal(occurrences(html, /<script\b[^>]*>/gi), 9, "O site deve carregar marca, base SIURB, painel, formulário e visual premium");
assert.equal(occurrences(html, /<\/script>/gi), 9, "Scripts não podem ser truncados");
assert.match(html, /<script src="\/assets\/civolten\.js(?:\?v=[0-9]+)?" defer><\/script>/i);
assert.match(html, /<script src="\/assets\/civolten-pro\.js(?:\?v=[0-9]+)?" defer><\/script>/i);
assert.match(html, /<link rel="stylesheet" href="\/assets\/civolten-app-unificado\.css\?v=[0-9]+"/i);
assert.doesNotMatch(html,/siurb-public-lookup|siurbPublicQuery|siurbPublicSearch|siurbPublicResults/, 'Busca separada do cliente deve estar ausente');
assert.match(html,/id="lines"/, 'Seletor de serviços deve continuar na página');
assert.doesNotMatch(html, /<script>([\s\S]*?)<\/script>|<style>|\sonclick=/i, "HTML não pode conter JS/CSS inline");
for (const id of ["client", "lines", "add", "simulate", "catalogstatus", "retryCatalog", "pricingArea"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Campo ausente: " + id);
}
assert.doesNotMatch(html, /BRL\(s\[padrao\]\)/, "Preço unitário exibido junto com o serviço");
assert.doesNotMatch(html, /s\.subtotal_servicos|s\.taxa_logistica|s\.sobretaxa_distancia|s\.imposto/, "Custos internos exibidos ao cliente");

assert.match(html,/id="siteLogo"/);
assert.match(html,/id="footerLogo"/);
assert.match(html,/id="siteSettings"/);
assert.doesNotMatch(html,/<div class="brand">|⚡ CIVOL<b>TEN<\/b>/);
assert.match(html,/href="\/privacidade\.html"/);
assert.match(html,/site-branding\.js\?v=(?:1|2)/);
assert.doesNotMatch(fs.readFileSync("proposta.html","utf8"),/<style>|style=|class="brand"/,"Proposta deve cumprir CSP sem nome ou ícone na marca");
const brandScript=fs.readFileSync("assets/site-branding.js","utf8");
new vm.Script(brandScript,{filename:"site-branding.js"});
assert.doesNotMatch(brandScript,/innerHTML|sessionStorage|localStorage/);
const script = fs.readFileSync("assets/civolten.js","utf8");
const css=fs.readFileSync("assets/civolten.css","utf8");
assert.doesNotMatch(css,/\.siurb-public-lookup/, 'CSS de busca pública antiga deve estar ausente');
assert.doesNotMatch(script,/api=siurb-search|siurbPublicResults/, 'JS não deve manter a busca separada');
assert.ok(css.length>200);
assert.doesNotMatch(script, /sessionStorage\.(?:setItem|getItem)|localStorage\.(?:setItem|getItem)|\.access_token/,"JWT nunca no JS");
new vm.Script(script, {filename:"index.html"});
const pro=fs.readFileSync("assets/civolten-pro.js","utf8");
new vm.Script(pro,{filename:"civolten-pro.js"});
const reference=fs.readFileSync('assets/civolten-reference.js','utf8');
new vm.Script(reference,{filename:'civolten-reference.js'});
assert.match(html,/civolten-reference\.js\?v=1/);
assert.doesNotMatch(reference,/innerHTML|localStorage|sessionStorage|\.access_token/);
new vm.Script(fs.readFileSync("assets/proposta.js","utf8"),{filename:"proposta.js"});
assert.doesNotMatch(pro,/innerHTML|sessionStorage|localStorage|\.access_token/);

const matrix=JSON.parse(fs.readFileSync("app-nextjs/data/matriz-precos.json","utf8"));
assert.equal(Object.keys(matrix.servicos).length, 17);
assert.equal(matrix.servicos.reforma_apartamento_completa.medio, 2500);
assert.equal(matrix.servicos.instalacao_eletrica_completa.unidade, "m²");
const backend=fs.readFileSync("supabase/functions/civolten-beta/index.ts","utf8");
const cookieServer=fs.readFileSync("api/session.mjs","utf8");
const proxyServer=fs.readFileSync("api/admin.mjs","utf8");
assert.match(cookieServer,/HttpOnly|sessionCookie/);
assert.match(proxyServer,/cookieToken/);
assert.match(backend,/['"]owner['"],['"]admin['"]|['"]admin['"],['"]owner['"]/);
assert.match(backend,/b\.consent!==true/);
assert.match(script,/privacy_version:'2026-10'/);
assert.match(backend,/createSignedUrl\(path,300,\{download:true\}\)/);
for(const f of ["api/session.mjs","api/admin.mjs","lib/civolten-security.mjs"])assert.match(fs.readFileSync(f,"utf8"),/export/);
assert.doesNotMatch(backend, /baixo:Number\(x\.baixo\)/, "Preços na API pública");

class Node {
  constructor(type="div") {
    this.tagName=type.toUpperCase();this.children=[];this.dataset={};this.attrs={};
    this.className="";this._value="";this._text="";this.firstChild={textContent:""};
    this._classes=new Set();
    this.classList={
      add: x=>this._classes.add(x),
      remove: x=>this._classes.delete(x),
      contains: x=>this._classes.has(x),
      toggle: (x,force)=>{
        const on=force===undefined?!this._classes.has(x):!!force;
        if(on)this._classes.add(x);else this._classes.delete(x);
        return on;
      }
    };
  }
  setAttribute(key,value){this.attrs[key]=value}
  append(...children){for(const child of children){child.parent=this;this.children.push(child)}}
  appendChild(child){this.append(child);return child}
  replaceChildren(...children){this.children=[];this.append(...children)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  querySelector(tag){
    for(const child of this.children){
      if(child.tagName===tag.toUpperCase())return child;
      const nested=child.querySelector?.(tag);if(nested)return nested;
    }
    return null;
  }
  querySelectorAll(selector){return selector===".line"?this.children.filter(x=>x.className==="line"):[]}
  cloneNode(deep=false){
    const copy=new Node(this.tagName);
    copy.className=this.className;
    copy.attrs={...this.attrs};
    copy.label=this.label;
    copy.value=this.value;
    copy.textContent=this.textContent;
    if(deep)for(const c of this.children)copy.appendChild(c.cloneNode(true));
    return copy;
  }
  dispatchEvent(event){if(event.type==="change")this.onchange?.(event)}
  get value(){return this._value} set value(v){this._value=String(v)}
  get textContent(){return this._text} set textContent(v){
    this._text=String(v);this.firstChild={textContent:String(v)};
  }
  get lastElementChild(){return this.children.at(-1)}
}
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
function fixture(online){
  const elements=new Map(ids.map(id=>[id,new Node()]));
  // O DOM simulado não interpreta valores iniciais do HTML.
  elements.get('days').value='1';elements.get('km').value='0';
  const patterns=["baixo","medio","alto"].map(p=>{const n=new Node("button");n.dataset.p=p;return n;});
  const document={
    getElementById:id=>elements.get(id)||null,
    createElement:type=>new Node(type),
    querySelectorAll:selector=>selector==="[data-p]"?patterns:selector==="#lines .line"?elements.get("lines").children:[]
  };
  const remote=[{id:"reforma_apartamento_completa",descricao:"Reforma completa de apartamento",unidade:"m²",categoria:"construcao_civil"},{id:"instalacao_eletrica_completa",descricao:"Instalação elétrica completa",unidade:"m²",categoria:"instalacoes_eletricas"}];
  const fetch=async url=>{
    if(!online)throw Error("Offline temporário");
    if(url.includes("api=catalog"))return {ok:true,json:async()=>({catalogo:remote})};
    if(url.includes("api=simulate"))return {ok:true,json:async()=>({simulacao:{total_bruto:111767.68,aviso:"Estimativa sujeita a avaliação técnica"}})};
    throw Error("Endpoint não mockado: "+url);
  };
  const sessionStorage={
    getItem(){throw Error("Storage bloqueado pelo navegador")},
    setItem(){throw Error("Storage bloqueado pelo navegador")},
    removeItem(){throw Error("Storage bloqueado pelo navegador")}
  };
  const ctx=vm.createContext({document,fetch,sessionStorage,window:{},console,Event:class Event{constructor(type){this.type=type}}});
  vm.runInContext(script,ctx);
  return elements;
}
for(const online of [true,false]){
  const elements=fixture(online);
  for(let i=0;i<20;i++)await Promise.resolve();
  const rows=elements.get("lines").children;
  assert.equal(rows.length,1,"O formulário deve aparecer automaticamente");
  const first=rows[0];
  assert.equal(first.querySelector("select").value,"","Exigir escolha explícita de serviço");
  assert.equal(first.querySelector("input").value,"1","Mostrar campo de quantidade");
  if(online){
    assert.equal(first.querySelector("select").children.length,3,"Atualizar opções pelo catálogo");
    first.querySelector("select").value="reforma_apartamento_completa";
    first.querySelector("select").dispatchEvent({type:"change"});
    first.querySelector("input").value="40";
    await elements.get("simulate").onclick();
    assert.match(elements.get("estimate").children.find(x=>x.tagName==="STRONG").textContent,/111\.767,68/,"Mostrar apenas total simulado");
    elements.get("add").onclick();
    assert.equal(elements.get("lines").children.length,2,"Botão deve criar segunda linha");
  } else {
    assert.equal(first.querySelector("select").children.length,18,"A lista reserva precisa permitir trabalhar sem catálogo remoto");
    assert.equal(elements.get("retryCatalog").classList.contains("hidden"),false,"Exibir botão de tentar novamente");
  }
}
console.log("CIVOLTEN: script válido; formulário aparece; catálogo remoto e offline; adicionar serviço; simular total; storage bloqueado; 17 serviços.");

const missingFields=fixture(false);
await missingFields.get('send').onclick();
assert.match(missingFields.get('clientmsg').textContent,/Falta preencher o nome/);
assert.match(missingFields.get('clientmsg').textContent,/Falta preencher o WhatsApp/);
assert.match(missingFields.get('clientmsg').textContent,/Falta preencher a descrição do serviço/);
assert.equal(missingFields.get('desc').attrs['aria-invalid'],'true','Campo descrição destacado');
missingFields.get('name').value='João Cliente';
missingFields.get('phone').value='+5511999990000';
missingFields.get('consent').checked=true;
missingFields.get('desc').value='Curto';
await missingFields.get('send').onclick();
assert.match(missingFields.get('clientmsg').textContent,/pelo menos 12 caracteres/);
missingFields.get('simulate').onclick();
for(let i=0;i<10;i++)await Promise.resolve();
assert.match(missingFields.get('clientmsg').textContent,/Selecione pelo menos um serviço para simular/);
console.log('CIVOLTEN: mensagens individuais para campos obrigatórios e simulação incompleta.');
