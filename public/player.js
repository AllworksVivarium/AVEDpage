
    (function() {
      // ======================================================================
      async function api(path,{method='GET',body,...options}={}) {
        return AVEDHttp.request(path,{method,...options,body:body?JSON.stringify(body):undefined});
      }
      const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      async function apiLogin(identifier,password,remember) {
        const result=await api('/api/login',{method:'POST',body:{identifier,password,remember}});
        await AVEDHttp.confirmSession(result.employee?.username);return result;
      }
      async function apiLogout(){await api('/api/logout',{method:'POST'});}

      // ======================================================================
      // Button motion is shared by both terminals in interaction-motion.js.
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // ======================================================================
      // 1. 独立三路音频引擎（总开关 Master / 背景环境音 BGM / 特效音 SFX）
      // ======================================================================
      let audioMasterOn = true;
      let audioBgmOn = false;
      let audioSfxOn = true;
      let audioCtx = null;
      let bgmOsc1 = null;
      let bgmOsc2 = null;
      let bgmGain = null;

      function ensureAudioCtx() {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }

      function syncBgmDrone() {
        try {
          if (audioMasterOn && audioBgmOn) {
            ensureAudioCtx();
            if (!audioCtx) return;
            if (!bgmOsc1) {
              bgmOsc1 = audioCtx.createOscillator();
              bgmOsc2 = audioCtx.createOscillator();
              bgmGain = audioCtx.createGain();
              bgmOsc1.type = 'sine';
              bgmOsc2.type = 'triangle';
              bgmOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);
              bgmOsc2.frequency.setValueAtTime(82.4, audioCtx.currentTime);
              bgmGain.gain.setValueAtTime(0.025, audioCtx.currentTime);
              bgmOsc1.connect(bgmGain);
              bgmOsc2.connect(bgmGain);
              bgmGain.connect(audioCtx.destination);
              bgmOsc1.start();
              bgmOsc2.start();
            }
          } else {
            if (bgmOsc1) {
              bgmOsc1.stop();
              bgmOsc2.stop();
              bgmOsc1.disconnect();
              bgmOsc2.disconnect();
              bgmOsc1 = null;
              bgmOsc2 = null;
            }
          }
        } catch (e) {}
      }

      function playSfx(type) {
        if (!audioMasterOn || !audioSfxOn) return;
        try {
          ensureAudioCtx();
          if (!audioCtx) return;
          const now = audioCtx.currentTime;

          if (type === 'checkin' || type === 'win') {
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
            osc.frequency.setValueAtTime(190 + Math.random() * 120, now);
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

      function updateAudioTrioUI() {
        const masterBtn = document.getElementById('audio-master-btn');
        const bgmBtn = document.getElementById('audio-bgm-btn');
        const sfxBtn = document.getElementById('audio-sfx-btn');

        masterBtn.textContent = audioMasterOn ? '声音开启' : '静音';
        masterBtn.setAttribute('aria-pressed',String(audioMasterOn));
        const musicAudio=document.getElementById('cloud-music-audio');if(musicAudio)musicAudio.muted=!audioMasterOn;
        masterBtn.className = `px-2 py-1 text-[11px] font-bold cursor-pointer ${audioMasterOn ? 'bg-[var(--inner-accent)] text-[var(--inner-accent-text)]' : 'bg-[#9e1b1b] text-white'}`;

        const effectiveBgm = audioMasterOn && audioBgmOn;
        bgmBtn.textContent = effectiveBgm ? '环境音 开' : '环境音 关';bgmBtn.setAttribute('aria-pressed',String(effectiveBgm));
        bgmBtn.className = `px-2 py-1 text-[11px] cursor-pointer ${effectiveBgm ? 'bg-black/15 font-bold' : 'opacity-60'}`;

        const effectiveSfx = audioMasterOn && audioSfxOn;
        sfxBtn.textContent = effectiveSfx ? '按键音 开' : '按键音 关';sfxBtn.setAttribute('aria-pressed',String(effectiveSfx));
        sfxBtn.className = `px-2 py-1 text-[11px] cursor-pointer ${effectiveSfx ? 'bg-black/15 font-bold' : 'opacity-60'}`;

        syncBgmDrone();
      }

      document.getElementById('audio-master-btn').addEventListener('click', () => {
        audioMasterOn = !audioMasterOn;
        updateAudioTrioUI();
        if (audioMasterOn) playSfx('click');
      });
      document.getElementById('audio-bgm-btn').addEventListener('click', () => {
        if (!audioMasterOn) audioMasterOn = true;
        audioBgmOn = !audioBgmOn;
        updateAudioTrioUI();
      });
      document.getElementById('audio-sfx-btn').addEventListener('click', () => {
        if (!audioMasterOn) audioMasterOn = true;
        audioSfxOn = !audioSfxOn;
        updateAudioTrioUI();
        if (audioSfxOn) playSfx('click');
      });
      updateAudioTrioUI();

      // ======================================================================
      // 2. 全局二次确认弹窗
      // ======================================================================
      let pendingConfirmCallback = null;
      const confirmModal = document.getElementById('global-confirm-modal');

      function askSecondConfirmation(title, desc, onConfirm) {
        playSfx('click');
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-desc').textContent = desc;
        pendingConfirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
      }

      document.getElementById('confirm-modal-cancel-btn').addEventListener('click', () => {
        pendingConfirmCallback = null;
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
      });

      document.getElementById('confirm-modal-ok-btn').addEventListener('click', () => {
        const fn = pendingConfirmCallback;
        pendingConfirmCallback = null;
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
        if (typeof fn === 'function') fn();
      });

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
      let isSidebarCollapsed = sidebarNarrow;
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
        const drawerOpen = !isSidebarCollapsed && window.innerWidth < 768;
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
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&window.innerWidth<768&&!isSidebarCollapsed)toggleSidebar();});
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
      function signalPhase(title,progress,line) {
        document.getElementById('signal-status-title').textContent=title;
        document.getElementById('signal-progress-bar').style.width=progress+'%';
        document.getElementById('signal-noise-code').textContent=progress===100?'CARRIER: LOCKED':'CARRIER: SYNCING';
        const logs=document.getElementById('signal-log-lines');if(progress<40)logs.replaceChildren();
        const steps=['正在确认个人身份令牌……','正在连接公司内网……','正在加载公司档案……'];
        const count=progress<40?1:progress<80?2:3;
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
        signalPhase('欢迎回到公司',12,'正在核验员工凭证……');
        try {
          await nextPaint();
          const authenticated=await apiLogin(identifier,password,remember);
          signalPhase('欢迎回到公司，'+authenticated.employee.displayName,45,'正在接通员工终端……');
          await nextPaint();
          signalPhase('正在加载公司档案',85,'正在加载公司档案……');
          const employee=await loadPlayerData();
          signalPhase('欢迎回到公司，'+employee.name,85,'正在调阅公司档案……');
          await nextPaint();
          await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000-(performance.now()-connectStarted))));
          idleSession.start(true);
          completeEnterIntranet(employee);
          signalPhase('欢迎回到公司，'+employee.name,100,'终端已接通。');
          await new Promise(resolve=>setTimeout(resolve,prefersReducedMotion?80:420));
          signalOverlay.classList.add('hidden');signalOverlay.classList.remove('flex');signalOverlay.setAttribute('aria-busy','false');
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

      function switchMainView(target) {
        if(target==='welcome'&&currentUser){showProfile().catch(e=>showToast(e.message));return;}
        if(target==='departments'){window.avedDepartmentFilter='';renderDepartmentsAndPersonnel();refreshDirectory().catch(e=>showToast(e.message));}
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

        if (target === 'containment') {
          scpBoardSelection=null;renderScpArchives();
          randomizeScpDualNamePlaceholder();
          triggerScpTitleRedactionGlitch();
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

        let extra=document.getElementById('directory-unassigned');if(!extra){extra=document.createElement('button');extra.id='directory-unassigned';extra.type='button';extra.className='community-button directory-unassigned';extra.dataset.departmentFilter='直属 / 待分配';deptGrid.after(extra);}const unassigned=employees.filter(e=>e.department==='直属 / 待分配').length;extra.hidden=!unassigned;extra.textContent='直属与待分配档案 / '+unassigned+' 人';
        let leadership=document.getElementById('company-leadership-directory');if(!leadership){leadership=document.createElement('section');leadership.id='company-leadership-directory';leadership.className='company-leadership';byId('view-departments').append(leadership);}byId('view-departments').append(leadership);const leaders=employees.filter(e=>e.isLeadership);leadership.hidden=!leaders.length;leadership.innerHTML='<header><span class="section-kicker">COMPANY DIRECTORATE</span><h3>公司直属领导</h3></header><div class="leadership-cards">'+leaders.map(e=>`<article><span class="section-kicker">${e.isNpc?'NPC / ':''}DIRECTORATE</span><h4>${e.positionTitle}</h4><p>${e.name}</p><button type="button" class="community-button" data-department-filter="公司直属领导">调阅直属档案 ↗</button></article>`).join('')+'</div>';
        const dirGrid = document.getElementById('personnel-directory-grid');
        if (!dirGrid) return;
        dirGrid.parentElement.hidden=!window.avedDepartmentFilter;
        if(!window.avedDepartmentFilter){dirGrid.replaceChildren();return;}

        const labels = ['力量', '意志', '体质', '智力', '敏捷', '洞察'];
        const cx = 65, cy = 65, rMax = 44;
        const angles = [-90, -30, 30, 90, 150, 210].map(a => a * Math.PI / 180);
        const outerHex = angles.map(a => `${(cx + rMax * Math.cos(a)).toFixed(1)},${(cy + rMax * Math.sin(a)).toFixed(1)}`).join(' ');
        const midHex = angles.map(a => `${(cx + rMax * 0.6 * Math.cos(a)).toFixed(1)},${(cy + rMax * 0.6 * Math.sin(a)).toFixed(1)}`).join(' ');

        const isHead=emp=>!emp.isLeadership&&emp.positionTitle.includes('部长');
        const selectedEmployees=employees.filter(emp=>emp.department===window.avedDepartmentFilter).sort((a,b)=>Number(isHead(b))-Number(isHead(a)));
        dirGrid.innerHTML = selectedEmployees.map((emp,index) => {
          const stats = emp.stats || [80, 85, 80, 85, 80, 85];
          const polyPoints = stats.map((val, i) => {
            const r = (val / 100) * rMax;
            return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`;
          }).join(' ');

          const deptDisplay = emp.isLeadership?`职务：<strong>${emp.positionTitle}</strong>`:`所属部门：<strong>${emp.department}</strong>${emp.positionTitle?`<br>职务：<strong>${emp.positionTitle}</strong>`:''}`;

          return `
            ${index===0||isHead(emp)!==isHead(selectedEmployees[index-1])?'<h3 class="directory-role-heading">'+(emp.isLeadership?'直属职位档案':isHead(emp)?'部长档案':'部门成员')+'</h3>':''}
            <div class="retro-corner-box p-5 space-y-4">
              <div class="flex items-center justify-between border-b-2 border-[var(--inner-border)] pb-2 text-xs font-mono-tech">
                <span class="font-bold">A.V.E. DIRECTORATE // ID</span>
                <span class="px-2 py-0.5 bg-[var(--inner-crimson)] text-white text-[10px] font-bold">${emp.bracketTag}</span>
              </div>

              <div class="grid grid-cols-2 gap-3 items-center pt-1">
                <div class="border border-[var(--inner-border)] p-2 bg-black/5 flex flex-col items-center">
                  <div data-emp-photo-slot="${emp.id}" class="w-20 h-24 bg-[#9e1b1b] flex flex-col items-center justify-end relative overflow-hidden border border-black">
                    ${emp.avatarUrl?`<img src="${esc(emp.avatarUrl)}" alt="员工证件照" class="w-full h-full object-cover">`:`<svg viewBox="0 0 100 120" class="w-full h-full">
                      <circle cx="50" cy="42" r="20" fill="#181715" />
                      <path d="M16,120 C16,82 84,82 84,120 Z" fill="#181715" />
                    </svg>`}
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
      let currentDualNameHint = '蒋正一 / 溟座';



      // Board names and summaries share one 50 ms restoration deadline.
      let scpBoardSelection=null;
      function triggerScpTitleRedactionGlitch() {
        AVEDArchiveBoard.glitch({document,enabled:!document.body.classList.contains('effects-off')&&!prefersReducedMotion});
      }

      function renderScpArchives() {
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
          if(window.avedScpDepartment&&item.department!==window.avedScpDepartment)return false;
          const matchLevel = selectedScpFilter === 'ALL' || item.level === selectedScpFilter;
          if (!matchLevel) return false;
          if (kwParts.length === 0) return true;
          const haystack = `${item.id} ${item.codeName} ${item.department} ${item.handlers} ${item.summary} ${item.clues.join(' ')}`.toLowerCase();
          return kwParts.some(part => haystack.includes(part));
        });

        const boardKey=JSON.stringify([kw,selectedScpFilter,window.avedScpDepartment||'',matching.map(item=>item.id)]);
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
          if (scpSimulatedEmpty) {
            emptyTitle.textContent = '档案板已被临时清空归档';
            emptyDesc.textContent = '您执行了清空归档操作，当前视图下暂无收容物卡片。点击下方主按钮可立即恢复全部在册档案。';
          } else {
            emptyTitle.textContent = '未检索到匹配的收容物卷宗';
            emptyDesc.textContent = `当前检索词「${scpSearchKeyword || selectedScpFilter}」下没有匹配的收容物。请清除筛选条件以恢复全部收容物列表。`;
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
                  <span class="archive-pin-label text-[10px] font-mono-tech font-bold px-1.5 py-0.5 bg-black text-white">${item.pinLabel}</span>
                  <div class="clue-pin" title="档案图钉"></div>
                  <span class="text-[10px] font-mono-tech font-bold text-[#9e1b1b]">${item.level}</span>
                </div>

                <div class="archive-evidence-strip bg-[#141413] text-[#e8e3d5] p-2 mb-2 font-mono-tech text-[10px] flex items-center justify-between border border-black">
                  <span class="truncate">📷 ${item.polaroidTag}</span>
                  <span class="text-red-400 font-bold ml-1 shrink-0">${item.id}</span>
                </div>

                <!-- 磁吸式收容物名称标题按钮 + 随机黑块乱码目标 -->
                <button type="button" class="magnetic-cta scp-glitchable-title font-bold text-sm font-serif-sc text-left text-[#141413] hover:text-[#9e1b1b] mb-1 py-0.5"
                  data-orig-title="${fullTitle}" data-scp-name="${item.codeName}">
                  ${fullTitle}
                </button>
                <p class="scp-glitchable-summary text-xs text-[#4a463f] line-clamp-1 leading-relaxed mb-2">${item.summary}</p>
              </div>

              <div class="archive-clues pt-2 border-t border-black/15 space-y-1.5">

                <div class="flex flex-wrap gap-1">
                  ${item.clues.map(c => `<span class="text-[10px] font-mono-tech px-1.5 py-0.5 bg-[#e2dccb] text-[#141413] border border-black/20">#${c}</span>`).join('')}
                </div>
              </div>
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
          <div class="flex items-center justify-between text-[11px] font-mono-tech opacity-65 border-b border-[var(--inner-border-soft)] pb-2 mb-3">
            <span>&gt; ARCHIVE DOSSIER // ${currentScp.id} &lt;</span>
            <span>${currentScp.pinLabel}</span>
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

          <div class="inner-card-alt p-3 mb-4 text-xs font-mono-tech space-y-1.5">
            <div class="flex justify-between border-b border-[var(--inner-border-soft)] pb-1">
              <span class="opacity-70">管辖部门 / 责任人:</span>
              <strong>${currentScp.department} (${currentScp.handlers})</strong>
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
        triggerScpTitleRedactionGlitch();
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
        showToast('已清除筛选并恢复全部收容物档案！', 'success');
      });

      document.getElementById('scp-empty-secondary-link').addEventListener('click', () => {
        scpSimulatedEmpty = false;
        scpSearchKeyword = currentDualNameHint;
        scpSearchInput.value = currentDualNameHint;
        renderScpArchives();
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
          triggerScpTitleRedactionGlitch();
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



      document.getElementById('forum-refresh-skeleton-btn').addEventListener('click', () => {
        currentForumThreadId = null;
        playSfx('click');
        renderForumView();
      });



      // 单一按钮触发隐藏的 file input
      document.getElementById('new-topic-upload-trigger-btn').addEventListener('click', () => {
        document.getElementById('new-topic-image-input').click();
      });

      document.getElementById('new-topic-image-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        readImageFileAsDataUrl(file, (dataUrl) => {
          pendingNewTopicImageData = dataUrl;
          document.getElementById('new-topic-image-hint').textContent = dataUrl
            ? `✓ 已装载图片：${file.name}（发布后送交管理员审核）`
            : '未选择附图';
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
            ? `✓ 已选附图：${file.name}`
            : '未选择附图';
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
        waxHash: '7c4a91e0b2f8',
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

      function simpleHashString(str) {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0, ch; i < str.length; i++) {
          ch = str.charCodeAt(i);
          h1 = Math.imul(h1 ^ ch, 2654435761);
          h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
      }

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

        document.getElementById('skydive-wax-hash').textContent = skydiveState.waxHash.substring(0, 10) + '...';

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
        { id: 'eye', icon: '👁️', name: '收容之眼', m3: 88, m4: 468, m5: 2600 },
        { id: 'rad', icon: '☢️', name: '高危核心', m3: 34, m4: 78, m5: 187 },
        { id: 'lock', icon: '🔺', name: '几何抑制锁', m3: 17, m4: 36, m5: 78 },
        { id: 'file', icon: '📁', name: '机密卷宗', m3: 9, m4: 18, m5: 32 },
        { id: 'dna', icon: '🧬', name: '记忆血清', m3: 6, m4: 9, m5: 15 },
        { id: 'pill', icon: '💊', name: '理智镇定剂', m3: 4, m4: 6, m5: 8 }
      ];

      const slot5x3Lines = [
        { id: 1, name: '① 中线', rows: [1, 1, 1, 1, 1] },
        { id: 2, name: '② 上线', rows: [0, 0, 0, 0, 0] },
        { id: 3, name: '③ 下线', rows: [2, 2, 2, 2, 2] },
        { id: 4, name: '④ 谷线', rows: [0, 1, 2, 1, 0] },
        { id: 5, name: '⑤ 山线', rows: [2, 1, 0, 1, 2] }
      ];

      const slot5x3Mechanisms = [
        { id: 'mech_1', title: '协议一 全视之眼锁定', desc: '盘面任意位置出现 3 枚收容之眼，拨付 ×3 倍特别津贴', discovered: false },
        { id: 'mech_2', title: '协议二 辐射共振回响', desc: '首尾两列同时出现高危核心，返还本转投入的 50%', discovered: false },
        { id: 'mech_3', title: '协议三 跨维样本序列', desc: '中线五格全为不同收容符号，触发 ×2 倍科研奖金', discovered: false }
      ];

      let slot5x3State = {
        board: [
          [slot5x3Symbols[2], slot5x3Symbols[5], slot5x3Symbols[4], slot5x3Symbols[1], slot5x3Symbols[0]],
          [slot5x3Symbols[3], slot5x3Symbols[4], slot5x3Symbols[5], slot5x3Symbols[0], slot5x3Symbols[1]],
          [slot5x3Symbols[4], slot5x3Symbols[3], slot5x3Symbols[0], slot5x3Symbols[5], slot5x3Symbols[2]]
        ],
        winningCells: new Set(),
        tubePlainSeed: '',
        tubeHash: '',
        history: [],
        spinning: false
      };



      function renderSlot5x3Board() {
        const grid = document.getElementById('slot5x3-grid');
        if (!grid) return;

        let html = '';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            const sym = slot5x3State.board[r][c];
            const isWin = slot5x3State.winningCells.has(`${r}_${c}`);
            html += `
              <div class="slot-cell h-16 sm:h-18 bg-[#e8e3d5] border-2 ${isWin ? 'is-winning border-[#9e1b1b] ring-2 ring-white scale-[1.02]' : 'border-black'} text-[#141413] flex flex-col items-center justify-center shadow-inner transition">
                <span class="slot-symbol text-xl sm:text-2xl" aria-hidden="true">${sym.icon}</span>
                <span class="slot-symbol-name text-[10px] font-mono-tech font-bold opacity-80 mt-0.5">${sym.name}</span>
              </div>
            `;
          }
        }
        grid.innerHTML = html;

        const totalBet = parseInt(document.getElementById('slot5x3-bet-input')?.value || '500', 10);
        const lineBet = Math.max(1, Math.round(totalBet / 5));
        document.getElementById('slot5x3-bet-summary').textContent = `押 ${totalBet.toLocaleString()} 每线 ${lineBet.toLocaleString()}`;
        document.getElementById('slot5x3-spin-subtext').textContent = `押 ${totalBet.toLocaleString()} 五线`;

        const payBody = document.getElementById('slot5x3-paytable-body');
        if (payBody) {
          payBody.innerHTML = slot5x3Symbols.map(s => `
            <tr>
              <td class="py-1.5 font-bold">${s.icon} ${s.name}</td>
              <td class="py-1.5 text-right"><div class="text-[10px] opacity-60">${s.m3}×</div><div class="font-bold">${(s.m3 * lineBet).toLocaleString()}</div></td>
              <td class="py-1.5 text-right"><div class="text-[10px] opacity-60">${s.m4}×</div><div class="font-bold">${(s.m4 * lineBet).toLocaleString()}</div></td>
              <td class="py-1.5 text-right"><div class="text-[10px] opacity-60">${s.m5}×</div><div class="font-bold text-[#9e1b1b]">${(s.m5 * lineBet).toLocaleString()}</div></td>
            </tr>
          `).join('');
        }

        const discCount = slot5x3Mechanisms.filter(m => m.discovered).length;
        document.getElementById('slot5x3-mechanisms-count').textContent = `已解锁 ${discCount}/3`;
        const mechList = document.getElementById('slot5x3-mechanisms-list');
        if (mechList) {
          mechList.innerHTML = slot5x3Mechanisms.map(m => `
            <div class="p-2.5 border border-dashed border-[var(--inner-border-soft)] ${m.discovered ? 'bg-black/10' : 'opacity-65'}">
              <div class="font-bold ${m.discovered ? 'text-[#9e1b1b]' : ''}">${m.discovered ? `✓ ${m.title}` : '？ ？ ？ [机密未触发]'}</div>
              <div class="text-[11px] mt-0.5">${m.discovered ? m.desc : '尚未触发该项隐藏收容协议'}</div>
            </div>
          `).join('');
        }
      }

      function renderSlot5x3History() {
        document.getElementById('slot5x3-history-header').textContent = `— 本桶记录 共 ${slot5x3State.history.length} 转`;
        const listEl = document.getElementById('slot5x3-history-list');
        if (!listEl) return;
        if (slot5x3State.history.length === 0) {
          listEl.innerHTML = `<div class="py-4 text-center opacity-60">新序列桶刚封上，尚未运转。</div>`;
          return;
        }
        listEl.innerHTML = slot5x3State.history.map((h, i) => `
          <div class="p-2 inner-card-alt flex justify-between items-center">
            <span>#${i + 1} 转 | 押 ${h.bet.toLocaleString()}</span>
            <strong class="${h.win > 0 ? 'text-[#9e1b1b]' : 'opacity-60'}">${h.win > 0 ? `+${h.win.toLocaleString()}` : '未中'}</strong>
          </div>
        `).join('');
      }

      function initSlot5x3Game() {
        createNewSlotTube();
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




      // ======================================================================
      // 分页 6-3：多档位 3 款封印配给刮刮乐（已彻底去除猫咪，改为严肃 SCP 收容配给主题，隐藏EV）
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
          sub: '三同矩阵',
          title: '收容印章三同赏',
          tagline: '三枚同印，核准即拨付',
          icon: '🔺',
          cellsCount: 12,
          baseTopPrize: 325000,
          bgBand: 'bg-[#141413] text-white',
          cardBg: 'bg-[#e8e2d2]',
          accentColor: 'text-[#9e1b1b]',
          rules: [
            '一、刮开 12 枚加密收容印章格',
            '二、同一收容印章凑满三枚即成一组',
            '三、组内三格津贴相加，多组可叠加'
          ]
        },
        {
          type: 'lucky_num',
          sub: '信标对号',
          title: '加密信标核对号',
          tagline: '对上频段，整笔经费入账',
          icon: '📡',
          cellsCount: 13,
          baseTopPrize: 650000,
          bgBand: 'bg-[#26292e] text-white',
          cardBg: 'bg-[#dfe3e6]',
          accentColor: 'text-[#141413]',
          rules: [
            '一、刮开上方 3 个基准频段号与倍率印',
            '二、下方 9 个实测频段每对上一个即得该格经费',
            '三、对中的经费相加，再乘基准倍率印'
          ]
        },
        {
          type: 'step_climb',
          sub: '五阶压制',
          title: '力场五阶压制表',
          tagline: '五阶比读数，压制几阶拿几阶',
          icon: '⚡',
          cellsCount: 10,
          baseTopPrize: 325000,
          bgBand: 'bg-[#4a1612] text-white',
          cardBg: 'bg-[#ebe4d8]',
          accentColor: 'text-[#9e1b1b]',
          rules: [
            '一、五阶各比一次抑制力场读数（共10格）',
            '二、右侧我方抑制值高过左侧异常冲击值，赢下该阶',
            '三、压制几阶，即领几阶对应收容奖金'
          ]
        }
      ];

      let selectedTier = scratchTiers[0];
      let pendingTicketType = null;
      let activeIssuedTicket = null;



      function renderScratchTiersAndLobby() {
        const tiersBar = document.getElementById('scratch-tiers-bar');
        const lobbyView = document.getElementById('scratch-lobby-view');

        if (tiersBar) {
          tiersBar.innerHTML = scratchTiers.map(t => {
            const active = t.id === selectedTier.id;
            return `
              <button type="button" data-tier-id="${t.id}" aria-pressed="${active}"
                class="scratch-tier-btn p-2.5 border transition text-center cursor-pointer ${active ? 'bg-[var(--inner-accent)] text-[var(--inner-accent-text)] border-black font-bold shadow' : 'bg-[#141414] text-neutral-300 border-white/20 hover:border-white'}">
                <div class="text-[11px] opacity-80">${t.name}</div>
                <div class="text-sm font-bold mt-0.5">${fmtMoney(t.cost)}</div>
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
          lobbyView.innerHTML = scratchGameTypes.map(g => {
            const topPrize = selectedTier.topPrizes?.[g.type] ?? selectedTier.cost*100;
            return `
              <div class="scratch-ticket-card ${g.cardBg} text-[#141413] border-2 border-[#141413] shadow-md flex flex-col justify-between overflow-hidden" data-ticket-kind="${g.type}">
                <div>
                  <div class="scratch-ticket-band h-12 ${g.bgBand} border-b border-[#141413] flex items-center justify-between px-4 font-mono-tech text-xs">
                    <span>A.V.E.D. RATION</span>
                    <span class="text-base">${g.icon}</span>
                  </div>
                  <div class="p-5 space-y-3">
                    <div>
                      <div class="text-xs font-mono-tech font-bold ${g.accentColor}">${g.sub}</div>
                      <h4 class="text-xl font-bold font-serif-sc">${g.title}</h4>
                      <p class="text-xs text-[#57534a]">${g.tagline}</p>
                    </div>

                    <div class="scratch-ticket-preview p-3 bg-white/60 border border-[#141413]/20 grid grid-cols-4 gap-1.5" aria-hidden="true">
                      ${Array.from({ length: 8 }).map((_, i) => `
                        <div class="scratch-preview-cell h-5 ${i === 0 ? 'is-revealed bg-white border border-black flex items-center justify-center text-[10px]' : 'bg-[#9ca3af]'}">
                          ${i === 0 ? g.icon : ''}
                        </div>
                      `).join('')}
                    </div>

                    <div class="scratch-ticket-summary flex items-center justify-between text-xs font-mono-tech pt-2 border-t border-[#141413]/20">
                      <div>
                        <div class="text-[#57534a]">最高津贴</div>
                        <div class="text-sm font-bold ${g.accentColor}">${fmtMoney(topPrize)}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-[#57534a]">封印格</div>
                        <div class="text-sm font-bold">${g.cellsCount} 格</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="p-4 pt-0">
                  <button type="button" data-pick-game="${g.type}"
                    class="pick-scratch-game-btn terminal-key w-full py-2.5 border border-[#141413] bg-[#141413] text-white hover:opacity-90 font-mono-tech font-bold text-xs transition cursor-pointer">
                    申领此票 ${fmtMoney(selectedTier.cost)}
                  </button>
                </div>
              </div>
            `;
          }).join('');

          lobbyView.querySelectorAll('.pick-scratch-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const gType = btn.getAttribute('data-pick-game');
              openTicketConfirmModal(gType);
            });
          });
        }
      }

      function openTicketConfirmModal(gType) {
        if (!currentUser) return;
        const g = scratchGameTypes.find(x => x.type === gType);
        if (!g) return;
        pendingTicketType = g;
        playSfx('click');

        document.getElementById('ticket-modal-icon').textContent = g.icon;
        document.getElementById('ticket-modal-sublabel').textContent = `出票 ${selectedTier.name} ${g.sub}`;
        document.getElementById('ticket-modal-title').textContent = g.title;
        document.getElementById('ticket-modal-tagline').textContent = g.tagline;
        document.getElementById('ticket-modal-price').textContent = fmtMoney(selectedTier.cost);
        document.getElementById('ticket-modal-price').dataset.cost=selectedTier.cost;document.getElementById('ticket-modal-price').dataset.revision=economyRevision;
        document.getElementById('ticket-modal-top-prize').textContent = fmtMoney(selectedTier.topPrizes?.[g.type] ?? selectedTier.cost*100);
        document.getElementById('ticket-modal-balance-preview').textContent =
          `${currentUser.balance.toLocaleString()} → ${(currentUser.balance - selectedTier.cost).toLocaleString()}`;

        document.getElementById('ticket-modal-rules').innerHTML = g.rules.map(r =>
          `<div class="font-medium text-[#141413]">● ${r}</div>`
        ).join('');

        const modal = document.getElementById('ticket-confirm-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }

      document.getElementById('ticket-modal-cancel-btn').addEventListener('click', () => {
        const modal = document.getElementById('ticket-confirm-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      });


      function renderActiveScratchTicketBoard() {
        if (!activeIssuedTicket) return;
        const tk = activeIssuedTicket;
        document.getElementById('active-ticket-title-bar').textContent =
          `${tk.gameType.icon} ${tk.gameType.title} [${tk.tier.name} ${fmtMoney(tk.tier.cost)}]`;
        document.getElementById('active-ticket-seed-badge').textContent = `SEAL: #${tk.seed}`;

        const board = document.getElementById('active-ticket-board-container');
        const colsClass = tk.gameType.type === 'step_climb' ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-4';

        board.innerHTML = `
          <div class="grid ${colsClass} gap-3">
            ${tk.cells.map(c => {
              if (!c.revealed) {
                return `
                  <button type="button" data-scratch-cell="${c.idx}"
                    class="scratch-cell-foil h-20 flex flex-col items-center justify-center p-2 text-center">
                    <span class="text-xs font-mono-tech font-bold text-[#141413]">SEALED #${c.idx + 1}</span>
                    <span class="text-[10px] text-[#141413]/70 mt-0.5">点击刮开涂层</span>
                  </button>
                `;
              }
              return `
                <div class="scratch-revealed-cell h-20 border-2 ${c.isWinPart ? 'is-winning border-[#9e1b1b] bg-[#fff5f5]' : 'border-black/35 bg-white'} text-[#141413] flex flex-col items-center justify-center p-2 text-center">
                  <div class="text-sm font-bold ${c.isWinPart ? 'text-[#9e1b1b]' : ''}">${c.label}</div>
                  <div class="text-[11px] font-mono-tech mt-0.5 opacity-80">${c.sub}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        board.querySelectorAll('[data-scratch-cell]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-scratch-cell'), 10);
            tk.cells[idx].revealed = true;
            playSfx('scratch');
            renderActiveScratchTicketBoard();
            checkAndSettleScratchTicket();
          });
        });
      }



      document.getElementById('scratch-reveal-all-cells-btn').addEventListener('click', () => {
        if (!activeIssuedTicket) return;
        activeIssuedTicket.cells.forEach(c => { c.revealed = true; });
        playSfx('scratch');
        renderActiveScratchTicketBoard();
        checkAndSettleScratchTicket();
      });

      document.getElementById('scratch-back-lobby-btn').addEventListener('click', () => {
        document.getElementById('scratch-play-table-view').classList.add('hidden');
        document.getElementById('scratch-lobby-view').classList.remove('hidden');
      });

      // ======================================================================
      // 分页 6-4：异常竞速赛马
      // ======================================================================
      const derbyRunners = [
        { id: 0, name: '1号 法棍 (法斗)', icon: '🐕', odds: 2.2, desc: '稳健巡游，胜率高' },
        { id: 1, name: '2号 几何折跃兽', icon: '🦌', odds: 3.5, desc: '偶发短距瞬移' },
        { id: 2, name: '3号 深潜触须体', icon: '🦑', odds: 5.0, desc: '后程爆发极强' },
        { id: 3, name: '4号 混沌电子羊', icon: '🐑', odds: 8.5, desc: '冷门高倍黑马' }
      ];

      let derbyState = {
        round: 104,
        secretPlainSeed: '',
        preCommitHash: '',
        predeterminedWinnerId: 0,
        selectedHorseId: 0,
        running: false,
        positions: [0, 0, 0, 0]
      };

      const derbyChatLog = [];



      function renderDerbyTracksAndButtons() {
        const tracksEl = document.getElementById('derby-tracks-container');
        if (tracksEl) {
          tracksEl.innerHTML = derbyRunners.map((h, idx) => {
            const pct = Math.min(92, derbyState.positions[idx]);
            return `
              <div class="space-y-1">
                <div class="flex justify-between text-[11px]">
                  <span>${h.name} <span class="text-amber-400">[赔率 ${h.odds}x]</span></span>
                  <span class="opacity-60">${h.desc}</span>
                </div>
                <div class="h-8 bg-black border border-white/20 relative flex items-center px-2">
                  <div class="absolute right-3 top-0 bottom-0 border-r-2 border-dashed border-red-500/70"></div>
                  <div class="transition-all duration-100 text-lg" style="margin-left: ${pct}%">${h.icon}</div>
                </div>
              </div>
            `;
          }).join('');
        }

        const btnsEl = document.getElementById('derby-horse-select-btns');
        if (btnsEl) {
          btnsEl.innerHTML = derbyRunners.map(h => {
            const active = derbyState.selectedHorseId === h.id;
            return `
              <button type="button" data-horse-id="${h.id}"
                class="derby-pick-btn p-2.5 border text-left transition cursor-pointer ${active ? 'bg-[var(--inner-accent)] text-[var(--inner-accent-text)] font-bold' : 'inner-card-alt opacity-80 hover:opacity-100'}">
                <div class="text-xs font-bold">${h.icon} ${h.name}</div>
                <div class="text-[11px] text-[var(--inner-crimson)] font-bold mt-0.5">赔率: ${h.odds} 倍</div>
              </button>
            `;
          }).join('');

          btnsEl.querySelectorAll('.derby-pick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              if (derbyState.running) return;
              derbyState.selectedHorseId = parseInt(btn.getAttribute('data-horse-id'), 10);
              playSfx('click');
              renderDerbyTracksAndButtons();
            });
          });
        }

        const chosen = derbyRunners[derbyState.selectedHorseId];
        document.getElementById('derby-current-bet-info').textContent = `已选：${chosen.name} (${chosen.odds}倍)`;
      }


      document.getElementById('derby-next-round-btn').addEventListener('click', () => {
        derbyState.round += 1;
        initDerbyRound();
      });

      function renderDerbyChat() {
        const box = document.getElementById('derby-chat-messages');
        if (!box) return;
        box.innerHTML = derbyChatLog.map(m => `
          <div class="p-2 inner-card-alt space-y-0.5">
            <div class="flex justify-between text-[10px] opacity-70">
              <strong class="text-[var(--inner-crimson)]">${m.sender}</strong>
              <span>${m.time}</span>
            </div>
            <div class="text-xs">${m.text}</div>
          </div>
        `).join('');
        box.scrollTop = box.scrollHeight;
      }


      // 娱乐室子导航切换
      const gamePanels = ['home', 'skydive', 'slots', 'scratch', 'derby', 'doudizhu', 'stocks'];
      document.querySelectorAll('.game-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-game');
          playSfx('click');
          document.querySelectorAll('.game-tab-btn').forEach(b => {
            b.className = 'game-tab-btn px-3.5 py-2 text-xs font-bold retro-corner-box opacity-80 hover:opacity-100 cursor-pointer';
          });
          btn.className = 'game-tab-btn px-3.5 py-2 text-xs font-bold bg-[var(--inner-accent)] text-[var(--inner-accent-text)] cursor-pointer';

          gamePanels.forEach(g => {
            const p = document.getElementById(`game-panel-${g}`);
            if (!p) return;
            if (g === target) p.classList.remove('hidden');
            else p.classList.add('hidden');
          });
        });
      });

      // KARMA INDEX 股市
      function applyMarket(data) {
        if(data.items)stocksData.splice(0,stocksData.length,...data.items);
        if(data.orders)stockOrdersData.splice(0,stockOrdersData.length,...data.orders);
        if(data.market)marketView=data.market;
        if(data.serverTime)AVEDTime.sync(data.serverTime);
        if(typeof data.balance==='number'){currentUser.balance=data.balance;syncUserHeaderUI();}
        renderStocks();
      }
      async function refreshMarket() {
        if(!currentUser||marketBusy)return;marketBusy=true;
        const code=marketCode,period=marketPeriod;
        try {
          const data=await api('/api/player/stocks?code='+encodeURIComponent(code)+'&period='+period);
          if(code===marketCode&&period===marketPeriod)applyMarket(data);
        } finally {marketBusy=false;if(code!==marketCode||period!==marketPeriod)refreshMarket().catch(e=>showToast(e.message));}
      }
      function renderStocks() {
        economyUI?.renderHoldings();
        const availableBalance=currentUser?.balance||0;
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
        select.innerHTML='<option value="KARMA">KARMA INDEX</option>'+stocksData.map(stock=>'<option value="'+esc(stock.code)+'">'+esc(stock.name)+'</option>').join('');select.value=marketCode;
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
        const container=document.getElementById('stocks-table-body');
        if(container.contains(document.activeElement)&&document.activeElement.matches('[data-stock-quantity], [data-stock-stop-input], [data-stock-take-input], [data-stock-leverage-input]'))return;
        const previousInputs=new Map([...container.querySelectorAll('[data-stock-quantity]')].map(input=>[input.dataset.stockQuantity,input.value]));
        const leverageInputs=new Map([...container.querySelectorAll('[data-stock-leverage-input]')].map(input=>[input.dataset.stockLeverageInput,input.value]));
        const stopInputs=new Map([...container.querySelectorAll('[data-stock-stop-input]')].map(input=>[input.dataset.stockStopInput,input.value]));
        const takeInputs=new Map([...container.querySelectorAll('[data-stock-take-input]')].map(input=>[input.dataset.stockTakeInput,input.value]));
        container.innerHTML=stocksData.map((stock,index)=>{const move=movementMeta(stock.price,previousQuotePrices.get(stock.code));const moveColorClass=move.className==='tick-up'?'market-up':(move.className==='tick-down'?'market-down':'');const leverageSelected=leverageInputs.get(stock.code)||'3';const estTrade=stock.price*Number(previousInputs.get(stock.code)||1);const estMargin=Math.ceil(estTrade/Number(leverageSelected||3));return `<article class="stock-quote-card" data-stock-index="${index}" data-stock-code="${esc(stock.code)}">
          <div class="stock-quote-heading"><button type="button" data-stock-chart-code="${esc(stock.code)}">${esc(stock.code)}</button><span class="${stock.change>=0?'market-up':'market-down'}">${stock.change>=0?'+':''}${stock.change.toFixed(2)}%</span></div>
          <h4>${esc(stock.name)}</h4><div class="stock-price-row"><strong class="stock-quote-price ${moveColorClass}">${fmtMoney(stock.price)}</strong><span class="market-tick-indicator ${move.className}" aria-label="实时方向">${move.arrow}</span></div>
          <p>持仓 ${Math.abs(stock.holding).toLocaleString()} 股（${stock.side==='short'?'买跌':'买涨'}）｜ 保证金 ${fmtMoney(stock.marginUsed||0)} ｜ 名义仓位 ${fmtMoney(stock.positionNotional||0)} ｜ 均价 ${fmtMoney(stock.avgCost||0)}${stock.effectiveLeverage?` ｜ 杠杆 ${stock.effectiveLeverage}x`:''}</p>
          <label>委托数量<input id="stock-quantity-${index}" data-stock-quantity="${esc(stock.code)}" data-stock-price="${stock.price}" data-stock-holding="${stock.holding}" type="number" min="1" max="10000" step="1" value="${esc(previousInputs.get(stock.code)||'1')}"></label>
          <label>杠杆倍数<select id="stock-leverage-${index}" data-stock-leverage-input="${esc(stock.code)}"><option value="3" ${leverageSelected==='3'?'selected':''}>3x</option><option value="10" ${leverageSelected==='10'?'selected':''}>10x</option></select></label>
          <label>止损（可选）<input id="stock-stop-${index}" data-stock-stop-input="${esc(stock.code)}" type="number" min="1" step="1" value="${esc(stopInputs.get(stock.code)||'')}"></label>
          <label>止盈（可选）<input id="stock-take-${index}" data-stock-take-input="${esc(stock.code)}" type="number" min="1" step="1" value="${esc(takeInputs.get(stock.code)||'')}"></label>
          <p class="portfolio-empty text-xs">可用余额 ${fmtMoney(availableBalance)} ｜ 预计成交额 <span class="stock-est-trade">${fmtMoney(estTrade)}</span> ｜ 预计保证金 <span class="stock-est-margin">${fmtMoney(estMargin)}</span> ｜ 余额可为负</p>
          <div class="stock-trade-actions"><button type="button" data-long-idx="${index}" data-long-code="${esc(stock.code)}" class="stock-buy-btn">买涨</button><button type="button" data-short-idx="${index}" data-short-code="${esc(stock.code)}" class="stock-sell-btn">买跌</button></div>
        </article>`;}).join('');
        stocksData.forEach(stock=>previousQuotePrices.set(stock.code,stock.price));
      }
      document.getElementById('next-market-tick-btn').addEventListener('click',()=>refreshMarket().catch(e=>showToast(e.message,'warn')));
      document.getElementById('stock-chart-symbol').addEventListener('change',event=>{marketCode=event.target.value;refreshMarket().catch(e=>showToast(e.message,'warn'));});
      document.getElementById('stock-chart-period').addEventListener('change',event=>{marketPeriod=Number(event.target.value);refreshMarket().catch(e=>showToast(e.message,'warn'));});
      document.getElementById('stocks-table-body').addEventListener('click',event=>{const button=event.target.closest('[data-stock-chart-code]');if(button){marketCode=button.dataset.stockChartCode;refreshMarket().catch(e=>showToast(e.message,'warn'));}});
      document.getElementById('stocks-table-body').addEventListener('input',event=>{
        const el=event.target;
        const card=el.closest('.stock-quote-card');
        if(!card)return;
        const qtyInput=card.querySelector('[data-stock-quantity]');
        if(!qtyInput)return;
        const code=qtyInput.dataset.stockQuantity;
        const quantity=Number(qtyInput.value)||0;
        const leverageInput=card.querySelector('[data-stock-leverage-input]');
        const leverage=Number(leverageInput?.value)||3;
        const marketPrice=Number(qtyInput.dataset.stockPrice)||0;
        const dealPrice=marketPrice;
        card.querySelector('.stock-est-trade')&&(card.querySelector('.stock-est-trade').textContent=fmtMoney(dealPrice*quantity));
        card.querySelector('.stock-est-margin')&&(card.querySelector('.stock-est-margin').textContent=fmtMoney(Math.ceil((dealPrice*quantity)/leverage)));
        if(el.matches('[data-stock-stop-input], [data-stock-take-input], [data-stock-quantity], [data-stock-leverage-input]')) {
          card.dataset.stockCode=code;
        }
      });

      // 在线牌桌
      const rankOrder = [
        { label: '3', val: 3 }, { label: '4', val: 4 }, { label: '5', val: 5 },
        { label: '6', val: 6 }, { label: '7', val: 7 }, { label: '8', val: 8 },
        { label: '9', val: 9 }, { label: '10', val: 10 }, { label: 'J', val: 11 },
        { label: 'Q', val: 12 }, { label: 'K', val: 13 }, { label: 'A', val: 14 },
        { label: '2', val: 15 }
      ];
      const suits = ['♠', '♥', '♣', '♦'];

      let ddzState = {
        phase: 'bidding',
        playerHand: [],
        aiLeftCount: 17,
        aiRightCount: 17,
        holeCards: [],
        lastPlay: null,
        selectedIndices: new Set()
      };



      function renderDoudizhuUI() {
        document.getElementById('ddz-ai-left-count').textContent = ddzState.aiLeftCount;
        document.getElementById('ddz-ai-right-count').textContent = ddzState.aiRightCount;

        const holeEl = document.getElementById('ddz-hole-cards');
        holeEl.innerHTML = ddzState.holeCards.map(c => {
          if (ddzState.phase === 'bidding') {
            return `<div class="w-9 h-12 bg-neutral-900 border border-white/30 flex items-center justify-center text-xs">■</div>`;
          }
          return `<div class="w-10 h-12 bg-[#f4f1ea] ${c.isRed ? 'text-[#9e1b1b]' : 'text-black'} font-bold text-xs flex flex-col items-center justify-center border border-black">
            <span>${c.suit}</span><span>${c.label}</span>
          </div>`;
        }).join('');

        const handEl = document.getElementById('ddz-player-hand');
        handEl.innerHTML = ddzState.playerHand.map((c, idx) => {
          const selected = ddzState.selectedIndices.has(idx);
          return `
            <button type="button" data-card-idx="${idx}"
              aria-pressed="${selected}" class="ddz-card-btn w-11 h-16 bg-[#f4f1ea] border-2 ${selected ? 'border-[#9e1b1b] -translate-y-3 shadow-lg' : 'border-black'} ${c.isRed ? 'text-[#9e1b1b]' : 'text-black'} flex flex-col items-center justify-between p-1 font-bold text-xs transition cursor-pointer select-none">
              <span class="self-start text-[10px]">${c.suit}</span>
              <span class="text-xs">${c.label}</span>
              <span class="self-end text-[10px]">${c.suit}</span>
            </button>
          `;
        }).join('');

        handEl.querySelectorAll('.ddz-card-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            if (ddzState.phase !== 'playing') return;
            const i = parseInt(btn.getAttribute('data-card-idx'), 10);
            if (ddzState.selectedIndices.has(i)) ddzState.selectedIndices.delete(i);
            else ddzState.selectedIndices.add(i);
            playSfx('click');
            renderDoudizhuUI();
          });
        });
      }

      function evaluateCards(cards) {
        if (cards.length === 1) return { type: 'single', val: cards[0].val };
        if (cards.length === 2) {
          if (cards[0].val === 17 && cards[1].val === 16) return { type: 'bomb', val: 99 };
          if (cards[0].val === cards[1].val) return { type: 'pair', val: cards[0].val };
        }
        if (cards.length === 3 && cards[0] && cards[0].val === cards[1].val && cards[1].val === cards[2].val) {
          return { type: 'triple', val: cards[0].val };
        }
        if (cards.length === 4 && cards.every(c => c.val === cards[0].val)) {
          return { type: 'bomb', val: cards[0].val };
        }
        return null;
      }

      function renderTableCards(cards, whoLabel) {
        document.getElementById('ddz-table-status').textContent = whoLabel;
        document.getElementById('ddz-last-played-cards').innerHTML = cards.map(c => `
          <div class="w-11 h-15 bg-[#f4f1ea] ${c.isRed ? 'text-[#9e1b1b]' : 'text-black'} font-bold text-xs flex flex-col items-center justify-center p-1.5 border border-black">
            <span>${c.suit}</span><span>${c.label}</span>
          </div>
        `).join('');
      }



      document.getElementById('ddz-hint-btn').addEventListener('click', () => {
        if (ddzState.phase !== 'playing' || ddzState.playerHand.length === 0) return;
        ddzState.selectedIndices.clear();
        let targetIdx = ddzState.playerHand.length - 1;
        if (ddzState.lastPlay && ddzState.lastPlay.by !== 'player' && ddzState.lastPlay.type === 'single') {
          for (let i = ddzState.playerHand.length - 1; i >= 0; i--) {
            if (ddzState.playerHand[i].val > ddzState.lastPlay.val) {
              targetIdx = i;
              break;
            }
          }
        }
        ddzState.selectedIndices.add(targetIdx);
        renderDoudizhuUI();
      });



      initDoudizhu();

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
      let playerHistory=[],playerProfile={},playerAchievements=[],forumNext=null,forumLoading=false,playerMusic=[],musicIndex=0,skyRound=null,skyPollBusy=false,cardRound=null;
      const byId=id=>document.getElementById(id);
      function showToast(message,type='info') {
        const el=document.createElement('div');el.className='px-4 py-3 border border-white bg-black text-white text-sm';
        el.textContent=String(message);byId('toast-container').append(el);setTimeout(()=>el.remove(),5000);
      }
      function employeeDirectoryCard(e){return {id:String(e.id),name:esc(e.displayName),department:esc(e.department),positionTitle:esc(e.positionTitle||''),isNpc:!!e.isNpc,isLeadership:!!e.isLeadership,bracketTag:esc(e.positionTitle||(e.isNpc?'NPC 档案':e.enabled===0?'暂停接入':'成员')),stats:[0,0,0,0,0,0],location:'',abilityNote:esc(e.registeredDepartment&&e.registeredDepartment!==e.department?e.registeredDepartment:''),avatarBadge:'员',avatarColor:'#444',avatarUrl:e.avatarUrl||''};}
      async function refreshDirectory(){if(!currentUser)return;const serial=++directoryRequest;const d=await api('/api/player/directory');if(serial!==directoryRequest)return;employees=d.items.map(employeeDirectoryCard);renderDepartmentsAndPersonnel();}
      function applyEconomyRules(c){economyRevision=c.revision;for(const t of c.tiers){const tier=scratchTiers.find(x=>x.id===t.id);if(tier)Object.assign(tier,t);}economyUI?.configure(c);}
      async function loadPlayerData() {
        const data=await api('/api/player/state');if(!data.employee||!data.profile||!Array.isArray(data.employees)||!Array.isArray(data.departments)||!Array.isArray(data.announcements)||!Array.isArray(data.dossiers)||!Array.isArray(data.stocks)||!Array.isArray(data.history)||!Array.isArray(data.achievements)||!Array.isArray(data.music)||!Array.isArray(data.forum?.items))throw new Error('员工资料未完整送达，请重新接入。');AVEDTime.sync(data.serverTime);marketView=data.market;playerProfile=data.profile;playerAchievements=data.achievements;playerHistory=data.history;profileFreshAt=Date.now();
        if(data.economy)applyEconomyRules(data.economy);
        employees=data.employees.map(employeeDirectoryCard);
        departmentsData.splice(0,departmentsData.length,...data.departments.map(d=>({...d,name:esc(d.name),desc:esc(d.desc),motto:esc(d.motto),minister:''})));
        currentUser={id:String(data.employee.id),name:data.employee.displayName,account:data.employee.username,department:data.employee.department,bracketTag:data.employee.department,
          positionTitle:data.employees.find(e=>String(e.id)===String(data.employee.id))?.positionTitle||'',isAdmin:false,serverAdmin:data.employee.role==='admin',balance:data.balance,savedAlias:data.profile.anonymousName,streak:data.streak,lastCheckinDate:data.checkin?getTodayDateString():'',avatarBadge:'员',avatarColor:'#444'};
        companyNews=data.announcements.map(n=>({id:String(n.id),title:esc(n.title),code:'AVED-'+n.id,category:n.pinned?'置顶公告':'公司通告',pinned:!!n.pinned,createdAt:n.createdAt,issuer:n.issuer||'万业携生',drafter:n.drafter||'',issuedOn:n.issuedOn||'',postCount:Number(n.postCount)||0,summary:esc(AVEDNotices.excerpt(n.body)),fullContent:esc(n.body),realComments:[]}));
        scpItemsData=data.dossiers.map(d=>({id:esc(d.code),dbId:d.id,codeName:esc(d.title),department:esc(d.department),level:esc(d.status),summary:esc(d.summary),description:esc(d.summary),procedure:'收容规程见本卷宗。',handlers:'',location:'',clues:[],pinLabel:'ARCHIVE',polaroidTag:'收容物档案',realComments:[]}));
        forumThreads=data.forum.items;forumNext=data.forum.next;
        stocksData.splice(0,stocksData.length,...data.stocks);stockOrdersData.splice(0,stockOrdersData.length,...(data.stockOrders||[]));playerMusic=data.music;
        return currentUser;
      }
      function syncUserHeaderUI() {
        if(!currentUser)return;
        byId('welcome-employee-banner').textContent='当前用户：'+currentUser.name;
        byId('intranet-role').textContent='当前身份 ID：['+(currentUser.savedAlias||playerProfile.anonymousName||'未登记')+']';
        if(byId('hub-balance'))byId('hub-balance').textContent=fmtMoney(currentUser.balance);
        if(lastProfileBalance!==null&&lastProfileBalance!==currentUser.balance)profileFreshAt=0;lastProfileBalance=currentUser.balance;
        byId('forum-current-balance').textContent='当前余额 '+fmtMoney(currentUser.balance);
        byId('top-balance-val').textContent=fmtMoney(currentUser.balance);
        const checked=currentUser.lastCheckinDate===getTodayDateString();
        byId('header-quick-checkin-btn').textContent=checked?'已签到':'签到';byId('header-quick-checkin-btn').disabled=checked;
        byId('header-quick-relief-btn').classList.remove('hidden');byId('header-quick-relief-btn').disabled=currentUser.balance>=10000;byId('header-quick-relief-btn').textContent='领取低保';
        byId('claim-relief-btn').textContent='余额低于 10,000 可领低保';
      }
      async function refreshBalance(){const d=await api('/api/me');if(currentUser){currentUser.balance=d.balance;syncUserHeaderUI();}}
      async function performDailyCheckin(){try{const d=await api('/api/checkin',{method:'POST'});currentUser.balance=d.balance;currentUser.lastCheckinDate=getTodayDateString();syncUserHeaderUI();showToast('签到成功，已入账 '+fmtMoney(d.reward));welfareUI?.refresh().catch(()=>{});window.AVEDRewardsRefresh?.().catch(()=>{});}catch(e){showToast(e.message,'warn');}}
      async function performClaimRelief(){try{const d=await api('/api/player/relief',{method:'POST'});currentUser.balance=d.balance;syncUserHeaderUI();showToast('低保已入账 10,000。');welfareUI?.refresh().catch(()=>{});window.AVEDRewardsRefresh?.().catch(()=>{});}catch(e){showToast(e.message,'warn');}}
      function completeEnterIntranet(emp){
        currentUser=emp;aliasInputEl.value=playerProfile.anonymousName;
        document.body.classList.remove('theme-landing');document.body.classList.add('theme-inner');
        landingView.classList.add('hidden');innerAppView.classList.remove('hidden');
        syncUserHeaderUI();renderCompanyNewsView();renderDepartmentsAndPersonnel();renderScpArchives();renderForumView();
        communityUI.refresh();welfareUI.refresh().catch(e=>showToast(e.message));renderScratchTiersAndLobby();initSlot5x3Game();initDerbyRound();renderStocks();initSkydiveGame();switchMainView('welcome');
        if(window.innerWidth<768&&!isSidebarCollapsed)toggleSidebar();
        refreshChat('sky');refreshChat('derby');startChatStreams();
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
      function randomizeScpDualNamePlaceholder(){byId('scp-search-input').placeholder=scpItemsData.length?scpItemsData[Math.floor(Math.random()*scpItemsData.length)].codeName:'搜索收容物名称';}
      function triggerForumSkeletonLoading(){renderForumView();}
      function readImageFileAsDataUrl(file,callback){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1500000){showToast('请选择 1.5 MB 以内的 PNG、JPG 或 WEBP 图片。','warn');return;}const reader=new FileReader();reader.onload=()=>callback(reader.result);reader.readAsDataURL(file);}
      const forumEditControl=(item,kind)=>`${item.editedAt?`<p class="edited-label">已编辑 ${AVEDTime.markup(item.editedAt)} ${AVEDTime.markup(item.editedAt,'clock')}</p>`:''}${item.canEdit?`<button type="button" class="community-button" data-edit-speech="${kind}" data-speech-id="${item.id}">编辑发言</button>`:''}`;
      const attachment=item=>item.imageData?`<img src="${esc(item.imageData)}" class="max-w-full max-h-96 object-contain mt-3" alt="随帖影像" loading="lazy">`:'';
      function returnForumList(){currentForumThreadId=null;renderForumView();byId('view-forum').scrollIntoView({block:'start'});}
      function renderForumView(){
        const th=forumThreads.find(t=>String(t.id)===String(currentForumThreadId));
        byId('forum-list-subview').classList.toggle('hidden',!!th);byId('forum-detail-subview').classList.toggle('hidden',!th);
        byId('forum-skeleton-container')?.classList.add('hidden');if(byId('forum-global-back'))byId('forum-global-back').hidden=!th;
        if(!th){currentForumThreadId=null;byId('forum-threads-list-container').innerHTML=forumThreads.map(t=>`<article class="retro-corner-box p-5 space-y-2"><div class="font-mono-tech text-xs">${t.identityMode==='real'?'实名':'匿名'} ${esc(t.anonymousName)} ${AVEDTime.markup(t.createdAt)} 余额 ${fmtMoney(t.balance)}</div><h3 class="font-bold text-lg">${esc(t.title)}</h3><p class="line-clamp-2 whitespace-pre-wrap">${esc(t.body)}</p><button data-cloud-thread="${t.id}" class="inner-btn-primary px-3 py-2">进入帖子 (${t.replyCount}) →</button></article>`).join('')||'<p class="p-5">暂无帖子。</p>';
          if(forumNext)byId('forum-threads-list-container').insertAdjacentHTML('beforeend','<button id="forum-load-more" class="retro-corner-box w-full p-4">继续加载</button>');
          return;}
        byId('forum-detail-thread-id-badge').textContent='THREAD #'+th.id;
        byId('forum-detail-main-post').innerHTML=`<div class="text-xs mb-4">${th.identityMode==='real'?'实名':'匿名'} ${esc(th.anonymousName)} ${AVEDTime.markup(th.createdAt)} 余额 ${fmtMoney(th.balance)}</div><h3 class="text-xl font-bold">${esc(th.title)}</h3><p class="whitespace-pre-wrap mt-4">${esc(th.body)}</p>${attachment(th)}${forumEditControl(th,'thread')}`;
        api('/api/player/forum/'+th.id).then(d=>{if(String(currentForumThreadId)!==String(th.id))return;
          byId('forum-detail-replies-list').innerHTML=d.items.map(r=>`<article class="inner-card-alt p-4 space-y-2"><b>${esc(r.anonymousName)}</b> <small>${r.identityMode==='real'?'实名':'匿名'}</small> ${AVEDTime.markup(r.createdAt)} ${fmtMoney(r.balance)}<p class="whitespace-pre-wrap">${esc(r.body)}</p>${attachment(r)}${forumEditControl(r,'reply')}</article>`).join('')||'<p>暂无回复。</p>';
          byId('forum-detail-reply-count').textContent='全部回复 ('+d.items.length+')';}).catch(e=>showToast(e.message,'warn'));
      }
      async function refreshForum(){const selected=currentForumThreadId,d=await api('/api/player/forum');if(selected&&!d.items.some(t=>String(t.id)===String(selected))){try{const detail=await api('/api/player/forum/'+selected);d.items.push(detail.thread);}catch(e){if(e.status===401)throw e;}}forumThreads=d.items;forumNext=d.next;renderForumView();}
      async function loadMoreForum(){if(!forumNext||forumLoading)return;forumLoading=true;const el=byId('forum-load-more');if(el){el.disabled=true;el.innerHTML='<span class="animate-pulse">正在载入更多帖子… ▰ ▰ ▰</span>';byId('forum-skeleton-container').classList.remove('hidden');}
        try{const d=await api('/api/player/forum?before='+forumNext);forumThreads.push(...d.items);forumNext=d.next;renderForumView();}finally{forumLoading=false;byId('forum-skeleton-container').classList.add('hidden');}}
      window.addEventListener('scroll',()=>{if(currentUser&&!byId('view-forum').classList.contains('hidden')&&!currentForumThreadId&&innerHeight+scrollY>document.documentElement.scrollHeight-200)loadMoreForum().catch(e=>showToast(e.message));},{passive:true});
      function createNewSlotTube(){slot5x3State.history=playerHistory.filter(h=>h.game==='slot').map(h=>({bet:h.cost,win:h.prize}));byId('slot5x3-seal-status').textContent='封签已核验';byId('slot5x3-seal-hash').textContent='独立封签';byId('slot5x3-revealed-tube-seed').textContent='转轮停止后可核验封签。';renderSlot5x3History();}
      function initDerbyRound(){derbyState.running=false;derbyState.positions=[0,0,0,0];byId('derby-status-text').textContent='请选择跑道并开闸。';byId('derby-pre-hash').textContent='赛场封签已就绪';byId('derby-start-race-btn').classList.remove('hidden');byId('derby-next-round-btn').classList.add('hidden');renderDerbyTracksAndButtons();}
      function initSkydiveGame(){pollSky().catch(e=>showToast(e.message));}
      function initDoudizhu(){if(!currentUser)return;api('/api/player/games/cards',{method:'POST',body:{action:'start'}}).then(renderServerCards).catch(e=>showToast(e.message));}
      function renderServerCards(data){
        cardRound=data.round;Object.assign(ddzState,data);ddzState.selectedIndices.clear();currentUser.balance=data.balance;syncUserHeaderUI();
        byId('ddz-call-landlord-btn').classList.toggle('hidden',data.phase!=='bidding');
        for(const id of ['ddz-play-btn','ddz-pass-btn','ddz-hint-btn'])byId(id).classList.toggle('hidden',data.phase!=='playing');
        byId('ddz-player-role-badge').textContent=data.phase==='bidding'?'等待抢地主':'地主';
        byId('ddz-ai-left-role').textContent='电脑对手 A';byId('ddz-ai-right-role').textContent='电脑对手 B';
        byId('ddz-turn-indicator').textContent=data.phase==='ended'?(data.winner===0?'本局获胜，奖金已入账。':'本局结束，电脑对手获胜。'):data.phase==='bidding'?'点击抢地主开始':'轮到你出牌：单张、对子、三张、炸弹';
        if(data.lastPlay)renderTableCards(data.lastPlay.cards,'上一手出牌');else byId('ddz-last-played-cards').replaceChildren();renderDoudizhuUI();
      }
      function renderSky(state){skyRound=state.round;skyUI.render(state);}
      async function pollSky(){return skyUI.poll();}
      async function refreshChat(room){renderChat(room,await api('/api/player/chat?room='+room));}
      function renderChat(room,d){if(room==='sky')skyUI.radio(d.items);const box=byId(room==='sky'?'skydive-chat-list':'derby-chat-messages');if(!box)return;
        const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;const last=box.dataset.lastId;const next=String(d.items.at(-1)?.id||'')+d.items.map(m=>m.alias).join('|');if(last===next)return;
        box.innerHTML=d.items.map(m=>`<div class="py-1"><b>${esc(m.alias)}</b> <span class="text-xs opacity-60">${AVEDTime.markup(m.createdAt,'clock')}</span><p class="whitespace-pre-wrap">${esc(m.body)}</p></div>`).join('');box.dataset.lastId=next;if(nearBottom||!last)box.scrollTop=box.scrollHeight;
      }
      let chatConnections=[];
      function startChatStreams(){for(const connection of chatConnections)connection.close();chatConnections=['sky','derby'].map(room=>{const source=new EventSource('/api/player/chat/stream?room='+room);source.onmessage=e=>renderChat(room,JSON.parse(e.data));return source;});}
      function fluctuateStocks(){return refreshMarket().catch(e=>showToast(e.message,'warn'));}
      function renderProfile(){personalUI.render();}
      let profileRequest=null,profileFreshAt=0,lastProfileBalance=null;
      async function showProfile(){switchMainView('profile');renderProfile();if(Date.now()-profileFreshAt<30000)return;if(profileRequest)return profileRequest;const uid=currentUser.id;profileRequest=(async()=>{try{const d=await api('/api/profile');if(currentUser?.id!==uid)return;playerProfile=d.profile;playerAchievements=d.achievements;currentUser.balance=d.balance;profileFreshAt=Date.now();if(!byId('view-profile').classList.contains('hidden'))renderProfile();}finally{profileRequest=null;}})();return profileRequest;}
      function stop(event){event.preventDefault();event.stopImmediatePropagation();}
      async function action(button,task){if(button?.dataset.busy)return;if(button){button.dataset.busy='1';button.disabled=true;}try{await task();}catch(e){if(e.code==='RULES_CHANGED'){try{applyEconomyRules(await api('/api/player/economy'));byId('ticket-confirm-modal').classList.add('hidden');byId('ticket-confirm-modal').classList.remove('flex');renderScratchTiersAndLobby();}catch{}}showToast(e.message,'warn');}finally{if(button){delete button.dataset.busy;button.disabled=false;}}}
      document.addEventListener('submit',event=>{
        const form=event.target;const id=form.id;
        const handled=['new-forum-topic-form','forum-detail-reply-form','news-detail-comment-form','scp-realname-comment-form','skydive-chat-form','derby-chat-form','cloud-profile-form'];
        if(!handled.includes(id))return;stop(event);
        action(form.querySelector('[type=submit]')||form.querySelector('button'),async()=>{
          if(id==='new-forum-topic-form'||id==='forum-detail-reply-form'){
            const reply=id==='forum-detail-reply-form';
            const d=await api('/api/player/forum'+(reply?'/'+currentForumThreadId:''),{method:'POST',body:{title:byId('new-topic-title').value,body:byId(reply?'forum-detail-reply-text':'new-topic-content').value,identityMode:form.querySelector('[name=identityMode]')?.value||playerProfile.forumIdentity||'anonymous',imageData:reply?pendingReplyImageData:pendingNewTopicImageData}});
            form.reset();form.querySelector('[name=identityMode]').value=playerProfile.forumIdentity||'anonymous';if(reply)pendingReplyImageData=null;else pendingNewTopicImageData=null;byId(reply?'reply-image-selected-hint':'new-topic-image-hint').textContent='未选择附图';await refreshForum();showToast(d.pending?'整条图文已提交审核，通过后公开显示。':'已发布。');
          }else if(id==='news-detail-comment-form'){
            await api('/api/posts',{method:'POST',body:{announcementId:Number(currentNewsId),anonymousName:playerProfile.anonymousName,body:byId('news-detail-comment-input').value}});form.reset();renderCompanyNewsView();
          }else if(id==='scp-realname-comment-form'){
            const dossier=scpItemsData.find(s=>s.id===selectedScpId);if(!dossier)throw new Error('请先选择档案。');
            const input=form.querySelector('textarea,input:not([type]),input[type=text]');await api('/api/player/dossiers/'+dossier.dbId+'/comments',{method:'POST',body:{body:input?.value||''}});form.reset();await loadDossierComments(dossier);
          }else if(id.endsWith('chat-form')){
            const room=id==='skydive-chat-form'?'sky':'derby',input=form.querySelector('textarea,input:not([type]),input[type=text]');await api('/api/player/chat',{method:'POST',body:{room,body:input?.value||''}});form.reset();await refreshChat(room);
          }else if(id==='cloud-profile-form'){
            const fd=new FormData(form);let avatarUrl=playerProfile.avatarUrl;const file=fd.get('avatar');
            if(file?.size){if(file.size>1500000)throw new Error('头像不能超过 1.5 MB。');avatarUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
            const d=await api('/api/profile',{method:'PUT',body:{anonymousName:fd.get('anonymousName'),bio:'',avatarUrl}});playerProfile=d.profile;currentUser.savedAlias=d.profile.anonymousName;aliasInputEl.value=d.profile.anonymousName;syncUserHeaderUI();refreshDirectory().catch(()=>{});showToast('个人资料已保存。');renderProfile();
          }
        });
      },true);
      async function loadDossierComments(dossier){const d=await api('/api/player/dossiers/'+dossier.dbId+'/comments');dossier.realComments=d.items.map(c=>({id:String(c.id),authorName:esc(c.displayName),authorRole:esc(c.department),time:AVEDTime.markup(c.createdAt),text:esc(c.body)}));renderScpArchives();triggerScpTitleRedactionGlitch();}
      document.addEventListener('click',event=>{
        const card=event.target.closest('[data-scp-id]');if(card){const dossier=scpItemsData.find(d=>d.id===card.dataset.scpId);if(dossier)loadDossierComments(dossier).catch(e=>showToast(e.message));}
        const button=event.target.closest('button,a');if(!button)return;const id=button.id;
        if(button.dataset.cloudNews){stop(event);currentNewsId=button.dataset.cloudNews;renderCompanyNewsView();byId('news-detail-subview').scrollIntoView({block:'start'});return;}
        if(button.dataset.cloudThread){stop(event);currentForumThreadId=button.dataset.cloudThread;renderForumView();byId('view-forum').scrollIntoView({block:'start'});return;}
        if(button.dataset.nav==='welcome'){stop(event);showProfile().catch(e=>showToast(e.message));return;}
        if(button.dataset.nav==='containment'){const dossier=scpItemsData.find(d=>d.id===selectedScpId)||scpItemsData[0];if(dossier)loadDossierComments(dossier).catch(e=>showToast(e.message));}
        if(button.dataset.nav){api('/api/player/view',{method:'POST',body:{page:button.dataset.nav}}).catch(()=>{});}
        if(button.dataset.game==='doudizhu'&&!cardRound)initDoudizhu();
        if(['ddz-call-landlord-btn','ddz-play-btn','ddz-pass-btn','ddz-new-game-btn'].includes(id)){
          stop(event);action(button,async()=>{const a={'ddz-call-landlord-btn':'bid','ddz-play-btn':'play','ddz-pass-btn':'pass','ddz-new-game-btn':'start'}[id];
            const cards=[...ddzState.selectedIndices].map(i=>ddzState.playerHand[i]?.id);
            renderServerCards(await api('/api/player/games/cards',{method:'POST',body:{action:a,round:cardRound,cards}}));});return;
        }
        const handled=['forum-load-more','forum-refresh-skeleton-btn','zero-balance-btn','ticket-modal-confirm-btn','scratch-next-ticket','slot5x3-spin-btn','slot5x3-verify-tube-btn','derby-start-race-btn','skydive-board-btn','skydive-open-chute-btn','cloud-profile-open','cloud-music-prev','cloud-music-next','cloud-music-play'];
        const trade=button.hasAttribute('data-long-idx')||button.hasAttribute('data-short-idx');
        if(!handled.includes(id)&&!trade)return;stop(event);
        if(id==='zero-balance-btn'){askSecondConfirmation('确认将余额归零？','确认后当前余额将清零。',()=>action(button,async()=>{const d=await api('/api/player/balance/zero',{method:'POST'});currentUser.balance=d.balance;syncUserHeaderUI();profileFreshAt=0;showProfile().catch(e=>showToast(e.message));}));return;}
        action(button,async()=>{
          if(id==='cloud-profile-open')return showProfile();
          if(id==='forum-load-more')return loadMoreForum();
          if(id==='forum-refresh-skeleton-btn')return refreshForum();
          if(id==='ticket-modal-confirm-btn'||id==='scratch-next-ticket'){
            const type=id==='scratch-next-ticket'?activeIssuedTicket?.gameType:pendingTicketType;if(!type)throw new Error('请先选择票种。');
            const d=await api('/api/player/games/scratch',{method:'POST',body:{tier:selectedTier.id,type:type.type,cost:id==='scratch-next-ticket'?selectedTier.cost:Number(byId('ticket-modal-price').dataset.cost),revision:id==='scratch-next-ticket'?economyRevision:Number(byId('ticket-modal-price').dataset.revision)}});
            activeIssuedTicket=d.result;currentUser.balance=d.balance;syncUserHeaderUI();
            byId('ticket-confirm-modal').classList.add('hidden');byId('ticket-confirm-modal').classList.remove('flex');
            byId('scratch-lobby-view').classList.add('hidden');byId('scratch-play-table-view').classList.remove('hidden');
            byId('active-ticket-result-banner').textContent='刮开涂层查看结果。';renderActiveScratchTicketBoard();byId('scratch-next-ticket').disabled=true;
          }else if(id==='slot5x3-spin-btn'){
            const d=await api('/api/player/games/slot',{method:'POST',body:{bet:Number(byId('slot5x3-bet-input').value)}});
            slot5x3State.board=d.result.board;slot5x3State.winningCells=new Set(d.result.winningCells);slot5x3State.history.unshift({bet:d.cost,win:d.prize});
            d.result.mechanisms.forEach(i=>slot5x3Mechanisms[i].discovered=true);slot5x3State.tubePlainSeed=d.seed;slot5x3State.tubeHash=d.seedHash;
            byId('slot5x3-seal-hash').textContent=d.seedHash;byId('slot5x3-win-summary').textContent='本转奖金 '+fmtMoney(d.prize);currentUser.balance=d.balance;syncUserHeaderUI();renderSlot5x3Board();renderSlot5x3History();
          }else if(id==='slot5x3-verify-tube-btn'){byId('slot5x3-revealed-tube-seed').textContent=slot5x3State.tubePlainSeed?'种子 '+slot5x3State.tubePlainSeed:'请先完成一转。';}
          else if(id==='derby-start-race-btn'){
            const d=await api('/api/player/games/derby',{method:'POST',body:{bet:Number(byId('derby-bet-amount').value),runner:derbyState.selectedHorseId}});
            derbyState.running=true;byId('derby-start-race-btn').classList.add('hidden');byId('derby-pre-hash').textContent=d.seedHash;let ticks=0;
            const timer=setInterval(()=>{ticks++;derbyState.positions=derbyRunners.map(r=>Math.min(r.id===d.result.winner?92:80,ticks*(r.id===d.result.winner?8:6)));renderDerbyTracksAndButtons();if(ticks>=12){clearInterval(timer);derbyState.running=false;currentUser.balance=d.balance;syncUserHeaderUI();byId('derby-status-text').textContent=derbyRunners[d.result.winner].name+' 夺冠 奖金 '+fmtMoney(d.prize);byId('derby-revealed-seed').textContent='种子 '+d.seed;byId('derby-next-round-btn').classList.remove('hidden');}},120);
          }else if(id==='skydive-board-btn'){const input=byId('sky-bet-input')||byId('skydive-bet-input');const d=await api('/api/player/games/sky/start',{method:'POST',body:{bet:Number(input?.value||10000),round:skyUI.round()}});renderSky(d);showToast('您已登机');}
          else if(id==='skydive-open-chute-btn'){if(!skyUI.round())throw new Error('请先登机。');renderSky(await api('/api/player/games/sky/jump',{method:'POST',body:{round:skyUI.round()}}));}
          else if(trade){
            const long=button.hasAttribute('data-long-idx');
            const index=Number(button.getAttribute(long?'data-long-idx':'data-short-idx'));
            const code=button.getAttribute(long?'data-long-code':'data-short-code')||'';
            const quantityInput=byId('stock-quantity-'+index);
            if(!quantityInput)throw new Error('未找到委托输入框，请刷新后重试。');
            const quantity=Number(quantityInput.value);
            if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw new Error('委托数量应为 1 至 10,000 的整数。');
            if(!code)throw new Error('证券代码缺失，请刷新后重试。');
            const leverageInput=byId('stock-leverage-'+index);
            if(!leverageInput)throw new Error('未找到杠杆设置，请刷新后重试。');
            const leverage=Math.round(Number(leverageInput.value));
            if(![3,10].includes(leverage))throw new Error('杠杆仅支持 3x 或 10x。');
            const stopRaw=byId('stock-stop-'+index)?.value;
            const takeRaw=byId('stock-take-'+index)?.value;
            const parseOptional=value=>value==null||value===''?null:Math.round(Number(value));
            const stopLoss=parseOptional(stopRaw),takeProfit=parseOptional(takeRaw);
            if(stopLoss!==null&&(!Number.isSafeInteger(stopLoss)||stopLoss<=0))throw new Error('止损价需为正整数。');
            if(takeProfit!==null&&(!Number.isSafeInteger(takeProfit)||takeProfit<=0))throw new Error('止盈价需为正整数。');
            const stock=stocksData.find(item=>item.code===code);
            const currentPrice=Number(stock?.price);
            if(Number.isFinite(currentPrice)&&currentPrice>0){
              if(long){
                if(stopLoss!==null&&stopLoss>=currentPrice)throw new Error('买涨时止损需低于现价。');
                if(takeProfit!==null&&takeProfit<=currentPrice)throw new Error('买涨时止盈需高于现价。');
              }else{
                if(stopLoss!==null&&stopLoss<=currentPrice)throw new Error('买跌时止损需高于现价。');
                if(takeProfit!==null&&takeProfit>=currentPrice)throw new Error('买跌时止盈需低于现价。');
              }
            }
            const d=await api('/api/player/stocks?code='+encodeURIComponent(marketCode)+'&period='+marketPeriod,{method:'POST',body:{code,side:long?'long':'short',quantity,leverage,orderType:'market',stopLoss,takeProfit}});
            applyMarket(d);
            showToast('委托已成交。');
          }
          else if(id.startsWith('cloud-music')){
            if(!playerMusic.length)throw new Error('广播频道暂无曲目。');const audio=byId('cloud-music-audio');
            if(id==='cloud-music-prev')musicIndex=(musicIndex-1+playerMusic.length)%playerMusic.length;
            if(id==='cloud-music-next')musicIndex=(musicIndex+1)%playerMusic.length;
            const track=playerMusic[musicIndex];byId('cloud-music-title').textContent=track.title;
            if(audio.getAttribute('src')!==track.url)audio.src=track.url;
            if(id==='cloud-music-play'&&!audio.paused)audio.pause();else await audio.play();
          }
        });
      },true);
      function checkAndSettleScratchTicket(){if(!activeIssuedTicket||activeIssuedTicket.settled||!activeIssuedTicket.cells.every(c=>c.revealed))return;
        activeIssuedTicket.settled=true;byId('active-ticket-result-banner').textContent='本张奖金 '+fmtMoney(activeIssuedTicket.totalPayout)+'，已入账。';byId('scratch-next-ticket').disabled=false;}
      const profileButton=document.createElement('button');profileButton.id='cloud-profile-open';profileButton.type='button';profileButton.dataset.nav='profile';profileButton.className='nav-tab-btn w-full px-3 py-3 flex items-center gap-3 text-left cursor-pointer';profileButton.setAttribute('aria-label','个人主页');profileButton.innerHTML='<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span class="sidebar-label truncate">个人主页</span>';byId('left-sidebar').querySelector('[data-nav="news"]').before(profileButton);
      const profileSection=document.createElement('section');profileSection.id='view-profile';profileSection.className='hidden';byId('view-news').parentElement.append(profileSection);mainViews.push('profile');
      const nextTicket=document.createElement('button');nextTicket.id='scratch-next-ticket';nextTicket.className='inner-btn-primary px-4 py-2';nextTicket.textContent='刮下一张';nextTicket.disabled=true;byId('scratch-back-lobby-btn').after(nextTicket);
      byId('left-sidebar').insertAdjacentHTML('beforeend','<section class="cloud-music p-3"><p class="sidebar-label">音乐盒</p><p id="cloud-music-title" class="sidebar-label text-xs">选择曲目播放</p><audio id="cloud-music-audio" preload="none"></audio><div class="flex flex-wrap gap-2"><button id="cloud-music-prev" aria-label="上一首">|◀</button><button id="cloud-music-play" aria-label="播放或暂停">▶ / Ⅱ</button><button id="cloud-music-next" aria-label="下一首">▶|</button></div></section>');

      const skyUI=AVEDSkyUI({api,esc,byId,getUser:()=>currentUser,onBalance:balance=>{if(currentUser&&typeof balance==='number'){currentUser.balance=balance;syncUserHeaderUI();}},showToast});
      economyUI=AVEDEconomyUI({api,esc,byId,getUser:()=>currentUser,onBalance:balance=>{currentUser.balance=balance;syncUserHeaderUI();},showToast,stocks:()=>stocksData,refreshMarket});
      const communityUI=AVEDCommunity({api,esc,byId,showToast,mainViews,switchMainView,getUser:()=>currentUser,getProfile:()=>playerProfile,departments:()=>departmentsData,renderDepartments:renderDepartmentsAndPersonnel,renderScp:renderScpArchives,refreshForum,backForum:returnForumList,getThread:()=>forumThreads.find(t=>String(t.id)===String(currentForumThreadId))});
      welfareUI=AVEDWelfareUI({api,esc,byId,getUser:()=>currentUser,getProfile:()=>playerProfile,onBalance:b=>{currentUser.balance=b;syncUserHeaderUI();},onPreferences:p=>{Object.assign(playerProfile,p);},showToast});
      setInterval(()=>{if(currentUser&&!document.hidden&&!byId('view-departments').classList.contains('hidden'))refreshDirectory().catch(()=>{});},30000);
      const personalUI=AVEDPersonalUI({api,esc,byId,getUser:()=>currentUser,getProfile:()=>playerProfile,getAchievements:()=>playerAchievements,welfare:()=>welfareUI,showToast});
      window.AVEDRefreshPersonal=()=>{if(currentUser&&!byId('view-profile').classList.contains('hidden'))renderProfile();};
      AVEDRewardsUI({api,byId,getUser:()=>currentUser,onBalance:b=>{currentUser.balance=b;syncUserHeaderUI();},showToast});
      AVEDDerbyUI({api,esc,byId,getUser:()=>currentUser,onBalance:b=>{currentUser.balance=b;syncUserHeaderUI();},showToast});
      AVEDVisualStyle({byId});
      byId('cloud-music-audio').addEventListener('ended',()=>byId('cloud-music-next').click());
      const idleSession=AVEDPlayerSession.create({storage:localStorage,onExpire:async()=>{
        currentUser=null;innerAppView.classList.add('hidden');landingView.classList.remove('hidden');
        document.body.classList.remove('theme-inner');document.body.classList.add('theme-landing');
        try{await apiLogout();}catch{}finally{location.reload();}
      }});
      for(const type of ['pointerdown','pointermove','keydown','wheel','touchstart'])document.addEventListener(type,()=>idleSession.activity(),{passive:true});
      document.addEventListener('visibilitychange',()=>idleSession.check());
      window.addEventListener('storage',event=>{if(event.key==='aved_last_activity_v1')idleSession.check();});
      (async()=>{
        try{
          await api('/api/me');
          if(idleSession.stale()){await apiLogout();return;}
          signalOverlay.classList.remove('hidden');signalOverlay.classList.add('flex');signalOverlay.setAttribute('aria-busy','true');
          signalPhase('正在恢复员工终端',12,'正在确认个人身份令牌……');await nextPaint();
          signalPhase('正在恢复员工终端',45,'正在连接公司内网……');await nextPaint();
          signalPhase('正在恢复员工终端',85,'正在加载公司档案……');
          const employee=await loadPlayerData();completeEnterIntranet(employee);idleSession.start();
          signalPhase('欢迎回到公司，'+employee.name,100,'终端已接通。');
          await new Promise(resolve=>setTimeout(resolve,prefersReducedMotion?80:260));
        }catch{currentUser=null;}finally{signalOverlay.classList.add('hidden');signalOverlay.classList.remove('flex');signalOverlay.setAttribute('aria-busy','false');}
      })();
      setInterval(()=>{if(currentUser&&!document.hidden&&!byId('game-panel-stocks').classList.contains('hidden'))refreshMarket().catch(()=>{});},5000);

      setInterval(()=>{if(!currentUser||document.hidden)return;refreshBalance().catch(()=>{});if(!byId('view-forum').classList.contains('hidden')&&currentForumThreadId)renderForumView();if(!byId('view-news').classList.contains('hidden')&&currentNewsId)refreshNoticeComments(currentNewsId).catch(()=>{});},10000);


    })();
