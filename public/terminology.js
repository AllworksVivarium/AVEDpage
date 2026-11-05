(function(){
  let rules=[],pending=false;const originals=new WeakMap(),rendered=new WeakMap(),attributeSources=new WeakMap(),dirty=new Set();
  const skip=el=>!el||el.closest('script,style,textarea,input,select,code,[data-keep-original]');
  function transform(text){
    let value=text.replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,'').replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/g,'');
    for(const r of rules){if(r.isRegex){try{value=value.replace(new RegExp(r.pattern,'gu'),()=>r.replacement);}catch{}}else value=value.split(r.pattern).join(r.replacement);}
    return value;
  }
  function visit(node){if(node.nodeType===3){if(skip(node.parentElement))return;const actual=node.nodeValue;if(actual!==rendered.get(node))originals.set(node,actual);const next=transform(originals.get(node)??actual);if(next!==actual)node.nodeValue=next;rendered.set(node,next);}else if(node.nodeType===1){let attrs=attributeSources.get(node)||{};for(const key of ['title','aria-label','alt','placeholder']){const actual=node.getAttribute(key);if(actual===null)continue;if(!attrs[key]||actual!==attrs[key].rendered)attrs[key]={source:actual};const next=transform(attrs[key].source);if(next!==actual)node.setAttribute(key,next);attrs[key].rendered=next;}attributeSources.set(node,attrs);if(!skip(node))for(const child of node.childNodes)visit(child);}}
  function schedule(node=document.body){dirty.add(node);if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;const nodes=[...dirty];dirty.clear();for(const item of nodes)if(item.isConnected)visit(item);});}
  async function refreshRules(){try{const res=await fetch('/api/terminology',{cache:'no-store'});if(res.ok){const d=await res.json();if(Array.isArray(d.items)){rules=d.items;schedule();}}}catch{}}
  new MutationObserver(records=>{for(const r of records){if(r.type==='childList')for(const node of r.addedNodes)schedule(node);else if(r.type==='characterData')schedule(r.target);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{if(!document.hidden)refreshRules();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshRules();});
  window.AVEDTerminology={refreshRules,transform};schedule();refreshRules();
})();
