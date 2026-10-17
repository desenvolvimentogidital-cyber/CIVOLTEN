/* CIVOLTEN PRO — editor comercial responsivo, dashboard e configurações.
   As alterações só são feitas pelo backend autenticado, nunca por armazenamento local. */
(function(){
'use strict';
const E=(tag,props={},children=[])=>{
 const el=document.createElement(tag);
 for(const [k,v] of Object.entries(props)){
  if(k==='text')el.textContent=String(v);
  else if(k==='class')el.className=v;
  else if(k==='type')el.type=v;
  else if(k==='value')el.value=v;
  else el.setAttribute(k,String(v));
 }
 for(const child of children)el.append(child);
 return el;
};
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
function call(action,method='GET',payload=null,id=''){
 return fetch('/api/admin?action='+encodeURIComponent(action)+(id?'&id='+encodeURIComponent(id):''),{
  method,credentials:'same-origin',headers:method==='POST'?{'Content-Type':'application/json'}:{},
  body:method==='POST'?JSON.stringify(payload):undefined
 }).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha na solicitação');return d;});
}
const row=(className='pro-row')=>E('div',{class:className});
const field=(label,input)=>{const l=E('label',{class:'field pro-field'});l.append(E('span',{text:label}),input);return l;};
const input=(value='',opts={})=>{
 const e=E('input',{type:opts.type||'text'});
 e.value=value==null?'':String(value);
 if(opts.placeholder)e.placeholder=opts.placeholder;
 if(opts.min!=null)e.min=String(opts.min);
 if(opts.max!=null)e.max=String(opts.max);
 if(opts.step)e.step=String(opts.step);
 e.setAttribute('autocomplete','off');
 return e;
};
const textarea=(value='',placeholder='')=>{const e=E('textarea');e.value=value??'';e.placeholder=placeholder;e.maxLength=800;return e;};
const button=(label,fn,cls='')=>{
 const b=E('button',{type:'button',text:label,class:cls});
 b.onclick=fn;return b;
};
function voiceFor(fieldEl){
 const R=window.SpeechRecognition||window.webkitSpeechRecognition;
 const b=button('🎙️ Ditar',()=>{
  if(!R){alert('O ditado depende de um navegador compatível. Use o microfone do teclado do celular.');return;}
  const rec=new R();rec.lang='pt-BR';rec.interimResults=false;rec.maxAlternatives=1;
  b.disabled=true;b.textContent='Ouvindo...';
  rec.onresult=e=>{const words=e.results?.[0]?.[0]?.transcript||'';
   fieldEl.value+=(fieldEl.value?' ':'')+words;fieldEl.dispatchEvent(new Event('input'));};
  rec.onerror=e=>{b.textContent=e.error==='not-allowed'?'Microfone bloqueado':'Tente novamente';};
  rec.onend=()=>{b.disabled=false;b.textContent='🎙️ Ditar';};rec.start();
 },'pro-dictate');
 return b;
}
const statusText=s=>({
 draft:'Rascunho',pending:'Aguardando cliente',approved:'Aprovado',
 rejected:'Recusado',changes_requested:'Ajustes solicitados'
}[s]||'Não preparado');
function attach(box,order){
 const toolbar=row();
 const btn=button('✏️ Editar orçamento completo',async()=>{
  form.classList.toggle('hidden');
  if(form.classList.contains('hidden'))return;
  if(form.dataset.loaded)return;
  try{
   btn.disabled=true;
   const data=await call('admin-commercial','GET',null,order.id);
   render(data);form.dataset.loaded='true';
  }catch(e){message.textContent=e.message;message.className='msg error';}
  finally{btn.disabled=false;}
 },'goldbtn');
 const state=E('span',{class:'pro-pill',text:statusText(order.commercial?.decision)});
 toolbar.append(btn,state);
 const form=E('section',{class:'pro-editor hidden','aria-label':'Editor comercial'});
 const message=E('div',{'aria-live':'polite'});
 box.append(toolbar,form);
 function render({pedido,simulacao,commercial}){
  form.replaceChildren();
  form.append(E('h4',{text:'Orçamento detalhado e condições'}),message);
  form.append(E('p',{class:'hint',text:'Revise preços comerciais. O total é calculado pelas quantidades e pelos preços unitários. Custos internos nunca aparecem no PDF.'}));
  let revision=commercial?.revision||0;
  const lines=E('div',{class:'pro-lines'});form.append(lines);
  const items=commercial?.items?.length?commercial.items.map(x=>({...x})):
   simulacao?.itens?.length?simulacao.itens.map(x=>({
    description:x.descricao,quantity:x.quantidade,unit:x.unidade,
    unit_price:Number(x.preco_unitario)||0
   })):[{description:pedido.description||'',quantity:1,unit:'serv.',unit_price:Number(simulacao?.total_bruto||0)}];
  const getRows=()=>[...lines.children].map(el=>el._get());
  const totalEl=E('strong',{class:'pro-total',text:'Total R$ 0,00'});
  function calculate(){
   const v=getRows().reduce((sum,x)=>sum+(Number(x.quantity)>0&&Number(x.unit_price)>=0?Math.round(Number(x.quantity)*Number(x.unit_price)*100)/100:0),0);
   totalEl.textContent='Total comercial: '+brl(v);
  }
  function appendLine(data){
   const line=E('div',{class:'pro-line'});
   const description=textarea(data.description||'','Descrição detalhada do serviço');description.maxLength=280;
   const quantity=input(data.quantity??1,{type:'number',min:'0.001',step:'0.001'});
   const unit=input(data.unit||'un.');
   unit.maxLength=18;
   const cost=input(data.unit_price??0,{type:'number',min:'0',step:'0.01'});
   const detail=field('Serviço / descrição',description);
   detail.className='field pro-wide';
   detail.append(voiceFor(description));
   const grid=row('pro-grid');
   grid.append(field('Quantidade',quantity),field('Unidade',unit),field('Preço unitário (R$)',cost));
   const del=button('Remover item',()=>{if(lines.children.length<=1){show('Mantenha pelo menos um serviço.');return;}line.remove();calculate();},'pro-remove');
   [quantity,cost].forEach(x=>x.addEventListener('input',calculate));
   line.append(detail,grid,del);line._get=()=>({
    description:description.value.trim(),quantity:Number(quantity.value),unit:unit.value.trim(),unit_price:Number(cost.value)
   });
   lines.append(line);calculate();
  }
  const show=(msg,ok=false)=>{message.textContent=msg;message.className='msg '+(ok?'ok':'error');};
  items.forEach(appendLine);
  const add=button('+ Adicionar serviço',()=>appendLine({description:'',quantity:1,unit:'un.',unit_price:0}));
  form.append(add,totalEl);
  const terms=commercial?.terms||{};
  const validity=input(terms.validity_days||15,{type:'number',min:1,max:180,step:1});
  const deadline=input(terms.deadline||'',{placeholder:'Ex.: 15 dias úteis'});
  const payment=textarea(terms.payment||'','Ex.: 30% na aprovação e saldo conforme etapas');
  payment.maxLength=250;
  const included=textarea(terms.included||'','Serviços e materiais incluídos');
  const excluded=textarea(terms.excluded||'','Serviços e materiais não incluídos');
  const termsBox=E('div',{class:'pro-terms'});
  termsBox.append(field('Validade da proposta (dias)',validity),field('Prazo de execução',deadline),
    field('Forma de pagamento',payment),field('O que está incluído',included),field('O que não está incluído',excluded));
  termsBox.append(voiceFor(payment),voiceFor(included));
  form.append(E('h4',{text:'Condições da proposta'}),termsBox);
  const actions=row();
  const save=button('Salvar orçamento detalhado',async()=>{
   const commercialItems=getRows();
   for(const [i,it] of commercialItems.entries()){
    if(it.description.length<3){show('Falta descrição no serviço '+(i+1)+'.');return;}
    if(!Number.isFinite(it.quantity)||it.quantity<=0){show('Falta quantidade válida no serviço '+(i+1)+'.');return;}
    if(!Number.isFinite(it.unit_price)||it.unit_price<0){show('Confira o preço do serviço '+(i+1)+'.');return;}
   }
   try{
    save.disabled=true;
    const result=await call('admin-save-commercial','POST',{
     id:order.id,expected_revision:revision,items:commercialItems,
     terms:{validity_days:Number(validity.value),deadline:deadline.value,payment:payment.value,
      included:included.value,excluded:excluded.value}
    });
    revision=result.revision;state.textContent='Rascunho • v'+revision;
    order.commercial={revision,decision:'draft',total:result.total};
    show('Versão '+revision+' salva. Total '+brl(result.total)+'.',true);
   }catch(e){show(e.message);}finally{save.disabled=false;}
  },'goldbtn');
  const share=button('🔗 Gerar link de aprovação',async()=>{
   try{
    if(!revision)throw Error('Salve o orçamento detalhado antes de gerar o link.');
    share.disabled=true;
    const result=await call('admin-share-commercial','POST',{id:order.id});
    const block=E('div',{class:'pro-link'});
    const link=input(result.url);link.readOnly=true;
    block.append(field('Link seguro da proposta (7 dias)',link));
    block.append(button('Copiar link',()=>navigator.clipboard?.writeText(result.url)));
    const phone=String(order.phone||'').replace(/\D/g,'');
    if(phone){
     const wa=E('a',{href:'https://wa.me/'+phone+'?text='+encodeURIComponent('Olá! Sua proposta CIVOLTEN está disponível: '+result.url),target:'_blank',rel:'noopener noreferrer',text:'Compartilhar pelo WhatsApp ↗'});
     block.append(wa);
    }
    const old=form.querySelector('.pro-link');old?.remove();
    form.append(block);state.textContent='Aguardando cliente • v'+revision;
    show('Link criado. Compartilhe apenas com o cliente correto.',true);
   }catch(e){show(e.message);}finally{share.disabled=false;}
  });
  const history=button('Ver histórico',async()=>{
   try{
    const d=await call('admin-commercial-history','GET',null,order.id);
    const list=E('div',{class:'pro-history'});
    d.history.forEach(h=>list.append(E('p',{text:'v'+h.revision+' • '+statusText(h.action==='edited'?'draft':h.action)+' • '+new Date(h.created_at).toLocaleString('pt-BR')})));
    if(!d.history.length)list.append(E('p',{text:'Nenhuma alteração registrada.'}));
    form.querySelector('.pro-history')?.remove();form.append(list);
   }catch(e){show(e.message);}
  });
  actions.append(save,share,history);form.append(actions);
 }
}

function dashboard(container,pedidos){
 const toolbar=E('div',{class:'pro-dashboard'});
 const total=pedidos.length;
 const sum=pedidos.reduce((acc,r)=>acc+Number(r.commercial?.total||r.simulacao?.total_bruto||0),0);
 const counts=['approved','pending','draft'].map(s=>pedidos.filter(p=>p.commercial?.decision===s).length);
 const summary=E('div',{class:'pro-kpis'});
 for(const [label,val] of [['Pedidos',total],['Valor em propostas',brl(sum)],['Aprovados',counts[0]],['Aguardando resposta',counts[1]]]){
  const card=E('div',{class:'pro-kpi'});card.append(E('small',{text:label}),E('strong',{text:val}));summary.append(card);
 }
 const filters=row('pro-filters');
 const search=input('',{placeholder:'Buscar cliente, telefone ou serviço'});search.setAttribute('aria-label','Buscar pedidos');
 const filter=E('select',{'aria-label':'Filtrar situação'});
 for(const [val,label] of [['','Todas as situações'],['novo','Novo'],['analisando','Em análise'],['orcamento_enviado','Enviado'],['aguardando_cliente','Aguardando cliente'],['concluido','Concluído'],['recusado','Recusado'],['approved','Proposta aprovada'],['pending','Aguardando aprovação']]){
  const opt=E('option',{value:val,text:label});filter.append(opt);
 }
 filters.append(search,filter);
 const elements=[...container.querySelectorAll('.order')];
 const update=()=>{
  const needle=search.value.trim().toLocaleLowerCase('pt-BR');
  let shown=0;
  pedidos.forEach((p,i)=>{
   const hit=([p.customer_name,p.phone,p.description,p.category,p.id].join(' ').toLocaleLowerCase('pt-BR').includes(needle))
     &&(!filter.value||p.status===filter.value||p.commercial?.decision===filter.value);
   elements[i].classList.toggle('hidden',!hit);
   if(hit)shown++;
  });
  count.textContent=shown+' pedido(s) encontrados';
 };
 const count=E('span',{class:'hint',text:total+' pedido(s) encontrados'});
 search.oninput=update;filter.onchange=update;
 toolbar.append(summary,filters,count);
 container.prepend(toolbar);
}

function branding(container){
 const block=E('section',{class:'order pro-branding'});
 block.append(E('h3',{text:'Identidade visual dos PDFs'}));
 const details=E('div',{class:'pro-grid'});
 const name=input('CIVOLTEN'),primary=input('#08182B',{type:'color'}),accent=input('#DCA629',{type:'color'}),upload=input('',{type:'file'});
 upload.type='file';upload.accept='image/png,image/jpeg';
 const preview=E('img',{class:'pro-logo-preview',alt:'Prévia da logo CIVOLTEN'});preview.hidden=true;
 details.append(field('Nome comercial',name),field('Cor do cabeçalho',primary),field('Cor de destaque',accent),field('Logo PNG/JPEG (até 200 KB)',upload),preview);
 block.append(details);
 const status=E('div',{'aria-live':'polite'});block.append(status);
 let logo=null;
 async function load(){
  const d=await call('admin-branding');
  name.value=d.branding?.company_name||'CIVOLTEN';
  primary.value=d.branding?.color_primary||'#08182B';
  accent.value=d.branding?.color_accent||'#DCA629';
  logo=d.branding?.logo_data_url||null;
  if(logo){preview.src=logo;preview.hidden=false;}
 }
 upload.onchange=async()=>{
  const file=upload.files?.[0];if(!file)return;
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>200000){status.textContent='Use PNG ou JPG até 200 KB.';return;}
  logo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  preview.src=logo;preview.hidden=false;
 };
 block.append(button('Salvar identidade visual',async()=>{
  try{
   const d=await call('admin-branding','POST',{company_name:name.value,color_primary:primary.value,color_accent:accent.value,logo_data_url:logo});
   status.textContent='Logo e cores salvas para os próximos PDFs.';
  }catch(e){status.textContent=e.message;}
 },'goldbtn'));
 block.append(button('Remover logo',()=>{logo=null;preview.hidden=true;status.textContent='Clique em salvar para confirmar a remoção.';}));
 container.append(block);
 load().catch(e=>{status.textContent='Não foi possível carregar a identidade visual: '+e.message;});
}
window.CIVOLTEN_PRO={attach,dashboard,branding,voiceFor};
})();
