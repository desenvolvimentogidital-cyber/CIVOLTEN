import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Identidade visual CIVOLTEN - PDF A4 vetorial, com texto selecionável.
// Valores e informações vêm exclusivamente do pedido autenticado do backend.
const NAVY=rgb(0.035,0.080,0.143);
const NAVY2=rgb(0.070,0.145,0.232);
const GOLD=rgb(0.946,0.705,0.174);
const INK=rgb(0.083,0.130,0.208);
const MUTED=rgb(0.345,0.405,0.475);
const LIGHT=rgb(0.939,0.958,0.980);
const PALE=rgb(0.972,0.981,0.993);
const WARM=rgb(1,0.959,0.851);
const WHITE=rgb(1,1,1);
const PW=595.28,PH=841.89,M=39,CW=PW-2*M;
const brl=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
function date(value){
 if(!value)return '—';
 const d=new Date(value);
 return Number.isNaN(d.valueOf())?'—':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(d);
}
function clean(value){
 return String(value??'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,c=>({
 '–':'-','—':'-','“':'"','”':'"','’':"'",'‘':"'",'•':'-','…':'...','⚡':'-'
 }[c]||'?')).trim();
}
function linesOf(value,font,size,width){
 const words=clean(value).split(/\s+/).filter(Boolean),out=[];
 let line='';
 for(let word of words){
  while(word.length>1&&font.widthOfTextAtSize(word,size)>width){
   let take=1;
   while(take<word.length&&font.widthOfTextAtSize(word.slice(0,take+1),size)<=width)take++;
   if(line){out.push(line);line='';}
   out.push(word.slice(0,take));word=word.slice(take);
  }
  const next=line?line+' '+word:word;
  if(line&&font.widthOfTextAtSize(next,size)>width){out.push(line);line=word;}
  else line=next;
 }
 if(line)out.push(line);
 return out.length?out:['—'];
}
function finitePrice(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0&&n<=100000000?Math.round(n*100)/100:null;
}
function modelData(model,mode){
 const p=model?.pedido;
 if(!p||typeof p.id!=='string')throw Error('Pedido ausente');
 if(!['preview','final'].includes(mode))throw Error('Modo inválido');
 const min=finitePrice(p.estimate_min),max=finitePrice(p.estimate_max);
 if(mode==='final'&&(min===null||max===null||min>max)){
  throw Object.assign(new Error('Defina e salve os valores mínimo e máximo antes de emitir o PDF ao cliente.'),{status:409});
 }
 const selected=Array.isArray(p.request_details?.itens)?p.request_details.itens.slice(0,60):[];
 const catalog=new Map((Array.isArray(model.servicos)?model.servicos:[]).map(s=>[s.service_id,s]));
 const snapshot=new Map((Array.isArray(model.simulacao?.itens)?model.simulacao.itens:[]).map(s=>[s.servico_id,s]));
 const items=selected.map((s,i)=>{
  const catalogItem=catalog.get(s.servico_id),old=snapshot.get(s.servico_id);
  return {
   name:catalogItem?.description||old?.descricao||'Serviço '+(i+1),
   unit:catalogItem?.unit||old?.unidade||'un.',
   qty:Number.isFinite(Number(s.quantidade))&&Number(s.quantidade)>=0?Number(s.quantidade):0
  };
 });
 return {p,min,max,items,sim:finitePrice(model.simulacao?.total_bruto)};
}

