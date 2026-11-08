import './public/sky-rules.js';
export const {survival:skySurvival,multiplier:skyMultiplier}=globalThis.AVEDSkyRules;
export function skyRules(){
 // Broader tail: ~4.167% survive 875 m, so 125% expected return pays ~30x there.
 const main=Array.from({length:14},(_,i)=>({min:280+i*60,max:339+i*60,weight:Math.round(Math.exp(-.5*((309.5+i*60-520)/203.44)**2)*100000)}));
 const total=main.reduce((s,r)=>s+r.weight,0);
 for(const r of main)r.weight=Math.round(r.weight/total*950000);
 main[0].weight+=950000-main.reduce((s,r)=>s+r.weight,0);
 return {curve:'bell-v2',boardingSeconds:12,speed:35,breakEvenDepth:216,lossFraction:1,ranges:[{min:110,max:179,weight:5000},{min:180,max:279,weight:45000},...main]};
}
