window.AVEDPersonalUI=function({api,esc,byId,getUser,getProfile,getAchievements,welfare,showToast}) {
 let sphereCleanup=()=>{},request=0;
 const money=n=>'¤ '+Number(n).toLocaleString();
 function render(){
  sphereCleanup();const user=getUser(),profile=getProfile(),target=byId('view-profile');if(!user||!target)return;
  target.innerHTML=`<div class="personal-toolbar"><div class="section-kicker">A.V.E.D. / PERSONNEL TERMINAL <span dir="rtl" lang="he">מסוף עובדים</span></div><div><button data-display-settings>显示设置</button><button data-effects-toggle></button></div></div>
   <section class="personal-hub hub-next">
    <header class="hub-masthead"><span>PERSONNEL / ACCESS GRANTED</span><span>万业携生 · AVED</span></header>

    <div class="hub-intro"><div class="hub-welcome"><span class="section-kicker">欢迎您</span><h1>${esc(user.name)}</h1><p class="hub-alias">当前 ID <strong>${esc(profile.anonymousName||'未登记')}</strong></p><p>${esc(user.positionTitle||user.department)}</p><div class="hub-quick-actions"><button data-personal-edit>编辑档案</button><button data-personal-nav="news">内部通告 ↗</button></div></div>
     <figure class="hub-signal"><figcaption><span>SIGNAL / 01</span><span>接入信号</span></figcaption><canvas id="personal-sphere" aria-hidden="true"></canvas><div class="hub-signal-static" aria-hidden="true">A / V / E / D</div><p>CONTROL CONTAIN PROTECT</p></figure></div>
    <div class="hub-identity"><div class="hub-avatar">${profile.avatarUrl?`<img src="${esc(profile.avatarUrl)}" alt="个人头像">`:'<span aria-label="未上传头像">ID</span>'}</div><div><span class="section-kicker">可用余额 / BALANCE</span><strong id="hub-balance">${money(user.balance)}</strong></div><button data-personal-zero>资产归零</button></div>
    <details class="hub-editor" id="personal-editor"><summary>个人档案与头像</summary><form id="cloud-profile-form"><label>匿名代号<input name="anonymousName" maxlength="32" required value="${esc(profile.anonymousName)}"></label><label>上传头像<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp"></label>${user.identityKind==='player_containment'?`<label>收容简介<textarea name="bio" maxlength="500" rows="5">${esc(profile.bio||'')}</textarea></label><p>可修改自己的收容简介和头像；身份、职务与所属关系由管理员维护。</p>`:''}<button type="submit" class="community-button">保存档案</button></form></details>
    <section class="hub-achievements"><header><span class="section-kicker">RECOGNITION / 已解锁记录</span><h2>成就档案</h2></header><div class="earned-grid">${getAchievements().map(a=>`<article><span class="achievement-mark" aria-hidden="true">${esc(a.code.toUpperCase())}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p></article>`).join('')||'<p class="achievement-empty">当前没有已解锁记录。</p>'}</div></section>
   </section><section id="hub-finance-mount"></section><details class="hub-history"><summary>游戏记录</summary><div id="hub-history-list"></div><button id="hub-history-more" hidden>更多记录</button></details>`;
  window.AVEDSyncPreferences?.();welfare().profile();const finance=byId('personal-finance');if(finance)byId('hub-finance-mount').append(finance);
  target.querySelector('[data-personal-edit]').onclick=()=>{byId('personal-editor').open=true;byId('personal-editor').scrollIntoView({block:'nearest'});};
  target.querySelector('[data-personal-zero]').onclick=()=>byId('zero-balance-btn').click();
  target.querySelector('[data-personal-nav]').onclick=()=>document.querySelector('[data-nav="news"]').click();
  let loaded=false,busy=false,cursor=null;const version=++request,history=target.querySelector('.hub-history');
  async function loadHistory(){if(busy)return;busy=true;const more=byId('hub-history-more');more.disabled=true;try{const d=await api('/api/player/history'+(cursor?'?before='+cursor:''));if(version!==request)return;const box=byId('hub-history-list');if(!loaded)box.replaceChildren();box.insertAdjacentHTML('beforeend',d.items.map(h=>`<article><span>${esc(({scratch:'刮刮彩票',slot:'异常回路',sky:'高空速降',derby:'异常竞速',cards:'牌桌'})[h.game]||h.game)}</span><span>投入 ${money(h.cost)} / 返还 ${money(h.prize)}${h.penalty>0?` / 追加扣款 ${money(h.penalty)}`:''}</span><small>${AVEDTime.markup(h.createdAt)}</small></article>`).join('')||'<p>暂无玩法记录。</p>');loaded=true;cursor=d.next;more.hidden=!cursor;}catch(e){showToast(e.message);}finally{busy=false;more.disabled=false;}}
  history.addEventListener('toggle',()=>{if(history.open&&!loaded)loadHistory();});byId('hub-history-more').onclick=loadHistory;
  sphereCleanup=miniSphere(byId('personal-sphere'));
 }
 function miniSphere(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return()=>{};const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const n=1400,points=Array.from({length:n},(_,i)=>({a:Math.sin(i),b:Math.cos(i),c:Math.sin(i*i),d:Math.cos(i*i),x:0,y:0,vx:0,vy:0}));
  let frame=0,angle=0,visible=false,last=0,pointer=null,w=0,h=0,r=0;
  function draw(moving){ctx.fillStyle=document.body.classList.contains('radix-terminal')?'#111111':'#0a0b0c';ctx.fillRect(0,0,w,h);ctx.fillStyle=document.body.classList.contains('radix-terminal')?'#eeeeee':'#ecebe5';const a=Math.cos(angle),b=Math.sin(angle);for(const p of points){const hx=(p.a*a+p.b*b)*p.c*r,hy=p.d*r;if(moving){p.vx+=(hx-p.x)*.025;p.vy+=(hy-p.y)*.025;if(pointer){const dx=p.x-pointer.x,dy=p.y-pointer.y,d=Math.hypot(dx,dy);if(d>1&&d<50){const k=(1-d/50)*8/d;p.vx+=dx*k;p.vy+=dy*k;}}p.vx*=.86;p.vy*=.86;p.x+=p.vx;p.y+=p.vy;}else{p.x=hx;p.y=hy;}ctx.globalAlpha=.3+.65*Math.abs(p.c);ctx.fillRect(w/2+p.x,h/2+p.y,1.2,1.2);}ctx.globalAlpha=1;if(moving)angle+=.008;}
  function allowed(){return visible&&!document.hidden&&!byId('view-profile').classList.contains('hidden')&&window.AVEDEffectsEnabled()&&!reduced.matches;}
  function tick(now){frame=0;if(!allowed())return;if(now-last>40){draw(true);last=now;}frame=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(frame);frame=0;if(allowed())frame=requestAnimationFrame(tick);}
  const resize=new ResizeObserver(()=>{w=Math.max(1,canvas.clientWidth);h=Math.max(1,canvas.clientHeight);canvas.width=w;canvas.height=h;r=Math.min(w,h)*.39;draw(false);sync();});resize.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});intersection.observe(canvas);
  canvas.onpointermove=e=>{const b=canvas.getBoundingClientRect();pointer={x:e.clientX-b.left-w/2,y:e.clientY-b.top-h/2};};canvas.onpointerleave=()=>pointer=null;
  document.addEventListener('aved-effects-change',sync);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();document.removeEventListener('aved-effects-change',sync);document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);};
 }
 return {render};
};
