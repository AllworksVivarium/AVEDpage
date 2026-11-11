// ===== 基础 DOM 与页面状态 =====
const $ = (selector) => document.querySelector(selector);
const welcome = $("#welcome"),
  loginCard = $("#loginCard"),
  dashboard = $("#dashboard");
const networkSignals = document.querySelectorAll('.signal');
let currentUser = null;
let networkProbe = null;
function setNetworkSignalStatus(status) {
 for(const signal of networkSignals){signal.classList.remove('online','offline','checking');signal.classList.add(status);signal.setAttribute('role','status');signal.setAttribute('aria-label',status==='online'?'服务器连接正常':status==='offline'?'服务器忙碌或无法连接':'正在检查服务器');signal.title=signal.getAttribute('aria-label');}
}
function probeServerStatus() {
 if(networkProbe)return networkProbe;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),3000);
 networkProbe=(async()=>{try{
  const response=await fetch('/api/health',{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('unavailable');
  const data=await response.json();setNetworkSignalStatus(data.ok===true?'online':'offline');
 }catch{setNetworkSignalStatus('offline');}finally{clearTimeout(timeout);networkProbe=null;}})();
 return networkProbe;
}
window.addEventListener('offline',()=>setNetworkSignalStatus('offline'));
window.addEventListener('online',probeServerStatus);

// 切换欢迎页 / 登录页 / 主面板显示状态
function show(section) {
  if(section===dashboard)document.querySelectorAll('link[data-inner-fonts]').forEach(link=>{if(!link.hasAttribute('href'))link.href=link.dataset.innerFonts;});
  [welcome, loginCard, dashboard].forEach((x) => x.classList.add("hidden"));
  section.classList.remove("hidden");
}

// 对用户可见文本做 HTML 转义，避免插入 HTML 造成页面污染
function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
async function api(path,options={}) {return AVEDHttp.request(path,options);}

// 在主内容区展示统一错误
function showError(message) {
  $("#panel").innerHTML = `<p class="error" role="alert">${esc(message)}</p>`;
}

// 更新顶部 tab 的高亮样式
function setActive(tab) {
  document
    .querySelectorAll(".tab")
    .forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
}
$("#enter").addEventListener("click", () => show(loginCard));
$("#back").addEventListener("click", () => show(welcome));

// ===== 登录与门户初始化 =====
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button=event.currentTarget.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;
  ++portalGeneration;
  const form = new FormData(event.currentTarget);
  const error = $("#error");
  error.textContent = "";
  const connectStarted=performance.now();
  showAdminConnecting();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try {
    const authenticated=await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: form.get("loginIdentifier"),
        password: form.get("password"),
        remember:form.has("remember"),
      }),
    });
    if(form.has("remember")&&window.PasswordCredential&&navigator.credentials){navigator.credentials.store(new PasswordCredential({id:authenticated.employee.username,password:form.get("password"),name:authenticated.employee.displayName})).catch(()=>{});}
    error.textContent = "";
    const verified=await AVEDHttp.confirmSession(authenticated.employee?.username);
    await loadPortal({verified,interactive:true});
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000-(performance.now()-connectStarted))));
    hideAdminConnecting();
  } catch (e) {
    hideAdminConnecting();show(loginCard);
    error.textContent = e.message || "暂时无法连接，请稍后再试。";
  } finally {button.disabled=false;}
});
$("#logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  ++portalGeneration;currentUser = null;
  show(welcome);
});
let portalGeneration=0;
async function loadPortal({verified=null,interactive=false}={}) {
  const generation=++portalGeneration;
  try {
    const data=verified||await api('/api/me');if(generation!==portalGeneration)return;
    if(!data.employee)throw new Error('接入身份未能确认，请重新登录。');
    AVEDTime.sync(data.serverTime);
    currentUser = data.employee;
    const isAdmin = currentUser.role === "admin";
    if(!isAdmin){show(loginCard);$('#error').textContent='此入口仅供管理员使用。玩家请访问 aved.space。';return;}
    dashboard.classList.toggle("admin-mode", isAdmin);
    document.querySelector(".brand small").textContent = isAdmin
      ? "A.V.E.D. / ADMIN"
      : "员工内部终端 / INTERNAL";
    document
      .querySelectorAll(".tabs .tab")
      .forEach((tab) =>
        tab.classList.toggle(
          "hidden",
          !["admin","content","dossiers","moderation","activity","speech","terminology","robots","forumWorkshop","forumAdmin","lifeAdmin","barMusic","achievements"].includes(tab.dataset.tab),
        ),
      );
    show(dashboard);
    if (isAdmin) await renderTab(['dossiers','robots','achievements','barMusic'].includes(location.hash.slice(1))?location.hash.slice(1):'admin');
    else await renderTab("files");
  } catch(error) {
    if(generation!==portalGeneration)return;
    if(interactive)throw error;
    if(error.status!==401){show(loginCard);$("#error").textContent=error.message;}
  }
}

