/* Tiny procedural sprites and one cached backdrop. No images, fonts or game logic. */
window.AVEDDerbyScene=function(canvas){
 const W=576,H=360,ctx=canvas.getContext('2d'),back=document.createElement('canvas'),sprites=new Map();
 canvas.width=back.width=W;canvas.height=back.height=H;ctx.imageSmoothingEnabled=false;
 const colors=['#dba46a','#454657','#ece8d9','#f7c9a8','#ded5bd'];
 const starts=65,finish=510,laneY=i=>118+i*43;
 function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
 function label(c,text,x,y,size=8,color='#e8d6b6',align='left'){c.fillStyle=color;c.font=size+'px monospace';c.textAlign=align;c.fillText(text,x,y);}
 function backdrop(){
  const c=back.getContext('2d');c.imageSmoothingEnabled=false;
  const gradient=c.createLinearGradient(0,0,0,100);gradient.addColorStop(0,'#363e64');gradient.addColorStop(1,'#d49e8a');c.fillStyle=gradient;c.fillRect(0,0,W,H);
  rect(c,442,12,19,19,'#e8c496');rect(c,438,16,27,11,'#e8c496');rect(c,446,9,11,25,'#e8c496');
  for(let i=0;i<13;i++){
   const x=i*48-5,height=25+(i*17%33);rect(c,x,91-height,43,height,'#3f4e5c');rect(c,x+3,88-height,35,3,'#59616a');
   for(let r=0;r<4;r++)for(let col=0;col<5;col++)if(9+r*9<height)rect(c,x+5+col*7,97-height+r*9,3,4,(i+r+col)%3?'#899089':'#d4b47a');
  }
  rect(c,0,83,W,16,'#293f46');rect(c,0,88,W,2,'#7f9183');for(let x=8;x<W;x+=19)rect(c,x,81,2,20,'#7f9183');
  rect(c,0,99,W,231,'#3c5551');
  for(let i=0;i<5;i++){
   const y=laneY(i);rect(c,0,y-16,W,41,i%2?'#49605a':'#425850');rect(c,0,y+24,W,1,'#758374');
   for(let x=58;x<530;x+=26)rect(c,x,y+23,12,1,'#c2c2a1');
   for(let k=0;k<20;k++)rect(c,61+k*23+(i*9%20),y+8+k%3*3,2,1,'#758374');
   label(c,String(i+1).padStart(2,'0'),14,y+2,9,'#ead4ac');
   rect(c,52,y-15,1,39,'#b4b79c');
   for(let k=0;k<5;k++){rect(c,finish,y-16+k*8,4,8,k%2?'#243b40':'#ddd7b7');rect(c,finish+4,y-16+k*8,4,8,k%2?'#ddd7b7':'#243b40');}
  }
  rect(c,0,330,W,30,'#263d43');rect(c,0,330,W,2,'#91a08a');
  label(c,'A.V.E.D. / AFTER HOURS',15,349,9);label(c,'EXIT  >',535,349,9,'#e4bb7e','right');
  rect(c,11,15,147,26,'#263d43');rect(c,13,17,143,22,'#7b8b78');rect(c,15,19,139,18,'#263d43');
  label(c,'AFTER HOURS DERBY',24,32,10,'#e7c391');
  label(c,'START',58,96,7,'#e6d8be');label(c,'FINISH',501,96,7,'#e6d8be');
  // A tiny vending machine and a tired office plant establish the company yard.
  rect(c,202,54,22,42,'#a16d5b');rect(c,205,58,14,20,'#263d43');rect(c,207,61,4,5,'#d8bf85');rect(c,213,61,4,5,'#a7b7a0');rect(c,207,70,10,3,'#d8bf85');rect(c,208,84,11,4,'#384d4b');
  rect(c,242,86,12,10,'#a47d62');rect(c,246,68,3,18,'#a3b296');rect(c,239,70,7,4,'#81997d');rect(c,249,65,8,4,'#a3b296');
 }
 function sprite(kind,frame,pose='run'){
  const key=kind+':'+frame+':'+pose;if(sprites.has(key))return sprites.get(key);
  const im=document.createElement('canvas');im.width=40;im.height=33;const c=im.getContext('2d'),id=['orange','black','cow','pig','frenchie'].indexOf(kind),color=colors[id]||colors[0],dog=kind==='frenchie',pig=kind==='pig';
  const r=(x,y,w,h,v)=>rect(c,x,y,w,h,v),ink='#25353d',highlight=kind==='black'?'#717187':'#f1d7b2';
  if(pose==='sleep'){
   r(8,21,23,8,ink);r(10,18,19,10,color);r(24,15,8,10,color);r(24,12,3,5,color);r(30,12,3,5,color);r(27,20,4,1,ink);r(9,23,9,4,highlight);r(7,21,3,5,color);
   if(dog){r(26,20,8,6,'#777b79');r(31,21,4,2,'#353d40');r(25,13,2,3,'#c2a19a');}
   if(pig){r(24,13,4,4,'#e2859b');r(31,21,7,5,'#f27d99');r(33,23,1,2,ink);r(36,23,1,2,ink);}
  }else if(pig){
   const moving=pose==='run'||pose==='push',bounce=moving?frame%2:0,leg=moving?[-1,1,2,0][frame]:0,nose=pose==='nudge'?frame%2:0;
   // A slimmer peach silhouette, small floppy ears and a compact pink snout.
   r(10,18+bounce,23,8,ink);r(11,15+bounce,19,10,color);r(9,18+bounce,5,5,color);r(26,13+bounce,8,11,color);
   r(13+leg,25,3,5,'#d78194');r(27-leg,25,3,5,'#d78194');
   r(25,11+bounce,4,4,'#de7f9d');r(26,12+bounce,2,2,'#f0a2ad');r(31,12+bounce,3,4,'#de7f9d');
   r(32+nose,19+bounce,6,5,'#f27d99');r(33+nose,20+bounce,1,2,ink);r(36+nose,20+bounce,1,2,ink);
   r(29,16+bounce,2,2,ink);r(29,16+bounce,1,1,'#fff0dc');r(11,16+bounce,12,2,'#ffdbbd');r(29,20+bounce,2,2,'#ed9faa');
   r(6,19+bounce,4,2,'#de7f9d');r(4,16+bounce,2,4,'#de7f9d');r(5,15+bounce,4,2,'#de7f9d');r(8,16+bounce,2,2,'#de7f9d');
  }else{
   const moving=pose==='run'||pose==='carry',bounce=moving?frame%2:0,leg=moving?[-2,0,2,0][frame]:0;
   r(10,16+bounce,20,dog?11:9,ink);r(11,15+bounce,18,dog?10:8,color);
   r(11+leg,24,4,6,ink);r(12+leg,24,3,4,color);r(24-leg,24,4,6,ink);r(24-leg,24,3,4,color);
   r(24,11+bounce,11,dog?13:11,ink);r(25,11+bounce,9,10,color);
   if(dog){
    // Short, broad bat ears: cream tips, pink interiors, clearly a French bulldog.
    r(23,8+bounce,6,6,color);r(24,7+bounce,4,1,color);r(31,8+bounce,6,6,color);r(32,7+bounce,4,1,color);r(25,9+bounce,3,3,'#c2a19a');r(33,9+bounce,3,3,'#c2a19a');
    r(24,11+bounce,12,12,color);r(25,11+bounce,3,7,'#eee5d2');r(28,17+bounce,9,7,'#858985');r(33,17+bounce,4,3,'#363d40');r(29,23+bounce,6,2,'#efdfc9');
    r(9,16+bounce,4,4,color);r(13,16+bounce,8,5,'#ebe2cd');r(23,21+bounce,5,6,'#f0e9d7');r(30,14+bounce,3,3,'#86654b');
   }else{
    r(24,7+bounce,4,6,ink);r(31,7+bounce,4,6,ink);r(25,8+bounce,2,4,color);r(32,8+bounce,2,4,color);r(33,18+bounce,4,3,highlight);r(8,14+bounce,3,8,color);r(5,10+bounce,3,7,color);r(4,8+bounce,3,4,color);
   }
   r(31,14+bounce,2,2,ink);r(31,14+bounce,1,1,'#fff0c4');
   if(kind==='cow'){r(12,16,7,5,'#4c5056');r(25,11+bounce,4,5,'#4c5056');}
   if(kind==='orange'||kind==='tabby'){r(13,15+bounce,2,5,'#70604f');r(19,15+bounce,2,5,'#70604f');r(27,11+bounce,2,3,'#70604f');}
  }
  sprites.set(key,im);return im;
 }
 function box(x,y,open=false){
  rect(ctx,x-10,y-13,23,18,'#364541');rect(ctx,x-9,y-12,21,16,'#b79361');rect(ctx,x-9,y-12,21,3,'#ddbb83');rect(ctx,x+1,y-11,3,14,'#d5b681');rect(ctx,x-7,y-4,5,4,'#75644b');
  if(open){rect(ctx,x-9,y-14,21,3,'#3b4540');rect(ctx,x-14,y-17,12,3,'#c5a574');rect(ctx,x+5,y-18,11,3,'#c5a574');}else{rect(ctx,x-11,y-15,23,3,'#c5a574');}
 }
 backdrop();
 return {
  thumbnail(kind){return sprite(kind,0,'idle').toDataURL();},
  paint(state,now,animated=true,celebratedAt=0){
   ctx.clearRect(0,0,W,H);ctx.drawImage(back,0,0);
   const elapsed=Math.max(0,now-state.serverTime),fraction=Math.min(1,elapsed/Math.max(1,(state.frameAt??state.serverTime)-state.serverTime));
   for(const r of state.runners){
    const progress=r.progress+((r.nextProgress??r.progress)-r.progress)*fraction,x=starts+(finish-starts)*progress/100,y=laneY(r.id),pose=fraction>=1?(r.nextPose||r.pose):r.pose,frame=animated?Math.floor(now/110+r.id)%4:0;
    const boxProgress=(r.boxProgress||45)+((r.nextBoxProgress??r.boxProgress??45)-(r.boxProgress||45))*fraction,bx=starts+(finish-starts)*boxProgress/100;
    const carried=pose==='carry';
    if(!carried)box(bx+(pose==='nudge'&&animated?frame%2:0),y+7,pose==='box'||pose==='sniff');
    rect(ctx,x-10,y+13,24,3,'#283f4266');
    const hidden=pose==='box'&&!['frenchie','pig'].includes(r.kind);
    if(!hidden)ctx.drawImage(sprite(r.kind,frame,pose==='finished'?'idle':pose),Math.round(x-20),y-16);
    else{rect(ctx,bx-5,y-12-(animated?frame%2:0),3,7,colors[r.id]);rect(ctx,bx-8,y-15,5,3,colors[r.id]);}
    if(carried)box(bx,y-3+(animated?frame%2:0),true);
    if(pose==='sniff'){rect(ctx,x+19,y+1+(animated?frame%2:0),2,1,'#e4d3ae');rect(ctx,x+22,y-2,2,1,'#e4d3ae');}
    if(pose==='sleep'||hidden)label(ctx,'z Z',x-5,y-23-(animated?frame:0),8,'#ecd6ad');
    if(pose==='run'&&animated&&progress>0&&progress<100){rect(ctx,x-23-frame*2,y+9,3,2,'#b2b299');rect(ctx,x-29-frame,y+12,2,1,'#b2b299');}
    const own=(state.bets||[]).filter(b=>b.runner===r.id);
    if(own.length){rect(ctx,x-17,y+18,34,2,'#e4bf82');label(ctx,own.map(b=>b.market==='first'?'1':'5').join('/'),26,y+13,7,'#e4bf82','center');}
    if(state.order){const rank=state.order.indexOf(r.id)+1;label(ctx,String(rank),548,y+2,13,rank===1?'#f3ca7f':'#d8d8bc','center');}
   }
   if(celebratedAt&&animated&&now-celebratedAt<2200){const t=(now-celebratedAt)/2200;for(let i=0;i<28;i++){const x=(i*113)%W,y=t*H+(i*37%70)-60;rect(ctx,x,y,2,4,['#e6bd83','#b4cbb0','#d89180'][i%3]);}}
  }
 };
};
