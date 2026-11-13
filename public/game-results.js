(function(root){
 const bombName=({cost,penalty})=>penalty>=cost*4?'超大炸弹':penalty>=cost*2?'大炸弹':'炸弹';
 const money=n=>'¤ '+n.toLocaleString('en-US');
 function text({cost,prize,penalty=0,cancelled=false,result=null,penaltyKind=null,sealMultiplier=1,basePayout=null,tax=0}){
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(prize)||cost<0||prize<0)return '正在确认结算';
  if(!Number.isSafeInteger(penalty)||penalty<0)return '正在确认结算';
  tax=Number(tax||result?.tax||0);
  if(penalty&&(penaltyKind==='overload'||result?.penaltyKind==='overload'))return '回路过载 · 本局获得 '+money(prize)+' · 维修费 '+money(penalty)+(tax?'\n已扣税 '+money(tax):'');
  const seal=result?.sealMultiplier??sealMultiplier,base=result?.basePayout??basePayout;
  const formula=seal>1?'\n'+(penalty?'基础扣款 '+money(penalty/seal):'匹配奖金 '+money(base??prize/seal))+' × '+seal+' = '+money(penalty||prize):'';
  if(penalty)return '刮出'+bombName({cost,penalty})+'了！\n本局扣除医疗费 '+money(penalty)+formula+(seal>1?'\n含票价总损失 '+money(cost+penalty):'');
  if(cancelled)return '撤班退回 '+money(prize);
  return (prize>0?'本局获得 '+money(prize):'本局返还 '+money(0))+formula+(tax?'\n已扣税 '+money(tax):'');
 }
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const taxNote=tax=>Number(tax)>0?'<small class="game-tax-note">已扣税 '+money(Number(tax))+'</small>':'';
 const markup=value=>String(value).split('\n').map(line=>line.startsWith('已扣税 ')?'<small class="game-tax-note">'+escape(line)+'</small>':escape(line)).join('\n');
 root.AVEDGameResults={text,bombName,taxNote,markup,html:value=>markup(text(value))};
})(globalThis);
