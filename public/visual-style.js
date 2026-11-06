window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('details');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<summary>显示设置</summary><div class="display-options"><label>界面风格<select data-window-style><option value="radix">窗口版</option><option value="previous">旧版</option></select></label><label>主页布局<select id="terminal-layout"><option value="next">综合首页</option><option value="previous">旧版主页</option></select></label><label>终端样式<select id="terminal-presentation"><option value="crt">信号终端</option><option value="classic">原版</option></select></label><label>背景纹样<select id="terminal-background-pattern"><option value="grid">网格</option><option value="dots">点阵</option><option value="ascii">ASCII 瀑布</option><option value="plain">无纹样</option></select></label></div>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 section.querySelector('[data-window-style]').value=document.documentElement.dataset.windowStyle||'radix';
 document.body.classList.add('signal-preview','red-topbar');document.body.classList.remove('paper-texture');
 try{localStorage.setItem('aved_visual_style_v1','signal');localStorage.removeItem('aved_paper_texture_v1');localStorage.setItem('aved_header_layout_v1','red');}catch{}
 const presentation=byId('terminal-presentation');
 window.AVEDSetPresentation=value=>{const style=value==='classic'?'classic':'crt';document.body.classList.toggle('crt-unified',style==='crt');presentation.value=style;document.querySelectorAll('[data-presentation]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.presentation===style)));try{localStorage.setItem('aved_presentation_v1',style);}catch{}};
 let savedPresentation='crt';try{savedPresentation=localStorage.getItem('aved_presentation_v1')||'crt';}catch{}window.AVEDSetPresentation(savedPresentation);
 presentation.addEventListener('change',()=>window.AVEDSetPresentation(presentation.value));
 document.addEventListener('click',event=>{const button=event.target.closest('[data-presentation]');if(button)window.AVEDSetPresentation(button.dataset.presentation);});
 const layout=byId('terminal-layout');layout.value=document.body.classList.contains('terminal-next')?'next':'previous';layout.addEventListener('change',()=>window.AVEDSetLayout(layout.value));
 const pattern=byId('terminal-background-pattern');
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;pattern.value=selected;}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);pattern.addEventListener('change',()=>{applyPattern(pattern.value);try{localStorage.setItem('aved_terminal_pattern_v1',pattern.value);}catch{}});
};
