// Minuta reutilizável inspirada no contrato de obra certa enviado pelo usuário.
// Dados pessoais, assinaturas, cliente, valores e prazos do exemplo NÃO são reutilizados.
export const clauses=[
 ['1. OBJETO','Execução dos serviços definidos na proposta comercial e no cronograma anexos.'],
 ['2. VALOR','Valor e condições de pagamento acordados entre as partes.'],
 ['3. LOCAL','Execução no local indicado neste instrumento.'],
 ['4. PRAZO','Prazo de execução e hipóteses documentadas de prorrogação por interrupção, impedimento ou força maior.'],
 ['5. OBRIGAÇÕES DO CONTRATANTE','Disponibilizar materiais quando acordado, prestar informações, permitir acesso e realizar pagamentos.'],
 ['6. OBRIGAÇÕES DO CONTRATADO','Executar os serviços com qualidade e segurança, cumprir cronograma, observar regras locais, retirar resíduos e cumprir encargos legais aplicáveis.'],
 ['7. RESCISÃO E PENALIDADES','Rescisão, indenizações e eventual multa conforme pactuação válida e legislação aplicável.'],
 ['8. FORO','Foro competente conforme legislação aplicável e acordo das partes.']
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function contractMissing(data={}){
 return ['customer','contractor','scope','place','price','startDate','durationDays'].filter(k=>!String(data[k]??'').trim());
}
export function contractHtml(data={}){
 const fields=[['CONTRATANTE','customer'],['CONTRATADO','contractor'],['SERVIÇOS / PROPOSTA','scope'],['LOCAL','place'],['VALOR','price'],['DATA DE INÍCIO','startDate'],['PRAZO EM DIAS','durationDays'],['CONDIÇÕES DE PAGAMENTO','payment'],['MATERIAIS','materials'],['FORO','forum']];
 return '<article lang="pt-BR"><h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE OBRA CERTA</h1><p>Minuta editável, sujeita à revisão jurídica antes da assinatura.</p>'+
 fields.map(([label,key])=>'<p><b>'+esc(label)+':</b> '+esc(data[key]||'A preencher')+'</p>').join('')+
 clauses.map(([title,body])=>'<h2>'+esc(title)+'</h2><p>'+esc(body)+'</p>').join('')+
 '<p>Local e data: _____________________</p><p>CONTRATANTE: _____________________</p><p>CONTRATADO: _____________________</p><p>TESTEMUNHA 1: _____________________</p><p>TESTEMUNHA 2: _____________________</p></article>';
}
