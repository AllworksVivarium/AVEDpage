/* Shared restricted text model. The same validator runs on the server and client. */
(function(root){
  const templates=['plain','ruled','grid','archive','photo'],paperTones=['ivory','white','sage','blue','rose'],limit=100000;
  const presentation=item=>item.kind==='art'?'image':['text','image'].includes(item.presentation)?item.presentation:item.imageData&&!String(item.body||'').trim()?'image':'text';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(value,fallback=''){
    if(value===undefined||value===null||value==='')value={ops:[{insert:String(fallback)+'\n'}]};
    if(!value||!Array.isArray(value.ops)||value.ops.length>5000)throw Error('正文格式无效。');
    let length=0;const ops=value.ops.map(op=>{
      if(typeof op.insert!=='string')throw Error('请使用附图入口上传图片。');
      length+=op.insert.length;if(length>limit+1)throw Error('正文最多 100000 字。');
      const attributes={},a=op.attributes||{};
      for(const k of ['bold','italic','underline','blockquote'])if(a[k]===true)attributes[k]=true;
      if([2,3].includes(a.header))attributes.header=a.header;
      if(['bullet','ordered'].includes(a.list))attributes.list=a.list;
      if(a.align==='center')attributes.align='center';
      return {insert:op.insert.replace(/\r\n?/g,'\n'),...(Object.keys(attributes).length?{attributes}:{})};
    }).filter(op=>op.insert);
    if(!ops.length||!ops.at(-1).insert.endsWith('\n'))ops.push({insert:'\n'});
    return {ops};
  }
  const text=delta=>delta.ops.map(op=>op.insert).join('').replace(/\n$/,'');
  function html(value,fallback=''){
    const delta=normalize(value,fallback);let output='',line='';
    for(const op of delta.ops){const a=op.attributes||{},parts=op.insert.split('\n');
      parts.forEach((part,i)=>{
        let s=esc(part);if(a.bold)s='<strong>'+s+'</strong>';if(a.italic)s='<em>'+s+'</em>';if(a.underline)s='<u>'+s+'</u>';line+=s;
        if(i<parts.length-1){const tag=a.header?'h'+a.header:a.blockquote?'blockquote':'p',cls=(a.align==='center'?' life-center':'')+(a.list?' life-list-'+a.list:'');output+='<'+tag+(cls?' class="'+cls.trim()+'"':'')+'>'+(line||'<br>')+'</'+tag+'>';line='';}
      });
    }
    return output;
  }
  const api={normalize,text,html,templates,paperTones,presentation,limit};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AVEDLifeContent=api;
})(typeof window==='undefined'?globalThis:window);