// ===== 员工端：档案 / 公告 / 留言 =====
async function renderDossiers() {
  const { items } = await api("/api/dossiers");
  $("#panel").innerHTML =
    `<div class="section-heading"><h3>公司档案</h3><p>SERVER ARCHIVE / ${String(items.length).padStart(2, "0")}</p></div><div class="cards">${items.map((item) => `<article class="card"><span class="card-code">${esc(item.code)}　/　${esc(item.department)}</span><h4>${esc(item.title)}</h4><p>${esc(item.summary)}</p><div class="card-foot"><span>内部资料</span><span class="badge">${esc(item.status)}</span></div></article>`).join("") || "<p>暂无档案。</p>"}</div>`;
}
async function renderAnnouncements() {
  const { items } = await api("/api/announcements");
  $("#panel").innerHTML =
    `<div class="section-heading"><h3>内部公告</h3><p>SERVER BULLETINS / ${String(items.length).padStart(2, "0")}</p></div>${items.map((item) => `<article class="notice-box"><h4>${item.pinned ? "◆ " : ""}${esc(item.title)}</h4><p class="announcement-body">${esc(item.body)}</p><small>${AVEDTime.markup(item.createdAt)}　/　${item.postCount} 条讨论</small><div class="post-list" id="posts-${item.id}"><p class="muted">正在读取讨论…</p></div><form class="post-form" data-announcement="${item.id}"><input name="anonymousName" maxlength="32" required placeholder="匿名名称"><textarea name="body" maxlength="2000" required placeholder="写一条匿名留言"></textarea><button class="small-action" type="submit">匿名发表</button></form></article>`).join("") || "<p>暂无公告。</p>"}`;
  for (const item of items) loadPosts(item.id);
  document.querySelectorAll(".post-form").forEach((form) =>
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(form),
        button = form.querySelector("button");
      button.disabled = true;
      try {
        await api("/api/posts", {
          method: "POST",
          body: JSON.stringify({
            announcementId: Number(form.dataset.announcement),
            anonymousName: values.get("anonymousName"),
            body: values.get("body"),
          }),
        });
        form.elements.body.value = "";
        await loadPosts(Number(form.dataset.announcement));
      } catch (e) {
        window.AVEDFeedback.alert(e.message);
      } finally {
        button.disabled = false;
      }
    }),
  );
}
async function loadPosts(id) {
  const target = $(`#posts-${id}`);
  if (!target) return;
  try {
    const { items } = await api(`/api/posts?announcementId=${id}`);
    target.innerHTML = items.length
      ? items
          .map(
            (post) =>
              `<div class="post"><b>${esc(post.anonymousName)}</b><span>余额 ¤ ${Number(post.balance).toLocaleString()}</span><p>${esc(post.body)}</p><small>${AVEDTime.markup(post.createdAt)}</small></div>`,
          )
          .join("")
      : '<p class="muted">还没有留言。</p>';
  } catch (e) {
    target.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

// ===== 员工端：个人资料与签到 =====
async function renderProfile() {
  const [{ profile, achievements }, me, checkin] = await Promise.all([
    api("/api/profile"),
    api("/api/me"),
    api("/api/checkin"),
  ]);
  const avatar = profile.avatarUrl
    ? `<img class="profile-avatar" src="${esc(profile.avatarUrl)}" alt="员工头像">`
    : '<div class="profile-avatar default-avatar" aria-label="默认员工头像"><span>?</span></div>';
  $("#panel").innerHTML =
    `<div class="section-heading"><h3>个人主页</h3><p>PERSONNEL PROFILE</p></div><div class="profile-layout"><section class="profile-card">${avatar}<h4>${esc(me.employee.displayName)}</h4><p>${esc(me.employee.department || "员工")}</p><p class="balance-large">¤ ${Number(me.balance).toLocaleString()} <small>点</small></p><form class="admin-form" id="profileForm"><h4>个人资料</h4><input name="anonymousName" required maxlength="32" value="${esc(profile.anonymousName)}" placeholder="论坛匿名名称"><textarea name="bio" maxlength="500" placeholder="个人简介">${esc(profile.bio)}</textarea><label class="file-label">上传头像（PNG/JPG/WEBP）<input name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp"></label><input name="avatarUrl" type="url" value="${profile.avatarUrl.startsWith("data:") ? "" : esc(profile.avatarUrl)}" placeholder="或填写头像 HTTPS 图片链接（可留空）"><button class="small-action">保存档案</button></form></section><section><h4>成就记录</h4><div class="achievement-list">${achievements.map((a) => `<div class="achievement ${a.earned ? "earned" : ""}"><span>${a.earned ? "◆" : "◇"}</span><b>${esc(a.title)}</b><small>${a.earned ? "已达成" : "尚未达成"}</small></div>`).join("")}</div><div class="checkin-card"><h4>每日签到</h4><p>${checkin.checkedIn ? `今日已签到，获得 ${checkin.reward} 点。` : "完成签到后领取当日配给。"}</p><button id="checkinButton" class="small-action" ${checkin.checkedIn ? "disabled" : ""}>${checkin.checkedIn ? "今日已签到" : "签到领取 150 点"}</button></div></section></div>`;
  $("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      v = new FormData(f);
    try {
      let avatarUrl = v.get("avatarUrl");
      const image = f.elements.avatarFile.files[0];
      if (image) {
        avatarUrl = await AVEDImageUpload.read(image,{kind:'avatar'});
      }
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          anonymousName: v.get("anonymousName"),
          bio: v.get("bio"),
          avatarUrl,
        }),
      });
      window.AVEDFeedback.toast("个人资料和头像已保存档案。", "success");
      await renderProfile();
    } catch (err) {
      window.AVEDFeedback.alert(err.message);
    }
  });
  $("#checkinButton").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const result = await api("/api/checkin", { method: "POST", body: "{}" });
      window.AVEDFeedback.toast(`签到成功，获得 ${result.reward} 点。`, "success");
      await loadPortal();
      await renderProfile();
    } catch (err) {
      window.AVEDFeedback.alert(err.message);
      e.currentTarget.disabled = false;
    }
  });
}

