import {createHmac} from 'node:crypto';

export const animalRunners=[
 {id:0,name:'橘子',kind:'orange',odds:6.25,weight:.2},
 {id:1,name:'墨墨',kind:'black',odds:6.25,weight:.2},
 {id:2,name:'奶盖',kind:'cow',odds:6.25,weight:.2},
 {id:3,name:'小猪',kind:'pig',odds:6.25,weight:.2},
 {id:4,name:'法棍',kind:'frenchie',code:'AVED-007',odds:6.25,weight:.2}
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
  const rank=order.indexOf(r.id),finish=20500+rank*1125;
  // Draw one to three distinct antics per runner; at most one uses the paper box.
  // Finish order has already been drawn, so expanding animation choices cannot change it.
  const boxes=[['jump','scratch','box'],['box','scratch','peek'],['peek','scratch','jump'],['nudge','sniff'],['carry','sniff']][r.id];
  const boxAction=boxes[integer(boxes.length)];
  const habits=[['groom','stretch','yawn','shake','doze'],['sleep','doze','groom','yawn','shake'],['stretch','groom','yawn','shake','doze'],['roll','sleep','doze','shake','yawn'],['stretch','shake','yawn','doze']][r.id];
  const pool=[boxAction,...habits];
  for(let i=pool.length-1;i>0;i--){const j=integer(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  const actions=pool.slice(0,1+integer(3));
  const events=actions.map((pose,i)=>({pose,progress:Math.round((i+1)*100/(actions.length+1))-4+integer(9),duration:pose==='jump'?1700:1400+integer(1000),box:pose===boxAction}));
  const pause=events.reduce((sum,e)=>sum+(e.pose==='jump'?0:e.duration),0),runTime=finish-pause;
  let spent=0;for(const e of events){e.at=runTime*e.progress/100+spent;if(e.pose!=='jump')spent+=e.duration;}
  const boxEvent=events.find(e=>e.box),boxProgress=boxEvent?boxEvent.progress+(boxAction==='jump'?850/runTime*100:boxAction==='box'?0:boxAction==='scratch'?6:5):35+integer(35);
  return {id:r.id,rank,finish,pause,events,boxProgress};
 });
 return {order,actors};
}

// Only this instant (and a short interpolation window after betting closes)
// leaves the server. The full plan, seed and future order remain private.
export function animalFrame(plan,elapsed){
 return plan.actors.map(a=>{
  const progressAt=t=>{
   const stopped=a.events.find(e=>e.pose!=='jump'&&t>=e.at&&t<=e.at+e.duration);
   if(stopped)return stopped.progress;
   return Math.max(0,Math.min(100,(t-a.events.reduce((sum,e)=>sum+(e.pose==='jump'?0:Math.max(0,Math.min(e.duration,t-e.at))),0))/(a.finish-a.pause)*100));
  };
  const progress=progressAt(elapsed);
  const event=a.events.find(e=>elapsed>=e.at&&elapsed<e.at+e.duration),boxEvent=a.events.find(e=>e.box);
  const movesBox=['nudge','carry'].includes(boxEvent?.pose),moveAt=boxEvent?boxEvent.at+boxEvent.duration:Infinity,moving=movesBox&&elapsed>=moveAt&&elapsed<moveAt+1400;
  const pose=elapsed<=0?'idle':elapsed>=a.finish?'finished':event?.pose|| (moving?(a.id===3?'push':'carry'):'run');
  // Leave the box where the animal dropped it; it must not snap back afterwards.
  const boxProgress=movesBox&&elapsed>=moveAt?progressAt(Math.min(elapsed,moveAt+1400))+5:a.boxProgress;
  return {id:a.id,progress,pose,boxProgress,actionPhase:event?(elapsed-event.at)/event.duration:moving?1:0};
 });
}

export function animalReturn(cost,runner,market,order,returnPercent=125){
 return runner===order[market==='last'?order.length-1:0]?Math.floor(cost*returnPercent/20):0;
}

// Publish only breakpoints inside the already public one-second frame window.
export function animalMotion(plan,from,to){
 return plan.actors.map(a=>[...new Set([from,...[...a.events.flatMap(e=>[e.at,e.at+e.duration,...(['nudge','carry'].includes(e.pose)?[e.at+e.duration+1400]:[])]),a.finish].filter(t=>t>from&&t<to),to])].sort((x,y)=>x-y).map(at=>({at,...animalFrame(plan,at)[a.id]})));
}
