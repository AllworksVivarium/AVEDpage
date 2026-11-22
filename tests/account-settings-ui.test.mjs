import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('profile credential fields require verification only for edits and clear secrets on close',()=>{
 const field=value=>({value,required:false,disabled:false,validityMessage:'',setCustomValidity(message){this.validityMessage=message;}});
 const elements={username:field('original'),password:field(''),currentPassword:field(''),passwordConfirmation:field('')},labels={'[data-current-password]':{},'[data-password-confirm]':{}},events={},dialogEvents={};
 const form={elements,querySelector:key=>labels[key],addEventListener:(name,fn)=>events[name]=fn,closest:()=>({addEventListener:(name,fn)=>dialogEvents[name]=fn})};
 let user={account:'original'};const context={window:{}};
 runInNewContext(readFileSync(new URL('../public/account-settings.js',import.meta.url),'utf8'),context);
 context.window.AVEDAccountSettings.mount({form,getUser:()=>user});
 assert.equal(elements.currentPassword.required,false);assert.equal(elements.currentPassword.disabled,true);assert.equal(labels['[data-password-confirm]'].hidden,true);
 elements.username.value='changed';events.input();
 assert.equal(elements.currentPassword.required,true);assert.equal(labels['[data-current-password]'].hidden,false);assert.equal(elements.passwordConfirmation.required,false);
 elements.username.value='original';events.input();assert.equal(elements.currentPassword.required,false);
 elements.password.value='new-secret';events.input();assert.equal(elements.currentPassword.required,true);assert.equal(elements.passwordConfirmation.required,true);
 elements.passwordConfirmation.value='different';events.input();assert.equal(elements.passwordConfirmation.validityMessage,'两次输入的新密码不一致。');
 elements.passwordConfirmation.value='new-secret';events.input();assert.equal(elements.passwordConfirmation.validityMessage,'');
 elements.password.value='';events.input();assert.equal(elements.passwordConfirmation.value,'');assert.equal(elements.currentPassword.required,false);assert.equal(elements.passwordConfirmation.disabled,true);
 elements.currentPassword.value='private';elements.password.value='private-new';elements.passwordConfirmation.value='private-new';elements.username.value='draft';user={account:'saved'};
 dialogEvents.close();assert.equal(elements.username.value,'saved');for(const name of ['currentPassword','password','passwordConfirmation'])assert.equal(elements[name].value,'');
 assert.equal(elements.currentPassword.required,false);assert.equal(elements.passwordConfirmation.validityMessage,'');
});
