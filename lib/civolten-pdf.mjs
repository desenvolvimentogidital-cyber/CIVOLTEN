import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {approvedQuoteTotal,commercialBreakdown} from './civolten-commercial.mjs';

// Modelo corporativo CIVOLTEN v2: equivalente ao design A4 aprovado.
// Arquivo vetorial, dados dinâmicos autenticados, sem anotações internas no PDF do cliente.
const rgbHex = hex => rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
const NAVY=rgbHex('#08182B'), NAVY2=rgbHex('#122843'), GOLD=rgbHex('#DCA629');
const GOLD_LIGHT=rgbHex('#FEF2CD'), GOLD_DARK=rgbHex('#99690D');
const INK=rgbHex('#152338'), MUTED=rgbHex('#637185'), LIGHT=rgbHex('#F6F8FB');
const PALE_BLUE=rgbHex('#EDF4FB'), LINE=rgbHex('#E6EBF1'), WHITE=rgb(1,1,1);
const W=595.28,H=841.89,M=39,CW=W-2*M,BASE=45;
const price=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));
function date(v){
 if(!v)return '—';
 const d=new Date(v);
 return Number.isNaN(d.valueOf())?'—':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(d);
}
function printable(v){
 return String(v??'').replace(/[\u0000-\u001F\u007F-\u009F]/g,' ').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,ch=>({
  '–':'-','—':'-','“':'"','”':'"','’':"'",'‘':"'",'•':'-','…':'...','⚡':'-'
 }[ch]||'?')).trim();
}
function wrap(v,font,size,width){
 const words=printable(v).split(/\s+/).filter(Boolean),out=[];
 let cur='';
 for(let word of words){
  while(word.length>1&&font.widthOfTextAtSize(word,size)>width){
   let count=1;
   while(count<word.length&&font.widthOfTextAtSize(word.slice(0,count+1),size)<=width)count++;
   if(cur){out.push(cur);cur='';}
   out.push(word.slice(0,count));word=word.slice(count);
  }
  const next=cur?cur+' '+word:word;
  if(cur&&font.widthOfTextAtSize(next,size)>width){out.push(cur);cur=word;}
  else cur=next;
 }
 if(cur)out.push(cur);
 return out.length?out:['—'];
}
function numeric(v){
 if(v===null||v===undefined||v==='')return null;
 const n=Number(v);
 return Number.isFinite(n)&&n>=0&&n<=100000000?Math.round(n*100)/100:null;
}
function normalize(model,mode){
 const p=model?.pedido;
 if(!p||typeof p.id!=='string')throw Error('Pedido ausente');
 if(!['preview','final'].includes(mode))throw Error('Modo inválido');
 const sim=numeric(model.simulacao?.total_bruto);
 const total=approvedQuoteTotal(p,model.simulacao);
 const selected=Array.isArray(p.request_details?.itens)?p.request_details.itens.slice(0,60):[];
 const services=new Map((Array.isArray(model.servicos)?model.servicos:[]).map(s=>[s.service_id,s]));
 const snapshots=new Map((Array.isArray(model.simulacao?.itens)?model.simulacao.itens:[]).map(s=>[s.servico_id,s]));
 const items=selected.map((r,i)=>{
  const svc=services.get(r.servico_id),snap=snapshots.get(r.servico_id);
  return {name:snap?.descricao||svc?.description||'Serviço '+(i+1),
   unit:snap?.unidade||svc?.unit||'un.',quantity:Number(r.quantidade)||0};
 });
 const commercial=mode==='final'?commercialBreakdown(p,model.simulacao,model.servicos,total):[];
 return {p,sim,total,items,commercial};
}

