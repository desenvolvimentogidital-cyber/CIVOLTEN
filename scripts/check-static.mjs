import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const occurrences = (text, pattern) => [...text.matchAll(pattern)].length;
assert.match(html, /CIVOLTEN/i);
assert.equal(occurrences(html, /<\/html>/gi), 1, "Documento HTML duplicado ou truncado");
assert.equal(occurrences(html, /<script(?:\s[^>]*)?>/gi), 1, "Deve existir exatamente um script de inicialização");
assert.equal(occurrences(html, /<\/script>/gi), 1, "Script duplicado ou interrompido");
for (const id of ["client", "lines", "add", "simulate", "catalogstatus", "retryCatalog", "pricingArea"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Campo ausente: " + id);
}
assert.doesNotMatch(html, /BRL\(s\[padrao\]\)/, "Preço unitário exibido junto com o serviço");
assert.doesNotMatch(html, /s\.subtotal_servicos|s\.taxa_logistica|s\.sobretaxa_distancia|s\.imposto/, "Custos internos exibidos ao cliente");

const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)][0][1];
new vm.Script(script, {filename:"index.html"});

const matrix=JSON.parse(fs.readFileSync("app-nextjs/data/matriz-precos.json","utf8"));
assert.equal(Object.keys(matrix.servicos).length, 17);
assert.equal(matrix.servicos.reforma_apartamento_completa.medio, 2500);
assert.equal(matrix.servicos.instalacao_eletrica_completa.unidade, "m²");
const backend=fs.readFileSync("supabase/functions/civolten-beta/index.ts","utf8");
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
