'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const content=fs.readFileSync(path.join(__dirname,'../auth-screen.js'),'utf8');
const window={};
vm.runInNewContext(content,{window,console});
const {stateFor}=window.CIVOLTENAuthScreen;
test('não autenticado nunca abre o aplicativo',()=>{
 assert.equal(stateFor(null,null),'login');
 assert.equal(stateFor(undefined,'user-1'),'login');
});
test('primeiro acesso exige vinculação sem apagar dados',()=>{
 assert.equal(stateFor({id:'user-1'},null),'bind');
 assert.equal(stateFor({id:'user-1'},''),'bind');
});
test('mesma conta pode sair e entrar novamente e conservar o vínculo',()=>{
 assert.equal(stateFor({id:'user-1'},'user-1'),'ready');
 assert.equal(stateFor(null,'user-1'),'login');
 assert.equal(stateFor({id:'user-1'},'user-1'),'ready');
});
test('segunda conta no mesmo aparelho não pode ler dados da primeira',()=>{
 assert.equal(stateFor({id:'user-2'},'user-1'),'foreign');
});
test('não contém senha nem comando para apagar dados locais',()=>{
 assert.ok(content.includes('auth.signUp.email'));
 assert.ok(content.includes('auth.signIn.email'));
 assert.ok(content.includes('auth?.signOut?.'));
 assert.ok(!content.includes('localStorage.clear('));
 assert.ok(!content.includes('localStorage.removeItem(STORAGE)'));
});
