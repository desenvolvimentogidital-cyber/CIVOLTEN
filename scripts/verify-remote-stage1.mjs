/* CIVOLTEN — smoke test seguro do backend publicado, sem gravar nenhum dado.
 * Usar somente após Vercel publicar o commit e carregar DATABASE_URL.
 */
const target=process.env.CIVOLTEN_BASE_URL||'https://civolten-gj91.vercel.app';
const url=new URL(target);
if(url.protocol!=='https:'||url.hostname!=='civolten-gj91.vercel.app'||url.pathname!=='/'||url.search){
 console.error('Destino inválido. Use exclusivamente https://civolten-gj91.vercel.app');
 process.exit(2);
}
const checks=[
 {route:'/api/v1/health',method:'GET',code:200,expected:data=>data.ok===true&&data.database==='connected'},
 {route:'/api/v1/auth/status',method:'GET',code:200,expected:data=>data.authenticated===false},
 {route:'/api/v1/clients',method:'GET',code:401,expected:data=>data.error==='Sessão necessária'},
 {route:'/api/v1/clients',method:'POST',code:403,expected:data=>/CSRF/.test(data.error||'')},
 {route:'/api/v1/auth/login',method:'POST',code:403,headers:{origin:'https://unauthorized.example', 'x-civolten-request':'1'},expected:data=>/Origem/.test(data.error||'')}
];
let failures=0;
for(const check of checks){
 try{
  const response=await fetch(new URL(check.route,url),{method:check.method,headers:check.headers||{},signal:AbortSignal.timeout(20000),redirect:'manual'});
  const type=response.headers.get('content-type')||'';
  let data=null;
  if(type.includes('application/json'))data=await response.json();
  const passed=response.status===check.code&&data&&check.expected(data);
  console.log((passed?'PASS':'FAIL')+' '+check.method+' '+check.route+' -> HTTP '+response.status+
    (type.includes('application/json')?' (JSON)':' (não JSON)'));
  if(!passed)failures++;
 }catch(e){console.error('FAIL '+check.route+' -> '+(e?.message||'erro'));failures++}
}
if(failures){
 console.error(failures+' teste(s) não passaram. Não habilitar clientes reais.');
 process.exit(1);
}
console.log('PASS: API Vercel e Neon conectados com proteções básicas.');
