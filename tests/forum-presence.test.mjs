import test from 'node:test';
import assert from 'node:assert/strict';
import {createForumPresence,presenceKey,presenceLifetime} from '../server-forum-presence.mjs';
import {mapForumAuthor} from '../server-forum-social.mjs';

test('presence expires without database work and can only update the authenticated employee',()=>{
 let now=10000;const p=createForumPresence({clock:()=>now}),key=presenceKey(1),other=presenceKey(2);
 const data={tab:'terminal-one',active:true,activity:'cards',authors:[key,other]};
 let r=p.sync(1,{...data,employeeId:2});
 assert.equal(r.items[0].activity,'cards');assert.equal(r.items[1].online,false);
 assert.equal(r.items[0].expiresIn,presenceLifetime);
 now+=presenceLifetime;r=p.sync(2,{...data,activity:'forum'});
 assert.equal(r.items[0].online,false);assert.equal(r.items[1].activity,'forum');
 assert.equal(presenceKey(null),'');assert.notEqual(key,other);
 assert.throws(()=>p.sync(1,{...data,authors:Array(65).fill(key)}),/无效/);
 assert.throws(()=>p.sync(1,{...data,activity:'<img>'}),/无效/);
 assert.throws(()=>p.sync(1,{...data,tab:'bad tab'}),/无效/);
});

test('multiple tabs preserve the remaining active terminal and hide the background tab activity',()=>{
 const p=createForumPresence(),key=presenceKey(1),data={tab:'terminal-one',active:true,activity:'cards',authors:[key]};
 p.sync(1,data);p.sync(1,{...data,tab:'terminal-two',activity:'forum'});
 assert.equal(p.sync(2,{...data,authors:[key]}).items[0].activity,'forum');
 assert.equal(p.sync(1,{...data,tab:'terminal-two',active:false}).items[0].activity,'cards');
 assert.equal(p.sync(1,{...data,active:false}).items[0].online,false);
});

test('author mapping exposes an opaque status key without leaking an employee or persona operator ID',()=>{
 const mapped=mapForumAuthor({anonymousName:'内网代号',presenceEmployeeId:7,avatarData:'',avatarId:null,avatarPreset:''});
 assert.equal(mapped.presenceKey,presenceKey(7));assert.equal(mapped.avatarUrl,'');
 assert.notEqual(mapForumAuthor({presenceEmployeeId:7,identityMode:'real'}).presenceKey,mapped.presenceKey);
 assert.equal('presenceEmployeeId' in mapped,false);assert.equal('employeeId' in mapped,false);
 assert.equal(mapForumAuthor({presenceEmployeeId:null}).presenceKey,'');
});
