/**
 * Análise de proveniência SIURB: percorre relações entre composições
 * exclusivamente na mesma versão oficial. Não inventa custo de insumo,
 * não confunde horas de equipamento com hora-homem e não certifica BDI.
 */
const positive = value => /^\\d+(?:\\.\\d+)?$/.test(String(value)) && Number(value)>0;
const tidy = value => String(value??'').trim();
export async function inspectSiurbComposition({root,lookup,maxDepth=6,maxNodes=150}={}){
 if(typeof lookup!=='function')throw new TypeError('Consulta de componentes obrigatória');
 if(!root || !Array.isArray(root.labor) || !Array.isArray(root.other)){
  return {status:'sem_ficha',nodes:[],issues:[{type:'ficha_ausente',code:tidy(root?.code)}],
   fully_priced:false,commercially_verified:false,direct_hh_per_unit:root?.direct_hh_per_unit??null};
 }
 const nodes=[],issues=[],cache=new Map();
 let limited=false;
 const warn=(type,code,path)=>{if(issues.length<150)issues.push({type,code,path})};
 async function resolve(code){
  if(!cache.has(code))cache.set(code,Promise.resolve(lookup(code,root.version_id)));
  return cache.get(code);
 }
 async function visit(row,path,depth){
  const parts=[...row.labor.map(item=>({item,kind:'mao_de_obra'})),
               ...row.other.map(item=>({item,kind:'insumo_ou_auxiliar'}))];
  for(const {item,kind} of parts){
   if(nodes.length>=maxNodes){limited=true;warn('limite_de_componentes',tidy(item?.code),path);return}
   const code=tidy(item?.code),unit=tidy(item?.unit),coef=tidy(item?.coef);
   const location=[...path,code];
   const node={code,description:tidy(item?.name),unit,coefficient:coef,
     kind,path:location.join(' / '),depth:depth+1,status:'nao_precificado'};
   nodes.push(node);
   if(!code||!unit||!positive(coef)){
    node.status='coeficiente_ou_unidade_invalida';warn(node.status,code,node.path);continue;
   }
   if(kind==='mao_de_obra'){
    // Horas diretas são informativas; preço-hora depende da planilha horista.
    node.status='mao_de_obra_sem_preco_horista';
    warn(node.status,code,node.path);
    continue;
   }
   const child=await resolve(code);
   if(!child){
    node.status='insumo_sem_preco_oficial_carregado';
    warn(node.status,code,node.path);continue;
   }
   if(tidy(child.unit).toUpperCase()!==unit.toUpperCase()){
    node.status='unidade_incompativel';
    warn(node.status,code,node.path);continue;
   }
   node.reference_price_id=child.id;
   node.reference_unit_cost=String(child.unit_cost);
   if(location.slice(0,-1).includes(code)){
    node.status='ciclo_de_composicao';warn(node.status,code,node.path);continue;
   }
   if(!Array.isArray(child.labor)||!Array.isArray(child.other)){
    node.status='auxiliar_sem_ficha_detalhada';
    warn(node.status,code,node.path);continue;
   }
   if(depth+1>=maxDepth){
    node.status='limite_de_profundidade';warn(node.status,code,node.path);continue;
   }
   node.status='auxiliar_expandido_para_auditoria';
   await visit(child,location,depth+1);
   if(limited)return;
  }
 }
 await visit(root,[tidy(root.code)],0);
 const unpriced=nodes.filter(n=>n.status!=='auxiliar_expandido_para_auditoria').length;
 return {
  status:issues.length||limited?'parcial':'componentes_identificados',
  nodes,issues,unpriced_components:unpriced,limited,
  direct_hh_per_unit:root.direct_hh_per_unit??null,
  // A tabela de custos unitários de SERVIÇOS não substitui a de insumos.
  fully_priced:false,commercially_verified:false,
  notice:'Apenas relações e coeficientes identificados. Insumos, mão de obra horista, equipamentos, encargos e auxiliares exigem planilhas de custos oficiais e conciliação técnica.'
 };
}