// ===== 员工端：互动玩法 =====
async function renderGames() {
  const [me, checkin, history] = await Promise.all([
    api("/api/me"),
    api("/api/checkin"),
    api("/api/games/history"),
  ]);
  $("#panel").innerHTML =
    `<div class="section-heading"><h3>互动玩法</h3><p>SERVER SETTLEMENT / BALANCE ¤ ${Number(me.balance).toLocaleString()}</p></div><div class="game-grid"><article class="game-card"><span class="card-code">DAILY CHECK-IN</span><h4>每日签到</h4><p>每天一次，配给到账后记入账户。</p><button id="gameCheckin" class="small-action" ${checkin.checkedIn ? "disabled" : ""}>${checkin.checkedIn ? "今日已签到" : "领取 150 点"}</button></article><article class="game-card"><span class="card-code">SCRATCH TICKET / 1,000 点</span><h4>刮刮乐</h4><p>领取配给票，刮开奖区。</p><button id="scratchButton" class="small-action">购买并刮开</button><div id="scratchResult" class="game-result"></div></article><article class="game-card"><span class="card-code">SLOT MACHINE / 500 点</span><h4>老虎机</h4><p>转轮停止后核发奖金。</p><button id="slotButton" class="small-action">启动老虎机</button><div id="slotResult" class="game-result"></div></article></div><div class="section-heading"><h3>近期游戏记录</h3><p>已归档记录</p></div><div class="table-wrap"><table><thead><tr><th>时间</th><th>玩法</th><th>支出</th><th>奖金</th></tr></thead><tbody>${history.items.map((x) => `<tr><td>${AVEDTime.markup(x.createdAt)}</td><td>${x.game === "scratch" ? "刮刮乐" : "老虎机"}</td><td>${Number(x.cost).toLocaleString()}</td><td>${Number(x.prize).toLocaleString()}</td></tr>`).join("") || '<tr><td colspan="4">暂无记录</td></tr>'}</tbody></table></div>`;
  $("#gameCheckin").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await api("/api/checkin", { method: "POST", body: "{}" });
      await loadPortal();
      await renderGames();
    } catch (err) {
      window.AVEDFeedback.alert(err.message);
      e.currentTarget.disabled = false;
    }
  });
  $("#scratchButton").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await api("/api/games/scratch", { method: "POST", body: "{}" });
      await loadPortal();
      await renderGames();
      $("#scratchResult").innerHTML =
        `<b>${esc(r.prizeName)}${r.prize ? `：+${Number(r.prize).toLocaleString()} 点` : ""}</b>`;
    } catch (err) {
      window.AVEDFeedback.alert(err.message);
      e.currentTarget.disabled = false;
    }
  });
  $("#slotButton").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await api("/api/games/slot", { method: "POST", body: "{}" });
      await loadPortal();
      await renderGames();
      $("#slotResult").innerHTML =
        `<b class="slot-symbols">${r.symbols.map(esc).join("　")}</b><small>${r.prize ? `获得 ${Number(r.prize).toLocaleString()} 点` : "未中奖"}</small>`;
    } catch (err) {
      window.AVEDFeedback.alert(err.message);
      e.currentTarget.disabled = false;
    }
  });
}

