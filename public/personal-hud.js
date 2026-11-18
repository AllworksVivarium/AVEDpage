/* Personal-page-only controller; shared controls remain the source of truth. */
window.AVEDPersonalUI=function({api,esc,byId,getUser,getProfile,getAchievements,getRecords=()=>null,welfare,onBalance,onDailyCheckin,showToast}){
 let cleanup=()=>{},version=0;const typedProgress=new Map();
 const money=n=>'¤ '+Number(n||0).toLocaleString(),games={scratch:'刮刮乐',slot:'异常回路',sky:'高空速降',derby:'异常竞速',cards:'牌桌'};
 const backgrounds=[['image','建筑背景',0],['sphere','信号球体',100000]],patterns=[['plain','无纹理',0],['halftone','波纹网点',20000],['fade','渐隐网点',20000],['grain','磨砂纸纹',20000],['ascii','符号瀑流',20000],['phase','相位点阵',20000]];
 const paths={fx:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',sound:'M11 4 6 8H3v8h3l5 4Z M16 8l5 8 M21 8l-5 8',soundOn:'M11 4 6 8H3v8h3l5 4Z M15 8q5 4 0 8 M18 5q8 7 0 14',tools:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M9 15v6',edit:'m15 4 5 5-11 11H4v-5Z M12 7l5 5',clock:'M12 6v6l4 2',check:'m5 12 4 4L19 6'};
 const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">${n==='clock'?'<circle cx="12" cy="12" r="9"/>':''}<path d="${paths[n]}"/></svg>`;
 function render(){
  cleanup();const u=getUser(),p=getProfile(),root=byId('view-profile');if(!u||!root)return;
  const serial=++version,uid=u.id,earned=getAchievements()||[],records=getRecords(),highest=records?.highest;
  root.classList.add('personal-hud');
  const dialogCaptions={'hud-palette':'DISPLAY / PALETTE','hud-palette-preview':'COLOR PROFILE / PREVIEW','hud-edit':'PERSONNEL DOSSIER','hud-sound':'AUDIO / INCOME VOICE','hud-tools':'BACKGROUND / COLLECTION','hud-account':'PERSONNEL LEDGER'};
  const dialog=(id,title,body)=>`<dialog id="${id}" class="hud-dialog" aria-labelledby="${id}-title"><header><span id="${id}-title">${title}</span><button type="button" data-hud-close aria-label="关闭${title}">×</button></header><div class="hud-dialog-body">${dialogCaptions[id]?`<div class="hud-dialog-kicker" lang="en" aria-hidden="true">${dialogCaptions[id]}</div>`:''}${body}</div></dialog>`;
  const radarVertices=[[70,18],[115,44],[115,96],[70,122],[25,96],[25,44]],radarPoints=Array.isArray(p.attributes)?p.attributes.map((v,i)=>[70+(radarVertices[i][0]-70)*v/100,70+(radarVertices[i][1]-70)*v/100]):null;
  const radarShape=radarPoints?'<polygon class="hud-radar-values" points="'+radarPoints.map(p=>p.join(',')).join(' ')+'"/>'+radarPoints.map(([x,y])=>'<circle class="hud-radar-point" cx="'+x+'" cy="'+y+'" r="2"/>').join(''):'';
  const radar=`<svg viewBox="0 0 140 140" role="img" aria-label="${p.attributes?'六维属性：'+p.attributes.map((v,i)=>['力量','意志','洞察','敏捷','智力','体质'][i]+' '+v).join('，'):'六维档案未录入'}"><g fill="none" stroke="currentColor" stroke-width=".65">${[1,.66,.33].map(s=>`<polygon points="${[[70,18],[115,44],[115,96],[70,122],[25,96],[25,44]].map(([x,y])=>`${70+(x-70)*s},${70+(y-70)*s}`).join(' ')}"/>`).join('')}<path d="M70 18v104M25 44l90 52M25 96l90-52"/></g>${radarShape}<circle cx="70" cy="70" r="2" fill="currentColor"/><g fill="currentColor" font-size="10" text-anchor="middle"><text x="70" y="11">力量</text><text x="124" y="43">意志</text><text x="124" y="101">洞察</text><text x="70" y="135">敏捷</text><text x="16" y="101">智力</text><text x="16" y="43">体质</text></g></svg>`;
  root.innerHTML=`<section class="personal-hub hud-shell">
   <div class="hud-topline"><span>PERSONNEL / DOSSIER</span><span><i class="hud-led"></i> INTERNAL ACCESS</span></div>
   <div class="hud-top-grid"><button class="hud-frame hud-avatar" data-hud-open="hud-edit" aria-label="更换头像" aria-haspopup="dialog">${p.avatarUrl?`<img${p.avatarPreset?' class="hud-avatar-preset"':''} src="${esc(p.avatarUrl)}" alt="${esc(u.name)}的头像">`:`<span class="hud-avatar-empty" aria-hidden="true"><small class="avatar-noinfo">NOINFO</small></span>`}<span class="hud-crt-glass" aria-hidden="true"></span><span class="hud-crt-beam" aria-hidden="true"></span><span class="hud-edit-mark">${icon('edit')}</span></button>
   <div class="hud-controls"><button class="hud-frame hud-key" data-hud-open="hud-palette" aria-haspopup="dialog" aria-label="切换配色"><span class="hud-palette-chip"></span><span class="hud-key-label">配色<span aria-hidden="true">⌄</span></span><small class="hud-key-en" lang="en" aria-hidden="true">PALETTE</small></button><button class="hud-frame hud-key" data-hud-fx aria-pressed="false" aria-label="切换特效"><span data-hud-fx-icon>${icon('fx')}</span><span data-hud-fx-label>特效开启</span><small class="hud-key-en" lang="en" aria-hidden="true">EFFECTS</small><i class="hud-led"></i></button><button class="hud-frame hud-key" data-hud-sound aria-haspopup="dialog" aria-label="声音设置"><span data-hud-sound-icon>${icon('sound')}</span><span data-hud-sound-label>声音设置</span><small class="hud-key-en" lang="en" aria-hidden="true">SOUND</small><i class="hud-led"></i></button><button class="hud-frame hud-key" data-hud-open="hud-tools" aria-haspopup="dialog">${icon('tools')}<span>背景设置</span><small class="hud-key-en" lang="en" aria-hidden="true">BACKGROUND</small></button></div><section class="hud-top-terminal hud-frame" aria-hidden="true"><header><span lang="en">LOCAL CONSOLE</span><span class="hud-console-dots">...</span></header><div class="hud-terminal-lines" data-hud-console></div></section></div>
   <div class="hud-name-row"><div><h1 style="--hud-name-count:${Math.max(1,Math.min(6,Array.from(u.name||'').length))}" data-name-length="${Math.min(6,Array.from(u.name||'').length)}">${esc(u.name)}</h1><span class="hud-department">${esc([...new Set([/^公司直属(?:部|领导)?$/.test(u.department||'')?'':u.department,u.positionTitle].filter(Boolean))].join(' '))}</span><span class="hud-personnel-tag" lang="en" aria-hidden="${!u.containmentClassification}">${esc(u.containmentClassification||'PERSONNEL DOSSIER')}</span></div><div class="hud-clock" aria-label="内网时间"><time data-hud-clock></time><span>NET / <b data-hud-date></b></span></div></div>
   <div class="hud-boot-line" aria-hidden="true"><span class="hud-prompt">›</span><span lang="en" data-type-run="en" data-hud-typed data-hud-text="PERSONNEL LINK ESTABLISHED."></span><bdi lang="he" dir="rtl">תיק עובד / רשת פנימית</bdi></div>
   <div class="hud-register"><button class="hud-frame hud-data-row" data-hud-open="hud-edit" data-hud-alias aria-label="修改内网 ID" aria-haspopup="dialog"><span>内网 ID<small lang="en">INTRANET ID</small></span><strong>${esc(p.anonymousName||'')}</strong><span class="hud-row-edit">${icon('edit')}</span></button><div class="hud-frame hud-data-row hud-balance-row"><span>账户余额<small lang="en">BALANCE</small></span><strong id="hub-balance">${money(u.balance)}</strong><button type="button" data-hud-open="hud-account" aria-label="账户操作" aria-haspopup="dialog">⋯</button></div></div>
   <div class="hud-checkins"><button class="hud-frame" data-hud-daily disabled><span class="hud-check-icon">${icon('check')}</span><span>每日签到<small data-hud-daily-note></small></span><b data-hud-daily-label>…</b></button><button class="hud-frame" data-hud-hourly disabled><span class="hud-check-icon">${icon('clock')}</span><span>整点补给<small data-hud-hourly-note></small></span><b data-hud-hourly-label>…</b></button></div>
   <div class="hud-instruments"><section class="hud-frame hud-radar"><header><span>六维</span><small>HEX / 06</small></header>${radar}</section><section class="hud-frame hud-signal"><header><span>信号视窗</span><small lang="he" dir="rtl">קשר / 01</small></header><canvas id="hud-particles" aria-hidden="true"></canvas><div class="hud-signal-footer" aria-hidden="true"><span>RX / TX ─ SYNC</span><span>AVED / SIGNAL</span></div></section></div>
   <div class="hud-telemetry">
    <button type="button" class="hud-frame hud-optics" data-hud-optics aria-pressed="false" aria-label="光电频谱：点击暂停或继续" title="点击暂停或继续，移动指针改变频谱"><span class="hud-micro-label"><span lang="en">OPTICAL / 01</span><b data-hud-optics-state>SCAN</b></span><span class="hud-optical-bars" aria-hidden="true">${[.25,.7,.45,.9,.55,.35,.8,.45,.65,.3,.5,.82,.38,.68,.48,.24].map(h=>`<i style="--bar:${h}"></i>`).join('')}</span></button>
    <button type="button" class="hud-frame hud-channel" data-hud-channel aria-label="通道示波：点击切换波形" title="点击切换波形，移动指针调整波幅"><span class="hud-micro-label"><span lang="en">CHANNEL / 02</span><b data-hud-channel-state>SIN</b></span><canvas data-hud-wave aria-hidden="true"></canvas></button>
    <button type="button" class="hud-frame hud-matrix" data-hud-matrix aria-label="点阵扫描：点击切换图案" title="点击切换图案，移动指针照亮点阵"><span class="hud-micro-label"><span lang="en">MATRIX / 03</span><b data-hud-matrix-state>GRID</b></span><canvas data-hud-matrix-canvas aria-hidden="true"></canvas></button>
   </div>
   <section class="hud-frame hud-bio"><header><span>个人简介</span><button type="button" data-hud-open="hud-edit" data-hud-bio aria-label="编辑个人简介" aria-haspopup="dialog">${icon('edit')}</button></header><p${p.bio?'':' class="hud-bio-empty"'}>${p.bio?esc(p.bio):'添加个人简介'}</p></section>
   ${highest?`<details class="hud-frame hud-record"><summary><span>最高单局奖金</span><strong>${money(highest.prize)}</strong><span>＋</span></summary><div class="hud-detail-body"><p>${esc(games[highest.game]||highest.game)} · 奖金含本金</p>${(records.byGame||[]).map(r=>`<div class="hud-list-row"><span>${esc(games[r.game]||r.game)}</span><strong>${money(r.prize)}</strong></div>`).join('')}</div></details>`:''}
   ${earned.length?`<details class="hud-frame hud-earned"><summary><span>个人荣誉</span><span class="hud-stamps" aria-hidden="true">${earned.slice(0,4).map(()=>'<i>✧</i>').join('')}</span><small>${earned.length}</small><span>＋</span></summary><div class="hud-detail-body">${earned.map(a=>`<article class="hud-achievement"><span aria-hidden="true">✧</span><div><strong>${esc(a.title)}</strong><p>${esc(a.description||'')}</p></div></article>`).join('')}</div></details>`:''}
   <div class="hud-log-grid">${[['ledger','账户流水'],['history','游戏记录']].map(([key,name])=>`<details class="hud-frame hud-log" data-hud-log="${key}"><summary><span>${name}</span><span>↗</span></summary><div class="hud-detail-body"><div data-log-items role="status"></div><button type="button" data-log-more hidden>更多记录</button></div></details>`).join('')}</div>
   <footer class="hud-footer" aria-hidden="true"><span class="hud-light-array">▏▎▍▏▌▎▏▍▎▌▏▏</span><span lang="en">PERSONNEL TERMINAL <bdi lang="he" dir="rtl">תיק אישי</bdi></span><span>＋ ── ＋</span></footer></section>
   ${dialog('hud-palette','界面配色',`<div class="hud-palette-options">${Object.entries(window.AVEDAppearance?.palettes||{}).map(([key,palette])=>`<div class="hud-palette-choice"><button type="button" data-hud-palette="${key}"><span>${esc(palette.name)}</span><span class="hud-colors" aria-hidden="true">${palette[document.body.classList.contains('dark-mode')?'night':'day'].map(c=>`<i style="--chip:${c}"></i>`).join('')}</span><b aria-hidden="true"></b></button><button type="button" data-hud-preview="${key}" aria-label="预览${esc(palette.name)}">预览</button></div>`).join('')}</div>`)}
   ${dialog('hud-palette-preview','配色预览',`<div class="palette-preview-board">${['day','night'].map(mode=>`<section class="palette-preview-sample" data-preview-mode="${mode}"><header>员工终端 <small>${mode==='day'?'日间':'夜间'}</small></header><div><p>内网 ID <strong>夜航员</strong></p><p>账户余额 <strong>¤ 20,000</strong></p><button type="button" disabled>每日签到</button></div></section>`).join('')}</div><p class="palette-preview-note">预览中，尚未应用。</p><div class="hud-dialog-actions"><button type="button" data-preview-back>返回配色选择</button></div>`)}
   ${dialog('hud-edit','编辑个人档案',`<form id="cloud-profile-form"><label>真名<input value="${esc(u.name||'')}" readonly aria-readonly="true" data-contamination-exempt data-type-ignore></label><label>内网 ID<input name="anonymousName" maxlength="32" required value="${esc(p.anonymousName||'')}" autocomplete="off"></label><fieldset class="hud-login-fields"><legend>登录信息</legend><label>登录用户名<input name="username" maxlength="40" required value="${esc(u.account||'')}" autocomplete="username" autocapitalize="none" spellcheck="false"></label><label>新密码<input name="password" type="password" minlength="6" maxlength="1024" autocomplete="new-password" placeholder="留空则不修改"></label><label data-hud-password-confirm hidden>确认新密码<input name="passwordConfirmation" type="password" maxlength="1024" autocomplete="new-password" placeholder="修改密码时填写"></label><label data-hud-password-current hidden>当前密码<input name="currentPassword" type="password" maxlength="1024" autocomplete="current-password" placeholder="修改用户名或密码时填写"></label></fieldset><label class="hud-upload">头像<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp"><img data-avatar-preview alt="头像预览" hidden></label><label>默认头像<select name="avatarMode"><option value="current">保持当前头像</option><option value="none">NOINFO</option><option value="pixel">黑色西装 · 像素证件照</option></select></label><fieldset class="avatar-preset-options" hidden><legend>头像底色</legend>${[['slate','灰蓝'],['moss','苔绿'],['wine','暗红'],['sand','沙金'],['dusk','烟紫']].map(([key,label])=>`<label><input type="radio" name="avatarPreset" value="${key}" ${key===(p.avatarPreset||'slate')?'checked':''}><img src="/assets/avatar-pixel-${key}.debac0c8de54.svg" alt="${label}" width="40" height="40" loading="lazy"><span>${label}</span></label>`).join('')}</fieldset><label>个人简介<textarea name="bio" maxlength="500" rows="4" placeholder="添加个人简介">${esc(p.bio||'')}</textarea></label><div class="hud-dialog-actions"><button type="button" data-hud-close>取消</button><button type="submit">保存</button></div></form>`)}
   ${dialog('hud-sound','声音设置',`<div class="hud-sound-settings"><label class="sound-switch"><span>网页音效</span><input type="checkbox" data-sound-sfx></label><label><span class="sound-volume-title">音效音量<output data-sound-sfx-percent></output></span><input type="range" data-sound-sfx-volume min="0" max="100" step="1" aria-label="网页音效音量"></label><button type="button" data-sound-sfx-preview>试听网页音效</button><label class="sound-switch"><span>到账播报</span><input type="checkbox" data-sound-income></label><label>连续到账<select data-sound-mode><option value="merge">累计合并后播放</option><option value="queue">按顺序依次播放</option><option value="interrupt">打断当前播报，立即播放最新一笔</option></select></label><label>语音音量<input type="range" data-sound-volume min="0" max="100" step="5" aria-label="到账语音音量"></label><button type="button" data-sound-preview>试听到账语音</button><p class="ui-help-note" data-sound-status role="status"></p></div>`)}
   ${dialog('hud-tools','背景商城',`<fieldset class="hud-backgrounds"><legend>公司首页</legend>${backgrounds.map(([key,label])=>`<button type="button" data-hud-background="${key}" aria-pressed="false"><img class="hud-background-cover" src="/assets/${key==='image'?'entrance-clean.1cb8cb71ca1d.webp':'gateway-sphere-preview.svg'}" alt="" loading="lazy"><span>${label}</span><b data-hud-shop-state></b></button>`).join('')}</fieldset><fieldset class="hud-patterns hud-shop-patterns"><legend>个人面板</legend>${patterns.map(([key,label])=>`<button type="button" data-hud-pattern="${key}" aria-pressed="false"><i class="hud-pattern-sample hud-pattern-${key}" aria-hidden="true"></i><span>${label}</span><b data-hud-shop-state></b></button>`).join('')}</fieldset><fieldset class="hud-interface-effects"><legend>界面效果</legend><button type="button" class="hud-contamination-toggle" data-hud-contamination aria-pressed="false"><span>污染模式</span><b data-hud-contamination-state>已关闭</b></button></fieldset>`)}
   ${dialog('hud-account','账户操作',`<p>员工编号：${esc(String(u.id).padStart(4,'0'))}</p><p>将账户余额归零至 0 ¤；负债由公司爱心基金承担。</p><button type="button" class="hud-danger" data-hud-zero>清零</button>`)}
   ${dialog('hud-confirm','确认操作',`<p data-hud-confirm-copy></p><div class="hud-dialog-actions"><button type="button" data-hud-close autofocus>取消</button><button type="button" class="hud-danger" data-hud-confirm>确认</button></div>`)}
  `;
  window.AVEDContainmentAccess?.decorate(root,u);
  const identityBlock=document.createElement('div');identityBlock.className='hud-identity-block';
  const avatar=root.querySelector('.hud-avatar'),nameRow=root.querySelector('.hud-name-row');avatar.before(identityBlock);identityBlock.append(avatar,nameRow);
  const optics=root.querySelector('[data-hud-optics]'),channel=root.querySelector('[data-hud-channel]'),matrix=root.querySelector('[data-hud-matrix]');
  const accountLayout=document.createElement('div');accountLayout.className='hud-account-layout';const register=root.querySelector('.hud-register');register.before(accountLayout);accountLayout.append(register,channel);
  const quickStack=document.createElement('div');quickStack.className='hud-quick-stack';const controls=root.querySelector('.hud-controls');controls.before(quickStack);quickStack.append(controls);
  function placeWave(){const mobile=root.clientWidth<500;if(root.classList.contains('hud-wave-in-header')!==mobile)root.classList.toggle('hud-wave-in-header',mobile);const target=mobile?quickStack:accountLayout;if(channel.parentElement!==target)target.append(channel);}
  const layoutObserver=new ResizeObserver(placeWave);layoutObserver.observe(root);placeWave();
  const opticalStrip=document.createElement('div');opticalStrip.className='hud-system-strip';opticalStrip.innerHTML='<span class="hud-system-copy" aria-hidden="true"><span lang="en">OPTICAL ARRAY</span><small lang="en">PHOSPHOR / LOCAL INTERFACE</small></span>';opticalStrip.append(optics);root.querySelector('.hud-instruments').after(opticalStrip);
  const matrixStrip=document.createElement('div');matrixStrip.className='hud-matrix-strip';matrixStrip.innerHTML='<span class="hud-system-copy" aria-hidden="true"><span lang="en">ARCHIVE INTERFACE</span><small lang="en">INDEX / SIGNAL PATTERNS</small></span>';matrixStrip.append(matrix);root.querySelector('.hud-log-grid').after(matrixStrip);
  root.querySelector('.hud-telemetry').remove();
  const active=()=>serial===version&&getUser()?.id===uid&&root.isConnected,visible=()=>active()&&!document.hidden&&!root.classList.contains('hidden');
  const intrusion=u.identityKind==='player_containment'?document.createElement('div'):null;
  if(intrusion){intrusion.className='hud-intrusion';root.querySelector('.hud-balance-row').append(intrusion);}
  const intrusionControl=intrusion?window.AVEDIntrusion?.mount(intrusion):null;
  let rewards=null,received=0,lastRead=0,reading=false,claiming=false,confirmAction=null,avatarURL='',shopReading=false;
  function open(id,trigger){sync();const d=byId(id);d._trigger=trigger||document.activeElement;d.showModal();}
  function close(d){d.close();d._trigger?.focus?.();}
  function confirm(copy,task,label='确认'){confirmAction=task;byId('hud-confirm').querySelector('[data-hud-confirm]').textContent=label;byId('hud-confirm').querySelector('[data-hud-confirm-copy]').textContent=copy;open('hud-confirm');}
  for(const d of root.querySelectorAll('dialog')){d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close(d);}});d.addEventListener('close',()=>{if(d.id==='hud-confirm')confirmAction=null;});}
  const voiceController=window.AVEDIncomeVoice,soundDialog=byId('hud-sound');
  function syncSound(){
   if(!active()||!voiceController)return;
   const settings=voiceController.settings(),status=voiceController.status();
   soundDialog.querySelector('[data-sound-sfx]').checked=byId('audio-sfx-btn')?.getAttribute('aria-pressed')==='true';
   const sfxVolume=Math.round((window.AVEDWebSound?.volume()??.75)*100);
   soundDialog.querySelector('[data-sound-sfx-volume]').value=sfxVolume;
   soundDialog.querySelector('[data-sound-sfx-percent]').textContent=sfxVolume+'%';
   soundDialog.querySelector('[data-sound-sfx-preview]').disabled=!window.AVEDWebSound?.enabled()||sfxVolume===0;
   soundDialog.querySelector('[data-sound-income]').checked=settings.enabled;
   soundDialog.querySelector('[data-sound-mode]').value=settings.mode;
   soundDialog.querySelector('[data-sound-volume]').value=Math.round(settings.volume*100);
   soundDialog.querySelector('[data-sound-status]').textContent=status.error||'';
  }
  soundDialog.oninput=e=>{if(e.target.hasAttribute('data-sound-sfx-volume')){window.AVEDWebSound?.setVolume(Number(e.target.value)/100);syncSound();}};
  soundDialog.onchange=e=>{const target=e.target;
   if(target.hasAttribute('data-sound-sfx')){if(target.checked!==(byId('audio-sfx-btn').getAttribute('aria-pressed')==='true'))byId('audio-sfx-btn').click();sync();return;}
   if(target.hasAttribute('data-sound-sfx-volume')){window.AVEDWebSound?.setVolume(Number(target.value)/100);syncSound();return;}
   if(!voiceController)return;
   if(target.hasAttribute('data-sound-income'))voiceController.update({enabled:target.checked});
   if(target.hasAttribute('data-sound-mode'))voiceController.update({mode:target.value});
   if(target.hasAttribute('data-sound-volume'))voiceController.update({volume:Number(target.value)/100});
  };
  const stopVoiceSubscription=voiceController?.subscribe(syncSound)||(()=>{});
  function sync(){
   if(!active())return;
   const fx=window.AVEDEffectsEnabled?.()!==false,muted=byId('audio-sfx-btn')?.getAttribute('aria-pressed')!=='true';
   const fxButton=root.querySelector('[data-hud-fx]');fxButton.setAttribute('aria-pressed',String(fx));fxButton.setAttribute('aria-label',fx?'关闭特效':'开启特效');root.querySelector('[data-hud-fx-label]').textContent=fx?'特效开启':'特效关闭';
   root.querySelector('[data-hud-fx-icon]').classList.toggle('hud-icon-off',!fx);
   const pollution=window.AVEDContamination?.enabled()===true,contaminationButton=root.querySelector('[data-hud-contamination]'),effectState=window.AVEDAppearance?.entitlements?.effects;
   const effectOwned=effectState?.owned.includes('contamination')===true,effectPrice=effectState?.prices.contamination??(u.identityKind==='player_containment'?100000:500000);
   contaminationButton.disabled=shopReading;contaminationButton.setAttribute('aria-pressed',String(pollution));contaminationButton.querySelector('[data-hud-contamination-state]').textContent=effectOwned?(pollution?'已开启':'已关闭'):money(effectPrice);
   contaminationButton.setAttribute('aria-label',effectOwned?'污染模式，'+(pollution?'已开启':'已关闭'):'污染模式，购买 '+effectPrice.toLocaleString()+' ¤');
   const sound=root.querySelector('[data-hud-sound]');sound.removeAttribute('aria-pressed');sound.setAttribute('aria-label','声音设置');root.querySelector('[data-hud-sound-label]').textContent='声音设置';syncSound();
   const soundIcon=root.querySelector('[data-hud-sound-icon]');if(soundIcon.dataset.state!==String(muted)){soundIcon.innerHTML=icon(muted?'sound':'soundOn');soundIcon.dataset.state=String(muted);}
   root.querySelectorAll('[data-hud-palette]').forEach(b=>{const key=b.dataset.hudPalette,selected=key===document.documentElement.dataset.palettePreview,owned=window.AVEDAppearance?.entitlements?.owned.includes(key)||key==='oxblood';b.setAttribute('aria-pressed',String(selected));b.querySelector('b').textContent=selected?'✓':owned?'已购':(window.AVEDAppearance?.entitlements?.prices[key]??50000).toLocaleString()+' ¤';const palette=window.AVEDAppearance?.palettes[key];b.setAttribute('aria-label',palette.name+(owned?'，已购':'，购买 '+(window.AVEDAppearance?.entitlements?.prices[key]??50000).toLocaleString()+' ¤'));palette?.[document.body.classList.contains('dark-mode')?'night':'day'].forEach((c,i)=>b.querySelectorAll('i')[i].style.setProperty('--chip',c));});
   for(const [kind,catalog] of [['background',backgrounds],['pattern',patterns]])for(const [key,name,fallbackPrice] of catalog){
    const button=root.querySelector(`[data-hud-${kind}="${key}"]`),state=window.AVEDAppearance?.entitlements?.[kind==='background'?'backgrounds':'patterns'];
    const owned=fallbackPrice===0||state?.owned.includes(key),price=state?.prices[key]??fallbackPrice,selected=owned&&key===(kind==='background'?window.AVEDGateway?.selected:document.body.dataset.terminalPattern);
    button.disabled=shopReading;button.setAttribute('aria-pressed',String(Boolean(selected)));
    button.querySelector('[data-hud-shop-state]').textContent=selected?'使用中':owned?(fallbackPrice===0?'免费 · 使用':'已购 · 使用'):money(price);
    button.setAttribute('aria-label',name+(selected?'，使用中':owned?'，点击使用':'，购买 '+price.toLocaleString()+' ¤'));
   }
  }
  async function readShop(){if(shopReading)return;shopReading=true;sync();try{const d=await api('/api/player/appearance');if(!active())return;getProfile().appearance=d.appearance;window.AVEDAppearance.setEntitlements(d.appearance);onBalance(d.balance);}catch(e){if(active())showToast(e.message);}finally{shopReading=false;sync();}}
  function startContamination(){window.AVEDContamination.setEnabled(true);sync();close(byId('hud-tools'));}
  async function confirmContamination(){close(byId('hud-tools'));if(await window.AVEDContamination.confirmStart())if(active())startContamination();}
  function selectShopItem(kind,key){if(kind==='background'){const result=window.AVEDGateway.select(key);if(!result)throw Error('请先购买此背景。');if(!result.saved)showToast('背景已切换，但浏览器未允许保存设置。');}else window.AVEDAppearance.setPattern(key);sync();}
  function chooseShopItem(kind,key){
   if(shopReading)return;const catalog=kind==='background'?backgrounds:patterns,item=catalog.find(x=>x[0]===key);if(!item)return;
   const [,name,fallbackPrice]=item,state=window.AVEDAppearance.entitlements?.[kind==='background'?'backgrounds':'patterns'];
   if(fallbackPrice===0||state?.owned.includes(key)){selectShopItem(kind,key);return;}
   const price=state?.prices[key]??fallbackPrice;
   confirm(`花费 ${price.toLocaleString()} ¤购买「${name}」并使用？`,async()=>{
    const d=await api('/api/player/appearance',{method:'POST',body:{[kind]:key}});if(!active())return;
    getProfile().appearance=d.appearance;window.AVEDAppearance.setEntitlements(d.appearance);onBalance(d.balance);selectShopItem(kind,key);
   },'购买并使用');
  }
  async function readRewards(){if(reading||!visible())return;intrusionControl?.refresh();reading=true;lastRead=Date.now();try{const d=await api('/api/player/rewards');if(active()){rewards=d;received=performance.now();paintRewards();}}catch{if(active())for(const kind of ['daily','hourly']){root.querySelector(`[data-hud-${kind}-label]`).textContent='重试';root.querySelector(`[data-hud-${kind}]`).disabled=false;}}finally{reading=false;}}
  const duration=ms=>{const n=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
  function paintRewards(){if(!rewards||!active())return;const now=rewards.serverTime+performance.now()-received;for(const kind of ['daily','hourly']){const claimed=Boolean(rewards[kind+'Claimed']);root.querySelector(`[data-hud-${kind}]`).dataset.claimed=String(claimed);root.querySelector(`[data-hud-${kind}]`).disabled=claiming||claimed;root.querySelector(`[data-hud-${kind}]`).setAttribute('aria-busy',String(claiming));root.querySelector(`[data-hud-${kind}-label]`).textContent=claimed?'已领取':'领取';root.querySelector(`[data-hud-${kind}-note]`).textContent=claimed?duration(rewards[kind+'ResetAt']-now):kind==='daily'?money(rewards.dailyReward)+' / 日':money(rewards.hourlyReward)+' / 小时';}if(now>=Math.min(rewards.dailyResetAt,rewards.hourlyResetAt)&&Date.now()-lastRead>2000)readRewards();}
  async function claim(kind){if(claiming)return;if(!rewards){await readRewards();return;}claiming=true;paintRewards();try{if(kind==='daily')await onDailyCheckin();else{const d=await api('/api/player/rewards/hourly',{method:'POST'});if(active()){onBalance(d.balance);showToast(d.reward?'整点补给已入账 '+money(d.reward):'本时段已领取。',d.reward?'success':'info');}}if(active()){await readRewards();window.AVEDRewardsRefresh?.().catch(()=>{});}}catch(e){if(active())showToast(e.message);}finally{claiming=false;paintRewards();}}
  root.onclick=e=>{const b=e.target.closest('button');if(!b||!root.contains(b))return;
   if(b.hasAttribute('data-hud-close'))return close(b.closest('dialog'));
   if(b.dataset.hudOpen){open(b.dataset.hudOpen,b);if(b.dataset.hudOpen==='hud-tools')void readShop();if(b.hasAttribute('data-hud-alias'))byId('cloud-profile-form').elements.anonymousName.focus();if(b.hasAttribute('data-hud-bio'))byId('cloud-profile-form').elements.bio.focus();return;}
   if(b.dataset.hudPreview){const key=b.dataset.hudPreview,palette=window.AVEDAppearance.palettes[key];byId('hud-palette-preview-title').textContent=palette.name+' · 配色预览';for(const sample of root.querySelectorAll('[data-preview-mode]')){const mode=sample.dataset.previewMode,colors=palette[mode];sample.style.setProperty('--sample-base',colors[0]);sample.style.setProperty('--sample-ink',mode==='night'?colors[1]:colors[3]);sample.style.setProperty('--sample-accent',colors[2]);sample.style.setProperty('--sample-face',mode==='night'?'color-mix(in srgb,'+colors[0]+' 88%,'+colors[1]+' 12%)':colors[1]);}close(byId('hud-palette'));open('hud-palette-preview');return;}
   if(b.hasAttribute('data-preview-back')){close(byId('hud-palette-preview'));open('hud-palette');return;}
   if(b.dataset.hudPalette){const key=b.dataset.hudPalette,appearance=window.AVEDAppearance;close(byId('hud-palette'));if(appearance.entitlements?.owned.includes(key)||key==='oxblood'){appearance.setPalette(key);sync();return;}const name=appearance.palettes[key].name,price=appearance.entitlements?.prices[key]??50000;confirm(`花费 ${price.toLocaleString()} ¤购买「${name}」？`,async()=>{const d=await api('/api/player/appearance',{method:'POST',body:{palette:key}});if(!active())return;getProfile().appearance=d.appearance;onBalance(d.balance);appearance.setEntitlements(d.appearance);appearance.setPalette(key);sync();showToast('已购入「'+name+'」。');},'购买');return;}
   if(b.dataset.hudBackground){chooseShopItem('background',b.dataset.hudBackground);return;}
   if(b.dataset.hudPattern){chooseShopItem('pattern',b.dataset.hudPattern);return;}
   if(b.hasAttribute('data-hud-contamination')){
    if(shopReading)return;
    if(window.AVEDAppearance?.entitlements?.effects?.owned.includes('contamination')){if(window.AVEDContamination.enabled()){close(byId('hud-tools'));window.AVEDContamination.requestDisable().then(()=>{if(active())sync();});}else confirmContamination();return;}
    close(byId('hud-tools'));
    window.AVEDContamination.confirmStart().then(async confirmed=>{if(!confirmed||!active())return;
     const d=await api('/api/player/appearance',{method:'POST',body:{effect:'contamination',confirmed:true}});if(!active())return;
     getProfile().appearance=d.appearance;window.AVEDAppearance.setEntitlements(d.appearance);onBalance(d.balance);startContamination();window.AVEDHaunt?.purchaseWarning();
    }).catch(e=>showToast(e.message));return;
   }
   if(b.hasAttribute('data-hud-fx')){window.AVEDSetEffects(!window.AVEDEffectsEnabled());sync();return;}
   if(b.hasAttribute('data-hud-sound')){open('hud-sound',b);window.AVEDIncomeVoice?.prepare();return;}
   if(b.hasAttribute('data-sound-sfx-preview')){window.AVEDWebSound?.preview();return;}
   if(b.hasAttribute('data-sound-preview')){window.AVEDIncomeVoice?.preview();return;}
   if(b.hasAttribute('data-hud-daily'))return void claim('daily');if(b.hasAttribute('data-hud-hourly'))return void claim('hourly');
   if(b.hasAttribute('data-hud-zero')){confirm(`将账户余额归零至 0 ¤。正余额会清空，负债由公司爱心基金承担。`,async()=>{const d=await api('/api/player/balance/zero',{method:'POST'});if(active()){onBalance(d.balance);close(byId('hud-account'));showToast('账户余额已归零。');}},'确认清零');return;}
   if(b.hasAttribute('data-hud-confirm')){const task=confirmAction;if(!task||b.disabled)return;b.disabled=true;Promise.resolve().then(task).then(()=>{if(active())close(byId('hud-confirm'));}).catch(e=>showToast(e.message)).finally(()=>{b.disabled=false;});}
  };
  const avatarForm=byId('cloud-profile-form'),mode=avatarForm.elements.avatarMode;mode.onchange=()=>{root.querySelector('.avatar-preset-options').hidden=mode.value!=='pixel';};
  const syncLoginFields=()=>{const changingName=avatarForm.elements.username.value.trim()!==(u.account||''),changingPassword=!!avatarForm.elements.password.value;root.querySelector('[data-hud-password-confirm]').hidden=!changingPassword;root.querySelector('[data-hud-password-current]').hidden=!changingName&&!changingPassword;avatarForm.elements.currentPassword.required=changingName||changingPassword;avatarForm.elements.passwordConfirmation.required=changingPassword;};
  avatarForm.elements.username.addEventListener('input',syncLoginFields);avatarForm.elements.password.addEventListener('input',syncLoginFields);syncLoginFields();
  byId('hud-edit').addEventListener('close',()=>{avatarForm.elements.username.value=u.account||'';for(const name of ['password','passwordConfirmation','currentPassword'])avatarForm.elements[name].value='';syncLoginFields();});
  const file=byId('cloud-profile-form').elements.avatar;let avatarSelection=0;
  file.onchange=async()=>{
   const selection=++avatarSelection,chosen=file.files[0],img=root.querySelector('[data-avatar-preview]');
   if(avatarURL){URL.revokeObjectURL(avatarURL);avatarURL=null;}img.hidden=true;
   if(!chosen)return;
   try{const prepared=await AVEDImageUpload.prepare(chosen,{kind:'avatar'});if(selection!==avatarSelection||!active())return;avatarURL=URL.createObjectURL(prepared);img.src=avatarURL;img.hidden=false;}
   catch(error){if(selection!==avatarSelection||!active())return;file.value='';showToast(error.message||'头像处理失败，请换一张图片。');}
  };
  for(const drawer of root.querySelectorAll('[data-hud-log]')){let loaded=false,busy=false,cursor=null;const box=drawer.querySelector('[data-log-items]'),more=drawer.querySelector('[data-log-more]');async function load(){if(busy)return;busy=true;more.disabled=true;box.setAttribute('aria-busy','true');if(!loaded)box.textContent='调阅中…';try{const kind=drawer.dataset.hudLog,d=await api('/api/player/'+kind+(cursor?'?before='+encodeURIComponent(cursor):''));if(!active()||!drawer.isConnected)return;if(!loaded)box.replaceChildren();for(const h of d.items){const row=document.createElement('article');row.className='hud-list-row';row.innerHTML=kind==='ledger'?`<span>${esc(String(h.reason).replace(/^(scratch|slot|sky|derby|cards)(?=投入|奖金)/,key=>games[key]))}</span><strong>${h.delta>0?'+':''}${money(h.delta)}</strong>`:`<span>${esc(games[h.game]||h.game)}</span><strong>投入 ${money(h.cost)} / 返还 ${money(h.prize)}${h.penalty>0?` / 追加扣款 ${money(h.penalty)}`:''}</strong>`;row.insertAdjacentHTML('beforeend',`<small>${AVEDTime.markup(h.createdAt)}</small>`);box.append(row);}loaded=true;cursor=d.next;more.hidden=!cursor;more.textContent='更多记录';}catch(e){if(active()){if(!loaded)box.textContent='';more.hidden=false;more.textContent='重新调阅';showToast(e.message);}}finally{busy=false;more.disabled=false;box.setAttribute('aria-busy','false');}}drawer.addEventListener('toggle',()=>{if(drawer.open&&!loaded)load();});more.onclick=load;}
  const observer=new MutationObserver(()=>{sync();paintRewards();});for(const n of [byId('audio-sfx-btn'),byId('header-quick-checkin-btn'),document.body,document.documentElement])if(n)observer.observe(n,{attributes:true,attributeFilter:['aria-pressed','disabled','class','data-palette-preview','data-theme-mode']});
  const hideObserver=new MutationObserver(()=>{if(!visible()){for(const d of root.querySelectorAll('dialog[open]'))d.close();}else readRewards();});hideObserver.observe(root,{attributes:true,attributeFilter:['class']});
  const tick=()=>{if(!visible())return;const now=new Date();root.querySelector('[data-hud-clock]').textContent=now.toLocaleTimeString('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'});root.querySelector('[data-hud-date]').textContent=now.toLocaleDateString('en-GB',{timeZone:'Asia/Shanghai',day:'2-digit',month:'2-digit'});paintRewards();if(Date.now()-lastRead>30000)readRewards();};
  const stopTyping=typeLine(root.querySelector('[data-hud-typed]'),visible,uid);
  const stopConsole=terminalConsole(root.querySelector('[data-hud-console]'),visible);
  const stopInstruments=instruments(root,visible);
  const timer=setInterval(tick,1000),stop=particles(byId('hud-particles'),visible);sync();tick();
  cleanup=()=>{intrusionControl?.destroy();stopVoiceSubscription();clearInterval(timer);layoutObserver.disconnect();observer.disconnect();hideObserver.disconnect();stopTyping();stopConsole();stopInstruments();stop();if(avatarURL)URL.revokeObjectURL(avatarURL);for(const d of root.querySelectorAll('dialog[open]'))d.close();root.onclick=null;};
 }
 function terminalConsole(node,visible){
  const messages=['> READ FILE','PERSONNEL.DAT','OPEN / LOCAL','BUFFER READY','> SYNC FRAME','PHOSPHOR / ON','SCANLINE / 01','> READ INDEX','RENDER GLYPHS','CURSOR / WAIT','> HOLD LINK','CHANNEL READY','> LOAD BLOCK','IDENTITY / OK','> TRACE GRID','LOCAL CONSOLE','DISPLAY / ON','> KEEP ALIVE','BUFFER CLEAR','> NEXT FRAME'];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let timer=0,disposed=false,lineIndex=0,charIndex=0,current=null;
  const allowed=()=>visible()&&window.AVEDEffectsEnabled?.()!==false&&!reduced.matches;
  function line(text=''){const el=document.createElement('span');el.lang='en';el.dataset.typeRun='en';el.textContent=text;node.append(el);while(node.children.length>18)node.firstElementChild.remove();return el;}
  function scroll(){node.scrollTop=node.scrollHeight;}
  function staticView(){if(!node.children.length){messages.slice(0,6).forEach(text=>line(text));scroll();}if(current)current.dataset.typing='complete';}
  function tick(){timer=0;if(disposed||!allowed())return;
   if(!current){current=line();current.dataset.typing='active';charIndex=0;}
   const message=messages[lineIndex%messages.length];current.textContent=message.slice(0,++charIndex);scroll();
   if(charIndex>=message.length){current.dataset.typing='complete';current=null;lineIndex++;timer=setTimeout(tick,950);}else timer=setTimeout(tick,190);
  }
  function sync(){clearTimeout(timer);timer=0;if(disposed)return;if(!allowed()){if(window.AVEDEffectsEnabled?.()===false||reduced.matches)staticView();return;}if(current)current.dataset.typing='active';timer=setTimeout(tick,500);}
  const state=new MutationObserver(sync);state.observe(node.closest('#view-profile'),{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);document.addEventListener('aved-effects-change',sync);reduced.addEventListener('change',sync);sync();
  return()=>{disposed=true;clearTimeout(timer);state.disconnect();document.removeEventListener('visibilitychange',sync);document.removeEventListener('aved-effects-change',sync);reduced.removeEventListener('change',sync);};
 }
 function typeLine(node,visible,uid,variant='boot'){
  const lines=node.hasAttribute('data-hud-console')?[...node.querySelectorAll('[data-hud-text]')]:[node],texts=lines.map(line=>line.dataset.hudText),text=texts.join('\n');
  const key='aved_hud_typing_v1:'+uid+(variant==='boot'?'':':'+variant+'-2'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let index=typedProgress.get(key)||0,timer=0,disposed=false;
  try{if(sessionStorage.getItem(key)==='done')index=text.length;}catch{}
  const runs=lines.map(line=>{const run=document.createTextNode('');line.append(run);return run;});
  function paint(){let offset=0;for(let i=0;i<runs.length;i++){const n=Math.max(0,Math.min(texts[i].length,index-offset));runs[i].data=texts[i].slice(0,n);if(lines.length>1)lines[i].dataset.typing=index>=offset&&index<offset+texts[i].length?'active':'complete';if(variant==='console'&&lines[i].dataset.typing==='active')node.scrollTop=Math.max(0,lines[i].offsetTop-node.clientHeight+28);offset+=texts[i].length+1;}}
  function finish(){index=text.length;paint();if(variant==='console')node.scrollTop=node.scrollHeight;typedProgress.set(key,index);node.dataset.typing='complete';clearTimeout(timer);timer=0;try{sessionStorage.setItem(key,'done');}catch{}}
  const pace=variant==='console'?180:46;
  function step(){timer=0;if(disposed||!visible())return;index++;paint();typedProgress.set(key,index);if(index>=text.length)finish();else timer=setTimeout(step,pace);}
  function sync(){clearTimeout(timer);timer=0;if(disposed)return;if(index>=text.length||reduced.matches||window.AVEDEffectsEnabled?.()===false){finish();return;}node.dataset.typing='active';paint();if(visible())timer=setTimeout(step,index?pace:600);}
  const observer=new MutationObserver(sync);observer.observe(node.closest('#view-profile'),{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);document.addEventListener('aved-effects-change',sync);reduced.addEventListener('change',sync);sync();
  return()=>{disposed=true;clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',sync);document.removeEventListener('aved-effects-change',sync);reduced.removeEventListener('change',sync);};
 }
 function instruments(root,visible){
  const optics=root.querySelector('[data-hud-optics]'),channel=root.querySelector('[data-hud-channel]'),matrix=root.querySelector('[data-hud-matrix]'),bars=[...optics.querySelectorAll('i')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),surfaces=[];
  let frame=0,last=0,phase=0,held=false,waveMode=0,matrixMode=0,color='',accent='';
  const pointer={optics:null,channel:null,matrix:null};
  function surface(selector){const canvas=root.querySelector(selector),ctx=canvas?.getContext('2d');if(!ctx)return null;const item={canvas,ctx,w:1,h:1};surfaces.push(item);return item;}
  const wave=surface('[data-hud-wave]'),dots=surface('[data-hud-matrix-canvas]');
  const allowed=()=>visible()&&window.AVEDEffectsEnabled?.()&&!reduced.matches;
  function grid(s){const {ctx:c,w,h}=s;c.clearRect(0,0,w,h);c.strokeStyle=color;c.globalAlpha=.16;c.lineWidth=.5;c.beginPath();for(let x=0;x<w;x+=12){c.moveTo(x,0);c.lineTo(x,h);}for(let y=0;y<h;y+=12){c.moveTo(0,y);c.lineTo(w,y);}c.stroke();c.globalAlpha=.4;c.setLineDash([2,3]);c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
  function paint(){
   if(!held){const point=pointer.optics;bars.forEach((b,i)=>{const peak=.16+.78*Math.abs(Math.sin(phase*1.5+i*.63)*Math.cos(phase*.37+i*.21));const influence=point?Math.max(0,1-Math.abs(i/Math.max(1,bars.length-1)-point.x)*2)*.35:0;b.style.height=Math.min(1,peak+influence)*19+'px';b.style.opacity=String(.35+peak*.6);});}
   if(wave){grid(wave);const {ctx:c,w,h}=wave,point=pointer.channel,amplitude=h*(point ? .12+(1-point.y)*.32 : .3);
    for(let trace=2;trace>=0;trace--){c.beginPath();c.lineWidth=trace? .6:1.2;c.globalAlpha=trace?.13:1;c.strokeStyle=trace?color:accent;
     for(let x=0;x<=w;x+=2){const a=x/Math.max(1,w)*Math.PI*(point?4+point.x*7:5)-phase*2+trace*.25;const y=h/2+(waveMode===0?Math.sin(a):waveMode===1?Math.tanh(Math.sin(a)*6):2/Math.PI*Math.asin(Math.sin(a)))*amplitude*(1-trace*.13);if(x)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();}
    const cursor=(phase*.065%1)*w;c.globalAlpha=.35;c.strokeStyle=accent;c.beginPath();c.moveTo(cursor,0);c.lineTo(cursor,h);c.stroke();c.fillRect(cursor-1,1,3,3);c.globalAlpha=1;
   }
   if(dots){const {ctx:c,w,h}=dots;c.clearRect(0,0,w,h);const p=pointer.matrix;for(let y=3;y<h;y+=5)for(let x=3;x<w;x+=5){const nx=x/Math.max(w,1),ny=y/Math.max(h,1),dist=Math.hypot(nx-.5,(ny-.5)*.5),scan=matrixMode===0?Math.max(0,1-Math.abs(nx-(phase*.15%1))*7):matrixMode===1?Math.max(0,Math.cos(dist*20-phase*2)):Math.max(0,Math.sin(x*.31+y*.53+phase));const touch=p?Math.max(0,1-Math.hypot((nx-p.x)*2,ny-p.y)*2):0;const light=Math.max(scan,touch);c.globalAlpha=.18+light*.82;c.fillStyle=light>.65?accent:color;c.fillRect(x,y,light>.8?2:1.3,light>.8?2:1.3);}c.globalAlpha=1;}
  }
  function tick(now){frame=0;if(!allowed())return;if(now-last>=85){phase+=.09;paint();last=now;}frame=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(frame);frame=0;const css=getComputedStyle(root);color=css.getPropertyValue('--inner-text-main').trim()||'#aaa';accent=css.getPropertyValue('--inner-crimson').trim()||color;paint();if(allowed())frame=requestAnimationFrame(tick);}
  const listeners=[];
  function bind(target,type,fn){target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));}
  for(const [name,button] of [['optics',optics],['channel',channel],['matrix',matrix]]){
   bind(button,'pointermove',e=>{const r=button.getBoundingClientRect();pointer[name]={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};if(!allowed())paint();});
   bind(button,'pointerleave',()=>{pointer[name]=null;});
  }
  bind(optics,'click',()=>{held=!held;optics.setAttribute('aria-pressed',String(held));optics.querySelector('[data-hud-optics-state]').textContent=held?'HOLD':'SCAN';optics.setAttribute('aria-label',held?'光电频谱已暂停，点击继续':'光电频谱：点击暂停或继续');paint();});
  bind(channel,'click',()=>{waveMode=(waveMode+1)%3;channel.querySelector('[data-hud-channel-state]').textContent=['SIN','PLS','TRI'][waveMode];channel.setAttribute('aria-label','通道示波：'+['正弦波','脉冲波','三角波'][waveMode]+'，点击切换');paint();});
  bind(matrix,'click',()=>{matrixMode=(matrixMode+1)%3;matrix.querySelector('[data-hud-matrix-state]').textContent=['GRID','RING','NOISE'][matrixMode];matrix.setAttribute('aria-label','点阵扫描：'+['网格','环形','噪点'][matrixMode]+'，点击切换');paint();});
  const resize=new ResizeObserver(()=>{const ratio=Math.min(2,devicePixelRatio||1);for(const s of surfaces){s.w=s.canvas.clientWidth;s.h=s.canvas.clientHeight;s.canvas.width=Math.max(1,Math.round(s.w*ratio));s.canvas.height=Math.max(1,Math.round(s.h*ratio));s.ctx.setTransform(ratio,0,0,ratio,0,0);}sync();});for(const s of surfaces)resize.observe(s.canvas);
  const observer=new MutationObserver(sync);for(const node of [root,document.body,document.documentElement])observer.observe(node,{attributes:true,attributeFilter:['class','data-palette-preview','data-theme-mode']});
  bind(document,'visibilitychange',sync);bind(document,'aved-effects-change',sync);bind(reduced,'change',sync);sync();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();listeners.forEach(stop=>stop());};
 }

 function particles(canvas,visible){
  const ctx=canvas.getContext('2d');if(!ctx)return()=>{};let frame=0,w=1,h=1,t=0,last=0,pointer=null,disposed=false,inView=true,stars=[];const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let ink='';
  function seed(){stars=Array.from({length:Math.min(620,Math.max(180,Math.round(w*h/105)))},()=>{const z=.45+Math.random()*1.15;return{x:(Math.random()-.5)*z,y:(Math.random()-.5)*z,z,size:Math.random(),phase:Math.random()*Math.PI*2};});}
  function draw(){
   ctx.clearRect(0,0,w,h);ctx.fillStyle=ink;ctx.strokeStyle=ink;
   const dx=pointer?(pointer.x-w/2)*.025:0,dy=pointer?(pointer.y-h/2)*.025:0;
   for(const s of stars){const x=w*(.5+s.x/s.z)+dx/s.z,y=h*(.5+s.y/s.z)+dy/s.z,size=.35+s.size*.65+.3/s.z;
    const light=(.25+s.size*.5)*(.8+.2*Math.sin(t*.8+s.phase));ctx.globalAlpha=light;ctx.fillRect(x-size/2,y-size/2,size,size);
    if(s.size>.94){ctx.globalAlpha=light*.12;ctx.fillRect(x-2.5,y-2.5,5,5);ctx.globalAlpha=light*.4;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x-3.5,y);ctx.lineTo(x+3.5,y);ctx.moveTo(x,y-3.5);ctx.lineTo(x,y+3.5);ctx.stroke();}
   }ctx.globalAlpha=1;
  }
  const allowed=()=>!disposed&&inView&&visible()&&window.AVEDEffectsEnabled?.()!==false&&!reduced.matches;
  function tick(now){frame=0;if(!allowed())return;if(!last||now-last>=40){const dt=last?Math.min(.08,(now-last)/1000):0;last=now;t+=dt;for(const s of stars){s.z-=dt*.018;if(s.z<.25||Math.abs(s.x/s.z)>.51||Math.abs(s.y/s.z)>.51){s.z=1.6;s.x=(Math.random()-.5)*s.z;s.y=(Math.random()-.5)*s.z;}}draw();}frame=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(frame);frame=0;last=0;if(disposed)return;ink=getComputedStyle(canvas).color;draw();if(allowed())frame=requestAnimationFrame(tick);}
  const resize=new ResizeObserver(()=>{const width=canvas.clientWidth,height=canvas.clientHeight;if(width===w&&height===h)return;w=width;h=height;const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);seed();sync();});resize.observe(canvas);
  const viewport=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();});viewport.observe(canvas);
  const state=new MutationObserver(sync);for(const node of [document.body,document.documentElement,canvas.closest('#view-profile')])state.observe(node,{attributes:true,attributeFilter:['class','data-palette-preview','data-theme-mode']});
  document.addEventListener('visibilitychange',sync);document.addEventListener('aved-effects-change',sync);reduced.addEventListener('change',sync);
  canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top};};canvas.onpointerleave=()=>pointer=null;sync();
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();viewport.disconnect();state.disconnect();canvas.onpointermove=null;canvas.onpointerleave=null;document.removeEventListener('visibilitychange',sync);document.removeEventListener('aved-effects-change',sync);reduced.removeEventListener('change',sync);};
 }
 return {render};
};
