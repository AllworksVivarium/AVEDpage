/* Shared, theme-coloured animation for the player's two collected textures. */
(()=>{
 const pane=document.querySelector('.terminal-content-pane');if(!pane)return;
 const canvas=document.createElement('canvas');canvas.className='terminal-ascii-field';canvas.setAttribute('aria-hidden','true');pane.prepend(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ramp=' 012345678901234567890123456789.:#';
 let frame=0,last=0,time=0,w=0,h=0,ink='',muted='',accent='',night=false,pointer=null;
 const selected=()=>document.body.classList.contains('theme-inner')&&['ascii','phase'].includes(document.body.dataset.terminalPattern)&&pane.getClientRects().length>0;
 const animated=()=>selected()&&!document.hidden&&!reduced.matches&&window.AVEDEffectsEnabled?.()!==false;
 function paintAscii(){
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
 }
 function paintPhase(){
  const cell=Math.max(10,Math.ceil(w/120)),cols=Math.ceil(w/cell),rows=Math.ceil(h/cell);
  ctx.fillStyle=ink;
  // The underlying matrix stays fixed; only its signal intensity travels.
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const nx=x/cols,ny=y/rows,scan=(time*.055+nx*.16)%1.3-.15;
   const wave=.5+.5*Math.sin(nx*7-ny*5-time*.9),pulse=Math.max(0,1-Math.abs(ny-scan)*12);
   const near=pointer?Math.max(0,1-Math.hypot((nx-pointer.x)*1.4,ny-pointer.y)*6):0;
   const strength=Math.min(1,wave*.3+pulse*.65+near*.35),size=.8+strength*1.5;
   ctx.globalAlpha=.24+strength*.65;ctx.fillRect(x*cell+cell/2-size/2,y*cell+cell/2-size/2,size,size);
  }
  const routes=[[[0,30],[25,30],[40,45],[75,45],[90,30],[120,30]],[[0,90],[25,90],[40,75],[75,75],[90,90],[120,90]],[[30,0],[30,25],[45,40],[45,75],[30,90],[30,120]],[[90,0],[90,25],[75,40],[75,75],[90,90],[90,120]]];
  ctx.strokeStyle=ink;ctx.lineWidth=.65;ctx.globalAlpha=.32;ctx.beginPath();
  for(let y=0;y<h;y+=120)for(let x=0;x<w;x+=120){
   for(const route of routes){ctx.moveTo(x+route[0][0],y+route[0][1]);for(const [dx,dy] of route.slice(1))ctx.lineTo(x+dx,y+dy);}
   ctx.rect(x+55,y+55,10,10);
  }
  ctx.stroke();ctx.globalAlpha=.9;
  for(let y=0;y<h;y+=120)for(let x=0;x<w;x+=120){
   const offset=x/120*.73+y/120*.47,route=routes[(x/120+y/120)%4],position=((time*.3+offset)%5),index=Math.floor(position),progress=position-index;
   const [ax,ay]=route[index],[bx,by]=route[index+1];
   ctx.fillRect(x+ax+(bx-ax)*progress-1.25,y+ay+(by-ay)*progress-1.25,2.5,2.5);
  }
  ctx.globalAlpha=1;
 }
 function paint(){
  if(!w||!h)return;ctx.clearRect(0,0,w,h);
  if(document.body.dataset.terminalPattern==='phase')paintPhase();else paintAscii();
  ctx.globalCompositeOperation='source-in';
  const drift=Math.sin(time*.12)*w*.25,gradient=ctx.createLinearGradient(-w*.3+drift,h,w*1.2+drift,0);
  gradient.addColorStop(0,muted);gradient.addColorStop(.34,accent);gradient.addColorStop(.64,muted);gradient.addColorStop(.82,ink);gradient.addColorStop(1,accent);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
  // A quiet glow beneath the glyphs preserves readable text and card contrast.
  ctx.globalCompositeOperation='destination-over';ctx.globalAlpha=night?.07:.025;ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
 function tick(now){frame=0;if(!animated())return;if(!last||now-last>=100){const dt=last?Math.min(.15,(now-last)/1000):0;last=now;time+=dt;paint();}frame=requestAnimationFrame(tick);}
 function sync(){
  cancelAnimationFrame(frame);frame=0;last=0;const active=selected();canvas.hidden=!active;canvas.dataset.pattern=document.body.dataset.terminalPattern;pane.classList.toggle('has-ascii-field',active);if(!active)return;
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
