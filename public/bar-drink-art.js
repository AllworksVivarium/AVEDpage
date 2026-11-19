/* Keep the original pixel artwork; separate the can, glass, liquid and straw at render time. */
window.AVEDBarDrinkArt=(()=>{
 const body='M250 140H440V150H450V170H440V230H430V360H420V400H230V360H220V230H210V170H200V150H250Z';
 const inside='M220 170H420V230H410V350H400V370H390V380H250V370H240V350H230V230H220Z';
 const straw='M320 0H520V170H320ZM370 170h20v10h-20ZM370 180h20v10h-20ZM360 190h30v10h-30ZM360 200h20v20h-20ZM350 220h30v10h-30ZM350 230h20v20h-20ZM340 250h30v10h-30ZM340 260h20v20h-20ZM330 280h20v30h-20ZM330 310h10v10h-10Z';
 const ratio=serving=>Math.max(0,Math.min(1,serving.volumeMl>0?serving.remainingMl/serving.volumeMl:1));
 const level=fill=>fill<=0?100:(130+(1-fill)*210)/360*100;
 const colors={'lemon-cocktail':'#ffd46d','lemon-fizz':'#e9d890','grape-fizz':'#b8a0bd','apple-fizz':'#c4d891','amber-brew':'#f1d58f','silver-brew':'#efdaa4','red-brew':'#edc580','gold-brew':'#efce7d','blue-brew':'#e8d69b','green-bottle':'#e2d79d','lemon-highball':'#e8d4a3','grape-highball':'#c6a8c6','amber-shot':'#d5a663','scarlet-shot':'#ce8d7f','lime-shot':'#b8d18e','azure-shot':'#9ac8dc','amethyst-shot':'#c5a4da','mineral-water':'#d3e3dd'};
 const color=id=>typeof id==='object'&&id? id.liquidColor||colors[id.id]||'#ddc9a4':colors[id]||'#ddc9a4';
 const canPour=drink=>drink?.pourable??!!(drink&&drink.id!=='energy-jelly'&&drink.id!=='lemon-cocktail'&&!drink.id.endsWith('-shot'));
 const imageFor=(drink,serving)=>drink?.images?.length?drink.images[(Number.isSafeInteger(serving?.id)&&serving.id>=0?serving.id:0)%drink.images.length]:drink?.image;
 const softContainer=drink=>['pouch','bag','carton'].includes(drink?.container);
 const clinkSound=cups=>cups.length===2&&cups.every(cup=>cup.dataset.clinkSound!=='muted');
 function nativeSprite(drink,serving,m,esc,{clink=true,sip=true}={}){
  const shot=drink.id.endsWith('-shot'),fill=ratio(serving),style=`width:${m.fullWidth}px;height:${m.fullHeight}px;left:${m.x}px;top:${m.y}px`;
  return `<span class="bar-drink-sprite" ${clink?'data-drink-motion':''} ${sip?'data-sip-motion':''} data-vessel="${softContainer(drink)?'pouch':drink.container||'native'}" data-clink-sound="${softContainer(drink)?'muted':'glass'}" data-order-id="${serving.id}" data-fill-ratio="${fill}" data-splash-color="${color(drink)}" style="width:${m.width}px;height:${m.height}px"><img src="${esc(shot?'/assets/bar/onyx-shot.png':drink.image)}" style="${style}" alt="">${shot&&fill>0?`<img src="${esc(drink.image)}" style="${style};clip-path:inset(${15+(1-fill)*48}% 0 0 0)" alt="" aria-hidden="true">`:''}</span>`;
 }
 function lemon(drink,serving,m,esc,owner,alt){
  if(drink.id!=='lemon-cocktail')return '';
  const id='bar-lemon-'+owner,fill=ratio(serving),source=`<image href="${esc(drink.image)}" width="520" height="400"/>`;
  const svg=(contents,view='190 40 330 360')=>`<svg viewBox="${view}" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${contents}</svg>`;
  const defs=`<defs><clipPath id="${id}-inside"><path d="${inside}"/></clipPath><clipPath id="${id}-straw"><path d="${straw}"/></clipPath><mask id="${id}-frame" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="400"><path d="${body}" fill="white"/><path d="${inside}" fill="black"/></mask><mask id="${id}-cans" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="400"><rect width="270" height="400" fill="white"/><path d="${body}" fill="black"/></mask><clipPath id="${id}-repair"><path d="M200 140H260V400H200Z"/></clipPath></defs>`;
  // Mirror a narrow unobscured strip behind the glass, so lifting it does not leave a cut-off can.
  const cans=svg(`${defs}<g clip-path="url(#${id}-repair)"><g transform="translate(390 0) scale(-1 1)">${source}</g><path d="M250 140h10v240h-10Z" fill="#000"/></g><g mask="url(#${id}-cans)">${source}</g>`,'0 0 520 400');
  const glass=svg(`<path d="${inside}" fill="#e3c7ac" fill-opacity=".13"/><g mask="url(#${id}-frame)">${source}</g>`);
  const liquid=svg(`<g clip-path="url(#${id}-inside)">${source}</g>`);
  const strawArt=svg(`<g clip-path="url(#${id}-straw)">${source}</g>`);
  return `<span class="bar-drink-sprite bar-drink-layered" style="width:${m.width}px;height:${m.height}px" role="img" aria-label="${esc(alt)}">${cans}<span class="bar-drink-lift" data-drink-motion data-order-id="${serving.id}" data-fill-ratio="${fill}" data-splash-color="${color(drink)}" data-rim=".306" data-rim-x=".409" data-rim-width=".758" style="left:${m.width*190/520}px;top:${m.height*.1}px;width:${m.width*330/520}px;height:${m.height*.9}px">${glass}<span class="bar-drink-liquid" style="clip-path:inset(${level(fill)}% 0 0 0)">${liquid}</span>${strawArt}</span></span>`;
 }
 const waterInside='M60 70H100V80H110V100H120V120H130V140H140V270H130V300H140V330H150V400H140V420H130V430H30V420H20V410H10V340H20V300H30V270H20V140H30V120H40V100H50V80H60Z';
 const clipLevel=(cup,fill)=>fill<=0?100:cup.dataset.levelTop?Number(cup.dataset.levelTop)+(1-fill)*(Number(cup.dataset.levelBottom)-Number(cup.dataset.levelTop)):level(fill);
 function water(drink,serving,m,esc,owner,alt,{clink=true,sip=true}={}) {
  const id='bar-water-'+owner,fill=ratio(serving),source=`<image href="${esc(drink.image)}" width="153" height="451"/>`;
  const svg=body=>`<svg viewBox="0 0 153 451" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
  const defs=`<defs><clipPath id="${id}-inside"><path d="${waterInside}"/></clipPath><mask id="${id}-shell" maskUnits="userSpaceOnUse" x="0" y="0" width="153" height="451"><rect width="153" height="451" fill="white"/><path d="${waterInside}" fill="black"/></mask><clipPath id="${id}-label"><path d="M10 150H140V220H10Z"/></clipPath></defs>`;
  return `<span class="bar-drink-sprite bar-drink-layered bar-drink-lift" ${clink?'data-drink-motion':''} ${sip?'data-sip-motion':''} data-vessel="bottle" data-order-id="${serving.id}" data-fill-ratio="${fill}" data-level-top="18" data-level-bottom="95" data-splash-color="${color(drink)}" style="position:relative;width:${m.width}px;height:${m.height}px" role="img" aria-label="${esc(alt)}">${svg(defs+`<path d="${waterInside}" fill="#d6e6df" fill-opacity=".10"/><g mask="url(#${id}-shell)">${source}</g>`)}<span class="bar-drink-liquid" style="clip-path:inset(${fill<=0?100:18+(1-fill)*77}% 0 0 0)">${svg(`<g clip-path="url(#${id}-inside)">${source}</g>`)}</span>${svg(`<g clip-path="url(#${id}-label)">${source}</g><path d="M20 350H70V360H20ZM30 390H60V400H30ZM40 100H50V130H40Z" fill="#fff" fill-opacity=".30"/>`)}</span>`;
 }
 function cupMetrics(glassId,unit){const mug=glassId==='beer-mug',height=unit*(mug?1:.85);return {height,width:height*(mug?48/54:32/48)};}
 function cupFill(glassId,serving){
  const volume=Number(serving?.volumeMl)||0,full=glassId==='beer-mug'?.9:.96;
  // Cup art adapts to the original serving, so partial drinks never refill visually.
  return volume>0?Math.max(0,Math.min(1,(serving?.glassMl||0)/volume))*full:0;
 }
 function cupArt(glassId,fill,ink,esc,owner,order,{sip=false,clink=true,height=48,drinkId='',withIce=false,withFoam=false}={}) {
  const mug=glassId==='beer-mug',h=mug?54:48,w=mug?48:32,id='bar-cup-'+owner,width=height*w/h,top=mug?12:8,bottom=88;
  const shape=mug?'M4 6H32V44H30V46H6V44H4Z':'M4 6H28V38H26V42H6V38H4Z';
  const svg=body=>`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
  const foam=mug&&fill>0&&(withFoam||/-brew$/.test(drinkId)||drinkId==='green-bottle')?svg(`<g class="bar-drink-foam" style="transform:translateY(${(top+(1-fill)*(bottom-top))*h/100}px)"><path d="M4 0H32V2H30V4H22V2H16V4H8V2H4Z" fill="#f2e6c7" fill-opacity=".88"/><path d="M8 0H14V2H8ZM22 0H28V2H22Z" fill="#fff5df" fill-opacity=".8"/></g>`):'';
  const ice=fill>0&&(withIce||drinkId==='mineral-water'||/-fizz$|-highball$/.test(drinkId))?svg(`<defs><clipPath id="${id}-ice-inside"><path d="${shape}"/></clipPath></defs><g clip-path="url(#${id}-ice-inside)"><g class="bar-drink-ice" style="transform:translateY(${(top+(1-fill)*(bottom-top))*h/100}px)"><path d="M8 2H14V4H16V10H10V8H8ZM20 6H26V8H28V14H22V12H20Z" fill="#e7eee8" fill-opacity=".4"/><path d="M8 2H14V4H10V8H8ZM20 6H26V8H22V12H20Z" fill="#fff7e3" fill-opacity=".66"/><path d="M12 8H16V10H12ZM24 12H28V14H24Z" fill="#a3bfbd" fill-opacity=".3"/></g></g>`):'';
  return `<span class="bar-drink-lift bar-separate-cup" data-vessel="glass" ${clink?'data-drink-motion':''} ${sip?'data-sip-motion':''} data-order-id="${order||'empty'}" data-fill-ratio="${fill}" data-level-top="${top}" data-level-bottom="${bottom}" data-rim=".06" data-rim-x="${mug?.375:.5}" data-rim-width="${mug?.58:.82}" data-splash-color="${ink}" style="width:${width}px;height:${height}px">${svg(`<path d="${shape}" fill="#d9e4db" fill-opacity=".05"/>`)}<span class="bar-drink-liquid" style="clip-path:inset(${fill<=0?100:top+(1-fill)*(bottom-top)}% 0 0 0)">${svg(`<defs><clipPath id="${id}-inside"><path d="${shape}"/></clipPath></defs><g clip-path="url(#${id}-inside)"><rect x="4" y="4" width="${mug?28:24}" height="${h-8}" fill="${ink}" fill-opacity="${ink===color('mineral-water')?'.15':'.58'}"/><path d="M6 6H26V8H6ZM6 12H10V14H6ZM22 16H24V18H22Z" fill="#f3e3ba" fill-opacity=".22"/></g>`)}</span>${foam}${ice}${svg(`<image href="/assets/bar/glass-${mug?'beer-mug':'highball'}.svg" width="${w}" height="${h}"/>`)}</span>`;
 }
 function pixelContainer(drink,serving,m,esc,owner,alt,{clink=true,sip=true}={}){
  const art=drink.pixelArt,box=drink.contentBox||[0,0,drink.width,drink.height],id='bar-pixel-'+owner,fill=ratio(serving),ink=color(drink),source=`<image href="${esc(drink.image)}" width="${drink.width}" height="${drink.height}"/>`,top=(art.top/100*drink.height-box[1])/box[3]*100,bottom=(art.bottom/100*drink.height-box[1])/box[3]*100;
  const svg=body=>`<svg viewBox="${box.join(' ')}" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
  const defs=`<defs><clipPath id="${id}-inside"><path d="${art.inside}"/></clipPath><mask id="${id}-shell" maskUnits="userSpaceOnUse" x="0" y="0" width="${drink.width}" height="${drink.height}"><rect width="${drink.width}" height="${drink.height}" fill="white"/><path d="${art.inside}" fill="black"/></mask>${art.details?`<clipPath id="${id}-details"><path d="${art.details}"/></clipPath>`:''}</defs>`;
  return `<span class="bar-drink-sprite bar-drink-layered bar-drink-lift" ${clink?'data-drink-motion':''} ${sip?'data-sip-motion':''} data-vessel="${canPour(drink)?'bottle':'native'}" data-order-id="${serving.id}" data-fill-ratio="${fill}" data-level-top="${top}" data-level-bottom="${bottom}" data-splash-color="${ink}" style="position:relative;width:${m.width}px;height:${m.height}px" role="img" aria-label="${esc(alt)}">${svg(defs+`<path d="${art.inside}" fill="#d6e6df" fill-opacity=".10"/><g mask="url(#${id}-shell)">${source}</g>`)}<span class="bar-drink-liquid" style="clip-path:inset(${fill<=0?100:top+(1-fill)*(bottom-top)}% 0 0 0)">${svg(`<g clip-path="url(#${id}-inside)">${source}</g>`)}</span>${art.details?svg(`<g clip-path="url(#${id}-details)">${source}</g>`):''}</span>`;
 }
 function render(drink,serving,m,esc,owner,alt,{glassId=null,unit=80,compact=false}={}) {
  if(compact&&drink&&glassId&&(!canPour(drink)||!(serving?.glassMl>0)))return render(drink,serving,m,esc,owner,alt,{unit});
  if(!glassId)return drink?.pixelArt?pixelContainer(drink,serving,m,esc,owner,alt):drink?.id==='mineral-water'?water(drink,serving,m,esc,owner,alt):drink?.id==='lemon-cocktail'?lemon(drink,serving,m,esc,owner,alt):drink?`<span role="img" aria-label="${esc(alt)}">${nativeSprite(drink,serving,m,esc)}</span>`:'';
  const showBottle=!!drink&&!compact,fixed=drink&&!canPour(drink),{height,width}=cupMetrics(glassId,unit),left=showBottle?m.width+(fixed?12:8):0,wholeWidth=showBottle?Math.max(m.width,left+width):width,wholeHeight=Math.max(showBottle?m.height:0,height),fill=fixed?0:cupFill(glassId,serving),fromGlass=!fixed&&serving?.drinkFrom==='glass';
  const bottleServing=serving?{...serving,remainingMl:serving.bottleMl??serving.remainingMl}:null;
  let bottle='';
  if(drink?.pixelArt)bottle=pixelContainer(drink,bottleServing,m,esc,owner,alt,{clink:fixed,sip:!fromGlass});
  else if(drink?.id==='mineral-water')bottle=water(drink,bottleServing,m,esc,owner,alt,{clink:false,sip:!fromGlass});
  else if(drink?.id==='lemon-cocktail')bottle=lemon(drink,bottleServing,m,esc,owner,alt).replace('data-drink-motion','data-drink-motion data-sip-motion');
  else if(drink)bottle=nativeSprite(drink,bottleServing,m,esc,{clink:fixed,sip:!fromGlass});
  // Put the two transparent rows below the cup base beneath the tabletop anchor.
  const foot=height*2/(glassId==='beer-mug'?54:48);
  return `<span class="bar-drink-sprite bar-drink-layered bar-poured-serving" style="width:${wholeWidth}px;height:${wholeHeight}px" role="img" aria-label="${esc(alt)}">${showBottle?`<span class="bar-source-container" style="width:${m.width}px;height:${m.height}px">${bottle}</span>`:''}<span class="bar-cup-position" style="left:${left}px;width:${width}px;height:${height}px;bottom:${-foot}px">${cupArt(glassId,fill,color(drink||'mineral-water'),esc,owner,serving?.id,{sip:fromGlass,clink:!fixed,height,drinkId:drink?.id,withIce:drink?.ice,withFoam:['brew','bottled'].includes(drink?.menuGroup?.id)})}</span></span>`;
 }
 function settle(root,previous){
  if(document.hidden||document.body.classList.contains('effects-off')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const cup of root.querySelectorAll('.bar-drink-lift')){
   const old=previous.get(cup.closest('[data-glass-owner]').dataset.glassOwner+':'+(cup.dataset.vessel||'native')),fill=Number(cup.dataset.fillRatio);
   if(!old||old.order!==cup.dataset.orderId||old.fill===fill)continue;
   const timing={duration:fill>old.fill?700:400,delay:fill>old.fill?400:500,fill:'backwards',easing:'steps(6,end)'};
   cup.querySelector('.bar-drink-liquid').animate([{clipPath:`inset(${clipLevel(cup,old.fill)}% 0 0 0)`},{clipPath:`inset(${clipLevel(cup,fill)}% 0 0 0)`}],timing);
   for(const floating of cup.querySelectorAll('.bar-drink-foam,.bar-drink-ice')){const h=floating.ownerSVGElement.viewBox.baseVal.height;floating.animate([{transform:`translateY(${clipLevel(cup,old.fill)*h/100}px)`},{transform:`translateY(${clipLevel(cup,fill)*h/100}px)`}],timing);}
  }
 }
 function splash(root,cups){
  if(root.hidden||document.hidden||document.body.classList.contains('effects-off')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=root.querySelector('[data-bar-glasses]'),bounds=layer.getBoundingClientRect(),sx=bounds.width/layer.clientWidth||1,sy=bounds.height/layer.clientHeight||1,visible=cups.filter(cup=>cup.isConnected&&cup.dataset.vessel!=='pouch'),boxes=visible.map(cup=>cup.getBoundingClientRect());
  if(!visible.length)return;
  const contact=boxes.reduce((sum,box,i)=>sum+box.left+box.width*Number(visible[i].dataset.rimX||.5),0)/visible.length;
  for(const [index,cup] of visible.entries()){
   const box=boxes[index],x=(contact-bounds.left)/sx,y=(box.top+box.height*Number(cup.dataset.rim||.12)-bounds.top)/sy,ink=cup.closest('.bar-glass').classList.contains('own')?cup.dataset.splashColor:'#b9aea0';
   if(cup.dataset.fillRatio==='0')continue;
   for(let i=0;i<4;i++){
    const drop=document.createElement('i'),direction=index%2?-1:1,dx=[-9,-4,5,10][i]*direction,rise=[7,12,10,6][i];drop.className='bar-pixel-splash';drop.setAttribute('aria-hidden','true');drop.style.cssText=`left:${Math.round(x)}px;top:${Math.round(y)}px;background:${ink||'#ddc9a4'};width:${i%3===0?2:1}px;height:${i%2?2:1}px`;layer.append(drop);
    const animation=drop.animate([{transform:'translate(0,0)',opacity:.8},{transform:`translate(${Math.round(dx*.6)}px,${-rise}px)`,opacity:.9,offset:.5},{transform:`translate(${dx}px,3px)`,opacity:0}],{duration:420+i*25,easing:'steps(6,end)'});animation.onfinish=animation.oncancel=()=>drop.remove();
   }
  }
 }
 return {render,settle,splash,color,cupMetrics,imageFor,canPour,clinkSound};
})();
