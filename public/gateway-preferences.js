/* Load before the body: the browser's selected gateway also survives logout. */
(function(){
 const key='aved_gateway_background_v1';
 const read=()=>{try{return localStorage.getItem(key)==='sphere'?'sphere':'image';}catch{return 'image';}};
 let selected=read(),owned=null;
 function apply(){document.documentElement.dataset.landingScene=selected;document.body?.classList.toggle('landing-sphere',selected==='sphere');}
 function save(){try{localStorage.setItem(key,selected);return true;}catch{return false;}}
 function notify(){apply();document.dispatchEvent(new Event('aved-gateway-change'));}
 window.AVEDGateway={get selected(){return selected;},apply,
  select(value){if(!['image','sphere'].includes(value)||value==='sphere'&&!owned?.includes(value))return false;selected=value;const saved=save();notify();return {saved};},
  setEntitlements(value){owned=value?.backgrounds?.owned||['image'];if(!owned.includes(selected)){selected='image';save();}notify();}
 };
 // The former free scene switch is deliberately not migrated into paid ownership.
 apply();document.addEventListener('DOMContentLoaded',apply);
 addEventListener('storage',event=>{if(event.key!==key&&event.key!==null)return;selected=read();if(owned&&!owned.includes(selected))selected='image';notify();});
})();