// ===== 员工端：匿名论坛 =====
async function renderForum() {
  const { items } = await api("/api/forum");
  $("#panel").innerHTML =
    `<div class="section-heading"><h3>匿名论坛</h3><p>匿名通讯 / ${items.length}</p></div><form class="admin-form forum-create" id="forumCreate"><h4>发布新帖</h4><input name="title" required maxlength="120" placeholder="帖子标题"><textarea name="body" required maxlength="3000" placeholder="写下内容"></textarea><button class="small-action">匿名发布</button></form><div class="forum-list">${items.map((item) => `<article class="forum-post"><div class="forum-head"><b>${esc(item.title)}</b><small>${esc(item.anonymousName)} 余额 ¤ ${Number(item.balance).toLocaleString()} 点 ${AVEDTime.markup(item.createdAt)}</small></div><p>${esc(item.body)}</p><details data-thread="${item.id}"><summary>回复（${item.replyCount}）</summary><div class="reply-list" id="replies-${item.id}">正在读取…</div><form class="reply-form" data-thread="${item.id}"><textarea name="body" required maxlength="2000" placeholder="匿名回复"></textarea><button class="small-action">发送回复</button></form></details></article>`).join("") || '<p class="muted">还没有帖子。</p>'}</div>`;
  $("#forumCreate").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      v = new FormData(f);
    try {
      await api("/api/forum", {
        method: "POST",
        body: JSON.stringify({ title: v.get("title"), body: v.get("body") }),
      });
      await renderForum();
    } catch (err) {
      window.AVEDFeedback.alert(err.message);
    }
  });
  document.querySelectorAll("details[data-thread]").forEach((d) =>
    d.addEventListener("toggle", () => {
      if (d.open) loadReplies(d.dataset.thread);
    }),
  );
  document.querySelectorAll(".reply-form").forEach((f) =>
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = new FormData(f);
      try {
        await api(`/api/forum/${f.dataset.thread}/replies`, {
          method: "POST",
          body: JSON.stringify({ body: v.get("body") }),
        });
        f.elements.body.value = "";
        await loadReplies(f.dataset.thread);
      } catch (err) {
        window.AVEDFeedback.alert(err.message);
      }
    }),
  );
}
async function loadReplies(id) {
  const target = $(`#replies-${id}`);
  if (!target) return;
  try {
    const { items } = await api(`/api/forum/${id}/replies`);
    target.innerHTML =
      items
        .map(
          (x) =>
            `<div class="reply"><b>${esc(x.anonymousName)}</b><small>余额 ¤ ${Number(x.balance).toLocaleString()} 点 ${AVEDTime.markup(x.createdAt)}</small><p>${esc(x.body)}</p></div>`,
        )
        .join("") || '<p class="muted">暂无回复。</p>';
  } catch (e) {
    target.textContent = e.message;
  }
}

