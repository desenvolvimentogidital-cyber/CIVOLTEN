import test from 'node:test';
import assert from 'node:assert/strict';
import {siteLeadsView} from '../src/site-leads-ui.mjs';
test('solicitações do site: lista e informações operacionais sem valores financeiros',()=>{
 const html=siteLeadsView([{
  id:'5bd9ce18-fdaa-4de7-91fa-4d98ab767767',name:'Cliente CIVOLTEN',phone:'11999999999',
  city:'Barueri, SP',service:'Reformas',description:'Reforma de cozinha',
  status:'novo',created_at:'2026-11-10T10:00:00Z'
 }]);
 assert.match(html,/Solicitações do site/);
 assert.match(html,/Cliente CIVOLTEN/);
 assert.match(html,/Reforma de cozinha/);
 assert.match(html,/site-lead-status/);
 assert.match(html,/site-lead-photos/);
 assert.match(html,/Ver fotos e anexos/);
 assert.match(html,/wa.me\/5511999999999/);
 assert.doesNotMatch(html,/Valor contratado|Margem de lucro|R\$/);
});
test('solicitação HTML é escapada contra injeção',()=>{
 const html=siteLeadsView([{
  id:'invalid',name:'<img src=x onerror=alert(1)>',phone:'11999999999',
  city:'São Paulo',service:'Reformas',description:'<script>alert(1)</script>',status:'novo',
  created_at:'2026-11-10T10:00:00Z'
 }]);
 assert.doesNotMatch(html,/<script>|<img src=x/);
 assert.match(html,/&lt;script&gt;/);
});
test('caixa de entrada vazia e estado de carregamento',()=>{
 assert.match(siteLeadsView([]),/Nenhuma solicitação/);
 assert.match(siteLeadsView([],true),/Consultando solicitações/);
});
