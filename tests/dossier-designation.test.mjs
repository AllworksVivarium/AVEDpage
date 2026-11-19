import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {normalizeDossierCode} from '../server-dossier-content.mjs';

test('designation keeps leading zeroes, validates both segments and preserves legacy identifiers',()=>{
 const data={classification:'SAFE',codeLetters:' abC ',codeNumber:'001'};
 assert.equal(normalizeDossierCode(data),'SAFE-ABC-001');
 for(const change of [{classification:''},{classification:'OTHER'},{codeLetters:'A-BC'},{codeLetters:'中文'},{codeNumber:'1e3'},{codeNumber:'-1'},{codeNumber:1},{codeNumber:'1.5'},{codeLetters:'A'.repeat(30)}])assert.throws(()=>normalizeDossierCode({...data,...change}));
 assert.equal(normalizeDossierCode({codeLetters:'',codeNumber:''},{code:'PC-12-old'}),'PC-12-old');
 assert.equal(normalizeDossierCode({code:'LEGACY-007'}),'LEGACY-007');
 assert.throws(()=>normalizeDossierCode({classification:'SAFE',codeLetters:'',codeNumber:''},{code:'SAFE-ABC-001'}));
});

test('admin designation binds classification changes, preview, validation and legacy edits',()=>{
 const context={window:{}};vm.runInNewContext(readFileSync(new URL('../public/admin-dossier-content.js',import.meta.url),'utf8'),context);
 const helper=context.window.AVEDAdminDossierContent;
 assert.match(helper.designation({code:'SAFE-AB-001'}),/value="001"/);
 assert.match(helper.designation({code:'SAFE-AB-001'}),/value="SAFE" selected/);
 assert.ok(!helper.designation({code:'<script>'}).includes('value="<script>'));
 function form(legacy=''){
  const handlers={},elements=Object.fromEntries(['classification','codeLetters','codeNumber','code'].map(k=>[k,{value:'',setCustomValidity(message){this.error=message;}}]));
  helper.bindDesignation({elements,querySelector:()=>({dataset:{legacyCode:legacy},addEventListener:(name,fn)=>handlers[name]=fn})});
  return {elements,update:handlers.input};
 }
 const {elements:e,update}=form();assert.equal(e.codeNumber.required,true);
 e.classification.value='SAFE';e.codeLetters.value='ab';e.codeNumber.value='001';update();assert.equal(e.code.value,'SAFE-AB-001');
 e.classification.value='KETER';update();assert.equal(e.code.value,'KETER-AB-001');
 e.codeNumber.value='1'.repeat(30);update();assert.ok(e.codeLetters.error);
 const old=form('PC-12-old');assert.equal(old.elements.code.value,'PC-12-old');assert.equal(old.elements.codeLetters.required,false);
 old.elements.codeLetters.value='AB';old.update();assert.equal(old.elements.codeNumber.required,true);
});
