window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('section');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<div class="terminal-style-name">信号终端</div><label class="surface-choice-label" for="terminal-presentation">界面方案 <small>DISPLAY</small></label><select id="terminal-presentation"><option value="crt">显像管版</option><option value="classic">原版</option></select>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 document.body.classList.add('signal-preview','red-topbar');document.body.classList.remove('paper-texture');
 try{localStorage.setItem('aved_visual_style_v1','signal');localStorage.removeItem('aved_paper_texture_v1');localStorage.setItem('aved_header_layout_v1','red');}catch{}
 const presentation=byId('terminal-presentation');
 window.AVEDSetPresentation=value=>{const style=value==='classic'?'classic':'crt';document.body.classList.toggle('crt-unified',style==='crt');presentation.value=style;document.querySelectorAll('[data-presentation]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.presentation===style)));try{localStorage.setItem('aved_presentation_v1',style);}catch{}};
 let savedPresentation='crt';try{savedPresentation=localStorage.getItem('aved_presentation_v1')||'crt';}catch{}window.AVEDSetPresentation(savedPresentation);
 presentation.addEventListener('change',()=>window.AVEDSetPresentation(presentation.value));
 document.addEventListener('click',event=>{const button=event.target.closest('[data-presentation]');if(button)window.AVEDSetPresentation(button.dataset.presentation);});
 const patternLabel=document.createElement('label');patternLabel.htmlFor='terminal-background-pattern';patternLabel.className='surface-choice-label';patternLabel.innerHTML='背景纹样 <small>GRID</small>';
 const pattern=document.createElement('select');pattern.id='terminal-background-pattern';pattern.innerHTML='<option value="grid">坐标网格</option><option value="dots">点阵网点</option><option value="ascii">ASCII 瀑布</option><option value="plain">无纹样</option>';
 section.append(patternLabel,pattern);
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;pattern.value=selected;}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);pattern.addEventListener('change',()=>{applyPattern(pattern.value);try{localStorage.setItem('aved_terminal_pattern_v1',pattern.value);}catch{}});
};
