import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/theme.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
function mockTheme({saved=null,systemDark=false,blockedStorage=false}={}){
 const values=new Map();if(saved)values.set('civolten-theme',saved);
 const callbacks={};const buttons=[0,1].map(()=>{
  const attributes=new Map();
  const icon={textContent:''},label={textContent:''};
  return {
   attributes,icon,label,
   setAttribute(k,v){attributes.set(k,v)},
   querySelector(q){return q==='.theme-icon'?icon:q==='.theme-label'?label:null}
  };
 });
 const meta={value:'',setAttribute(k,v){if(k==='content')this.value=v}};
 const root={attributes:new Map(),style:{},setAttribute(k,v){this.attributes.set(k,v)}};
 const media={matches:systemDark,addEventListener(event,fn){callbacks['media-'+event]=fn}};
 const document={
  documentElement:root,
  querySelector(q){return q==='meta[name="theme-color"]'?meta:null},
  querySelectorAll(q){return q==='[data-theme-toggle]'?buttons:[]},
  addEventListener(event,fn){callbacks[event]=fn}
 };
 const window={
  matchMedia:()=>media,
  localStorage:{
   getItem(key){if(blockedStorage)throw Error('blocked');return values.get(key)||null},
   setItem(key,value){if(blockedStorage)throw Error('blocked');values.set(key,value)}
  }
 };
 vm.runInNewContext(source,{document,window});
 return {values,callbacks,buttons,meta,root,media,window,click(){callbacks.click({target:{closest:()=>buttons[0]},preventDefault(){}})}};
}
test('primeira visita respeita modo escuro do celular',()=>{
 const ctx=mockTheme({systemDark:true});
 assert.equal(ctx.root.attributes.get('data-theme'),'dark');
 assert.equal(ctx.meta.value,'#0b1726');
 assert.equal(ctx.buttons[0].attributes.get('aria-pressed'),'true');
});
test('escolha clara salva supera preferencia escura do dispositivo',()=>{
 const ctx=mockTheme({saved:'light',systemDark:true});
 assert.equal(ctx.window.CIVOLTEN_THEME.get(),'light');
 assert.equal(ctx.root.attributes.get('data-theme'),'light');
});
test('alternar pelo login sincroniza com o painel e persiste',()=>{
 const ctx=mockTheme();
 ctx.click();
 assert.equal(ctx.root.attributes.get('data-theme'),'dark');
 assert.equal(ctx.values.get('civolten-theme'),'dark');
 assert.equal(ctx.buttons[1].label.textContent,'Modo claro');
 assert.equal(ctx.buttons[1].attributes.get('aria-label'),'Ativar modo claro');
 ctx.click();
 assert.equal(ctx.values.get('civolten-theme'),'light');
 assert.equal(ctx.buttons[0].attributes.get('aria-pressed'),'false');
});
test('mudanca de tema do aparelho só muda se usuario nao selecionou manualmente',()=>{
 const ctx=mockTheme({systemDark:false});
 ctx.media.matches=true;ctx.callbacks['media-change']();
 assert.equal(ctx.root.attributes.get('data-theme'),'dark');
 ctx.click();ctx.media.matches=false;ctx.callbacks['media-change']();
 assert.equal(ctx.root.attributes.get('data-theme'),'light');
});
test('funciona sem acesso ao armazenamento do navegador',()=>{
 const ctx=mockTheme({blockedStorage:true});
 ctx.click();assert.equal(ctx.root.attributes.get('data-theme'),'dark');
});
test('controle existe no login, na espera por aprovacao e no painel',()=>{
 assert.ok(html.includes('<section id="auth" class="auth-wrap"><button type="button" class="theme-toggle'));
 assert.ok(html.includes('class="header-actions"'));
 assert.equal((html.match(/data-theme-toggle/g)||[]).length,2);
 assert.ok(html.indexOf('/assets/theme.js')<html.indexOf('/assets/app.css'));
});
test('regras escuras cobrem formularios, cards e impressao',()=>{
 assert.ok(css.includes(':root[data-theme="dark"] .card'));
 assert.ok(css.includes(':root[data-theme="dark"] input,'));
 assert.ok(css.includes(':root[data-theme="dark"] .summary'));
 assert.ok(css.includes('@media print{'));
 assert.ok(css.includes(':root[data-theme="dark"] #printArea'));
});
