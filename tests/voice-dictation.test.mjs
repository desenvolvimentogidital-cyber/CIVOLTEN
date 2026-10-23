import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {insertDictation,isDictationField,dictationErrorMessage,startVoiceFields} from '../assets/voice.js';

test('identifica textos livres e exclui senha, email, numeros, datas e campos inativos',()=>{
 const field=(tagName,type,extras={})=>({tagName,type,disabled:false,readOnly:false,dataset:{},...extras});
 assert.equal(isDictationField(field('INPUT','text')),true);
 assert.equal(isDictationField(field('INPUT','search')),true);
 assert.equal(isDictationField(field('TEXTAREA','textarea')),true);
 for(const type of ['password','email','number','date','checkbox','hidden','tel','url'])
  assert.equal(isDictationField(field('INPUT',type)),false,type);
 assert.equal(isDictationField(field('INPUT','text',{disabled:true})),false);
 assert.equal(isDictationField(field('INPUT','text',{readOnly:true})),false);
 assert.equal(isDictationField(field('INPUT','text',{dataset:{noDictation:''}})),false);
});
test('fala é acrescentada ao texto existente sem apagar descricoes da obra',()=>{
 assert.deepEqual(insertDictation('Execução de','instalação elétrica',10,10),
  {value:'Execução de instalação elétrica',cursor:29});
 assert.deepEqual(insertDictation('instalação elétrica','troca de disjuntores',19,19),
  {value:'instalação elétrica troca de disjuntores',cursor:39});
});
test('ditado no cursor mantém texto anterior e posterior',()=>{
 const value='obra concluída',at=value.indexOf('concluída');
 const actual=insertDictation(value,'não',at,at);
 assert.equal(actual.value,'obra não concluída');
 assert.equal(actual.cursor,8);
});
test('não ultrapassa maxlength e nem duplica espaços ou pontuação',()=>{
 assert.equal(insertDictation('Projeto','elétrico',7,7,10).value,'Projeto el');
 assert.equal(insertDictation('Troca','de tomadas.',5,5).value,'Troca de tomadas.');
 assert.equal(insertDictation('O serviço','.',9,9).value,'O serviço.');
 assert.equal(insertDictation('inicial final','novo',8,8).value,'inicial novo final');
 assert.equal(insertDictation('Texto','  ',5,5).value,'Texto');
});
test('erros mostram instruções úteis em português',()=>{
 assert.match(dictationErrorMessage('not-allowed'),/Autorize o acesso/);
 assert.match(dictationErrorMessage('network'),/conexão/);
 assert.match(dictationErrorMessage('no-speech'),/Nenhuma fala/);
});

// Simula a parte essencial de um navegador compatível para exercitar
// clique -> transcrição -> evento input reativo -> parar -> campo preservado.
function fakePage({supported=true,secure=true}={}){
 const notify=[],inputEvents=[];
 const buttons=[];
 class MockSpeech {
  static last;
  constructor(){MockSpeech.last=this}
  start(){this.started=true}
  stop(){this.stopped=true;this.onend?.()}
  abort(){this.aborted=true}
 }
 class MockEvent {constructor(type,opts){this.type=type;this.bubbles=opts.bubbles}}
 const view={Event:MockEvent,isSecureContext:secure,SpeechRecognition:supported?MockSpeech:undefined};
 const field={
  tagName:'TEXTAREA',type:'textarea',disabled:false,readOnly:false,
  dataset:{},value:'Serviço:',maxLength:-1,selectionStart:8,selectionEnd:8,
  isConnected:true,dispatchEvent(e){inputEvents.push(e.type)},
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end},
  parentNode:{insertBefore(){}}
 };
 const root={
  defaultView:view,
  querySelectorAll(){return [field]},
  getElementById(){return null},
  addEventListener(){},
  createElement(tag){
   if(tag==='span')return {className:'',append(...children){field.parentNode=this;buttons.push(children[1])}};
   return {
    type:'',className:'',title:'',innerHTML:'',listeners:{},
    attributes:{},classList:{toggle(name,on){this[name]=on}},
    addEventListener(event,fn){this.listeners[event]=fn},
    setAttribute(name,value){this.attributes[name]=value},
    click(){this.listeners.click({preventDefault(){}})}
   };
  }
 };
 field.parentNode.insertBefore=()=>{};
 return {root,field,buttons,notify,inputEvents,MockSpeech};
}
test('ao tocar mic, fala em português preenche textarea e dispara input sem perder texto',()=>{
 const env=fakePage(),manager=startVoiceFields({root:env.root,notify:t=>env.notify.push(t)});
 const mic=env.buttons[0];assert.ok(mic);
 mic.click();
 const rec=env.MockSpeech.last;
 assert.equal(rec.lang,'pt-BR');
 assert.equal(rec.interimResults,true);
 assert.equal(rec.started,true);
 assert.equal(mic.attributes['aria-pressed'],'true');
 rec.onresult({results:[[{transcript:'instalação elétrica'}]]});
 assert.equal(env.field.value,'Serviço: instalação elétrica');
 assert.deepEqual(env.inputEvents,['input']);
 // A revisão do texto parcial NÃO duplica o trecho transcrito.
 rec.onresult({results:[[{transcript:'instalação elétrica, tomada dupla'}]]});
 assert.equal(env.field.value,'Serviço: instalação elétrica, tomada dupla');
 mic.click();
 assert.equal(rec.stopped,true);
 assert.equal(mic.attributes['aria-pressed'],'false');
 manager.disconnect();
});
test('navegador incompatível mostra fallback para o microfone do teclado',()=>{
 const env=fakePage({supported:false});
 let focused=0;env.field.focus=()=>focused++;
 startVoiceFields({root:env.root,notify:t=>env.notify.push(t)});
 env.buttons[0].click();
 assert.equal(focused,1);
 assert.ok(env.notify.some(x=>/microfone do teclado/.test(x)));
 assert.equal(env.field.value,'Serviço:');
});
test('não inicia reconhecimento de voz em conexão insegura',()=>{
 const env=fakePage({secure:false});
 startVoiceFields({root:env.root,notify:t=>env.notify.push(t)});
 env.buttons[0].click();
 assert.equal(env.MockSpeech.last,undefined);
 assert.ok(env.notify.some(x=>/HTTPS/.test(x)));
});
test('módulo acompanha campos dinâmicos do orçamento e não grava áudio no servidor',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const voice=fs.readFileSync(new URL('../assets/voice.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(app,/import \{startVoiceFields\} from '\/assets\/voice.js'/);
 assert.match(app,/startVoiceFields\(\{notify:flash\}\)/);
 assert.match(voice,/querySelectorAll\('textarea,input'\)/);
 assert.match(voice,/MutationObserver/);
 assert.match(voice,/new view.Event\('input',\{bubbles:true\}\)/);
 assert.match(voice,/recognition.lang='pt-BR'/);
 assert.doesNotMatch(voice,/getUserMedia|MediaRecorder|fetch\(/);
 assert.match(css,/\.voice-field-wrap/);
 assert.match(css,/\.voice-mic-button\.voice-listening/);
 assert.match(css,/@media\(max-width:680px\)/);
});
