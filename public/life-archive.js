/* Player-owned works, bounded collage previews and full-length reading. */
window.AVEDLifeArchive=function({panel,api,esc,getUser,departments,showToast}){
  const labels={plain:'素纸',ruled:'横线便笺',grid:'网格纸',archive:'档案纸页',photo:'照片卡'},tones={ivory:'米白',white:'白纸',sage:'浅绿',blue:'灰蓝',rose:'浅粉'},model=AVEDLifeContent;
  const paperClass=x=>'life-template-'+(x.template||'plain')+' life-tone-'+(x.paperTone||'ivory');
  // Measure the font baseline once per font/leading. Paper rules repeat per text block,
  // so wrapping and paragraph spacing cannot drift away from the writing lines.
  const metrics=new Map(),measure=document.createElement('canvas').getContext('2d');
  function alignPaper(root){
    root.querySelectorAll('.life-excerpt,.life-prose>p,.life-prose>blockquote,.ql-editor>p,.ql-editor>blockquote,.ql-editor li').forEach(el=>{
      const style=getComputedStyle(el),leading=parseFloat(style.lineHeight),key=style.font+'|'+leading;
      if(!Number.isFinite(leading))return;
      if(!metrics.has(key)){measure.font=style.font;const m=measure.measureText('国Ag'),a=m.fontBoundingBoxAscent||m.actualBoundingBoxAscent,d=m.fontBoundingBoxDescent||m.actualBoundingBoxDescent;metrics.set(key,Math.min(leading-1,(leading-a-d)/2+a+2));}
      el.style.setProperty('--life-rule-y',metrics.get(key)+'px');el.style.setProperty('--life-leading',leading+'px');
    });
  }
  function workBody(x,zoom=false){
    const image=x.imageData?'<div class="life-image-section">'+(zoom?'<div class="life-image-controls">'+button('放大图片','data-zoom aria-pressed="false"')+'</div>':'')+'<div class="life-full-image"><img src="'+esc(x.imageData)+'" alt="'+esc(x.title||'作品预览')+'"></div></div>':'',text=String(x.body??model.text(x.content)).trim()?'<div class="life-prose">'+model.html(x.content,x.body)+'</div>':'';
    return model.presentation(x)==='image'?image+text:text+image;
  }
  let owner='',generation=0,request=0,editRequest=0,items=[],next=null,snapshot=null,seed='',masonry=null,editor=null,editing=null,imageChange,busy=false,visible=false,loaded=false,readerOwner='';
  let tagCatalog=[],notifications=[],noticePending=null,lastNoticePoll=0;const toasted=new Map();
  const likeDay=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const liked=x=>x.likedToday&&x.likeDay===likeDay();
  const likeButton=x=>x.canEdit?'<span class="life-own-likes" data-own-likes="'+x.id+'">收到 '+Number(x.likeCount||0)+' 个赞</span>':x.moderation==='pending'?'':button(liked(x)?'今日已赞':'点赞','data-like="'+x.id+'" data-like-day="'+(x.likeDay||'')+'" aria-pressed="'+!!liked(x)+'" '+(liked(x)?'disabled':''));
  function likeFeedback(target,success=false){
    if(!target.isConnected||document.body.classList.contains('effects-off')||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    target.animate([{transform:'scale(1)'},{transform:success?'scale(1.09)':'scale(.91)',offset:.35},{transform:'scale(1)'}],{duration:success?280:180,easing:'ease-out'});
    if(!success)return;
    const burst=document.createElement('span');burst.className='life-like-burst';burst.setAttribute('aria-hidden','true');
    for(let i=0;i<7;i++){const dot=document.createElement('i'),angle=(i*60-90)*Math.PI/180;dot.className=i===6?'life-like-ring':'life-like-dot';if(i<6){dot.style.setProperty('--burst-x',Math.cos(angle)*(i%2?33:28)+'px');dot.style.setProperty('--burst-y',Math.sin(angle)*(i%2?27:25)+'px');}burst.append(dot);}
    target.append(burst);setTimeout(()=>burst.remove(),650);
  }
  async function likeWork(id,target){
    if(target.disabled)return;const epoch=generation,buttons=[...document.querySelectorAll('[data-like="'+id+'"]')];
    buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});likeFeedback(target);
    try{const data=await api('/api/player/life/'+id+'/like',{method:'POST'});if(epoch!==generation)return;const item=items.find(x=>x.id===id);if(item)Object.assign(item,data);document.querySelectorAll('[data-like="'+id+'"]').forEach(b=>{b.textContent='今日已赞';b.dataset.likeDay=data.likeDay;b.setAttribute('aria-pressed','true');b.disabled=true;});likeFeedback(target,true);}
    catch(error){if(epoch===generation){buttons.forEach(b=>b.disabled=false);showToast(error.message);}}
    finally{buttons.forEach(b=>b.removeAttribute('aria-busy'));}
  }
  function paintNotices(){
    const button=by('[data-notices]'),list=by('[data-life-notices]');if(!button||!list)return;
    button.textContent='作品消息'+(notifications.length?'（'+notifications.length+'）':'');
    list.innerHTML=notifications.length?notifications.map(n=>'<button type="button" class="community-button" data-notice="'+n.id+'">《'+esc(n.title)+'》收到 '+Number(n.count)+' 个赞</button>').join(''):'<p>暂无新的点赞消息。</p>';
  }
  async function pollNotices(force=false){
    const user=String(getUser()?.id||'');if(!user||document.hidden||noticePending===user||!force&&Date.now()-lastNoticePoll<30000)return;if(context()&&visible)resetLoad();const epoch=generation;noticePending=user;lastNoticePoll=Date.now();
    try{const data=await api('/api/player/life/notifications');if(epoch!==generation||String(getUser()?.id)!==user)return;notifications=data.items;for(const n of notifications){const item=items.find(x=>x.id===n.id&&x.canEdit);if(item)item.likeCount=n.through;document.querySelectorAll('[data-own-likes="'+n.id+'"]').forEach(el=>el.textContent='收到 '+Number(n.through)+' 个赞');}paintNotices();let count=0;
      for(const n of notifications){const prior=toasted.get(n.id)||0;if(n.through>prior){count+=Math.min(n.count,n.through-prior);toasted.set(n.id,n.through);}}
      if(count)showToast('你的作品收到 '+count+' 个新赞');
    }catch{}finally{if(noticePending===user)noticePending=null;}
  }
  const libs=new Map();
  const load=(global,url)=>{if(window[global])return Promise.resolve(window[global]);if(!libs.has(global))libs.set(global,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.onload=()=>resolve(window[global]);script.onerror=()=>{libs.delete(global);script.remove();reject(Error('编辑组件加载失败，请重试。'));};document.head.append(script);}));return libs.get(global);};
  const randomSeed=()=>crypto.randomUUID();
  const by=selector=>panel.querySelector(selector);
  const button=(text,extra='')=>'<button type="button" class="community-button" '+extra+'>'+text+'</button>';
  const depts=()=>(tagCatalog.length?tagCatalog.filter(t=>t.departmentCode).map(t=>({name:t.name})):departments()).map(d=>'<option value="'+esc(d.name)+'">'+esc(d.name)+'</option>').join('');
  function shell(){
    panel.classList.add('life-archive');panel.innerHTML='<header class="life-masthead"><div><div class="section-kicker">PERSONNEL LIFE ARCHIVE</div><h2>生活记录<span aria-hidden="true">.</span></h2></div><div class="life-publish-actions">'+button('上传作品','data-create')+button('我的作品','data-mine aria-pressed="false"')+button('作品消息','data-notices')+'</div></header><div class="life-notices" data-life-notices hidden></div><form id="life-filters"><div class="life-search-row"><input name="q" type="search" maxlength="120" placeholder="检索标题或正文" aria-label="搜索生活记录"><button class="community-button" type="submit">检索</button></div><div class="life-filter-row"><select name="kind" aria-label="作品类型"><option value="">全部类型</option><option value="article">文字作品</option><option value="art">图片作品</option></select><select name="department" aria-label="按部门筛选"><option value="">全部部门</option>'+depts()+'</select><select name="tag" aria-label="按标签筛选"><option value="">全部标签</option></select><select name="order" aria-label="排序"><option value="random">随机展出</option><option value="newest">最新在前</option><option value="oldest">最早在前</option></select></div></form><div class="life-board-tools"><div class="life-board-caption"><span class="section-kicker">A.V.E.D. / LIFE</span><span class="ui-help-note" lang="en">Works by our colleagues.</span></div>'+button('换一组 ↻','data-shuffle')+'</div><p data-life-error role="status"></p><div class="life-board"><div class="life-masonry" id="life-list"></div></div><div class="life-load-actions">'+button('更多作品','id="life-more" hidden')+'</div>';
    by('[data-create]').onclick=()=>openEditor();
    by('[data-notices]').onclick=()=>{by('[data-life-notices]').hidden=!by('[data-life-notices]').hidden;paintNotices();};
    by('[data-life-notices]').onclick=async e=>{const b=e.target.closest('[data-notice]');if(!b)return;const n=notifications.find(x=>x.id===Number(b.dataset.notice)),epoch=generation;if(n&&await openWork(n.id)&&epoch===generation){try{await api('/api/player/life/notifications',{method:'POST',body:{id:n.id,through:n.through}});pollNotices(true);}catch(error){showToast(error.message);}}};
    by('[data-mine]').onclick=e=>{const mine=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(mine));if(mine)by('[name=order]').value='newest';resetLoad();};
    by('#life-filters').onsubmit=e=>{e.preventDefault();resetLoad();};
    by('#life-filters').onchange=()=>resetLoad();
    by('[data-shuffle]').onclick=()=>resetLoad();by('#life-more').onclick=()=>loadPage(true);
    by('#life-list').onclick=e=>{const like=e.target.closest('[data-like]');if(like){likeWork(Number(like.dataset.like),like);return;}const open=e.target.closest('[data-open]'),edit=e.target.closest('[data-edit]'),tag=e.target.closest('[data-tag]');if(open)openWork(Number(open.dataset.open));if(edit)openEditor(Number(edit.dataset.edit));if(tag){const option=by('[name=tag]');if([...option.options].some(o=>o.value===tag.dataset.tag)){option.value=tag.dataset.tag;resetLoad();}}};
  }
  const reader=document.createElement('dialog');reader.id='life-reader';reader.className='life-reader-dialog';reader.setAttribute('aria-label','作品阅读');document.body.append(reader);
  reader.addEventListener('click',e=>{const b=e.target.closest('[data-like]');if(b)likeWork(Number(b.dataset.like),b);});
  const composer=document.createElement('dialog');composer.id='life-composer';composer.className='life-compose-dialog';composer.setAttribute('aria-label','编辑作品');document.body.append(composer);
  const closeReader=()=>{reader.close();reader.innerHTML='';readerOwner='';};reader.addEventListener('close',()=>{reader.innerHTML='';});
  function closeKey(b,fn){b.textContent='×';b.setAttribute('aria-label','关闭');b.onclick=fn;}
  function card(x,i){
    const imageMain=model.presentation(x)==='image',type=x.kind==='art'?'图片作品':imageMain?'文字长图':'文字作品',wide=!mine()&&by('[name=order]').value==='random'&&i%7===0?' life-wide':'';
    const image=x.thumbnail?'<button type="button" class="life-image-open'+(!imageMain?' life-support-image':'')+'" data-open="'+x.id+'" aria-label="查看'+esc(x.title)+'"><img class="life-cover" src="'+esc(x.thumbnail)+'" alt="'+esc(x.title)+'" loading="lazy" style="object-position:50% '+(x.previewPosition??50)+'%"></button>':'';
    return '<article class="life-tile'+wide+'" data-id="'+x.id+'"><div class="life-paper '+paperClass(x)+'">'+(imageMain?image:'<div class="life-paper-kicker">'+(x.template==='archive'?'PERSONNEL RECORD':'LIFE / TEXT')+'</div>')+'<h3><button type="button" data-open="'+x.id+'">'+esc(x.title)+'</button></h3>'+(x.excerpt?'<p class="life-excerpt">'+esc(x.excerpt)+'</p>':'')+(!imageMain?image:'')+'<div class="life-byline"><span>'+esc(x.displayName)+'</span><span>'+type+' '+AVEDTime.markup(x.createdAt)+'</span></div><div class="life-tags">'+x.tags.map(t=>'<button type="button" data-tag="'+esc(t)+'">#'+esc(t)+'</button>').join('')+'</div><footer><span>'+(mine()?esc(({pending:'待核验',rejected:'未通过',approved:'已公开'})[x.moderation]||''):'')+'</span><div>'+likeButton(x)+(x.canEdit?'<button type="button" data-edit="'+x.id+'">编辑</button>':'')+'<button type="button" data-open="'+x.id+'">'+(x.kind==='art'?'查看大图':'阅读全文')+' ↗</button></div></footer></div></article>';
  }
  const mine=()=>by('[data-mine]').getAttribute('aria-pressed')==='true';
  function context(){const current=String(getUser()?.id||'');if(current===owner)return false;owner=current;generation++;request++;editRequest++;items=[];loaded=false;next=null;snapshot=null;closeReader();composer.close();editing=null;imageChange=undefined;tagCatalog=[];notifications=[];toasted.clear();lastNoticePoll=0;if(editor)editor.setContents([{insert:'\n'}]);shell();return true;}
  function layout(){masonry?.reloadItems();masonry?.layout();}
  async function initLayout(){
    const epoch=generation;try{const Masonry=await load('Masonry','/vendor/masonry-layout-4.2.2/masonry.pkgd.min.js');if(epoch!==generation)return;masonry?.destroy();masonry=new Masonry(by('#life-list'),{itemSelector:'.life-tile',columnWidth:'.life-sizer',gutter:18,percentPosition:true,horizontalOrder:true,transitionDuration:matchMedia('(prefers-reduced-motion:reduce)').matches?'0':'0.2s'});layout();}catch(e){showToast(e.message);}
  }
  function render(){
    const list=by('#life-list');masonry?.destroy();masonry=null;
    list.innerHTML=items.length?'<div class="life-sizer" aria-hidden="true"></div>'+items.map(card).join(''):'<p class="life-empty">未检索到生活记录。</p>';
    alignPaper(list);list.querySelectorAll('img').forEach(image=>{image.onload=layout;image.onerror=layout;});if(items.length)initLayout();
    by('#life-more').hidden=next===null;by('[data-shuffle]').hidden=mine()||by('[name=order]').value!=='random';
  }
  async function loadPage(more=false){
    if(!getUser()||more&&busy)return;context();const serial=++request,epoch=generation;busy=true;by('[data-life-error]').textContent='';panel.setAttribute('aria-busy','true');
    const q=new URLSearchParams(new FormData(by('#life-filters')));if(mine())q.set('mine','1');q.set('seed',seed);if(snapshot!==null)q.set('snapshot',snapshot);if(more&&next!==null)q.set(q.get('order')==='random'?'offset':'before',next);
    try{const data=await api('/api/player/life?'+q);if(serial!==request||epoch!==generation||String(getUser()?.id)!==owner)return;items=more?[...items,...data.items.filter(x=>!items.some(old=>old.id===x.id))]:data.items;next=data.next;snapshot=data.snapshot;loaded=true;tagCatalog=data.tagCatalog||[];const department=by('[name=department]'),selectedDepartment=department.value;department.innerHTML='<option value="">全部部门</option>'+depts();department.value=selectedDepartment;const tag=by('[name=tag]'),value=tag.value;tag.innerHTML='<option value="">全部标签</option>'+data.tags.map(t=>'<option>'+esc(t)+'</option>').join('');tag.value=value;render();}
    catch(e){if(serial===request)by('[data-life-error]').textContent=e.message;}
    finally{if(serial===request){busy=false;panel.removeAttribute('aria-busy');}}
  }
  function resetLoad(){seed=randomSeed();snapshot=null;next=null;loadPage();}
  async function openWork(id){
    const epoch=generation,user=owner;try{const x=await api('/api/player/life/'+id);if(epoch!==generation||String(getUser()?.id)!==user||panel.classList.contains('hidden'))return;readerOwner=user;
      reader.innerHTML='<header class="life-dialog-heading"><div><span class="section-kicker">PERSONNEL LIFE ARCHIVE</span><h2>'+esc(x.title)+'</h2><div class="life-byline">'+esc(x.displayName)+' '+AVEDTime.markup(x.createdAt)+'</div></div>'+button('关闭','data-close')+'</header><article class="life-reader-paper '+paperClass(x)+'">'+workBody(x,true)+'<footer class="life-reader-feedback">'+likeButton(x)+'</footer></article>';
      closeKey(reader.querySelector('[data-close]'),closeReader);const zoom=reader.querySelector('[data-zoom]');if(zoom)zoom.onclick=()=>{const large=zoom.getAttribute('aria-pressed')!=='true';zoom.setAttribute('aria-pressed',String(large));zoom.textContent=large?'适应宽度':'放大图片';reader.querySelector('.life-full-image').classList.toggle('is-zoomed',large);};reader.showModal();alignPaper(reader);return true;
    }catch(e){showToast(e.message);return false;}
  }
  function composerShell(){
    composer.innerHTML='<header class="life-dialog-heading"><h2 data-compose-title>上传作品</h2>'+button('关闭','data-close-compose')+'</header><form id="life-create" class="community-form"><label>标题<input name="title" required maxlength="120"></label><div class="life-compose-row"><label>类型<select name="kind"><option value="article">文字作品</option><option value="art">图片作品</option></select></label></div><div data-presentation><label>呈现方式<select name="presentation"><option value="text">排版正文</option><option value="image">文字长图</option></select></label><p class="life-mode-note">文字长图仍归入文字作品，图片原有排版会保留。</p></div><div class="life-compose-content"><div data-text-settings><fieldset class="life-style-picker"><legend>排版样式</legend>'+Object.entries(labels).map(([value,label])=>'<label><input type="radio" name="template" value="'+value+'" '+(value==='plain'?'checked':'')+'><span class="life-template-'+value+'">'+label+'</span></label>').join('')+'</fieldset><fieldset class="life-tone-picker"><legend>纸色</legend>'+Object.entries(tones).map(([value,label])=>'<label><input type="radio" name="paperTone" value="'+value+'" '+(value==='ivory'?'checked':'')+'><span class="life-tone-'+value+'">'+label+'</span></label>').join('')+'</fieldset></div><section data-text-section><label id="life-text-label">正文</label><div data-editor></div></section><section data-image-section><label><span data-image-label>附图（可选）</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="life-image-preview" hidden><img alt="作品预览"><label>预览位置<input name="previewPosition" type="range" min="0" max="100" value="50"></label>'+button('移除图片','data-remove-image')+'</div></section></div><label data-excerpt>展示节选<textarea name="excerpt" rows="2" maxlength="300"></textarea></label><fieldset class="life-tag-picker"><legend>标签</legend>'+[...tagCatalog,...(editing?.tags||[]).filter(name=>!tagCatalog.some(t=>t.name===name)).map(name=>({name}))].map(t=>'<label><input type="checkbox" name="tag" value="'+esc(t.name)+'">'+esc(t.name)+'</label>').join('')+'</fieldset><div class="life-submit-actions">'+button('预览','data-preview')+'<button class="community-button" type="submit">保存作品</button></div><p data-compose-feedback role="status"></p></form>';
    closeKey(composer.querySelector('[data-close-compose]'),()=>composer.close());
    let upload=0;
    const form=composer.querySelector('form');form.elements.image.onchange=async()=>{
      const file=form.elements.image.files[0];if(!file)return;const epoch=generation,serial=++upload;const actions=form.querySelectorAll('.life-submit-actions button');actions.forEach(b=>b.disabled=true);
      try{const data=await AVEDImageUpload.read(file,{kind:'life'});if(epoch!==generation||serial!==upload||form!==composer.querySelector('form')||!composer.open)return;imageChange=data;imagePreview(data);}catch(e){if(form===composer.querySelector('form')){composer.querySelector('[data-compose-feedback]').textContent=e.message;form.elements.image.value='';}}finally{if(serial===upload)actions.forEach(b=>b.disabled=false);}
    };
    composer.querySelector('[data-remove-image]').onclick=()=>{upload++;imageChange='';imagePreview('');form.elements.image.value='';form.querySelectorAll('.life-submit-actions button').forEach(b=>b.disabled=false);};
    form.elements.previewPosition.oninput=()=>composer.querySelector('.life-image-preview img').style.objectPosition='50% '+form.elements.previewPosition.value+'%';
    form.onchange=syncComposer;
    composer.querySelector('[data-preview]').onclick=()=>{
      const d=values();d.body=model.text(d.content);d.imageData=imageChange??editing?.imageData??'';reader.innerHTML='<header class="life-dialog-heading"><h2>'+esc(d.title||'作品预览')+'</h2>'+button('关闭','data-close')+'</header><article class="life-reader-paper '+paperClass(d)+'">'+workBody(d)+'</article>';closeKey(reader.querySelector('[data-close]'),closeReader);reader.showModal();alignPaper(reader);
    };
    form.onsubmit=async e=>{
      e.preventDefault();const save=form.querySelector('[type=submit]');save.disabled=true;const epoch=generation,user=owner;
      try{const d=values();if(imageChange!==undefined)d.imageData=imageChange;if(editing)d.revision=editing.revision;await api('/api/player/life'+(editing?'/'+editing.id:''),{method:editing?'PUT':'POST',body:d});if(epoch!==generation||String(getUser()?.id)!==user)return;composer.close();resetLoad();showToast((imageChange??editing?.imageData)?'影像材料已送交核验。':'记录已归档。');}catch(error){if(epoch===generation)composer.querySelector('[data-compose-feedback]').textContent=error.message;}finally{save.disabled=false;}
    };
  }
  function syncComposer(){
    const form=composer.querySelector('form'),f=form.elements,imageMain=f.kind.value==='art'||f.presentation.value==='image';
    composer.querySelector('[data-presentation]').hidden=f.kind.value==='art';
    composer.querySelector('[data-text-settings]').hidden=imageMain;
    composer.querySelector('[data-excerpt]').hidden=imageMain;
    composer.querySelector('[data-text-section]').style.order=imageMain?'2':'1';
    composer.querySelector('[data-text-section]').className='life-tone-'+f.paperTone.value;
    composer.querySelector('[data-image-section]').style.order=imageMain?'1':'2';
    const content=composer.querySelector('.life-compose-content'),textSection=composer.querySelector('[data-text-section]'),imageSection=composer.querySelector('[data-image-section]');
    if(imageMain&&imageSection.nextElementSibling!==textSection)content.append(imageSection,textSection);
    else if(!imageMain&&textSection.nextElementSibling!==imageSection)content.append(textSection,imageSection);
    composer.querySelector('[data-image-label]').textContent=imageMain?'作品图片':'附图（可选）';
    composer.querySelector('#life-text-label').textContent=imageMain?'配文（可选）':'正文';
    composer.querySelector('[data-editor]').className='life-editor '+paperClass({template:imageMain?'plain':f.template.value,paperTone:f.paperTone.value});
    composer.querySelector('[data-text-settings]').className='life-tone-'+f.paperTone.value;
    composer.querySelector('.life-compose-content').classList.toggle('life-image-primary',imageMain);
    alignPaper(composer);
  }
  function imagePreview(url){const box=composer.querySelector('.life-image-preview');box.hidden=!url;box.querySelector('img').src=url||'';}
  function values(){const f=composer.querySelector('form').elements;return {title:f.title.value,kind:f.kind.value,template:f.template.value,paperTone:f.paperTone.value,presentation:f.kind.value==='art'?'image':f.presentation.value,excerpt:f.excerpt.value,tags:[...composer.querySelectorAll('[name=tag]:checked')].map(x=>x.value),previewPosition:Number(f.previewPosition.value),content:model.normalize(editor.getContents())};}
  async function openEditor(id){
    context();const epoch=generation,user=owner,serial=++editRequest;
    try{const [Quill,catalog,item]=await Promise.all([load('Quill','/vendor/quill-2.0.3/quill.js'),api('/api/player/life/catalog'),id?api('/api/player/life/'+id):null]);if(epoch!==generation||serial!==editRequest||String(getUser()?.id)!==user)return;if(item&&!item.canEdit)return;
      tagCatalog=catalog.items;editing=item;imageChange=undefined;composerShell();composer.querySelector('[data-compose-title]').textContent=item?'编辑作品':'上传作品';
      editor=new Quill(composer.querySelector('[data-editor]'),{theme:'snow',formats:['header','bold','italic','underline','blockquote','list','align'],modules:{toolbar:[[{header:[2,3,false]}],['bold','italic','underline','blockquote'],[{list:'ordered'},{list:'bullet'}],[{align:[] }],['clean']]}});
      editor.root.setAttribute('aria-labelledby','life-text-label');editor.root.setAttribute('role','textbox');editor.root.setAttribute('aria-multiline','true');
      const names={'ql-bold':'加粗','ql-italic':'斜体','ql-underline':'下划线','ql-blockquote':'引用','ql-list':'列表','ql-clean':'清除格式'};composer.querySelectorAll('.ql-toolbar button').forEach(b=>{const name=names[[...b.classList].find(c=>names[c])];if(name)b.setAttribute('aria-label',name);});
      const form=composer.querySelector('form'),f=form.elements;if(item){f.title.value=item.title;f.kind.value=item.kind;f.template.value=item.template;f.paperTone.value=item.paperTone||'ivory';f.presentation.value=model.presentation(item);f.excerpt.value=item.excerpt;f.previewPosition.value=item.previewPosition;composer.querySelectorAll('[name=tag]').forEach(input=>input.checked=item.tags.includes(input.value));editor.setContents(item.content);imagePreview(item.imageData);}
      else editor.setContents([{insert:'\n'}]);editor.on('text-change',()=>alignPaper(composer));composer.showModal();syncComposer();
    }catch(e){showToast(e.message);}
  }
  shell();
  document.fonts.ready.then(()=>{metrics.clear();alignPaper(panel);alignPaper(reader);alignPaper(composer);layout();});
  new ResizeObserver(()=>{alignPaper(panel);if(reader.open)alignPaper(reader);if(composer.open)alignPaper(composer);}).observe(panel);
  const observer=new MutationObserver(()=>{const now=!panel.classList.contains('hidden');if(now&&!visible){visible=true;context();if(!loaded||!mine()&&by('[name=order]').value==='random')resetLoad();else layout();}else if(!now&&visible){visible=false;editRequest++;closeReader();composer.close();}});observer.observe(panel,{attributes:true,attributeFilter:['class']});
  setInterval(()=>{pollNotices();document.querySelectorAll('[data-like][disabled]:not([aria-busy="true"])').forEach(b=>{if(b.dataset.likeDay!==likeDay()){b.disabled=false;b.textContent='点赞';b.setAttribute('aria-pressed','false');}});},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollNotices(true);});
  return {refresh(){if(context()&&visible)resetLoad();pollNotices();if(reader.open&&readerOwner&&readerOwner!==String(getUser()?.id))closeReader();}};
};
