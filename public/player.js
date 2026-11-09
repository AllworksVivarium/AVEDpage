
    (function() {
      // ======================================================================
      async function api(path,{method='GET',body,...options}={}) {
        return AVEDHttp.request(path,{method,...options,body:body?JSON.stringify(body):undefined});
      }
      const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      async function apiLogin(identifier,password,remember) {
        const result=await api('/api/login',{method:'POST',body:{identifier,password,remember},timeoutMs:15000,retries:0});
        return result;
      }
      async function apiLogout(){await api('/api/logout',{method:'POST'});}

      // ======================================================================
      // Button motion is shared by both terminals in interaction-motion.js.
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // ======================================================================
      // 1. 本机音效开关
      let audioSfxOn=true;try{audioSfxOn=localStorage.getItem('aved_sfx_v1')!=='off';}catch{}
      let audioCtx=null;
      function ensureAudioCtx() {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }

      function playSfx(type) {
        if (!audioSfxOn) return;
        try {
          ensureAudioCtx();
          if (!audioCtx) return;
          const now = audioCtx.currentTime;

          if(type.startsWith('sky-')){
            const wind=type==='sky-wind',open=type==='sky-open',crash=type==='sky-crash',duration=wind?1.2:open?.38:crash?.4:.25;
            const source=audioCtx.createBufferSource(),buffer=audioCtx.createBuffer(1,Math.ceil(audioCtx.sampleRate*duration),audioCtx.sampleRate),data=buffer.getChannelData(0);
            for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
            source.buffer=buffer;const filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();filter.type='lowpass';filter.frequency.setValueAtTime(wind?450:open?2400:crash?220:500,now);filter.frequency.exponentialRampToValueAtTime(wind?180:90,now+duration);
            gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(wind?.018:open?.11:crash?.13:.08,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);source.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();source.stop(now+duration);
          } else if(type.startsWith('scratch-bomb-')){
            window.AVEDScratchBomb?.sound(audioCtx,Number(type.split('-').at(-1)));
          } else if(type.startsWith('scratch-')){
            const tunes={'scratch-hit':[659,784],'scratch-zero':[330,247,165],'scratch-win':[523,784,1047],'scratch-win-all':[392,523,659,1047],
              'scratch-big':[523,659,784,1047,784,659,784,1047],
              'scratch-jackpot':[523,659,784,1047,784,1047,1319,1047,1319,1568],
              'scratch-jackpot-major':[659,784,988,1319,988,1319,1568,1319,1568,1976,1568,1976],
              'scratch-jackpot-supreme':[523,784,1047,1319,1568,2093,1568,1319,1568,2093,1568,2093,2637,2093],
              'scratch-record':[523,523,784,1047,784,1047,1319,1568,1319,1568,2093,1568]};
            const long=['scratch-big','scratch-jackpot','scratch-jackpot-major','scratch-jackpot-supreme','scratch-record'].includes(type),notes=tunes[type]||tunes['scratch-hit'],pitch=[.891,1,1.122][Math.floor(Math.random()*3)],step=long?.16:type==='scratch-hit'?.045:.09,duration=long?.38:.17;
            notes.forEach((freq,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),at=now+i*step;osc.type='square';osc.frequency.setValueAtTime(freq*pitch,at);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(long?.03:type==='scratch-hit'?.025:.04,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration+.02);});
          } else if (type === 'checkin' || type === 'win') {
            [523.25, 659.25, 783.99].forEach((freq, i) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, now + i * 0.08);
              gain.gain.setValueAtTime(0.11, now + i * 0.08);
              gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.22);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start(now + i * 0.08);
              osc.stop(now + i * 0.08 + 0.24);
            });
          } else if (type === 'crash') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.linearRampToValueAtTime(45, now + 0.35);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.4);
          } else if (type === 'scratch') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime([196,220,262,294,330][Math.floor(Math.random()*5)], now);
            gain.gain.setValueAtTime(0.045, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.07);
          } else if (type === 'click') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(460, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
          }
        } catch (err) {}
      }

      function updateSfxUI(){
        const button=document.getElementById('audio-sfx-btn');
        button.textContent=audioSfxOn?'音效开启':'音效关闭';button.setAttribute('aria-pressed',String(audioSfxOn));
        button.setAttribute('aria-label',audioSfxOn?'关闭音效':'开启音效');
      }
      document.getElementById('audio-sfx-btn').addEventListener('click',()=>{
        audioSfxOn=!audioSfxOn;try{localStorage.setItem('aved_sfx_v1',audioSfxOn?'on':'off');}catch{}
        if(!audioSfxOn&&audioCtx){const previous=audioCtx;audioCtx=null;previous.close().catch(()=>{});}
        updateSfxUI();if(audioSfxOn)playSfx('click');
      });
      updateSfxUI();

      // ======================================================================
      // 2. 全局二次确认弹窗
      // ======================================================================
      async function askSecondConfirmation(title, desc, onConfirm) {
        playSfx('click');
        if (await window.AVEDFeedback.confirm(desc, {title})) {
          if (typeof onConfirm === 'function') onConfirm();
        }
      }

      function fmtMoney(n) {
        return '¤ ' + Number(n || 0).toLocaleString('en-US');
      }

      function getTodayDateString() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      }

      function updateSystemClock() {
        const now = new Date();
        const pad = v => String(v).padStart(2, '0');
        const el = document.getElementById('system-realtime-clock');
        if (el) el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }
      updateSystemClock();
      setInterval(updateSystemClock, 1000);

      // 3. 预设员工数据（含各自持久化的签到日期 lastCheckinDate，确保每天严格只能签一次）
      const defaultEmployees = [];

      const departmentsData = [];

      // 内部红头通告数据
      const initialCompanyNews = [];

      function formatFuzzyDaysAgo(days) {
        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days === 2) return '前天';
        if (days === 3) return '三天前';
        return `${days}天前`;
      }

      // 收容物数据（含关联责任人姓名，支持在搜索栏按双人姓名检索）
      const initialScpItems = [];



      const initialForumThreads = [];

      const stocksData = [];
      const stockOrdersData = [];

      let employees = JSON.parse(JSON.stringify(defaultEmployees));
      let companyNews = JSON.parse(JSON.stringify(initialCompanyNews));
      let scpItemsData = JSON.parse(JSON.stringify(initialScpItems));

      let forumThreads = JSON.parse(JSON.stringify(initialForumThreads));
      let currentUser = null;
      let isDarkMode = document.documentElement.dataset.savedTheme==='night';
      document.body.classList.toggle('dark-mode',isDarkMode);
      let sidebarNarrow = window.innerWidth < 768;
      let isSidebarCollapsed = true;
      let selectedScpFilter = 'ALL';
      let scpSearchKeyword = '';
      let scpSimulatedEmpty = false;
      let selectedScpId = scpItemsData[0]?.id || null;
      let currentNewsId = null;
      let currentForumThreadId = null;
      let karmaIndexValue = 14820.50;
      let karmaIndexDelta = 2.45;

      try {
        localStorage.removeItem('aved_remembered_cred');
        localStorage.removeItem('aved_server_token');
        localStorage.removeItem('aved_daily_checkins');
        document.getElementById('login-username').value=localStorage.getItem('aved_username')||'';
      } catch {}
      const syncChannel=null;
      function broadcastForumSync(){}

      function getLiveBalanceByAuthorId(authorId) {
        const emp = employees.find(e => e.id === authorId);
        return emp ? emp.balance : 0;
      }




      function syncSidebarState() {
        const sidebar = document.getElementById('left-sidebar');
        const labels = sidebar.querySelectorAll('.sidebar-label');
        const arrow = document.getElementById('collapse-arrow-icon');

        if (isSidebarCollapsed) {
          sidebar.classList.remove('w-52');
          sidebar.classList.add('w-16');
          labels.forEach(l => l.classList.add('hidden'));
          if (arrow) arrow.textContent = '▶';
        } else {
          sidebar.classList.remove('w-16');
          sidebar.classList.add('w-52');
          labels.forEach(l => l.classList.remove('hidden'));
          if (arrow) arrow.textContent = '◀';
        }
        const toggle=document.getElementById('sidebar-toggle-btn');
        if(!toggle.querySelector('.sidebar-toggle-symbol'))toggle.innerHTML='<span class="sidebar-symbol sidebar-toggle-symbol" aria-hidden="true"></span><span class="sidebar-label"></span>';
        toggle.querySelector('.sidebar-label').textContent=isSidebarCollapsed?'展开边栏':'收起边栏';
        toggle.setAttribute('aria-expanded',String(!isSidebarCollapsed));
        toggle.setAttribute('aria-label',isSidebarCollapsed?'展开边栏':'收起边栏');
        toggle.title=isSidebarCollapsed?'展开边栏':'收起边栏';
        const drawerOpen = !isSidebarCollapsed;
        document.getElementById('sidebar-backdrop').hidden = !drawerOpen;
        document.getElementById('inner-app-view').classList.toggle('sidebar-drawer-open', drawerOpen);
        const content = document.querySelector('.terminal-content-pane');
        if (content) content.inert = drawerOpen;
      }
      function toggleSidebar() {
        isSidebarCollapsed = !isSidebarCollapsed;
        syncSidebarState();
      }
      document.getElementById('sidebar-toggle-btn').addEventListener('click', toggleSidebar);
      const sidebarBackdrop=document.createElement('button');
      sidebarBackdrop.id='sidebar-backdrop';sidebarBackdrop.type='button';sidebarBackdrop.hidden=true;
      sidebarBackdrop.setAttribute('aria-label','收起侧边栏');document.getElementById('left-sidebar').after(sidebarBackdrop);
      sidebarBackdrop.addEventListener('click',()=>{if(!isSidebarCollapsed)toggleSidebar();});
      syncSidebarState();
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!isSidebarCollapsed)toggleSidebar();});
      document.querySelectorAll('#left-sidebar [data-nav]').forEach(button=>button.setAttribute('aria-label',button.textContent.trim()));
      const updateHeaderHeight=()=>{const h=document.querySelector('#inner-app-view>header').getBoundingClientRect().height;if(h)document.documentElement.style.setProperty('--terminal-header-height',h+'px');};
      if(window.ResizeObserver)new ResizeObserver(updateHeaderHeight).observe(document.querySelector('#inner-app-view>header'));
      window.addEventListener('resize',()=>{
        updateHeaderHeight();
        const narrow = window.innerWidth < 768;
        if (narrow !== sidebarNarrow) sidebarNarrow = narrow;
        syncSidebarState();
      });



      // 日间模式 / 夜间模式 切换（去掉“复古”二字）
      const themeToggleBtn = document.getElementById('theme-toggle-btn');
      themeToggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.documentElement.dataset.savedTheme=isDarkMode?'night':'day';
        try{localStorage.setItem('aved_theme_v1',isDarkMode?'night':'day');}catch{}
        if (isDarkMode) {
          document.body.classList.add('dark-mode');
          themeToggleBtn.textContent = '☀️ 日间模式';
          showToast('已切换至：夜间模式');
        } else {
          document.body.classList.remove('dark-mode');
          themeToggleBtn.textContent = '🌙 夜间模式';
          showToast('已切换至：日间模式');
        }
      });




      // 签到由服务器按日期约束。




      document.getElementById('header-quick-checkin-btn').addEventListener('click', performDailyCheckin);
      document.getElementById('claim-relief-btn').addEventListener('click', performClaimRelief);
      document.getElementById('header-quick-relief-btn').addEventListener('click', performClaimRelief);

      const aliasInputEl = document.getElementById('global-anon-alias');
      aliasInputEl.addEventListener('input', () => {
        if (currentUser) {
          currentUser.savedAlias = aliasInputEl.value.trim() || '匿名员工';
        }
      });

      // ======================================================================
      // 登录流程（支持浏览器与本地存储记住账号密码）
      // ======================================================================
      const loginModal = document.getElementById('login-modal');
      const landingView = document.getElementById('landing-view');
      const innerAppView = document.getElementById('inner-app-view');
      const signalOverlay = document.getElementById('signal-Connecting-overlay');

      document.getElementById('open-login-btn').addEventListener('click', () => {
        loginModal.classList.remove('hidden');
        loginModal.classList.add('flex');
      });

      document.getElementById('close-login-btn').addEventListener('click', () => {
        loginModal.classList.add('hidden');
        loginModal.classList.remove('flex');
      });


      const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const terminalArtCache=AVEDStartup.assetCache({urls:window.AVEDCriticalArt});
      async function prepareTerminalArt(){
        const cached=terminalArtCache.cached;let shown=false;
        const reveal=()=>{
          shown=true;signalOverlay.classList.remove('hidden');signalOverlay.classList.add('flex');signalOverlay.setAttribute('aria-busy','true');
          signalOverlay.dataset.assetLoading=cached?'warm':'cold';signalPhase('正在建立内网链路',35,'接入节点已响应，正在同步员工授权域……');
        };
        let delayed;
        if(!cached||!signalOverlay.classList.contains('hidden'))reveal();else delayed=setTimeout(reveal,350);
        try{await terminalArtCache.prepare();}finally{clearTimeout(delayed);}
        return {cached,shown};
      }
      function signalPhase(title,progress,line) {
        document.getElementById('signal-status-title').textContent=title;
        document.getElementById('signal-progress-bar').style.width=progress+'%';
        document.getElementById('signal-noise-code').textContent=progress===100?'ACCESS // GRANTED':progress<40?'IDENTITY // VERIFYING':progress<80?'UPLINK // NEGOTIATING':'AUTHORITY // SYNCING';
        const logs=document.getElementById('signal-log-lines');if(progress<40)logs.replaceChildren();
        const steps=signalOverlay.dataset.assetLoading?['人员识别回执已确认。','正在同步岗位授权域……','工作终端待激活……']:['正在检索在册人员档案……','公司主干链路握手中……','正在同步岗位访问矩阵……'];
        const count=progress<40?1:progress<80?2:3;
        if(line)steps[count-1]=line;
        steps.slice(0,count).forEach((text,index)=>{let entry=logs.children[index];if(!entry){entry=document.createElement('div');entry.style.animation='signalLogReveal .18s ease-out both';entry.style.animationDelay=(index*70)+'ms';logs.append(entry);}entry.textContent='> '+text+(progress===100?' ✓':'');});
      }
      async function restoreSavedLogin() {
        if(!document.getElementById('remember-credentials-checkbox').checked||!window.PasswordCredential||!navigator.credentials)return;
        try {
          const saved=await navigator.credentials.get({password:true,mediation:'optional'});
          if(saved?.type==='password'){
            document.getElementById('login-username').value=saved.id;
            document.getElementById('login-password').value=saved.password;
          }
        } catch {}
      }
      document.getElementById('open-login-btn').addEventListener('click',restoreSavedLogin);
      document.getElementById('account-login-form').addEventListener('submit',async event=>{
        event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');if(button.disabled)return;
        const error=document.getElementById('login-error'),identifier=document.getElementById('login-username').value.trim();
        const password=document.getElementById('login-password').value,remember=document.getElementById('remember-credentials-checkbox').checked;
        const connectStarted=performance.now();button.disabled=true;if(error)error.textContent='';
        loginModal.classList.add('hidden');loginModal.classList.remove('flex');
        signalOverlay.classList.remove('hidden');signalOverlay.classList.add('flex');signalOverlay.setAttribute('aria-busy','true');
        signalPhase('员工身份核验中',12,'正在检索在册人员档案，等待识别回执……');
        try {
          await nextPaint();
          const authenticated=await apiLogin(identifier,password,remember);
          signalPhase('正在连接万业内网',45,'人员识别通过，正在与接入节点握手……');
          await nextPaint();
          signalPhase('岗位授权域同步中',85,'内网链路已建立，正在调阅岗位访问矩阵……');
          const employee=await loadPlayerData();
          if(employee.account!==authenticated.employee.username)throw new Error('登录身份未能确认，请重新接入。');
          signalPhase('正在激活员工席位',85,'归属档案已确认，正在分配工作终端……');
          await nextPaint();
          idleSession.start(true);
          await completeEnterIntranet(employee);
          signalPhase('欢迎归岗，'+employee.name,100,'接入许可已签发。您的工作终端已就绪。');
          signalOverlay.classList.add('hidden');signalOverlay.classList.remove('flex');signalOverlay.setAttribute('aria-busy','false');
          delete signalOverlay.dataset.assetLoading;
          try {
            if(remember)localStorage.setItem('aved_username',employee.account);else localStorage.removeItem('aved_username');
          } catch {}
          if(remember&&window.PasswordCredential&&navigator.credentials){
            const credential=new PasswordCredential({id:employee.account,password,name:employee.name});
            navigator.credentials.store(credential).catch(()=>{});
          }
          if(!remember)document.getElementById('login-password').value='';
        } catch(errorValue) {
          signalOverlay.classList.add('hidden');signalOverlay.classList.remove('flex');signalOverlay.setAttribute('aria-busy','false');
          delete signalOverlay.dataset.assetLoading;
          loginModal.classList.remove('hidden');loginModal.classList.add('flex');
          if(error)error.textContent=errorValue.message;
          document.getElementById('login-password').focus();
        } finally {button.disabled=false;}
      });
      document.getElementById('logout-btn').addEventListener('click',async()=>{
        try{await apiLogout();location.reload();}catch(e){showToast(e.message,'warn');}
      });

      // ======================================================================
      // 左侧导航切换 7 大独立分页（切换至收容物页时触发随机黑块乱码闪烁，切换至论坛页时触发骨架屏加载）
      // ======================================================================
      const mainViews = ['news', 'departments', 'containment', 'forum', 'casino'];

      const playerPageTitle=document.title;
      let renderedPlayerRoute='';
      function restorePlayerRoute(initial=false){
        if(!currentUser)return;
        const route=AVEDStartup.resolveRoute(location.hash,['profile',...mainViews]);
        switchMainView(route.page,{game:route.game,navigation:initial?'replace':'none'});
        if(route.page==='forum'){
          const entry=history.state?.avedForum;
          if(entry?.owner===currentUser.id&&entry.thread)openForumThread(entry.thread,entry.reply,{navigation:false}).catch(e=>showToast(e.message,'warn'));
          else if(currentForumThreadId)returnForumList(false);
        }
      }
      window.addEventListener('hashchange',()=>restorePlayerRoute());
      window.addEventListener('popstate',()=>restorePlayerRoute());
      let containmentVisit=0;
      function switchMainView(target,{game='home',navigation='push'}={}) {
        if(!currentUser)return;
        if(target!=='welcome'&&!['profile',...mainViews].includes(target))return;
        if(target==='welcome'){showProfile().catch(e=>showToast(e.message));return;}
        const path=target==='casino'?(AVEDStartup.gamePath(game)||AVEDStartup.gamePath('home')):'#/'+target;
        if(navigation==='none'&&renderedPlayerRoute===path&&location.hash===path)return;
        if(location.hash!==path){
          if(navigation==='push')history.pushState(null,'',path);
          else history.replaceState(null,'',path);
        }
        renderedPlayerRoute=path;
        const enteringContainment=target==='containment'&&document.getElementById('view-containment').classList.contains('hidden');
        const visit=++containmentVisit;
        const sectionReady=target!=='profile'&&target!=='welcome'?loadDeferredPlayerData(target):null;
        if(sectionReady)Promise.resolve(sectionReady).then(async()=>{
          if(!enteringContainment||visit!==containmentVisit)return;
          await nextPaint();
          if(visit===containmentVisit&&!document.getElementById('view-containment').classList.contains('hidden'))triggerScpTitleRedactionGlitch();
        }).catch(e=>showToast(e.message,'warn'));
        if(target==='departments'){window.avedDepartmentFilter='';renderDepartmentsAndPersonnel();}
        if (target === 'classified' && (!currentUser || !currentUser.isAdmin)) return;
        playSfx('click');
        document.querySelectorAll('.nav-tab-btn').forEach(b => {
          const isHidden = b.classList.contains('hidden');
          const navKey = b.getAttribute('data-nav');
          const selected = navKey === target || target==='profile' && navKey==='welcome';
          if (selected) b.setAttribute('aria-current', 'page');
          else b.removeAttribute('aria-current');
          if (selected) {
            b.className = `nav-tab-btn w-full px-3 py-3 flex items-center gap-3 bg-[var(--inner-accent)] text-[var(--inner-accent-text)] font-bold text-left cursor-pointer transition ${isHidden ? 'hidden' : ''}`;
          } else {
            b.className = `nav-tab-btn w-full px-3 py-3 flex items-center gap-3 opacity-80 hover:opacity-100 text-left cursor-pointer transition ${isHidden ? 'hidden' : ''}`;
          }
        });

        mainViews.forEach(v => {
          const sec = document.getElementById(`view-${v}`);
          if (!sec) return;
          if (v === target) sec.classList.remove('hidden');
          else sec.classList.add('hidden');
        });

        if(target==='casino')communityUI.showGame(game||'home');
        const gameTitle=target==='casino'&&game!=='home'?document.querySelector('[data-game="'+game+'"]')?.getAttribute('aria-label'):'';
        document.title=gameTitle?gameTitle+' · '+playerPageTitle:playerPageTitle;
        if(target==='profile')renderProfile();
        if (target === 'containment') {
          if(enteringContainment)scpBoardSelection=null;renderScpArchives();
          randomizeScpDualNamePlaceholder();
        } else if (target === 'forum') {
          renderForumView();

        }
      }

      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          switchMainView(btn.getAttribute('data-nav'));
        });
      });

      // ======================================================================
      // 分页 1：内部红头通告
      // ======================================================================


      document.getElementById('back-to-news-list-btn').addEventListener('click', () => {
        currentNewsId = null;
        renderCompanyNewsView();document.getElementById('view-news').scrollIntoView({block:'start'});
      });


      // ======================================================================
      // 分页 2：部门介绍与员工名录（医疗部直接嵌入您上传的第3张宣发背景卡）
      // ======================================================================
      function renderDepartmentsAndPersonnel() {
        const deptGrid = document.getElementById('departments-grid');
        if (deptGrid) {
          const departmentOrder=['收容部','武装部','医疗部','科研部','后勤部'];
          const orderedDepartments=[...departmentsData].sort((a,b)=>(departmentOrder.indexOf(a.name)<0?99:departmentOrder.indexOf(a.name))-(departmentOrder.indexOf(b.name)<0?99:departmentOrder.indexOf(b.name)));
          deptGrid.innerHTML = orderedDepartments.map((d,i) => `<button type="button" data-department-filter="${d.name}" class="department-sheet ${window.avedDepartmentFilter===d.name?'department-selected':''}"><div class="department-meta"><span>AVED / ${esc(d.code)}</span><span>DIVISION ${String(i+1).padStart(2,'0')}</span></div><h3>${d.name}</h3><div class="department-summary"><p>${d.desc}</p><svg class="department-plate" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path d="M12 20H388M12 44H388M12 188H388"/><text x="16" y="38">AVED / DIVISION REGISTER</text><text class="plate-title" x="12" y="102">${esc(d.code.split('//')[1]||'DIVISION')}</text><circle cx="60" cy="153" r="28"/><path d="M18 153H102M60 111V195"/><text class="plate-number" x="220" y="210">${String(i+1).padStart(2,'0')}</text></svg></div><footer><span>${d.motto}</span><b>调阅人员 ↗</b></footer></button>`).join('');
        }

        let extra=document.getElementById('directory-unassigned');if(!extra){extra=document.createElement('button');extra.id='directory-unassigned';extra.type='button';extra.className='community-button directory-unassigned';extra.dataset.departmentFilter='公司直属';deptGrid.after(extra);}const unassigned=employees.filter(e=>e.department==='公司直属').length;extra.hidden=!unassigned;extra.textContent='公司直属 / '+unassigned+' 人';
        let leadership=document.getElementById('company-leadership-directory');if(!leadership){leadership=document.createElement('section');leadership.id='company-leadership-directory';leadership.className='company-leadership';byId('view-departments').append(leadership);}byId('view-departments').append(leadership);const leaders=employees.filter(e=>e.isLeadership&&e.department==='公司直属');leadership.hidden=!leaders.length;leadership.innerHTML='<header><span class="section-kicker">COMPANY DIRECTORATE</span><h3>公司直属</h3></header><div class="leadership-cards">'+leaders.map(e=>`<article><span class="section-kicker">DIRECTORATE</span><h4>${e.positionTitle}</h4><p>${e.name}</p><button type="button" class="community-button" data-department-filter="公司直属">调阅直属档案 ↗</button></article>`).join('')+'</div>';
        const dirGrid = document.getElementById('personnel-directory-grid');
        if (!dirGrid) return;
        dirGrid.parentElement.hidden=!window.avedDepartmentFilter;
        if(!window.avedDepartmentFilter){dirGrid.replaceChildren();return;}

        const labels = ['力量', '意志', '体质', '智力', '敏捷', '洞察'];
        const cx = 65, cy = 65, rMax = 44;
        const angles = [-90, -30, 30, 90, 150, 210].map(a => a * Math.PI / 180);
        const outerHex = angles.map(a => `${(cx + rMax * Math.cos(a)).toFixed(1)},${(cy + rMax * Math.sin(a)).toFixed(1)}`).join(' ');
        const midHex = angles.map(a => `${(cx + rMax * 0.6 * Math.cos(a)).toFixed(1)},${(cy + rMax * 0.6 * Math.sin(a)).toFixed(1)}`).join(' ');

        const isHead=emp=>emp.isLeadership&&emp.department!=='公司直属';
        const group=emp=>isHead(emp)?'部长档案':emp.isLeadership?'职务档案':emp.identityKind?.endsWith('_containment')?'收容物档案':'部门成员';
        const rank=emp=>isHead(emp)?0:emp.isLeadership?1:emp.identityKind?.endsWith('_containment')?3:2;
        const selectedEmployees=employees.filter(emp=>emp.department===window.avedDepartmentFilter).sort((a,b)=>rank(a)-rank(b));
        dirGrid.innerHTML = selectedEmployees.map((emp,index) => {
          const stats = emp.stats || [80, 85, 80, 85, 80, 85];
          const polyPoints = stats.map((val, i) => {
            const r = (val / 100) * rMax;
            return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`;
          }).join(' ');

          const deptDisplay = emp.isLeadership?`职务：<strong>${emp.positionTitle}</strong>`:`所属部门：<strong>${emp.department}</strong>${emp.positionTitle?`<br>职务：<strong>${emp.positionTitle}</strong>`:''}`;

          return `
            ${index===0||group(emp)!==group(selectedEmployees[index-1])?'<h3 class="directory-role-heading">'+group(emp)+'</h3>':''}
            <div class="retro-corner-box p-5 space-y-4">
              <div class="flex items-center justify-between border-b-2 border-[var(--inner-border)] pb-2 text-xs font-mono-tech">
                <span class="font-bold">A.V.E. DIRECTORATE // ID</span>
                <span class="px-2 py-0.5 bg-[var(--inner-crimson)] text-white text-[10px] font-bold">${emp.bracketTag}</span>
              </div>

              <div class="grid grid-cols-2 gap-3 items-center pt-1">
                <div class="border border-[var(--inner-border)] p-2 bg-black/5 flex flex-col items-center">
                  <div data-emp-photo-slot="${emp.id}" class="w-20 h-24 bg-[#9e1b1b] flex flex-col items-center justify-end relative overflow-hidden border border-black">
                    ${emp.avatarUrl?`<img src="${esc(emp.avatarUrl)}" alt="员工证件照" class="w-full h-full object-cover">`:'<span class="avatar-noinfo">NOINFO</span>'}
                    <span class="absolute bottom-1 text-[10px] font-mono-tech text-white/90 tracking-widest bg-black/60 px-1.5">员工档案</span>
                  </div>
                  <div class="text-sm font-bold mt-2 font-serif-sc">${emp.name}</div>
                </div>

                <div class="flex flex-col items-center">
                  <svg viewBox="0 0 130 130" class="w-32 h-32">
                    <polygon points="${outerHex}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1" />
                    <polygon points="${midHex}" fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-width="0.8" />
                    ${angles.map(a => `<line x1="${cx}" y1="${cy}" x2="${(cx + rMax * Math.cos(a)).toFixed(1)}" y2="${(cy + rMax * Math.sin(a)).toFixed(1)}" stroke="currentColor" stroke-opacity="0.2" stroke-width="0.8" />`).join('')}
                    <polygon points="${polyPoints}" fill="rgba(158, 27, 27, 0.32)" stroke="#9e1b1b" stroke-width="1.8" />
                    ${angles.map((a, idx) => {
                      const lx = cx + (rMax + 13) * Math.cos(a);
                      const ly = cy + (rMax + 13) * Math.sin(a);
                      return `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="currentColor">${labels[idx]}</text>`;
                    }).join('')}
                  </svg>
                </div>
              </div>

              <div class="text-xs space-y-1.5 border-t border-[var(--inner-border-soft)] pt-3 font-mono-tech">
                <div>${deptDisplay}</div>
                <div><span class="opacity-65">办公驻地：</span><span>${emp.location}</span></div>
                <div><span class="opacity-65">档案简述：</span><span>${emp.abilityNote}</span></div>
              </div>
            </div>
          `;
        }).join('')||'<p class="p-5">本部门暂无在册人员。</p>';
      }

      // ======================================================================
      // 分页 3：收容物一览（随机黑块乱码闪烁恢复 + 双人浅色提示搜索框 + 磁吸标题 + 空状态组件）
      // ======================================================================



      // One short redaction sequence per entry into the archive view.
      let scpBoardSelection=null;
      function triggerScpTitleRedactionGlitch() {
        AVEDArchiveBoard.glitch({document,enabled:!document.body.classList.contains('effects-off')&&!prefersReducedMotion});
      }

      function renderScpArchives() {
        AVEDArchiveBoard.cancel();
        document.querySelectorAll('.scp-filter-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===selectedScpFilter)));
        const listEl = document.getElementById('scp-list-container');
        const emptyBox = document.getElementById('scp-empty-state-box');
        const detailEl = document.getElementById('scp-detail-container');
        const commentsListEl = document.getElementById('scp-realname-comments-list');
        const hintEl = document.getElementById('scp-comment-identity-hint');
        const countFooter = document.getElementById('scp-count-footer');

        if (currentUser && hintEl) {
          hintEl.textContent = `实名签署身份：${currentUser.name}[${currentUser.bracketTag}]`;
        }

        const kw = scpSearchKeyword.trim().toLowerCase();
        // 支持按双人组合如 "蒋正一 / 溟座" 的任意拆分词匹配
        const kwParts = kw.split(/[\s/]+/).filter(Boolean);

        const matching = scpSimulatedEmpty ? [] : scpItemsData.filter(item => {
          const matchLevel = selectedScpFilter === 'ALL' || item.level === selectedScpFilter;
          if (!matchLevel) return false;
          if (kwParts.length === 0) return true;
          const haystack = `${item.id} ${item.codeName} ${item.handlers} ${item.summary} ${item.clues.join(' ')}`.toLowerCase();
          return kwParts.some(part => haystack.includes(part));
        });

        const boardKey=JSON.stringify([kw,selectedScpFilter,matching.map(item=>item.id)]);
        if(!scpBoardSelection||scpBoardSelection.key!==boardKey)scpBoardSelection={key:boardKey,ids:AVEDArchiveBoard.sample(matching,4).map(item=>item.id)};
        const filtered=scpBoardSelection.ids.map(id=>matching.find(item=>item.id===id)).filter(Boolean);
        if (countFooter) countFooter.textContent = `SHOWING: ${filtered.length} / FILES: ${matching.length}`;

        document.getElementById('scp-realname-comment-form').hidden=!filtered.length;
        // 空状态切换逻辑（Empty State Pattern）
        if (filtered.length === 0) {
          detailEl.replaceChildren();commentsListEl.replaceChildren();
          listEl.classList.add('hidden');
          emptyBox.classList.remove('hidden');
          emptyBox.classList.add('flex');

          const emptyTitle = document.getElementById('scp-empty-title');
          const emptyDesc = document.getElementById('scp-empty-desc');
          emptyDesc.hidden = true;
          if (scpSimulatedEmpty) {
            emptyTitle.textContent = '暂无在册卷宗';
            emptyDesc.textContent = '';
          } else {
            emptyTitle.textContent = '未检索到对应卷宗';
            emptyDesc.textContent = '';
          }
          return;
        }

        listEl.classList.remove('hidden');
        emptyBox.classList.add('hidden');
        emptyBox.classList.remove('flex');

        if (!filtered.some(i => i.id === selectedScpId)) {
          selectedScpId = filtered[0].id;
        }

        listEl.innerHTML = filtered.map(item => {
          const active = item.id === selectedScpId;
          const fullTitle = `${item.id} ${item.codeName}`;
          return `
            <div data-scp-id="${item.id}" aria-current="${active}" class="scp-item-card relative p-4 bg-[#f4f1ea] text-[#141413] border-2 ${active ? 'border-[#9e1b1b] shadow-lg' : 'border-black/60 opacity-90 hover:opacity-100'} transition cursor-pointer select-none flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="archive-item-code font-mono-tech">${item.id}</span>
                  <span class="text-[10px] font-mono-tech font-bold text-[#9e1b1b]">${item.level}</span>
                </div>

                <div class="archive-evidence-strip bg-[#141413] text-[#e8e3d5] p-2 mb-2 font-mono-tech text-[10px] flex items-center justify-between border border-black">
                  <span>${item.polaroidTag}</span>

                </div>

                <!-- 磁吸式收容物名称标题按钮 + 随机黑块乱码目标 -->
                <button type="button" class="magnetic-cta scp-glitchable-title font-bold text-sm font-serif-sc text-left text-[#141413] hover:text-[#9e1b1b] mb-1 py-0.5"
                  data-orig-title="${fullTitle}" data-scp-name="${item.codeName}">
                  ${fullTitle}
                </button>
                <p class="scp-glitchable-summary text-xs text-[#4a463f] line-clamp-1 leading-relaxed mb-2">${item.summary}</p>
              </div>

              ${item.clues.length?`<div class="archive-clues pt-2 border-t border-black/15 space-y-1.5">

                <div class="flex flex-wrap gap-1">
                  ${item.clues.map(c => `<span class="text-[10px] font-mono-tech px-1.5 py-0.5 bg-[#e2dccb] text-[#141413] border border-black/20">#${c}</span>`).join('')}
                </div>
              </div>`:''}
            </div>
          `;
        }).join('');

        listEl.querySelectorAll('.scp-item-card').forEach(card => {
          card.addEventListener('click', () => {
            selectedScpId = card.getAttribute('data-scp-id');
            playSfx('click');
            renderScpArchives();
          });
        });

        const currentScp = scpItemsData.find(i => i.id === selectedScpId) || scpItemsData[0];
        detailEl.innerHTML = `
          <div class="scp-dossier-heading flex items-center justify-between text-[11px] font-mono-tech opacity-65 border-b border-[var(--inner-border-soft)] pb-2 mb-3">
            <span>收容物卷宗</span><span>${currentScp.id}</span>
          </div>

          <div class="border-b-2 border-[var(--inner-border)] pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div class="text-[10px] font-mono-tech opacity-65">ITEM DESIGNATION</div>
              <h3 class="scp-glitchable-title text-lg sm:text-xl font-bold font-serif-sc" data-orig-title="${currentScp.id} — ${currentScp.codeName}">
                ${currentScp.id} — ${currentScp.codeName}
              </h3>
            </div>
            <span class="text-xs font-mono-tech font-bold px-2.5 py-1 bg-[var(--inner-crimson)] text-white self-start sm:self-auto">
              ${currentScp.level}
            </span>
          </div>

          <div data-scp-image-slot="${currentScp.id}" class="mb-4 p-3 border border-dashed border-[var(--inner-border-soft)] bg-black/5 flex items-center justify-between text-xs font-mono-tech">
            <span>🖼️ 影像档案 // ${currentScp.id}</span>
            <span class="opacity-60">IMAGE SLOT RESERVED</span>
          </div>

          <div class="scp-dossier-meta inner-card-alt p-3 mb-4 text-xs font-mono-tech space-y-1.5">
            <div class="flex justify-between border-b border-[var(--inner-border-soft)] pb-1">
              <span class="opacity-70">管辖部门 / 责任人:</span>
              <strong>${currentScp.department}${currentScp.handlers?` (${currentScp.handlers})`:""}</strong>
            </div>
            <div class="flex justify-between border-b border-[var(--inner-border-soft)] pb-1">
              <span class="opacity-70">收容位置:</span>
              <span>${currentScp.location}</span>
            </div>
            <div class="flex justify-between">
              <span class="opacity-70">特征标签:</span>
              <span class="text-[var(--inner-crimson)]">${currentScp.clues.join(' / ')}</span>
            </div>
          </div>

          <div class="space-y-4 text-xs sm:text-sm leading-relaxed">
            <div>
              <h4 class="font-bold font-mono-tech text-xs uppercase tracking-wider text-[var(--inner-crimson)] mb-1">
                [ SPECIAL CONTAINMENT PROCEDURES // 特殊收容措施 ]
              </h4>
              <p class="leading-relaxed">${currentScp.procedure}</p>
            </div>
            <div>
              <h4 class="font-bold font-mono-tech text-xs uppercase tracking-wider text-[var(--inner-crimson)] mb-1">
                [ INVESTIGATION NOTES // 档案描述 ]
              </h4>
              <p class="leading-relaxed">${currentScp.description}</p>
            </div>
          </div>
        `;

        if (commentsListEl) {
          if (!currentScp.realComments || currentScp.realComments.length === 0) {
            commentsListEl.innerHTML = `<div class="text-xs opacity-60 font-mono-tech py-3 text-center">暂无实名评议记录，可在下方签署发表。</div>`;
          } else {
            commentsListEl.innerHTML = currentScp.realComments.map(c => `
              <div class="inner-card-alt p-3 text-xs space-y-1 font-mono-tech">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-[var(--inner-crimson)]">👤 ${c.authorName}[${c.authorRole}]</span>
                    <span class="text-[10px] opacity-60">${c.time}</span>
                  </div>
                  ${currentUser && currentUser.isAdmin ? `
                    <button type="button" data-del-scp-comment="${c.id}" class="del-scp-comment-btn px-2 py-0.5 bg-[#9e1b1b] text-white text-[10px] cursor-pointer">
                      [删除评议]
                    </button>
                  ` : ''}
                </div>
                <p class="font-sans text-xs leading-relaxed pt-1">${c.text}</p>
              </div>
            `).join('');

            commentsListEl.querySelectorAll('.del-scp-comment-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                const cid = btn.getAttribute('data-del-scp-comment');
                askSecondConfirmation(
                  '确认删除该条收容物实名评议？',
                  '删除后该条评议将从当前收容物卷宗下方移除。',
                  () => {
                    currentScp.realComments = currentScp.realComments.filter(x => x.id !== cid);
                    renderScpArchives();
                    showToast('已删除该条收容物评议记录。', 'success');
                  }
                );
              });
            });
          }
        }
      }

      // 收容物搜索与空状态恢复事件
      const scpSearchInput = document.getElementById('scp-search-input');
      scpSearchInput.addEventListener('input', () => {
        scpSimulatedEmpty = false;
        scpSearchKeyword = scpSearchInput.value;
        renderScpArchives();
      });

      document.getElementById('scp-search-clear-x').addEventListener('click', () => {
        scpSimulatedEmpty = false;
        scpSearchKeyword = scpSearchInput.value;
        renderScpArchives();
      });



      document.getElementById('scp-empty-primary-cta').addEventListener('click', () => {
        scpSimulatedEmpty = false;
        scpSearchKeyword = '';
        selectedScpFilter = 'ALL';
        scpSearchInput.value = '';
        document.querySelectorAll('.scp-filter-btn').forEach(b => {
          b.className = b.getAttribute('data-filter') === 'ALL'
            ? 'scp-filter-btn px-3 py-1.5 bg-[var(--inner-accent)] text-[var(--inner-accent-text)] font-bold cursor-pointer'
            : 'scp-filter-btn px-3 py-1.5 retro-corner-box opacity-75 hover:opacity-100 cursor-pointer';
        });
        playSfx('checkin');
        renderScpArchives();
        scpSearchInput.focus();
        showToast('已清除筛选。', 'success');
      });



      document.querySelectorAll('.scp-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          scpSimulatedEmpty = false;
          selectedScpFilter = btn.getAttribute('data-filter');
          document.querySelectorAll('.scp-filter-btn').forEach(b => {
            b.className = 'scp-filter-btn px-3 py-1.5 retro-corner-box opacity-75 hover:opacity-100 cursor-pointer';
          });
          btn.className = 'scp-filter-btn px-3 py-1.5 bg-[var(--inner-accent)] text-[var(--inner-accent-text)] font-bold cursor-pointer';
          renderScpArchives();
        });
      });

      document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('redacted')) {
          e.target.classList.toggle('revealed');
        }
      });

      // ======================================================================
      // ======================================================================


      // ======================================================================
      // 分页 5：匿名论坛（含 1.1秒骨架屏加载动画 + 单一合并图片上传按钮）
      // ======================================================================
      let pendingNewTopicImageData = null;
      let pendingReplyImageData = null;
      let forumSkeletonTimer = null;






      // 单一按钮触发隐藏的 file input
      document.getElementById('new-topic-upload-trigger-btn').addEventListener('click', () => {
        document.getElementById('new-topic-image-input').click();
      });

      document.getElementById('new-topic-image-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        readImageFileAsDataUrl(file, (dataUrl) => {
          pendingNewTopicImageData = dataUrl;
          document.getElementById('new-topic-image-hint').textContent = dataUrl
            ? file.name
            : '';
        });
      });

      document.getElementById('reply-upload-trigger-btn').addEventListener('click', () => {
        document.getElementById('forum-detail-reply-image').click();
      });

      document.getElementById('forum-detail-reply-image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        readImageFileAsDataUrl(file, (dataUrl) => {
          pendingReplyImageData = dataUrl;
          document.getElementById('reply-image-selected-hint').textContent = dataUrl
            ? file.name
            : '';
        });
      });

      function renderAttachmentHtml(item) {
        if (!item.imageUrl || item.imageStatus === 'NONE') return '';
        if (item.imageStatus === 'APPROVED') {
          return `<div class="mt-2"><img src="${item.imageUrl}" alt="论坛附图" class="max-h-56 border border-[var(--inner-border)]"></div>`;
        }
        if (item.imageStatus === 'PENDING') {
          return `<div class="mt-2 px-3 py-2 inner-card-alt text-[11px] font-mono-tech text-[var(--inner-crimson)]">🖼️ [附图待管理员审核批准后展示]</div>`;
        }
        if (item.imageStatus === 'REJECTED') {
          return `<div class="mt-2 px-3 py-1.5 inner-card-alt text-[11px] font-mono-tech opacity-60">🖼️ [附图未通过审核]</div>`;
        }
        return '';
      }



      document.getElementById('back-to-forum-list-btn').addEventListener('click', () => {
        returnForumList();
      });



      // ======================================================================
      // 分页 6-1：直升机高空空投（60fps requestAnimationFrame 丝滑连续下坠 + 20秒整备倒计时 + 多样化沉默机器人 + 真实玩家发言头像上直升机）
      // ======================================================================
      let skydiveState = {
        flightNo: 45267,
        phase: 'BOARDING', // BOARDING (20秒倒计时) | DROPPING (60fps连续丝滑下坠) | SETTLED (本班结算)
        phaseStartTime: 0,
        currentDepth: 100.0,
        safeLineDepth: 1200,
        touchdownDepth: 1416,
        playerBoarded: false,
        playerBet: 1000,
        playerJumped: false,
        playerJumpDepth: 0,
        playerPayout: 0,
        passengers: [],
        helicopterHighlightAvatars: [] // 真实玩家登机或发言时显示在直升机舱上的头像
      };

      // 多样化的 A.V.E.D. 特遣干员机器人名字池（每次随机抽取不同组合，且机器人全程保持沉默绝不发聊天）
      const diverseBotPool = [];

      // 机舱无线电仅保留真实在册员工发言
      const skydiveChatLog = [];

      let skydiveRafId = null;


      function depthToMultiplier(depth) {
        if (depth < 100) return 0;
        return Number(((depth / 100) * 1.015).toFixed(2));
      }

      function promoteSpeakerToHelicopter(senderName, badge, color) {
        const cleanName = senderName.split('[')[0];
        const exists = skydiveState.helicopterHighlightAvatars.find(a => a.name === cleanName);
        if (!exists) {
          skydiveState.helicopterHighlightAvatars.unshift({
            name: cleanName,
            badge: badge || cleanName[0],
            color: color || '#9e1b1b'
          });
          if (skydiveState.helicopterHighlightAvatars.length > 5) {
            skydiveState.helicopterHighlightAvatars.pop();
          }
          renderSkydiveStaticList();
        }
      }

      function spawnSkydiveDanmaku(sender, text) {
        const layer = document.getElementById('skydive-danmaku-layer');
        if (!layer) return;
        const item = document.createElement('div');
        const topPx = 4 + Math.floor(Math.random() * 64);
        item.className = 'danmaku-item absolute right-0 px-3 py-1 bg-black/85 border border-white/50 text-xs font-mono-tech text-white flex items-center gap-1.5 shadow';
        item.style.top = `${topPx}px`;
        item.innerHTML = `<span class="text-red-400 font-bold">${sender}:</span><span>${text}</span>`;
        layer.appendChild(item);
        setTimeout(() => item.remove(), 7600);
      }

      function spawnParachuteAvatar(badge, color, name, depth) {
        const stage = document.getElementById('skydive-parachutes-stage');
        if (!stage) return;
        const el = document.createElement('div');
        const leftPct = 15 + Math.floor(Math.random() * 70);
        el.className = 'absolute flex flex-col items-center transition-all duration-[2400ms] ease-out';
        el.style.left = `${leftPct}%`;
        el.style.top = '85px';
        el.innerHTML = `
          <div class="text-xl -mb-1">🪂</div>
          <div class="w-7 h-7 border-2 border-white flex items-center justify-center text-[11px] font-bold text-white shadow" style="background:${color}">
            ${badge}
          </div>
          <span class="text-[9px] font-mono-tech bg-black/80 px-1 mt-0.5 text-white">${name} (${Math.round(depth)}m)</span>
        `;
        stage.appendChild(el);
        requestAnimationFrame(() => {
          el.style.top = '335px';
        });
      }


      // 渲染乘客列表与直升机头像（仅在状态变化时调用，避免 60fps 重绘 DOM 造成卡顿）
      function renderSkydiveStaticList() {
        const avatarsBox = document.getElementById('skydive-airship-avatars');
        if (avatarsBox) {
          const displayAvatars = skydiveState.helicopterHighlightAvatars.length > 0
            ? skydiveState.helicopterHighlightAvatars
            : skydiveState.passengers.slice(0, 4);
          avatarsBox.innerHTML = displayAvatars.map(p => `
            <div title="${p.name}" class="w-6 h-6 border border-white flex items-center justify-center text-[10px] font-bold text-white" style="background:${p.color}">
              ${p.badge}
            </div>
          `).join('');
          document.getElementById('skydive-airship-extra-count').textContent = `机上 ${skydiveState.passengers.length}`;
        }


        const totalOnBoard = skydiveState.passengers.length;
        const landedCount = skydiveState.passengers.filter(p => p.status === 'LANDED').length;
        const crashedCount = skydiveState.passengers.filter(p => p.status === 'CRASHED').length;
        document.getElementById('skydive-passenger-stats').textContent =
          `机上 ${totalOnBoard} 落地 ${landedCount} 坠毁 ${crashedCount}`;

        const pListEl = document.getElementById('skydive-passengers-list');
        if (pListEl) {
          pListEl.innerHTML = skydiveState.passengers.map(p => {
            let statusBadge = `<span class="px-2 py-0.5 border border-black/25 opacity-75">待跳</span>`;
            let rightAmt = `${fmtMoney(p.bet)}`;
            if (p.status === 'LANDED') {
              statusBadge = `<span class="px-2 py-0.5 bg-emerald-800 text-white font-bold">落地</span>`;
              rightAmt = `<span class="text-emerald-700 font-bold">+${fmtMoney(p.payout)}</span>`;
            } else if (p.status === 'CRASHED') {
              statusBadge = `<span class="px-2 py-0.5 bg-[#9e1b1b] text-white font-bold">坠毁</span>`;
              rightAmt = `<span class="text-red-700 font-bold">-${fmtMoney(p.bet)}</span>`;
            }

            return `
              <div class="flex items-center justify-between py-1 border-b border-[var(--inner-border-soft)]">
                <div class="flex items-center gap-2">
                  <div class="w-5 h-5 text-white text-[10px] font-bold flex items-center justify-center" style="background:${p.color}">${p.badge}</div>
                  <span class="font-bold ${p.isPlayer ? 'text-[var(--inner-crimson)]' : ''}">${p.name}</span>
                </div>
                <div class="flex items-center gap-2">
                  ${statusBadge}
                  <span>${rightAmt}</span>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // 60fps requestAnimationFrame 丝滑动画循环




      document.querySelectorAll('.sky-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const v = parseInt(btn.getAttribute('data-sky-chip'), 10);
          document.getElementById('skydive-bet-input').value = v;
        });
      });

      document.getElementById('sky-chip-half').addEventListener('click', () => {
        const input = document.getElementById('skydive-bet-input');
        input.value = Math.max(100, Math.round((parseInt(input.value, 10) || 1000) / 2));
      });

      document.getElementById('sky-chip-double').addEventListener('click', () => {
        const input = document.getElementById('skydive-bet-input');
        input.value = Math.min(100000, (parseInt(input.value, 10) || 1000) * 2);
      });



      function renderSkydiveChat() {
        const listEl = document.getElementById('skydive-chat-list');
        if (!listEl) return;
        listEl.innerHTML = skydiveChatLog.map(m => `
          <div class="p-2 inner-card-alt space-y-0.5">
            <div class="flex justify-between text-[10px] opacity-70">
              <strong class="text-[#9e1b1b]">${m.sender}</strong>
              <span>${m.time}</span>
            </div>
            <div class="text-xs">${m.text}</div>
          </div>
        `).join('');
        listEl.scrollTop = listEl.scrollHeight;
      }
      renderSkydiveChat();


      // ======================================================================
      // 分页 6-2：五轮五线 收容抑制矩阵（已全部替换为 SCP 工业收容符号，无猫咪）
      // ======================================================================
      const slot5x3Symbols = [
        { id: 'eye', icon: '👁️', name: '收容之眼', m3: 60, m4: 120, m5: 650 },
        { id: 'rad', icon: '☢️', name: '高危核心', m3: 12, m4: 35, m5: 120 },
        { id: 'lock', icon: '🔺', name: '几何抑制锁', m3: 6, m4: 17, m5: 45 },
        { id: 'file', icon: '📁', name: '机密卷宗', m3: 3.5, m4: 8, m5: 18 },
        { id: 'dna', icon: '🧬', name: '记忆血清', m3: 2, m4: 4.5, m5: 10 },
        { id: 'pill', icon: '💊', name: '理智镇定剂', m3: 1.5, m4: 3, m5: 6 }
      ];

      const slot5x3Lines = [
        { id: 1, name: '① 中线', rows: [1, 1, 1, 1, 1] },
        { id: 2, name: '② 上线', rows: [0, 0, 0, 0, 0] },
        { id: 3, name: '③ 下线', rows: [2, 2, 2, 2, 2] },
        { id: 4, name: '④ 谷线', rows: [0, 1, 2, 1, 0] },
        { id: 5, name: '⑤ 山线', rows: [2, 1, 0, 1, 2] }
      ];

      const slot5x3Mechanisms = [
        { id: 'mech_1', title: '协议一 全视之眼锁定', desc: '盘面任意位置出现 3 枚收容之眼，拨付 ×4 倍特别津贴', discovered: false },
        { id: 'mech_2', title: '协议二 辐射共振回响', desc: '首尾两列同时出现高危核心，返还本转投入的 50%', discovered: false },
        { id: 'mech_3', title: '协议三 跨维样本序列', desc: '中线五格全为不同收容符号，触发 ×3 倍科研奖金', discovered: false }
      ];

      let pendingSlotRequest=null;
      let slot5x3State = {
        board: [
          [slot5x3Symbols[2], slot5x3Symbols[5], slot5x3Symbols[4], slot5x3Symbols[1], slot5x3Symbols[0]],
          [slot5x3Symbols[3], slot5x3Symbols[4], slot5x3Symbols[5], slot5x3Symbols[0], slot5x3Symbols[1]],
          [slot5x3Symbols[4], slot5x3Symbols[3], slot5x3Symbols[0], slot5x3Symbols[5], slot5x3Symbols[2]]
        ],
        winningCells: new Set(),
        history: [],
        spinning: false
      };



      const slotMarkupCache=new WeakMap();
      function setSlotMarkup(el,html){if(el&&slotMarkupCache.get(el)!==html){el.innerHTML=html;slotMarkupCache.set(el,html);}}
      function renderSlot5x3Board() {
        const grid = document.getElementById('slot5x3-grid');
        if (!grid) return;

        let html = '';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            const sym = slot5x3State.board[r][c];
            const isWin = slot5x3State.winningCells.has(`${r}_${c}`);
            html += `
              <div class="slot-cell h-16 sm:h-18 bg-[#e8e3d5] border-2 ${isWin ? 'is-winning' : 'border-black'} text-[#141413] flex flex-col items-center justify-center shadow-inner transition">
                <span class="slot-symbol text-xl sm:text-2xl" aria-hidden="true">${AVEDPixelIcons.render(sym.id)}</span>
                <span class="slot-symbol-name text-[10px] font-mono-tech font-bold opacity-80 mt-0.5">${sym.name}</span>
              </div>
            `;
          }
        }
        setSlotMarkup(grid,html);

        const totalBet = parseInt(document.getElementById('slot5x3-bet-input')?.value || '500', 10);
        const lineBet = totalBet / 5;
        document.querySelectorAll('.slot-chip-btn').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.slotChip)===totalBet)));
        document.getElementById('slot5x3-bet-summary').textContent = `押 ${totalBet.toLocaleString()} 每线 ${lineBet.toLocaleString()}`;
        document.getElementById('slot5x3-spin-subtext').textContent = `押 ${totalBet.toLocaleString()} 五线`;

        const payBody = document.getElementById('slot5x3-paytable-body');
        if (payBody) {
          setSlotMarkup(payBody,slot5x3Symbols.map(s => `
            <tr>
              <td class="py-1.5 font-bold">${AVEDPixelIcons.render(s.id)} ${s.name}</td>
              <td class="py-1.5 text-right"><div class="text-[10px] opacity-60">${s.m3}×</div><div class="font-bold">${(s.m3 * lineBet).toLocaleString()}</div></td>
              <td class="py-1.5 text-right"><div class="text-[10px] opacity-60">${s.m4}×</div><div class="font-bold">${(s.m4 * lineBet).toLocaleString()}</div></td>
              <td class="py-1.5 text-right"><div class="text-[10px] opacity-60">${s.m5}×</div><div class="font-bold text-[#9e1b1b]">${(s.m5 * lineBet).toLocaleString()}</div></td>
            </tr>
          `).join(''));
        }

        const discCount = slot5x3Mechanisms.filter(m => m.discovered).length;
        document.getElementById('slot5x3-mechanisms-count').textContent = `已解锁 ${discCount}/3`;
        const mechList = document.getElementById('slot5x3-mechanisms-list');
        if (mechList) {
          setSlotMarkup(mechList,slot5x3Mechanisms.map(m => `
            <div class="p-2.5 border border-dashed border-[var(--inner-border-soft)] ${m.discovered ? 'bg-black/10' : 'opacity-65'}">
              <div class="font-bold ${m.discovered ? 'text-[#9e1b1b]' : ''}">${m.discovered ? `✓ ${m.title}` : '？ ？ ？ [机密未触发]'}</div>
              <div class="text-[11px] mt-0.5">${m.discovered ? m.desc : '尚未触发该项隐藏收容协议'}</div>
            </div>
          `).join(''));
        }
      }

      function renderSlot5x3History() {
        document.getElementById('slot5x3-history-header').textContent = `— 运转记录 共 ${slot5x3State.history.length} 转${slot5x3State.history.length>20?' · 展示最近 20 转':''}`;
        const listEl = document.getElementById('slot5x3-history-list');
        if (!listEl) return;
        if (slot5x3State.history.length === 0) {
          listEl.innerHTML = `<div class="py-4 text-center opacity-60">尚无运转记录。</div>`;
          return;
        }
        listEl.innerHTML = slot5x3State.history.slice(0,20).map((h, i) => `
          <div class="p-2 inner-card-alt flex justify-between items-center">
            <span>#${i + 1} 转 | 投入 ${h.bet.toLocaleString()}</span>
            <strong class="${h.win > h.bet ? 'text-[#9e1b1b]' : 'opacity-60'}">${AVEDGameResults.text({cost:h.bet,prize:h.win,penalty:h.penalty,penaltyKind:h.penaltyKind})}</strong>
          </div>
        `).join('');
      }

      function initSlot5x3Game() {
        loadSlotHistory();
        renderSlot5x3Board();
      }

      document.getElementById('slot5x3-minus-btn').addEventListener('click', () => {
        const inp = document.getElementById('slot5x3-bet-input');
        inp.value = Math.max(500, (parseInt(inp.value, 10) || 500) - 500);
        renderSlot5x3Board();
      });
      document.getElementById('slot5x3-plus-btn').addEventListener('click', () => {
        const inp = document.getElementById('slot5x3-bet-input');
        inp.value = Math.min(100000, (parseInt(inp.value, 10) || 500) + 500);
        renderSlot5x3Board();
      });
      document.getElementById('slot5x3-double-btn').addEventListener('click', () => {
        const inp = document.getElementById('slot5x3-bet-input');
        inp.value = Math.min(100000, (parseInt(inp.value, 10) || 500) * 2);
        renderSlot5x3Board();
      });
      document.querySelectorAll('.slot-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('slot5x3-bet-input').value = parseInt(btn.getAttribute('data-slot-chip'), 10);
          renderSlot5x3Board();
        });
      });
      document.getElementById('slot5x3-bet-input').addEventListener('input',renderSlot5x3Board);




      // ======================================================================
      // 分页 6-3：多档位 3 款配给刮刮乐（已彻底去除猫咪，改为严肃 SCP 收容配给主题，隐藏EV）
      // ======================================================================
      const scratchTiers = [
        { id: 't1', name: 'D级配给', cost: 1000, internalEv: 0.50, mult: 1 },
        { id: 't2', name: '外勤站点', cost: 3000, internalEv: 0.56, mult: 3 },
        { id: 't3', name: '收容金库', cost: 10000, internalEv: 0.62, mult: 10 },
        { id: 't4', name: '深渊凭证', cost: 20000, internalEv: 0.68, mult: 20 },
        { id: 't5', name: '董事特批', cost: 50000, internalEv: 0.74, mult: 50 },
        { id: 't6', name: 'O5最高秘钥', cost: 100000, internalEv: 0.80, mult: 100 }
      ];

      const scratchGameTypes = [
        {
          type: 'three_match',
          sub: '集章领赏',
          title: '三印报喜',
          tagline: '集齐三枚同印，领取当班津贴',
          icon: '🔺',
          cellsCount: 12,
          baseTopPrize: 325000,
          bgBand: 'bg-[#141413] text-white',
          cardBg: 'bg-[#e8e2d2]',
          accentColor: 'text-[#9e1b1b]',
          rules: [
            '一、刮开票面上的 12 枚公司印章',
            '二、同一收容印章凑满三枚即成一组',
            '三、同一张票可领多组津贴'
          ]
        },
        {
          type: 'lucky_num',
          sub: '凭号领赏',
          title: '幸运号签',
          tagline: '对上领赏号码，就有一份小惊喜',
          icon: '📡',
          cellsCount: 13,
          baseTopPrize: 650000,
          bgBand: 'bg-[#26292e] text-white',
          cardBg: 'bg-[#dfe3e6]',
          accentColor: 'text-[#141413]',
          rules: [
            '一、刮开上方 3 个领赏号与核准印',
            '二、刮开下方 9 个票号，对上领赏号即得对应奖金',
            '三、核准印可放大奖金，也会加重炸弹扣款'
          ]
        },
        {
          type: 'step_climb',
          sub: '五站巡签',
          title: '步步添彩',
          tagline: '走过五个站点，签下一份好彩头',
          icon: '⚡',
          cellsCount: 10,
          baseTopPrize: 325000,
          bgBand: 'bg-[#4a1612] text-white',
          cardBg: 'bg-[#ebe4d8]',
          accentColor: 'text-[#9e1b1b]',
          rules: [
            '一、五个站点各有两枚签号，共 10 格',
            '二、右侧员工签号大于左侧站点签号，即通过该站',
            '三、通过的每个站点均可领奖'
          ]
        }
      ];

      let selectedTier = scratchTiers[0];
      let pendingTicketType = null;
      let activeIssuedTicket = null;



      const scratchTierNames={t1:'随手',t2:'当班',t3:'加签',t4:'特别',t5:'珍藏',t6:'典藏'};
      const scratchTierName=t=>scratchTierNames[t.id]||t.name;
      const scratchTierAmount=t=>String(t.cost);
      function scratchPreview(g){
        const foil=(revealed=false)=>`<span class="scratch-mini-foil ${revealed?'mini-revealed':''}">${revealed?AVEDScratchSymbols.render(g.type):''}</span>`;
        if(g.type==='three_match')return `<div class="scratch-mini-match">${Array.from({length:12},()=>foil()).join('')}</div>`;
        if(g.type==='lucky_num')return `<div class="scratch-mini-reference">${Array.from({length:4},()=>foil()).join('')}</div><div class="scratch-mini-numbers">${Array.from({length:9},()=>foil()).join('')}</div>`;
        return `<div class="scratch-mini-steps">${Array.from({length:5},(_,i)=>`<div style="--step-indent:${(4-i)*5}px">${foil()}${foil()}<i></i></div>`).join('')}</div>`;
      }
      function renderScratchTiersAndLobby() {
        const tiersBar = document.getElementById('scratch-tiers-bar');
        const lobbyView = document.getElementById('scratch-lobby-view');

        if (tiersBar) {
          tiersBar.innerHTML = scratchTiers.map(t => {
            const active = t.id === selectedTier.id;
            return `
              <button type="button" data-tier-id="${t.id}" aria-label="${scratchTierName(t)}档，${t.cost}积分" aria-pressed="${active}"
                class="scratch-tier-btn p-2.5 border transition text-center cursor-pointer ${active ? 'bg-[var(--inner-accent)] text-[var(--inner-accent-text)] border-black font-bold shadow' : 'bg-[#141414] text-neutral-300 border-white/20 hover:border-white'}">
                <div class="text-[11px] opacity-80">${scratchTierName(t)}</div>
                <div class="text-sm font-bold mt-0.5">${scratchTierAmount(t)}</div>
              </button>
            `;
          }).join('');

          tiersBar.querySelectorAll('.scratch-tier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const tid = btn.getAttribute('data-tier-id');
              selectedTier = scratchTiers.find(x => x.id === tid) || scratchTiers[0];
              playSfx('click');
              renderScratchTiersAndLobby();
            });
          });
        }

        if (lobbyView) {
          lobbyView.innerHTML = ['lucky_num','three_match','step_climb'].map(type=>scratchGameTypes.find(g=>g.type===type)).map(g => {
            const topPrize = selectedTier.topPrizes?.[g.type];
            return AVEDScratchTicketArt.lobby(g,selectedTier.cost,topPrize);
          }).join('');

          lobbyView.querySelectorAll('.pick-scratch-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const gType = btn.getAttribute('data-pick-game');
              openTicketConfirmModal(gType);
            });
          });
        }
      }

      function scratchRulesMarkup(game){return [...game.rules,'四、0.2% 概率出现炸弹，额外扣除票价的 1 / 2 / 4 倍，可产生负余额。'].map(rule=>`<p>${esc(rule)}</p>`).join('');}
      function openTicketConfirmModal(gType) {
        if (!currentUser) return;
        const g = scratchGameTypes.find(x => x.type === gType);
        if (!g) return;
        pendingTicketType = g;
        playSfx('click');


        document.getElementById('ticket-modal-sublabel').textContent = `选票 · ${scratchTierName(selectedTier)}档 · ${g.sub}`;
        document.getElementById('ticket-modal-title').textContent = g.title;
        document.getElementById('ticket-modal-tagline').textContent = g.tagline;
        document.getElementById('ticket-modal-price').textContent = fmtMoney(selectedTier.cost);
        document.getElementById('ticket-modal-price').dataset.cost=selectedTier.cost;document.getElementById('ticket-modal-price').dataset.revision=economyRevision;
        document.getElementById('ticket-modal-top-prize').textContent = Number.isFinite(selectedTier.topPrizes?.[g.type])?fmtMoney(selectedTier.topPrizes[g.type]):'待调阅';
        document.getElementById('ticket-modal-balance-preview').textContent =
          '刮开扣除票面金额，\n未刮开可以免费跳过。';

        document.getElementById('ticket-modal-rules').innerHTML=scratchRulesMarkup(g);

        const modal = document.getElementById('ticket-confirm-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }

      document.getElementById('ticket-modal-cancel-btn').addEventListener('click', () => {
        const modal = document.getElementById('ticket-confirm-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      });


      document.getElementById('ticket-modal-close').addEventListener('click',()=>document.getElementById('ticket-modal-cancel-btn').click());
      const scratchFeedback=AVEDScratchFeedback({playSfx,isActive:()=>!byId('view-casino').classList.contains('hidden')&&!byId('scratch-play-table-view').classList.contains('hidden')});
      let lastScratchRules='';
      function scratchCellMarkup(c,tk){
        const seal=tk.gameType.type==='lucky_num'&&c.idx===3;
        if(!c.revealed)return `<button type="button" data-scratch-cell="${c.idx}" class="scratch-cell-foil sp-cell sp-covered ${seal?'sp-seal':''} h-20 flex flex-col items-center justify-center p-2 text-center"><span class="sp-coat">${AVEDPixelIcons.render('eye')}<b>${seal?'核准倍率':'刮开好运'}</b></span></button>`;
        return `<div data-revealed-cell="${c.idx}" class="scratch-revealed-cell sp-cell ${seal?'sp-seal':''} ${c.isBomb?'is-bomb':''} h-20 border-2 ${c.isWinPart?'is-winning border-[#9e1b1b] bg-[#fff5f5]':'border-black/35 bg-white'} text-[#141413] flex flex-col items-center justify-center p-2 text-center"><div class="text-sm font-bold ${c.isWinPart?'text-[#9e1b1b]':''}">${AVEDScratchSymbols.render(c.role==='LUCKY'?c.label.replace('领赏号 ',''):c.label)}</div><div class="text-[11px] font-mono-tech mt-0.5 opacity-80">${c.isBomb?AVEDGameResults.bombName(tk)+'！':c.role==='LUCKY'?'领赏号':c.sub}</div></div>`;
      }
      const scratchBoard=AVEDScratchBoard({host:byId('active-ticket-board-container'),cell:scratchCellMarkup,frame(tk,cells){
        const kind=tk.gameType.type,cols=kind==='step_climb'?'scratch-step-grid sp-step-grid':kind==='lucky_num'?'scratch-reference-grid sp-refs':'scratch-match-grid sp-stamps';
        return AVEDScratchTicketArt.board(tk,`<div class="grid ${cols} gap-3">${cells.map((html,i)=>(kind==='lucky_num'&&i===4?'</div><div class="grid scratch-prize-grid sp-nums">':'')+html).join('')}</div>`);
      }});
      function renderActiveScratchTicketBoard(revealedIndices=[],feedbackOptions={}) {
        if(!activeIssuedTicket)return;const tk=activeIssuedTicket;
        const rules=scratchRulesMarkup(scratchGameTypes.find(g=>g.type===tk.gameType.type)||tk.gameType);
        if(rules!==lastScratchRules){byId('scratch-play-rules-body').innerHTML=rules;lastScratchRules=rules;}
        const board=byId('active-ticket-board-container');scratchBoard.render(tk);
        scratchFeedback.reveal(board,revealedIndices,feedbackOptions);
        if(tk.penalty>0&&!tk.bombFeedbackPlayed&&revealedIndices.some(index=>tk.cells[index]?.isBomb)){
          tk.bombFeedbackPlayed=true;byId('active-ticket-result-banner').textContent=(tk.demo?'测试 · ':'')+AVEDGameResults.text(tk);
          scratchFeedback.settle(byId('active-ticket-result-banner'),tk);
        }
      }
      byId('active-ticket-board-container').addEventListener('click',async event=>{
        const button=event.target.closest('[data-scratch-cell]');if(!button||!event.currentTarget.contains(button))return;
        const idx=Number(button.dataset.scratchCell);if(!await activateScratchTicket())return;
        const tk=activeIssuedTicket;if(!tk?.cells[idx]||tk.cells[idx].revealed)return;
        tk.cells[idx].revealed=true;playSfx('scratch');
        renderActiveScratchTicketBoard([idx],{profit:tk.prize>tk.cost,winning:tk.cells[idx].isWinPart&&!tk.cells.every(c=>c.revealed)});
        checkAndSettleScratchTicket('manual');
      });

      document.getElementById('scratch-reveal-all-cells-btn').addEventListener('click', async () => {
        if (!activeIssuedTicket) return;
        if(activeIssuedTicket.settled)return;
        if(!await activateScratchTicket())return;
        const revealed=activeIssuedTicket.cells.filter(c=>!c.revealed).map(c=>c.idx);
        activeIssuedTicket.cells.forEach(c => { c.revealed = true; });
        playSfx('scratch');
        renderActiveScratchTicketBoard(revealed);
        checkAndSettleScratchTicket('all');
      });

      document.getElementById('scratch-back-lobby-btn').addEventListener('click', () => {
        document.getElementById('scratch-play-table-view').classList.add('hidden');byId('scratch-back-lobby-btn').classList.add('hidden');
        document.getElementById('scratch-lobby-view').classList.remove('hidden');
      });

      // ======================================================================
      // 分页 6-4：异常竞速赛马
      // ======================================================================
      // Game pages share one route-driven navigator in player-community.js.

      // KARMA INDEX 股市
      function applyMarket(data) {
        if(data.items)stocksData.splice(0,stocksData.length,...data.items);
        if(data.orders)stockOrdersData.splice(0,stockOrdersData.length,...data.orders);
        if(data.market?.code===marketCode&&data.market.period===marketPeriod)marketView=data.market;
        if(data.serverTime)AVEDTime.sync(data.serverTime);
        if(typeof data.balance==='number'){currentUser.balance=data.balance;syncUserHeaderUI();}
        renderStocks();
      }
      async function refreshMarket() {
        if(!marketVisible()||marketBusy)return;marketBusy=true;
        const code=marketCode,period=marketPeriod;
        try {
          const data=await api('/api/player/stocks?code='+encodeURIComponent(code)+'&period='+period);
          if(code===marketCode&&period===marketPeriod)applyMarket(data);
        } finally {marketBusy=false;if(code!==marketCode||period!==marketPeriod)refreshMarket().catch(e=>showToast(e.message));}
      }
      const byId=id=>document.getElementById(id);
      window.AVEDPersonalRecord=AVEDPersonalRecords.create({getUser:()=>currentUser,enabled:()=>!!currentUser&&!byId('view-casino').classList.contains('hidden'),playSfx,onRecord:()=>{profileFreshAt=0;}});
      const slotEffects=AVEDSlotEffects({panel:byId('game-panel-slots'),grid:byId('slot5x3-grid'),playSfx});
      function renderStocks() {
        economyUI?.renderHoldings();
        const movementMeta=(current,previous)=>previous==null?{arrow:'•',className:'tick-flat'}:(current>previous?{arrow:'↑',className:'tick-up'}:(current<previous?{arrow:'↓',className:'tick-down'}:{arrow:'•',className:'tick-flat'}));
        const value=marketView?.index;
        if(value){
          const indexMove=movementMeta(value.price,previousIndexPrice);
          document.getElementById('karma-index-val').textContent=(value.price/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
          const indexTick=document.getElementById('karma-index-tick');if(indexTick){indexTick.textContent=indexMove.arrow;indexTick.className='market-tick-indicator '+indexMove.className;}
          const delta=document.getElementById('karma-index-delta');delta.textContent=(value.change>=0?'+':'')+value.change.toFixed(2)+'%';delta.className='market-change '+(value.change>=0?'market-up':'market-down');
          previousIndexPrice=value.price;
        }
        const select=document.getElementById('stock-chart-symbol');
        select.innerHTML='<option value="KARMA">KARMA INDEX</option>'+stocksData.filter(stock=>stock.code!=='KARMA').map(stock=>'<option value="'+esc(stock.code)+'">'+esc(stock.name)+'</option>').join('');select.value=marketCode;
        document.getElementById('stock-chart-period').value=String(marketPeriod);
        const quote=marketView?.quote;
        if(quote){
          const quotePrev=quote.code==='KARMA'?previousIndexPrice:previousQuotePrices.get(quote.code);
          const quoteMove=movementMeta(quote.price,quotePrev);
          document.getElementById('market-selected-name').textContent=quote.code==='KARMA'?'KARMA INDEX':stocksData.find(s=>s.code===quote.code)?.name||quote.code;
          document.getElementById('market-selected-price').textContent=quote.code==='KARMA'?(quote.price/100).toFixed(2):fmtMoney(quote.price);
          const selectedTick=document.getElementById('market-selected-tick');if(selectedTick){selectedTick.textContent=quoteMove.arrow;selectedTick.className='market-tick-indicator '+quoteMove.className;}
          const change=document.getElementById('market-selected-change');change.textContent=(quote.change>=0?'+':'')+quote.change.toFixed(2)+'%';change.className=quote.change>=0?'market-up':'market-down';
          AVEDMarketChart.render(document.getElementById('stock-candles'),marketView.candles,{isIndex:quote.code==='KARMA'});
        }
        const container=byId('stocks-table-body');
        const orderedStocks=[...stocksData].sort((a,b)=>Number(b.code==='KARMA')-Number(a.code==='KARMA'));
        container.innerHTML=orderedStocks.map(stock=>`<button type="button" class="stock-list-row" data-stock-chart-code="${esc(stock.code)}" aria-pressed="${marketCode===stock.code}"><span><b>${esc(stock.name)}</b><small>${esc(stock.code)}</small></span><strong class="${stock.change>=0?'market-up':'market-down'}">${fmtMoney(stock.price)}</strong><span class="stock-list-change ${stock.change>=0?'market-up':'market-down'}">${stock.change>=0?'+':''}${stock.change.toFixed(2)}%</span></button>`).join('');
        const tradeSelect=byId('stock-trade-symbol'),oldCode=tradeSelect.value;
        tradeSelect.innerHTML=orderedStocks.map(stock=>'<option value="'+esc(stock.code)+'">'+esc(stock.name)+' · '+esc(stock.code)+'</option>').join('');
        tradeSelect.value=stocksData.some(s=>s.code===marketCode)?marketCode:stocksData.some(s=>s.code===oldCode)?oldCode:stocksData[0]?.code||'';
        renderTradeTicket();
        stocksData.forEach(stock=>previousQuotePrices.set(stock.code,stock.price));
      }
      // One persistent ticket: live quotes never replace quantity or risk inputs.
      const stockDrafts=new Map();
      let draftCode='',stockTradeBusy=false;
      function renderTradeTicket(){
        const code=byId('stock-trade-symbol').value,stock=stocksData.find(s=>s.code===code);
        if(draftCode!==code){
          if(draftCode)stockDrafts.set(draftCode,Object.fromEntries(['quantity','leverage','stop','take'].map(key=>[key,byId('stock-trade-'+key).value])));
          const draft=stockDrafts.get(code)||{quantity:'1',leverage:'1',stop:'',take:''};
          for(const key of ['quantity','leverage','stop','take'])byId('stock-trade-'+key).value=draft[key];
          draftCode=code;
        }
        byId('stock-trade-position').textContent=stock?'现价 '+fmtMoney(stock.price)+' · 持仓 '+Math.abs(stock.holding).toLocaleString()+(code==='KARMA'?' 份':' 股')+(stock.holding?'（'+(stock.holding<0?'买跌':'买涨')+'）':''):'请选择证券';
        const amount=(stock?.price||0)*(Number(byId('stock-trade-quantity').value)||0),leverage=Number(byId('stock-trade-leverage').value)||1;
        byId('stock-est-trade').textContent=fmtMoney(amount);
        byId('stock-est-margin').textContent=fmtMoney(Math.ceil(amount/leverage));
        byId('stock-trade-ticket').querySelectorAll('[data-stock-trade-side]').forEach(button=>button.disabled=!stock||stockTradeBusy||(button.dataset.stockTradeSide==='close'?!stock.holding:stock.holding&&((stock.holding>0)!==(button.dataset.stockTradeSide==='long'))));
      }
      function selectMarket(code){
        marketCode=code;
        if(stocksData.some(s=>s.code===code)){byId('stock-trade-symbol').value=code;renderTradeTicket();}
        byId('stock-chart-symbol').value=code;
        byId('stocks-table-body').querySelectorAll('[data-stock-chart-code]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stockChartCode===code)));
        refreshMarket().catch(e=>showToast(e.message,'warn'));
      }
      byId('next-market-tick-btn').addEventListener('click',()=>refreshMarket().catch(e=>showToast(e.message,'warn')));
      byId('stock-chart-symbol').addEventListener('change',event=>selectMarket(event.target.value));
      byId('stock-chart-period').addEventListener('change',event=>{marketPeriod=Number(event.target.value);refreshMarket().catch(e=>showToast(e.message,'warn'));});
      byId('stocks-table-body').addEventListener('click',event=>{const button=event.target.closest('[data-stock-chart-code]');if(button)selectMarket(button.dataset.stockChartCode);});
      document.querySelector('[data-market-index]').addEventListener('click',()=>selectMarket('KARMA'));
      byId('stock-trade-symbol').addEventListener('change',event=>selectMarket(event.target.value));
      byId('stock-trade-ticket').addEventListener('input',event=>{if(event.target.matches('input,select'))renderTradeTicket();});

      // 在线牌桌
      const rankOrder = [
        { label: '3', val: 3 }, { label: '4', val: 4 }, { label: '5', val: 5 },
        { label: '6', val: 6 }, { label: '7', val: 7 }, { label: '8', val: 8 },
        { label: '9', val: 9 }, { label: '10', val: 10 }, { label: 'J', val: 11 },
        { label: 'Q', val: 12 }, { label: 'K', val: 13 }, { label: 'A', val: 14 },
        { label: '2', val: 15 }
      ];
      const suits = ['♠', '♥', '♣', '♦'];

      let cardTableUI=null;

      // ======================================================================
      // 分页 7：监察院特殊资料
      // ======================================================================
      function renderPendingImagesQueue(){}
      function renderAnonAuditLog(){}
      function renderEmployeeRoster(){}
      let economyUI=null,welfareUI=null,economyRevision=0,directoryRequest=0;
      let marketView=null,marketCode='KARMA',marketPeriod=1,marketBusy=false;
      const previousQuotePrices=new Map();
      let previousIndexPrice=null;
      let playerGameRecords=null,playerHistory=[],playerProfile={},playerAchievements=[],skyRound=null,skyPollBusy=false;
      function showToast(message,type='info') {
        window.AVEDFeedback.toast(message,type);
      }
      function employeeDirectoryCard(e){return {id:String(e.id),name:esc(e.displayName),department:esc(e.department),positionTitle:esc(e.positionTitle||''),isNpc:!!e.isNpc,isLeadership:!!e.isLeadership,identityKind:e.identityKind,bracketTag:esc(e.positionTitle||(e.identityKind?.endsWith('_containment')?'收容物':e.enabled===0?'暂停接入':'成员')),stats:[0,0,0,0,0,0],location:'',abilityNote:esc(e.identityKind?.endsWith('_containment')?(e.bio||''):e.registeredDepartment&&e.registeredDepartment!==e.department?e.registeredDepartment:''),avatarBadge:'员',avatarColor:'#444',avatarUrl:e.avatarUrl||''};}
      async function refreshDirectory(){if(!currentUser)return;const serial=++directoryRequest;const d=await api('/api/player/directory');if(serial!==directoryRequest)return;employees=d.items.map(employeeDirectoryCard);renderDepartmentsAndPersonnel();}
      function applyEconomyRules(c){economyRevision=c.revision;for(const t of c.tiers){const tier=scratchTiers.find(x=>x.id===t.id);if(tier)Object.assign(tier,t);}if(c.slot?.symbols)for(const s of c.slot.symbols){const symbol=slot5x3Symbols.find(x=>x.id===s.id);if(symbol)Object.assign(symbol,s);}economyUI?.configure(c);}
      async function loadPlayerData() {
        forumListPosition=null;forumListMarkup='';currentForumThreadId=null;forumReplies.reset();
        deferredSections.clear();deferredRequests.clear();
        const data=await api('/api/player/state?bootstrap=1',{timeoutMs:15000,retries:0});if(!data.employee||!data.profile||!Array.isArray(data.employees)||!Array.isArray(data.departments)||!Array.isArray(data.announcements)||!Array.isArray(data.dossiers)||!Array.isArray(data.stocks)||!Array.isArray(data.history)||!Array.isArray(data.achievements)||!Array.isArray(data.forum?.items))throw new Error('员工资料未完整送达，请重新接入。');AVEDTime.sync(data.serverTime);marketView=data.market;playerProfile=data.profile;window.AVEDAppearance?.setEntitlements(playerProfile.appearance);playerAchievements=data.achievements;playerGameRecords=data.gameRecords||null;playerHistory=data.history;profileFreshAt=Date.now();
        if(data.economy)applyEconomyRules(data.economy);
        employees=data.employees.map(employeeDirectoryCard);
        departmentsData.splice(0,departmentsData.length,...data.departments.map(d=>({...d,name:esc(d.name),desc:esc(d.desc),motto:esc(d.motto),minister:''})));
        currentUser={id:String(data.employee.id),name:data.employee.displayName,account:data.employee.username,department:data.employee.department,bracketTag:/^公司直属(?:部|领导)?$/.test(data.employee.department||'')&&data.employee.positionTitle?data.employee.positionTitle:data.employee.department,
          identityKind:data.employee.identityKind,positionTitle:data.employee.positionTitle||data.employees.find(e=>String(e.id)===String(data.employee.id))?.positionTitle||'',isAdmin:false,serverAdmin:data.employee.role==='admin',balance:data.balance,savedAlias:data.profile.anonymousName,streak:data.streak,lastCheckinDate:data.checkin?getTodayDateString():'',avatarBadge:'员',avatarColor:'#444'};
        companyNews=data.announcements.map(n=>({id:String(n.id),title:esc(n.title),code:'AVED-'+n.id,category:n.pinned?'置顶公告':'公司通告',pinned:!!n.pinned,createdAt:n.createdAt,recipient:n.recipient||'',issuer:n.issuer||'',postCount:Number(n.postCount)||0,summary:esc(AVEDNotices.excerpt(n.body)),fullContent:esc(n.body),realComments:[]}));
        scpItemsData=data.dossiers.map(d=>({id:esc(d.code),dbId:d.id,codeName:esc(d.title),searchName:d.title,department:esc(d.department),level:esc(d.status),summary:esc(d.summary),description:esc(d.summary),procedure:'收容规程见本卷宗。',handlers:'',location:'',clues:[],pinLabel:'ARCHIVE',polaroidTag:'收容物档案',realComments:[]}));
        forumThreads=data.forum.items;forumDetail=null;forumBrowser.reset();
        stocksData.splice(0,stocksData.length,...data.stocks);stockOrdersData.splice(0,stockOrdersData.length,...(data.stockOrders||[]));
        return currentUser;
      }
      const deferredSections=new Set(),deferredRequests=new Map();
      function loadDeferredPlayerData(section){
        if(!currentUser||deferredSections.has(section))return Promise.resolve();
        if(deferredRequests.has(section))return deferredRequests.get(section);
        const owner=currentUser.id,panel=byId('view-'+section);panel?.setAttribute('aria-busy','true');
        const task=api('/api/player/state?section='+encodeURIComponent(section)).then(data=>{
          if(currentUser?.id!==owner)return;
          if(section==='departments')employees=data.employees.map(employeeDirectoryCard);
          if(section==='departments'||section==='life'){
            departmentsData.splice(0,departmentsData.length,...data.departments.map(d=>({...d,name:esc(d.name),desc:esc(d.desc),motto:esc(d.motto),minister:''})));
            document.querySelectorAll('#life-filters [name="department"],#life-create [name="department"]').forEach(select=>{
              const selected=select.value,first=select.options[0]?.textContent||'全部部门';select.innerHTML='<option value="">'+esc(first)+'</option>'+data.departments.map(d=>'<option value="'+esc(d.name)+'">'+esc(d.name)+'</option>').join('');select.value=selected;
            });
          }
          if(section==='news')companyNews=data.announcements.map(n=>({id:String(n.id),title:esc(n.title),code:'AVED-'+n.id,category:n.pinned?'置顶公告':'公司通告',pinned:!!n.pinned,createdAt:n.createdAt,recipient:n.recipient||'',issuer:n.issuer||'',postCount:Number(n.postCount)||0,summary:esc(AVEDNotices.excerpt(n.body)),fullContent:esc(n.body),realComments:[]}));
          if(section==='containment')scpItemsData=data.dossiers.map(d=>({id:esc(d.code),dbId:d.id,codeName:esc(d.title),searchName:d.title,department:esc(d.department),level:esc(d.status),summary:esc(d.summary),description:esc(d.summary),procedure:'收容规程见本卷宗。',handlers:'',location:'',clues:[],pinLabel:'ARCHIVE',polaroidTag:'收容物档案',realComments:[]}));
          if(section==='forum'){forumBrowser.seed(data.forum);}
          if(section==='casino'){marketView=data.market;stocksData.splice(0,stocksData.length,...data.stocks);stockOrdersData.splice(0,stockOrdersData.length,...data.stockOrders);renderStocks();welfareUI.refresh().catch(()=>{});}
          if(section==='news')renderCompanyNewsView();
          if(section==='departments')renderDepartmentsAndPersonnel();
          if(section==='containment'){renderScpArchives();if(!scpSearchInput.value)randomizeScpDualNamePlaceholder();}
          deferredSections.add(section);
        }).finally(()=>{deferredRequests.delete(section);panel?.removeAttribute('aria-busy');});
        deferredRequests.set(section,task);return task;
      }
      function syncUserHeaderUI() {
        if(!currentUser)return;
        byId('welcome-employee-banner').textContent='当前用户：'+currentUser.name;
        byId('intranet-role').textContent='当前身份 ID：['+(currentUser.savedAlias||playerProfile.anonymousName||'未登记')+']';
        if(byId('hub-balance'))byId('hub-balance').textContent=fmtMoney(currentUser.balance);
        if(lastProfileBalance!==null&&lastProfileBalance!==currentUser.balance)profileFreshAt=0;lastProfileBalance=currentUser.balance;
        byId('forum-current-balance').textContent='当前余额 '+fmtMoney(currentUser.balance);
        byId('top-balance-val').textContent=fmtMoney(currentUser.balance);
        window.AVEDCasinoSwitcher?.sync();
        const checked=currentUser.lastCheckinDate===getTodayDateString();
        byId('header-quick-checkin-btn').textContent=checked?'已签到':'签到';byId('header-quick-checkin-btn').disabled=checked;
        byId('header-quick-relief-btn').classList.remove('hidden');byId('header-quick-relief-btn').disabled=currentUser.balance>=10000;byId('header-quick-relief-btn').textContent='领取低保';
        byId('claim-relief-btn').textContent='余额低于 10,000 可领低保';
      }
      async function refreshBalance(){const d=await api('/api/me');if(currentUser){currentUser.balance=d.balance;syncUserHeaderUI();}}
      async function performDailyCheckin(){try{const d=await api('/api/checkin',{method:'POST'});currentUser.balance=d.balance;currentUser.lastCheckinDate=getTodayDateString();syncUserHeaderUI();showToast('签到成功，已入账 '+fmtMoney(d.reward));welfareUI?.refresh().catch(()=>{});window.AVEDRewardsRefresh?.().catch(()=>{});}catch(e){showToast(e.message,'warn');}}
      async function performClaimRelief(){try{const d=await api('/api/player/relief',{method:'POST'});currentUser.balance=d.balance;syncUserHeaderUI();showToast('低保已入账 10,000。');welfareUI?.refresh().catch(()=>{});window.AVEDRewardsRefresh?.().catch(()=>{});}catch(e){showToast(e.message,'warn');}}
      async function completeEnterIntranet(emp){
        innerAppView.classList.add('intranet-preparing');
        try{
        const art=await prepareTerminalArt();
        currentUser=emp;aliasInputEl.value=playerProfile.anonymousName;
        document.querySelectorAll('link[data-inner-fonts]').forEach(link=>{if(!link.hasAttribute('href'))link.href=link.dataset.innerFonts;});
        document.body.classList.remove('theme-landing');document.body.classList.add('theme-inner');
        landingView.classList.add('hidden');innerAppView.classList.remove('hidden');
        syncUserHeaderUI();renderCompanyNewsView();renderDepartmentsAndPersonnel();renderScpArchives();renderForumView();
        renderScratchTiersAndLobby();initSlot5x3Game();restorePlayerRoute(true);
        communityUI.refresh();

        // Chat streams open only while their game panel is visible.
        startChatStreams();
        await nextPaint();
        if(art.shown){signalOverlay.dataset.assetLoading='complete';signalPhase('欢迎归岗，'+emp.name,100,'接入许可已签发。您的工作终端已就绪。');await new Promise(resolve=>setTimeout(resolve,prefersReducedMotion?0:art.cached?80:180));}
        document.documentElement.dataset.entryState='ready';
        }finally{innerAppView.classList.remove('intranet-preparing');}
      }
      function renderCompanyNewsView(){
        const n=companyNews.find(n=>n.id===currentNewsId);
        byId('news-list-subview').classList.toggle('hidden',!!n);byId('news-detail-subview').classList.toggle('hidden',!n);
        if(!n){byId('news-list-subview').innerHTML=AVEDNotices.list(companyNews);return;}
        byId('news-detail-article-box').innerHTML=AVEDNotices.article(n);
        byId('news-comment-identity-label').textContent='署名：'+currentUser.name;
        byId('news-detail-comments-list').textContent='正在调阅留言…';
        byId('news-detail-comment-count').textContent='员工实名留言（读取中）';
        refreshNoticeComments(n.id).catch(e=>{if(currentNewsId===n.id)byId('news-detail-comment-count').textContent='员工实名留言（读取失败）';showToast(e.message,'warn');});
      }
      let noticeCommentsRequest=0;
      async function refreshNoticeComments(id){
        const request=++noticeCommentsRequest,data=await api('/api/posts?announcementId='+id);
        if(currentNewsId!==id||request!==noticeCommentsRequest)return;
        const count=data.items.length,n=companyNews.find(item=>item.id===id);if(n)n.postCount=count;
        byId('news-detail-comments-list').innerHTML=AVEDNotices.comments(data.items);
        byId('news-detail-comment-count').textContent='员工实名留言 ('+count+')';
      }
      function randomizeScpDualNamePlaceholder(){const item=scpItemsData.length?scpItemsData[Math.floor(Math.random()*scpItemsData.length)]:null;byId('scp-search-input').placeholder=item?(item.searchName||item.codeName):'检索收容物名称';}
      function triggerForumSkeletonLoading(){renderForumView();}
      function readImageFileAsDataUrl(file,callback){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1500000){showToast('请选择 1.5 MB 以内的 PNG、JPG 或 WEBP 图片。','warn');return;}const reader=new FileReader();reader.onload=()=>callback(reader.result);reader.readAsDataURL(file);}
      const forumEditControl=(item,kind)=>`${item.editedAt?`<p class="edited-label">已编辑 ${AVEDTime.markup(item.editedAt)} ${AVEDTime.markup(item.editedAt,'clock')}</p>`:''}${item.canEdit?`<button type="button" class="community-button forum-edit-action" data-edit-speech="${kind}" data-speech-id="${item.id}">编辑发言</button>`:''}`;
      const attachment=item=>item.imageData?`<img src="${esc(item.imageData)}" class="max-w-full max-h-96 object-contain mt-3" alt="随帖影像" loading="lazy">`:'';
      let forumSocialUI=null,forumDetail=null;
      const forumBrowser=AVEDForumBrowser({api,getUser:()=>currentUser,onError:message=>showToast(message,'warn'),onData:data=>{forumThreads=data.items;renderForumView();}});
      const forumReplies=AVEDForumReplies({api,container:byId('forum-detail-replies-list'),count:byId('forum-detail-reply-count'),
        enabled:()=>!!currentUser&&!document.hidden&&!byId('view-forum').classList.contains('hidden')&&!!currentForumThreadId,
        onError:message=>showToast(message,'warn'),onThread:thread=>{forumDetail=thread;const preview=forumThreads.find(t=>String(t.id)===String(thread.id));if(preview)Object.assign(preview,{replyCount:thread.replyCount,title:thread.title,body:Array.from(thread.body||'').slice(0,100).join(''),truncated:Array.from(thread.body||'').length>100});renderForumMain(thread);},onSeen:ids=>forumSocialUI?.seenReplies(currentForumThreadId,ids),
        renderItem:r=>`<div class="forum-post-meta"><span>${forumAuthor(r)}${r.isTopicAuthor?'<small class="forum-op-badge">楼主</small>':''}<small class="forum-floor">${r.floor} 楼</small>${forumBalance(r)}</span>${AVEDTime.markup(r.createdAt)}</div>${r.replyToId?`<button type="button" class="forum-reply-quote" data-forum-quote="${r.replyToId}" aria-expanded="false"><b>↳ ${esc(r.replyToName)} · ${r.replyToFloor} 楼</b><span>${esc(r.replyToBody)}</span></button>`:''}<p class="forum-reply-body whitespace-pre-wrap">${esc(r.body)}</p>${attachment(r)}<div class="forum-reply-actions"><button type="button" class="community-button forum-reply-action" data-forum-reply="${r.id}">回复</button>${forumEditControl(r,'reply')}</div>`});
      function renderForumMain(th){const box=byId('forum-detail-main-post'),markup=`<div class="forum-post-meta"><span>${forumAuthor(th)}${forumBalance(th)}</span>${AVEDTime.markup(th.createdAt)}</div><h3 class="forum-detail-title">${esc(th.title)}</h3><p class="forum-detail-body whitespace-pre-wrap">${esc(th.body)}</p>${attachment(th)}${forumEditControl(th,'thread')}`;if(box.dataset.rendered!==markup){box.innerHTML=markup;box.dataset.rendered=markup;}}
      let forumListPosition=null,forumListMarkup='',forumRestoring=false;
      function forumScrollRoot(){
        for(let el=byId('view-forum').parentElement;el&&el!==document.body;el=el.parentElement){if(el.scrollHeight>el.clientHeight&&/auto|scroll/.test(getComputedStyle(el).overflowY))return el;}
        return document.scrollingElement;
      }
      function rememberForumPosition(button){const card=button.closest('article');forumListPosition={id:button.dataset.cloudThread,offset:card.getBoundingClientRect().top,top:forumScrollRoot().scrollTop};}
      function returnForumList(navigate=true){
        if(navigate!==false&&history.state?.avedForum?.owner===currentUser?.id&&history.state.avedForum.thread){history.back();return;}
        const root=forumScrollRoot(),anchoring=root.style.overflowAnchor;root.style.overflowAnchor='none';
        currentForumThreadId=null;forumDetail=null;forumRestoring=true;renderForumView();
        const restore=()=>{
          const saved=forumListPosition,card=saved&&byId('forum-threads-list-container').querySelector('[data-forum-thread="'+CSS.escape(String(saved.id))+'"]');
          root.scrollTo({top:card?root.scrollTop+card.getBoundingClientRect().top-saved.offset:saved?.top||0,behavior:'instant'});
        };
        requestAnimationFrame(()=>{restore();requestAnimationFrame(()=>{restore();root.style.overflowAnchor=anchoring;forumRestoring=false;});});
      }
      function renderForumView(replyId){
        const th=currentForumThreadId?(forumDetail||forumThreads.find(t=>String(t.id)===String(currentForumThreadId))):null;
        byId('forum-list-subview').classList.toggle('hidden',!!th);byId('forum-detail-subview').classList.toggle('hidden',!th);
        byId('forum-skeleton-container')?.classList.add('hidden');for(const id of ['forum-global-back','forum-toolbar-back'])if(byId(id))byId(id).hidden=!th;byId('forum-refresh-skeleton-btn').hidden=false;
        if(!th){currentForumThreadId=null;forumSocialUI?.cancelReply();forumReplies.reset();const markup=(forumThreads.map(t=>`<article data-forum-thread="${t.id}" class="retro-corner-box p-5 space-y-2"><div class="forum-post-meta"><span>${forumAuthor(t)}${forumBalance(t)}</span>${AVEDTime.markup(t.createdAt)}</div><h3 class="font-bold text-lg forum-card-title" title="${esc(t.title)}">${esc(t.title)}</h3><p class="forum-card-excerpt whitespace-pre-wrap">${esc(Array.from(t.body||'').slice(0,70).join(''))}${(t.truncated||Array.from(t.body||'').length>70)?'…':''}</p><button data-cloud-thread="${t.id}" class="inner-btn-primary px-3 py-2">进入帖子 (${t.replyCount}) →</button></article>`).join('')||'<p class="p-5">暂无帖子。</p>');
          if(markup!==forumListMarkup){forumListMarkup=markup;byId('forum-threads-list-container').innerHTML=markup;}
          return;}
        byId('forum-detail-thread-id-badge').textContent='THREAD #'+th.id;
        if(th.preview){byId('forum-detail-main-post').textContent='正在加载主题…';delete byId('forum-detail-main-post').dataset.rendered;}else renderForumMain(th);return forumReplies.open(th.id,replyId);
      }
      function forumBalance(item){return item.balance==null?'':`<span class="forum-author-balance"> · ${fmtMoney(item.balance)}</span>`;}
      function forumAuthor(item){const name=item.anonymousName||'未登记内网 ID',real=!item.personaId&&item.identityMode==='real';return `<span class="forum-author" data-forum-presence="${esc(item.presenceKey||'')}" data-online="false"><span class="forum-author-avatar">${real&&item.avatarUrl?`<img src="${esc(item.avatarUrl)}" alt="" width="28" height="28" loading="lazy" decoding="async">`:'<small class="avatar-noinfo">NOINFO</small>'}<i class="forum-online-dot" aria-label="在线" hidden></i></span><b>${esc(name)}</b>${real?' <i class="forum-real-badge">实名</i>':''}${item.canEdit&&!item.personaId?'<small class="forum-mine-badge">我的发言</small>':''}<small class="forum-author-activity" hidden></small></span>`;}

      async function refreshForum(){if(currentForumThreadId)return forumReplies.refresh();return forumBrowser.load();}
      async function openForumThread(id,replyId,{navigation=true}={}){
        if(navigation&&String(history.state?.avedForum?.thread)!==String(id)){
          if(!currentForumThreadId)history.replaceState({...history.state,avedForum:{owner:currentUser.id,thread:null}},'',location.href);
          history.pushState({...history.state,avedForum:{owner:currentUser.id,thread:String(id),reply:replyId||null}},'',location.href);
        }
        currentForumThreadId=String(id);forumDetail=forumThreads.find(t=>String(t.id)===String(id))||{id,preview:true};
        return renderForumView(replyId);
      }
      function loadSlotHistory(){slot5x3State.history=playerHistory.filter(h=>h.game==='slot').map(h=>{let result={};try{result=typeof h.result==='string'?JSON.parse(h.result):h.result||{};}catch{}return {bet:h.cost,win:h.prize,penalty:result.penalty||0,penaltyKind:result.penaltyKind};});renderSlot5x3History();}

      function initSkydiveGame(){pollSky().catch(e=>showToast(e.message));}
      function initDoudizhu(){cardTableUI?.ensure();}
      function renderSky(state){skyRound=state.round;skyUI.render(state);}
      async function pollSky(){return skyUI.poll();}
      async function refreshChat(room){renderChat(room,await api('/api/player/chat?room='+room));}
      function renderChat(room,d){if(room==='sky')skyUI.radio(d.items);const box=byId(room==='sky'?'skydive-chat-list':'derby-chat-messages');if(!box)return;
        const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;const last=box.dataset.lastId;const next=String(d.items.at(-1)?.id||'')+d.items.map(m=>m.alias).join('|');if(last===next)return;
        box.innerHTML=d.items.map(m=>`<div class="py-1"><b>${esc(m.alias)}</b> <span class="text-xs opacity-60">${AVEDTime.markup(m.createdAt,'clock')}</span><p class="whitespace-pre-wrap">${esc(m.body)}</p></div>`).join('');box.dataset.lastId=next;if(nearBottom||!last)box.scrollTop=box.scrollHeight;
      }
      let chatConnections=[];
      let chatRoom='';
      function startChatStreams(){const room=currentUser&&!document.hidden&&!byId('view-casino').classList.contains('hidden')?(!byId('game-panel-skydive').classList.contains('hidden')?'sky':!byId('game-panel-derby').classList.contains('hidden')?'derby':''):'';if(room===chatRoom)return;chatRoom=room;for(const connection of chatConnections)connection.close();chatConnections=[];if(!room)return;const source=new EventSource('/api/player/chat/stream?room='+room);source.onmessage=e=>{try{renderChat(room,JSON.parse(e.data));}catch{}};chatConnections=[source];}
      document.addEventListener('visibilitychange',startChatStreams);
      setInterval(startChatStreams,1000);
      function fluctuateStocks(){return refreshMarket().catch(e=>showToast(e.message,'warn'));}
      function renderProfile(){personalUI.render();}
      let profileRequest=null,profileFreshAt=0,lastProfileBalance=null;
      async function showProfile(){switchMainView('profile');if(Date.now()-profileFreshAt<30000)return;if(profileRequest)return profileRequest;const uid=currentUser.id;profileRequest=(async()=>{try{const d=await api('/api/profile');if(currentUser?.id!==uid)return;playerProfile=d.profile;playerAchievements=d.achievements;playerGameRecords=d.gameRecords||null;currentUser.balance=d.balance;profileFreshAt=Date.now();if(!byId('view-profile').classList.contains('hidden'))renderProfile();}finally{profileRequest=null;}})();return profileRequest;}
      function stop(event){event.preventDefault();event.stopImmediatePropagation();}
      async function action(button,task){if(button?.dataset.busy)return;if(button){button.dataset.busy='1';button.disabled=true;}try{await task();}catch(e){if(e.code==='RULES_CHANGED'){try{applyEconomyRules(await api('/api/player/economy'));byId('ticket-confirm-modal').classList.add('hidden');byId('ticket-confirm-modal').classList.remove('flex');renderScratchTiersAndLobby();}catch{}}showToast(e.message,'warn');}finally{if(button){delete button.dataset.busy;if(button.hasAttribute('data-stock-trade-side'))renderTradeTicket();else button.disabled=false;}}}
      document.addEventListener('submit',event=>{
        const form=event.target;const id=form.id;
        const handled=['new-forum-topic-form','forum-detail-reply-form','news-detail-comment-form','scp-realname-comment-form','skydive-chat-form','derby-chat-form','cloud-profile-form'];
        if(!handled.includes(id))return;stop(event);
        action(form.querySelector('[type=submit]')||form.querySelector('button'),async()=>{
          if(id==='new-forum-topic-form'||id==='forum-detail-reply-form'){
            const reply=id==='forum-detail-reply-form',social=forumSocialUI?.compose(form)||{};
            const d=await api('/api/player/forum'+(reply?'/'+currentForumThreadId:''),{method:'POST',body:{...social,title:byId('new-topic-title').value,body:byId(reply?'forum-detail-reply-text':'new-topic-content').value,identityMode:form.querySelector('[name=identityMode]')?.value||'anonymous',imageData:reply?pendingReplyImageData:pendingNewTopicImageData}});
            form.reset();form.querySelector('[name=identityMode]').value='anonymous';forumSocialUI?.afterPublish(form,social.personaId);if(reply)pendingReplyImageData=null;else pendingNewTopicImageData=null;byId(reply?'reply-image-selected-hint':'new-topic-image-hint').textContent='';await refreshForum();if(reply&&!d.pending)await forumReplies.reveal(d.id);if(!reply)forumBrowser.closeComposer();showToast(d.pending?'整条图文已提交审核，通过后公开显示。':'已发布。');
          }else if(id==='news-detail-comment-form'){
            await api('/api/posts',{method:'POST',body:{announcementId:Number(currentNewsId),anonymousName:playerProfile.anonymousName,body:byId('news-detail-comment-input').value}});form.reset();renderCompanyNewsView();
          }else if(id==='scp-realname-comment-form'){
            const dossier=scpItemsData.find(s=>s.id===selectedScpId);if(!dossier)throw new Error('请先选择档案。');
            const input=form.querySelector('textarea,input:not([type]),input[type=text]');await api('/api/player/dossiers/'+dossier.dbId+'/comments',{method:'POST',body:{body:input?.value||''}});form.reset();await loadDossierComments(dossier);
          }else if(id.endsWith('chat-form')){
            const room=id==='skydive-chat-form'?'sky':'derby',input=form.querySelector('textarea,input:not([type]),input[type=text]');await api('/api/player/chat',{method:'POST',body:{room,body:input?.value||''}});form.reset();await refreshChat(room);
          }else if(id==='cloud-profile-form'){
            const fd=new FormData(form);let avatarUrl=playerProfile.avatarUrl;const file=fd.get('avatar');let avatarPreset=playerProfile.avatarPreset||'';if(fd.get('avatarMode')==='none'){avatarUrl='';avatarPreset='';}else if(fd.get('avatarMode')==='pixel'){avatarUrl='';avatarPreset=fd.get('avatarPreset')||'slate';}
            if(file?.size){avatarPreset='';if(file.size>1500000)throw new Error('头像不能超过 1.5 MB。');avatarUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
            const d=await api('/api/profile',{method:'PUT',body:{anonymousName:fd.get('anonymousName'),bio:fd.get('bio')??playerProfile.bio??'',avatarUrl,avatarPreset}});playerProfile=d.profile;currentUser.savedAlias=d.profile.anonymousName;aliasInputEl.value=d.profile.anonymousName;syncUserHeaderUI();refreshDirectory().catch(()=>{});showToast('个人资料已保存。');renderProfile();
          }
        });
      },true);
      async function loadDossierComments(dossier){const d=await api('/api/player/dossiers/'+dossier.dbId+'/comments');dossier.realComments=d.items.map(c=>({id:String(c.id),authorName:esc(c.displayName),authorRole:esc(c.department),time:AVEDTime.markup(c.createdAt),text:esc(c.body)}));renderScpArchives();}
      document.addEventListener('click',event=>{
        const card=event.target.closest('[data-scp-id]');if(card){const dossier=scpItemsData.find(d=>d.id===card.dataset.scpId);if(dossier)loadDossierComments(dossier).catch(e=>showToast(e.message));}
        const button=event.target.closest('button,a');if(!button)return;const id=button.id;
        if(button.dataset.cloudNews){stop(event);currentNewsId=button.dataset.cloudNews;renderCompanyNewsView();byId('news-detail-subview').scrollIntoView({block:'start'});return;}
        if(button.dataset.cloudThread){stop(event);rememberForumPosition(button);openForumThread(button.dataset.cloudThread);byId('view-forum').scrollIntoView({block:'start'});return;}
        if(button.dataset.nav==='welcome'){stop(event);showProfile().catch(e=>showToast(e.message));return;}
        if(button.dataset.nav==='containment'){const dossier=scpItemsData.find(d=>d.id===selectedScpId)||scpItemsData[0];if(dossier)loadDossierComments(dossier).catch(e=>showToast(e.message));}
        if(button.dataset.game==='doudizhu')initDoudizhu();
        const handled=['forum-refresh-skeleton-btn','zero-balance-btn','ticket-modal-confirm-btn','scratch-next-ticket','slot5x3-spin-btn','skydive-board-btn','skydive-open-chute-btn','cloud-profile-open'];
        const trade=button.hasAttribute('data-stock-trade-side');
        if(trade&&stockTradeBusy)return;
        if(!handled.includes(id)&&!trade)return;stop(event);
        if(id==='zero-balance-btn'){askSecondConfirmation('确认将余额归零？','无论余额为正数还是负数，重置后都会回到零。此操作不可撤销。',()=>action(button,async()=>{const d=await api('/api/player/balance/zero',{method:'POST'});currentUser.balance=d.balance;syncUserHeaderUI();profileFreshAt=0;showProfile().catch(e=>showToast(e.message));}));return;}
        action(button,async()=>{
          if(id==='cloud-profile-open')return showProfile();
          if(id==='forum-refresh-skeleton-btn'){await refreshForum();return;}
          if(id==='ticket-modal-confirm-btn'||id==='scratch-next-ticket'){
            const type=id==='scratch-next-ticket'?activeIssuedTicket?.gameType:pendingTicketType;if(!type)throw new Error('请先选择票种。');
            if(scratchActivating)return;
            scratchFeedback.nextTicket();
            const tier={...selectedTier};const cost=id==='scratch-next-ticket'?tier.cost:Number(byId('ticket-modal-price').dataset.cost),revision=id==='scratch-next-ticket'?economyRevision:Number(byId('ticket-modal-price').dataset.revision);
            activeIssuedTicket={draft:true,requestKey:crypto.randomUUID(),tier:{...tier,cost},gameType:type,cost,revision,cells:Array.from({length:type.cellsCount},(_,idx)=>({idx,revealed:false,label:idx===3?'核准印':'领赏号',sub:'待核准'}))};
            byId('active-ticket-result-banner').removeAttribute('data-scratch-feedback');
            byId('ticket-confirm-modal').classList.add('hidden');byId('ticket-confirm-modal').classList.remove('flex');
            byId('scratch-lobby-view').classList.add('hidden');byId('scratch-play-table-view').classList.remove('hidden');byId('scratch-back-lobby-btn').classList.remove('hidden');
            byId('active-ticket-result-banner').textContent='尚未扣款 · 首次刮开时扣除票价，可免费跳过。';renderActiveScratchTicketBoard();byId('scratch-next-ticket').disabled=false;byId('scratch-next-ticket').textContent='下一张';if(id==='ticket-modal-confirm-btn')byId('scratch-back-lobby-btn').scrollIntoView({block:'start',behavior:'instant'});
          }else if(id==='slot5x3-spin-btn'){
            if(!pendingSlotRequest||pendingSlotRequest.owner!==currentUser.id)pendingSlotRequest={owner:currentUser.id,bet:Number(byId('slot5x3-bet-input').value),requestKey:crypto.randomUUID()};
            slotEffects.start();
            let d,showSlotAward=false;try{d=await api('/api/player/games/slot',{method:'POST',body:pendingSlotRequest});pendingSlotRequest=null;showSlotAward=await slotEffects.finish(d);}catch(error){if(error.status>=400&&error.status<500)pendingSlotRequest=null;throw error;}finally{slotEffects.cancel();}
            slot5x3State.board=d.result.board;slot5x3State.winningCells=new Set(d.result.winningCells);slot5x3State.history.unshift({bet:d.cost,win:d.prize,penalty:d.penalty,penaltyKind:d.result.penaltyKind});
            d.result.mechanisms.forEach(i=>slot5x3Mechanisms[i].discovered=true);
            byId('slot5x3-win-summary').textContent='本局获得 ¤ '+Number(d.prize).toLocaleString();currentUser.balance=d.balance;syncUserHeaderUI();renderSlot5x3Board();renderSlot5x3History();
            if(showSlotAward){slotEffects.show(d);window.AVEDPersonalRecord.show(d.gameHighlight);}
          }
          else if(id==='skydive-board-btn'){const input=byId('sky-bet-input')||byId('skydive-bet-input');const d=await api('/api/player/games/sky/start',{method:'POST',body:{bet:Number(input?.value||10000),round:skyUI.round()}});renderSky(d);skyUI.feedback('您已登机');}
          else if(id==='skydive-open-chute-btn'){if(!skyUI.round())throw new Error('请先登机。');renderSky(await skyUI.jump());}
          else if(trade){
            stockTradeBusy=true;renderTradeTicket();
            try{
            const closing=button.dataset.stockTradeSide==='close';
            const long=button.dataset.stockTradeSide==='long';
            const code=byId('stock-trade-symbol').value;
            const quantityInput=byId('stock-trade-quantity');
            if(!quantityInput)throw new Error('未找到委托输入框，请刷新后重试。');
            const quantity=Number(quantityInput.value);
            if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw new Error('委托数量应为 1 至 10,000 的整数。');
            if(!code)throw new Error('证券代码缺失，请刷新后重试。');
            const leverageInput=byId('stock-trade-leverage');
            if(!leverageInput)throw new Error('未找到杠杆设置，请刷新后重试。');
            const leverage=Math.round(Number(leverageInput.value));
            if(![1,3,10].includes(leverage))throw new Error('杠杆仅支持 1x、3x 或 10x。');
            const stopRaw=closing?'':byId('stock-trade-stop')?.value;
            const takeRaw=closing?'':byId('stock-trade-take')?.value;
            const parseOptional=value=>value==null||value===''?null:Math.round(Number(value));
            const stopLoss=parseOptional(stopRaw),takeProfit=parseOptional(takeRaw);
            if(stopLoss!==null&&(!Number.isSafeInteger(stopLoss)||stopLoss<=0))throw new Error('止损价需为正整数。');
            if(takeProfit!==null&&(!Number.isSafeInteger(takeProfit)||takeProfit<=0))throw new Error('止盈价需为正整数。');
            const stock=stocksData.find(item=>item.code===code);
            const currentPrice=Number(stock?.price);
            if(closing&&(!stock?.holding||quantity>Math.abs(stock.holding)))throw new Error('平仓数量不能超过当前持仓。');
            if(!closing&&Number.isFinite(currentPrice)&&currentPrice>0){
              if(long){
                if(stopLoss!==null&&stopLoss>=currentPrice)throw new Error('买涨时止损需低于现价。');
                if(takeProfit!==null&&takeProfit<=currentPrice)throw new Error('买涨时止盈需高于现价。');
              }else{
                if(stopLoss!==null&&stopLoss<=currentPrice)throw new Error('买跌时止损需高于现价。');
                if(takeProfit!==null&&takeProfit>=currentPrice)throw new Error('买跌时止盈需低于现价。');
              }
            }
            const d=await api('/api/player/stocks?code='+encodeURIComponent(marketCode)+'&period='+marketPeriod,{method:'POST',body:{code,intent:closing?'close':'open',side:long?'long':'short',quantity,leverage,orderType:'market',stopLoss,takeProfit}});
            applyMarket(d);
            showToast('委托已成交。');
            }finally{stockTradeBusy=false;renderTradeTicket();}
          }
        });
      },true);
      let scratchActivating=false;
      async function activateScratchTicket(){
        if(scratchActivating||!activeIssuedTicket)return false;if(!activeIssuedTicket.draft)return true;
        const draft=activeIssuedTicket,owner=currentUser?.id;scratchActivating=true;byId('scratch-next-ticket').disabled=true;
        try{const d=await api('/api/player/games/scratch',{method:'POST',body:{tier:draft.tier.id,type:draft.gameType.type,cost:draft.cost,revision:draft.revision,requestKey:draft.requestKey}});
          if(currentUser?.id!==owner||activeIssuedTicket!==draft)return false;
          activeIssuedTicket={...d.result,cells:d.result.cells.map(c=>({...c,revealed:false})),gameType:scratchGameTypes.find(g=>g.type===d.result.gameType.type)||d.result.gameType,cost:d.cost,prize:d.prize,penalty:d.penalty||0,gameHighlight:d.gameHighlight};currentUser.balance=d.balance;syncUserHeaderUI();byId('active-ticket-result-banner').textContent='票券已结算 · 刮开查看结果。';byId('scratch-next-ticket').textContent='下一张';return true;
        }catch(e){showToast(e.message);byId('scratch-next-ticket').disabled=false;return false;}finally{scratchActivating=false;}
      }
      function checkAndSettleScratchTicket(mode='manual'){if(!activeIssuedTicket||activeIssuedTicket.settled||!activeIssuedTicket.cells.every(c=>c.revealed))return;
        const ticket=activeIssuedTicket;ticket.settled=true;
        const finish=()=>{if(activeIssuedTicket!==ticket)return;byId('active-ticket-result-banner').textContent=(ticket.demo?'测试 · ':'')+AVEDGameResults.text(ticket);if(!ticket.bombFeedbackPlayed)scratchFeedback.settle(byId('active-ticket-result-banner'),ticket,mode);byId('scratch-next-ticket').disabled=false;};
        finish();}
      const profileButton=document.createElement('button');profileButton.id='cloud-profile-open';profileButton.type='button';profileButton.dataset.nav='profile';profileButton.className='nav-tab-btn w-full px-3 py-3 flex items-center gap-3 text-left cursor-pointer';profileButton.setAttribute('aria-label','个人主页');profileButton.innerHTML='<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span class="sidebar-label truncate">个人主页</span>';byId('left-sidebar').querySelector('[data-nav="news"]').before(profileButton);
      const profileSection=document.createElement('section');profileSection.id='view-profile';profileSection.className='hidden';byId('view-news').parentElement.append(profileSection);mainViews.push('profile');
      if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
        let demoIndex=0;
        const previewBomb=()=>{
          if(scratchActivating)return;
          if(activeIssuedTicket&&!activeIssuedTicket.demo&&!activeIssuedTicket.draft&&!activeIssuedTicket.settled){showToast('请先刮完当前票券。');return;}
          const modal=byId('ticket-confirm-modal'),fromModal=!modal.classList.contains('hidden'),gameType=fromModal?pendingTicketType:activeIssuedTicket?.gameType;
          if(!gameType)return;
          scratchFeedback.clear();activeIssuedTicket=window.AVEDScratchBombDemo.make({tier:selectedTier,gameType,totalLoss:[2,3,5][demoIndex++%3]});
          modal.classList.add('hidden');modal.classList.remove('flex');
          byId('scratch-lobby-view').classList.add('hidden');byId('scratch-play-table-view').classList.remove('hidden');byId('scratch-back-lobby-btn').classList.remove('hidden');
          byId('active-ticket-result-banner').removeAttribute('data-scratch-feedback');byId('active-ticket-result-banner').textContent='测试票 · 待刮开';
          renderActiveScratchTicketBoard();byId('scratch-next-ticket').disabled=false;byId('scratch-next-ticket').textContent='下一张';
          byId('scratch-back-lobby-btn').scrollIntoView({block:'start',behavior:'instant'});
        };
        const button=document.createElement('button');button.type='button';button.className='scratch-bomb-demo-btn';button.textContent='试刮炸弹';button.addEventListener('click',previewBomb);byId('ticket-modal-confirm-btn').after(button);


      }
      cardTableUI=AVEDCardTableUI({api,esc,getUser:()=>currentUser,playSfx,onBalance:balance=>{if(currentUser){currentUser.balance=balance;syncUserHeaderUI();}}});
      const skyUI=AVEDSkyUI({api,esc,byId,playSfx,onSettled:()=>{profileFreshAt=0;},getUser:()=>currentUser,onBalance:balance=>{if(currentUser&&typeof balance==='number'){currentUser.balance=balance;syncUserHeaderUI();}},showToast});
      economyUI=AVEDEconomyUI({api,esc,byId,getUser:()=>currentUser,onBalance:balance=>{currentUser.balance=balance;syncUserHeaderUI();},showToast,stocks:()=>stocksData,refreshMarket});
      const communityUI=AVEDCommunity({api,esc,byId,showToast,mainViews,switchMainView,navigateGame:game=>switchMainView('casino',{game}),getUser:()=>currentUser,getProfile:()=>playerProfile,departments:()=>departmentsData,renderDepartments:renderDepartmentsAndPersonnel,renderScp:renderScpArchives,refreshForum,backForum:returnForumList,getReply:id=>forumReplies.get(id),getThread:()=>forumDetail});
      AVEDCardRoomLobby({api,esc,getUser:()=>currentUser,cardTable:cardTableUI,openTable:()=>{communityUI.selectGame('doudizhu');cardTableUI.ensure();byId('game-panel-doudizhu').scrollIntoView({block:'start'});}});
      window.AVEDJackpotTicker=AVEDCreateJackpotTicker({api,enabled:()=>!!currentUser&&!byId('view-casino').classList.contains('hidden')});
      forumSocialUI=AVEDForumSocial({api,esc,getUser:()=>currentUser,getThread:()=>currentForumThreadId?forumDetail:null,getReplyRevision:()=>forumReplies.revision(),onRepliesChanged:()=>forumReplies.refresh(),getReply:(id,reveal=false)=>reveal?forumReplies.reveal(id).then(()=>forumReplies.get(id)):forumReplies.get(id),showToast,refreshForum,openThread:async(id,replyId)=>{switchMainView('forum');return openForumThread(id,replyId);},getContext:id=>forumReplies.context(id)});
      welfareUI=AVEDWelfareUI({api,esc,byId,getUser:()=>currentUser,getProfile:()=>playerProfile,onBalance:b=>{currentUser.balance=b;syncUserHeaderUI();},onPreferences:p=>{Object.assign(playerProfile,p);},showToast});
      setInterval(()=>{if(currentUser&&!document.hidden&&!byId('view-departments').classList.contains('hidden'))refreshDirectory().catch(()=>{});},30000);
      const personalUI=AVEDPersonalUI({api,esc,byId,getUser:()=>currentUser,getProfile:()=>playerProfile,getAchievements:()=>playerAchievements,getRecords:()=>playerGameRecords,welfare:()=>welfareUI,onBalance:b=>{if(currentUser){currentUser.balance=b;syncUserHeaderUI();profileFreshAt=0;}},onDailyCheckin:performDailyCheckin,showToast});
      window.AVEDRefreshPersonal=()=>{if(currentUser&&!byId('view-profile').classList.contains('hidden'))renderProfile();};
      AVEDRewardsUI({api,byId,getUser:()=>currentUser,onBalance:b=>{currentUser.balance=b;syncUserHeaderUI();},showToast});
      AVEDDerbyUI({api,esc,byId,getUser:()=>currentUser,onBalance:b=>{currentUser.balance=b;syncUserHeaderUI();},showToast,playSfx});
      AVEDVisualStyle({byId});
      const idleSession=AVEDPlayerSession.create({storage:localStorage,onExpire:async()=>{
        currentUser=null;innerAppView.classList.add('hidden');landingView.classList.remove('hidden');
        document.body.classList.remove('theme-inner');document.body.classList.add('theme-landing');
        try{await apiLogout();}catch{}finally{location.reload();}
      }});
      for(const type of ['pointerdown','pointermove','keydown','wheel','touchstart'])document.addEventListener(type,()=>idleSession.activity(),{passive:true});
      document.addEventListener('visibilitychange',()=>idleSession.check());
      window.addEventListener('storage',event=>{if(event.key==='aved_last_activity_v1')idleSession.check();});
      (async()=>{
        const entryState=await AVEDStartup.restoreSession({
          load:async()=>{
            if(idleSession.stale()){await apiLogout();throw Object.assign(new Error('员工会话已过期。'),{status:401,code:'SESSION_EXPIRED'});}
            return loadPlayerData();
          },
          enter:async employee=>{await completeEnterIntranet(employee);idleSession.start();await nextPaint();},
          signedOut:()=>{
            currentUser=null;innerAppView.classList.add('hidden');landingView.classList.remove('hidden');
            document.body.classList.remove('theme-inner');document.body.classList.add('theme-landing');
          },
          unavailable:()=>{
            delete signalOverlay.dataset.assetLoading;
            signalOverlay.classList.remove('hidden');signalOverlay.classList.add('flex');
            currentUser=null;signalPhase('公司内网连接暂未建立',12,'');
            const logs=document.getElementById('signal-log-lines'),message=document.createElement('div'),retry=document.createElement('button');
            message.textContent='暂未取得内网响应，员工身份尚未确认。请重新连接。';retry.id='session-restore-retry';retry.type='button';retry.textContent='重试连接';
            retry.addEventListener('click',()=>location.reload());logs.replaceChildren(message,retry);
          }
        });
        document.documentElement.dataset.entryState=entryState;signalOverlay.setAttribute('aria-busy','false');
        if(entryState!=='checking'){signalOverlay.classList.add('hidden');signalOverlay.classList.remove('flex');delete signalOverlay.dataset.assetLoading;}
      })();
      function marketVisible(){return !!currentUser&&!document.hidden&&!byId('view-casino').classList.contains('hidden')&&!byId('game-panel-stocks').classList.contains('hidden');}
      const marketVisibility=new MutationObserver(()=>{if(marketVisible())refreshMarket().catch(()=>{});});
      for(const el of [byId('view-casino'),byId('game-panel-stocks')])marketVisibility.observe(el,{attributes:true,attributeFilter:['class']});
      document.addEventListener('visibilitychange',()=>{if(marketVisible())refreshMarket().catch(()=>{});});
      setInterval(()=>{if(marketVisible())refreshMarket().catch(()=>{});},5000);

      setInterval(()=>{if(!currentUser||document.hidden)return;refreshBalance().catch(()=>{});if(!byId('view-news').classList.contains('hidden')&&currentNewsId)refreshNoticeComments(currentNewsId).catch(()=>{});},10000);


    })();
