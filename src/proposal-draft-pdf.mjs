/* Prévia PDF A4 de proposta INTERNA, nunca equivalente a emissão.
 * A API de proposta comercial mantém bloqueios de revisão independentes.
 */
import {PDFDocument,StandardFonts,rgb,degrees} from 'pdf-lib';
function permitted(doc){
 if(!doc||doc.issued!==false||doc.commercial_release!==false||
     !Array.isArray(doc.items)||doc.items.length===0)
  throw new Error('Somente snapshot de rascunho interno pode gerar prévia');
}
const safe=v=>String(v??'').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,' ').replace(/\s+/g,' ').trim();
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
export async function renderProposalDraftPdf(snapshot,{version,sha256}={}){
 permitted(snapshot);
 if(!Number.isSafeInteger(Number(version))||Number(version)<1||
  !/^[a-f0-9]{64}$/.test(String(sha256)))throw Error('Versão e hash obrigatórios');
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),
  bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.13,.17,.22),accent=rgb(.85,.37,.07),muted=rgb(.39,.42,.46);
 let page,y,count=0;
 const begin=()=>{
  page=pdf.addPage([595.28,841.89]);count++;y=784;
  page.drawRectangle({x:32,y:814,width:530,height:4,color:accent});
  page.drawText('CIVOLTEN  |  PREVIA DE PROPOSTA', {x:36,y,size:15,font:bold,color:ink});
  page.drawText('RASCUNHO  -  NAO EMITIDO', {x:75,y:420,size:54,font:bold,
    color:accent,opacity:.16,rotate:degrees(36)});
  y-=32;
 };
 const print=(message,size=10,strong=false)=>{
  const face=strong?bold:font,width=520;
  const tokens=safe(message).split(' ');let current='';
  function line(chunk){
   if(y<80)begin();
   page.drawText(chunk||'—',{x:38,y,size,font:face,color:strong?accent:ink});
   y-=size+7;
  }
  for(const token of tokens){
   const test=current?current+' '+token:token;
   if(face.widthOfTextAtSize(test,size)<=width){current=test;continue;}
   if(current)line(current);
   if(face.widthOfTextAtSize(token,size)>width){
    let part='';
    for(const letter of token){
     if(part&&face.widthOfTextAtSize(part+letter,size)>width){line(part);part=letter;}
     else part+=letter;
    }
    current=part;
   }else current=token;
  }
  if(current)line(current);
 };
 begin();
 print('DOCUMENTO INTERNO DE HOMOLOGACAO  |  Versao '+version,13,true);
 print('Hash SHA-256: '+sha256,8);
 print('Cliente: '+(snapshot.client?.name||'Nao informado'));
 print('Obra: '+(snapshot.project?.title||'Nao vinculada'));
 print('Orcamento: '+snapshot.budget?.code+'  |  Revisao '+snapshot.budget?.lock_version);
 const laborOnly=snapshot.proposal_mode==='somente_mao_de_obra';
 print('MODALIDADE: '+(laborOnly?'SOMENTE MAO DE OBRA — SEM MATERIAIS':'MAO DE OBRA E MATERIAIS — SERVICOS COMPLETOS'),11,true);
 y-=12;print('ESCOPO',12,true);print(snapshot.scope);
 y-=12;print('SERVICOS E QUANTITATIVOS',12,true);
 for(const [i,item] of snapshot.items.entries()){
  print((i+1)+'. '+item.name+' ['+(item.code||'proprio')+']');
  print(laborOnly?item.quantity+' '+item.unit+' | custo MO: '+
   (item.estimated_labor_cost_reais==null?'A REVISAR':money(item.estimated_labor_cost_reais)):
   item.quantity+' '+item.unit+' x '+(item.unit_cost==null?'A REVISAR':money(item.unit_cost)),9);
 }
 y-=12;print('RESUMO DE CUSTOS NAO APROVADOS',12,true);
 if(laborOnly){
  print('Materiais: NAO INCLUSOS nesta modalidade',10,true);
  print('Base: horas-homem SIURB revisadas x custos-hora da empresa.',9);
  print('Custo direto de mao de obra (NAO preco de venda): '+
   (snapshot.scope_pricing?.labor_cost_reference_reais==null?'A REVISAR':money(snapshot.scope_pricing.labor_cost_reference_reais)));
  print('Margem, tributos e BDI desta modalidade: NAO APROVADOS.');
 }else print('Custo direto SIURB: '+(snapshot.costs?.direct_reais==null?'A REVISAR':money(snapshot.costs.direct_reais)));
 print('BDI estimado: '+(snapshot.costs?.bdi_reais==null?'PENDENTE DE DEFINICAO':money(snapshot.costs.bdi_reais)));
 print('Contingencia: '+(snapshot.costs?.contingency_reais==null?'A DEFINIR':money(snapshot.costs.contingency_reais)));
 print('Total preliminar: '+(snapshot.costs?.total_reais==null?'NAO DETERMINADO; BDI PENDENTE':money(snapshot.costs.total_reais)),13,true);
 y-=12;print('CONDICOES DE PAGAMENTO',12,true);print(snapshot.payment_terms);
 print('Validade proposta: '+(Number.isSafeInteger(Number(snapshot.validity_days))&&snapshot.validity_days!=null&&Number(snapshot.validity_days)>0?String(snapshot.validity_days)+' dias (nao iniciada)':'A DEFINIR; sem validade comercial'));
 y-=12;print('EXCLUSOES',12,true);print(snapshot.exclusions);
 if(laborOnly)print('Nao inclusos: fornecimento de materiais, insumos e equipamentos, salvo expressamente contratado.',9,true);
 y-=8;print('Este arquivo e apenas uma previa interna. Nao e oferta, contrato, aceite ou ordem de servico.',9,true);
 if(snapshot.costs?.blocking_errors?.length){
  print('Existem pendencias tecnicas e financeiras. O documento nao pode ser emitido.',9,true);
 }
 pdf.setTitle('CIVOLTEN RASCUNHO NAO EMITIDO V'+version);
 pdf.setSubject('Previa de proposta interna sem validade comercial');
 pdf.setAuthor('CIVOLTEN ambiente de homologacao');
 pdf.setKeywords(['CIVOLTEN','RASCUNHO','NAO EMITIDO']);
 const bytes=await pdf.save();
 return Buffer.from(bytes);
}
