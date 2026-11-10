/* Read/dismiss state changes only the reminder, never margin enforcement. */
(function(root){
 function create(){let owner=null,signature='',read=false,dismissed=false;const remembered=new Map();
  const storageKey=id=>'aved_stock_risk_notice_'+id;
  function save(){const value={signature,read,dismissed};remembered.set(owner,value);try{root.sessionStorage?.setItem(storageKey(owner),JSON.stringify(value));}catch{}}
  function update(id,data){id=id==null?null:String(id);if(id!==owner){owner=id;signature='';read=false;dismissed=false;}
   if(data==null)return {unread:false,visible:false};
   const count=data.count||0,next=count?JSON.stringify([count,data.criticalCount||0,(data.items||[]).map(x=>[x.lotId,x.riskLevel]).sort((a,b)=>a[0]-b[0])]):'';
   if(!count){signature='';read=dismissed=false;if(owner)save();return {unread:false,visible:false};}
   if(next!==signature){signature=next;read=false;dismissed=false;let prior=remembered.get(owner);try{prior=JSON.parse(root.sessionStorage?.getItem(storageKey(owner))||'null')||prior;}catch{}if(prior?.signature===next){read=!!prior.read;dismissed=!!prior.dismissed;}if(!next&&owner)save();}
   return {unread:!!count&&!read&&!dismissed,visible:!!count&&!dismissed};
  }
  return {update,seen(){read=true;if(owner)save();},dismiss(){read=dismissed=true;if(owner)save();}};
 }
 if(typeof module!=='undefined')module.exports={create};else root.AVEDStockRiskNotice={create};
})(typeof window==='undefined'?globalThis:window);
