/* Theme-coloured character gradients for the player's existing ASCII texture. */
(()=>{
 const pane=document.querySelector('.terminal-content-pane');if(!pane)return;
 const canvas=document.createElement('canvas');canvas.className='terminal-ascii-field';canvas.setAttribute('aria-hidden','true');pane.prepend(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ramp=' .,:;irsXA253hMHGS#9B&@';
 let frame=0,last=0,time=0,w=0,h=0,ink='',muted='',accent='',night=false,pointer=null;
 const selected=()=>document.body.classList.contains('theme-inner')&&document.body.dataset.terminalPattern==='ascii'&&pane.getClientRects().length>0;
 const animated=()=>selected()&&!document.hidden&&!reduced.matches&&window.AVEDEffectsEnabled?.()!==false;
 function paint(){
  if(!w||!h)return;ctx.clearRect(0,0,w,h);
  const cell=Math.max(7,Math.ceil(w/180)),line=cell*1.55,cols=Math.ceil(w/cell),rows=Math.ceil(h/line);
  ctx.font=cell*1.65+'px monospace';ctx.textBaseline='top';ctx.fillStyle=ink;
  // Draw one text run per row; never allocate one DOM element per character.
  for(let y=0;y<rows;y++){
   let text='';for(let x=0;x<cols;x++){
    const nx=x/cols,ny=y/rows;
    const field=.5+.23*Math.sin(nx*6.2+ny*3.8+time*.23)+.18*Math.sin(ny*8.2-nx*2.4-time*.19)+.09*Math.sin(nx*13-ny*9+time*.14);
    const near=pointer?Math.max(0,1-Math.hypot((nx-pointer.x)*1.4,ny-pointer.y)*5):0;
    const grain=Math.sin(x*127.1+y*311.7)*43758.5453,noise=grain-Math.floor(grain);
    const level=Math.max(0,Math.min(.999,(field-.18)/.82+near*.12+(noise-.5)*.15));text+=ramp[Math.floor(level*ramp.length)];
   }ctx.fillText(text,0,y*line);
  }
  ctx.globalCompositeOperation='source-in';
  const drift=Math.sin(time*.12)*w*.25,gradient=ctx.createLinearGradient(-w*.3+drift,h,w*1.2+drift,0);
  gradient.addColorStop(0,muted);gradient.addColorStop(.34,accent);gradient.addColorStop(.64,muted);gradient.addColorStop(.82,ink);gradient.addColorStop(1,accent);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
  // A quiet glow beneath the glyphs preserves readable text and card contrast.
  ctx.globalCompositeOperation='destination-over';ctx.globalAlpha=night?.07:.025;ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
 function tick(now){frame=0;if(!animated())return;if(!last||now-last>=100){const dt=last?Math.min(.15,(now-last)/1000):0;last=now;time+=dt;paint();}frame=requestAnimationFrame(tick);}
 function sync(){
  cancelAnimationFrame(frame);frame=0;last=0;const active=selected();canvas.hidden=!active;pane.classList.toggle('has-ascii-field',active);if(!active)return;
  const css=getComputedStyle(document.body);ink=css.getPropertyValue('--inner-text-main').trim()||'#d4c6a9';muted=css.getPropertyValue('--inner-text-muted').trim()||ink;accent=css.getPropertyValue('--inner-crimson').trim()||muted;night=document.body.classList.contains('dark-mode');
  const rect=pane.getBoundingClientRect(),width=Math.ceil(rect.width),height=Math.min(innerHeight,Math.ceil(rect.height));
  if(width!==w||height!==h){w=width;h=height;const ratio=Math.min(1.5,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));canvas.style.height=h+'px';canvas.style.setProperty('--ascii-field-height',h+'px');ctx.setTransform(ratio,0,0,ratio,0,0);}
  paint();if(animated())frame=requestAnimationFrame(tick);
 }
 const state=new MutationObserver(sync);for(const node of [document.body,document.documentElement])state.observe(node,{attributes:true,attributeFilter:['class','data-terminal-pattern','data-palette-preview','data-theme-mode']});
 new ResizeObserver(sync).observe(pane);
 document.addEventListener('visibilitychange',sync);document.addEventListener('aved-effects-change',sync);reduced.addEventListener('change',sync);window.addEventListener('resize',sync);
 pane.addEventListener('pointermove',e=>{const r=pane.getBoundingClientRect();pointer={x:(e.clientX-r.left)/Math.max(w,1),y:(e.clientY-r.top)/Math.max(h,1)};},{passive:true});pane.addEventListener('pointerleave',()=>{pointer=null;});
 sync();
})();