// ===== 管理端：员工维护与内容管理 =====
const personnelIdentityNames={player_employee:'玩家成员',player_containment:'玩家收容物',planning_member:'企划组成员',company_containment:'公司提供 · 收容物'};
function personnelAttributeValues(v){const values=Array.from({length:6},(_,i)=>String(v.get('attribute'+i)??'').trim());return values.every(x=>x==='')?null:values.map(x=>x===''?null:Number(x));}
function enhancePersonnelForms(employees){
 document.querySelectorAll('#employeeCreate,.employee-edit-form').forEach(form=>{
  const current=employees.find(x=>String(x.id)===form.dataset.employeeId),fields=document.createElement('fieldset');fields.className='personnel-position-fields';
  fields.innerHTML='<legend>档案身份与职务</legend><label>档案身份<select name="identityKind">'+Object.entries(personnelIdentityNames).filter(([kind])=>kind!=='company_containment').map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></label><label data-position-mode>职务类型<select name="positionMode"><option value="member">成员</option><option value="minister">部长（可多人担任）</option><option value="custom">自定义职务</option></select></label><label>职务名称<input name="positionTitle" maxlength="80" placeholder="填写实际显示文本"></label><label data-archive-only><input name="isNpc" type="checkbox">仅展示档案，不开通登录账号</label><label data-archive-bio>收容简介<textarea name="archiveBio" maxlength="500" rows="4"></textarea></label><p class="personnel-kind-note"></p>';
  const department=form.querySelector('[name=department]'),departmentLabel=document.createElement('label');departmentLabel.textContent='所属部门';department.before(fields);fields.querySelector('[data-position-mode]').before(departmentLabel);departmentLabel.append(department);
  const attributes=document.createElement('fieldset');attributes.className='employee-attributes-fields';attributes.innerHTML='<legend>六维属性</legend><p>从顶部顺时针排列；每项 0–100，全部留空表示未录入。</p><div class="employee-attribute-grid">'+['力量','意志','洞察','敏捷','智力','体质'].map((label,i)=>'<label>'+label+'<input name="attribute'+i+'" type="number" min="0" max="100" step="1" aria-label="六维 '+label+'" value="'+(current?.attributes?.[i]??'')+'"></label>').join('')+'</div>';fields.after(attributes);
  const kind=fields.querySelector('[name=identityKind]'),position=fields.querySelector('[name=positionTitle]'),npc=fields.querySelector('[name=isNpc]'),note=fields.querySelector('p');
  kind.value=current?.identityKind||'player_employee';position.value=current?.positionTitle||'';npc.checked=!!current?.isNpc;fields.querySelector('[name=archiveBio]').value=current?.archiveBio||'';
  const mode=fields.querySelector('[name=positionMode]');mode.value=current?.positionTitle==='部长'?'minister':current?.identityKind==='planning_member'&&current.positionTitle!=='成员'?'custom':'member';let customTitle=mode.value==='custom'?position.value:'',lastMode=mode.value;
  function sync(){
   const leader=kind.value==='planning_member',containment=kind.value.endsWith('_containment'),company=kind.value==='company_containment';
   fields.querySelector('[data-archive-only]').hidden=!leader;fields.querySelector('[data-archive-bio]').hidden=!containment;fields.querySelector('[name=archiveBio]').disabled=!containment;
   if(!leader)npc.checked=company;
   if(containment)department.value='公司直属';department.disabled=containment;
   if(lastMode==='custom')customTitle=position.value;
   if(!leader){position.value=containment?'收容物':'成员';}else{position.value=mode.value==='custom'?customTitle:mode.value==='minister'?'部长':'成员';}
   lastMode=leader?mode.value:'';mode.closest('label').hidden=!leader;mode.disabled=!leader;
   position.closest('label').hidden=!leader||mode.value!=='custom';position.disabled=!leader;position.readOnly=mode.value!=='custom';position.required=leader;position.placeholder='例如：档案管理员、人工智能、公司顾问';
   const noLogin=company||(leader&&npc.checked);
   for(const name of ['username','password','initialBalance']){const input=form.querySelector('[name='+name+']');if(!input)continue;input.hidden=noLogin;input.disabled=noLogin;if(name!=='initialBalance')input.required=!noLogin&&form.id==='employeeCreate';}
   note.textContent=company?'公司收容物由管理员维护，不开通玩家登录。':kind.value==='player_containment'?'玩家可编辑自己的收容简介和头像，不设置自定义身份。':leader?'部门与职务独立设置，部长可有多位。选择部门时显示部门与职务；无部门归属时只显示职务。此身份不自动授予后台管理权限。':'玩家为部门成员，不设置自定义身份。';
  }
  fields.addEventListener('change',sync);department.addEventListener('change',sync);sync();
 });
}
function rosterDepartment(value){const text=String(value||'');return /收容/.test(text)?'收容部':/武器|武装|武裝|作战/.test(text)?'武装部':/研究|科研/.test(text)?'科研部':/后勤|後勤/.test(text)?'后勤部':/医疗|醫療|医療/.test(text)?'医疗部':'公司直属';}
function employeeBalanceControl(employee){
 const value='¤ '+Number(employee.balance).toLocaleString();
 if(employee.isNpc)return value;
 return value+'<details class="employee-balance-control"><summary>设置余额</summary><form class="employee-balance-form" data-employee-id="'+employee.id+'" data-expected-balance="'+employee.balance+'"><label>目标余额（可为负数）<input name="balance" type="number" min="-100000000" max="100000000" step="1" value="'+employee.balance+'" required></label><label>调整原因<input name="reason" maxlength="200" placeholder="填写本次调整原因" required></label><button type="submit" class="small-action">保存余额</button><span role="status"></span></form></details>';
}
async function renderAdmin() {
  if (currentUser?.role !== "admin")
    throw new Error("只有管理员可以访问此页面。");

  const {items:employees}=await api('/api/admin/employees?roster=personnel');

  const employeeRows = employees.map((e) =>
    '<tr data-roster-department="'+esc(rosterDepartment(e.department))+'"><td>' + esc(e.displayName) + "<small>" + esc(e.isNpc?personnelIdentityNames[e.identityKind]:e.username) +
    "</small></td><td>" + esc(e.qqNumber || "未登记") +
    "</td><td>" + esc(e.department==='公司直属'?'无部门归属':e.department || "未填写") + (e.positionTitle?'<small>'+esc(e.positionTitle)+'</small>':'') +
    "</td><td>" + employeeBalanceControl(e) +
    "</td><td>" + (e.isNpc ? "—" : e.role === "admin" ? "管理员" : "员工") +
    "</td><td>" + (e.isNpc ? personnelIdentityNames[e.identityKind] : e.enabled ? "启用" : "停用") +
    '</td><td><details><summary>编辑</summary><form class="employee-edit-form" data-employee-id="' +
    e.id + '"><input name="displayName" required maxlength="80" value="' +
    esc(e.displayName) + '" placeholder="姓名 / 收容物名称"><input name="qqNumber" maxlength="30" value="' +
    esc(e.qqNumber || "") + '" placeholder="QQ 号"><input name="department" maxlength="80" value="' +
    esc(e.department || "") + '" placeholder="部门"><input name="password" type="password" minlength="6" placeholder="新密码（至少 6 位；不改请留空）"><button class="small-action">保存修改</button></form></details></td><td><button class="small-action danger" data-delete-employee-id="' +
    e.id + '" data-delete-employee-name="' + esc(e.displayName) +
    '" data-delete-employee-username="' + esc(e.username) + '">删除员工</button></td></tr>',
  ).join("");

  $("#panel").innerHTML =
    '<div class="section-heading"><div><h3>管理工作台</h3><p>员工名册 通讯记录</p></div><span class="admin-count">员工 ' +
    employees.length +
    '</span></div><section class="admin-section"><div class="section-heading"><div><h3>登记员工</h3><p>用户名用于登录且不可重复；员工姓名单独显示</p></div></div><form class="admin-form employee-create" id="employeeCreate"><input name="username" required maxlength="40" placeholder="唯一登录用户名"><input name="password" type="password" required minlength="6" placeholder="初始密码（至少 6 位）"><input name="displayName" required maxlength="80" placeholder="员工姓名 / 收容物名称"><input name="qqNumber" maxlength="30" placeholder="QQ 号（可暂空）"><input name="department" maxlength="80" placeholder="部门（可暂空）"><input name="initialBalance" type="number" min="-100000000" max="100000000" step="1" placeholder="初始余额（可为负数）"><button class="small-action">保存员工资料</button></form></section><section class="admin-section"><div class="section-heading"><div><h3>员工名册</h3><p>' +
    employees.length +
    ' 位员工 登记资料</p></div></div><div class="table-wrap"><table><thead><tr><th>员工</th><th>QQ 号</th><th>部门</th><th>余额</th><th>权限</th><th>状态</th><th>编辑资料</th><th>账号操作</th></tr></thead><tbody>' +
    employeeRows +
    '</tbody></table></div></section>';

  document.querySelectorAll('form input[name=department]').forEach(input=>{const raw=input.value||'',value=/收容/.test(raw)?'收容部':/武器|武装|武裝|作战/.test(raw)?'武装部':/研究|科研/.test(raw)?'科研部':/后勤|後勤/.test(raw)?'后勤部':/医疗|醫療|医療/.test(raw)?'医疗部':'公司直属';const select=document.createElement('select');select.name='department';select.setAttribute('aria-label','所属部门');for(const name of ['公司直属','收容部','武装部','后勤部','科研部','医疗部']){const option=document.createElement('option');option.value=name;option.textContent=name==='公司直属'?'无部门归属':name;select.append(option);}select.value=value;input.replaceWith(select);});
  enhancePersonnelForms(employees);
  const rosterTable=$('#panel .table-wrap'),filters=document.createElement('div');filters.className='community-filters roster-departments';filters.setAttribute('aria-label','按部门筛选员工');
  const departments=['全部部门','公司直属','收容部','武装部','后勤部','科研部','医疗部'];
  filters.innerHTML=departments.map((name,index)=>`<button type="button" class="small-action" data-roster-filter="${name}" aria-pressed="${index===0}">${name==='公司直属'?'公司直属部':name}</button>`).join('')+'<p id="roster-filter-count" role="status"></p>';rosterTable.before(filters);
  filters.onclick=event=>{const button=event.target.closest('[data-roster-filter]');if(!button)return;const selected=button.dataset.rosterFilter;let count=0;for(const row of rosterTable.querySelectorAll('tbody tr')){row.hidden=selected!=='全部部门'&&row.dataset.rosterDepartment!==selected;if(!row.hidden)count++;}for(const item of filters.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===button));$('#roster-filter-count').textContent=(selected==='公司直属'?'公司直属部':selected)+' · '+count+' 人';};

  bindAdminForm("#employeeCreate", "/api/admin/employees", (v) => ({
    username: v.get("username"),
    password: v.get("password"),
    displayName: v.get("displayName"),
    qqNumber: v.get("qqNumber"),
    department: v.get("department")||"",positionTitle:v.get("positionTitle")||"",identityKind:v.get("identityKind"),isNpc:v.has("isNpc"),attributes:personnelAttributeValues(v),...(v.has("archiveBio")?{archiveBio:v.get("archiveBio")}: {}),
    initialBalance: Number(v.get("initialBalance") || 0),
  }));

  document.querySelectorAll('.employee-balance-form').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;status.textContent='正在保存…';
    try{
      await api('/api/admin/employees/'+form.dataset.employeeId+'/balance',{method:'POST',body:JSON.stringify({balance:Number(form.elements.balance.value),expectedBalance:Number(form.dataset.expectedBalance),reason:form.elements.reason.value})});
      await renderAdmin();
    }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  }));

  document.querySelectorAll(".employee-edit-form").forEach((form) =>
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const v = new FormData(form);
      const payload = {
        displayName: v.get("displayName"),
        qqNumber: v.get("qqNumber"),
        department: v.get("department")||"",positionTitle:v.get("positionTitle")||"",identityKind:v.get("identityKind"),isNpc:v.has("isNpc"),attributes:personnelAttributeValues(v),...(v.has("archiveBio")?{archiveBio:v.get("archiveBio")}: {}),
      };
      if (v.get("password")) payload.password = v.get("password");
      try {
        await api("/api/admin/employees/" + form.dataset.employeeId, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        await renderAdmin();
      } catch (error) {
        window.AVEDFeedback.alert(error.message);
      }
    }),
  );

  document.querySelectorAll("[data-delete-employee-id]").forEach((button) =>
    button.addEventListener("click", () =>
      deleteEmployee(
        button.dataset.deleteEmployeeId,
        button.dataset.deleteEmployeeName,
        button.dataset.deleteEmployeeUsername,
      ),
    ),
  );

  document.querySelectorAll("[data-delete-type]").forEach((button) =>
    button.addEventListener("click", () => {
      const type = button.dataset.deleteType;
      const id = button.dataset.deleteId;
      const path = type === "comment"
        ? "/api/admin/posts/" + id
        : type === "thread"
          ? "/api/admin/forum/threads/" + id
          : "/api/admin/forum/replies/" + id;
      deleteContent(path, button.dataset.deleteLabel || "这条帖子");
    }),
  );
}
// 绑定后台表单提交：统一做禁用按钮、请求、刷新和错误提示
function bindAdminForm(selector, path, map, custom) {
  const form = $(selector);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const values = new FormData(form);
      if (custom) await custom(map(values), form);
      else
        await api(path, { method: "POST", body: JSON.stringify(map(values)) });
      await renderAdmin();
    } catch (e) {
      window.AVEDFeedback.alert(e.message);
    } finally {
      button.disabled = false;
    }
  });
}

