// Ditado nativo do navegador, sem gravação própria ou envio ao CIVOLTEN.
export function spokenNumber(text){
 const s=String(text).trim().replace(/\s*(reais|real)\s*$/i,'').replace(/\s/g,'');
 if(!/^\d+(?:[.,]\d+)*$/.test(s))return null;
 const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'): /^\d{1,3}(\.\d{3})+$/.test(s)?s.replace(/\./g,''):s);
 return Number.isFinite(n)?String(n):null;
}
export function installVoiceFields(){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition)return;
 let active=null;
 const selector='textarea,input[type="text"],input:not([type]),input[type="number"],input[inputmode="decimal"],input[type="search"]';
 const eligible=f=>f.matches(selector)&&!f.disabled&&!f.readOnly&&!/senha|password|token|email|cpf|cnpj|telefone|phone|login|cep/i.test([f.name,f.id,f.autocomplete,f.placeholder].join(' '))&&!f.closest('[hidden]')&&!f.closest('form:has(input[type="password"])');
 const attach=()=>{
 for(const field of document.querySelectorAll(selector)){
 if(!eligible(field)||field.dataset.cvVoice)continue;
 field.dataset.cvVoice='1';
 const btn=document.createElement('button');btn.type='button';btn.className='cv-voice-button';btn.setAttribute('aria-label','Ditar neste campo');btn.title='Ditar neste campo';
 btn.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
 field.after(btn);
 btn.addEventListener('click',()=>{
 if(active){active.abort();active=null;return;}
 const rec=new Recognition();active=rec;rec.lang='pt-BR';rec.interimResults=false;rec.maxAlternatives=1;
 btn.classList.add('listening');btn.setAttribute('aria-label','Parar ditado');
 const finish=()=>{if(active===rec)active=null;btn.classList.remove('listening');btn.setAttribute('aria-label','Ditar neste campo');};
 rec.onend=finish;rec.onerror=e=>{finish();if(e.error==='aborted')return;window.alert('Não foi possível reconhecer a voz. Confira a permissão do microfone e tente novamente.');};
 rec.onresult=e=>{
 if(!field.isConnected)return;
 const transcript=e.results[0][0].transcript.trim();
 const numeric=field.type==='number'||field.inputMode==='decimal';
 const value=numeric?spokenNumber(transcript):transcript;
 if(value===null){window.alert('Dite o valor em números ou preencha manualmente.');return;}
 field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
 };
 try{rec.start()}catch{finish();}
 });
 }
 };
 attach();new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
}
