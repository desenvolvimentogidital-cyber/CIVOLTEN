// Controle físico da obra: NÃO é medição, cobrança ou apontamento de horas.
import {decimal} from './calc.mjs';
import {validDate} from './finance.mjs';
export const FIELD_STATES={
 pending:'Pendente',in_progress:'Em execução',blocked:'Paralisado',done:'Concluído'
};
export const fieldRecord=(state,workId,itemId)=>(state.fieldProgress||[]).find(x=>
 x.workOrderId===workId&&x.itemId===itemId)||null;
const quant=n=>Math.round(n*1000)/1000;
export function fieldRows(work,data){
 if(!work?.budgetSnapshot?.items)return [];
 const registered=(data.fieldProgress||[]).filter(x=>x.workOrderId===work.id);
 const byItem=new Map(registered.map(r=>[r.itemId,r]));
 return work.budgetSnapshot.items.map((item,index)=>{
  const progress=byItem.get(item.id)||null;
  const target=Number(item.quantity)||0;
  const executed=Number(progress?.executedQuantity||0);
  return {item,index,progress,target,executed,
   percentage:target>0?Math.max(0,Math.min(100,100*executed/target)):0,
   status:progress?.status||'pending'};
 });
}
export function fieldSummary(work,data){
 const rows=fieldRows(work,data);
 const totalHours=rows.reduce((s,r)=>s+r.target*(Number(r.item.laborHours)||0),0);
 const equivalent=rows.reduce((s,r)=>s+r.executed*(Number(r.item.laborHours)||0),0);
 const weighted=totalHours>0?100*equivalent/totalHours:
  rows.length?rows.reduce((s,r)=>s+r.percentage,0)/rows.length:0;
 return {rows,total:rows.length,done:rows.filter(r=>r.status==='done').length,
  active:rows.filter(r=>r.status==='in_progress').length,
  blocked:rows.filter(r=>r.status==='blocked').length,
  pending:rows.filter(r=>r.status==='pending').length,
  percentage:Math.round(weighted*10)/10,
  equivalentHours:Math.round(equivalent*100)/100,
  totalHours:Math.round(totalHours*100)/100};
}
export function validateFieldUpdate(work,data,input,id){
 if(!work||work.status!=='in_progress')
  throw Error('Inicie a obra para registrar o andamento dos serviços.');
 const item=work.budgetSnapshot?.items?.find(x=>x.id===input.itemId);
 if(!item)throw Error('O serviço não pertence a esta obra.');
 const status=String(input.status||'pending');
 if(!FIELD_STATES[status])throw Error('Situação do serviço inválida.');
 const target=Number(item.quantity);
 let executed=decimal(input.executedQuantity);
 if(executed===null||!Number.isFinite(executed)||executed<0)
  throw Error('Informe a quantidade executada.');
 if(status==='pending')executed=0;
 if(status==='done')executed=target;
 if(!Number.isFinite(target)||target<=0||executed>target+1e-7)
  throw Error('Quantidade maior que a contratada para este serviço.');
 if(Math.abs(quant(executed)-executed)>1e-7)
  throw Error('Informe no máximo três casas decimais.');
 const observedOn=String(input.observedOn||'').trim();
 if(!validDate(observedOn))throw Error('Data da atualização inválida.');
 const notes=String(input.notes||'').trim();
 if(notes.length>1200)throw Error('Observação ultrapassa 1.200 caracteres.');
 const employeeId=String(input.employeeId||'').trim()||null;
 if(employeeId&&!(data.employees||[]).some(x=>x.id===employeeId&&x.active!==false))
  throw Error('Selecione um profissional ativo cadastrado na empresa.');
 const photoPaths=Array.isArray(input.photoPaths)?input.photoPaths:[];
 if(photoPaths.length>3||photoPaths.some(p=>typeof p!=='string'||p.length>350))
  throw Error('Limite de 3 fotos por serviço.');
 return {id,workOrderId:work.id,itemId:item.id,status,
  executedQuantity:quant(executed),employeeId,observedOn,notes,photoPaths};
}
