(function(root){
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function moveSpans(before,after,spans){
  let a=0,b=before.length,c=after.length;while(a<b&&a<c&&before[a]===after[a])a++;while(b>a&&c>a&&before[b-1]===after[c-1]){b--;c--;}
  return spans.flatMap(s=>s.end<=a?[s]:s.start>=b?[{...s,start:s.start+c-b,end:s.end+c-b}]:[]);
 }
 function markup(body,spans=[]){let start=0,out='';for(const s of spans){if(s.start<start||s.end>body.length||body.slice(s.start,s.end)!=='@'+s.label)continue;out+=escape(body.slice(start,s.start))+'<span class="forum-mention" data-type-ignore>'+escape(body.slice(s.start,s.end))+'</span>';start=s.end;}return out+escape(body.slice(start));}
 function create({api,getUser,showToast}){
  const fields=new WeakMap();let serial=0,openPicker=null;
  document.addEventListener('click',e=>{if(openPicker&&!openPicker.contains(e.target))openPicker.close();});
  function attach(field){
   if(fields.has(field))return fields.get(field);
   if(field.id!=='forum-detail-reply-text'){
    const state={previous:field.value,spans:[],close(){},sync(){this.spans=moveSpans(this.previous,field.value,this.spans);this.previous=field.value;}};
    fields.set(field,state);field.addEventListener('input',()=>state.sync());
    field.closest('form')?.addEventListener('reset',()=>queueMicrotask(()=>{state.spans=[];state.previous=field.value;}));
    return state;
   }
   const panel=document.createElement('div');panel.className='forum-mention-picker';panel.hidden=true;
   panel.innerHTML='<div class="forum-mention-modes" role="group" aria-label="提及身份"><button type="button" data-mention-mode="anonymous" aria-pressed="true">内网 ID</button><button type="button" data-mention-mode="real" aria-pressed="false">实名</button></div><div role="listbox" aria-label="提及候选"></div><p role="status"></p>';
   panel.querySelector('[role=listbox]').id='forum-mention-list-'+(++serial);(field.closest('label')||field).after(panel);
   const button=document.createElement('button');button.type='button';button.className='community-button forum-mention-trigger';button.textContent='@ 提及';button.setAttribute('aria-haspopup','listbox');
   const form=field.closest('form'),actions=form?.querySelector('.forum-compose-tools')||form?.querySelector('.forum-compose-footer,.community-actions');if(actions)actions.prepend(button);else panel.before(button);
   field.setAttribute('aria-controls',panel.querySelector('[role=listbox]').id);field.setAttribute('aria-haspopup','listbox');
   const s={field,panel,previous:field.value,spans:[],mode:'anonymous',items:[],selected:0,query:null,timer:null,version:0};fields.set(field,s);
   function close(){panel.hidden=true;if(openPicker===s)openPicker=null;s.version++;clearTimeout(s.timer);field.removeAttribute('aria-activedescendant');}
   function sync(){s.spans=moveSpans(s.previous,field.value,s.spans);s.previous=field.value;}
   function query(){const before=field.value.slice(0,field.selectionStart),m=/(?:^|[\s（(，,。；;])@([^@\n\r]{0,32})$/u.exec(before);if(!m)return null;const start=m.index+m[0].lastIndexOf('@');if(s.spans.some(x=>x.start===start))return null;return {start,end:field.selectionStart,text:m[1]};}
   function paint(){const list=panel.querySelector('[role=listbox]');list.replaceChildren(...s.items.map((item,i)=>{const b=document.createElement('button');b.type='button';b.id=list.id+'-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===s.selected));b.textContent='@'+item.label;b.onmousedown=e=>e.preventDefault();b.onclick=()=>{if(s.query)insert(field,item,s.query.start,s.query.end);close();};return b;}));if(s.items[s.selected])field.setAttribute('aria-activedescendant',list.id+'-'+s.selected);else field.removeAttribute('aria-activedescendant');}
   async function lookup(){clearTimeout(s.timer);sync();const q=query();if(!q||!q.text.trim()){close();return;}if(openPicker!==s)openPicker?.close();openPicker=s;s.query=q;panel.hidden=false;s.items=[];s.selected=0;paint();const owner=getUser()?.id,version=++s.version;
    panel.querySelector('[role=status]').textContent='正在查找…';
    try{const data=await api('/api/player/forum/mentions?mode='+s.mode+'&q='+encodeURIComponent(q.text));if(version!==s.version||getUser()?.id!==owner||!field.isConnected)return;s.items=data.items;paint();panel.querySelector('[role=status]').textContent=data.ambiguous?'有重名，请改用实名或内网 ID 查找。':s.items.length?'':'未找到匹配的名字。';}
    catch(error){if(version===s.version)panel.querySelector('[role=status]').textContent=error.message;}
   }
   field.addEventListener('input',e=>{sync();clearTimeout(s.timer);s.version++;if(!e.isComposing)s.timer=setTimeout(lookup,180);});
   field.addEventListener('compositionstart',close);
   field.addEventListener('compositionend',()=>{s.timer=setTimeout(lookup,180);});
   field.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(['ArrowDown','ArrowUp'].includes(e.key)&&s.items.length){e.preventDefault();s.selected=(s.selected+(e.key==='ArrowDown'?1:-1)+s.items.length)%s.items.length;paint();}else if(e.key==='Enter'&&s.items.length&&!e.isComposing){e.preventDefault();insert(field,s.items[s.selected],s.query.start,s.query.end);close();}else if(e.key==='Tab')close();});
   button.onclick=()=>{field.focus();const at=field.selectionStart,prefix=at&&!/\s/u.test(field.value[at-1])?' ':'';field.setRangeText(prefix+'@',at,field.selectionEnd,'end');field.dispatchEvent(new Event('input',{bubbles:true}));lookup();};
   for(const b of panel.querySelectorAll('[data-mention-mode]'))b.onclick=()=>{s.mode=b.dataset.mentionMode;for(const item of panel.querySelectorAll('[data-mention-mode]'))item.setAttribute('aria-pressed',String(item===b));field.focus({preventScroll:true});lookup();};
   s.contains=target=>target===field||target===button||panel.contains(target);
   field.closest('form')?.addEventListener('reset',()=>{close();queueMicrotask(()=>{s.spans=[];s.previous=field.value;});});
   s.close=close;s.sync=sync;return s;
  }
  function insert(field,item,start=field.selectionStart,end=field.selectionEnd){
   const s=attach(field);s.sync();const prefix=start&&!/\s/u.test(field.value[start-1])?' ':'',text=prefix+'@'+item.label+' ';
   if(field.maxLength>0&&field.value.length-(end-start)+text.length>field.maxLength){showToast('内容已到字数上限。','warn');return;}
   field.setRangeText(text,start,end,'end');s.sync();s.spans.push({...item,start:start+prefix.length,end:start+prefix.length+1+item.label.length});s.spans.sort((a,b)=>a.start-b.start);field.dispatchEvent(new Event('input',{bubbles:true}));s.close();field.focus({preventScroll:true});
  }
  return {attach,insert,seed(field,spans=[]){const s=attach(field);s.close();s.previous=field.value;s.spans=spans.map(m=>({...m}));},payload(field){const s=attach(field);s.sync();const trim=field.value.length-field.value.trimStart().length;return s.spans.map(m=>({...m,start:m.start-trim,end:m.end-trim})).filter(m=>m.start>=0&&m.end<=field.value.trim().length);},markup};
 }
 root.AVEDForumMentions={create,markup,moveSpans};
})(globalThis);
