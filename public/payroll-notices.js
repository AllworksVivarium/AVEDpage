window.AVEDPayrollNotices={create({getUser,api,onReceipt=()=>{}}){
 let owner=null,lastCheck=0,busy=false,dialog=null;
 function close(){const current=dialog;dialog=null;current?.close();current?.remove();}
 function available(){
  const app=document.getElementById('inner-app-view'),bar=document.querySelector('.bar-room');
  return !!getUser()&&!document.hidden&&((app&&!app.classList.contains('hidden'))||(bar&&!bar.hidden))&&!document.querySelector('dialog[open]');
 }
 async function ensure(){
  const id=getUser()?.id||null;
  if(owner!==id){owner=id;lastCheck=0;close();}
  if(busy||!id||!available()||Date.now()-lastCheck<30000)return;
  busy=true;lastCheck=Date.now();
  try{
   const data=await api('/api/player/payroll-notices',{retries:0});
   if(getUser()?.id!==id||!available())return;
   const notice=data.items?.find(item=>Number.isSafeInteger(item.id)&&Number.isSafeInteger(item.amount)&&item.amount>0);
   if(!notice)return;
   // The server claim also prevents two tabs or devices repeating the same receipt.
   const result=await api('/api/player/payroll-notices/read',{method:'POST',body:{id:notice.id},retries:0});
   if(!result.claimed||getUser()?.id!==id)return;
   dialog=document.createElement('dialog');dialog.id='payroll-notice';dialog.className='payroll-notice-dialog';dialog.setAttribute('aria-labelledby','payroll-notice-title');
   const heading=document.createElement('h2');heading.id='payroll-notice-title';heading.textContent='工资已到账';
   const amount=document.createElement('p');amount.className='payroll-notice-amount';amount.textContent='入账 '+notice.amount.toLocaleString('zh-CN')+' 元';
   const button=document.createElement('button');button.type='button';button.className='community-button';button.textContent='知道了';
   dialog.append(heading,amount,button);document.body.append(dialog);dialog.showModal();button.onclick=close;dialog.addEventListener('close',close,{once:true});
   onReceipt();lastCheck=0;
  }catch{/* Background reminders retry without interrupting the current page. */}
  finally{busy=false;}
 }
 document.addEventListener('visibilitychange',ensure);
 return {ensure,close};
}};
