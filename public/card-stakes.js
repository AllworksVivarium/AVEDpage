/* Shared validation and reserve rules; the server remains authoritative. */
(function(root){
 const presets=Object.freeze([1000,10000,50000]);
 function validate(base){if(!Number.isSafeInteger(base)||base<100||base>1000000)throw Error('底注须为 100 至 1,000,000 的整数。');return base;}
 const reserve=base=>Math.max(10000,validate(base)*10);
 root.AVEDCardStakes=Object.freeze({presets,defaultBase:1000,min:100,max:1000000,validate,reserve,read:(preset,custom)=>validate(Number(preset==='custom'?custom:preset))});
})(globalThis);
