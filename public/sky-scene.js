/* Procedural pixel scenery. This renderer never generates gameplay outcomes. */
window.AVEDSkyScene=function(canvas,labelLayer){
 const skyCache=document.createElement('canvas'),skyContext=skyCache.getContext('2d'),backdrop=canvas.getContext('2d'),terrain=document.createElement('canvas'),runway=document.createElement('canvas'),actors=document.createElement('canvas');
 runway.id='flight-runway-canvas';runway.setAttribute('aria-hidden','true');terrain.id='flight-terrain-canvas';actors.id='flight-actors-canvas';terrain.setAttribute('aria-hidden','true');actors.setAttribute('aria-hidden','true');canvas.after(terrain,runway,actors);
 const terrainContext=terrain.getContext('2d'),runwayContext=runway.getContext('2d'),actorContext=actors.getContext('2d'),images=new Map(),labels=new Map();let c=backdrop,w=0,h=0,terrainNight=null,skyKey=null,visibleLabels=new Set();
 // ResizeObserver supplies dimensions without synchronous layout reads during animation.
 let displayWidth=1,displayHeight=1;
 new ResizeObserver(entries=>{const box=entries[0].contentRect;displayWidth=Math.max(1,box.width);displayHeight=Math.max(1,box.height);}).observe(canvas);
 const ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
 // Functional labels use normal DOM text, independent of the enlarged pixel art.
 function label(key,value,x,y,className='flight-nameplate'){visibleLabels.add(key);let el=labels.get(key);if(!el){el=document.createElement('span');el.className=className;labels.set(key,el);labelLayer.append(el);}if(el.textContent!==value)el.textContent=value;if(el.hidden)el.hidden=false;el.style.transform='translate3d('+(x*displayWidth/w)+'px,'+(y*displayHeight/h)+'px,0) translateX(-50%)';}
 function nameplate(p,x,y){label(p.id,p.alias||'员工',x,y+13);}
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const colors=['#f4c88a','#a5d8c3','#cca8e5','#91c7e0','#f2a094','#c8d78b'];
 function rect(x,y,ww,hh,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(ww),Math.ceil(hh));}
 function text(s,x,y,color='#fff0d2',size=7,align='center'){c.font=`${size}px monospace`;c.textAlign=align;c.fillStyle=color;c.fillText(s,Math.round(x),Math.round(y));}
 function avatar(p,x,y,size){
  rect(x-1,y-1,size+2,size+2,'#172d3d');const color=colors[p.id%colors.length];rect(x,y,size,size,color);
  if(p.avatar){let im=images.get(p.avatar);if(!im){im=new Image();im.src=p.avatar;images.set(p.avatar,im);}if(im.complete&&im.naturalWidth)c.drawImage(im,Math.round(x),Math.round(y),size,size);else text('NOINFO',x+size/2,y+size*.62,'#243645',Math.max(2,size*.19));}
  else{text('NOINFO',x+size/2,y+size*.62,'#243645',Math.max(2,size*.19));}
 }
 function cloud(x,y,size,alpha){c.save();c.globalAlpha=alpha;rect(x,y+4,size,6,'#fff0df');rect(x+size*.2,y,size*.35,13,'#fff0df');rect(x+size*.58,y+2,size*.22,9,'#fff0df');rect(x+4,y+10,size-8,3,'#dac9d6');c.restore();}
 function helicopter(x,y,scale,passengers,time,animated){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
  rect(42,28,154,56,'#152e3b');rect(38,38,172,37,'#152e3b');rect(46,25,120,3,'#152e3b');
  rect(48,30,123,46,'#d6dfbf');rect(48,72,141,8,'#829e90');rect(44,36,7,36,'#8aa79a');
  rect(169,35,23,34,'#e4dfb7');rect(192,44,10,23,'#e4dfb7');rect(174,39,17,23,'#3f6a7b');rect(191,46,8,16,'#3f6a7b');rect(176,41,5,17,'#87a8ac');
  rect(7,47,37,10,'#152e3b');rect(10,48,34,6,'#9db3a1');rect(5,33,9,24,'#152e3b');rect(7,35,5,14,'#d6dfbf');
  rect(99,12,5,15,'#172f3b');rect(79,21,46,6,'#536e67');rect(99,8,6,4,'#ebcf8c');
  const rotor=animated?Math.sin(time/55):1;rect(102-96*Math.abs(rotor),10,192*Math.abs(rotor)+3,3,'#eff0cc');rect(99,6,6,11,'#304c52');
  rect(52,81,5,10,'#172f3b');rect(177,81,5,10,'#172f3b');rect(39,91,155,4,'#172f3b');rect(35,87,5,7,'#172f3b');
  rect(48,66,10,4,'#b55d4d');rect(194,67,4,4,'#e2a976');
  const seats=8;for(let i=0;i<seats;i++){const sx=64+(i%4)*24,sy=34+Math.floor(i/4)*20;rect(sx-2,sy-1,20,19,'#69867d');rect(sx,sy,16,16,'#354d51');if(passengers[i])avatar(passengers[i],sx+1,sy+1,14);else{text('+',sx+8,sy+12,'#8ba39b',12);}}
  text('A V E D',120,85,'#102e38',6);
  c.restore();
 }
 function person(p,x,y,chute,self,time,animated,grounded=false){
  c.save();c.translate(Math.round(x),y);const color=colors[p.id%colors.length];
  if(chute&&!grounded){
   c.save();const opening=animated?ease((time-p.settledAt)/450):1;c.translate(0,-7);c.scale(.25+.75*opening,.18+.82*opening);c.translate(0,7);
   rect(-19,-32,38,7,'#18333e');rect(-15,-38,30,7,'#18333e');rect(-9,-42,18,5,'#18333e');
   rect(-17,-32,34,5,color);rect(-13,-37,26,6,color);rect(-8,-40,16,5,color);rect(-4,-39,8,12,'#f7e8bb');rect(-16,-26,8,2,'#e7ddc5');rect(8,-26,8,2,'#e7ddc5');
   c.strokeStyle='#e9ddc6';c.lineWidth=1;c.beginPath();c.moveTo(-17,-25);c.lineTo(-3,-7);c.moveTo(17,-25);c.lineTo(3,-7);c.moveTo(-7,-25);c.lineTo(-1,-7);c.moveTo(7,-25);c.lineTo(1,-7);c.stroke();c.restore();
  }
  avatar(p,-8,-8,16);
  if(self){c.strokeStyle='#ffcd7f';c.strokeRect(-10,-10,20,20);label('ui:self','▼ YOU',x,y+(chute&&!grounded?-56:-25),'flight-scene-label flight-scene-label-self');}
  nameplate(p,x,y);
  c.restore();
 }
 function ground(t){
  const top=h-28;rect(0,top,w,28,'#162c35');rect(0,top,w,3,'#b0ad89');rect(0,top+3,w,5,'#50615a');
  for(let i=0;i<w;i+=17){rect(i,top+7,10,2,'#334e50');rect(i+8,top+19,5,3,'#294348');}
  for(let i=0;i<8;i++){const x=34+i*(w-35)/8;rect(x,top-2,3,3,'#f2c37e');}
  rect(w*.54,top+11,w*.2,1,'#c5c39a');text('A.V.E.D. / LZ',w*.64,top+23,'#8eab9d',5);
 }
 function paint(state,now,depth,animated,selfId){
  const cw=Math.max(1,Math.round(displayWidth/2)),ch=Math.max(1,Math.round(displayHeight/2));
  if(cw!==w||ch!==h){w=cw;h=ch;for(const layer of [canvas,terrain,runway,actors,skyCache]){layer.width=w;layer.height=h;layer.getContext('2d').imageSmoothingEnabled=false;}terrainNight=null;skyKey=null;}
  c=backdrop;actorContext.clearRect(0,0,w,h);
  visibleLabels.clear();
  const t=animated?now:0,board=state.phase==='BOARDING',landing=state.phase==='LANDING',elapsed=landing?Math.max(0,now-state.revealedAt):0,air=window.AVEDSkyScene.airMotion(state,now);
  const descent=board?0:clamp((depth-100)/1000),dark=descent;
  const rgb=(a,b)=>'rgb('+a.map((v,i)=>Math.round(v)).join(',')+')';
  // One shared Beijing-time palette per flight, independent of device clocks.
  const hour=new Date(state.departAt+8*3600000).getUTCHours(),night=hour<5||hour>=20;
  const palette=night?[[21,31,65],[57,58,96],[113,91,119]]:hour<8?[[105,114,165],[207,158,176],[255,211,166]]:hour<17?[[74,144,192],[140,192,207],[225,220,190]]:[[83,88,149],[185,124,153],[250,175,118]];
  // Rasterize the fixed sky once per palette/size; moving layers only copy the cached bitmap.
  const key=palette.flat().join(',');if(skyKey!==key){skyKey=key;c=skyContext;
  const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,rgb(palette[0],[19,31,49]));g.addColorStop(.6,rgb(palette[1],[48,65,79]));g.addColorStop(1,rgb(palette[2],[110,110,105]));c.fillStyle=g;c.fillRect(0,0,w,h);
  if(night)for(let i=0;i<24;i++){const sx=38+i*47%Math.max(20,w-40),sy=12+i*31%Math.max(20,h*.65);rect(sx,sy,i%5===0?2:1,1,i%3?'#c2d7e6':'#f8e1b3');}
  const orbX=w-22,orbY=24,radius=night?8:9,halo=c.createRadialGradient(orbX,orbY,3,orbX,orbY,30);
  halo.addColorStop(0,night?'#e3eeff70':'#ffe6ac88');halo.addColorStop(.45,night?'#bfcefb28':'#ffd09030');halo.addColorStop(1,'#ffffff00');c.fillStyle=halo;c.fillRect(orbX-30,orbY-30,60,60);
  // Stepped circular sprite with stable surface shading, rather than a solid square.
  for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++)if(ox*ox+oy*oy<=radius*radius){
   const edge=ox*ox+oy*oy>(radius-1)*(radius-1),shade=ox+oy;
   rect(orbX+ox,orbY+oy,1,1,night?(edge?'#aebcd2':shade>4?'#c5cfdf':'#eef0e4'):(edge?'#eab978':shade>5?'#f5cd8a':'#fff0bc'));
  }
  if(night){rect(orbX-4,orbY-3,3,2,'#bbc6d6');rect(orbX+2,orbY+2,3,3,'#aebed2');rect(orbX-3,orbY+4,2,1,'#c4ced9');}
  else{rect(orbX-5,orbY-4,5,1,'#fff8d7');rect(orbX-6,orbY-3,2,3,'#fff8d7');}
  }
  c=backdrop;c.drawImage(skyCache,0,0);c.fillStyle='rgba(18,36,58,'+(dark*.45)+')';c.fillRect(0,0,w,h);
  // Scenery is visual only; wind tracks the falling camera, never the hidden safety line.
  for(let i=0;i<12;i++){const x=35+((i*53)%Math.max(20,w-35)),size=18+i%4*8,travel=animated?(board?now/5000:state.departAt/5000+air.travel*.12):0;const y=((i*47-travel)%(h+55)+h+55)%(h+55)-20;cloud(x,y,size,.14+(i%3)*.08);}
  if(!board){c.globalAlpha=.18*ease((now-state.departAt)/1800)*(landing?1-ease(elapsed/800):1);for(let i=0;i<13;i++){const x=40+i*31%(w-45),y=((i*61-(animated?air.travel:0))%h+h)%h;rect(x,y,1,7+i%3*5+Math.min(18,air.speed/18),'#f2e3d8');}c.globalAlpha=1;}
  // Fixed-size cached city + runway. Move the whole plane; never grow buildings.
  if(terrainNight!==night){
   c=terrainContext;c.clearRect(0,0,w,h);terrainNight=night;
   for(let layer=0;layer<3;layer++){
    const base=h-28+layer*5;let x=-8,index=0;
    while(x<w){const seed=index*37+layer*71,bw=12+(seed%5)*5,bh=24+(seed*13%62),roof=seed%4,top=base-bh;
     rect(x,top,bw,bh+32,layer===0?'#637984':layer===1?'#3e5969':'#243e50');rect(x+bw-3,top,3,bh+32,layer===0?'#516977':'#193344');
     if(roof===0){rect(x+3,top-6,bw-6,6,'#344c60');rect(x+bw/2,top-14,1,8,'#819394');rect(x+bw/2-1,top-15,3,2,'#e9ab76');}
     if(roof===1){rect(x+4,top-4,bw-8,4,'#496370');rect(x+6,top-8,6,4,'#536c76');}
     if(roof===2){rect(x,top-2,bw,2,'#819294');rect(x+bw-7,top-8,3,6,'#536c76');}
     // Window identity is building/row/column, independent of screen coordinates.
     for(let row=0;5+row*7<bh-2;row++)for(let col=0;3+col*6<bw-4;col++){const lit=(col*17+row*7+seed)%9<(night?6:2);rect(x+3+col*6,top+5+row*7,2,3,lit?(seed%2?'#ddbd7e':'#94c1bf'):'#142d4166');}
     if(layer===2&&seed%3===0){rect(x+2,top+12,bw-6,4,'#405c6b');rect(x+4,top+13,Math.max(3,bw-11),1,'#e2ae7d');}
     x+=bw+3+(seed%4);index++;
    }
   }
   c=runwayContext;c.clearRect(0,0,w,h);ground();
  }
  // The ground appears only when the server reveals the landing phase.
  const approach=landing?ease(elapsed/650):0,offset=110*(1-approach);
  terrain.style.transform='translate3d(0,'+(offset*displayHeight/h)+'px,0)';terrain.style.opacity=String(approach*.9);
  runway.style.transform='translate3d(0,'+(offset*displayHeight/h)+'px,0)';runway.style.opacity=String(approach);
  c=actorContext;
  const selected=[...state.passengers];if(selected.length>24){const own=selected.findIndex(p=>p.id===selfId);if(own>=24)[selected[0],selected[own]]=[selected[own],selected[0]];}
  if(board){
   const s=Math.min(1.1,(w-38)/220),x=(w-220*s)/2+14,y=h*.52-50*s+(animated?Math.sin(t/700)*2:0);helicopter(x,y,s,state.passengers.slice(0,8),t,animated);
   label('ui:passengers',selected.length+' PASSENGERS / 8 VISIBLE SEATS',w*.56,h*.89-7,'flight-scene-label flight-scene-label-manifest');
  }else{
   const departElapsed=now-state.departAt;
   const heliScale=Math.min(1.1,(w-38)/220),heliX=(w-220*heliScale)/2+14,heliY=h*.52-50*heliScale;
   if(departElapsed<2400){const k=ease(departElapsed/2400);helicopter(heliX+k*30,heliY-k*(h*.75+70),heliScale,departElapsed<180?state.passengers.slice(0,8):[],t,animated);}
   const shown=selected.slice(0,24),columns=Math.min(4,Math.max(2,shown.length)),rows=Math.ceil(shown.length/columns);
   for(let i=0;i<shown.length;i++){
    const p=shown[i],x=48+(i%columns+.5)*(w-53)/columns,row=Math.floor(i/columns),startY=h*.60+(row-(rows-1)/2)*Math.min(43,(h*.30)/Math.max(1,rows-1));
    let y=startY,actorX=x,chute=p.status==='landed',grounded=false;
    if(chute){const entry=ease((p.settledAt-state.departAt-180)/1600),seatX=heliX+(72+(i%4)*24)*heliScale,seatY=heliY+(42+Math.floor(i%8/4)*20)*heliScale,openY=window.AVEDSkyScene.freefallMotion(state,p.settledAt,mix(seatY,startY,entry),h).y;actorX=mix(seatX,x,entry);
     const descent=window.AVEDSkyScene.passengerMotion(state,p,now,openY,h);y=descent.y;grounded=descent.grounded;
     person(p,actorX,y,true,p.id===selfId,t,animated,grounded);
    }else if(p.status==='crashed'){
     const age=now-p.settledAt,k=clamp(age/650),entry=ease((p.settledAt-state.departAt-180)/1600),seatX=heliX+(72+(i%4)*24)*heliScale,seatY=heliY+(42+Math.floor(i%8/4)*20)*heliScale,from=window.AVEDSkyScene.freefallMotion(state,p.settledAt,mix(seatY,startY,entry),h).y;actorX=mix(seatX,x,entry);y=mix(from,h-36,k*k);
     if(k<1){rect(actorX-1,y-34,2,18,'#edab7e');person(p,actorX,y,false,p.id===selfId,t,animated);}
     else if(age<1750){for(let n=0;n<7;n++){const spread=Math.max(0,(age-650)/1000);rect(actorX+(n-3)*spread*7,h-30-Math.sin(n+1)*spread*10,3,3,n%2?'#dfae87':'#a08170');}label('ui:lost:'+p.id,'LOST',actorX,h-45,'flight-scene-label flight-scene-label-lost');}
    }else if(p.status==='aboard'){const entering=ease((departElapsed-180)/1600),seatX=heliX+(72+(i%4)*24)*heliScale,seatY=heliY+(42+Math.floor(i%8/4)*20)*heliScale;const falling=window.AVEDSkyScene.freefallMotion(state,now,mix(seatY,startY,entering),h);if(animated){const seconds=Math.max(0,departElapsed/1000);for(let n=0;n<3;n++)rect(x-11+n*11,falling.y-12-((air.travel+n*13)%38),1,7+Math.min(18,seconds),'#f4d4a488');}person(p,mix(seatX,x,entering),falling.y,false,p.id===selfId,t,animated);}
   }
   if(selected.length>24)label('ui:more','+'+(selected.length-24)+' / SEE MANIFEST',w*.6,h-16,'flight-scene-label');
  }
 }
 return {preview(){paint({phase:'BOARDING',departAt:Date.now(),passengers:[]},Date.now(),100,false,0);},paint:(...args)=>{paint(...args);for(const [id,el] of labels){const hidden=!visibleLabels.has(id);if(el.hidden!==hidden)el.hidden=hidden;}},reset(){if(images.size>128)images.clear();for(const el of labels.values())el.remove();labels.clear();}};
};

