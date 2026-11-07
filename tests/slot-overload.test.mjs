import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spinSlot} from '../server-slot.mjs';
import {settleGameTicket} from '../server-ticket.mjs';

test('overload preserves combination prizes and debits its fee atomically',()=>{
 const draws=[...Array(15).fill(.99),0],spin=spinSlot(1000,()=>draws.shift());
 assert.equal(spin.prize,10000);assert.equal(spin.result.penalty,2000);assert.equal(spin.result.penaltyKind,'overload');
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE ledger(delta INTEGER,reason TEXT);INSERT INTO ledger VALUES(1000,\'opening\');CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);');
  const balanceFor=()=>db.prepare('SELECT SUM(delta) b FROM ledger').get().b;
  const deps={db,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO ledger VALUES(?,?)').run(delta,reason),award:()=>{},getHighlights:()=>({event:()=>null}),transaction:fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
  db.exec("CREATE TRIGGER reject_ticket BEFORE INSERT ON game_tickets BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.throws(()=>settleGameTicket(deps,1,'slot',1000,spin.prize,spin.result,{seed:'test',seedHash:'test'}));assert.equal(balanceFor(),1000);
  db.exec('DROP TRIGGER reject_ticket');
  const r=settleGameTicket(deps,1,'slot',1000,spin.prize,spin.result,{seed:'test',seedHash:'test'});assert.equal(r.balance,8000);assert.equal(r.penalty,2000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,1);
 }finally{db.close();}
});
