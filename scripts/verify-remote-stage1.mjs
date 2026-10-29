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
 {route:'/api/v1/auth/login',method:'POST',code:403,headers:{origin:'https://unauthorized.example', 'x-civolten-request':'1'},expected:data=>/Origem/.test(data.error||'')},
 {route:'/api/v1/users',method:'GET',code:401,expected:data=>data.error==='Sessão necessária'},
 {route:'/api/v1/siurb/search?q=1001001',method:'GET',code:401,expected:data=>data.error==='Sessão necessária'},
 {route:'/api/v1/budgets/00000000-0000-4000-8000-000000000001/costs',method:'GET',code:401,expected:data=>data.error==='Sessão necessária'},
 {route:'/api/v1/auth/bootstrap',method:'POST',code:403,headers:{'x-civolten-request':'1'},expected:data=>/desativada/.test(data.error||'')}
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
const files=[
 {path:'/secure.html',type:'text/html',marker:'src="/secure.js"'},
 {path:'/secure.js',type:'javascript',marker:'must_change_password'},
 {path:'/secure-costing.js',type:'javascript',marker:'costPage'},
 {path:'/secure.css',type:'text/css',marker:'prefers-reduced-motion'}
];
for(const file of files){
 try{
  const res=await fetch(new URL(file.path,url),{method:'GET',signal:AbortSignal.timeout(20000),redirect:'manual'});
  const type=res.headers.get('content-type')||'';
  const body=res.status===200?await res.text():'';
  const ok=res.status===200&&type.includes(file.type)&&body.includes(file.marker);
  console.log((ok?'PASS':'FAIL')+' GET '+file.path+' -> HTTP '+res.status+' ('+type+')');
  if(!ok)failures++;
 }catch(err){console.error('FAIL '+file.path+' -> '+err.message);failures++}
}
if(failures){
 console.error(failures+' teste(s) não passaram. Não habilitar clientes reais.');
 process.exit(1);
}
console.log('PASS: API Vercel e Neon conectados com proteções básicas.');
