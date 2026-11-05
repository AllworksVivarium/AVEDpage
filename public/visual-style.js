window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('section');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<div class="terminal-style-name">信号终端 · 米黄</div>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 document.body.classList.add('signal-preview','red-topbar');document.body.classList.remove('paper-texture');
 try{localStorage.setItem('aved_visual_style_v1','signal');localStorage.removeItem('aved_paper_texture_v1');localStorage.setItem('aved_header_layout_v1','red');}catch{}
 const patternLabel=document.createElement('label');patternLabel.htmlFor='terminal-background-pattern';patternLabel.className='surface-choice-label';patternLabel.innerHTML='背景纹样 <small>GRID</small>';
 const pattern=document.createElement('select');pattern.id='terminal-background-pattern';pattern.innerHTML='<option value="grid">坐标网格</option><option value="dots">点阵网点</option><option value="ascii">ASCII 瀑布</option><option value="plain">无纹样</option>';
 section.append(patternLabel,pattern);
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;pattern.value=selected;}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);pattern.addEventListener('change',()=>{applyPattern(pattern.value);try{localStorage.setItem('aved_terminal_pattern_v1',pattern.value);}catch{}});
};
