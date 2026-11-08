// Exact stops within the one-second server window; no extrapolation into sleep.
window.AVEDDerbyPosition=function(r,now,serverTime,frameAt){
 const points=r.motion;
 if(points?.length){
  let a=points[0],z=a;
  for(let i=1;i<points.length;i++){z=points[i];if(now<z.at)break;a=z;}
  const f=Math.max(0,Math.min(1,(now-a.at)/Math.max(1,z.at-a.at)));
  const endPhase=z.pose===a.pose?(z.actionPhase??0):1;
  return {...a,progress:a.progress+(z.progress-a.progress)*f,boxProgress:a.boxProgress+(z.boxProgress-a.boxProgress)*f,actionPhase:(a.actionPhase??0)+(endPhase-(a.actionPhase??0))*f};
 }
 const f=Math.max(0,Math.min(1,(now-serverTime)/Math.max(1,frameAt-serverTime)));
 return {...r,progress:r.pose==='sleep'?r.progress:r.progress+((r.nextProgress??r.progress)-r.progress)*f};
};
/* Tiny procedural sprites and one cached backdrop. No images, fonts or game logic. */
window.AVEDDerbyScene=function(canvas,{onFinish=()=>{}}={}){
 const W=576,H=360,ctx=canvas.getContext('2d'),back=document.createElement('canvas'),sprites=new Map();
 canvas.width=back.width=W;canvas.height=back.height=H;ctx.imageSmoothingEnabled=false;
 const colors=['#dba46a','#454657','#ece8d9','#f7c9a8','#ded5bd'];
 const starts=65,finish=510,laneY=i=>118+i*43;let finishRound=null,finishEvent=null;
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
  // Double-resolution pixels leave room for whiskers and small coat details.
  const im=document.createElement('canvas');im.width=80;im.height=66;const c=im.getContext('2d');c.imageSmoothingEnabled=false;c.scale(2,2);
  const mask=document.createElement('canvas');mask.width=80;mask.height=66;const m=mask.getContext('2d');m.scale(2,2);
  const dog=kind==='frenchie',pig=kind==='pig',sleep=pose==='sleep',ink=pig?'#79594f':'#111512';
  const fur={orange:'#dbab70',black:'#555b69',cow:'#ece8d8',pig:'#f7cda9',frenchie:'#c9baa0'}[kind]||'#dbab70';
  const shade={orange:'#b78352',black:'#3a414e',cow:'#bfbfae',pig:'#c88e8d',frenchie:'#a4937d'}[kind];
  const light={orange:'#f1d5a2',black:'#89909b',cow:'#fff6df',pig:'#f5d4c4',frenchie:'#e9dfc6'}[kind];
  const moving=['run','jump','push','carry'].includes(pose),bob=moving?frame%2:0,step=moving?[-1,0,1,0][frame%4]:0;
  const r=(x,y,w,h,color=ink)=>{c.fillStyle=color;c.fillRect(x,y,w,h);},shape=(x,y,w,h)=>rect(m,x,y,w,h,ink);
  // Half-pixel rows keep round shapes crisp rather than antialiased.
  const oval=(target,x,y,w,h,color)=>{
   target.fillStyle=color;
   for(let row=0;row<h*2;row++){
    const dy=(row+.5)/h-1,inset=Math.round(w*(1-Math.sqrt(Math.max(0,1-dy*dy))))/2;
    target.fillRect(x+inset,y+row/2,w-inset*2,.5);
   }
  };
  const pigY=sleep?5:bob;
  // One solid mask gives every animal the same crisp, stepped black outline.
  if(pig){
   oval(m,7,12+pigY,27,sleep?12:16,ink);oval(m,24,14+pigY,14,sleep?10:13,ink);
   oval(m,23,10+pigY,6,7,ink);oval(m,32,12+pigY,6,6,ink);
   if(!sleep){shape(11+step,25,4,5);shape(28-step,25,4,5);}
   shape(5,17+pigY,4,2);shape(3,14+pigY,2,4);shape(4,13+pigY,3,2);shape(6,14+pigY,2,2);
  }else if(sleep){
   shape(9,22,23,7);shape(8,24,27,3);shape(12,20,17,10);shape(26,21,10,7);
   shape(26,19,3,4);shape(33,19,3,4);
   if(kind==='orange'){shape(6,23,6,4);shape(5,21,3,4);}
   else if(kind==='black'){shape(3,26,9,2);shape(2,24,3,3);}
   else if(kind==='cow'){shape(6,24,6,3);shape(5,22,3,3);shape(7,21,3,2);}
   else shape(6,23,6,4);
  }else{
   shape(7,18+bob,25,9);shape(10,16+bob,20,12);shape(9,26,6,3);shape(25,25,6,4);
   shape(10+step,27,5,3);shape(27-step,27,5,3);
   // A smaller face sits above the shoulders; the body keeps most of the volume.
   shape(25,14+bob,10,10);shape(24,16+bob,12,6);shape(27,13+bob,7,11);
   if(dog){
    shape(23,13+bob,14,10);shape(24,12+bob,4,4);shape(33,12+bob,4,4);
    shape(25,11+bob,2,2);shape(34,11+bob,2,2);shape(29,20+bob,9,4);
   }
   else{shape(25,11+bob,3,5);shape(26,10+bob,1,2);shape(32,11+bob,3,5);shape(33,10+bob,1,2);}
   // Distinct silhouettes: upright hook, low swept tail, and a rounded curl.
   if(kind==='orange'){shape(5,17+bob,4,5);shape(3,12+bob,3,7);shape(4,9+bob,3,4);shape(6,8+bob,4,2);}
   else if(kind==='black'){shape(4,20+bob,5,3);shape(2,18+bob,3,4);shape(1,15+bob,2,4);shape(2,14+bob,3,2);}
   else if(kind==='cow'){shape(5,17+bob,4,5);shape(3,13+bob,3,6);shape(4,10+bob,6,3);shape(8,12+bob,3,3);}
   else shape(5,19+bob,5,3);
  }
  const edge=pig?.5:1;
  for(const [x,y] of [[-edge,0],[edge,0],[0,-edge],[0,edge]])c.drawImage(mask,x,y,40,33);
  m.globalCompositeOperation='source-in';m.fillStyle=fur;m.fillRect(0,0,40,33);c.drawImage(mask,0,0,40,33);
  const faceInk=kind==='black'?'#f7efd8':ink;
  if(pig){
   // Peach round body, folded rose ears and an oval pink snout from the reference.
   oval(c,10,22+pigY,20,sleep?5:6,'#e6ac98');
   r(14,13+pigY,10,.5,'#ffe0bd');
   oval(c,23.5,10.5+pigY,5,6,'#ce6b92');oval(c,24.5,11+pigY,3.5,4,'#f7cda9');
   oval(c,32.5,12.5+pigY,5,5,'#ce6b92');oval(c,33,13+pigY,3.5,3.5,'#f7cda9');
   r(25,15+pigY,2,.5,'#ce6b92');r(34,16.5+pigY,2,.5,'#ce6b92');
   if(sleep){r(27,20+pigY,2,1,'#423631');r(34,20+pigY,1.5,1,'#423631');}
   else{oval(c,26.5,18+pigY,2.5,3,'#352f2b');oval(c,33,18.5+pigY,2,2.5,'#352f2b');}
   oval(c,29.5,21+pigY,7.5,5,'#ed8191');r(31.5,21.5+pigY,2.5,.5,'#ffa4ae');
   oval(c,31,22.5+pigY,1,1.5,'#51362f');oval(c,34,23+pigY,1,1.5,'#51362f');
   if(!sleep){r(12+step,29,2,.5,'#e6ac98');r(29-step,29,2,.5,'#e6ac98');}
  }else if(sleep){
   r(12,26,14,3,shade);r(15,21,10,1,light);r(28,24,2,1,faceInk);r(34,23.5,1,1,faceInk);r(32,26,1,1,'#b47e7d');
   if(!dog&&!pig){r(25,25,3,.5,faceInk);r(25,27,3,.5,faceInk);r(35,25,1.5,.5,faceInk);r(35,26.5,1.5,.5,faceInk);}
  }
  else{
   r(10,24+bob,15,3,shade);r(11,17+bob,12,1,light);r(26,23+bob,7,3,light);
   r(11+step,29,3,.5,light);r(28-step,29,3,.5,light);
   r(12+step,29, .5,1,shade);r(29-step,29,.5,1,shade);
   if(kind==='orange'){
    for(const x of [12,17,22]){r(x,18+bob,1.5,3,shade);r(x+1,20+bob,1,2,shade);}
    r(26,14+bob,2,1,shade);r(31,14+bob,2,1,shade);r(4,13+bob,2,1,shade);r(5,17+bob,2,1,shade);
   }
   if(kind==='cow'){r(10,18+bob,5,4,'#4a5050');r(12,20+bob,5,3,'#4a5050');r(26,14+bob,3,4,'#4a5050');r(4,12+bob,2,4,'#4a5050');}
   if(kind==='black'){r(29,23+bob,3,3,'#d5d0bf');r(28-step,28,3,1,'#d5d0bf');}
   if(dog){
    // Short, broad bat ears and a dark square muzzle distinguish the Frenchie.
    r(25,13+bob,2,2,'#af8c83');r(34,13+bob,2,2,'#af8c83');
    r(25,15+bob,3,4,'#625d58');r(33,15+bob,3,4,'#625d58');r(29,14+bob,2,6,light);
    r(27,18+bob,1.5,1.5,ink);r(34,18+bob,1.5,1.5,ink);r(27,18+bob,.5,.5,'#fff5db');r(34,18+bob,.5,.5,'#fff5db');
    r(29,20+bob,8,3,'#69615a');r(31,20+bob,3,1.5,ink);r(32,22+bob,1,1,ink);r(29,23+bob,2,.5,ink);r(34,23+bob,2,.5,ink);
   }else{
    r(26,12+bob,1,2,'#c18c89');r(33,12+bob,1,2,'#c18c89');
    // The far eye and cheek compress toward the right-facing muzzle.
    r(28,17+bob,1.5,2,faceInk);r(34,16.5+bob,1,1.5,faceInk);r(28,17+bob,.5,.5,light);r(34,16.5+bob,.5,.5,light);
    r(29,20+bob,6,3,light);r(32,20+bob,1.5,1,'#a87576');r(32.5,21+bob,.5,1,ink);r(31,22+bob,1.5,.5,ink);r(33,21.5+bob,1,.5,ink);
    for(const dy of [0,2])r(23,20+bob+dy,5,.5,faceInk);
    for(const dy of [0,1.5])r(35,20+bob+dy,2,.5,faceInk);
   }
   if(pose==='groom'){r(30,21-frame%2,4,4,ink);r(31,21-frame%2,2,3,fur);}
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
   if(state.round!==finishRound){finishRound=state.round;finishEvent=null;}
   const champion=state.runners.find(r=>r.place===1)||state.runners.find(r=>r.id===state.winner);
   if(champion&&!finishEvent){finishEvent={id:champion.id,at:now,live:state.phase==='RACING'};if(animated&&finishEvent.live)onFinish(champion.id);}
   ctx.clearRect(0,0,W,H);ctx.drawImage(back,0,0);
   if(!finishEvent){rect(ctx,finish+2,102,3,216,'#efd49b');for(let y=106;y<318;y+=12)rect(ctx,finish+2,y,3,3,'#bf6757');}
   const elapsed=Math.max(0,now-state.serverTime),fraction=Math.min(1,elapsed/Math.max(1,(state.frameAt??state.serverTime)-state.serverTime));
   for(const r of state.runners){
    const point=window.AVEDDerbyPosition(r,now,state.serverTime,state.frameAt??state.serverTime),progress=point.progress,x=starts+(finish-starts)*progress/100,y=laneY(r.id),pose=point.pose,frame=animated?Math.floor(now/110+r.id)%4:0;
    const boxProgress=point.boxProgress??r.boxProgress??45,bx=starts+(finish-starts)*boxProgress/100;
    const phase=Math.max(0,Math.min(1,point.actionPhase??0)),wave=animated?Math.sin(now/170+r.id):0;
    const pickup=pose==='carry'?Math.max(0,Math.min(1,(phase-.4)/.4)):0,carried=pose==='carry'&&pickup>0;
    if(!carried)box(bx+(pose==='nudge'&&animated?frame%2:0),y+7,pose==='box'||pose==='sniff'||pose==='peek');
    rect(ctx,x-10,y+13,24,3,'#283f4266');
    const hidden=pose==='box'&&phase>.25&&!['frenchie','pig'].includes(r.kind);
    if(!hidden){
     const lift=pose==='jump'?Math.sin(phase*Math.PI)*22:0;
     ctx.save();ctx.translate(Math.round(x),y+13-lift);
     if(pose==='roll'&&animated){ctx.translate(0,-10);ctx.rotate(phase*Math.PI*2);ctx.translate(0,10);}
     if(pose==='stretch')ctx.scale(1.14,.76);
     if(pose==='peek'){ctx.translate(3+wave,0);ctx.rotate(-.07);}
     if(pose==='box')ctx.translate(-12*(1-Math.min(1,phase/.25)),0);
     if(pose==='groom'&&animated)ctx.rotate(wave*.035);
     if(pose==='nudge'||pose==='sniff'||pose==='carry'&&pickup===0){ctx.translate(wave*.75,1);ctx.rotate(.035);}
     if(pose==='sleep'&&animated)ctx.scale(1,1+Math.sin(now/350+r.id)*.025);
     ctx.drawImage(sprite(r.kind,frame,pose==='finished'?'idle':pose),-20,-29,40,33);ctx.restore();
    }
    else{
     // Ears above the rim and a curled tail at the side keep the cat identifiable.
     rect(ctx,bx-6,y-13,3,4,colors[r.id]);rect(ctx,bx+5,y-13,3,4,colors[r.id]);
     rect(ctx,bx-15,y+2,6,2,colors[r.id]);rect(ctx,bx-17,y-2-(animated?frame%2:0),2,5,colors[r.id]);
    }
    if(carried)box(bx,y+7-pickup*10+(animated?frame%2:0),true);
    if(pose==='sniff'||pose==='carry'&&pickup===0){rect(ctx,x+19,y+1+(animated?frame%2:0),2,1,'#e4d3ae');rect(ctx,x+22,y-2,2,1,'#e4d3ae');}
    if(pose==='peek'){
     rect(ctx,bx-7,y-5+(animated?frame%2:0),4,3,'#fff6df');rect(ctx,bx+5,y-5,4,3,'#fff6df');
     rect(ctx,bx+2,y-17-Math.abs(wave)*2,1,3,'#e4d3ae');
    }
    if(pose==='sleep'||hidden)label(ctx,'z Z',x-5,y-23-(animated?frame:0),8,'#ecd6ad');
    if(pose==='groom'&&animated){rect(ctx,x+16,y-6-frame%2,2,2,'#f0d5ac');rect(ctx,x+20,y-9,1,2,'#f0d5ac');}
    if((pose==='push'||pose==='nudge')&&animated){rect(ctx,bx+12+frame,y+12,3,1,'#b2b299');rect(ctx,bx+16,y+10,2,1,'#b2b299');}
    if(pose==='roll'&&animated){rect(ctx,x-16-frame,y+12,3,1,'#c3b5a0');rect(ctx,x+15+frame,y+10,2,2,'#c3b5a0');}
    if(pose==='jump'&&phase>.8&&animated){rect(ctx,x-13,y+12,3,2,'#b2b299');rect(ctx,x+12,y+12,3,2,'#b2b299');}
    if(pose==='run'&&animated&&progress>0&&progress<100){rect(ctx,x-23-frame*2,y+9,3,2,'#b2b299');rect(ctx,x-29-frame,y+12,2,1,'#b2b299');}
    const own=(state.bets||[]).filter(b=>b.runner===r.id);
    if(own.length){rect(ctx,x-17,y+18,34,2,'#e4bf82');label(ctx,own.map(b=>b.market==='first'?'1':'5').join('/'),26,y+13,7,'#e4bf82','center');}
    if(state.order){const rank=state.order.indexOf(r.id)+1;label(ctx,String(rank),548,y+2,13,rank===1?'#f3ca7f':'#d8d8bc','center');}
   }
   if(finishEvent){
    const y=laneY(finishEvent.id),age=Math.max(0,now-finishEvent.at),t=Math.min(1,age/2000);
    // The champion keeps a crown; the ribbon tears only at the actual finish.
    rect(ctx,finish-10,y-34,17,7,'#e6bd68');rect(ctx,finish-11,y-39,4,6,'#ffe49c');rect(ctx,finish-5,y-42,4,9,'#ffe49c');rect(ctx,finish+2,y-39,4,6,'#ffe49c');
    if(animated&&finishEvent.live&&age<2000){
     for(const side of [-1,1])for(let part=0;part<7;part++)rect(ctx,finish+side*(7+t*(35+part*4)),y-18+part*5+t*t*65,5,3,part%2?'#d37d68':'#f2d89e');
     for(let i=0;i<32;i++){const dx=((i*47)%101-50),lift=35+(i*19%55);rect(ctx,finish+dx*t,y-lift*t+80*t*t-12,2+(i%2),3,['#f5d48a','#b8d7bd','#e1947d'][i%3]);}
     label(ctx,'FIRST!',finish-42,y-48-t*10,10,'#ffe49c','center');
    }
   }
   if(celebratedAt&&animated&&now-celebratedAt<2200){const t=(now-celebratedAt)/2200;for(let i=0;i<28;i++){const x=(i*113)%W,y=t*H+(i*37%70)-60;rect(ctx,x,y,2,4,['#e6bd83','#b4cbb0','#d89180'][i%3]);}}
  }
 };
};
