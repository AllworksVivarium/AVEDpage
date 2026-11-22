(function(){
 function mount({api,getUser,onChange,showToast}){
  const trigger=document.getElementById('account-settings-btn');
  if(!trigger)return {close(){}};
  const dialog=document.createElement('dialog');
  dialog.id='account-settings-dialog';dialog.className='account-settings-window';dialog.setAttribute('aria-labelledby','account-settings-title');
  dialog.innerHTML='<header><h2 id="account-settings-title">设置</h2><button type="button" data-account-close aria-label="关闭设置">×</button></header><form id="cloud-account-form"><fieldset><legend>账号设置</legend><label>登录用户名<input name="username" required maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false"></label><label>当前密码<input name="currentPassword" type="password" maxlength="1024" autocomplete="current-password" placeholder="修改用户名或密码时填写"></label><label>新密码<input name="password" type="password" minlength="6" maxlength="1024" autocomplete="new-password" placeholder="留空则不修改"></label><label data-account-confirm hidden>确认新密码<input name="passwordConfirmation" type="password" maxlength="1024" autocomplete="new-password" placeholder="修改密码时填写"></label></fieldset><p data-account-error role="alert"></p><footer><button type="submit">保存</button><button type="button" data-account-close>取消</button></footer></form>';
  document.body.append(dialog);const form=dialog.querySelector('form'),error=dialog.querySelector('[data-account-error]'),submit=form.querySelector('[type=submit]');let busy=false;
  function sync(){const changed=form.elements.username.value.trim()!==(getUser()?.account||'')||!!form.elements.password.value;form.elements.currentPassword.required=changed;form.elements.passwordConfirmation.required=!!form.elements.password.value;dialog.querySelector('[data-account-confirm]').hidden=!form.elements.password.value;if(!form.elements.password.value)form.elements.passwordConfirmation.value='';submit.disabled=busy||!changed;}
  trigger.addEventListener('click',()=>{const user=getUser();if(!user)return;form.reset();error.textContent='';form.elements.username.value=user.account||'';sync();dialog.showModal();});
  form.addEventListener('input',()=>{error.textContent='';sync();});
  dialog.querySelectorAll('[data-account-close]').forEach(button=>button.onclick=()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{form.reset();error.textContent='';trigger.focus();});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!getUser())return;
   const owner=getUser().id,previous=getUser().account,data=Object.fromEntries(new FormData(form));
   if(data.password!==data.passwordConfirmation){error.textContent='两次输入的新密码不一致。';return;}
   busy=true;form.querySelectorAll('input,button').forEach(element=>element.disabled=true);dialog.querySelector('header button').disabled=true;dialog.setAttribute('aria-busy','true');
   try{
    const result=await api('/api/account',{method:'PUT',body:data,retries:0});
    if(getUser()?.id!==owner||getUser()?.account!==previous){dialog.close();return;}
    onChange(result.account.username);dialog.close();showToast(result.account.username!==previous?'登录用户名已更新。':'登录密码已更新。','success');
   }catch(failure){if(failure.status===401){dialog.close();showToast(failure.message,'warn');}else error.textContent=failure.message;}
   finally{busy=false;form.querySelectorAll('input,button').forEach(element=>element.disabled=false);dialog.querySelector('header button').disabled=false;dialog.removeAttribute('aria-busy');sync();}
  });
  return {close(){if(dialog.open)dialog.close();}};
 }
 window.AVEDAccountSettings={mount};
})();
