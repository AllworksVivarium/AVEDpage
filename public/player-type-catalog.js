/* Player typography taxonomy: one role, one size/style per viewport and script. */
(function(root){
  const rows=[
    ['cover','封面品牌','开屏中英文品牌与宣言标题',48,32,1.2,700,'.floating-kanji,.font-cover-tc,#landing-view .text-6xl,#landing-view .text-7xl'],
    ['brand','顶栏品牌','万业携生、AVED 品牌标识',22,17,1.2,700,'.terminal-brand-name,.terminal-brand-code'],
    ['brandNote','品牌副署','品牌下方英文全称',12,10,1.4,400,'.terminal-brand-code small'],
    ['page','页面主标题','员工姓名、各主页面标题',32,28,1.35,700,'h1,.terminal-page-title,.profile-identity-copy h3,#signal-status-title'],
    ['section','章节标题','成就、账目及内容章节',20,20,1.4,700,'h2,.notice-title-secondary,.notice-detail-title'],
    ['card','卡片标题','卡片名称、游戏规则小节',18,18,1.4,700,'h3,h4,h5,h6,.radio-heading'],
    ['navigation','导航文字','员工首页等主导航',16,16,1.4,400,'.nav-tab-btn,.sidebar-label,#sidebar-toggle-btn,.game-tab-btn'],
    ['body','正文','文章、实名与匿名留言、规则说明及普通内容',16,16,1.75,400,'.terminal-prose,.notice-body,.notice-summary,.notice-comment-body,.forum-post-content,p.whitespace-pre-wrap,#scp-realname-comments-list p,.profile-bio,.department-summary p,.game-rule-card p,.life-record>p:not(.text-xs)'],
    ['action','操作按钮','登录、返回、提交及折叠操作',14,14,1.4,600,'button,summary,[role="button"],.community-button'],
    ['label','表单标签','输入项名称、筛选条件与分组',14,14,1.5,400,'label,legend,dt'],
    ['field','输入文字','输入框、选择框及占位文字',16,16,1.5,400,'input,textarea,select,option'],
    ['meta','辅助说明','音乐音量、时间、来源、备注和提示',12,12,1.5,400,'small,time,figcaption,.notice-meta,.notice-card-meta,.notice-detail-meta,.notice-comment-identity,#forum-detail-replies-list article>b,#forum-detail-main-post>div:first-child,#forum-threads-list-container article>div:first-child,.edited-label,.record-tags,.hub-alias,.profile-achievements p span,.terminal-audio label,.audio-options summary,#cloud-music-title,.palette-mode-note,.department-meta,.hub-masthead,.stock-quote-heading,#personal-finance-summary span,.achievement-mark,.hub-signal p'],
    ['eyebrow','栏目眉题','PERSONNEL TERMINAL、章节前缀',12,12,1.5,400,'.section-kicker,.terminal-page-kicker,.terminal-heading-eyebrow,.eyebrow,.terminal-page-kicker bdi,.type-note-en'],
    ['number','数字读数','余额、行情数值与主要统计',28,24,1.25,600,'#hub-balance,.hub-balance>strong,.profile-balance-strip strong,.portfolio-summary strong,.flight-readout>strong,.flight-readout>span,#top-balance-val,#personal-finance-summary strong,.stock-quote-price,#ticket-modal-price,#ticket-modal-top-prize'],
    ['system','系统状态','连接日志、系统时间、封面状态条',12,12,1.5,400,'.landing-edge-line,.landing-float,.signal-mesh>div:first-child,.signal-mesh>div:last-child,#signal-log-lines,#system-realtime-clock,.personnel-login-title,.terminal-brand-code>small.system-code'],
    ['chart','图表刻度','K 线坐标、图表图例和数字标签',11,11,1.3,400,'.market-crosshair-tooltip,.market-axis,.market-chart text,svg text,svg tspan'],
    ['symbol','图形符号','矩阵图案等图形，不使用正文撕裂',24,20,1.2,400,'.slot-symbol'],
    ['gameLabel','格子标注','游戏格子名称与连线编号',10,10,1.3,400,'.slot-symbol-name,.slot-line-marker,.slot-line-rail span,.slot-line-paths']
  ];
  const roles=rows.map(([id,name,description,desktop,mobile,line,weight,selector])=>({id,name,description,selector,render:['page','section','card','body'].includes(id)?'print':'plain',defaults:{desktop,mobile,line,weight,spacing:0,zh:id==='cover'?'serifTC':'serif',en:'mono',he:'hebrew',enItalic:['brandNote','eyebrow'].includes(id)}}));
  const priority=['brandNote','cover','navigation','field','chart','number','symbol','gameLabel','meta','eyebrow','system','page','brand','action','label','section','card','body'];
  const fonts=[
    {id:'serif',name:'Noto Serif SC · 现有中文宋体',family:'Noto Serif SC',languages:['zh']},
    {id:'serifTC',name:'Noto Serif TC · 繁体品牌',family:'Noto Serif TC',languages:['zh']},
    {id:'mono',name:'IBM Plex Mono',url:'/assets/fonts/IBMPlexMono-Regular.woff2',languages:['en']},
    {id:'sans',name:'IBM Plex Sans',url:'/assets/fonts/IBMPlexSansSC-Regular.woff2',languages:['zh','en']},
    {id:'hebrew',name:'IBM Plex Hebrew',url:'/assets/fonts/IBMPlexSansHebrew-Regular.woff2',languages:['he']},
    {id:'silver',name:'Silver 像素',url:'/assets/fonts/study/silver.woff2',adjust:'145%',languages:['zh','en']},
    {id:'diamond',name:'点点像素 · 菱形',url:'/assets/fonts/study/dots-diamond.woff2',languages:['zh','en']},
    {id:'round',name:'点点像素 · 圆形',url:'/assets/fonts/study/dots-round.woff',languages:['zh','en']},
    {id:'square',name:'点点像素 · 方形',url:'/assets/fonts/study/dots-square.woff',languages:['zh','en']},
    {id:'ipix',name:'IPix 中文像素',url:'/assets/fonts/study/ipix.woff',languages:['zh','en']}
  ];
  function defaults(){return Object.fromEntries(roles.map(r=>[r.id,{...r.defaults}]));}
  function sanitize(input,fontList=fonts){
    const output=defaults(),valid=(id,lang)=>fontList.some(f=>f.id===id&&f.languages.includes(lang));
    for(const r of roles){const value=input?.[r.id];if(!value||typeof value!=='object')continue;
      for(const [key,min,max] of [['desktop',8,80],['mobile',8,80],['line',1,2.5],['spacing',-.05,.3]])if(Number.isFinite(value[key]))output[r.id][key]=Math.min(max,Math.max(min,value[key]));
      if([400,500,600,700].includes(value.weight))output[r.id].weight=value.weight;
      for(const lang of ['zh','en','he'])if(valid(value[lang],lang))output[r.id][lang]=value[lang];
      if(typeof value.enItalic==='boolean')output[r.id].enItalic=value.enItalic;
    }return output;
  }
  const catalog={roles,priority,fonts,defaults,sanitize};
  if(typeof module==='object'&&module.exports)module.exports=catalog;else root.AVEDTypeCatalog=catalog;
})(typeof window==='undefined'?globalThis:window);
