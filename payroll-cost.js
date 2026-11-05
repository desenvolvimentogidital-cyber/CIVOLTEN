/* CIVOLTEN — Motor único de custo mensal do empregado.
 * Referência gerencial de custo empregador; NÃO substitui folha/eSocial/contador.
 * Salário base nunca deve ser confundido com custo completo. */
(function(){
'use strict';
const p=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)&&x>=0?x:0};
const round=v=>Math.round((Number(v)||0)*100)/100;
function calculate(w={}){
 const base=p(w.salary);
 const additionalKind=w.additionalKind||'none';
 const dangerous=additionalKind==='periculosidade';
 const unhealthy=additionalKind==='insalubridade';
 const hazardPercent=dangerous?p(w.hazardPercent??30):0;
 const hazardPay=dangerous?base*hazardPercent/100:0;
 // Insalubridade depende de enquadramento e base legal/CCT — informado em reais.
 const unhealthyPay=unhealthy?p(w.unhealthyMonthly):0;
 const salaryExtras=p(w.fixedPayExtras);
 const remuneration=base+hazardPay+unhealthyPay+salaryExtras;
 const thirteenth=remuneration/12;
 // Salário do mês inclui as férias remuneradas; provisiona-se aqui só o adicional de 1/3.
 const vacationThird=remuneration/36;
 const chargeBase=remuneration+thirteenth+vacationThird;
 const fgtsPct=p(w.fgts??8),employerPct=p(w.employerInss??3),ratPct=p(w.employerExtraPercent??0);
 const otherPct=p(w.additionalEmployerPercent);
 const fgts=chargeBase*fgtsPct/100,employer=chargeBase*employerPct/100,rat=chargeBase*ratPct/100,otherCharges=chargeBase*otherPct/100;
 const benefitsMeal=p(w.mealBenefit),benefitsTransport=p(w.transportBenefit),benefitsOther=p(w.otherBenefit);
 const benefits=benefitsMeal+benefitsTransport+benefitsOther;
 const terminationReserve=chargeBase*p(w.terminationReservePercent)/100;
 const absenceCover=p(w.absenceCoverMonthly);
 const monthlyReserve=p(w.monthlyReserve);
 const charges=fgts+employer+rat+otherCharges;
 const total=chargeBase+charges+benefits+terminationReserve+absenceCover+monthlyReserve;
 const hours=p(w.productiveHours)||160;
 return {base,wage:base,additionalKind,hazardPay,unhealthyPay,salaryExtras,
  remuneration,thirteenth,vacationThird,chargeBase,
  fgts,employer,rat,otherCharges,charges,
  benefitsMeal,benefitsTransport,benefitsOther,benefits,meals:benefitsMeal,
  transport:benefitsTransport,monthlyReserve,terminationReserve,absenceCover,
  total:round(total),hourly:total/hours,hours,
  // Campos compatíveis com os módulos anteriores:
  third:vacationThird};
}
function hourly(w){
 if(!w)return 0;
 const salary=p(w.salary),cost=p(w.cost),hours=p(w.productiveHours)||160;
 if(w.link==='Empregado'||w.employmentType==='CLT')return salary>0?calculate(w).hourly:cost/hours;
 if(w.unit==='mês')return cost/hours;
 if(w.unit==='diária')return cost/(p(w.dailyHours)||8);
 return cost;
}
window.CIVOLTENPayroll={calculate,hourly};
})();