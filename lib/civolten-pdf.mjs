import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// PDF gerado inteiramente no backend. Sem notas internas, custos ou valores unitários.
const NAVY=rgb(0.047,0.094,0.16), GOLD=rgb(0.92,0.69,0.20);
const SLATE=rgb(0.28,0.35,0.42), WHITE=rgb(1,1,1), LIGHT=rgb(0.94,0.96,0.98);
const PAGE_W=595.28,PAGE_H=841.89,MARGIN=45,CONTENT_W=PAGE_W-90;
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));
const date=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(new Date(v)):'—';

function printable(value){
  // Helvetica do PDF suporta WinAnsi; remove caracteres que fariam a biblioteca falhar.
  const cleaned=String(value??'').replace(/[\u0000-\u001F\u007F-\u009F]/g,' ').trim();
  return cleaned.replace(/[^\x20-\x7E\u00A0-\u00FF]/g,ch=>({
    '–':'-','—':'-','“':'"','”':'"','’':"'",'‘':"'",'€':'EUR','•':'-','…':'...','\u20B9':'R$'
  }[ch]||'?'));
}
function wrap(text,font,size,maxWidth){
 const words=printable(text).split(/\s+/).filter(Boolean),lines=[];
 let current='';
 for(let word of words){
  while(font.widthOfTextAtSize(word,size)>maxWidth&&word.length>1){
   let n=1;
   while(n<word.length&&font.widthOfTextAtSize(word.slice(0,n+1),size)<=maxWidth)n++;
   if(current){lines.push(current);current='';}
   lines.push(word.slice(0,n));word=word.slice(n);
  }
  if(!word)continue;
  const next=current?current+' '+word:word;
  if(font.widthOfTextAtSize(next,size)>maxWidth&&current){lines.push(current);current=word}
  else current=next;
 }
 if(current)lines.push(current);
 return lines.length?lines:['—'];
}
function normalizeMoney(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0&&n<=100000000?Math.round(n*100)/100:null;
}
function checkedData(model,mode){
 const p=model?.pedido;
 if(!p||typeof p.id!=='string')throw Error('Pedido ausente');
 if(mode!=='preview'&&mode!=='final')throw Error('Modo inválido');
 const min=normalizeMoney(p.estimate_min),max=normalizeMoney(p.estimate_max);
 if(mode==='final'&&(min===null||max===null||min>max))
  throw Object.assign(new Error('Defina e salve os valores mínimo e máximo antes de emitir o PDF ao cliente.'),{status:409});
 const requested=Array.isArray(p.request_details?.itens)?p.request_details.itens.slice(0,60):[];
 const labels=new Map((model.servicos||[]).map(x=>[x.service_id,{description:x.description,unit:x.unit}]));
 const snapshot=new Map((model.simulacao?.itens||[]).map(x=>[x.servico_id,x]));
 const items=requested.map((x,i)=>({
  name:labels.get(x.servico_id)?.description||snapshot.get(x.servico_id)?.descricao||('Serviço '+(i+1)),
  unit:labels.get(x.servico_id)?.unit||snapshot.get(x.servico_id)?.unidade||'un.',
  quantity:Number(x.quantidade)||0
 }));
 return {p,min,max,items,sim:normalizeMoney(model.simulacao?.total_bruto),mode};
}

