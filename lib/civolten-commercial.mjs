// Valores comerciais para o PDF do cliente: distribui o total final entre serviços
// por proporção dos itens armazenados no snapshot autenticado do orçamento.
// Não imprime preços-base, tributos, custos fixos, logística ou margens.
const toCents=value=>Math.round(Number(value)*100);
const money=n=>Number.isFinite(Number(n))&&Number(n)>0&&Number(n)<=100000000?Math.round(Number(n)*100)/100:null;
const failure=msg=>Object.assign(new Error(msg),{status:409});

export function approvedQuoteTotal(pedido,simulacao){
 const min=money(pedido?.estimate_min),max=money(pedido?.estimate_max);
 // Compatibilidade com o banco existente: um preço aprovado é salvo com min=max.
 if(min!==null&&max!==null&&min===max)return min;
 return money(simulacao?.total_bruto);
}

export function commercialBreakdown(pedido,simulacao,servicos=[],totalValue){
 const total=money(totalValue);
 if(total===null)throw failure('Este pedido ainda não tem um valor total válido para emitir ao cliente.');
 const name=String(pedido?.customer_name||'').trim();
 if(name.length<2)throw failure('Falta preencher o nome do cliente (mínimo de 2 caracteres).');
 const description=String(pedido?.description||'').trim();
 if(!description)throw failure('Falta preencher a descrição do serviço. Solicite os dados completos antes de emitir o PDF.');
 if(description.length<12)throw failure('A descrição do serviço está incompleta (mínimo de 12 caracteres).');
 const selected=Array.isArray(pedido?.request_details?.itens)?pedido.request_details.itens.slice(0,60):[];
 const amountCents=toCents(total);
 if(!selected.length){
  if(!String(pedido?.description||'').trim())throw failure('Informe o escopo do pedido antes de gerar o PDF.');
  return [{name:String(pedido.description),unit:'serv.',quantity:1,unitPrice:total,lineTotal:total}];
 }
 const snap=Array.isArray(simulacao?.itens)?simulacao.itens:[];
 if(snap.length!==selected.length)throw failure('Não foi possível conferir os itens da simulação. Faça nova avaliação antes de enviar o PDF.');
 const catalog=new Map((Array.isArray(servicos)?servicos:[]).map(s=>[s.service_id,s]));
 const amounts=[];
 for(let i=0;i<selected.length;i++){
  const request=selected[i],entry=snap[i];
  const qty=Number(request?.quantidade);
  if(!entry||request?.servico_id!==entry.servico_id||!Number.isFinite(qty)||qty<=0||Math.abs(Number(entry.quantidade)-qty)>0.000001)
   throw failure('Os serviços da solicitação não coincidem com a simulação salva.');
  const referenceCents=toCents(entry.total);
  if(!Number.isSafeInteger(referenceCents)||referenceCents<=0)throw failure('O serviço está sem preço calculado. Revise o orçamento.');
  const svc=catalog.get(request.servico_id);
  amounts.push({
   name:entry.descricao||svc?.description||'Serviço '+(i+1),
   unit:entry.unidade||svc?.unit||'un.',
   quantity:qty,
   weight:referenceCents
  });
 }
 const sum=amounts.reduce((s,x)=>s+x.weight,0);
 if(!Number.isSafeInteger(sum)||sum<=0)throw failure('Dados de precificação inválidos.');
 let used=0;
 const allocated=amounts.map((item,index)=>{
  const share=amountCents*item.weight/sum;
  const cents=Math.floor(share);
  used+=cents;
  return {...item,index,cents,remainder:share-cents};
 });
 const extras=amountCents-used;
 const sorted=[...allocated].sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
 for(let i=0;i<extras;i++)sorted[i%sorted.length].cents++;
 return allocated.map(({name,unit,quantity,cents})=>{
  const lineTotal=Number((cents/100).toFixed(2));
  return {name,unit,quantity,lineTotal,unitPrice:Math.round(lineTotal/quantity*10000)/10000};
 });
}
