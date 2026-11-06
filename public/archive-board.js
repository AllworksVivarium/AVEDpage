/* Display-only sampling and a shared, short redaction timeline. */
(function(root){
  function sample(items,count=4,random=Math.random){
    const pool=[...items];
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,count);
  }
  let active=null;
  function cancel(){if(active){const old=active;active=null;old.timers.forEach(old.clear);old.restore();}}
  function glitch({document:doc,random=Math.random,setTimer=setTimeout,clearTimer=clearTimeout,enabled=true}){
    cancel();if(!enabled)return;
    const nodes=[...doc.querySelectorAll('#scp-list-container .scp-glitchable-title,#scp-list-container .scp-glitchable-summary')];
    const glyphs=['■','█','▓','▒','╳','⍰','∷'];
    const changes=nodes.map(el=>{
      const original=el.textContent,chars=Array.from(original),name=el.getAttribute('data-scp-name');
      const start=name?Array.from(original.slice(0,original.lastIndexOf(name))).length:0;
      const eligible=chars.map((c,i)=>i>=start&&/[\p{L}\p{N}]/u.test(c)?i:-1).filter(i=>i>=0);
      let indices=eligible.filter(()=>random()<.22).slice(0,Math.max(1,Math.min(5,Math.floor(eligible.length*.5))));
      if(!indices.length&&eligible.length)indices=[eligible[Math.floor(random()*eligible.length)]];
      el.setAttribute('aria-label',original.trim());
      return {el,original,chars,indices,seed:Math.floor(random()*glyphs.length)};
    }).filter(x=>x.indices.length);
    if(!changes.length)return;
    const restore=()=>{for(const {el,original} of changes)el.textContent=original;};
    const state={timers:[],clear:clearTimer,restore};active=state;
    const frame=n=>{for(const {el,chars,indices,seed} of changes){const next=[...chars];indices.forEach((i,j)=>next[i]=glyphs[(seed+j+n)%glyphs.length]);el.textContent=next.join('');}};
    frame(0);
    state.timers.push(setTimer(()=>frame(1),16),setTimer(()=>frame(2),32),setTimer(()=>{restore();if(active===state)active=null;},50));
  }
  const api={sample,glitch,cancel};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.AVEDArchiveBoard=api;root.document.addEventListener('aved-effects-change',()=>{if(root.document.body.classList.contains('effects-off'))cancel();});}
})(typeof window==='object'?window:globalThis);
