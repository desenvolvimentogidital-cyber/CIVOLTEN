/* CIVOLTEN | proposta comercial A4, criada automaticamente do orçamento.
 * Apenas informações comerciais: nunca exibe custos internos, encargos ou salários.
 * Prévia no navegador -> comando de impressão -> Salvar como PDF.
 */
(function(){
 'use strict';
 const b=val=>String(val??'');
 const n=val=>{const x=Number(String(val??0).replace(',','.'));return Number.isFinite(x)?x:0;};
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 const decimal=v=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
 const safe=x=>esc(x);
 const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(b(x))?b(x).slice(8,10)+'/'+b(x).slice(5,7)+'/'+b(x).slice(0,4):fmtDate(x);
 function shares(q){
  const items=q.items||[],price=round(Math.max(0,n(q.price)));
  const weights=items.map(item=>Math.max(0,n(item.qty))*(Math.max(0,n(item.labor))+
   (item.owner==='empresa'?Math.max(0,n(item.material)):0)+Math.max(0,n(item.extra))));
  const sum=weights.reduce((a,v)=>a+v,0);let distributed=0;
  return weights.map((weight,i)=>{
   if(sum<=0)return null;
   const value=i===weights.length-1?round(price-distributed):round(price*weight/sum);
   distributed=round(distributed+value);return value;
  });
 }
 function printItems(q){
  const allocations=shares(q);
  return (q.items||[]).map((it,i)=>{
   const quantity=decimal(it.qty)+' '+safe(it.unit||'un');
   const owner=it.owner==='empresa'?'CIVOLTEN':'Cliente';
   return '<tr><td><strong>'+safe(it.service||'Serviço não informado')+'</strong>'+
    '<small>Materiais: '+owner+'</small></td><td class="cv-amount">'+quantity+
    '</td><td class="cv-price">'+(allocations[i]===null?'A conferir':cash(allocations[i]))+'</td></tr>';
  }).join('')||'<tr><td colspan="3">Adicione os serviços ao orçamento antes de emitir.</td></tr>';
 }
 function schedule(q){
  const x=q.clientExecutionSummary;
  if(!x||!Array.isArray(x.services)||!x.services.length)return '';
  const staff=Array.isArray(x.staffing)?x.staffing.map(r=>decimal(r.count)+' '+safe(r.role)).join(' · '):'';
  return '<section class="cv-plan"><h3>Planejamento técnico estimado</h3>'+
   (staff?'<p><strong>Equipe prevista:</strong> '+staff+'</p>':'')+
   '<p><strong>Duração calculada:</strong> '+safe(x.estimatedDays)+' dias úteis'+
   (x.startDate&&x.endDate?' · '+date(x.startDate)+' a '+date(x.endDate):'')+'</p>'+
   '<p class="cv-muted">Estimativa condicionada à confirmação de acesso, disponibilidade de frentes e condições da obra.</p></section>';
 }
 function notes(q){
  const count=(q.items||[]).filter(x=>x.owner==='cliente').length;
  const delivery=count?'<p>Materiais indicados como fornecimento pelo cliente não estão incluídos no valor cobrado.</p>':'';
  const text=b(q.notes).trim();
  return (text?'<p>'+safe(text).replace(/\r?\n/g,'<br>')+'</p>':'')+delivery;
 }
 function renderProposal(q){
  const company=db.company||{},isDraft=['Rascunho','Recusado'].includes(q.status);
  const validity=Math.max(0,n(q.validity??company.validity));
  const report=window.CIVOLTENFinancialAudit?.inspect?.(q);
  const errors=report?.errors||[];
  const flagged=isDraft||errors.length>0;
  const notice=flagged?'<p class="cv-warn">PRÉVIA SUJEITA À CONFERÊNCIA · '+(isDraft?'Rascunho ou proposta recusada. ':'')+
    (errors.length?'Revise os dados e cálculos antes de enviar.':'')+'</p>':'';
  const version=Math.max(1,n(q.revision||1));
  const companyInfo=[company.cnpj?'CNPJ '+safe(company.cnpj):'',company.phone?safe(company.phone):'',
   company.email?safe(company.email):''].filter(Boolean).join(' · ');
  const details=safe(company.address||'');
  const commercialName=safe(company.legal||company.name||'CIVOLTEN');
  const customer=safe(q.clientName||'Não informado');
  const noteContent=notes(q);
  return '<article class="print-sheet cv-proposal">'+
   '<div class="cv-proposal-rule"></div>'+
   '<header class="cv-proposal-header">'+
   '<div class="cv-proposal-brand"><img src="'+safe(assets.logo)+'" alt="CIVOLTEN" class="cv-proposal-logo">'+
   '<div class="cv-proposal-brandtext"><b>CIVOLTEN</b><small>ELÉTRICA &amp; CONSTRUÇÃO CIVIL</small></div></div>'+
   '<span class="cv-proposal-pill">DOCUMENTO COMERCIAL</span></header>'+
   '<div class="cv-proposal-heading"><div><p class="cv-kicker">APRESENTAÇÃO COMERCIAL</p>'+
   '<h1>Proposta de serviços</h1><p class="cv-proposal-subtitle">'+safe(q.title||'Descrição do serviço')+'</p></div>'+
   '<div class="cv-proposal-reference"><small>PROPOSTA</small><b>'+safe(q.number||'Sem número')+'</b>'+
   '<small>'+date(q.date)+' · Revisão '+String(version).padStart(2,'0')+'</small></div></div>'+
   notice+
   '<div class="cv-proposal-parties"><section><label>APRESENTADA POR</label><b>'+commercialName+
   '</b><p>'+companyInfo+'</p>'+(details?'<p>'+details+'</p>':'')+'</section>'+
   '<section><label>PREPARADA PARA</label><b>'+customer+'</b>'+
   '<p>Local da obra: '+safe(q.address||'A definir')+'</p><p>Fornecimento: '+safe(q.type||'A definir')+'</p></section></div>'+
   '<div class="cv-proposal-section-heading"><h2>Serviços contemplados</h2><span>Escopo comercial</span></div>'+
   '<div class="cv-proposal-table-wrap"><table class="cv-proposal-table"><thead><tr>'+
   '<th>DESCRIÇÃO DOS SERVIÇOS</th><th>QUANTIDADE</th><th>VALOR DO ITEM</th></tr></thead>'+
   '<tbody>'+printItems(q)+'</tbody></table></div>'+
   '<div class="cv-proposal-total"><div><b>INVESTIMENTO TOTAL</b>'+
   '<small>Valor global desta proposta, conforme escopo</small></div>'+
   '<strong>'+cash(q.price)+'</strong></div>'+
   '<div class="cv-proposal-terms">'+
   '<section><label>PRAZO PREVISTO</label><b>'+safe(q.deadline||'A combinar')+'</b></section>'+
   '<section><label>CONDIÇÃO DE PAGAMENTO</label><b>'+safe(q.paymentTerms||'A combinar')+'</b></section>'+
   '<section><label>VALIDADE</label><b>'+validity+' dias</b></section></div>'+
   schedule(q)+
   (noteContent?'<section class="cv-proposal-notes"><b>Condições e observações</b>'+noteContent+'</section>':'')+
   '<section class="cv-proposal-accept"><h2>Ciência e aceite da proposta</h2>'+
   '<p class="cv-muted">Este campo registra o aceite comercial; contratos e aditivos devem ser formalizados separadamente quando aplicável.</p>'+
   '<div class="cv-proposal-signatures"><div><span></span><b>'+safe(company.name||'CIVOLTEN')+
   '</b><small>Responsável · Data</small></div><div><span></span><b>Contratante</b>'+
   '<small>Assinatura · Data</small></div></div></section>'+
   '<footer class="cv-proposal-footer"><b>CIVOLTEN</b><span>Proposta '+safe(q.number||'')+' · '+safe(q.title||'')+'</span></footer>'+
   '</article>';
 }
 function newPreview(){
  const q=db.quotes.find(x=>x.id===s.detail);
  if(!q)return quotes();
  return '<section class="screen print-route">'+pageTop('Visualizar proposta','Prévia comercial A4',true)+
   '<main class="sheet full">'+renderProposal(q)+
   '<div class="form-actions">'+button(I('back')+' Voltar','back','btn-light')+
   button(I('print')+' Imprimir / salvar PDF','print','btn-gold')+'</div>'+
   '<div class="info-box">A proposta foi preenchida automaticamente com os dados do orçamento salvo. Para obter o arquivo PDF, use Imprimir / salvar PDF. Confira os dados antes de enviar.</div>'+
   '</main></section>';
 }
 // Atualiza a rota: ROUTES.preview guardava a função original, impedindo
 // alterações posteriores de preview() de aparecerem na tela.
 preview=newPreview;
 ROUTES.preview=newPreview;
 const css=document.createElement('style');
 css.textContent=[
 '.cv-proposal{--cv-gold:#c28c2f;--cv-ink:#242d35;color:var(--cv-ink);padding:0!important;overflow:hidden;background:white;line-height:1.45}',
 '.cv-proposal-rule{height:5px;background:linear-gradient(90deg,#b27a21,#f0c97b,#b27a21)}',
 '.cv-proposal-header,.cv-proposal-heading,.cv-proposal-parties,.cv-proposal-section-heading,.cv-proposal-table-wrap,.cv-proposal-total,.cv-proposal-terms,.cv-plan,.cv-proposal-notes,.cv-proposal-accept{margin-left:25px;margin-right:25px}',
 '.cv-proposal-header{padding:21px 0 17px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
 '.cv-proposal-brand{display:flex;align-items:center;gap:8px;min-width:0}.cv-proposal-logo{max-width:170px;max-height:49px;object-fit:contain}.cv-proposal-brandtext{display:none}.cv-proposal-brandtext b{font-size:20px;letter-spacing:-.8px}.cv-proposal-brandtext small{display:block;font-size:7px;letter-spacing:1px}',
 '.cv-proposal-pill{background:#f0f2f3;border-radius:20px;color:#6c777f;font-size:8px;white-space:nowrap;letter-spacing:.7px;font-weight:900;padding:7px 10px}',
 '.cv-proposal-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;border-bottom:1px solid #dfe3e5;padding-bottom:16px}',
 '.cv-kicker{font-size:8px;color:#ac7a26;font-weight:900;letter-spacing:2px;margin:0 0 6px}',
 '.cv-proposal-heading h1{font-size:24px;letter-spacing:-.9px;line-height:1.13;margin:0;color:#222c34}',
 '.cv-proposal-subtitle{font-size:10px;color:#637078;margin:6px 0 0}',
 '.cv-proposal-reference{display:grid;text-align:right;gap:2px;flex-shrink:0;max-width:165px}.cv-proposal-reference small{font-size:8px;color:#77858e}.cv-proposal-reference b{font-size:11px;overflow-wrap:anywhere}',
 '.cv-proposal-parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px;margin-bottom:23px}',
 '.cv-proposal-parties section{border:1px solid #e6e7e8;border-radius:11px;padding:12px;min-width:0}',
 '.cv-proposal-parties label,.cv-proposal-terms label{display:block;font-size:8px;color:#a27528;font-weight:900;letter-spacing:1px;margin-bottom:7px}',
 '.cv-proposal-parties b{display:block;font-size:11px;overflow-wrap:anywhere}.cv-proposal-parties p{font-size:9px;color:#68737c;overflow-wrap:anywhere;margin:4px 0;line-height:1.5}',
 '.cv-proposal-section-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:18px;margin-bottom:10px}',
 '.cv-proposal-section-heading h2{font-size:13px;margin:0;color:#29313a}.cv-proposal-section-heading span{font-size:8px;color:#7e858b}',
 '.cv-proposal-table{width:100%;border-collapse:collapse;table-layout:fixed}',
 '.cv-proposal-table thead{background:#252e36;color:white}',
 '.cv-proposal-table th{font-size:8px;font-weight:900;text-align:left;letter-spacing:.5px;padding:12px 9px}',
 '.cv-proposal-table th:nth-child(1){width:58%}.cv-proposal-table th:nth-child(2){width:18%;text-align:center}.cv-proposal-table th:nth-child(3){width:24%;text-align:right}',
 '.cv-proposal-table td{font-size:10px;padding:12px 9px;border-bottom:1px solid #e7e9ea;vertical-align:top;word-break:normal;overflow-wrap:anywhere}',
 '.cv-proposal-table tbody tr:nth-child(even){background:#f7f8f8}',
 '.cv-proposal-table td strong{font-size:10px}.cv-proposal-table td small{font-size:8px;color:#7b858c;display:block;margin-top:4px}',
 '.cv-proposal-table .cv-amount{text-align:center}.cv-proposal-table .cv-price{text-align:right;white-space:nowrap;font-weight:800}',
 '.cv-proposal-total{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #e2cca2;background:#f6f0e4;padding:16px;border-radius:11px;margin-top:18px;margin-bottom:19px}',
 '.cv-proposal-total b{font-size:10px}.cv-proposal-total small{display:block;font-size:8px;color:#857755;margin-top:3px}',
 '.cv-proposal-total strong{font-size:19px;white-space:nowrap;letter-spacing:-.4px;color:#3a3122}',
 '.cv-proposal-terms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:20px}',
 '.cv-proposal-terms section{border:1px solid #e4e7e9;border-radius:8px;padding:11px;min-width:0}.cv-proposal-terms b{display:block;font-size:10px;overflow-wrap:anywhere}',
 '.cv-plan{padding:9px 0;border-top:1px solid #e5e7e8;border-bottom:1px solid #e5e7e8;margin-bottom:15px;break-inside:avoid-page}',
 '.cv-plan h3{font-size:12px;margin:3px 0 7px}.cv-plan p{font-size:9px;margin:5px 0}',
 '.cv-proposal-notes{padding:11px 14px;background:#f6f7f7;border-left:3px solid #c38f2f;border-radius:5px;font-size:9px;color:#56626b;margin-bottom:19px}',
 '.cv-proposal-notes p{margin:5px 0;line-height:1.5}.cv-muted{color:#79848b;font-size:9px;line-height:1.5}',
 '.cv-proposal-accept{padding-top:15px;border-top:1px solid #e4e7e9;margin-bottom:22px}',
 '.cv-proposal-accept h2{font-size:12px;margin:0 0 7px}',
 '.cv-proposal-signatures{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:26px}',
 '.cv-proposal-signatures div{min-width:0}.cv-proposal-signatures span{display:block;border-top:1px solid #8c969d;margin-bottom:6px}',
 '.cv-proposal-signatures b{display:block;font-size:9px}.cv-proposal-signatures small{display:block;color:#8b949a;font-size:8px;margin-top:3px}',
 '.cv-proposal-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#252e36;color:#cdd3d7;padding:11px 25px;font-size:8px}',
 '.cv-proposal-footer b{color:#f0c77a}.cv-proposal-footer span{overflow-wrap:anywhere;text-align:right}',
 '.cv-warn{margin:12px 25px;background:#fff0d7;border-left:3px solid #dc9f2b;padding:8px 12px;color:#76521a;font-size:9px;font-weight:800}',
 '@media(max-width:430px){.cv-proposal-pill{font-size:6.5px;padding:6px}.cv-proposal-header,.cv-proposal-heading,.cv-proposal-parties,.cv-proposal-section-heading,.cv-proposal-table-wrap,.cv-proposal-total,.cv-proposal-terms,.cv-plan,.cv-proposal-notes,.cv-proposal-accept{margin-left:12px;margin-right:12px}',
 '.cv-proposal-logo{max-width:125px}.cv-proposal-heading h1{font-size:19px}.cv-proposal-reference{max-width:94px}.cv-proposal-table th,.cv-proposal-table td{padding:8px 5px}.cv-proposal-total strong{font-size:16px}.cv-proposal-terms{gap:4px}.cv-proposal-terms section{padding:7px}}',
 '@media print{@page{size:A4;margin:13mm 12mm}.cv-proposal{border:0!important;border-radius:0!important;width:100%;overflow:visible!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}',
 '.cv-proposal-header,.cv-proposal-heading,.cv-proposal-parties,.cv-proposal-section-heading,.cv-proposal-table-wrap,.cv-proposal-total,.cv-proposal-terms,.cv-plan,.cv-proposal-notes,.cv-proposal-accept{margin-left:0;margin-right:0}',
 '.cv-proposal-header{padding:10px 0 13px}.cv-proposal-heading h1{font-size:25px}.cv-proposal-parties{margin-top:14px;margin-bottom:17px}.cv-proposal-total{margin-top:14px;margin-bottom:14px}',
 '.cv-proposal-table{table-layout:fixed}.cv-proposal-table thead{display:table-header-group}.cv-proposal-table tr{break-inside:avoid-page;page-break-inside:avoid}',
 '.cv-proposal-total,.cv-proposal-terms,.cv-proposal-accept,.cv-proposal-signatures{break-inside:avoid-page;page-break-inside:avoid}.cv-proposal-notes{break-inside:avoid-page}',
 '.cv-proposal-footer{margin-top:15px}.cv-proposal-logo{max-width:180px;max-height:49px}.cv-proposal-pill{font-size:8px}}'
 ].join('');
 document.head.append(css);
 window.CIVOLTENProposalLayout={shares,renderProposal};
})();
