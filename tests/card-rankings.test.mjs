import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installCardRankings} from '../server-card-rankings.mjs';
test('online rankings exclude solo and bots, deduplicate settlement and expire after five days',()=>{
 const db=new DatabaseSync(':memory:');let now=1000000000;const board=installCardRankings(db,()=>now);
 const room={mode:'online',seats:[{id:1,name:'甲'},{id:2,name:'乙'},{id:-1,name:'电脑',bot:true}],money:{round:'a',settlement:{}},game:{phase:'ended',landlord:0,winner:'farmers'}};
 board.record({...room,mode:'solo'});board.record({...room,seats:[room.seats[0],{id:-2,bot:true},room.seats[2]]});assert.equal(board.list().farmers.length,0);
 board.record(room);board.record(room);assert.equal(board.list().farmers[0].wins,1);assert.equal(board.list().farmers[0].employeeId,2);
 room.money.round='b';room.seats[2]={id:3,name:'丙'};board.record(room);assert.deepEqual(board.list().farmers.map(r=>[r.employeeId,r.wins]),[[2,2],[3,1]]);
 room.money.round='c';room.game.winner='landlord';board.record(room);assert.equal(board.list().landlord[0].employeeId,1);
 now+=5*86400000+1;assert.equal(board.list().landlord.length,0);assert.equal(board.list().farmers.length,0);db.close();
});
