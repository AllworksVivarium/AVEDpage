/* Shared forum loading placeholders. Requests, pagination and identity stay with their owners. */
window.AVEDForumSkeleton=function({target,kind='topic',placeholder}){
 const box=placeholder||document.createElement('div');
 box.className='forum-skeleton-list';box.hidden=true;box.setAttribute('aria-hidden','true');target.before(box);
 let timer,hidden=false,reserved='',active=false;
 const block=(name)=>'<span class="forum-skeleton-block forum-skeleton-'+name+'"></span>';
 function card(height){return '<div class="forum-skeleton-card forum-skeleton-'+kind+'"'+(height?' style="block-size:'+height+'px"':'')+'>'+ 
  '<div class="forum-skeleton-heading">'+block('avatar')+'<div>'+block('title')+block('meta')+'</div></div>'+ 
  '<div class="forum-skeleton-body">'+block('line')+block('line-short')+'</div>'+ 
  '<div class="forum-skeleton-footer">'+block('author')+block('counts')+'</div></div>';}
 function end(){clearTimeout(timer);box.hidden=true;box.replaceChildren();if(hidden){target.hidden=false;hidden=false;}if(active)target.style.minBlockSize=reserved;target.setAttribute('aria-busy','false');active=false;}
 return {
  start({replace=true}={}){
   end();reserved=target.style.minBlockSize;active=true;target.setAttribute('aria-busy','true');
   if(!replace||target.contains(document.activeElement))return;
   const rows=[...target.children].filter(el=>el.tagName==='ARTICLE');
   const heights=rows.map(el=>Math.ceil(el.getBoundingClientRect().height));
   const count=kind==='thread'?1:rows.length|| (kind==='reply'?3:4);
   // Reserve immediately, but show shimmer only when a request outlasts a quick response.
   if(!target.textContent.trim())target.style.minBlockSize=kind==='thread'?'208px':kind==='reply'?'390px':'448px';
   timer=setTimeout(()=>{if(target.contains(document.activeElement))return;box.innerHTML=Array.from({length:Math.min(count,10)},(_,i)=>card(heights[i])).join('');target.hidden=true;hidden=true;box.hidden=false;},180);
  },
  end
 };
};
