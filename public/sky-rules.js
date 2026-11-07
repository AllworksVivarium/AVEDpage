/* The client previews the same public payout curve; only the server settles money. */
(function(root){
 function survival(depth,ranges){const total=ranges.reduce((s,r)=>s+r.weight,0);return ranges.reduce((s,r)=>s+r.weight*Math.max(0,Math.min(1,(r.max-Math.max(r.min,Math.floor(depth)+1)+1)/(r.max-r.min+1))),0)/total;}
 function multiplier(depth,rules){
  const d=Math.floor(depth);
  if(rules.curve!=='bell-v1')return d/(rules.breakEvenDepth||200);
  const target=.5+.75*Math.max(0,Math.min(1,(d-100)/180));
  return Math.min(50,target/Math.max(1e-12,survival(d,rules.ranges)));
 }
 root.AVEDSkyRules={survival,multiplier};
})(globalThis);
