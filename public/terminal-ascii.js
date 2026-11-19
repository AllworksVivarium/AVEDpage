/* A bounded viewport canvas; hidden tabs and disabled effects never run an animation loop. */
(()=>{
 const pane=document.querySelector('.terminal-content-pane');if(!pane||!window.AVEDTerminalPatternArt)return;
 const canvas=document.createElement('canvas');canvas.className='terminal-ascii-field';canvas.setAttribute('aria-hidden','true');pane.prepend(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,last=0,time=7,w=0,h=0,ink='',muted='',accent='',pointer=null;
 const selected=()=>document.body.classList.contains('theme-inner')&&['ascii','phase','rain','grid'].includes(document.body.dataset.terminalPattern)&&pane.getClientRects().length>0;
 const animated=()=>selected()&&document.body.dataset.terminalPattern!=='grid'&&!document.hidden&&!reduced.matches&&window.AVEDEffectsEnabled?.()!==false;
 function paint(){if(!w||!h)return;window.AVEDTerminalPatternArt.paint(ctx,{width:w,height:h,time,pattern:document.body.dataset.terminalPattern,pointer,ink,muted,accent});}
 function tick(now){frame=0;if(!animated())return;if(!last||now-last>=65){const dt=last?Math.min(.18,(now-last)/1000):0;last=now;time+=dt;paint();}frame=requestAnimationFrame(tick);}
 function sync(){
  cancelAnimationFrame(frame);frame=0;last=0;const active=selected();canvas.hidden=!active;canvas.dataset.pattern=document.body.dataset.terminalPattern;pane.classList.toggle('has-ascii-field',active);if(!active)return;
  const css=getComputedStyle(document.body);ink=css.getPropertyValue('--inner-text-main').trim()||'#d4c6a9';muted=css.getPropertyValue('--inner-text-muted').trim()||ink;accent=css.getPropertyValue('--inner-crimson').trim()||muted;
  const rect=pane.getBoundingClientRect(),width=Math.ceil(rect.width),height=Math.min(innerHeight,Math.ceil(rect.height));
  if(width!==w||height!==h){w=width;h=height;const ratio=Math.min(1.25,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));canvas.style.height=h+'px';canvas.style.setProperty('--ascii-field-height',h+'px');ctx.setTransform(ratio,0,0,ratio,0,0);}
  paint();if(animated())frame=requestAnimationFrame(tick);
 }
 const state=new MutationObserver(sync);for(const node of [document.body,document.documentElement])state.observe(node,{attributes:true,attributeFilter:['class','data-terminal-pattern','data-palette-preview','data-theme-mode','data-saved-theme']});
 new ResizeObserver(sync).observe(pane);
 for(const type of ['visibilitychange','aved-effects-change','aved-appearance-change','aved-theme-change'])document.addEventListener(type,sync);
 reduced.addEventListener('change',sync);window.addEventListener('resize',sync);
 pane.addEventListener('pointermove',e=>{const r=pane.getBoundingClientRect();pointer={x:(e.clientX-r.left)/Math.max(w,1),y:(e.clientY-r.top)/Math.max(h,1)};},{passive:true});pane.addEventListener('pointerleave',()=>{pointer=null;});
 sync();
})();
