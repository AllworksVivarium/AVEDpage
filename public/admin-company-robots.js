async function renderCompanyRobots(){
 const data=await api('/api/admin/company-robots'),panel=$('#panel');
 panel.innerHTML='<section class="company-robots-panel"><h2>公司机器人</h2><p>点击头像上传并居中裁切；选择底色可恢复默认头像。</p><h3>添加机器人</h3><div data-robot-create></div><h3 data-robot-count>现有机器人 '+data.items.length+'</h3><p role="status" data-robot-feedback></p><div id="robot-list"></div></section>';
 const presets=[['slate','灰蓝'],['moss','苔绿'],['wine','暗红'],['sand','沙金'],['dusk','烟紫']],feedback=panel.querySelector('[data-robot-feedback]');
 function defaultImage(preset,id=0){const key=preset||presets[id%presets.length][0];return '/assets/avatar-pixel-'+key+'.debac0c8de54.svg';}
 function mount(host,robot={}){
  const form=document.createElement('form');form.className='robot-compact-row';form.dataset.robotId=robot.id||'';
  form.innerHTML='<div class="robot-avatar-field"><button type="button" class="robot-avatar-button small-action" data-robot-avatar aria-label="上传'+esc(robot.codename||'新机器人')+'的头像"><img src="'+esc(robot.avatarUrl||defaultImage(''))+'" alt="机器人头像预览" width="40" height="40" loading="lazy"></button><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" hidden></div><label>内网 ID<input name="codename" value="'+esc(robot.codename||'')+'" maxlength="32" required></label><label>头像底色<select name="avatarPreset"><option value="">自动分配</option>'+presets.map(([key,label])=>'<option value="'+key+'" '+(robot.avatarPreset===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>余额<input name="balance" type="number" step="1" min="-1000000000" max="1000000000" value="'+(robot.balance??0)+'" required></label><button type="submit" class="small-action">'+(robot.id?'保存':'添加机器人')+'</button><span role="status" data-robot-status hidden></span>';
  host.append(form);let avatarData,presetChanged=false,busy=false;const status=form.querySelector('[data-robot-status]'),save=form.querySelector('[type=submit]'),image=form.querySelector('img');
  function lock(value){busy=value;form.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);}
  function say(message){status.textContent=message;status.hidden=!message;}
  form.querySelector('[data-robot-avatar]').onclick=()=>form.elements.avatar.click();
  form.elements.avatarPreset.onchange=()=>{presetChanged=true;avatarData='';image.src=defaultImage(form.elements.avatarPreset.value,robot.id||0);say('头像已调整，保存后生效。');};
  form.elements.avatar.onchange=async()=>{
   const file=form.elements.avatar.files[0];if(!file||busy)return;lock(true);say('正在处理头像…');
   try{const value=await AVEDImageUpload.read(file,{kind:'avatar'});if(!form.isConnected)return;avatarData=value;image.src=value;say('头像已居中裁切，保存后生效。');}catch(error){say(error.message);}finally{form.elements.avatar.value='';lock(false);}
  };
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;lock(true);say('正在保存…');
   try{
    const body={codename:form.elements.codename.value,balance:Number(form.elements.balance.value),...(!robot.id||presetChanged?{avatarPreset:form.elements.avatarPreset.value}:{}),...(avatarData!==undefined?{avatarData}:{}),...(robot.id?{revision:robot.revision,expectedBalance:robot.balance}:{})};
    const saved=await api('/api/admin/company-robots'+(robot.id?'/'+robot.id:''),{method:robot.id?'PUT':'POST',body:JSON.stringify(body)}),fresh=await api('/api/admin/company-robots');if(!form.isConnected)return;
    const updated=fresh.items.find(r=>r.id===saved.id);if(robot.id){const slot=document.createElement('div');form.replaceWith(slot);mount(slot,updated);slot.replaceWith(...slot.childNodes);}else{mount(panel.querySelector('#robot-list'),updated);form.remove();mount(panel.querySelector('[data-robot-create]'));}
    panel.querySelector('[data-robot-count]').textContent='现有机器人 '+fresh.items.length;feedback.textContent=saved.codename+' 已保存。';
   }catch(error){say(error.message);}finally{lock(false);}
  };
 }
 mount(panel.querySelector('[data-robot-create]'));data.items.forEach(robot=>mount(panel.querySelector('#robot-list'),robot));
}
