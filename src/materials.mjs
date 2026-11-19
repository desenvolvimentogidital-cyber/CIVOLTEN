// Regras puras do estoque CIVOLTEN. Valores monetários em reais; quantidades em unidade-base.
const clean=(v)=>String(v??'').trim();
const number=(v)=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null;};
export function validateMaterial(input){
 const name=clean(input.name),unit=clean(input.unit)||'un',category=clean(input.category);
 const minStock=number(input.minStock??0);
 if(!name)throw Error('Informe o nome do material.');
 if(name.length>180)throw Error('O nome do material deve ter até 180 caracteres.');
 if(unit.length>24)throw Error('A unidade deve ter até 24 caracteres.');
 if(minStock===null||minStock<0)throw Error('O estoque mínimo não pode ser negativo.');
 return {id:input.id||null,name,category,unit,minStock,active:input.active!=='false'&&input.active!==false};
}
function validCpf(value){
 if(value.split('').every(ch=>ch===value[0]))return false;
 const digit=(base,factors)=>{const sum=[...base].reduce((n,d,i)=>n+Number(d)*factors[i],0);const r=(sum*10)%11;return r===10?0:r;};
 return digit(value.slice(0,9),[10,9,8,7,6,5,4,3,2])===Number(value[9])&&
  digit(value.slice(0,10),[11,10,9,8,7,6,5,4,3,2])===Number(value[10]);
}
function validCnpj(value){
 if(value.split('').every(ch=>ch===value[0]))return false;
 const digit=(base,factors)=>{const sum=[...base].reduce((n,d,i)=>n+Number(d)*factors[i],0);const r=sum%11;return r<2?0:11-r;};
 return digit(value.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(value[12])&&
  digit(value.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(value[13]);
}
export function validateSupplier(input){
 const name=clean(input.name),rawDocument=clean(input.document);
 if(rawDocument&&!/^[0-9.\\/\\-\\s]+$/.test(rawDocument))throw Error('CPF/CNPJ do fornecedor inválido.');
 const document=rawDocument.replace(/[^0-9]/g,'');
 if(!name)throw Error('Informe o nome do fornecedor.');
 if(name.length>180)throw Error('O nome do fornecedor deve ter até 180 caracteres.');
 if(document&&![11,14].includes(document.length))throw Error('CPF/CNPJ do fornecedor inválido.');
 if(document&&document.length===11&&!validCpf(document))throw Error('CPF do fornecedor inválido.');
 if(document&&document.length===14&&!validCnpj(document))throw Error('CNPJ do fornecedor inválido.');
 return {id:input.id||null,name,document,phone:clean(input.phone),email:clean(input.email),notes:clean(input.notes)};
}
export function validateMovement(input,material){
 const type=clean(input.type),quantity=number(input.quantity),unitCost=number(input.unitCost);
 if(!material?.id)throw Error('Selecione um material cadastrado.');
 if(!['purchase','entry','exit','loss','return','adjustment'].includes(type))throw Error('Tipo de movimentação inválido.');
 if(quantity===null||quantity<=0)throw Error('Informe uma quantidade maior que zero.');
 if(['purchase','entry'].includes(type)&&(unitCost===null||unitCost<0))throw Error('Informe o custo unitário da entrada.');
 if(unitCost!==null&&unitCost<0)throw Error('O custo unitário não pode ser negativo.');
 const current=number(material.stock)||0;
 const delta=['purchase','entry','return'].includes(type)?quantity:
  ['exit','loss'].includes(type)?-quantity:quantity-current;
 if(delta===0)throw Error('O saldo já corresponde à quantidade informada.');
 if(current+delta<0)throw Error('Estoque insuficiente para esta movimentação.');
 return {materialId:material.id,type,quantity:Math.abs(delta),inputQuantity:quantity,delta,
  unitCost:['purchase','entry'].includes(type)?unitCost:(unitCost??number(material.averageCost)),
  supplierId:input.supplierId||null,workOrderId:input.workOrderId||null,
  reference:clean(input.reference),notes:clean(input.notes)};
}
export function stockStatus(material){
 const stock=number(material.stock)||0,min=number(material.minStock)||0;
 return {stock,min,belowMinimum:stock<min,empty:stock<=0,
  inventoryValue:Math.round(stock*(number(material.averageCost)||0)*100)/100};
}
export function applyMovement(material,movement){
 const current=number(material.stock)||0,delta=number(movement.delta);
 if(delta===null||current+delta<0)throw Error('Movimentação deixaria o estoque negativo.');
 const nextStock=current+delta;
 let average=number(material.averageCost)||0;
 if(delta>0&&movement.unitCost!==null&&movement.unitCost!==undefined){
  const incoming=number(movement.unitCost);
  if(incoming===null||incoming<0)throw Error('Custo unitário inválido.');
  average=nextStock===0?0:Math.round(((current*average)+(delta*incoming))*10000/nextStock)/10000;
 }
 return {...material,stock:nextStock,averageCost:average};
}
