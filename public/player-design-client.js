(function(){
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),endpoint='http://127.0.0.1:4177';
  let token='',snapshot={settings:null,fonts:[],revision:'',canEdit:local};
  async function json(url,options={}){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),...options});const data=await response.json();if(!response.ok)throw Error(data.error||'保存失败。');return data;}
  async function companion(path,body){if(!token)token=(await json(endpoint+'/session',{credentials:'omit'})).token;
    try{return await json(endpoint+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','X-AVED-Editor':token},body:JSON.stringify(body)});}catch(e){token='';throw e;}}
  let inFlight=null;
  function refresh(){if(inFlight)return inFlight;inFlight=readSnapshot().finally(()=>{inFlight=null;});return inFlight;}
  async function readSnapshot(){
    try{snapshot=await json('/api/player-design');}catch{if(local){try{snapshot={...await json('/player-type-design.json'),canEdit:true};}catch{}}}
    document.body.dataset.playerDesignEditor=String(local||!!snapshot.canEdit);
    if(!local&&!snapshot.canEdit)document.dispatchEvent(new CustomEvent('aved-edit-mode',{detail:null}));
    document.dispatchEvent(new CustomEvent('aved-player-design',{detail:snapshot}));return snapshot;
  }
  const ready=refresh();
  window.AVEDPlayerDesign={local,ready,refresh,
    text:(path,body)=>local?companion(path,body):json('/api/admin/player-design/text'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  };
  let wasInside=document.body.classList.contains('theme-inner');
  new MutationObserver(()=>{
    const inside=document.body.classList.contains('theme-inner');if(inside===wasInside)return;wasInside=inside;
    if(inside)refresh();
    else document.dispatchEvent(new CustomEvent('aved-edit-mode',{detail:null}));
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  setInterval(()=>{if(!local&&snapshot.canEdit&&!document.hidden&&document.body.classList.contains('theme-inner'))refresh();},60000);
})();
