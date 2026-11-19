(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const types={note:'补充记录',discovery:'发现记录',experiment:'实验记录',incident:'事件记录',interview:'访谈记录',story:'小故事'};
 const classification=f=>'<label>收容分类<select name="classification">'+[['','未分级'],['SAFE','SAFE'],['EUCLID','EUCLID'],['KETER','KETER']].map(([k,t])=>'<option value="'+k+'" '+(f?.classification===k?'selected':'')+'>'+t+'</option>').join('')+'</select></label>';
 function designation(f={}){
  const parts=/^(SAFE|EUCLID|KETER)-([A-Za-z]+)-([0-9]+)$/.exec(f.code||''),legacy=!!f.code&&!parts;
  const letters=f.codeLetters??parts?.[2]??'',number=f.codeNumber??parts?.[3]??'';
  return '<div class="dossier-designation" data-dossier-designation data-legacy-code="'+esc(legacy?f.code:'')+'">'+classification({...f,classification:f.classification||parts?.[1]||''})+'<label>字母段<input name="codeLetters" pattern="[A-Za-z]+" maxlength="20" autocomplete="off" spellcheck="false" value="'+esc(letters)+'"></label><label>数字段<input name="codeNumber" inputmode="numeric" pattern="[0-9]+" maxlength="20" autocomplete="off" value="'+esc(number)+'"></label><label class="dossier-code-preview">编号预览<input name="code" readonly maxlength="30" value="'+esc(f.code||'')+'"></label></div>';
 }
 function bindDesignation(form){
  const host=form.querySelector('[data-dossier-designation]');if(!host)return;
  const {classification,codeLetters,codeNumber,code}=form.elements;
  function update(){
   const letters=codeLetters.value.trim(),number=codeNumber.value.trim(),legacy=host.dataset.legacyCode;
   const structured=!legacy||!!letters||!!number;
   classification.required=codeLetters.required=codeNumber.required=structured;
   code.value=structured?[classification.value,letters.toUpperCase(),number].join('-'):legacy;
   codeLetters.setCustomValidity(structured&&code.value.length>30?'组合后的档案编号最多 30 字符。':'');
  }
  host.addEventListener('input',update);host.addEventListener('change',update);update();
 }
 function entry(x={},open=false){return '<details class="dossier-section-fields" data-dossier-section '+(x.attachment?'data-section-attachment="'+esc(JSON.stringify(x.attachment))+'" ':'')+(open?'open':'')+'><summary>'+esc(x.title||types[x.type]||'补充记录')+'</summary><div class="dossier-section-body"><label>资料类型<select data-section-key="type">'+Object.entries(types).map(([k,t])=>'<option value="'+k+'" '+((x.type||'note')===k?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>标题（选填）<input data-section-key="title" maxlength="100" value="'+esc(x.title)+'"></label><div class="dossier-section-meta-fields"><label>署名（选填）<input data-section-key="author" maxlength="80" value="'+esc(x.author)+'"></label><label>时间（选填）<input data-section-key="date" maxlength="80" value="'+esc(x.date)+'"></label></div><label>正文<textarea data-section-key="body" maxlength="6000" rows="6">'+esc(x.body)+'</textarea></label><div class="dossier-section-actions"><button type="button" class="small-action" data-section-action="up">上移</button><button type="button" class="small-action" data-section-action="down">下移</button><button type="button" class="small-action danger" data-section-action="remove">移除模块</button></div></div></details>';}
 const fields=f=>'<label>特殊收容措施（选填）<textarea name="procedures" maxlength="8000" rows="4">'+esc(f?.procedures)+'</textarea></label><section class="dossier-section-editor"><header><h4>补充资料（选填）</h4><button type="button" class="small-action" data-section-add>添加资料模块</button></header><small>署名、时间和标题可留空；空白模块不在玩家端显示。</small><div data-dossier-sections>'+(f?.sections||[]).map(x=>entry(x)).join('')+'</div></section>';
 function bind(form){if(form.dataset.sectionsBound)return;form.dataset.sectionsBound='true';bindDesignation(form);const host=form.querySelector('[data-dossier-sections]');
  function tools(area){if(area.dataset.effectTools)return;area.dataset.effectTools='true';const bar=document.createElement('div');bar.className='dossier-effect-tools';bar.innerHTML=['加粗','小标题','列表','引用','表格','遮盖','乱码'].map(x=>'<button type="button" data-wrap-effect="'+x+'" class="small-action">'+x+'</button>').join('');area.after(bar);bar.onclick=e=>{const kind=e.target.closest('[data-wrap-effect]')?.dataset.wrapEffect;if(!kind)return;const start=area.selectionStart,end=area.selectionEnd,text=area.value.slice(start,end),formats={'加粗':'**'+text+'**','小标题':'\n## '+text+'\n','列表':'\n- '+text+'\n','引用':'\n> '+text+'\n','表格':'\n| 项目 | 记录 |\n| --- | --- |\n| '+text+' |  |\n'};area.setRangeText(formats[kind]??'['+kind+']'+text+'[/'+kind+']',start,end,'select');area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();};}
  form.querySelectorAll('textarea[name="summary"],textarea[name="procedures"],textarea[data-section-key="body"]').forEach(tools);
  const hint=document.createElement('small');hint.className='dossier-effects-help';hint.textContent='选中文字后，点击插入效果。';host.before(hint);

  form.querySelector('[data-section-add]').onclick=()=>{if(host.children.length>=24){window.AVEDFeedback.alert('补充资料最多 24 个模块。');return;}host.insertAdjacentHTML('beforeend',entry({},true));const area=host.lastElementChild.querySelector('textarea');tools(area);area.focus();form.dispatchEvent(new Event('input',{bubbles:true}));};
  host.onclick=e=>{const b=e.target.closest('[data-section-action]');if(!b)return;const row=b.closest('[data-dossier-section]');if(b.dataset.sectionAction==='remove')row.remove();else if(b.dataset.sectionAction==='up')row.previousElementSibling?.before(row);else row.nextElementSibling?.after(row);form.dispatchEvent(new Event('input',{bubbles:true}));};
  host.oninput=e=>{const row=e.target.closest('[data-dossier-section]');if(row)row.querySelector('summary').textContent=row.querySelector('[data-section-key="title"]').value.trim()||types[row.querySelector('[data-section-key="type"]').value];};
 }
 function collect(form){return [...form.querySelectorAll('[data-dossier-section]')].map(row=>({...Object.fromEntries([...row.querySelectorAll('[data-section-key]')].map(n=>[n.dataset.sectionKey,n.value])),...(row.dataset.sectionAttachment?{attachment:JSON.parse(row.dataset.sectionAttachment)}:{})}));}
 window.AVEDAdminDossierContent={classification,designation,bindDesignation,fields,bind,collect,entry};
})();
