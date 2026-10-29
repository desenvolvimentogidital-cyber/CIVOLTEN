/* CIVOLTEN — Proposta PDF A4 versionada. Não expor rota pública sem sessão/autorização.
 * Esta biblioteca só gera PDF com snapshot explicitamente aprovado.
 */
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

function required(value,label){
 if(typeof value!=='string'||value.trim().length<2)throw new Error(label+' obrigatório para emissão comercial');
 return value.trim();
}
function assertReady(doc){
 const checks=doc?.review||{};
 for(const k of ['technical','commercial','costs','scope','payment','schedule']){
   if(checks[k]!==true)throw new Error('Proposta bloqueada: revisão '+k+' pendente');
 }
 if(!doc?.snapshot_sha256||!/^[a-f0-9]{64}$/i.test(doc.snapshot_sha256))throw new Error('Snapshot não versionado ou não assinado');
 if(!Array.isArray(doc.items)||!doc.items.length)throw new Error('Proposta sem itens');
 if(!Number.isFinite(Number(doc.total))||Number(doc.total)<=0)throw new Error('Total inválido');
 required(doc.code,'Código da proposta');
 required(doc.company?.name,'Empresa');
 required(doc.company?.tax_id,'CNPJ da emitente');
 required(doc.client?.name,'Cliente');
 required(doc.project?.address,'Endereço da obra');
 required(doc.payment_terms,'Pagamento');
 required(doc.scope,'Escopo');
 required(doc.exclusions,'Exclusões');
 if(!Number.isInteger(Number(doc.validity_days))||Number(doc.validity_days)<1)throw new Error('Validade inválida');
}
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
function safe(s){return String(s??'').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,' ').replace(/\s+/g,' ').trim()}
function textWrap(font,value,size,width){
 const tokens=safe(value).split(' '),out=[];let current='';
 for(const word of tokens){
   const trial=current?current+' '+word:word;
   if(font.widthOfTextAtSize(trial,size)<=width){current=trial;continue}
   if(current)out.push(current);
   // Palavras longas são segmentadas em vez de cortar fora da página.
   if(font.widthOfTextAtSize(word,size)>width){
      let part='';
      for(const letter of word){
        if(part&&font.widthOfTextAtSize(part+letter,size)>width){out.push(part);part=letter}else part+=letter;
      }
      current=part;
   }else current=word;
 }
 if(current)out.push(current);
 return out.length?out:['-'];
}
export async function renderProposalPdf(doc,{logoPath}={}){
 assertReady(doc);
 const pdf=await PDFDocument.create();
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const orange=rgb(.94,.45,.09),ink=rgb(.12,.15,.21),muted=rgb(.39,.43,.49),light=rgb(.94,.94,.94);
 let page,y,number=0;
 const start=()=>{
   page=pdf.addPage([595.28,841.89]);number++;
   y=795;
   page.drawRectangle({x:32,y:814,width:531,height:4,color:orange});
   page.drawText('CIVOLTEN   |   ELÉTRICA & CONSTRUÇÃO CIVIL',{x:36,y:794,size:13,font:bold,color:ink});
   y=765;page.drawLine({start:{x:36,y},end:{x:559,y},thickness:.8,color:light});y-=22;
 };
 const next=(h=15)=>{if(y-h<72)start()};
 const line=(str,{fontFace=font,size=10,color=ink,indent=0,spacing=5}={})=>{
   const wrapped=textWrap(fontFace,str,size,523-indent);
   for(const content of wrapped){next(size+spacing+2);page.drawText(content,{x:36+indent,y,size,font:fontFace,color});y-=size+spacing}
 };
 const title=str=>{next(30);y-=6;line(str,{fontFace:bold,size:14,color:orange,spacing:7})};
 const entry=(a,b)=>{next(18);page.drawText(safe(a),{x:36,y,size:10,font,color:muted});page.drawText(safe(b),{x:330,y,size:10,font:bold,color:ink});y-=18};
 start();
 if(logoPath){try{const bytes=await readFile(path.resolve(logoPath));const image=await pdf.embedPng(bytes);
   const size=image.scaleToFit(128,53);page.drawImage(image,{x:430,y:746,width:size.width,height:size.height})}catch{/* fallback marca textual */}}
 line('PROPOSTA COMERCIAL  |  '+doc.code,{fontFace:bold,size:17,spacing:8});
 line('Versão '+String(doc.version||1)+'  •  Emissão: '+safe(doc.issued_on||new Date().toISOString().slice(0,10)),{color:muted,size:9});
 title('Dados das partes');
 line('Emitente: '+doc.company.name+'  •  CNPJ: '+doc.company.tax_id);
 line('Cliente: '+doc.client.name+'  •  Documento: '+safe(doc.client.tax_id||'conforme cadastro'));
 line('Obra: '+safe(doc.project.name||'Obra contratada')+'  •  '+doc.project.address);
 title('Objeto e escopo');
 line(doc.scope);
 title('Planilha de serviços e quantitativos');
 entry('Itens descritos','Valor direto');
 let directTotal=0;
 for(let i=0;i<doc.items.length;i++){
   const item=doc.items[i];
   const quantity=Number(item.quantity),unitCost=Number(item.unit_cost);
   if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitCost)||unitCost<0)throw Error('Item '+(i+1)+' com valor inválido');
   const cost=Math.round(quantity*unitCost*100)/100;directTotal+=cost;
   line((i+1)+'. '+safe(item.description)+'  ['+safe(item.code||'próprio')+']',{fontFace:bold,size:10});
   line(quantity+' '+safe(item.unit)+' × '+money(unitCost)+' = '+money(cost),{indent:14,size:9,color:muted});
 }
 title('Resumo financeiro');
 entry('Subtotal direto',money(directTotal));
 entry('BDI explicitado',money(doc.bdi_amount||0));
 entry('Contingência explícita',money(doc.contingency_amount||0));
 entry('TOTAL DA PROPOSTA',money(doc.total));
 if(Math.abs(directTotal+Number(doc.bdi_amount||0)+Number(doc.contingency_amount||0)-Number(doc.total))>.02)
  throw new Error('Divergência entre soma de itens, encargos e total aprovado');
 title('Condições contratuais');
 line('Pagamento: '+doc.payment_terms);
 line('Validade comercial: '+doc.validity_days+' dias.');
 line('Prazo de execução: '+safe(doc.execution_term||'Conforme cronograma aprovado e anexado.'));
 title('Exclusões e responsabilidades');
 line(doc.exclusions);
 line('Esta proposta deve ser aceita nas condições e na versão indicadas. Alterações de escopo exigem aditivo documentado.');
 next(60);y-=25;
 line('______________________________________');
 line('Responsável autorizado CIVOLTEN   •   Assinatura/aceite');
 for(let i=0;i<pdf.getPages().length;i++){
   pdf.getPages()[i].drawText('CIVOLTEN  •  '+safe(doc.code)+'  •  Página '+(i+1)+' / '+pdf.getPages().length,
     {x:36,y:32,font,size:8,color:muted});
 }
 pdf.setTitle('Proposta comercial CIVOLTEN '+doc.code);
 pdf.setAuthor(doc.company.name);
 pdf.setSubject('Documento contratual versionado');
 return Buffer.from(await pdf.save());
}
