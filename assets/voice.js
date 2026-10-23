// Ditado por voz opcional: nativo do navegador, sem armazenar gravações no CIVOLTEN.
// O navegador pode enviar áudio ao serviço de reconhecimento do seu fornecedor.
// Apenas campos livres de texto recebem microfone; nunca senhas, números ou e-mails.

export function isDictationField(field){
 if(!field||field.disabled||field.readOnly||field.dataset?.noDictation!==undefined)return false;
 if(field.tagName==='TEXTAREA')return true;
 if(field.tagName!=='INPUT')return false;
 return field.type==='text'||field.type==='search';
}

// A transcrição ocupa a seleção/cursor sem apagar o texto existente, incluindo
// caracteres posteriores ao cursor. Captura uma base por sessão para que resultados
// parciais e finais não repitam as mesmas palavras.
export function insertDictation(original,spoken,start,end,maxLength=-1){
 const text=String(original??''),voice=String(spoken??'').trim().replace(/\s+/g,' ');
 const at=Math.min(text.length,Math.max(0,Number.isInteger(start)?start:text.length));
 const to=Math.min(text.length,Math.max(at,Number.isInteger(end)?end:at));
 if(!voice)return {value:text,cursor:at};
 const left=text.slice(0,at),right=text.slice(to);
 const lead=left&&!/[\s([{/\-]$/.test(left)&&!/^[,.;:!?)}\]]/.test(voice)?' ':'';
 const trail=right&&!/^[\s,.;:!?)}\]]/.test(right)&&!/[\s([{/\-]$/.test(voice)?' ':'';
 const limit=Number(maxLength);
 const max=Number.isInteger(limit)&&limit>=0?limit:Infinity;
 const available=Math.max(0,max-left.length-right.length-lead.length-trail.length);
 if(!available)return {value:text,cursor:at};
 const content=voice.slice(0,available);
 const result=left+lead+content+trail+right;
 return {value:result,cursor:(left+lead+content).length};
}

// Resultados do Web Speech podem trazer vários segmentos cumulativos:
// um segmento com "Kleber" e o próximo já com "Kleber Nunes".
// Juntar tudo sem conferir a sobreposição produz "Kleber Kleber Nunes".
const speechKey=word=>String(word).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('pt-BR').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');

// Alguns provedores também repetem fragmentos completos no MESMO segmento.
// Remove apenas repetições imediatamente adjacentes (uma palavra ou expressão),
// sem remover ocorrências separadas por conteúdo diferente.
export function cleanSpeechSegment(value){
 const words=String(value??'').trim().replace(/\s+/g,' ').split(' ').filter(Boolean);
 const out=[];
 for(let i=0;i<words.length;){
  let repeated=0;
  const max=Math.min(8,out.length,words.length-i);
  for(let size=max;size>=1;size--){
   let same=true;
   for(let j=0;j<size;j++){
    const a=speechKey(out[out.length-size+j]),b=speechKey(words[i+j]);
    if(!a||a!==b){same=false;break}
   }
   if(same){repeated=size;break}
  }
  if(repeated){i+=repeated;continue}
  out.push(words[i]);i++;
 }
 return out.join(' ');
}

// Usa cada segmento reconhecido uma única vez, mesmo quando o navegador
// devolve uma frase parcial e depois sua versão mais completa em outra posição.
// Mantém correções do reconhecimento ("Kleber" => "Kleber Nunes") e frases longas.
export function mergeSpeechResults(results){
 let combined='';
 if(!results)return combined;
 for(let i=0;i<results.length;i++){
  const segment=cleanSpeechSegment(results[i]?.[0]?.transcript);
  if(!segment)continue;
  if(!combined){combined=segment;continue}
  const previous=combined.split(/\s+/),next=segment.split(/\s+/);
  let overlap=0;
  for(let size=Math.min(previous.length,next.length);size>0;size--){
   let matches=true;
   for(let j=0;j<size;j++){
    const before=speechKey(previous[previous.length-size+j]),after=speechKey(next[j]);
    if(!before||before!==after){matches=false;break}
   }
   if(matches){overlap=size;break}
  }
  if(overlap===previous.length)combined=segment;
  else if(overlap<next.length)combined+=' '+next.slice(overlap).join(' ');
 }
 return combined.trim();
}

export function dictationErrorMessage(code){
 const messages={
  'not-allowed':'Microfone bloqueado. Autorize o acesso nas configurações do navegador e tente novamente.',
  'service-not-allowed':'O navegador bloqueou o serviço de reconhecimento de voz.',
  'audio-capture':'Nenhum microfone disponível. Confira as permissões e o dispositivo.',
  'network':'Não foi possível reconhecer a fala. Confira a conexão e tente novamente.',
  'no-speech':'Nenhuma fala detectada. Toque no microfone e fale novamente.',
  'language-not-supported':'O reconhecimento em português não está disponível neste navegador.'
 };
 return messages[code]||'O ditado não pôde continuar. Tente novamente.';
}

const MIC_ICON='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg>';

export function startVoiceFields({root=document,notify=()=>{}}={}){
 const view=root.defaultView||window;
 const SpeechRecognition=view.SpeechRecognition||view.webkitSpeechRecognition;
 let active=null;

 function mark(session,on){
  session.button.classList.toggle('voice-listening',on);
  session.button.setAttribute('aria-pressed',String(on));
  session.button.setAttribute('aria-label',on?'Parar ditado por voz':'Iniciar ditado por voz neste campo');
  session.button.title=on?'Parar ditado':'Falar para preencher este campo';
 }
 function cancel(){
  const previous=active;
  if(!previous)return;
  active=null;
  mark(previous,false);
  try{previous.recognition.abort()}catch{/* Sessão já encerrada */}
 }
 function enhance(context){
  if(!context?.querySelectorAll)return;
  const list=[...context.querySelectorAll('textarea,input')];
  if(context.matches?.('textarea,input'))list.unshift(context);
  for(const field of list){
   if(!isDictationField(field)||field.dataset.dictationReady==='yes')continue;
   const wrapper=root.createElement('span');
   wrapper.className='voice-field-wrap'+(field.tagName==='TEXTAREA'?' voice-multiline':'');
   const button=root.createElement('button');
   button.type='button';
   button.className='voice-mic-button';
   button.innerHTML=MIC_ICON;
   button.setAttribute('aria-label','Iniciar ditado por voz neste campo');
   button.setAttribute('aria-pressed','false');
   button.title='Falar para preencher este campo';
   field.parentNode.insertBefore(wrapper,field);
   wrapper.append(field,button);
   field.dataset.dictationReady='yes';
   button.addEventListener('click',event=>{
    event.preventDefault();
    if(active?.field===field){
     const session=active;
     if(!session.stopping){
      session.stopping=true;
      button.title='Finalizando ditado…';
      try{session.recognition.stop()}catch{cancel()}
     }
     return;
    }
    cancel();
    if(!SpeechRecognition){
     field.focus();
     notify('O navegador não oferece ditado nesta página. Use o microfone do teclado do celular.');
     return;
    }
    if(!view.isSecureContext){
     notify('O reconhecimento de voz exige uma conexão segura (HTTPS).');
     return;
    }
    let recognition;
    try{recognition=new SpeechRecognition()}
    catch{notify('Não foi possível iniciar o reconhecimento de voz neste navegador.');return}
    recognition.lang='pt-BR';
    recognition.interimResults=true;
    recognition.continuous=true;
    recognition.maxAlternatives=1;
    let start=field.selectionStart,end=field.selectionEnd;
    if(typeof start!=='number')start=field.value.length;
    if(typeof end!=='number')end=start;
    const session={field,button,recognition,base:field.value,start,end,heard:false,stopping:false,error:null};
    active=session;
    recognition.onresult=e=>{
     if(active!==session||!field.isConnected)return;
     const words=mergeSpeechResults(e.results);
     if(!words.trim())return;
     session.heard=true;
     const next=insertDictation(session.base,words,session.start,session.end,field.maxLength);
     if(field.value!==next.value){
      field.value=next.value;
      field.dispatchEvent(new view.Event('input',{bubbles:true}));
     }
     if(typeof field.setSelectionRange==='function')field.setSelectionRange(next.cursor,next.cursor);
    };
    recognition.onerror=e=>{
     if(active!==session)return;
     session.error=e.error;
     if(e.error!=='aborted')notify(dictationErrorMessage(e.error));
    };
    recognition.onend=()=>{
     if(active!==session)return;
     active=null;
     mark(session,false);
     if(!session.heard&&!session.error)notify('Não detectei palavras. Toque no microfone e tente novamente.');
    };
    try{
     recognition.start();
     mark(session,true);
     notify('Microfone ligado. Fale em português e toque novamente para parar. O navegador pode processar o áudio.');
    }catch{
     active=null;mark(session,false);
     notify('Não foi possível ativar o microfone. Confira as permissões do navegador.');
    }
   });
  }
 }
 // O formulário de orçamento é reconstruído sem recarregar a página.
 // Observar apenas adição/remoção de nós mantém o botão em novos campos sem
 // reinstalar listeners ou duplicar ícones.
 enhance(root);
 const content=root.getElementById('content');
 const observer=content&&view.MutationObserver?new view.MutationObserver(()=>{
  if(active&&!active.field.isConnected)cancel();
  enhance(content);
 }):null;
 observer?.observe(content,{childList:true,subtree:true});
 root.addEventListener('input',e=>{
  if(active?.field===e.target&&e.isTrusted)cancel();
 });
 root.addEventListener('visibilitychange',()=>{if(root.hidden)cancel()});
 root.addEventListener('click',e=>{
  if(e.target.closest?.('#logout,#pendingLogout'))cancel();
 },true);
 return {enhance,cancel,disconnect:()=>{observer?.disconnect();cancel()}};
}
