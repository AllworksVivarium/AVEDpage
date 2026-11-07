(function(){
 const skip='script,style,textarea,input,select,option,code,pre,[contenteditable]:not([contenteditable="false"]),.aved-currency-mark,svg';
 function replaceText(node){
  if(!node.data.includes('¤')||node.parentElement?.closest(skip))return;
  const parts=node.data.split('¤'),fragment=document.createDocumentFragment();
  parts.forEach((part,i)=>{
   if(i){const coin=document.createElement('span'),source=document.createElement('span');
    coin.className='aved-currency-mark';coin.setAttribute('data-type-ignore','');coin.setAttribute('role','img');coin.setAttribute('aria-label','A 币');
    source.className='aved-currency-source';source.setAttribute('aria-hidden','true');source.textContent='¤';coin.append(source);fragment.append(coin);}
   if(part)fragment.append(document.createTextNode(part));
  });node.replaceWith(fragment);
 }
 function render(root){
  if(!root.isConnected)return;
  if(root.nodeType===Node.TEXT_NODE){replaceText(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE||root.closest(skip))return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(walker.currentNode.data.includes('¤'))nodes.push(walker.currentNode);
  for(const node of nodes)replaceText(node);
 }
 const pending=new Set();let scheduled=false;
 new MutationObserver(records=>{
  for(const record of records){if(record.type==='characterData')pending.add(record.target);else for(const node of record.addedNodes)pending.add(node);}
  if(scheduled||!pending.size)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;const roots=[...pending];pending.clear();for(const root of roots)if(!roots.some(other=>other!==root&&other.contains(root)))render(root);});
 }).observe(document.body,{childList:true,subtree:true,characterData:true});
 render(document.body);
})();