// Camera-space motion only: these helpers never decide safety, depth or payouts.
window.AVEDSkyScene.canopyMotion=function(age,originY,height){
 const seconds=Math.max(0,age)/1000,speed=height*.16,tau=.45;
 const y=originY-speed*(seconds-tau*(1-Math.exp(-seconds/tau)));
 return {y:Math.max(-64,y),velocity:y<=-64?0:-speed*(1-Math.exp(-seconds/tau))};
};
window.AVEDSkyScene.passengerMotion=function(state,p,now,originY,height){
 const scene=window.AVEDSkyScene;
 if(state.phase!=='LANDING'||now<state.revealedAt)return {...scene.canopyMotion(now-p.settledAt,originY,height),grounded:false};
 const elapsed=Math.max(0,now-state.revealedAt),handoff=900,top=-64,ground=height-37;
 if(elapsed<handoff){
  // Continue from the exact reveal position and velocity while the camera meets the ground.
  // Change direction above the viewport, never with a visible mid-air pause.
  const atReveal=scene.canopyMotion(state.revealedAt-p.settledAt,originY,height),u=elapsed/handoff;
  const tangent=Math.max(3*(top-atReveal.y),atReveal.velocity*handoff/1000);
  return {y:(2*u*u*u-3*u*u+1)*atReveal.y+(u*u*u-2*u*u+u)*tangent+(-2*u*u*u+3*u*u)*top,grounded:false};
 }
 const k=Math.max(0,Math.min(1,(elapsed-handoff)/(scene.landingDelay(state,p)-handoff)));
 return {y:top+(ground-top)*k,grounded:k>=1};
};
window.AVEDSkyScene.freefallMotion=function(state,now,originY,height){return {y:originY};};
window.AVEDSkyScene.landingDelay=function(state,p){
 // Earlier canopies have further to glide; all arrivals fit the server's landing window.
 return Math.ceil(8100+3000*Math.max(0,Math.min(1,(state.revealedAt-p.settledAt)/20000)));
};
window.AVEDSkyScene.airMotion=function(state,now){
 if(state.phase==='BOARDING')return {travel:0,speed:0};
 const at=time=>{
  const seconds=Math.max(0,(time-state.departAt)/1000),accelerating=Math.min(14,seconds);
  return {travel:45*accelerating+9*accelerating*accelerating+297*Math.max(0,seconds-14),speed:45+18*accelerating};
 };
 if(state.phase!=='LANDING'||now<state.revealedAt)return at(now);
 const reveal=at(state.revealedAt),seconds=Math.max(0,(now-state.revealedAt)/1000),decay=Math.exp(-seconds/.28);
 return {travel:reveal.travel+reveal.speed*.28*(1-decay),speed:reveal.speed*decay};
};
