/* Gateway-only decorative effects. Fine GPU grain with a small Canvas fallback. */
(()=>{
 const landing=document.getElementById('landing-view'),logo=document.getElementById('cover-logo-slot');if(!landing||!logo)return;
 logo.insertAdjacentHTML('beforeend',`<svg class="gateway-orbit" viewBox="0 0 788 686" aria-hidden="true"><path id="gateway-orbit-path" class="gateway-orbit-rail" d="M394 8 L780 678 L8 678 Z"/><path class="gateway-orbit-tail" pathLength="1000" d="M394 8 L780 678 L8 678 Z"/><circle class="gateway-orbit-dot" r="4"><animateMotion dur="7s" repeatCount="indefinite" calcMode="paced"><mpath href="#gateway-orbit-path"/></animateMotion></circle></svg>`);
 // A shared, sub-pixel displacement field adds local phosphor motion without moving the layout.
 const filterHost=document.createElementNS('http://www.w3.org/2000/svg','svg');
 filterHost.setAttribute('width','0');filterHost.setAttribute('height','0');filterHost.setAttribute('aria-hidden','true');filterHost.classList.add('gateway-filter-defs');
 filterHost.innerHTML=`<defs><filter id="gateway-phosphor-wave" x="-15%" y="-35%" width="130%" height="170%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".007 .012" numOctaves="1" seed="17" result="field"/><feOffset in="field" result="moving-field"><animate attributeName="dx" values="-18;18;-18" dur="4.8s" repeatCount="indefinite"/><animate attributeName="dy" values="10;-10;10" dur="6.2s" repeatCount="indefinite"/></feOffset><feDisplacementMap in="SourceGraphic" in2="moving-field" scale="4.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
 landing.prepend(filterHost);
 function phosphor(now){const t=now/1000;
  // Shared time keeps the title, all three motto lines and login copy coherent.
  const x=.9*Math.sin(t*.91)+.25*Math.sin(t*2.13),y=1.15*Math.sin(t*.73)+.35*Math.sin(t*1.77);
  const level=1+.07*Math.sin(t*2.65)+.035*Math.sin(t*5.85+Math.sin(t*1.05)*.4)+.02*Math.sin(t*11.95);
  landing.style.setProperty('--phosphor-x',x.toFixed(3)+'px');landing.style.setProperty('--phosphor-y',y.toFixed(3)+'px');landing.style.setProperty('--phosphor-level',level.toFixed(4));
 }
 function resetPhosphor(){landing.style.removeProperty('--phosphor-x');landing.style.removeProperty('--phosphor-y');landing.style.removeProperty('--phosphor-level');}
 const orbit=logo.querySelector('svg.gateway-orbit');let snow=document.createElement('canvas');snow.id='gateway-snow';snow.setAttribute('aria-hidden','true');landing.prepend(snow);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,last=0;
 // Fine, low-amplitude screen-space grain. GPU path has no repeated image tiles.
 let gl=null,paintGrain=null,clearGrain=()=>{};
 const appleTouch=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
 // Keep the same grain on touch Apple devices without a transparent WebGL compositing layer.
 try{if(!appleTouch)gl=snow.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});}catch{}
 if(gl){
  const compile=(type,code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('grain shader');return shader;};
  try{
   const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}');
   const fragment=compile(gl.FRAGMENT_SHADER,`precision highp float;
    uniform float uFrame;uniform float uStrength;
    float grainHash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uFrame*7.13)*43758.5453);}
    void main(){
     float sampleValue=grainHash(floor(gl_FragCoord.xy));
     float softness=exp(-sampleValue*sampleValue/(2.0*0.49*0.49))*0.814;
     gl_FragColor=vec4(vec3(1.0),softness*uStrength);
    }`);
   const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('grain link');gl.useProgram(program);
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   const seed=gl.getUniformLocation(program,'uFrame'),strength=gl.getUniformLocation(program,'uStrength');
   paintGrain=now=>{gl.viewport(0,0,snow.width,snow.height);gl.uniform1f(seed,Math.floor(now/(1000/45))%4096);gl.uniform1f(strength,innerWidth<768?.064:.078);gl.drawArrays(gl.TRIANGLES,0,6);};
   clearGrain=()=>{gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);};
   snow.dataset.grainRenderer='webgl';
   snow.addEventListener('webglcontextlost',()=>{snow.style.display='none';paintGrain=clearGrain=()=>{};});
   gl.deleteShader(vertex);gl.deleteShader(fragment);
  }catch{gl=null;}
 }
 if(!paintGrain){
  // Replace a failed GPU canvas before acquiring a different context type.
  const fallback=snow.cloneNode();snow.replaceWith(fallback);snow=fallback;
  const ctx=snow.getContext('2d');snow.dataset.grainRenderer='canvas';
  const grains=Array.from({length:12},()=>{const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');if(!c||!ctx)return null;const pixels=c.createImageData(128,128);for(let i=0;i<pixels.data.length;i+=4){const n=Math.random();pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=Math.round(Math.exp(-n*n/.4802)*16);}c.putImageData(pixels,0,0);return ctx.createPattern(tile,'repeat');});
  clearGrain=()=>ctx?.clearRect(0,0,snow.width,snow.height);
  paintGrain=now=>{if(!ctx)return;clearGrain();const pattern=grains[Math.floor(now/33)%grains.length];if(!pattern)return;ctx.save();ctx.translate(-(Math.floor(now/33)*37%128),-(Math.floor(now/33)*53%128));ctx.fillStyle=pattern;ctx.fillRect(0,0,snow.width+128,snow.height+128);ctx.restore();};
 }

 function enabled(){return document.body.classList.contains('theme-landing')&&!document.body.classList.contains('effects-off')&&!reduced.matches&&!document.hidden;}
 function snowy(){return enabled()&&!document.body.classList.contains('landing-sphere');}
 function resize(){const r=landing.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),scale=Math.min(dpr,Math.sqrt(2400000/Math.max(1,r.width*r.height)));snow.width=Math.max(1,Math.ceil(r.width*scale));snow.height=Math.max(1,Math.ceil(r.height*scale));}
 function tick(now){
  frame=0;if(!enabled())return;
  const interval=1000/(innerWidth<768?30:45);
  if(now-last>=interval){last=now-(now-last)%interval;phosphor(now);if(snowy())paintGrain(now);}
  frame=requestAnimationFrame(tick);
 }
 function sync(){const on=enabled();for(const svg of [orbit,filterHost]){if(on)svg.unpauseAnimations?.();else svg.pauseAnimations?.();}if(frame)cancelAnimationFrame(frame);frame=0;if(on){last=0;frame=requestAnimationFrame(tick);}else resetPhosphor();if(!snowy())clearGrain();}
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});new ResizeObserver(resize).observe(landing);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);resize();sync();
})();
