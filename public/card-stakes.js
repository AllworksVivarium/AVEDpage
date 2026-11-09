/* Shared validation and reserve rules; the server remains authoritative. */
(function(root){
 const presets=Object.freeze([1000,5000,10000]);
 const computerMax=10000;
 function validate(base,computerOnly=false){const max=computerMax;if(!Number.isSafeInteger(base)||base<100||base>max)throw Error(computerOnly?'全人机牌局底注须为 100 至 10,000 的整数。':'底注须为 100 至 10,000 的整数。');return base;}
 const reserve=base=>Math.max(10000,validate(base)*10);
 root.AVEDCardStakes=Object.freeze({presets,defaultBase:1000,min:100,max:10000,computerMax,validate,reserve,read:(preset,custom,computerOnly=false)=>validate(Number(preset==='custom'?custom:preset),computerOnly)});
})(globalThis);