// 删除前统一二次确认，删除后刷新管理台
async function deleteContent(path, label = "这条内容") {
  if (!await window.AVEDFeedback.confirm("确认永久删除" + label + "？此操作无法撤销。")) return;
  try {
    await api(path, { method: "DELETE" });
    await renderAdmin();
  } catch (e) {
    window.AVEDFeedback.alert(e.message);
  }
}

async function deleteEmployee(id, displayName, username) {
  const identity = displayName + "（" + username + "）";
  if (!await window.AVEDFeedback.confirm("确认删除员工“" + identity + "”吗？")) return;
  if (!await window.AVEDFeedback.confirm("再次确认：删除后，该员工账号及其帖子、论坛发言、余额和签到记录都会一并删除，审计记录仍会保留。继续删除“" + identity + "”？")) return;
  try {
    await api("/api/admin/employees/" + id, { method: "DELETE" });
    if (currentUser?.id === Number(id)) {
      currentUser = null;
      show(loginCard);
      $("#error").textContent = "当前员工账号已删除。";
      return;
    }
    await renderAdmin();
  } catch (e) {
    window.AVEDFeedback.alert(e.message);
  }
}

// ===== Tab 路由分发 =====
async function renderTab(tab) {
  window.AVEDStopAdminMusicPreview?.();
  setActive(tab);
  try {
    if(tab === 'forumAdmin')await renderForumAdmin();
    else if(tab === 'lifeAdmin')await renderLifeAdmin();
    else if(tab === 'barMusic')await renderBarMusicAdmin();
    else if(tab === 'forumWorkshop')await renderForumWorkshopAdmin();
    else if(tab === 'robots')await renderCompanyRobots();
    else if(tab === 'speech')await renderSpeechRecords();
    else if(tab === 'terminology')await renderTerminology();
    else if(tab === 'achievements')await renderAchievements();
    else if(tab === 'moderation')await renderModeration();
    else if(tab === 'activity')await renderActivity();
    else if(tab === 'content')await renderContentAdmin();
    else if(tab === 'dossiers')await renderContentAdmin('dossiers');
    else if (tab === "files") await renderDossiers();
    else if (tab === "notice") await renderAnnouncements();
    else if (tab === "admin") await renderAdmin();
    else if (tab === "profile") await renderProfile();
    else if (tab === "forum") await renderForum();
    else await renderGames();
  } catch (e) {
    showError(e.message);
  }
}
document
  .querySelectorAll(".tab")
  .forEach((x) => x.addEventListener("click", () => renderTab(x.dataset.tab)));
$("#sidebarToggle").addEventListener("click", () => {
  const layout = document.querySelector(".portal-layout");
  const collapsed = layout.classList.toggle("collapsed");
  const toggle = $("#sidebarToggle");
  toggle.querySelector("span").textContent = collapsed ? "▶" : "◀";
  toggle.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
  toggle.title = collapsed ? "展开侧边栏" : "收起侧边栏";
});

// ===== 音乐播放控制 =====
// 首次进入时：若已有会话则直接加载门户
document.addEventListener('DOMContentLoaded',()=>loadPortal().catch(()=>{}),{once:true});

// 启动后先探测一次，再每 5 秒更新一次网络灯
setNetworkSignalStatus("checking");
probeServerStatus();
setInterval(()=>{if(!document.hidden)probeServerStatus();},30000);

