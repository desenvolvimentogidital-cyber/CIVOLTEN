// CIVOLTEN • estimativa gerencial CLT por salário-base.
// Presets são cenários INICIAIS, não enquadramento tributário confirmado.
// CPP/RAT/terceiros podem variar por CNAE, CCT, FAP, desoneração e regime.
export const PAYROLL_PRESETS=Object.freeze({
 annex_iv:Object.freeze({regime:'annex_iv',fgtsPct:8,employerPct:20,ratPct:2,terceirosPct:0}),
 simples_other:Object.freeze({regime:'simples_other',fgtsPct:8,employerPct:0,ratPct:0,terceirosPct:0}),
 general:Object.freeze({regime:'general',fgtsPct:8,employerPct:20,ratPct:2,terceirosPct:5.8})
});
export const DEFAULT_PAYROLL={...PAYROLL_PRESETS.annex_iv,reviewed:false};
export function payrollPreset(regime){
 return {...(PAYROLL_PRESETS[regime]||PAYROLL_PRESETS.annex_iv),reviewed:false};
}
export function payrollConfig(raw){
 const regime=PAYROLL_PRESETS[raw?.regime]?raw.regime:'annex_iv';
 const preset=payrollPreset(regime);
 const config={...preset,...(raw||{}),regime};
 for(const key of ['fgtsPct','employerPct','ratPct','terceirosPct']){
  const n=Number(config[key]);
  config[key]=Number.isFinite(n)&&n>=0&&n<=100?n:preset[key];
 }
 config.reviewed=raw?.reviewed===true;
 return config;
}
export function validatePayroll(form){
 const regime=String(form.regime||'');
 if(!PAYROLL_PRESETS[regime])throw Error('Selecione o enquadramento da empresa.');
 const output={regime,reviewed:true};
 for(const key of ['fgtsPct','employerPct','ratPct','terceirosPct']){
  const raw=String(form[key]??'').trim();
  if(!raw)throw Error('Informe todos os percentuais da empresa.');
  const n=Number(raw.replace(',','.'));
  if(!Number.isFinite(n)||n<0||n>100)throw Error('Os encargos devem ficar entre 0% e 100%.');
  output[key]=Math.round(n*100)/100;
 }
 return output;
}
// Dinheiro em centavos: evita erro no somatório. Recebe salário já em centavos.
export function cltFromCents(salary,settings){
 const cfg=payrollConfig(settings);
 if(!Number.isSafeInteger(salary)||salary<=0)return null;
 // Modelo gerencial de custo da mão de obra / cobertura de férias:
 // provisiona 13º + férias/cobertura + terço constitucional mensalmente.
 // Não representa o valor exato da folha ou obrigação mensal recolhida.
 const thirteenth=Math.round(salary/12);
 const vacation=Math.round(salary/12);
 const vacationThird=Math.round(salary/36);
 const chargeBase=salary+thirteenth+vacation+vacationThird;
 const part=(rate)=>Math.round(chargeBase*rate/100);
 const fgts=part(cfg.fgtsPct),employer=part(cfg.employerPct),
  rat=part(cfg.ratPct),terceiros=part(cfg.terceirosPct);
 return {
  salary,thirteenth,vacation,vacationThird,chargeBase,
  fgts,employer,rat,terceiros,
  subtotal:chargeBase+fgts+employer+rat+terceiros,
  regime:cfg.regime,reviewed:cfg.reviewed,
  rates:cfg
 };
}
