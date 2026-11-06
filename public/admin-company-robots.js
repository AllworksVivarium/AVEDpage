async function renderCompanyRobots(){
 const data=await api('/api/admin/company-robots');
 const fields=(robot={})=>`<label>内网代号<input name="codename" value="${esc(robot.codename||'')}" maxlength="32" required></label><label>余额<input name="balance" type="number" step="1" min="-1000000000" max="1000000000" value="${robot.balance??0}" required></label><button type="submit" class="small-action">${robot.id?'保存':'添加机器人'}</button><span role="status"></span>`;
 $('#panel').innerHTML='<h2>公司机器人</h2><p>机器人仅用于榜单展示；余额可管理，进入破产榜后可接受员工捐赠。</p><h3>添加机器人</h3><form class="community-form" id="robot-create">'+fields()+'</form><h3>现有机器人 · '+data.items.length+'</h3><div id="robot-list">'+data.items.map(r=>'<form class="community-form" data-robot-id="'+r.id+'">'+fields(r)+'</form>').join('')+'</div>';
 for(const form of $('#panel').querySelectorAll('form'))form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]'),id=Number(form.dataset.robotId),robot=data.items.find(x=>x.id===id);button.disabled=true;status.textContent='正在保存…';
  try{await api('/api/admin/company-robots'+(id?'/'+id:''),{method:id?'PUT':'POST',body:JSON.stringify({codename:form.elements.codename.value,balance:Number(form.elements.balance.value),...(robot?{revision:robot.revision,expectedBalance:robot.balance}:{})})});await renderCompanyRobots();}
  catch(err){status.textContent=err.message;button.disabled=false;}
 };
}
