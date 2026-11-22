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
 const boardSize=288;
 const circuitRoutes=[
  [[0,32],[56,32],[80,56],[208,56],[232,32],[288,32]],
  [[0,48],[48,48],[72,72],[216,72],[240,48],[288,48]],
  [[0,96],[48,96],[72,120],[104,120]],
  [[0,112],[40,112],[64,136],[104,136]],
  [[0,192],[48,192],[72,168],[104,168]],
  [[288,96],[240,96],[216,120],[184,120]],
  [[288,112],[248,112],[224,136],[184,136]],
  [[288,192],[240,192],[216,168],[184,168]],
  [[0,240],[56,240],[80,216],[208,216],[232,240],[288,240]],
  [[0,256],[48,256],[72,232],[216,232],[240,256],[288,256]],
  [[32,0],[32,56],[56,80],[56,176],[32,200],[32,288]],
  [[256,0],[256,56],[232,80],[232,176],[256,200],[256,288]],
  [[120,0],[120,24],[96,48],[96,88],[120,112]],
  [[168,288],[168,264],[192,240],[192,200],[168,176]]
 ].map(points=>{let total=0;const lengths=points.slice(1).map(([x,y],i)=>{total+=Math.hypot(x-points[i][0],y-points[i][1]);return total;});return {points,lengths,total};});
 function phase(c,w,h,t,p){
  // Fixed board geometry stays legible when motion is disabled; packets use measured trace lengths.
  for(let oy=-36,row=0;oy<h;oy+=boardSize,row++)for(let ox=-36,col=0;ox<w;ox+=boardSize,col++){
   const mirror=(row+col)%2===1,at=([x,y])=>[ox+(mirror?boardSize-x:x),oy+y];
   const seed=hash(col+row*97),near=p?Math.max(0,1-Math.hypot((ox+144)/w-p.x,(oy+144)/h-p.y)*4):0;
   c.globalAlpha=.25+near*.12;c.lineWidth=.8;c.beginPath();
   for(const {points} of circuitRoutes){const [x,y]=at(points[0]);c.moveTo(x,y);for(const point of points.slice(1))c.lineTo(...at(point));}c.stroke();
   // Multi-pin integrated circuits, a second small package, resistors and plated vias.
   c.globalAlpha=.42;c.lineWidth=.9;c.beginPath();c.rect(ox+108,oy+108,72,72);c.rect(ox+116,oy+116,56,56);c.rect(ox+124,oy+124,40,40);
   for(let pin=0;pin<8;pin++){const n=116+pin*8;c.moveTo(ox+100,oy+n);c.lineTo(ox+108,oy+n);c.moveTo(ox+180,oy+n);c.lineTo(ox+188,oy+n);c.moveTo(ox+n,oy+100);c.lineTo(ox+n,oy+108);c.moveTo(ox+n,oy+180);c.lineTo(ox+n,oy+188);}
   c.rect(ox+76,oy+264,36,16);c.rect(ox+202,oy+80,18,28);c.rect(ox+72,oy+176,18,8);c.rect(ox+196,oy+184,8,20);c.stroke();
   c.globalAlpha=.2;c.fillRect(ox+119,oy+119,3,3);c.fillRect(ox+81,oy+268,26,2);
   c.globalAlpha=.5;c.lineWidth=1;c.beginPath();
   for(const [x,y] of [[24,24],[264,264],[88,200],[200,88],[144,88],[144,200]]){c.moveTo(ox+x+3,oy+y);c.arc(ox+x,oy+y,3,0,TAU);}c.stroke();
   // Fine drill marks and short surface-mount pads soften the repetition of the larger chips.
   c.globalAlpha=.13;for(let y=12;y<boardSize;y+=24)for(let x=12;x<boardSize;x+=24)if(hash(x+y+col*13)>.4)c.fillRect(ox+x,oy+y,.8,.8);
   for(let n=0;n<4;n++){
    const route=circuitRoutes[(col*3+row*5+n*3)%circuitRoutes.length];
    for(let k=5;k>=0;k--){
     const d=((t*(30+seed*16)+seed*route.total+n*47-k*4)%route.total+route.total)%route.total;
     const i=route.lengths.findIndex(end=>end>=d),start=i?route.lengths[i-1]:0,q=(d-start)/(route.lengths[i]-start),a=route.points[i],b=route.points[i+1];
     const [x,y]=at([a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q]);
     c.globalAlpha=(1-k/6)*(.75+near*.2);c.fillRect(x-1.1,y-1.1,2.2,2.2);
     if(k===0){c.globalAlpha=.09;c.fillRect(x-4,y-4,8,8);}
    }
   }
  }c.globalAlpha=1;
 }
 function grid(c,w,h){
  // Ordinary squared paper: uniform ruling and stable, barely visible paper fibres.
  c.lineWidth=.65;c.globalAlpha=.38;c.beginPath();
  for(let x=.5;x<w;x+=24){c.moveTo(x,0);c.lineTo(x,h);}for(let y=.5;y<h;y+=24){c.moveTo(0,y);c.lineTo(w,y);}c.stroke();
  const fibres=Math.min(6500,Math.ceil(w*h/180));
  for(let i=0;i<fibres;i++){c.globalAlpha=.025+hash(i+811)*.055;c.fillRect(hash(i+19)*w,hash(i+393)*h,.4+hash(i+71)*1.6,.5);}
  c.globalAlpha=1;
 }
 function paint(c,{width:w,height:h,time:t=0,pattern='ascii',pointer=null,ink='#d4c6a9',muted='#807a6c',accent='#8b2727'}){
  c.clearRect(0,0,w,h);c.fillStyle=ink;c.strokeStyle=ink;
  if(pattern==='rain')rain(c,w,h,t);else if(pattern==='phase')phase(c,w,h,t,pointer);else if(pattern==='grid')grid(c,w,h);else flow(c,w,h,t,pointer);
  // Colour the glyphs themselves. Keep the background transparent for document contrast.
  const g=c.createLinearGradient(0,h,w,0),shift=Math.sin(t*.12)*.055;
  if(pattern==='grid'){g.addColorStop(0,ink);g.addColorStop(1,ink);}else{g.addColorStop(0,accent);g.addColorStop(.21+shift,tint(accent,ink));g.addColorStop(.45,ink);g.addColorStop(.69+shift,tint(accent,ink));g.addColorStop(1,muted);}
  c.globalCompositeOperation='source-in';c.fillStyle=g;c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';
 }
 root.AVEDTerminalPatternArt={paint};
})(globalThis);
