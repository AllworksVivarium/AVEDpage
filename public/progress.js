(function(root){
 const instances=new WeakMap();
 function mount(element){
  if(instances.has(element))return instances.get(element);
  const track=element.querySelector('[role="progressbar"]'),fill=element.querySelector('[data-progress-fill]'),output=element.querySelector('[data-progress-output]'),status=element.querySelector('[role="status"]');
  function update({value,total,state='loading',label='CONNECTING'}={}){
   const known=Number.isFinite(value)&&Number.isFinite(total)&&total>0;
   const ratio=known?Math.max(0,Math.min(1,value/total)):null;
   if(!['loading','success','error'].includes(state))throw new TypeError('Unknown progress state');
   element.dataset.state=state;
   element.dataset.mode=known?'determinate':'indeterminate';
   track.setAttribute('aria-label',label);
   track.setAttribute('aria-busy',String(state==='loading'));
   track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
   if(known){
    const percent=Math.floor(ratio*100);
    track.setAttribute('aria-valuenow',String(percent));
    fill.style.setProperty('--progress-ratio',String(ratio));
    output.textContent=(state==='success'?'✓ ':state==='error'?'× ':'')+percent+'%';
   }else{
    track.removeAttribute('aria-valuenow');fill.style.removeProperty('--progress-ratio');
    output.textContent=(state==='success'?'✓ ':state==='error'?'× ':'')+label;
   }
   track.setAttribute('aria-valuetext',known?label+' '+Math.floor(ratio*100)+'%':label);
   // Announce stage/result changes, rather than every file in a large manifest.
   if(status.textContent!==label)status.textContent=label;
  }
  const controller={update};instances.set(element,controller);return controller;
 }
 root.AVEDProgress={mount};
})(globalThis);
