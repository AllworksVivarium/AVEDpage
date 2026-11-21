(function(){
 const source=window.AVEDEmployeeImport;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(host,{api,onComplete}){
  host.innerHTML='<label>导入方式<select data-import-mode><option value="create">新建员工</option><option value="attributes">仅更新六维</option></select></label><p class="ui-help-note">新建员工的用户名与姓名一致，初始密码为 000000，初始余额为 0；六维顺序为力量、意志、洞察、敏捷、智力、体质。</p><div class="employee-import-actions"><button type="button" class="small-action" data-import-download>下载登记模板</button><button type="button" class="small-action" data-import-file-button>选择已填写文件</button><input type="file" data-import-file accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" hidden><button type="button" class="small-action" data-import-template>填入示例</button></div><label>批量资料<textarea data-import-text rows="8" wrap="off" maxlength="200000" spellcheck="false" placeholder="粘贴 Excel 表格、CSV 或带表头的文本"></textarea></label><p class="ui-help-note">每人一行，保留模板表头。六维可在新建时全部留空；更新六维时填写全部六项。</p><div class="employee-import-actions"><button type="button" class="small-action" data-import-preview>识别并预览</button><button type="button" class="small-action" data-import-submit disabled>确认导入</button></div><p role="status" aria-live="polite" data-import-status></p><div data-import-errors></div><div class="table-wrap employee-import-preview" data-import-results hidden></div>';
  const mode=host.querySelector('[data-import-mode]'),text=host.querySelector('[data-import-text]'),status=host.querySelector('[data-import-status]'),errors=host.querySelector('[data-import-errors]'),results=host.querySelector('[data-import-results]'),submit=host.querySelector('[data-import-submit]');let ready=null,busy=false;
  function reset(){ready=null;submit.disabled=true;status.textContent='';errors.replaceChildren();results.replaceChildren();results.hidden=true;}
  function lock(value){busy=value;host.querySelectorAll('button,textarea,select,input').forEach(e=>e.disabled=value);submit.disabled=value||!ready;}
  function showErrors(items){errors.innerHTML=items.length?'<ul role="alert">'+items.map(x=>'<li>'+(x.line?'第 '+x.line+' 行：':'')+esc(x.message)+'</li>').join('')+'</ul>':'';}
  text.addEventListener('input',reset);mode.addEventListener('change',reset);
  host.querySelector('[data-import-template]').onclick=()=>{if(busy)return;text.value=mode.value==='create'?source.template:source.attributeTemplate;reset();text.focus();};
  const download=host.querySelector('[data-import-download]'),file=host.querySelector('[data-import-file]');
  mode.addEventListener('change',()=>{download.textContent=mode.value==='create'?'下载登记模板':'下载六维模板';});
  download.onclick=()=>{
   const url=URL.createObjectURL(new Blob([source.templateFile(mode.value)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
   link.href=url;link.download=mode.value==='create'?'员工登记模板.csv':'员工六维更新模板.csv';host.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   status.textContent='模板已下载，填写并保存为 CSV 后，选择文件即可预览导入。';
  };
  host.querySelector('[data-import-file-button]').onclick=()=>file.click();
  file.onchange=async()=>{
   const selected=file.files[0];if(!selected||busy)return;reset();lock(true);
   try{
    if(selected.size>1000000)throw Error('文件过大，请选择登记模板文件。');
    const bytes=await selected.arrayBuffer();let value;
    try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{value=new TextDecoder('gb18030',{fatal:true}).decode(bytes);}
    if(value.includes('\0'))throw Error('请选择 CSV、TSV 或文本文件。');
    if(!host.isConnected)return;text.value=value;status.textContent='已读取 '+selected.name+'，请点击识别并预览。';
   }catch(error){status.textContent=error.message;}finally{file.value='';lock(false);}
  };
  host.querySelector('[data-import-preview]').onclick=async()=>{
   if(busy)return;reset();lock(true);status.textContent='正在识别资料…';
   try{
    const input={text:text.value,mode:mode.value},data=await api('/api/admin/employees/import/preview',{method:'POST',body:JSON.stringify(input)});if(!host.isConnected)return;
    showErrors(data.errors);results.hidden=!data.rows.length;
    results.innerHTML='<table><thead><tr><th>原始行</th><th>姓名 / 用户名</th>'+(input.mode==='create'?'<th>部门</th><th>QQ 号</th>':'<th>当前姓名</th>')+source.labels.map(x=>'<th>'+x+'</th>').join('')+'<th>操作</th></tr></thead><tbody>'+data.rows.map(row=>'<tr><td>'+row.line+'</td><td>'+esc(row.name)+'</td>'+(input.mode==='create'?'<td>'+esc(row.department==='公司直属'?'无部门归属':row.department)+'</td><td>'+esc(row.qqNumber||'—')+'</td>':'<td>'+esc(row.displayName)+'</td>')+source.labels.map((_,i)=>'<td>'+(row.attributes?.[i]??'—')+'</td>').join('')+'<td>'+row.action+'</td></tr>').join('')+'</tbody></table>';
    status.textContent='已识别 '+data.count+' 名员工'+(data.errors.length?'，请修正 '+data.errors.length+' 处错误后重新识别。':'，请核对预览后确认导入。');
    if(!data.errors.length&&data.count)ready={...input,fingerprint:data.fingerprint,requestId:crypto.randomUUID()};
   }catch(error){status.textContent=error.message;}finally{lock(false);}
  };
  submit.onclick=async()=>{
   if(busy||!ready)return;lock(true);status.textContent='正在导入，请稍候…';
   try{
    const result=await api('/api/admin/employees/import',{method:'POST',body:JSON.stringify(ready),timeoutMs:120000});ready=null;
    await onComplete(result);
   }catch(error){status.textContent=error.message;if([400,409].includes(error.status))ready=null;}finally{lock(false);}
  };
 }
 window.AVEDAdminEmployeeImport={mount};
})();