export async function generateQuotePdf(model,mode='preview'){
 const {p,min,max,items,sim}=checkedData(model,mode);
 const pdf=await PDFDocument.create();
 pdf.setTitle('CIVOLTEN - Orçamento '+p.id.slice(0,8).toUpperCase());
 pdf.setAuthor('CIVOLTEN - Elétrica e Construção Civil');
 pdf.setSubject(mode==='final'?'Orçamento para o cliente':'Prévia administrativa de orçamento');
 const body=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const pages=[];
 let page,y;
 const nextPage=()=>{
  page=pdf.addPage([PAGE_W,PAGE_H]);pages.push(page);
  page.drawRectangle({x:0,y:PAGE_H-105,width:PAGE_W,height:105,color:NAVY});
  page.drawRectangle({x:MARGIN,y:PAGE_H-33,width:37,height:4,color:GOLD});
  page.drawText('CIVOLTEN',{x:MARGIN,y:PAGE_H-63,font:bold,size:25,color:WHITE});
  page.drawText('ELÉTRICA & CONSTRUÇÃO CIVIL',{x:MARGIN,y:PAGE_H-84,font:body,size:10,color:GOLD});
  const type=mode==='final'?'ORÇAMENTO':'PRÉVIA INTERNA';
  page.drawText(type,{x:PAGE_W-MARGIN-bold.widthOfTextAtSize(type,11),y:PAGE_H-62,font:bold,size:11,color:WHITE});
  y=PAGE_H-132;
 };
 const ensure=height=>{if(y-height<70)nextPage()};
 const text=(content,opts={})=>{
  const size=opts.size||10,lineHeight=opts.lineHeight||15,font=opts.bold?bold:body,x=opts.x||MARGIN;
  const width=opts.width||CONTENT_W;
  for(const line of String(content??'').split('\n')){
   const lines=wrap(line,font,size,width);
   for(const segment of lines){
    ensure(lineHeight);
    page.drawText(segment,{x,y,font,size,color:opts.color||SLATE});
    y-=lineHeight;
   }
  }
 };
 const title=label=>{
  ensure(43);y-=10;
  page.drawRectangle({x:MARGIN,y:y+2,width:4,height:18,color:GOLD});
  page.drawText(printable(label),{x:MARGIN+13,y:y+5,font:bold,size:12,color:NAVY});
  y-=27;
 };
 const space=n=>{ensure(n);y-=n};
 nextPage();
 const protocol=p.id.slice(0,8).toUpperCase();
 text('Orçamento nº '+protocol+'  |  Pedido recebido em '+date(p.submitted_at),{size:10,bold:true,color:NAVY});
 text('Situação: '+String(p.status||'em análise').replaceAll('_',' '),{size:9});
 if(mode==='preview'){
  space(8);
  page.drawRectangle({x:MARGIN,y:y-14,width:CONTENT_W,height:27,color:rgb(1,.96,.85)});
  page.drawText('USO INTERNO - NÃO ENVIAR ESTA PRÉVIA AO CLIENTE',{x:MARGIN+10,y:y-5,font:bold,size:10,color:NAVY});
  y-=37;
 }
 title('DADOS DO CLIENTE');
 text('Cliente: '+(p.customer_name||'Não informado'));
 text('WhatsApp: '+(p.phone||'Não informado'));
 text('Local: '+[p.neighborhood,p.city].filter(Boolean).join(', '));
 title('SERVIÇOS SOLICITADOS');
 text('Descrição enviada pelo cliente:',{bold:true,color:NAVY});
 text(p.description||'Não informada',{lineHeight:15});
 space(8);
 if(items.length){
  for(let i=0;i<items.length;i++){
   const item=items[i];const quantity=Number(item.quantity).toLocaleString('pt-BR',{maximumFractionDigits:3});
   text((i+1)+'. '+item.name+' - '+quantity+' '+item.unit,{size:10,lineHeight:16});
  }
 }else{
  text('O cliente não selecionou itens na simulação. Solicitação baseada na descrição acima.');
 }
 if(p.request_details?.padrao){
  space(7);text('Padrão solicitado: '+({baixo:'Baixo',medio:'Médio',alto:'Alto'}[p.request_details.padrao]||p.request_details.padrao),{size:10});
 }
 title('VALORES DO ORÇAMENTO');
 if(min!==null&&max!==null){
  const label=min===max?'Valor estimado:':'Faixa estimada para execução:';
  text(label,{size:10,bold:true});
  text(min===max?money(min):money(min)+' a '+money(max),{size:18,bold:true,color:NAVY,lineHeight:26});
  if(mode==='preview')text('Valores definidos pela empresa no painel administrativo.',{size:9});
 }else if(mode==='preview'){
  if(sim!==null){
   text('Simulação automática recebida (referência interna):',{size:10,bold:true});
   text(money(sim),{size:18,bold:true,color:NAVY,lineHeight:25});
  }else text('Sem valor calculado. Solicitação sujeita a avaliação personalizada.');
  text('Para gerar o PDF do cliente, salve os valores mínimo e máximo no painel.',{size:9});
 }
 title('CONDIÇÕES E OBSERVAÇÕES');
 text('Valores sujeitos à confirmação do escopo, verificação técnica, disponibilidade e condições do local. Este documento não substitui contrato ou vistoria quando necessária.',{lineHeight:15});
 if(mode==='final')text('Validade e condições de pagamento: a confirmar com a CIVOLTEN.',{lineHeight:15});
 space(15);
 text('CIVOLTEN | Elétrica e Construção Civil | São Paulo - SP',{size:9,bold:true,color:NAVY});
 for(let i=0;i<pages.length;i++){
  const p=pages[i];
  p.drawLine({start:{x:MARGIN,y:55},end:{x:PAGE_W-MARGIN,y:55},thickness:.7,color:LIGHT});
  p.drawText('CIVOLTEN - Documento gerado em '+date(new Date().toISOString()),{x:MARGIN,y:40,font:body,size:8,color:SLATE});
  const label='Página '+(i+1)+' de '+pages.length;
  p.drawText(label,{x:PAGE_W-MARGIN-bold.widthOfTextAtSize(label,8),y:40,font:bold,size:8,color:SLATE});
 }
 return new Uint8Array(await pdf.save());
}
