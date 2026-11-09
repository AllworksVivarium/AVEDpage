import './public/sky-rules.js';
export const {survival:skySurvival,multiplier:skyMultiplier}=globalThis.AVEDSkyRules;
export function skyRules(){
 // Broad middle, with rare near-immediate crashes and genuinely deep flights.
 const main=Array.from({length:14},(_,i)=>({min:280+i*60,max:339+i*60,weight:Math.round(Math.exp(-.5*((309.5+i*60-520)/240)**2)*100000)}));
 const total=main.reduce((s,r)=>s+r.weight,0);
 for(const r of main)r.weight=Math.round(r.weight/total*930000);
 main[0].weight+=930000-main.reduce((s,r)=>s+r.weight,0);
 return {curve:'bell-v2',boardingSeconds:12,speed:35,breakEvenDepth:216,lossFraction:1,ranges:[{min:101,max:139,weight:3000},{min:140,max:279,weight:47000},...main,{min:1120,max:1599,weight:17000},{min:1600,max:2199,weight:3000}]};
}
