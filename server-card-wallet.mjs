import {randomUUID} from 'node:crypto';
import {MAX_GAME_STAKE} from './game-stake-limits.mjs';
import './public/card-stakes.js';
export const cardStakes=globalThis.AVEDCardStakes;
export const cardMoneyRules=Object.freeze({base:cardStakes.defaultBase,reserve:10000,bonusPercent:25,baseOptions:cardStakes.presets,autoProfitPolicy:'normal-v2'});
// A fair-win-rate reference, not a guarantee: 50% * 190% + 50% * 50% = 120%.
export const computerCardReturns=Object.freeze({winPercent:190,lossPercent:50});
export function cardSettlement(size,landlord,winner,bid,multiplier,rules=cardMoneyRules){
 const unit=Math.min(rules.base*bid*multiplier,Math.floor(rules.reserve/(size-1)));
 const pot=2*(size-1)*unit,bonus=Math.floor(pot*rules.bonusPercent/100);
 const winners=Array.from({length:size},(_,i)=>i).filter(i=>(i===landlord)===(winner==='landlord'));
 return {unit,pot,bonus,players:Array.from({length:size},(_,seat)=>{
  const stake=unit*(seat===landlord?size-1:1),index=winners.indexOf(seat);
  const reward=rules.computerReturns
   ?Math.floor(stake*(index<0?rules.computerReturns.lossPercent:rules.computerReturns.winPercent)/100)
   :index<0?0:2*stake+Math.floor(bonus/winners.length)+(index<bonus%winners.length?1:0);
  return {seat,stake,reward,net:reward-stake,release:rules.reserve-stake+reward};
 })};
}
export function installCardWallet({db,balanceFor,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS card_money_rounds(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,rules_json TEXT NOT NULL,settlement_json TEXT,system_delta INTEGER);
 CREATE TABLE IF NOT EXISTS card_money_seats(round_id TEXT NOT NULL REFERENCES card_money_rounds(id),seat INTEGER NOT NULL,employee_id INTEGER,reserve INTEGER NOT NULL,PRIMARY KEY(round_id,seat));
 DROP TABLE IF EXISTS card_auto_limits;
 CREATE INDEX IF NOT EXISTS card_money_pending ON card_money_rounds(id) WHERE settlement_json IS NULL;`);
 function checkEntry(id){
  if(db.prepare('SELECT 1 FROM card_money_rounds r INDEXED BY card_money_pending JOIN card_money_seats s ON s.round_id=r.id WHERE r.settlement_json IS NULL AND s.employee_id=? LIMIT 1').get(id))throw Error('上一局托管尚未结束，请结算后再入座。');
 }
 function recordTurn(room,seat,action,automatic){
  const p=room.seats[seat];if(!room.money||p.bot||!['play','pass'].includes(action))return;
  room.money.participation??={};const stats=room.money.participation[seat]??={turns:0,plays:0,manualTurns:0,manualPlays:0};
  stats.turns++;if(action==='play')stats.plays++;if(!automatic){stats.manualTurns++;if(action==='play')stats.manualPlays++;}
 }
 // Called inside the room transaction: debit, deal and persistence commit together.
 function start(room){
  // Classify the seats at deal time, including online rooms filled with bots.
  const computerOnly=room.seats.filter(p=>p&&!p.bot).length===1;
  const base=cardStakes.validate(room.base??100,computerOnly),rules={...cardMoneyRules,computerOnly,...(computerOnly?{bonusPercent:0,computerReturns:computerCardReturns}:{}),base,reserve:cardStakes.reserve(base)};
  if(rules.reserve>MAX_GAME_STAKE)throw Error('每人本局锁定筹码最多为 100,000。');
  for(const p of room.seats)if(!p.bot){checkEntry(p.id);if(balanceFor(p.id)<rules.reserve)throw Error('开局需有 '+rules.reserve.toLocaleString('en-US')+' 可用余额，用于锁定本局筹码。');}
  const id=randomUUID();db.prepare('INSERT INTO card_money_rounds(id,room_id,rules_json) VALUES(?,?,?)').run(id,room.id,JSON.stringify(rules));
  room.money={round:id,rules,participation:{},settlement:null};
  room.seats.forEach((p,i)=>{db.prepare('INSERT INTO card_money_seats VALUES(?,?,?,?)').run(id,i,p.bot?null:p.id,rules.reserve);if(!p.bot)recordLedger(p.id,-rules.reserve,'斗太姥锁定筹码 #'+id);});
 }
 function settle(room){
  if(!room.money||room.game?.phase!=='ended')return;
  const saved=db.prepare('SELECT * FROM card_money_rounds WHERE id=?').get(room.money.round);
  if(saved.settlement_json){room.money.settlement=JSON.parse(saved.settlement_json);return;}
  const rules=JSON.parse(saved.rules_json),g=room.game,result=cardSettlement(room.size,g.landlord,g.winner,g.bid,g.multiplier,rules);
  const seats=db.prepare('SELECT * FROM card_money_seats WHERE round_id=? ORDER BY seat').all(saved.id);let humanNet=0;
  for(const p of result.players)p.bonus=p.reward?Math.max(0,p.reward-2*p.stake):0;
  for(const seat of seats)if(seat.employee_id!=null)result.players[seat.seat].autoOnly=!(room.money.participation?.[seat.seat]?.manualPlays>0);
  if(rules.autoProfitPolicy==='manual-play-v1'){
   for(const seat of seats){
    if(seat.employee_id==null)continue;
    const p=result.players[seat.seat];p.autoOnly=!(room.money.participation?.[seat.seat]?.manualPlays>0);
    if(p.autoOnly){p.reward=Math.min(p.reward,p.stake);p.net=p.reward-p.stake;p.release=rules.reserve-p.stake+p.reward;p.bonus=0;}
   }
   // Withheld autoplay proceeds are never redistributed to other seats.
   result.bonus=result.players.reduce((total,p)=>total+p.bonus,0);
  }
  for(const seat of seats){const p=result.players[seat.seat];if(seat.employee_id!=null){recordLedger(seat.employee_id,p.release,'斗太姥结算与释放筹码 #'+saved.id);humanNet+=p.net;
   db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(seat.employee_id,'cards',p.stake,p.reward,'','',JSON.stringify({round:saved.id,seat:seat.seat,winner:g.winner,landlord:g.landlord,bid:g.bid,multiplier:g.multiplier,bonus:p.bonus,autoOnly:!!p.autoOnly}));
  }}
  db.prepare('UPDATE card_money_rounds SET settlement_json=?,system_delta=? WHERE id=? AND settlement_json IS NULL').run(JSON.stringify(result),-humanNet,saved.id);
  room.money.settlement=result;
 }
 return {start,settle,recordTurn,checkEntry};
}
