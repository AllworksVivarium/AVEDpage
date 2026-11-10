/* Server clock estimated from existing requests. No client time enters settlements. */
(function(root){
 function create({now=()=>performance.now(),lifetime=120000}={}){
  let offset=null,last=-Infinity,samples=[];
  function snapshot(serverTime,received=now()){if(Number.isFinite(serverTime)&&offset===null)offset=serverTime-received;}
  function measure(serverTime,sent,received=now()){
   const rtt=received-sent;if(!Number.isFinite(serverTime)||!Number.isFinite(rtt)||rtt<0||rtt>10000)return;
   samples=samples.filter(s=>received-s.at<lifetime).slice(-7);samples.push({at:received,rtt});
   const best=Math.min(...samples.map(s=>s.rtt));if(rtt<=best*1.5+20)offset=serverTime+rtt/2-received;
  }
  return {snapshot,measure,ready:()=>offset!==null,now(cap=Infinity){const estimated=offset===null?0:now()+offset;last=Math.min(cap,Math.max(last,estimated));return last;},reset(){offset=null;last=-Infinity;samples=[];}};
 }
 root.AVEDGameClock={create};
})(typeof window==='undefined'?globalThis:window);
