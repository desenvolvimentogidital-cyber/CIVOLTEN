/** CPF e CNPJ brasileiro, incluindo CNPJ alfanumérico implantado em julho/2026.
 * Receita Federal: 12 caracteres [0-9A-Z] + 2 dígitos numéricos módulo 11.
 */
export const normalizeTaxId=v=>String(v??'').toUpperCase().replace(/[\s.\/-]/g,'');
export function validCPF(value){
 const s=normalizeTaxId(value);
 if(!/^\d{11}$/.test(s)||/^(\d)\1{10}$/.test(s))return false;
 const digit=length=>{
  let sum=0;for(let i=0;i<length;i++)sum+=Number(s[i])*(length+1-i);
  const result=(sum*10)%11;return result===10?0:result;
 };
 return digit(9)===Number(s[9])&&digit(10)===Number(s[10]);
}
export function validCNPJ(value){
 const s=normalizeTaxId(value);
 if(!/^[0-9A-Z]{12}[0-9]{2}$/.test(s)||/^(\d)\1{13}$/.test(s))return false;
 const getValue=char=>char.charCodeAt(0)-48;
 const verify=(size,weights)=>{
  let sum=0;for(let i=0;i<size;i++)sum+=getValue(s[i])*weights[i];
  const remainder=sum%11;return remainder<2?0:11-remainder;
 };
 return verify(12,[5,4,3,2,9,8,7,6,5,4,3,2])===Number(s[12])
     &&verify(13,[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(s[13]);
}
export const validTaxId=v=>validCPF(v)||validCNPJ(v);
