(function(root){
 const money=n=>'¤ '+n.toLocaleString('en-US');
 function text({cost,prize,cancelled=false}){
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(prize)||cost<0||prize<0)return '正在确认结算';
  if(cancelled)return '撤班退回 '+money(prize);
  return prize>0?'本局获得 '+money(prize):'本局返还 '+money(0);
 }
 root.AVEDGameResults={text};
})(globalThis);
