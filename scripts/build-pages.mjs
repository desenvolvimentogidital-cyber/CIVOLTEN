import fs from 'node:fs';
import process from 'node:process';
// As URLs possuem HTML próprios, mas compartilham a mesma fonte do formulário
// e painel para evitar que uma alteração fique somente na versão antiga.
const src=new URL('../index.html',import.meta.url);
const base=fs.readFileSync(src,'utf8');
if(!base.includes('<body>')||!base.includes('<section id="admin" class="hidden">'))throw Error('A estrutura do template mudou');
for(const [file,screen,title] of [
 ['empresa.html','empresa','Área da empresa | CIVOLTEN'],
 ['orcamento.html','orcamento','Solicitar orçamento | CIVOLTEN']
]){
 let html=base
  .replace('<body>','<body data-screen="'+screen+'">')
  .replace(/<title>[^<]*<\/title>/,'<title>'+title+'</title>');
 if(screen==='empresa')html=html.replace('<section id="admin" class="hidden">','<section id="admin">');
 const destination=new URL('../'+file,import.meta.url);
 if(process.argv.includes('--check')){
  if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==html)throw Error(file+' está fora de sincronia: execute npm run build:pages');
  console.log(file+' sincronizado');
 }else{
  fs.writeFileSync(destination,html);
  console.log('Gerado '+file);
 }
}
