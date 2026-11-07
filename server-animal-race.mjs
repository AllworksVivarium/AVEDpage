import {createHmac} from 'node:crypto';

export const animalRunners=[
 {id:0,name:'橘子',kind:'orange',odds:6.25,weight:.2},
 {id:1,name:'墨墨',kind:'black',odds:6.25,weight:.2},
 {id:2,name:'奶盖',kind:'cow',odds:6.25,weight:.2},
 {id:3,name:'小猪',kind:'pig',odds:6.25,weight:.2},
 {id:4,name:'法棍',kind:'frenchie',odds:6.25,weight:.2}
];
export const animalRules={version:2,runners:animalRunners,partialReturns:false,returnPercent:125,bettingMs:15000,racingMs:25000,resultMs:6000};

// Rejection sampling makes all 120 permutations equally likely. Separate draw
// domains keep the result independent of animation and any participant's actions.
export function animalPlan(seed){
 let counter=0;
 const integer=n=>{const limit=Math.floor(4294967296/n)*n;let value;do{value=createHmac('sha256',Buffer.from(seed,'hex')).update('animals-v2:'+counter++).digest().readUInt32BE(0);}while(value>=limit);return value%n;};
 const order=animalRunners.map(x=>x.id);
 for(let i=order.length-1;i>0;i--){const j=integer(i+1);[order[i],order[j]]=[order[j],order[i]];}
 const actors=animalRunners.map(r=>{
  const rank=order.indexOf(r.id),boxProgress=38+r.id*5,type=integer(4);
  const action=type===0?'run':type===1?'sleep':'box';
  const pause=action==='run'?0:1000+integer(1800),finish=20500+rank*1125;
  const stopProgress=action==='sleep'?boxProgress+12:boxProgress-(r.id>=3?5:0);
  const pauseAt=(finish-pause)*stopProgress/100;
  return {id:r.id,rank,action,pause,pauseAt,finish,boxProgress};
 });
 return {order,actors};
}

// Only this instant (and a short interpolation window after betting closes)
// leaves the server. The full plan, seed and future order remain private.
export function animalFrame(plan,elapsed){
 return plan.actors.map(a=>{
  const progressAt=t=>Math.max(0,Math.min(100,(t-Math.max(0,Math.min(a.pause,t-a.pauseAt)))/(a.finish-a.pause)*100));
  const progress=progressAt(elapsed);
  const paused=elapsed>=a.pauseAt&&elapsed<a.pauseAt+a.pause;
  const movesBox=a.id>=3&&a.action==='box',moving=movesBox&&elapsed>=a.pauseAt+a.pause&&elapsed<a.pauseAt+a.pause+1400;
  const pose=elapsed<=0?'idle':elapsed>=a.finish?'finished':paused?(movesBox?(a.id===3?'nudge':'sniff'):a.action):moving?(a.id===3?'push':'carry'):'run';
  // Leave the box where the animal dropped it; it must not snap back afterwards.
  const boxProgress=movesBox&&elapsed>=a.pauseAt+a.pause?progressAt(Math.min(elapsed,a.pauseAt+a.pause+1400))+5:a.boxProgress;
  return {id:a.id,progress,pose,boxProgress};
 });
}

export function animalReturn(cost,runner,market,order,returnPercent=125){
 return runner===order[market==='last'?order.length-1:0]?Math.floor(cost*returnPercent/20):0;
}
