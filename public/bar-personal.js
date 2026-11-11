/* Personal choices are private server-side settings. Container entry stays disabled. */
window.AVEDBarPersonal=function({root,api,esc,onChange}){
 const cup=document.createElement('dialog'),tolerance=document.createElement('dialog');
 cup.className='bar-menu-dialog bar-glassware-dialog';cup.setAttribute('aria-label','选杯');
 cup.innerHTML='<header><h2>选杯</h2><button type="button" data-personal-close aria-label="关闭选杯">×</button></header><div class="bar-glassware-options" data-cup-options></div><p class="bar-personal-error" role="alert" hidden></p>';
 tolerance.className='bar-menu-dialog bar-tolerance-dialog';tolerance.setAttribute('aria-label','酒量设定');
 tolerance.innerHTML='<header><h2>酒量设定</h2><button type="button" data-personal-close aria-label="暂时不回答">×</button></header><div class="bar-tolerance-question"><small data-personal-bartender>调酒师</small><p>你的酒量怎么样？</p><div data-tolerance-options></div></div><p class="bar-personal-error" role="alert" hidden></p>';
 root.append(cup,tolerance);
 let preferences={},glassware=[],options=[],busy=false,generation=0,glasswareEnabled=false;
 for(const dialog of [cup,tolerance]){dialog.querySelector('[data-personal-close]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{event.stopPropagation();if(busy)event.preventDefault();});}
 const error=(dialog,message)=>{const el=dialog.querySelector('.bar-personal-error');el.textContent=message;el.hidden=!message;};
 function paint(){
  const cupOptions=cup.querySelector('[data-cup-options]'),cupKey=JSON.stringify([glasswareEnabled,glassware,preferences.glassId]);
  if(cupOptions.dataset.key!==cupKey){cupOptions.dataset.key=cupKey;cupOptions.innerHTML=glasswareEnabled?`<button type="button" data-cup="" aria-pressed="${!preferences.glassId}"><span class="bar-no-cup">—</span><span>不配杯</span></button>`+glassware.filter(item=>item.image).map(item=>`<button type="button" data-cup="${esc(item.id)}" aria-pressed="${preferences.glassId===item.id}"><img src="${esc(item.image)}" alt=""><span>${esc(item.name)}</span></button>`).join(''):'';}
  const toleranceOptions=tolerance.querySelector('[data-tolerance-options]'),toleranceKey=JSON.stringify([options,preferences.toleranceId]);
  if(toleranceOptions.dataset.key!==toleranceKey){toleranceOptions.dataset.key=toleranceKey;toleranceOptions.innerHTML=options.map(item=>`<button type="button" data-tolerance="${esc(item.id)}" aria-pressed="${preferences.toleranceId===item.id}">${esc(item.label)}</button>`).join('');}
  const label=root.querySelector('[data-bar-tolerance]');if(label)label.textContent=preferences.toleranceLabel||'酒量设定';
  for(const dialog of [cup,tolerance])for(const button of dialog.querySelectorAll('button'))button.disabled=busy;
 }
 function show(dialog){if(root.hidden||busy)return;for(const other of root.querySelectorAll('dialog[open]'))if(other!==dialog)other.close();error(dialog,'');paint();if(!dialog.open)dialog.showModal();}
 async function save(dialog,body){if(busy)return;const visit=generation;busy=true;paint();error(dialog,'');try{const data=await api('/api/player/bar/preferences',{method:'POST',body});if(visit!==generation)return;preferences=data.barPreferences;onChange(data);dialog.close();}catch(problem){if(visit===generation)error(dialog,problem.message);}finally{if(visit===generation){busy=false;paint();}}}
 cup.onclick=event=>{const button=event.target.closest('[data-cup]');if(button)save(cup,{glassId:button.dataset.cup||null});};
 tolerance.onclick=event=>{const button=event.target.closest('[data-tolerance]');if(button)save(tolerance,{toleranceId:button.dataset.tolerance});};
 const cupEntry=root.querySelector('[data-bar-glassware]');if(cupEntry)cupEntry.onclick=()=>{if(glasswareEnabled)show(cup);};
 root.querySelector('[data-bar-tolerance]').onclick=()=>show(tolerance);
 return {receive(data,{initial=false}={}){preferences=data.barPreferences||{};glassware=data.glassware||glassware;options=data.toleranceOptions||options;if(data.features)glasswareEnabled=data.features.glassware===true;if(cupEntry)cupEntry.hidden=!glasswareEnabled;tolerance.querySelector('[data-personal-bartender]').textContent=data.npc?.name||'调酒师';paint();if(initial&&!preferences.toleranceId)show(tolerance);},openCup:()=>{if(glasswareEnabled)show(cup);},close(){generation++;busy=false;for(const dialog of [cup,tolerance])if(dialog.open)dialog.close();}};
};
