import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {tableView,cardBotNames} from '../server-card-table.mjs';
import {cardRulesFor} from '../server-card-wallet.mjs';

const source=fs.readFileSync(new URL('../public/ddz-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function moneyText(current){');
const end=source.indexOf("\n $('[data-ddz-base]').onchange",start);
const moneyText=vm.runInNewContext('('+source.slice(start,end).trim()+')');
const room=mode=>({id:'rules',mode,size:3,base:5000,seats:[{id:1,name:'玩家'},{id:-2,bot:true},{id:-3,bot:true}]});

test('waiting rooms expose exactly the rules used at deal time, including online rooms filled with computers',()=>{
 for(const mode of ['solo','online']){
  const r=room(mode),view=tableView(r,1),text=moneyText(view);
  assert.deepEqual(view.moneyRules,cardRulesFor(r));
  assert.match(text,/开局锁定 ¤ 50,000/);assert.match(text,/底注 5000/);
  assert.match(text,/全人机局.*90%.*50%/);assert.doesNotMatch(text,/联机局|25%|100,000/);
 }
 const r=room('online');r.seats[2]={id:2,name:'另一位玩家'};
 let view=tableView(r,1),text=moneyText(view);
 assert.equal(view.moneyRules.computerOnly,false);
 assert.match(text,/普通联机局.*2 倍.*25%/);assert.doesNotMatch(text,/全人机|90%|50%/);
 r.seats[2]=null;view=tableView(r,1);
 assert.equal(view.moneyRules.computerOnly,false,'an empty online lobby is not a computer game');
 assert.doesNotMatch(moneyText(null),/90%|50%|25%/);
 assert.equal(moneyText({...view,spectating:true}),'旁观不参与下注与结算');
});

test('playing and settled copy uses the saved round values instead of inferring from current seats',()=>{
 const r=room('online');r.money={round:'saved',rules:{base:1000,reserve:10000,bonusPercent:0,computerReturns:{winPercent:180,lossPercent:60}}};
 r.seats[2]={id:2};
 let view=tableView(r,1);assert.match(moneyText(view),/全人机局.*80%.*40%/);
 assert.doesNotMatch(moneyText(view),/普通联机|90%|50%|25%/);
 r.money.settlement={players:[{stake:2000,reward:3600}]};
 view=tableView(r,1);assert.match(moneyText(view),/本局获得 ¤ 3,600.*80%.*40%/);
});

test('nickname pool excludes the rejected choices and mixes ordinary names with retained jokes',()=>{
 const removed=['这张三有梦想','谢谢老板的三','我先笑为敬','三楼复印机','梅花先生','饭还没热','正在等外卖','今天周几','杯子里没水','下班再说','有事请留言','姓名加载中','会议室禁止春天','拆对也要走','给队友递杯茶','队友你先走','财务说适可而止','绩效全靠这把','我就剩一手了','对子批发部','单张回收站','顺子修理工','炸弹拆迁办','飞机晚点了'];
 for(const name of removed)assert.ok(!cardBotNames.includes(name),name);
 for(const name of ['真没藏炸弹','手里全是顺子','你炸我就鼓掌','别给我发表情了','神秘员工007','随机员工031','方片07'])assert.ok(cardBotNames.includes(name),name);
 assert.equal(new Set(cardBotNames).size,cardBotNames.length);
});
