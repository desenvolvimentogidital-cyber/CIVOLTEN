/* Inteiros em centavos: sem usar float nas somas de recebimentos/custos.
 * Projeção não é lucro líquido, faturamento tributável nem extrato bancário.
 */
const toCents=(v,label)=>{
 if(!/^-?\d+(?:\.\d{1,2})?$/.test(String(v)))throw new RangeError(label+' em centavos inválido');
 const negative=String(v).startsWith('-');
 const raw=String(v).replace('-',''),[major,frac='']=raw.split('.');
 const n=BigInt(major)*100n+BigInt(frac.padEnd(2,'0'));
 if(n>9_000_000_000_000_000n)throw new RangeError('Montante fora do limite');
 return negative?-n:n;
};
const money=c=>{
 if(c===null)return null;
 if(c>BigInt(Number.MAX_SAFE_INTEGER)||c< -BigInt(Number.MAX_SAFE_INTEGER))
  throw new RangeError('Limite monetário seguro excedido');
 return Number(c)/100;
};
const pct=(n,den)=>{
 if(den===0n)return null;
 const negative=(n<0n)!==(den<0n);
 const numerator=(n<0n?-n:n)*10000n;
 const denominator=den<0n?-den:den;
 const rounded=(numerator+denominator/2n)/denominator;
 return Number(negative?-rounded:rounded)/100;
};
export function financialProgress({budgetDirect,indicativePrice,actualCosts=[],receipts=[],forecasts=[]}){
 const sum=(arr,status)=>arr.filter(x=>x.status===status).reduce(
  (total,x)=>total+toCents(x.amount,'Evidência'),0n);
 const costValidated=sum(actualCosts,'validado'),costPending=sum(actualCosts,'pendente');
 const receiptValidated=sum(receipts,'validado'),receiptPending=sum(receipts,'pendente');
 const baseline=toCents(budgetDirect,'Orçamento direto'),price=toCents(indicativePrice,'Preço estimado');
 const approvedForecasts=forecasts.filter(x=>x.status==='validado')
  .sort((a,b)=>String(b.reviewed_at||'').localeCompare(String(a.reviewed_at||''))||
    String(b.created_at||'').localeCompare(String(a.created_at||''))||
    String(b.id||'').localeCompare(String(a.id||'')));
 const latest=approvedForecasts[0]||null;
 const remaining=latest?toCents(latest.expected_remaining_cost,'Custo a completar'):null;
 const projected=remaining===null?null:costValidated+remaining;
 const indicativeContribution=price-baseline;
 const projectedContribution=projected===null?null:price-projected;
 return {
  actual_cost_validated_reais:money(costValidated),
  actual_cost_pending_reais:money(costPending),
  receipt_validated_reais:money(receiptValidated),
  receipt_pending_reais:money(receiptPending),
  observed_receipts_less_incurred_costs_reais:money(receiptValidated-costValidated),
  budget_direct_reais:money(baseline),
  indicative_sale_price_reais:money(price),
  indicative_budget_contribution_reais:money(indicativeContribution),
  indicative_contribution_pct:pct(indicativeContribution,price),
  budget_cost_consumed_pct:pct(costValidated,baseline),
  approved_remaining_cost_reais:money(remaining),
  latest_forecast_id:latest?.id||null,
  projected_cost_at_completion_reais:money(projected),
  hypothetical_contribution_at_estimated_price_reais:money(projectedContribution),
  hypothetical_contribution_pct:pct(projectedContribution??0n,projected===null?0n:price),
  actual_net_profit_reais:null,
  actual_net_profit_margin_pct:null,
  contract_accepted:false,
  notes:[
   'Recebimentos validados não comprovam emissão de nota fiscal ou aceite do cliente.',
   'Custos realizados e recebimentos são grandezas diferentes de caixa líquido contábil.',
   'A projeção considera somente o último custo a completar validado e o preço ainda estimado.',
   'Lucro real exige contrato válido, receita e despesas completas, tributos e encerramento contábil.'
  ]
 };
}