export async function generateQuotePdf(model,mode='preview'){
 const {p,min,max,items,sim}=modelData(model,mode);
 const pdf=await PDFDocument.create();
 const body=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const protocol=p.id.slice(0,8).toUpperCase();
 pdf.setTitle('CIVOLTEN - Orçamento '+protocol);
 pdf.setAuthor('CIVOLTEN - Elétrica e Construção Civil');
 pdf.setSubject(mode==='preview'?'Prévia interna de orçamento':'Orçamento para o cliente');
 pdf.setLanguage('pt-BR');
 const pages=[];
 let page,y;
 function header(){
  page.drawRectangle({x:0,y:PH-129,width:PW,height:129,color:NAVY});
  page.drawRectangle({x:0,y:PH-129,width:7,height:129,color:GOLD});
  page.drawRectangle({x:M,y:PH-29,width:42,height:4,color:GOLD});
  page.drawText('CIVOLTEN',{x:M,y:PH-67,font:bold,size:29,color:WHITE});
  page.drawText('ELÉTRICA & CONSTRUÇÃO CIVIL',{x:M,y:PH-85,font:bold,size:9.5,color:GOLD});
  page.drawLine({start:{x:M,y:PH-100},end:{x:PW-M,y:PH-100},color:rgb(.30,.36,.43),thickness:.7});
  page.drawText('INSTALAÇÕES ELÉTRICAS    |    CONSTRUÇÃO CIVIL    |    REFORMAS',{
   x:M,y:PH-117,font:body,size:7.9,color:WHITE
  });
  // Elementos arquitetônicos vetoriais no canto direito, sem imagens externas.
  const X=PW-146,Y=PH-70;
  page.drawLine({start:{x:X,y:Y+8},end:{x:X+54,y:Y+36},thickness:2.6,color:GOLD});
  page.drawLine({start:{x:X+54,y:Y+36},end:{x:X+105,y:Y+8},thickness:2.6,color:GOLD});
  page.drawLine({start:{x:X+17,y:Y+16},end:{x:X+17,y:Y-16},thickness:2,color:WHITE,opacity:.42});
  page.drawLine({start:{x:X+92,y:Y+15},end:{x:X+92,y:Y-16},thickness:2,color:WHITE,opacity:.42});
  page.drawRectangle({x:X+44,y:Y-16,width:23,height:31,borderColor:GOLD,borderWidth:1.4,opacity:.8});
 }
 function newPage(){
  page=pdf.addPage([PW,PH]);pages.push(page);header();y=PH-149;
 }
 function ensure(height){
  if(y-height<80)newPage();
 }
 function heading(label){
  ensure(36);
  y-=6;
  page.drawRectangle({x:M,y:y-7,width:4,height:18,color:GOLD});
  page.drawText(clean(label),{x:M+13,y:y-4,font:bold,size:11.5,color:NAVY});
  page.drawLine({start:{x:M+13,y:y-16},end:{x:PW-M,y:y-16},color:LIGHT,thickness:1});
  y-=28;
 }
 function paragraph(value,{size=9.4,color=MUTED,font=body,x=M,width=CW,leading=14,gap=0}={}){
  for(const raw of String(value??'').split('\n')){
   const segments=linesOf(raw,font,size,width);
   for(const t of segments){
    ensure(leading);
    page.drawText(t,{x,y,font,size,color});y-=leading;
   }
  }
  y-=gap;
 }
 function clientDetails(){
  heading('DADOS DO CLIENTE');
  const pairs=[
   ['CLIENTE',p.customer_name||'Não informado'],
   ['WHATSAPP',p.phone||'Não informado'],
   ['LOCAL',([p.neighborhood,p.city].filter(Boolean).join(', ')||'Não informado')]
  ];
  const arranged=pairs.map(([key,value])=>({key,lines:linesOf(value,body,9.3,CW-123)}));
  const height=16+arranged.reduce((sum,r)=>sum+Math.max(17,r.lines.length*14),0)+9;
  ensure(height+8);
  page.drawRectangle({x:M,y:y-height,width:CW,height,color:PALE,borderColor:LIGHT,borderWidth:1});
  let pos=y-20;
  for(const row of arranged){
   page.drawText(row.key,{x:M+16,y:pos,font:bold,size:8,color:NAVY});
   for(const s of row.lines){
    page.drawText(s,{x:M+121,y:pos,font:body,size:9.3,color:INK});pos-=14;
   }
   pos-=Math.max(3,17-row.lines.length*14);
  }
  y-=height+5;
 }
 function serviceDetails(){
  heading('SERVIÇOS SOLICITADOS');
  paragraph('DESCRIÇÃO ENVIADA PELO CLIENTE',{font:bold,size:8.4,color:NAVY,gap:3});
  const desc=linesOf(p.description||'Não informada',body,9.8,CW-26);
  if(desc.length<=16){
   const h=desc.length*14.5+20;
   ensure(h+5);
   page.drawRectangle({x:M,y:y-h+4,width:CW,height:h,color:LIGHT});
   let yy=y-13;
   for(const s of desc){page.drawText(s,{x:M+13,y:yy,font:body,size:9.8,color:INK});yy-=14.5;}
   y-=h+1;
  }else{
   paragraph(p.description||'Não informada',{size:9.7,x:M+10,width:CW-20,leading:14});
   y-=5;
  }
  if(items.length){
   y-=7;
   paragraph('ITENS INCLUÍDOS NA SOLICITAÇÃO',{font:bold,size:8.4,color:NAVY,gap:4});
   for(let i=0;i<items.length;i++){
    const item=items[i],quantity=item.qty.toLocaleString('pt-BR',{maximumFractionDigits:3});
    const pieces=linesOf((i+1)+'. '+item.name+'  |  '+quantity+' '+item.unit,body,9.3,CW-23);
    ensure(pieces.length*13+8);
    const h=pieces.length*13+8;
    if(i%2===0)page.drawRectangle({x:M,y:y-h+5,width:CW,height:h,color:PALE});
    let yy=y-7;
    for(const s of pieces){page.drawText(s,{x:M+11,y:yy,font:body,size:9.3,color:INK});yy-=13;}
    y-=h;
   }
  }else{
   y-=4;
   paragraph('O cliente não selecionou itens na simulação. Solicitação baseada na descrição acima.',{size:8.7,leading:13});
  }
  if(p.request_details?.padrao){
   y-=6;
   const pattern={baixo:'Baixo',medio:'Médio',alto:'Alto'}[p.request_details.padrao]||p.request_details.padrao;
   paragraph('Padrão solicitado: '+pattern,{size:8.7,color:MUTED});
  }
 }
 function quoteValues(){
  heading('VALORES DO ORÇAMENTO');
  const hasPrice=min!==null&&max!==null;
  const amount=hasPrice?(min===max?brl(min):brl(min)+'  a  '+brl(max)):
   (sim===null?'A DEFINIR':brl(sim));
  const label=hasPrice?(min===max?'VALOR ESTIMADO':'FAIXA ESTIMADA PARA EXECUÇÃO'):
   (mode==='preview'?'SIMULAÇÃO AUTOMÁTICA - REFERÊNCIA INTERNA':'VALOR A DEFINIR');
  const amountSize=bold.widthOfTextAtSize(amount,22)>CW-40?16:22;
  ensure(100);
  page.drawRectangle({x:M,y:y-85,width:CW,height:85,color:LIGHT});
  page.drawRectangle({x:M,y:y-85,width:5,height:85,color:GOLD});
  page.drawText(label,{x:M+17,y:y-22,font:bold,size:8.8,color:NAVY});
  page.drawText(clean(amount),{x:M+17,y:y-54,font:bold,size:amountSize,color:NAVY});
  const note=hasPrice?(mode==='preview'?'Valores definidos no painel administrativo.':'Valores aprovados pela empresa.'):
   'Salve os valores mínimo e máximo no painel antes de emitir o PDF ao cliente.';
  const noteLines=linesOf(note,body,8,CW-35);
  for(let i=0;i<Math.min(2,noteLines.length);i++)
   page.drawText(noteLines[i],{x:M+17,y:y-69-(i*10),font:body,size:8,color:MUTED});
  y-=89;
 }
 function conditions(){
  heading('CONDIÇÕES E OBSERVAÇÕES');
  paragraph('Valores sujeitos à confirmação do escopo, verificação técnica, disponibilidade e condições do local. Este documento não substitui contrato ou vistoria quando necessária.',{size:8.8,leading:13.5});
  if(mode==='final')paragraph('Validade e condições de pagamento: a confirmar com a CIVOLTEN.',{size:8.8,leading:13.5,gap:4});
 }
 newPage();
 const docTitle=mode==='preview'?'PRÉVIA DE ORÇAMENTO':'ORÇAMENTO DE SERVIÇOS';
 page.drawText(docTitle,{x:M,y,font:bold,size:19,color:NAVY});
 y-=24;
 paragraph('Nº '+protocol+'   |   Pedido recebido em '+date(p.submitted_at),{size:9,font:bold,color:INK,leading:15});
 const status='Situação: '+clean(p.status||'novo').replace(/_/g,' ');
 paragraph(status,{size:8.6,leading:16,gap:3});
 if(mode==='preview'){
  ensure(43);
  page.drawRectangle({x:M,y:y-32,width:CW,height:32,color:WARM});
  page.drawRectangle({x:M,y:y-32,width:4,height:32,color:GOLD});
  page.drawText('USO INTERNO  -  NÃO ENVIAR ESTA PRÉVIA AO CLIENTE',{x:M+13,y:y-20,font:bold,size:9.1,color:NAVY});
  y-=41;
 }
 clientDetails();
 serviceDetails();
 quoteValues();
 conditions();
 for(let i=0;i<pages.length;i++){
  const sheet=pages[i];
  sheet.drawRectangle({x:0,y:0,width:PW,height:36,color:NAVY});
  sheet.drawRectangle({x:0,y:36,width:PW,height:2,color:GOLD});
  sheet.drawText('CIVOLTEN  |  ELÉTRICA & CONSTRUÇÃO CIVIL  |  SÃO PAULO - SP',{
   x:M,y:17,font:bold,size:8,color:WHITE
  });
  const pageLabel='PÁGINA '+(i+1)+' DE '+pages.length;
  sheet.drawText(pageLabel,{
   x:PW-M-bold.widthOfTextAtSize(pageLabel,7.5),y:17,font:bold,size:7.5,color:GOLD
  });
  sheet.drawText('Documento gerado em '+date(new Date().toISOString()),{
   x:M,y:48,font:body,size:7.4,color:MUTED
  });
 }
 return new Uint8Array(await pdf.save());
}
