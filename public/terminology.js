(function(){
  let rules=[],pending=false;const originals=new WeakMap(),rendered=new WeakMap(),attributeSources=new WeakMap();
  const skip=el=>!el||el.closest('script,style,textarea,input,select,code,[data-keep-original]');
  function transform(text){
    let value=text.replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,'').replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/g,'');
    for(const r of rules){if(r.isRegex){try{value=value.replace(new RegExp(r.pattern,'gu'),()=>r.replacement);}catch{}}else value=value.split(r.pattern).join(r.replacement);}
    return value;
  }
  function visit(node){if(node.nodeType===3){if(skip(node.parentElement))return;const actual=node.nodeValue;if(actual!==rendered.get(node))originals.set(node,actual);const next=transform(originals.get(node)??actual);if(next!==actual)node.nodeValue=next;rendered.set(node,next);}else if(node.nodeType===1){let attrs=attributeSources.get(node)||{};for(const key of ['title','aria-label','alt','placeholder']){const actual=node.getAttribute(key);if(actual===null)continue;if(!attrs[key]||actual!==attrs[key].rendered)attrs[key]={source:actual};const next=transform(attrs[key].source);if(next!==actual)node.setAttribute(key,next);attrs[key].rendered=next;}attributeSources.set(node,attrs);if(!skip(node))for(const child of node.childNodes)visit(child);}}
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;visit(document.body);});}
  async function refreshRules(){try{const res=await fetch('/api/terminology',{cache:'no-store'});if(res.ok){rules=(await res.json()).items;schedule();}}catch{}}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  window.AVEDTerminology={refreshRules,transform};schedule();refreshRules();
})();
