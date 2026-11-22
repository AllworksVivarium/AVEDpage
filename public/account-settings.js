/* Credential fields share the personal dossier form and its single atomic save. */
(function(){
 function mount({form,getUser}){
  const dialog=form.closest('dialog'),fields=form.elements;
  function sync(){
   const changingPassword=fields.password.value!=='',changed=changingPassword||fields.username.value.trim()!==(getUser()?.account||'');
   form.querySelector('[data-current-password]').hidden=!changed;
   fields.currentPassword.required=changed;fields.currentPassword.disabled=!changed;
   form.querySelector('[data-password-confirm]').hidden=!changingPassword;
   fields.passwordConfirmation.required=changingPassword;fields.passwordConfirmation.disabled=!changingPassword;
   if(!changingPassword)fields.passwordConfirmation.value='';
   fields.passwordConfirmation.setCustomValidity(changingPassword&&fields.passwordConfirmation.value&&fields.passwordConfirmation.value!==fields.password.value?'两次输入的新密码不一致。':'');
  }
  function clear(){
   fields.username.value=getUser()?.account||'';
   for(const key of ['password','currentPassword','passwordConfirmation'])fields[key].value='';
   sync();
  }
  form.addEventListener('input',sync);
  dialog.addEventListener('close',clear);
  sync();
  return {clear,sync};
 }
 window.AVEDAccountSettings={mount};
})();
