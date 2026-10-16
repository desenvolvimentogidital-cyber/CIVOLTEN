import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html=fs.readFileSync("index.html","utf8");
assert.match(html,/CIVOLTEN/i);
assert.match(html,/id="client"/);
assert.match(html,/id="pricingArea"/);
assert.match(html,/Editar valores internos/);
assert.doesNotMatch(html,/BRL\(s\[padrao\]\)/,"A lista de serviços não pode mostrar preços.");
assert.doesNotMatch(html,/s\.subtotal_servicos|s\.taxa_logistica|s\.sobretaxa_distancia|s\.imposto/,"Não mostrar discriminação de custos ao cliente.");
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.ok(scripts.length>0,"Página sem scripts");
for(const script of scripts)new vm.Script(script,{filename:"index.html"});

const matrix=JSON.parse(fs.readFileSync("app-nextjs/data/matriz-precos.json","utf8"));
assert.equal(Object.keys(matrix.servicos).length,17,"Catálogo CIVOLTEN deve conter 17 serviços.");
assert.equal(matrix.servicos.reforma_apartamento_completa.medio,2500);
assert.equal(matrix.servicos.reforma_apartamento_completa.unidade,"m²");
assert.equal(matrix.servicos.instalacao_eletrica_completa.unidade,"m²");
assert.equal(matrix.servicos.instalacao_eletrica_completa.medio,0,"Não criar preço elétrico sem validação.");
for(const name of ["demolicao_alvenaria","pintura_alvenaria","quadro_distribuicao","instalacao_chuveiro"])assert.ok(matrix.servicos[name],"Serviço ausente: "+name);

const api=fs.readFileSync("supabase/functions/civolten-beta/index.ts","utf8");
assert.match(api,/function publicQuote/);
assert.match(api,/PRECIFICACAO_PENDENTE/);
assert.match(api,/api==='admin-pricing'/);
assert.doesNotMatch(api,/baixo:Number\(x\.baixo\)/,"API pública não pode divulgar matriz de preços.");
console.log("CIVOLTEN: 17 serviços, UI, sintaxe JavaScript e privacidade de preços validadas.");
