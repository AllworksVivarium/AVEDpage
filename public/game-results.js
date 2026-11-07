(function(root){
 const bombName=({cost,penalty})=>penalty>=cost*4?'超大炸弹':penalty>=cost*2?'大炸弹':'炸弹';
 const money=n=>'¤ '+n.toLocaleString('en-US');
 function text({cost,prize,penalty=0,cancelled=false,result=null,penaltyKind=null}){
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(prize)||cost<0||prize<0)return '正在确认结算';
  if(!Number.isSafeInteger(penalty)||penalty<0)return '正在确认结算';
  if(penalty&&(penaltyKind==='overload'||result?.penaltyKind==='overload'))return '回路过载 · 本局获得 '+money(prize)+' · 维修费 '+money(penalty);
  if(penalty)return '刮出'+bombName({cost,penalty})+'了！\n本局扣除医疗费 '+money(penalty);
  if(cancelled)return '撤班退回 '+money(prize);
  return prize>0?'本局获得 '+money(prize):'本局返还 '+money(0);
 }
 root.AVEDGameResults={text,bombName};
})(globalThis);
