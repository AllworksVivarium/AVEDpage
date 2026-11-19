/* Canvas-only pattern artwork; no per-glyph DOM nodes or external rendering dependency. */
(function(root){
 const TAU=Math.PI*2,hash=n=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
 const tint=(a,b,mix=.32)=>{if(!/^#[0-9a-f]{6}$/i.test(a)||!/^#[0-9a-f]{6}$/i.test(b))return a;return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-mix)+parseInt(b.slice(i,i+2),16)*mix).toString(16).padStart(2,'0')).join('');};
 const chars='0123456789ABCDEF:;./\\<>[]{}+=*#';
 function flow(c,w,h,t,p){
  const cell=Math.max(8,Math.ceil(w/150)),line=cell*1.45,rows=Math.ceil(h/line),ramp=' 012345678901234567890123456789.:#';
  c.font=`${cell*1.45}px monospace`;c.textBaseline='top';
  const advance=Math.max(1,c.measureText('M')?.width||cell*.87),cols=Math.ceil(w/advance)+1;
  for(let y=0;y<rows;y++){
   let run='';
   for(let x=0;x<cols;x++){
    const nx=x/cols,ny=y/rows,near=p?Math.max(0,1-Math.hypot((nx-p.x)*1.4,ny-p.y)*4):0;
    const field=.47+.23*Math.sin(nx*6.2+ny*3.8+t*.23)+.18*Math.sin(ny*8.2-nx*2.4-t*.19)+.1*Math.sin(nx*13-ny*9+t*.14);
    const level=Math.max(0,Math.min(.999,field+near*.12+(hash(x+y*311)-.5)*.16));run+=ramp[Math.floor(level*ramp.length)];
   }
   c.globalAlpha=.65+.35*Math.sin(y*.16+t*.22)**2;c.fillText(run,0,y*line);
  }c.globalAlpha=1;
 }
 function rain(c,w,h,t){
  const cell=Math.max(9,Math.ceil(w/130)),line=cell*1.4,cols=Math.ceil(w/cell),rows=Math.ceil(h/line);
  c.font=`${cell}px monospace`;c.textBaseline='top';
  // Every column owns a fixed x-coordinate, independent of the pointer.
  for(let x=0;x<cols;x++){
   const seed=hash(x+7),speed=4+seed*8,tail=13+Math.floor(hash(x+231)*22),travel=t*speed+seed*(rows+tail),head=travel%(rows+tail);
   for(let k=0;k<tail;k++){
    const row=head-k;if(row< -1||row>rows)continue;
    c.globalAlpha=k===0?1:Math.pow(1-k/tail,1.65)*.72;
    const glyph=chars[Math.floor(hash(x*199+Math.floor(travel)-k)*chars.length)];
    c.fillText(glyph,x*cell,row*line);
    if(k===0){c.globalAlpha=.3;c.fillRect(x*cell,row*line+line-2,cell*.65,1);}
   }
  }c.globalAlpha=1;
 }
 function phase(c,w,h,t,p){
  const cell=Math.max(12,Math.ceil(w/105)),cols=Math.ceil(w/cell),rows=Math.ceil(h/cell);
  const cx=w*(.5+.12*Math.sin(t*.13)),cy=h*(.48+.1*Math.cos(t*.11));
  // Interference rings, a sweeping wavefront, and local illumination share a fixed dot lattice.
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const px=x*cell+cell/2,py=y*cell+cell/2,d=Math.hypot(px-cx,py-cy),angle=Math.atan2(py-cy,px-cx);
   const rings=Math.max(0,Math.cos(d*.035-t*1.3))**12;
   const sweep=Math.max(0,Math.cos(angle-t*.23))**36;
   const wave=(Math.sin(x*.16-y*.11+t*.5)+1)*.09;
   const near=p?Math.max(0,1-Math.hypot(px/w-p.x,py/h-p.y)*5):0;
   const light=Math.min(1,wave+rings*.48+sweep*.55+near*.5),size=.65+light*1.8;
   c.globalAlpha=.16+light*.8;c.fillRect(px-size/2,py-size/2,size,size);
   if(light>.72){c.globalAlpha=(light-.72)*.6;c.fillRect(px-4,py-4,8,8);c.globalAlpha=(light-.72)*.15;c.fillRect(px-8,py-8,16,16);}
  }
  const tile=168;
  const routes=[[[0,35],[35,35],[56,56],[112,56],[133,35],[168,35]],[[0,133],[35,133],[56,112],[112,112],[133,133],[168,133]],[[35,0],[35,35],[56,56],[56,112],[35,133],[35,168]],[[133,0],[133,35],[112,56],[112,112],[133,133],[133,168]]];
  c.lineWidth=.6;c.globalAlpha=.22;c.beginPath();
  for(let y=0;y<h;y+=tile)for(let x=0;x<w;x+=tile){
   for(const r of routes){c.moveTo(x+r[0][0],y+r[0][1]);for(const [dx,dy]of r.slice(1))c.lineTo(x+dx,y+dy);}
   c.rect(x+75,y+75,18,18);c.rect(x+79,y+79,10,10);
  }c.stroke();
  // Tiny travelling packets leave fading traces on the circuit routes.
  for(let y=0;y<h;y+=tile)for(let x=0;x<w;x+=tile)for(let n=0;n<2;n++){
   const offset=x/tile*.73+y/tile*.47+n*2.3,r=routes[(Math.floor(x/tile+y/tile)+n)%4];
   for(let k=5;k>=0;k--){const pos=((t*.42+offset-k*.055)%5+5)%5,i=Math.floor(pos),q=pos-i,[ax,ay]=r[i],[bx,by]=r[i+1],px=x+ax+(bx-ax)*q,py=y+ay+(by-ay)*q;
    c.globalAlpha=(1-k/6)*.85;c.fillRect(px-1.2,py-1.2,2.4,2.4);
   }
  }
  c.globalAlpha=.12;c.lineWidth=.75;
  for(let n=0;n<3;n++){c.beginPath();c.arc(cx,cy,38+n*63+Math.sin(t*.4)*4,t*.07+n,t*.07+n+TAU*.72);c.stroke();}
  // Moving orbit accents and crosshair beacons brighten the larger signal structure.
  for(let n=0;n<3;n++){
   const radius=38+n*63+Math.sin(t*.4)*4,angle=t*(.16+n*.045)+n*2.1;
   c.globalAlpha=.58;c.lineWidth=1;c.beginPath();c.arc(cx,cy,radius,angle,angle+.38);c.stroke();
   const px=cx+Math.cos(angle+.38)*radius,py=cy+Math.sin(angle+.38)*radius;
   c.globalAlpha=.13;c.fillRect(px-6,py-6,12,12);c.globalAlpha=.85;c.fillRect(px-1.5,py-1.5,3,3);
   c.globalAlpha=.42;c.beginPath();c.moveTo(px-5,py);c.lineTo(px+5,py);c.moveTo(px,py-5);c.lineTo(px,py+5);c.stroke();
  }
  c.globalAlpha=1;
 }
 function grid(c,w,h){
  c.lineWidth=.75;c.globalAlpha=.34;c.beginPath();
  for(let x=0;x<w;x+=24){c.moveTo(x,0);c.lineTo(x,h);}for(let y=0;y<h;y+=24){c.moveTo(0,y);c.lineTo(w,y);}c.stroke();
  c.globalAlpha=.82;c.beginPath();
  for(let x=0;x<w;x+=120)for(let y=0;y<h;y+=120){c.moveTo(x-5,y);c.lineTo(x+5,y);c.moveTo(x,y-5);c.lineTo(x,y+5);c.rect(x+45,y+45,30,30);}
  c.stroke();c.globalAlpha=.36;c.beginPath();
  for(let x=0;x<w;x+=360)for(let y=0;y<h;y+=360){c.moveTo(x,y+240);c.lineTo(x+240,y);c.moveTo(x+120,y+360);c.lineTo(x+360,y+120);c.arc(x+180,y+180,72,0,TAU);}
  c.stroke();c.globalAlpha=1;
 }
 function paint(c,{width:w,height:h,time:t=0,pattern='ascii',pointer=null,ink='#d4c6a9',muted='#807a6c',accent='#8b2727'}){
  c.clearRect(0,0,w,h);c.fillStyle=ink;c.strokeStyle=ink;
  if(pattern==='rain')rain(c,w,h,t);else if(pattern==='phase')phase(c,w,h,t,pointer);else if(pattern==='grid')grid(c,w,h);else flow(c,w,h,t,pointer);
  // Colour the glyphs themselves. Keep the background transparent for document contrast.
  const g=c.createLinearGradient(0,h,w,0),shift=pattern==='grid'?0:Math.sin(t*.12)*.055;
  g.addColorStop(0,accent);g.addColorStop(.21+shift,tint(accent,ink));g.addColorStop(.45,ink);g.addColorStop(.69+shift,tint(accent,ink));g.addColorStop(1,muted);
  c.globalCompositeOperation='source-in';c.fillStyle=g;c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';
 }
 root.AVEDTerminalPatternArt={paint};
})(globalThis);
