/* Native Canvas version of the supplied rotating home / spring / repel system. */
(function(){
  const landing=document.getElementById('landing-view'),logo=document.getElementById('cover-logo-slot');
  if(!landing||!logo)return;
  landing.dataset.spherePattern='ascii';
  try{localStorage.removeItem('aved_sphere_pattern_v1');}catch{}
  const canvas=document.createElement('canvas');canvas.id='landing-sphere-canvas';canvas.setAttribute('aria-hidden','true');landing.prepend(canvas);
  const ctx=canvas.getContext('2d',{alpha:true}),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const count=8000,x=new Float32Array(count),y=new Float32Array(count),vx=new Float32Array(count),vy=new Float32Array(count),sine=new Float32Array(count),cosine=new Float32Array(count),latitude=new Float32Array(count),height=new Float32Array(count);
  for(let i=0;i<count;i++){sine[i]=Math.sin(i);cosine[i]=Math.cos(i);latitude[i]=Math.sin(i*i);height[i]=Math.cos(i*i);}
  let variant='image',angle=0,radius=250,repelRadius=90,centerX=0,centerY=0,frame=0,last=0,painted=0,pointer={active:false,x:0,y:0};
  function resize(){
    const bounds=landing.getBoundingClientRect(),mark=logo.getBoundingClientRect(),mobile=innerWidth<768;
    canvas.width=Math.max(1,Math.ceil(bounds.width));canvas.height=Math.max(1,Math.ceil(bounds.height));
    centerX=mark.left+mark.width/2-bounds.left;centerY=mark.top+mark.height/2-bounds.top;
    radius=mobile?Math.min(160,bounds.width/2-20):Math.min(250,bounds.height*.34);repelRadius=mobile?60:90;
    const a=Math.cos(angle),b=Math.sin(angle);
    for(let i=0;i<count;i++){x[i]=(sine[i]*a+cosine[i]*b)*latitude[i]*radius;y[i]=height[i]*radius;vx[i]=0;vy[i]=0;}
    paint(1,false);
  }
  function active(){return ctx&&variant==='sphere'&&document.body.classList.contains('theme-landing')&&!document.hidden;}
  function paint(step,moving){
    if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=document.body.classList.contains('radix-terminal')?'#eeeeee':'#ffffff';ctx.globalAlpha=.78;
    const a=Math.cos(angle),b=Math.sin(angle),damping=Math.pow(.9,step);
    for(let i=0;i<count;i++){
      if(moving){
        const homeX=(sine[i]*a+cosine[i]*b)*latitude[i]*radius,homeY=height[i]*radius;
        vx[i]+=(homeX-x[i])*.01*step;vy[i]+=(homeY-y[i])*.01*step;
        if(pointer.active){const dx=x[i]-pointer.x,dy=y[i]-pointer.y,d2=dx*dx+dy*dy;if(d2>.1&&d2<repelRadius*repelRadius){const distance=Math.sqrt(d2),force=28*(1-distance/repelRadius)*step/distance;vx[i]+=dx*force;vy[i]+=dy*force;}}
        vx[i]*=damping;vy[i]*=damping;x[i]+=vx[i]*step;y[i]+=vy[i]*step;
      }
      ctx.fillRect(centerX+x[i],centerY+y[i],1.5,1.5);
    }
    if(moving)angle+=.01*step;
  }
  function tick(now){
    frame=0;if(!active()||reduced.matches||document.body.classList.contains('effects-off'))return;
    if(now-painted>=30){const step=Math.min(2,Math.max(.5,(now-last)/16.667));last=now;painted=now;paint(step,true);}
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    if(active()){if(reduced.matches||document.body.classList.contains('effects-off'))paint(1,false);else{last=performance.now();painted=0;frame=requestAnimationFrame(tick);}}
  }
  function choose(value){
    variant=value==='sphere'?'sphere':'image';document.body.classList.toggle('landing-sphere',variant==='sphere');
    resize();sync();
  }
  document.addEventListener('aved-gateway-change',()=>choose(window.AVEDGateway?.selected));
  function point(event){const bounds=canvas.getBoundingClientRect();pointer={active:true,x:event.clientX-bounds.left-centerX,y:event.clientY-bounds.top-centerY};}
  landing.addEventListener('pointermove',point,{passive:true});landing.addEventListener('pointerdown',point,{passive:true});landing.addEventListener('pointerleave',()=>pointer.active=false);landing.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')pointer.active=false;});
  addEventListener('resize',()=>{resize();sync();},{passive:true});document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  new ResizeObserver(()=>{resize();sync();}).observe(landing);
  document.fonts?.ready.then(()=>{resize();sync();});
  choose(window.AVEDGateway?.selected);
})();
