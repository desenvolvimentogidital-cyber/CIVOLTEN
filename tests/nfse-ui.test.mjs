import test from 'node:test';
import assert from 'node:assert/strict';
import {nfseHasCnpj,nfseNewDraft,nfseIssues,nfseView,nfseStorageKey} from '../src/nfse-ui.mjs';

const complete=()=>{
 const d=nfseNewDraft({companyName:'CIVOLTEN',taxRegime:'mei'});
 return {...d,issuerCnpj:'67.138.121/0001-75',clientCnpj:'71.731.707/0001-16',
  clientName:'Ativa Construções Ltda',description:'Instalação de dois pontos de câmeras CFTV',
  amount:'4000',cep:'11060-300',street:'Av. Marechal Floriano Peixoto',
  number:'74',city:'Santos',uf:'SP',district:'Gonzaga',serviceCity:'Santos/SP',
  serviceCode:'07.02.02',nbs:'1.0106.11.00',issRetention:'nao',ibsCbs:'nao'};
};
test('valida CNPJs de emitente e tomador sem confiar no formato',()=>{
 assert.equal(nfseHasCnpj('67.138.121/0001-75'),true);
 assert.equal(nfseHasCnpj('71.731.707/0001-16'),true);
 assert.equal(nfseHasCnpj('11.111.111/1111-11'),false);
 assert.equal(nfseHasCnpj('71.731.707/0001-17'),false);
});
test('não aceita emissão sem NBS, código fiscal ou conferência de retenção',()=>{
 const d=complete();
 assert.deepEqual(nfseIssues(d,3),[]);
 assert.ok(nfseIssues({...d,nbs:''},3).some(x=>x.includes('NBS')));
 assert.ok(nfseIssues({...d,issRetention:'conferir'},3).some(x=>x.includes('retenção')));
 assert.ok(nfseIssues({...d,serviceCode:'00'},3).some(x=>x.includes('tributação')));
});
test('CNO/CIB não exige CEP quando o identificador oficial foi informado',()=>{
 const d={...complete(),workType:'cno',workCode:'12345',cep:'',city:'',street:'',number:''};
 assert.deepEqual(nfseIssues(d,3),[]);
 assert.ok(nfseIssues({...d,workCode:''},3).length>0);
});
test('tela nunca apresenta botão habilitado de emissão oficial',()=>{
 const html=nfseView(complete(),3);
 assert.match(html,/Emitir NFS-e — integração pendente/);
 assert.match(html,/disabled title=/);
 assert.match(html,/nenhuma nota será transmitida/i);
});
test('protege a renderização dos dados vindos de rascunhos',()=>{
 const html=nfseView({...complete(),clientName:'<script>alert(1)</script>'},3);
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
});
test('chave de rascunho é isolada por usuário',()=>{
 assert.notEqual(nfseStorageKey('a-b'),nfseStorageKey('c-d'));
});
