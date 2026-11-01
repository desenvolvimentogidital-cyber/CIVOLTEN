/* CIVOLTEN - proposta A4 interna com paginação e identidade gráfica.
 * Apenas snapshots versionados de RASCUNHO. Nunca emite/aceita contratos.
 * Não utiliza cadastros fictícios, preços de venda presumidos nem e-mail.
 */
import {PDFDocument,StandardFonts,rgb,degrees} from 'pdf-lib';
import {readFile} from 'node:fs/promises';

const W=595.28,H=841.89,LEFT=38,RIGHT=557,CONTENT=RIGHT-LEFT;
// Identidade oficial CIVOLTEN: grafite/preto, dourado metálico, prata.
const navy=rgb(.98,.75,.31),copper=rgb(.90,.57,.13);
const surface=rgb(.06,.09,.14),pageBg=rgb(.035,.055,.081);
const pale=rgb(.105,.15,.205),lineColor=rgb(.25,.31,.38);
const dark=rgb(.97,.98,.99),muted=rgb(.75,.79,.84),white=rgb(1,1,1);
const safe=v=>String(v??'').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,' ').replace(/\s+/g,' ').trim();
const currency=v=>{
 if(v===null||v===undefined||v==='')return 'A REVISAR';
 const n=Number(v);
 return Number.isFinite(n)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'A REVISAR';
};
const shortened=(v,font,size,width)=>{
 let t=safe(v);if(font.widthOfTextAtSize(t,size)<=width)return t;
 while(t&&font.widthOfTextAtSize(t+'...',size)>width)t=t.slice(0,-1);
 return t+'...';
};
function wrapping(v,font,size,width){
 const words=safe(v).split(' '),result=[];let current='';
 for(const word of words){
  if(!word)continue;
  const joined=current?current+' '+word:word;
  if(font.widthOfTextAtSize(joined,size)<=width){current=joined;continue;}
  if(current)result.push(current);
  if(font.widthOfTextAtSize(word,size)>width){
   let part='';
   for(const letter of word){
    if(part&&font.widthOfTextAtSize(part+letter,size)>width){result.push(part);part=letter;}
    else part+=letter;
   }
   current=part;
  }else current=word;
 }
 if(current)result.push(current);
 return result.length?result:['A definir'];
}
function permitted(doc){
 if(!doc||doc.issued!==false||doc.commercial_release!==false||
     !Array.isArray(doc.items)||doc.items.length===0)
  throw new Error('Somente snapshot de rascunho interno pode gerar prévia');
}
export async function renderProposalDraftPdf(snapshot,{version,sha256}={}){
 permitted(snapshot);
 if(!Number.isSafeInteger(Number(version))||Number(version)<1||
  !/^[a-f0-9]{64}$/.test(String(sha256)))
  throw new Error('Versão e hash obrigatórios');
 const pdf=await PDFDocument.create();
 const normal=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 // Imagens oficiais já versionadas no projeto; nunca usar ícones inventados.
 let logo=null,icone=null;
 try{logo=await pdf.embedPng(await readFile(new URL('../public/assets/logo.png',import.meta.url)));}catch{/* mantém alternativa textual se o empacotamento omitir o arquivo */}
 try{icone=await pdf.embedPng(await readFile(new URL('../public/assets/icone.png',import.meta.url)));}catch{/* alternativa sem símbolo */}
 let page,y,number=0;
 function begin(){
  page=pdf.addPage([W,H]);number++;
  page.drawRectangle({x:0,y:0,width:W,height:H,color:pageBg});
  page.drawRectangle({x:0,y:H-103,width:W,height:103,color:surface});
  page.drawRectangle({x:0,y:H-107,width:W,height:4,color:copper});
  page.drawRectangle({x:LEFT,y:H-85,width:4,height:59,color:copper});
  // Marca oficial indivisível: símbolo elétrico ANTES do nome em todas as páginas.
  // Ambos os PNGs estão versionados em public/assets da CIVOLTEN.
  if(icone)page.drawImage(icone,{x:LEFT+13,y:H-89,width:54,height:65});
  if(logo)page.drawImage(logo,{x:LEFT+80,y:H-80,width:272,height:54});
  else{
   page.drawText('CIVOLTEN',{x:LEFT+80,y:H-56,size:21,font:bold,color:white});
   page.drawText('ELETRICA & CONSTRUCAO CIVIL',{x:LEFT+80,y:H-76,size:8,font:bold,color:muted});
  }
  // Uma segunda aplicação suave funciona como marca d'água, não substitui o símbolo no topo.
  if(icone)page.drawImage(icone,{x:RIGHT-92,y:300,width:92,height:112,opacity:.085});
  page.drawRectangle({x:416,y:H-69,width:140,height:25,color:copper});
  page.drawText('MODELO / RASCUNHO',{x:425,y:H-60,size:8,font:bold,color:surface});
  page.drawText('NAO EMITIDO',{x:63,y:390,size:51,font:bold,color:copper,opacity:.095,rotate:degrees(32)});
  y=H-134;
 }
 const ensure=height=>{if(y-height<84)begin();};
 function paragraph(value,{size=9,leading=15,color=dark,strong=false,indent=0}={}){
  const face=strong?bold:normal;
  const lines=wrapping(value,face,size,CONTENT-indent-5);
  for(const str of lines){ensure(leading);page.drawText(str,{x:LEFT+indent,y,size,font:face,color});y-=leading;}
 }
 function section(label){
  ensure(45);y-=10;
  page.drawRectangle({x:LEFT,y:y-1,width:4,height:14,color:copper});
  page.drawText(safe(label),{x:LEFT+13,y:y,size:12,font:bold,color:navy});
  y-=26;
 }
 function smallField(label,value,x,w,top){
  page.drawText(label,{x,y:top,size:7,font:bold,color:copper});
  page.drawText(shortened(value||'A confirmar',bold,9.5,w),{x,y:top-18,size:9.5,font:bold,color:navy});
 }
 function metadata(){
  ensure(99);
  page.drawRectangle({x:LEFT,y:y-78,width:CONTENT,height:78,color:pale});
  const top=y-21;
  smallField('ORCAMENTO',snapshot.budget?.code||'A definir',LEFT+13,154,top);
  smallField('CLIENTE',snapshot.client?.name||'A informar',LEFT+227,267,top);
  page.drawText('OBRA: '+shortened(snapshot.project?.title||'A vincular',normal,8,230),{
   x:LEFT+13,y:top-41,size:8,font:normal,color:muted
  });
  page.drawText('VERSAO '+String(version)+'  |  REVISAO '+safe(snapshot.budget?.lock_version??'-'),{
   x:LEFT+269,y:top-41,size:8,font:normal,color:muted
  });
  y-=95;
 }
 function tableHeader(){
  ensure(42);
  page.drawRectangle({x:LEFT,y:y-26,width:CONTENT,height:26,color:navy});
  const top=y-17;
  for(const [x,t] of [[LEFT+10,'SERVICO / DESCRICAO'],[LEFT+283,'QTD'],[LEFT+342,'UN'],[LEFT+392,'UNITARIO'],[LEFT+470,'VALOR']])
   page.drawText(t,{x,y:top,size:7.3,font:bold,color:surface});
  y-=26;
 }
 function tableRow(item,index,laborOnly){
  const desc=safe(item.name||item.description||'Servico a definir');
  const lines=wrapping(desc,bold,8.6,253);
  const rowHeight=Math.max(40,lines.length*12+21);
  ensure(rowHeight+2);
  // Repeat labels at top of a new page after pagination.
  // Section header remains on the original page; each row is still numbered.
  const rowY=y-rowHeight;
  if(index%2===0)page.drawRectangle({x:LEFT,y:rowY,width:CONTENT,height:rowHeight,color:pale});
  lines.forEach((s,i)=>page.drawText(s,{x:LEFT+10,y:y-15-i*12,font:bold,size:8.6,color:dark}));
  page.drawText(shortened('Codigo: '+safe(item.code||'proprio'),normal,7.3,249),{
   x:LEFT+10,y:rowY+8,size:7.3,font:normal,color:muted
  });
  const cells=[
   [LEFT+284,safe(item.quantity??'A medir'),48],
   [LEFT+343,safe(item.unit||'-'),43],
   [LEFT+393,laborOnly?'Custo MO':currency(item.unit_cost),73],
   [LEFT+471,laborOnly?currency(item.estimated_labor_cost_reais):
     (item.unit_cost==null?'A REVISAR':currency(Number(item.quantity)*Number(item.unit_cost))),83]
  ];
  for(const [x,s,w] of cells)page.drawText(shortened(s,normal,8,w),{x,y:rowY+rowHeight/2-3,size:8,font:normal,color:dark});
  y=rowY;
 }
 function costRow(label,value,{highlight=false}={}){
  ensure(28);
  if(highlight)page.drawRectangle({x:LEFT,y:y-26,width:CONTENT,height:30,color:pale});
  page.drawText(label,{x:LEFT+10,y:y-17,size:highlight?10:9,font:highlight?bold:normal,color:highlight?navy:muted});
  const rightText=value;
  const face=highlight?bold:normal;
  const size=highlight?11:9;
  page.drawText(rightText,{
   x:RIGHT-10-face.widthOfTextAtSize(rightText,size),y:y-17,size,font:face,color:highlight?navy:dark
  });
  y-=31;
 }
 begin();
 ensure(70);
 page.drawText('PROPOSTA DE PRESTACAO DE SERVICOS',{x:LEFT,y,size:17,font:bold,color:navy});
 y-=21;
 paragraph('Previa interna para conferencia de escopo, quantitativos, custos e condicoes. Sem validade comercial.',{
  size:8.3,leading:13,color:muted
 });
 y-=10;metadata();
 section('01  OBJETO E ESCOPO');
 paragraph(snapshot.scope||'Escopo a definir e revisar antes de enviar ao cliente.');
 section('02  SERVICOS E QUANTITATIVOS');
 const laborOnly=snapshot.proposal_mode==='somente_mao_de_obra';
 paragraph(laborOnly?'MODALIDADE: SOMENTE MAO DE OBRA - materiais nao inclusos.':
  'MODALIDADE: SERVICOS COM MATERIAIS - revisar limites do fornecimento.',{
  size:8,leading:13,color:muted,strong:true
 });
 y-=8;tableHeader();
 for(const [index,item] of snapshot.items.entries())tableRow(item,index,laborOnly);
 y-=8;section('03  RESUMO FINANCEIRO - VALORES NAO APROVADOS');
 // Visão voltada ao cliente: nunca exibir salário, custo próprio, BDI interno,
 // pró-labore ou margem empresarial no corpo da proposta.
 if(laborOnly){
  costRow('FORNECIMENTO DE MATERIAIS','NAO INCLUSO');
  costRow('VALOR DE VENDA INDICATIVO - NAO APROVADO',currency(snapshot.scope_pricing?.sale_scenario?.indicative_sale_reais),{highlight:true});
 }else costRow('VALOR GLOBAL PRELIMINAR - NAO APROVADO',currency(snapshot.costs?.total_reais),{highlight:true});
 y-=5;
 paragraph('Valores e tributos devem ser confirmados antes da emissao. Custos internos e metas empresariais nao fazem parte desta proposta.',{
  size:8,leading:13,color:muted
 });
 section('04  CONDICOES DE PAGAMENTO');
 paragraph(snapshot.payment_terms||'A definir apos revisao comercial.');
 paragraph('Validade: '+(Number.isSafeInteger(Number(snapshot.validity_days))&&Number(snapshot.validity_days)>0?
  String(snapshot.validity_days)+' dias, ainda nao iniciada':'a definir, sem validade comercial'),{
  size:8.5,leading:14,color:muted
 });
 section('05  EXCLUSOES E LIMITES');
 paragraph(snapshot.exclusions||'Exclusoes ainda nao informadas.');
 if(laborOnly)paragraph('Materiais e insumos nao inclusos, exceto acordo expresso e revisado.',{
  size:8.5,leading:14,strong:true
 });
 section('06  CONTROLE E REVISAO');
 const pending=[
  ...(snapshot.costs?.blocking_errors||[]).map(v=>v?.message||String(v)),
  ...(snapshot.scope_pricing?.issues||[])
 ].filter(Boolean);
 paragraph(pending.length?
  'Existem '+pending.length+' pendencias tecnicas ou financeiras. Esta versao nao pode ser emitida como proposta definitiva.':
  'Mesmo sem bloqueios listados, esta versao e apenas rascunho e nao comprova aprovacao comercial.',{
  size:9,leading:15,strong:true
 });
 for(const issue of pending.slice(0,5))paragraph('- '+issue,{size:7.8,leading:12,color:muted});
 y-=10;
 paragraph('Nao e contrato, aceite, ordem de servico ou compromisso de execucao. A assinatura e a emissao comercial permanecem bloqueadas.',{
  size:8.5,leading:14,strong:true
 });
 paragraph('Controle: versao '+version+'  |  SHA-256 '+sha256,{size:7.1,leading:13,color:muted});
 const pages=pdf.getPages();
 for(const [i,p] of pages.entries()){
  p.drawLine({start:{x:LEFT,y:45},end:{x:RIGHT,y:45},thickness:0.8,color:copper});
  p.drawText('CIVOLTEN  |  RASCUNHO SEM VALIDADE COMERCIAL',{
   x:LEFT,y:28,size:7.3,font:bold,color:muted
  });
  const footer=String(i+1)+' / '+String(pages.length)+'   -   V'+version;
  p.drawText(footer,{x:RIGHT-bold.widthOfTextAtSize(footer,7.3),y:28,size:7.3,font:bold,color:muted});
 }
 pdf.setTitle('CIVOLTEN RASCUNHO NAO EMITIDO V'+version);
 pdf.setSubject('Previa interna de proposta de servicos sem validade comercial');
 pdf.setAuthor('CIVOLTEN - ambiente de homologacao');
 pdf.setKeywords(['CIVOLTEN','RASCUNHO','NAO EMITIDO','PROPOSTA DE SERVICOS']);
 return Buffer.from(await pdf.save());
}
