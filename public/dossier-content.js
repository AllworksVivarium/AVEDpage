(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const kinds={note:['ADDENDUM','补充记录'],discovery:['DISCOVERY LOG','发现记录'],experiment:['EXPERIMENT LOG','实验记录'],incident:['INCIDENT REPORT','事件记录'],interview:['INTERVIEW LOG','访谈记录'],story:['FIELD NOTES','小故事']};
 function map(d){return {id:esc(d.code),dbId:d.id,employeeId:d.employeeId,imageUrl:d.imageUrl||'',codeName:esc(d.title),searchName:d.title,department:esc(d.department),level:esc(d.status),classification:d.classification||'',summary:esc(d.abstract||d.summary).replace(/\[\/?(?:遮盖|乱码)\]/g,''),description:esc(d.summary),procedure:esc(d.procedures||''),sections:d.sections||[],searchText:[d.summary,d.abstract,d.procedures,...(d.sections||[]).flatMap(x=>[x.title,x.author,x.date,x.body])].join(' '),handlers:'',location:'',clues:[],pinLabel:'ARCHIVE',polaroidTag:'收容物档案',realComments:[]};}
 function markup(text){return text.replace(/\[遮盖\]([\s\S]*?)\[\/遮盖\]/g,'<span class="dossier-redaction" tabindex="0" aria-label="遮盖内容，聚焦可查阅">$1</span>').replace(/\[乱码\]([\s\S]*?)\[\/乱码\]/g,'<span data-dossier-glitch>$1</span>');}
 let lastVisit='';
 function play(root,key,enabled=true){if(lastVisit===key)return;lastVisit=key;if(!enabled)return;for(const node of root.querySelectorAll('[data-dossier-glitch]')){const original=node.textContent;const mask=()=>{node.textContent=[...original].map(c=>/\s/.test(c)?c:Math.random()<.5?'█':'▓░╳※Ψ'[Math.floor(Math.random()*5)]).join('');};mask();setTimeout(()=>{if(node.isConnected)mask();},45);setTimeout(()=>{node.textContent=original;},95);}}
 function inline(text){return markup(text.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>'));}
 function rich(text,escaped=false){
  text=escaped?String(text||''):esc(text);
  if(!/^(?:#{2,3} |[-*] |\d+\. |&gt;|\|)/m.test(text))return '<p class="dossier-document-copy">'+inline(text)+'</p>';
  const lines=text.split('\n'),out=[];let i=0;
  const special=line=>/^(?:#{2,3} |[-*] |\d+\. |&gt;|\|)/.test(line);
  while(i<lines.length){const line=lines[i];
   if(/^#{2,3} /.test(line)){out.push('<h5>'+inline(line.replace(/^#{2,3} /,''))+'</h5>');i++;}
   else if(/^[-*] |^\d+\. /.test(line)){const ordered=/^\d/.test(line),tag=ordered?'ol':'ul',rows=[];while(i<lines.length&&(ordered?/^\d+\. /:/^[-*] /).test(lines[i]))rows.push('<li>'+inline(lines[i++].replace(/^(?:[-*]|\d+\.) /,''))+'</li>');out.push('<'+tag+'>'+rows.join('')+'</'+tag+'>');}
   else if(/^&gt;/.test(line)){const rows=[];while(i<lines.length&&/^&gt;/.test(lines[i]))rows.push(lines[i++].replace(/^&gt; ?/,''));out.push('<blockquote>'+inline(rows.join('\n'))+'</blockquote>');}
   else if(/^\|/.test(line)){const rows=[];while(i<lines.length&&/^\|/.test(lines[i])){const cells=lines[i++].replace(/^\||\|$/g,'').split('|').map(x=>x.trim());if(cells.every(x=>/^:?-+:?$/.test(x)))continue;rows.push(cells);}out.push('<div class="dossier-table-scroll"><table>'+rows.map((r,n)=>'<tr>'+r.map(c=>'<'+(n?'td':'th')+'>'+inline(c)+'</'+(n?'td':'th')+'>').join('')+'</tr>').join('')+'</table></div>');}
   else{const rows=[line];i++;while(i<lines.length&&!special(lines[i]))rows.push(lines[i++]);out.push('<p class="dossier-document-copy">'+inline(rows.join('\n'))+'</p>');}
  }return out.join('');
 }
 function safeImage(url){return typeof url==='string'&&!url.includes('..')&&/^(?:\/(?:assets\/|api\/(?:admin\/)?dossiers\/\d+\/image(?:$|\?))|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$)/.test(url)?url:'';}
 function figure(url,title,caption=''){url=safeImage(url);return url?'<figure class="dossier-uploaded-image"><img src="'+esc(url)+'" alt="'+title+'" loading="lazy" decoding="async">'+(caption?'<figcaption>'+esc(caption)+'</figcaption>':'')+'</figure>':'';}
 function parts(item){return [...(item.procedure?[{type:'procedures',title:'特殊收容措施',en:'SPECIAL CONTAINMENT PROCEDURES',body:item.procedure,escaped:true}]:[]),...(item.description?[{type:'description',title:'档案描述',en:'DESCRIPTION',body:item.description,escaped:true}]:[]),...(item.sections||[]).filter(x=>x.body?.trim()).map(x=>({...x,title:x.title||(kinds[x.type]||kinds.note)[1],en:(kinds[x.type]||kinds.note)[0]}))];}
 function section(x,index){
  let body=rich(x.body,!!x.escaped);
  if(x.type==='interview')body='<div class="dossier-interview">'+String(x.body).split('\n').map(line=>{const match=line.match(/^([^：:\n]{1,24})[：:]\s*(.*)$/);return match?'<div class="dossier-dialogue"><b>'+esc(match[1])+'</b><p>'+inline(esc(match[2]))+'</p></div>':rich(line);}).join('')+'</div>';
  return '<section class="dossier-entry dossier-section-'+esc(x.type)+'" id="dossier-section-'+index+'" data-dossier-entry="'+esc(x.type)+'"><header><small lang="en">'+esc(x.en)+'</small><h4>'+esc(x.title)+'</h4>'+(x.author||x.date?'<div class="dossier-entry-meta">'+(x.author?'<b>'+esc(x.author)+'</b>':'')+(x.date?'<span>'+esc(x.date)+'</span>':'')+'</div>':'')+'</header>'+body+(x.attachment?figure(x.attachment.imageUrl,esc(x.title),x.attachment.caption):'')+'</section>';
 }
 function heading(item){return '<header class="dossier-paper-heading"><div class="dossier-paper-masthead"><span>A.V.E.D. / CONTAINMENT ARCHIVE</span><span>'+item.id+'</span></div><div class="dossier-paper-title"><div><small>ITEM DESIGNATION</small><h3>'+item.codeName+'</h3></div><div class="dossier-status-tags">'+(item.classification?'<span class="dossier-classification">'+esc(item.classification)+'</span>':'')+'<span class="scp-status-stamp">'+item.level+'</span></div></div>'+(item.department?'<div class="dossier-paper-department">'+item.department+'</div>':'')+'</header>';}
 function render(item,{sections=parts(item),image=true}={}){return '<div class="dossier-content">'+(image?figure(item.imageUrl,item.codeName+' 档案配图','档案配图'):'')+sections.map(section).join('')+'</div>';}
 window.AVEDDossierContent={map,render,play,rich,parts,section,heading,safeImage};
})();
