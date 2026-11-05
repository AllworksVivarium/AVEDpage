window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('section');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<div class="terminal-style-name">信号终端 · 米黄</div><label for="terminal-header-layout" class="surface-choice-label">顶栏样式 <small>HEADER</small></label><select id="terminal-header-layout"><option value="red">红色顶栏 · 试用</option><option value="beige">米黄顶栏</option></select><label for="terminal-paper-texture" class="surface-choice-label">纸张纹理 <small>SURFACE</small></label><select id="terminal-paper-texture"><option value="paper">米黄纸纹 · 试用</option><option value="plain">纯色底</option></select>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 document.body.classList.add('signal-preview');try{localStorage.setItem('aved_visual_style_v1','signal');}catch{}
 const header=byId('terminal-header-layout');let layout='red';try{layout=localStorage.getItem('aved_header_layout_v1')||'red';}catch{}
 function applyHeader(value){const red=value!=='beige';document.body.classList.toggle('red-topbar',red);header.value=red?'red':'beige';}
 applyHeader(layout);header.onchange=()=>{applyHeader(header.value);try{localStorage.setItem('aved_header_layout_v1',header.value);}catch{}};
 const surface=byId('terminal-paper-texture');let texture='paper';try{texture=localStorage.getItem('aved_paper_texture_v1')||'paper';}catch{}
 function applySurface(value){const paper=value!=='plain';document.body.classList.toggle('paper-texture',paper);surface.value=paper?'paper':'plain';}
 applySurface(texture);surface.onchange=()=>{applySurface(surface.value);try{localStorage.setItem('aved_paper_texture_v1',surface.value);}catch{}};
 const patternLabel=document.createElement('label');patternLabel.htmlFor='terminal-background-pattern';patternLabel.className='surface-choice-label';patternLabel.innerHTML='背景纹样 <small>GRID</small>';
 const pattern=document.createElement('select');pattern.id='terminal-background-pattern';pattern.innerHTML='<option value="grid">坐标网格</option><option value="dots">点阵网点</option><option value="ascii">ASCII 字符</option><option value="plain">无纹样</option>';
 section.append(patternLabel,pattern);
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;pattern.value=selected;}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);pattern.addEventListener('change',()=>{applyPattern(pattern.value);try{localStorage.setItem('aved_terminal_pattern_v1',pattern.value);}catch{}});
};
