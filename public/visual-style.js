window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('section');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<label for="terminal-visual-style">界面样式 <small>DISPLAY</small></label><select id="terminal-visual-style"><option value="archive">档案终端 · 现行</option><option value="signal">信号终端 · 预览</option></select>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 const select=byId('terminal-visual-style');let saved='archive';try{saved=localStorage.getItem('aved_visual_style_v1')||'archive';}catch{}
 function apply(value){const signal=value==='signal';document.body.classList.toggle('signal-preview',signal);select.value=signal?'signal':'archive';}
 apply(saved);select.onchange=()=>{apply(select.value);try{localStorage.setItem('aved_visual_style_v1',select.value);}catch{}};
};
