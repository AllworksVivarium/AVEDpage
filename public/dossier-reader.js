(()=>{
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const path=(id,page=0)=>'#/containment/'+encodeURIComponent(id)+(page?'?page='+(page+1):'');
 function route(hash){const m=String(hash).match(/^#\/containment\/(\d+)(?:\?page=(\d+))?$/);return m?{id:Number(m[1]),page:Math.max(0,Math.min(999,Number(m[2]||1)-1))}:null;}
 function chunks(text,limit=2400){const out=[];let rest=String(text||'');while(Array.from(rest).length>limit){const chars=Array.from(rest),candidate=chars.slice(0,limit).join('');let cut=Math.max(candidate.lastIndexOf('\n\n'),candidate.lastIndexOf('\n'));if(cut<limit*.4){const matches=[...candidate.matchAll(/[。！？；.!?;]\s*/g)];cut=matches.length?matches.at(-1).index+matches.at(-1)[0].length:candidate.length;}out.push(rest.slice(0,cut));rest=rest.slice(cut);}if(rest)out.push(rest);return out;}
 function pages(item){const result=[];let page=[],length=0;for(const part of AVEDDossierContent.parts(item)){for(const body of chunks(part.body)){if(page.length&&length+body.length>2800){result.push(page);page=[];length=0;}page.push({...part,body});length+=body.length;}}if(page.length||!result.length)result.push(page);return result;}
 let frame,host,lastKey='',continuous=false,activeId=null;
 function close(){const discussion=host?.querySelector('#scp-discussion-panel');if(discussion)host.querySelector('.containment-workspace')?.append(discussion);host?.classList.remove('dossier-reader-open');frame?.remove();frame=null;lastKey='';activeId=null;continuous=false;}
 function mount({container,item,loading=false,selection}){
  host=container;host.classList.add('dossier-reader-open');if(!frame){frame=document.createElement('article');frame.className='dossier-reader';host.append(frame);}
  const discussion=host.querySelector('#scp-discussion-panel');if(discussion)host.querySelector('.containment-workspace')?.append(discussion);
  if(!item){frame.innerHTML='<a href="#/containment" class="dossier-reader-back">← 返回收容一览</a><p role="status">'+(loading?'正在读取卷宗…':'未检索到对应卷宗')+'</p>';return;}
  if(activeId!==item.dbId){activeId=item.dbId;continuous=false;}
  const sheets=pages(item),page=Math.min(selection.page,sheets.length-1),key=item.dbId+':'+page+':'+continuous,flow=continuous||sheets.length===1,parts=AVEDDossierContent.parts(item);
  if(selection.page!==page)history.replaceState(null,'',path(item.dbId,page));
  const pager=(!continuous&&sheets.length>1)?'<nav class="dossier-reader-pagination" aria-label="卷宗翻页"><button type="button" data-reader-turn="-1" '+(page===0?'disabled':'')+'>← 上一页</button><span aria-live="polite">'+(page+1)+' / '+sheets.length+'</span><button type="button" data-reader-turn="1" '+(page===sheets.length-1?'disabled':'')+'>下一页 →</button></nav>':'';
  frame.innerHTML='<nav class="dossier-reader-tools"><a href="#/containment">← 返回收容一览</a><div>'+ (sheets.length>1?'<button type="button" data-reader-mode aria-pressed="'+continuous+'">'+(continuous?'分页阅读':'连续阅读')+'</button>':'')+'<button type="button" data-reader-copy>复制链接</button></div></nav>'+pager+'<div class="dossier-reader-layout'+(parts.length<=3?' dossier-reader-compact':'')+'"><aside class="dossier-reader-toc"><span>卷宗目录</span>'+parts.map((p,i)=>'<button type="button" data-reader-section="'+i+'"><span class="dossier-toc-number" aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span>'+esc(p.title)+'</button>').join('')+'</aside><div class="dossier-paper" tabindex="-1" aria-label="卷宗正文">'+AVEDDossierContent.heading(item)+AVEDDossierContent.render(item,{sections:flow?parts:sheets[page],image:flow||page===0})+'<footer class="dossier-paper-footer"><span>'+item.id+'</span><span>A.V.E.D. / INTERNAL ARCHIVE</span>'+(!flow?'<span class="dossier-folio" aria-label="第 '+(page+1)+' 页，共 '+sheets.length+' 页">'+String(page+1).padStart(2,'0')+' / '+String(sheets.length).padStart(2,'0')+'</span>':'')+'</footer></div></div>'+(!continuous&&sheets.length>1?'<nav class="dossier-reader-pagination" aria-label="卷宗翻页"><button type="button" data-reader-turn="-1" '+(page===0?'disabled':'')+'>← 上一页</button><span aria-live="polite">'+(page+1)+' / '+sheets.length+'</span><button type="button" data-reader-turn="1" '+(page===sheets.length-1?'disabled':'')+'>下一页 →</button></nav>':'');
  if(discussion)frame.append(discussion);
  if(!lastKey)frame.scrollIntoView({block:'start'});
  if(lastKey&&lastKey!==key){const paper=frame.querySelector('.dossier-paper');if(!document.body.classList.contains('effects-off')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)paper.classList.add('dossier-paper-turn');paper.focus({preventScroll:true});frame.scrollIntoView({block:'start'});}lastKey=key;
  frame.onclick=async e=>{const button=e.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-reader-copy')){try{await navigator.clipboard.writeText(location.origin+location.pathname+path(item.dbId));button.textContent='已复制';}catch{window.prompt('复制卷宗链接',location.origin+location.pathname+path(item.dbId));}}
   else if(button.hasAttribute('data-reader-mode')){continuous=!continuous;mount({container,item,selection:{...selection,page},loading});}
   else if(button.dataset.readerTurn)location.hash=path(item.dbId,page+Number(button.dataset.readerTurn));
   else if(button.dataset.readerSection!==undefined){const index=Number(button.dataset.readerSection);if(flow){frame.querySelector('#dossier-section-'+index)?.scrollIntoView({block:'start'});}else{const wanted=parts[index],target=sheets.findIndex(s=>s.some(p=>p.sequence===wanted.sequence));if(target===page)frame.querySelector('#dossier-section-'+index)?.scrollIntoView({block:'start'});else location.hash=path(item.dbId,Math.max(0,target));}}
  };
  frame.onkeydown=e=>{if(continuous||e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('input,textarea,select'))return;const next=page+(e.key==='ArrowRight'?1:-1);if(next>=0&&next<sheets.length){e.preventDefault();location.hash=path(item.dbId,next);}};
 }
 window.AVEDDossierReader={path,route,pages,chunks,mount,close};
})();
