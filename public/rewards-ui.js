window.AVEDRewardsUI=function({api,byId,getUser,onBalance,showToast}) {
 const area=byId('daily-allocation');area.className='reward-allocation';const daily=byId('header-quick-checkin-btn'),relief=byId('header-quick-relief-btn');
 area.innerHTML='<article><span class="reward-no">01</span><div><h3>每日签到</h3><p>10,000 / 每日一次</p></div><time id="daily-reset-clock"></time><div id="daily-claim-slot"></div></article><article><span class="reward-no">02</span><div><h3>整点补给</h3><p>5,000 / 每个整点刷新，不累计</p></div><time id="hourly-reset-clock"></time><button id="hourly-claim" type="button">领取补给</button></article><article><span class="reward-no">03</span><div><h3>低保增金</h3><p>余额低于 10,000 时，每次可领 10,000</p></div><span id="relief-available"></span><div id="relief-claim-slot"></div></article>';
 byId('daily-claim-slot').append(daily);byId('relief-claim-slot').append(relief);
 let state=null,received=0,busy=false,last=0;
 const clock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');};
 function paint(){if(!state)return;const now=state.serverTime+performance.now()-received;byId('daily-reset-clock').textContent='刷新 '+clock(state.dailyResetAt-now);byId('hourly-reset-clock').textContent='刷新 '+clock(state.hourlyResetAt-now);const hour=byId('hourly-claim');hour.disabled=state.hourlyClaimed;hour.textContent=state.hourlyClaimed?'已领取':'领取补给';byId('relief-available').textContent=(getUser()?.balance||0)<10000?'可领取':'余额充足';if(now>=Math.min(state.hourlyResetAt,state.dailyResetAt)&&performance.now()-last>2000)refresh().catch(()=>{});}
 async function refresh(){if(!getUser()||busy)return;busy=true;last=performance.now();try{state=await api('/api/player/rewards');received=performance.now();paint();}finally{busy=false;}}
 byId('hourly-claim').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const d=await api('/api/player/rewards/hourly',{method:'POST'});state=d;received=performance.now();onBalance(d.balance);paint();showToast(d.reward?'整点补给已入账 '+d.reward.toLocaleString()+'。':'本小时已领取。',d.reward?'success':'info',d.reward?{stamp:'补给已签收'}:{});}catch(err){b.disabled=false;showToast(err.message);}};
 const visible=()=>getUser()&&!document.hidden&&!byId('view-casino').classList.contains('hidden')&&!byId('game-panel-home').classList.contains('hidden');
 setInterval(()=>{if(!visible())return;if(!state||performance.now()-last>30000)refresh().catch(()=>{});else paint();},1000);
 window.AVEDRewardsRefresh=refresh;return {refresh};
};