export async function generateQuotePdf(model,mode='preview'){
 const {p,sim,total,items,commercial}=normalize(model,mode);
 const doc=await PDFDocument.create();
 const regular=await doc.embedFont(StandardFonts.Helvetica);
 const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const code=p.id.slice(0,8).toUpperCase();
 doc.setTitle('CIVOLTEN - Orçamento '+code);
 doc.setSubject(mode==='preview'?'Prévia interna de orçamento':'Orçamento para o cliente');
 doc.setAuthor('CIVOLTEN - Elétrica e Construção Civil');
 const pages=[];let pg,y;

 function text(s,x,yy,size=10,font=regular,color=INK){
  pg.drawText(printable(s),{x,y:yy,size,font,color});
 }
 function line(x1,y1,x2,y2,color=LINE,width=.7){
  pg.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:width,color});
 }
 function box(x,yy,w,h,col){pg.drawRectangle({x,y:yy,width:w,height:h,color:col});}
 // Rectangle with real rounded corners, assembled from PDF vector primitives.
 function rounded(x,yy,w,h,r,col){
  if(r<=0){box(x,yy,w,h,col);return;}
  box(x+r,yy,w-2*r,h,col);
  box(x,yy+r,w,h-2*r,col);
  for(const cx of [x+r,x+w-r])for(const cy of [yy+r,yy+h-r])
   pg.drawEllipse({x:cx,y:cy,xScale:r,yScale:r,color:col});
 }
 function panel(x,top,w,h,col=WHITE,outline=true){
  if(outline)rounded(x,top-h,w,h,11,LINE);
  rounded(x+(outline?.8:0),top-h+(outline?.8:0),w-(outline?1.6:0),h-(outline?1.6:0),10,col);
 }
 function bolt(x,yy,s=.8){
  const path='M 8 36 L 1 19 L 12 19 L 7 1 L 30 24 L 18 24 L 24 36 Z';
  pg.drawSvgPath(path,{x,y:yy,scale:s,color:GOLD});
 }
 function header(first){
  if(first){
   box(0,H-205,W,205,NAVY);
   // Layers and architectural drawing all stay in the PDF as vectors.
   pg.drawSvgPath('M 327 842 L 595 842 L 595 637 L 424 637 Z',{color:NAVY2});
   pg.drawSvgPath('M 509 842 L 595 842 L 595 637 L 553 637 Z',{color:rgbHex('#1A3554')});
   for(let x=408;x<=573;x+=27)line(x,648,x,825,rgbHex('#35516C'),.45);
   for(let yy=652;yy<825;yy+=27)line(397,yy,586,yy,rgbHex('#35516C'),.45);
   line(438,692,483,745,GOLD,.8);line(483,745,532,692,GOLD,.8);
   line(449,692,449,653,WHITE,.7);line(521,692,521,653,WHITE,.7);
   line(449,653,521,653,WHITE,.7);
   rounded(39,H-79,46,46,9,NAVY2);
   bolt(48,H-37,.95);
   text('CIVOLTEN',94,H-61,27,bold,WHITE);
   text('ELÉTRICA  &  CONSTRUÇÃO CIVIL',95,H-79,8.6,bold,GOLD);
   box(M,H-107,154,2,GOLD);
   text(mode==='preview'?'PRÉVIA DE ORÇAMENTO':'ORÇAMENTO DE SERVIÇOS',M,H-139,19,bold,WHITE);
   text('Nº '+code,M,H-157,11.8,bold,rgbHex('#E3E9F1'));
   text(mode==='preview'?'Documento preliminar para análise e aprovação':'Proposta preparada pela CIVOLTEN',M,H-184,9.3,regular,rgbHex('#BECADA'));
   if(mode==='preview'){
    rounded(W-184,H-71,148,28,8,GOLD);
    text('USO INTERNO',W-173,H-54,10,bold,NAVY);
    text('Não enviar ao cliente',W-173,H-87,8.2,bold,WHITE);
   }else{
    rounded(W-166,H-70,130,28,8,GOLD);
    text('PROPOSTA',W-151,H-53,10,bold,NAVY);
   }
  }else{
   box(0,H-93,W,93,NAVY);
   box(0,H-93,5,93,GOLD);
   rounded(M,H-65,32,32,6,NAVY2);bolt(M+4,H-38,.62);
   text('CIVOLTEN',M+42,H-48,20,bold,WHITE);
   text('ELÉTRICA & CONSTRUÇÃO CIVIL',M+43,H-65,8.2,bold,GOLD);
   text('ORÇAMENTO Nº '+code,W-167,H-50,8.5,bold,WHITE);
  }
 }
 function addPage(){
  pg=doc.addPage([W,H]);pages.push(pg);
  header(pages.length===1);
  y=pages.length===1?H-215:H-108;
 }
 function ensure(h){if(y-h<BASE)addPage();}
 function labelHeader(index,label,top){
  rounded(M+16,top-40,28,28,6,NAVY);
  text(String(index).padStart(2,'0'),M+22,top-22,9.3,bold,GOLD);
  text(label,M+56,top-21,11.5,bold,NAVY);
  line(M+17,top-51,W-M-17,top-51);
 }
 function detailLines(lines,startX,startY,size=9.3,leading=14,font=regular,color=INK){
  let yy=startY;
  for(const s of lines){text(s,startX,yy,size,font,color);yy-=leading;}
  return yy;
 }
 function overview(){
  const h=49;ensure(h+12);
  panel(M,y,CW,h,LIGHT,false);
  pg.drawEllipse({x:M+16,y:y-25,xScale:4,yScale:4,color:GOLD});
  text('RECEBIDO EM',M+28,y-18,7.8,bold,MUTED);
  text(date(p.submitted_at),M+28,y-33,10.5,bold,NAVY);
  line(M+169,y-41,M+169,y-10);
  text('SITUAÇÃO',M+183,y-18,7.8,bold,MUTED);
  const status=printable(p.status||'novo').replace(/_/g,' ').toUpperCase();
  rounded(M+183,y-41,Math.min(132,Math.max(63,bold.widthOfTextAtSize(status,8)+20)),19,9,rgbHex('#DFEDFF'));
  text(status,M+193,y-34,8,bold,rgbHex('#1B5C9D'));
  line(M+305,y-41,M+305,y-10);
  text('CIDADE',M+320,y-18,7.8,bold,MUTED);
  const city=wrap(p.city||'Não informada',bold,10.1,175)[0];
  text(city,M+320,y-33,10.1,bold,NAVY);
  y-=h+12;
 }
 function client(){
  const customer=wrap(p.customer_name||'Não informado',bold,10.2,CW-40);
  const phone=wrap(p.phone||'Não informado',regular,10.1,180);
  const location=wrap([p.neighborhood,p.city].filter(Boolean).join(', ')||'Não informado',regular,10.1,234);
  const nameHeight=customer.length*13;
  const lowerLines=Math.max(phone.length,location.length);
  const h=140+(customer.length-1)*13+(lowerLines-1)*13;
  ensure(h+12);const top=y;panel(M,top,CW,h);
  labelHeader(1,'DADOS DO CLIENTE',top);
  text('NOME COMPLETO',M+19,top-71,7.9,bold,MUTED);
  detailLines(customer,M+19,top-89,10.2,13,bold,NAVY);
  const divider=top-100-(customer.length-1)*13;
  line(M+19,divider,W-M-19,divider);
  const lowerTop=divider-15;
  text('WHATSAPP',M+19,lowerTop,7.9,bold,MUTED);
  text('LOCAL INFORMADO',M+250,lowerTop,7.9,bold,MUTED);
  detailLines(phone,M+19,lowerTop-15,10.1,13,regular,NAVY);
  detailLines(location,M+250,lowerTop-15,10.1,13,regular,NAVY);
  y-=h+12;
 }
 function service(){
  const desc=wrap(p.description||'Não informada',regular,10.6,CW-65);
  let at=0,index=1;
  while(at<desc.length){
   let count=Math.min(15,desc.length-at);
   const cardHeight=n=>98+n*14+(items.length===0&&mode==='preview'&&at+n===desc.length?15:0);
   let h=cardHeight(count);
   // At the top of an otherwise empty page, 15 lines fit. In tight space choose a smaller chunk.
   while(count>1&&y-h-12<BASE){count--;h=cardHeight(count);}
   ensure(h+11);
   const top=y;panel(M,top,CW,h);
   labelHeader(2,index===1?'SERVIÇO SOLICITADO':'SERVIÇO SOLICITADO (CONTINUAÇÃO)',top);
   text('DESCRIÇÃO ENVIADA PELO CLIENTE',M+19,top-71,8,bold,MUTED);
   rounded(M+18,top-90-count*14,CW-36,10+count*14,5,PALE_BLUE);
   detailLines(desc.slice(at,at+count),M+29,top-99,10.6,14,regular,NAVY);
   if(items.length===0&&mode==='preview'&&at+count===desc.length){
    text('Nenhum item detalhado foi selecionado na simulação.',M+19,top-h+10,8.5,regular,MUTED);
   }
   y-=h+12;at+=count;index++;
  }
  if(items.length>0&&mode==='preview'){
   let offset=0;
   while(offset<items.length){
    // Each card has a complete heading and only the rows that fit on its page.
    const remaining=y-BASE;
    if(remaining<128){addPage();continue;}
    const rows=[];let height=66;
    for(let j=offset;j<items.length;j++){
     const item=items[j];
     const qty=item.quantity.toLocaleString('pt-BR',{maximumFractionDigits:3});
     const textRow=(j+1)+'. '+item.name+'  -  '+qty+' '+item.unit;
     const pieces=wrap(textRow,regular,9.3,CW-47);
     const rowH=pieces.length*13+7;
     if(height+rowH+15>y-BASE)break;
     rows.push({pieces,rowH});height+=rowH;
    }
    if(!rows.length){addPage();continue;}
    ensure(height+12);const top=y;panel(M,top,CW,height);
    labelHeader(2,'ITENS DA SOLICITAÇÃO',top);
    let pos=top-69;
    for(let j=0;j<rows.length;j++){
     if(j%2===0)rounded(M+18,pos-rows[j].rowH+10,CW-36,rows[j].rowH,4,LIGHT);
     detailLines(rows[j].pieces,M+28,pos,9.3,13,regular,INK);
     pos-=rows[j].rowH;
    }
    offset+=rows.length;y-=height+12;
   }
  }
  if(p.request_details?.padrao){
   ensure(22);
   const patterns={baixo:'Baixo',medio:'Médio',alto:'Alto'};
   text('Padrão solicitado: '+(patterns[p.request_details.padrao]||printable(p.request_details.padrao)),M+13,y-5,8.8,regular,MUTED);
   y-=21;
  }
 }
 function pricedItems(){
  if(mode!=='final')return;
  const quantity=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:3});
  const unitFmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4}).format(n);
  let pos=0;
  while(pos<commercial.length){
   if(y-BASE<124){addPage();continue;}
   const rows=[];let h=79;
   for(let k=pos;k<commercial.length;k++){
    const item=commercial[k];
    const name=wrap((k+1)+'. '+item.name,regular,8.5,188);
    const height=Math.max(25,name.length*12+9);
    if(h+height+18>y-BASE)break;
    rows.push({item,name,height});
    h+=height;
   }
   if(!rows.length){addPage();continue;}
   const top=y;panel(M,top,CW,h);
   labelHeader(3,pos===0?'SERVIÇOS E VALORES':'SERVIÇOS E VALORES (CONTINUAÇÃO)',top);
   text('DESCRIÇÃO DO SERVIÇO',M+20,top-70,7.2,bold,MUTED);
   text('QTD.',M+245,top-70,7.2,bold,MUTED);
   text('UNID.',M+289,top-70,7.2,bold,MUTED);
   text('VALOR UNIT.',M+346,top-70,7.2,bold,MUTED);
   text('VALOR TOTAL',M+435,top-70,7.2,bold,MUTED);
   line(M+18,top-77,W-M-18,top-77);
   let rowTop=top-90;
   for(let r=0;r<rows.length;r++){
    const {item,name,height}=rows[r];
    if(r%2===0)rounded(M+15,rowTop-height+13,CW-30,height,3,LIGHT);
    detailLines(name,M+20,rowTop,8.5,12,regular,INK);
    text(quantity(item.quantity),M+245,rowTop,8.3,regular,INK);
    text(item.unit,M+289,rowTop,8.0,regular,INK);
    const u=unitFmt(item.unitPrice),v=price(item.lineTotal);
    text(u,M+346,rowTop,regular.widthOfTextAtSize(u,8)>77?6.5:8,regular,INK);
    text(v,M+435,rowTop,bold.widthOfTextAtSize(v,8.1)>91?7:8.1,bold,NAVY);
    rowTop-=height;
   }
   pos+=rows.length;y-=h+12;
  }
  ensure(33);
  const all=price(total);
  text('TOTAL DOS SERVIÇOS:',M+18,y-10,10,bold,NAVY);
  text(all,W-M-18-bold.widthOfTextAtSize(all,13),y-12,13,bold,NAVY);
  y-=37;
 }
 function values(){
  const displayed=mode==='preview'?sim:total;
  const amount=displayed===null?'A DEFINIR':price(displayed);
  const label=mode==='preview'?'VALOR DE REFERÊNCIA DA SIMULAÇÃO':'VALOR TOTAL DA PROPOSTA';
  const note=mode==='preview'?'Simulação preliminar, sujeita à aprovação e à avaliação técnica.':
   'Valores comerciais por serviço conforme a proposta. Nenhum custo interno é apresentado.';
  const h=132;ensure(h+12);const top=y;
  panel(M,top,CW,h);
  labelHeader(4,'RESUMO DO ORÇAMENTO',top);
  rounded(M+18,top-112,CW-36,51,8,rgbHex('#EAF2FA'));
  box(M+18,top-112,4,51,GOLD);
  text(label,M+33,top-76,8,bold,MUTED);
  const amtSize=bold.widthOfTextAtSize(amount,22)>CW-75?16:22;
  text(amount,M+33,top-103,amtSize,bold,NAVY);
  if(mode==='preview'){
   const bx=W-M-137;
   rounded(bx,top-101,112,22,10,GOLD_LIGHT);
   text('NÃO VALIDADO',bx+10,top-86,8.2,bold,GOLD_DARK);
  }
  text(wrap(note,regular,8.1,CW-40)[0],M+19,top-124,8.1,regular,MUTED);
  y-=h+12;
 }
 function conditions(){
  const content='Valores sujeitos à confirmação do escopo, à verificação técnica, à disponibilidade e às condições do local. Este documento não substitui contrato nem vistoria quando necessária.';
  const extra=mode==='final'?' Validade e condições de pagamento a confirmar com a CIVOLTEN.':' Esta prévia é de uso interno e não constitui proposta comercial.';
  const all=wrap(content+extra,regular,9.1,CW-43);
  const h=40+all.length*13.5;ensure(h);const top=y;
  panel(M,top,CW,h,rgbHex('#FFF9EC'),false);
  box(M,top-h,4,h,GOLD);
  text('CONDIÇÕES E OBSERVAÇÕES',M+19,top-21,11,bold,NAVY);
  detailLines(all,M+19,top-40,9.1,13.5,regular,INK);
  y-=h+13;
 }
 addPage();
 overview();
 client();
 service();
 pricedItems();
 values();
 conditions();
 // Fixed footer is isolated from the content flow on all pages.
 const created=date(new Date().toISOString());
 for(let i=0;i<pages.length;i++){
  const each=pages[i];pg=each;
  line(M,34,W-M,34,LINE,.7);
  text('CIVOLTEN  /  ELÉTRICA & CONSTRUÇÃO CIVIL',M,20,7.7,bold,NAVY);
  const foot='Documento gerado em '+created+'  |  Página '+(i+1)+' de '+pages.length;
  text(foot,W-M-regular.widthOfTextAtSize(foot,7.5),20,7.5,regular,MUTED);
 }
 return new Uint8Array(await doc.save());
}
