import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={};vm.runInNewContext(readFileSync(new URL('../public/personal-record.js',import.meta.url),'utf8'),sandbox);
test('personal record gate accepts only fresh profitable owned records and persists deduplication per account',()=>{
 const now=Date.parse('2026-11-08T01:00:00Z'),values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};let id='7';
 const options={getUser:()=>({id}),storage,now:()=>now},make=sandbox.AVEDPersonalRecords.gate;
 const event={ticketId:1,employeeId:7,game:'sky',cost:100,prize:200,personalBest:1,createdAt:'2026-11-08 00:59:59'};
 const accept=make(options);assert.equal(accept({...event,employeeId:8}),false);assert.equal(accept({...event,personalBest:0}),false);assert.equal(accept({...event,prize:100}),false);assert.equal(accept({...event,penalty:100}),false);
 assert.equal(accept({...event,createdAt:'2026-11-08 00:54:00'}),false);assert.equal(accept({...event,createdAt:'bad'}),false);
 assert.equal(accept(event),true);assert.equal(accept(event),false);assert.equal(make(options)(event),false);
 for(const [i,game] of ['scratch','slot','derby','cards'].entries())assert.equal(accept({...event,game,ticketId:i+2}),true);
 id='8';assert.equal(accept({...event,employeeId:8}),true);id='7';assert.equal(accept(event),false);
 for(let ticketId=10;ticketId<180;ticketId++)accept({...event,ticketId});assert.equal(JSON.parse(values.get('aved_personal_records_v1:7')).length,128);
});
