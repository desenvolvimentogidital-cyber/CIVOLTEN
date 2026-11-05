/* CIVOLTEN — lançamentos reais por orçamento, histórico e alertas prudentes. */
(function(){
 'use strict';
 if(!window.CIVOLTENOperationsCore)return;
 const api=window.CIVOLTENOperationsCore;
 const escText=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
 const formMoney=v=>cash(Number(v)||0),numSafe=v=>{const k=Number(String(v??'0').replace(',','.'));return Number.isFinite(k)?k:NaN};
 const dateNow=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)};
 function entries(q){return Array.isArray(q.execution?.entries)?q.execution.entries:[]}
 function ensure(q){if(!q.execution)q.execution={percent:0,entries:[],changes:[]};if(!Array.isArray(q.execution.entries))q.execution.entries=[];if(!Array.isArray(q.execution.changes))q.execution.changes=[];return q.execution}
 function alertsHTML(report){return report.alerts.map(a=>'<p class="cv-op-alert '+(a.level==='critical'?'cv-op-critical':'')+'">'+escText(a.message)+'</p>').join('')||'<p class="cv-op-note">Nenhum alerta automático com os dados lançados. Confira se todos os custos foram registrados.</p>'}
 function detailUI(q){
  if(!q||!q.id)return '';
  const p=api.summary(q,db.company);
  const lines=entries(q);
  const list=lines.slice(-25).reverse().map(item=>{
   const undone=lines.some(x=>x.reverses===item.id),isReversal=!!item.reverses;
   return '<div class="cv-op-row"><span><b>'+escText(item.type==='cost'?'Custo':'Recebimento')+'</b> · '+escText(item.date)+
    '<small>'+escText(item.description)+(isReversal?' (estorno)':'')+'</small></span><strong>'+formMoney(item.amount)+'</strong>'+
    (!isReversal&&!undone?'<button type="button" class="cv-op-mini" data-action="cv-op-reverse" data-id="'+escText(item.id)+'" data-quote="'+escText(q.id)+'">Estornar</button>':'')+'</div>';
  }).join('');
  return '<section class="cv-op-panel"><h3>Execução e resultado real</h3><p class="cv-op-note">Custos e recebimentos são lançamentos registrados, não valores presumidos. O caixa não é igual ao lucro. Tudo é salvo localmente; backup Neon quando ativado.</p>'+
   '<div class="cv-op-metrics">'+
   '<div><small>Custo previsto</small><strong>'+formMoney(p.plannedCost)+'</strong></div>'+
   '<div><small>Custo realizado</small><strong>'+formMoney(p.spent)+'</strong></div>'+
   '<div><small>Recebido</small><strong>'+formMoney(p.received)+'</strong></div>'+
   '<div><small>Saldo de caixa registrado</small><strong>'+formMoney(p.cashBalance)+'</strong></div>'+
   '<div><small>Projeção de custo final</small><strong>'+(p.projectedCost===null?'Dados insuficientes':formMoney(p.projectedCost))+'</strong></div>'+
   '<div><small>Resultado projetado, após tributos estimados</small><strong>'+(p.projectedResult===null?'Dados insuficientes':formMoney(p.projectedResult))+'</strong></div></div>'+
   '<p class="cv-op-note">Progresso físico: <b>'+p.percent.toFixed(1).replace('.',',')+'%</b>. Projeção usa proporcionalidade e não substitui medição técnica ou contábil.</p>'+alertsHTML(p)+
   '<form data-cv-op="progress"><label>Avanço físico conferido (%)<input type="number" name="percent" min="0" max="100" step="0.1" value="'+p.percent+'" required></label><button type="submit">Salvar medição</button></form>'+
   '<details><summary>Lançar custo real</summary><form data-cv-op="cost">'+
   '<label>Data<input type="date" name="date" value="'+dateNow()+'" required></label>'+
   '<label>Categoria<select name="category"><option>Mão de obra</option><option>Materiais</option><option>Equipamentos</option><option>Transporte e alimentação</option><option>Outros</option></select></label>'+
   '<label>Descrição<input type="text" name="description" maxlength="200" required></label>'+
   '<label>Valor pago ou devido (R$)<input name="amount" type="number" step="0.01" min="0.01" max="1000000000" required></label>'+
   '<button type="submit">Registrar custo</button></form></details>'+
   '<details><summary>Lançar recebimento</summary><form data-cv-op="receipt">'+
   '<label>Data<input type="date" name="date" value="'+dateNow()+'" required></label>'+
   '<label>Descrição<input type="text" name="description" maxlength="200" placeholder="Ex.: medição 1" required></label>'+
   '<label>Valor recebido (R$)<input name="amount" type="number" step="0.01" min="0.01" max="1000000000" required></label>'+
   '<button type="submit">Registrar recebimento</button></form></details>'+
   '<h4>Histórico de lançamentos</h4>'+(list||'<p class="cv-op-note">Nenhum lançamento real registrado.</p>')+
   '<p class="cv-op-note">Para corrigir um lançamento, use Estornar. O registro original continua no histórico.</p></section>';
 }
 const detailOld=ROUTES.quoteDetail;
 ROUTES.quoteDetail=function(){
  const html=detailOld();
  const q=db.quotes.find(x=>x.id===s.detail);
  if(!q)return html;
  const idx=html.lastIndexOf('</main>');
  return idx<0?html:html.slice(0,idx)+detailUI(q)+html.slice(idx);
 };
 const financeOld=ROUTES.finance;
 ROUTES.finance=function(){
  const html=financeOld();
  const approved=db.quotes.filter(q=>q.status==='Aprovado');
  const totals=approved.map(q=>api.summary(q,db.company));
  const spent=totals.reduce((n,t)=>n+t.spent,0),receipts=totals.reduce((n,t)=>n+t.received,0);
  const critical=totals.filter(t=>t.alerts.some(a=>a.level==='critical')).length;
  const markup='<section class="cv-op-panel"><h3>Obras e movimentação registrada</h3>'+
   '<div class="cv-op-metrics"><div><small>Custos lançados</small><strong>'+formMoney(spent)+'</strong></div>'+
   '<div><small>Recebimentos lançados</small><strong>'+formMoney(receipts)+'</strong></div>'+
   '<div><small>Saldo de caixa registrado</small><strong>'+formMoney(receipts-spent)+'</strong></div>'+
   '<div><small>Orçamentos com alerta crítico</small><strong>'+critical+'</strong></div></div>'+
   approved.map(q=>{const p=api.summary(q,db.company);return '<button class="cv-op-open" data-action="detail" data-id="'+escText(q.id)+'"><b>'+escText(q.number||q.title)+'</b> · '+p.percent+'% executado · custo '+formMoney(p.spent)+' · recebido '+formMoney(p.received)+(p.alerts.some(a=>a.level==='critical')?' · VERIFICAR':'')+'</button>'}).join('')+
   '<p class="cv-op-note">Indicadores de lançamentos manuais locais; não são extrato bancário, faturamento fiscal ou lucro realizado auditado.</p></section>';
  const i=html.lastIndexOf('</main>');
  return i<0?html:html.slice(0,i)+markup+html.slice(i);
 };
 function updateQuote(quote,apply){
  const old=structuredClone(quote.execution||null);
  const ex=ensure(quote);
  try{apply(ex);if(!save()){quote.execution=old;return false;}render();return true}
  catch(e){quote.execution=old;toast(e.message||'Não foi possível registrar lançamento.');return false}
 }
 document.addEventListener('submit',event=>{
  const form=event.target,kind=form?.dataset?.cvOp;
  if(!kind)return;
  event.preventDefault();event.stopImmediatePropagation();
  const q=db.quotes.find(x=>x.id===s.detail);
  if(!q)return toast('Orçamento não encontrado');
  const data=Object.fromEntries(new FormData(form));
  if(kind==='progress'){
   const percent=numSafe(data.percent);
   if(!Number.isFinite(percent)||percent<0||percent>100)return toast('Avanço deve estar entre 0 e 100%.');
   updateQuote(q,ex=>{
    if((ex.changes||[]).length>3000)throw new Error('Limite de medições atingido; exporte o histórico.');
    ex.changes.push({at:new Date().toISOString(),from:ex.percent||0,to:percent});
    ex.percent=percent;
   });return;
  }
  const type=kind==='cost'?'cost':kind==='receipt'?'receipt':null;
  const amount=numSafe(data.amount);
  const item={type,date:String(data.date||''),description:String(data.description||'').trim(),category:type==='cost'?String(data.category||'Outros'):'Recebimento',amount:Math.round(amount*100)/100};
  if(!api.validEntry(item))return toast('Verifique valor positivo, data real e descrição.');
  updateQuote(q,ex=>{
   if(ex.entries.length>=1500)throw new Error('Limite de lançamentos atingido; exporte e arquive antes de continuar.');
   ex.entries.push({...item,id:uid('op'),at:new Date().toISOString()});
  });
 },true);
 document.addEventListener('click',event=>{
  const btn=event.target.closest('[data-action="cv-op-reverse"]');
  if(!btn)return;
  event.preventDefault();event.stopImmediatePropagation();
  const q=db.quotes.find(x=>x.id===btn.dataset.quote);
  if(!q)return;
  const original=entries(q).find(x=>x.id===btn.dataset.id);
  if(!original||original.reverses||entries(q).some(x=>x.reverses===original.id))return toast('Lançamento já estornado.');
  if(!confirm('Estornar '+formMoney(original.amount)+' de '+original.description+'? O histórico será preservado.'))return;
  updateQuote(q,ex=>{
   ex.entries.push({id:uid('op'),type:original.type,amount:-original.amount,category:original.category,
    date:dateNow(),description:'Estorno: '+original.description,reverses:original.id,at:new Date().toISOString()});
  });
 },true);
 const css=document.createElement('style');
 css.textContent='.cv-op-panel{margin:15px 0;background:white;border:1px solid #dad9d5;border-radius:16px;padding:14px;display:grid;gap:12px}.cv-op-panel h3{font-size:17px;margin:3px 0}.cv-op-panel h4{margin:8px 0 0;font-size:13px}.cv-op-note{font-size:11px;color:#62666c;line-height:1.5;margin:4px 0}.cv-op-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cv-op-metrics>div{background:#f5f5f3;padding:10px 8px;border-radius:9px;display:grid;gap:5px;min-width:0}.cv-op-metrics small{font-size:10px;color:#656970}.cv-op-metrics strong{font-size:13px;overflow-wrap:anywhere}.cv-op-panel form{display:grid;gap:10px;border:1px solid #deddd9;padding:12px;border-radius:11px}.cv-op-panel label{display:grid;gap:5px;font-size:12px;font-weight:700}.cv-op-panel input,.cv-op-panel select{height:39px;width:100%;padding:7px;border:1px solid #ccc;border-radius:7px;font-size:16px}.cv-op-panel button{border:1px solid #e0b447;background:#ffdd8c;border-radius:9px;padding:10px;font-weight:800}.cv-op-panel details{border:1px solid #e5e3de;border-radius:9px;padding:10px}.cv-op-panel summary{font-size:13px;font-weight:800;cursor:pointer}.cv-op-row{display:flex;gap:8px;justify-content:space-between;border-bottom:1px solid #eee;padding:8px 0;align-items:center;font-size:11px}.cv-op-row span{flex:1;min-width:0}.cv-op-row small{display:block;color:#757575;overflow-wrap:anywhere}.cv-op-row strong{white-space:nowrap}.cv-op-panel button.cv-op-mini{font-size:10px;padding:6px;background:#eee}.cv-op-alert{font-size:12px;border-radius:8px;background:#fff0d9;color:#77571c;padding:9px;margin:0}.cv-op-critical{background:#ffe5e5;color:#982d2d}.cv-op-open{display:block;text-align:left;width:100%;font-size:11px;background:#f7f7f5!important;border:1px solid #ddd!important;padding:12px!important}';
 document.head.append(css);
 window.CIVOLTENOperations={summary:api.summary};
})();
