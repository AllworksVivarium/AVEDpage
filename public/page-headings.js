(function () {
  const pages = [
    ['view-news', 'INTERNAL NOTICES', 'הודעות פנימיות'],
    ['view-departments', 'EMPLOYEE DIRECTORY', 'מדריך עובדים'],
    ['view-containment', 'CONTAINMENT OVERVIEW', 'סקירת ישויות כלואות'],
    ['view-life', 'EMPLOYEE LIFE', 'חיי העובדים'],
    ['view-forum', 'ANONYMOUS FORUM', 'פורום אנונימי'],
    ['view-casino', 'EMPLOYEE LOUNGE', 'חדר פנאי לעובדים'],
    ['view-profile', 'EMPLOYEE HOME', 'דף הבית לעובד']
  ];
  const app=document.getElementById('inner-app-view');if(!app)return;
  const icons={'view-news':['broadcast-ui-v1.png','130% auto'],'view-departments':['directory-disk-ui-v1.png','165% auto'],'view-containment':['containment-folder-ui-v1.png','155% auto'],'view-life':['life-newspaper-ui-v1.png','120% auto'],'view-forum':['forum-computer-ui-v1.png','auto 125%'],'view-casino':['recreation-cards-ui-v1.png','auto 115%']};
  const measure=new ResizeObserver(entries=>{for(const {target} of entries){const size=target.getBoundingClientRect().height;if(size)target.parentElement.style.setProperty('--section-masthead-height',size+'px');}});
  function update(){
    for(const [id,english,hebrew] of pages){
      const page=document.getElementById(id);if(!page)continue;
      const navKey=id==='view-profile'?'welcome':id.replace('view-','');
      const navTitle=app.querySelector('#left-sidebar [data-nav="'+navKey+'"] .sidebar-label')?.textContent.trim();
      const existingTitle=page.querySelector(':scope>.player-section-masthead .player-section-title');
      if(existingTitle){if(navTitle&&existingTitle.textContent!==navTitle)existingTitle.textContent=navTitle;if(id==='view-casino')window.AVEDCasinoSwitcher?.mountHome(existingTitle.closest('header'));continue;}
      if(id==='view-profile'&&page.querySelector('.personal-hub'))continue;
      let heading;
      if(id==='view-casino'){
        heading=page.querySelector(':scope>.terminal-page-heading h2');
        if(!heading){heading=document.createElement('h2');heading.textContent='愉乐空间';page.prepend(heading);}
      }else heading=page.querySelector('h1,h2');
      if(!heading)continue;
      heading.textContent=heading.textContent.replace(/^[《〈]\s*|\s*[》〉]$/g,'');
      if(navTitle)heading.textContent=navTitle;
      let old=heading;while(old.parentElement&&old.parentElement!==page)old=old.parentElement;
      const tools=document.createElement('div');tools.className='player-section-tools';
      if(old!==heading)for(const child of [...old.children])if(!child.contains(heading)&&child!==heading&&!child.matches('.notice-kicker,.section-kicker,.terminal-page-kicker')&&(child.textContent.trim()||child.querySelector('button,input,select,a[href]')))tools.append(child);
      const head=document.createElement('header');head.className='player-section-masthead terminal-page-heading';
      const icon=document.createElement('span');icon.className='player-section-icon';icon.setAttribute('aria-hidden','true');
      const [image,size]=icons[id]||icons['view-departments'];icon.style.setProperty('--section-icon','url("/assets/'+image+'")');icon.style.setProperty('--section-icon-size',size);
      const copy=document.createElement('div');copy.className='player-section-copy';
      const kicker=document.createElement('div');kicker.className='terminal-page-kicker player-section-kicker';
      const en=document.createElement('span');en.lang='en';en.textContent=english;
      const he=document.createElement('bdi');he.lang='he';he.dir='rtl';he.textContent=hebrew;kicker.append(en,he);
      heading.className='terminal-page-title player-section-title';copy.append(kicker,heading);head.append(icon,copy);
      if(old!==heading){const legacy=document.createElement('div');legacy.hidden=true;legacy.dataset.typeIgnore='';for(const node of [...old.querySelectorAll('[id]')])if(old.contains(node))legacy.append(node);if(legacy.childNodes.length)page.append(legacy);old.remove();}page.prepend(head);if(id==='view-casino')window.AVEDCasinoSwitcher?.mountHome(head);if(tools.childNodes.length)head.after(tools);measure.observe(head);
    }
  }
  update();new MutationObserver(update).observe(app,{childList:true,subtree:true});
})();
