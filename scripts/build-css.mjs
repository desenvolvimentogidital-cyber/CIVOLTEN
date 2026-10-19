import fs from 'node:fs';
import process from 'node:process';

const config = [
  ['assets/civolten-app-unificado.css',
   ['assets/civolten.css','assets/civolten-premium.css','assets/civolten-art-direction.css','assets/civolten-telas.css','assets/civolten-padrao.css'],
   'assets/temas/app.css'],
  ['assets/civolten-servicos-unificado.css',
   ['assets/servicos.css','assets/civolten-padrao.css'],
   'assets/temas/servicos.css'],
  ['assets/civolten-proposta-unificado.css',
   ['assets/civolten.css','assets/proposta.css','assets/civolten-padrao.css'],
   'assets/temas/proposta.css'],
  ['assets/civolten-privacidade-unificado.css',
   ['assets/civolten.css','assets/civolten-padrao.css'],
   'assets/temas/privacidade.css']
];
const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const common = read('assets/temas/comum.css');
const isCheck = process.argv.includes('--check');
for(const [output,inputs,theme] of config){
  const header = `/* CIVOLTEN CSS CANÔNICO — ${output}. Gerado em 2026-10-19.
   Um único stylesheet por documento para impedir mistura de versões antigas.
   Fontes de código de layout abaixo agrupadas para compatibilidade com funções existentes.
   Tema final em seção própria e compartilhada após os estilos estruturais.
*/\n`;
  const structural = inputs.map(source=>`\n/* === Estrutura herdada: ${source} === */\n`+read(source)).join('\n');
  const expected = header+structural+'\n/* === Identidade e acessibilidade === */\n'+common+'\n/* === Padrão final da tela === */\n'+read(theme);
  if(isCheck){
    const actual=read(output);
    if(actual!==expected) throw Error(output+' está desatualizado. Rode npm run build:css.');
    console.log('Bundle atualizado: '+output);
  }else{
    fs.writeFileSync(new URL('../'+output,import.meta.url),expected,'utf8');
    console.log('Gerado: '+output);
  }
}
