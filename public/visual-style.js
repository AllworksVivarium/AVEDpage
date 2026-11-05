window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('section');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<label for="terminal-visual-style">界面样式 <small>DISPLAY</small></label><select id="terminal-visual-style"><option value="archive">档案终端 · 纯净</option><option value="signal">信号终端 · 米黄</option></select><label for="terminal-paper-texture" class="surface-choice-label">纸张纹理 <small>SURFACE</small></label><select id="terminal-paper-texture"><option value="paper">米黄纸纹 · 试用</option><option value="plain">纯色底</option></select>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 const select=byId('terminal-visual-style');let saved='signal';try{saved=localStorage.getItem('aved_visual_style_v1')||'signal';}catch{}
 function apply(value){const signal=value==='signal';document.body.classList.toggle('signal-preview',signal);select.value=signal?'signal':'archive';}
 apply(saved);select.onchange=()=>{apply(select.value);try{localStorage.setItem('aved_visual_style_v1',select.value);}catch{}};
 const surface=byId('terminal-paper-texture');let texture='paper';try{texture=localStorage.getItem('aved_paper_texture_v1')||'paper';}catch{}
 function applySurface(value){const paper=value!=='plain';document.body.classList.toggle('paper-texture',paper);surface.value=paper?'paper':'plain';}
 applySurface(texture);surface.onchange=()=>{applySurface(surface.value);try{localStorage.setItem('aved_paper_texture_v1',surface.value);}catch{}};
};
