/** Conciliação matemática SIURB: componentes oficiais vs custo unitário.
 * Relatório técnico NÃO significa aprovação comercial/tributária nem produtividade.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')&&x.includes('=')).map(x=>x.slice(2).split(/=(.*)/s).slice(0,2)));
const normalized=JSON.parse(await readFile(args.normalized||'artifacts/siurb-supplements-normalized.json','utf8'));
const services=JSON.parse(await readFile(new URL('../public/data/siurb-2026-07.json',import.meta.url),'utf8'));
const compositions=JSON.parse(await readFile(new URL('../public/data/siurb-compositions-2026-07.json',import.meta.url),'utf8'));
if(normalized.prices.length!==5828 || normalized.auxiliaries.length!==232 ||
   services.items.length!==6988 || compositions.items.length!==6926)
 throw new Error('Versão SIURB insuficiente ou divergente');
const key=(regime,code)=>regime+'|'+code;
const scopeKey=x=>(x.category||x.group)+'|'+x.regime+'|'+x.code;
const regimes={'Sem desoneração':'sem','Com desoneração':'com'};
const prices=new Map();
for(const p of normalized.prices){
 const k=key(p.regime,p.code);
 if(!prices.has(k))prices.set(k,[]);
 prices.get(k).push(p);
}
const aux=new Map(normalized.auxiliaries.map(a=>[key(a.regime,a.code),a]));
const sourcePrices=new Map(services.items.map(x=>[scopeKey(x),x]));
const quote=value=>{
 const t=String(value??'').replace(',','.').trim();
 if(!/^\d+(?:\.\d+)?$/.test(t))return null;
 const bits=t.split('.'); if((bits[1]||'').length>8)return null;
 return BigInt(bits[0])*100000000n+BigInt((bits[1]||'').padEnd(8,'0')||'0');
};
const unit=value=>{
 const t=String(value??'').replace(',','.').trim();
 if(!/^\d+(?:\.\d+)?$/.test(t))return null;
 const bits=t.split('.');if((bits[1]||'').length>4)return null;
 return BigInt(bits[0])*10000n+BigInt((bits[1]||'').padEnd(4,'0')||'0');
};
const cents=v=>(v+5000000000n)/10000000000n; // product quote(1e8) * unit(1e4)
const officialCents=v=>{const n=unit(v);return n==null?null:(n+50n)/100n};
const statuses=new Map(),examples=[],deltas=[];
let exact=0,near=0,missing=0,mismatch=0;
for(const x of compositions.items){
 const c=sourcePrices.get(scopeKey(x));
 if(!c)throw new Error('Composição direta não corresponde a preço: '+scopeKey(x));
 const regime=regimes[x.regime];
 let sum=0n,issue=null,selected=[];
 const entries=[...(x.labor||[]).map(z=>({z,kind:'horista'})),
                ...(x.other||[]).map(z=>({z,kind:'outro'}))];
 if(!entries.length)issue='sem_componentes';
 for(const {z,kind} of entries){
  const code=String(z.code||''),available=prices.get(key(regime,code))||[],
   auxiliary=aux.get(key(regime,code));
  const nameUnit=String(z.unit||'').trim().toUpperCase();
  const option=kind==='horista'?available.find(p=>p.kind==='horista'&&p.variant==='com_encargos'):
    (auxiliary?.arithmetically_reconciled ? {kind:'auxiliar',unit:auxiliary.unit,unit_cost:auxiliary.official_unit_cost,variant:'reconciliado'} :
      available.find(p=>p.kind==='insumos'&&p.variant==='padrao')||
      available.find(p=>p.kind==='equipamentos'&&p.variant==='operacao')||
      available.find(p=>p.kind==='horista'&&p.variant==='com_encargos'));
  if(!option){issue=issue||'insumo_ou_auxiliar_sem_preco';continue;}
  if(String(option.unit).trim().toUpperCase()!==nameUnit){issue=issue||'unidade_divergente';continue;}
  const coef=quote(z.coef),value=unit(option.unit_cost);
  if(coef===null||value===null||coef<=0n||value<=0n){issue=issue||'coeficiente_ou_preco_invalido';continue;}
  sum+=coef*value;
  selected.push({code,kind:option.kind,variant:option.variant});
 }
 const found=officialCents(c.cost);
 if(found==null){issue=issue||'preco_servico_invalido'}
 if(issue){
  missing++;statuses.set(issue,(statuses.get(issue)||0)+1);
  if(examples.length<20)examples.push({code:x.code,regime:x.regime,category:x.category,issue});
  continue;
 }
 const cost=cents(sum),delta=cost-found,abs=delta<0n?-delta:delta;
 if(abs===0n)exact++;
 else if(abs<=2n)near++;
 else {mismatch++;if(deltas.length<20)deltas.push({code:x.code,regime:x.regime,category:x.category,
                 official_cents:String(found),computed_cents:String(cost),difference_cents:String(delta),selected})}
}
const report={
 reference_month:'2026-07',source_compositions:compositions.items.length,
 exact,within_two_cents:near,unavailable_or_invalid:missing,over_two_cents:mismatch,
 issues:Object.fromEntries(statuses),samples_unavailable:examples,samples_mismatch:deltas,
 commercially_approved:false,
 warning:'Conferência aritmética usa modo em operação dos equipamentos quando há taxa horária; seleção exata do regime operacional, encargos, incidências e revisão humana ainda são obrigatórias.'
};
if(exact+near+missing+mismatch!==6926)throw new Error('Contagem de composições não fecha');
const path=args.output||'artifacts/siurb-services-reconciliation.json';
await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log('SIURB custos comparados:',JSON.stringify({exact,near,missing,mismatch,issues:report.issues}));
if(exact===0)throw new Error('Nenhuma conciliação aritmética; verificar fontes');
