(function(){
 const key='aved_admin_theme_v1',themes={black:{name:'黑色模式',icon:'☾'},beige:{name:'米色模式',icon:'☀'},sage:{name:'护眼模式',icon:'♧'}};
 let selected='black';try{const value=localStorage.getItem(key);if(Object.hasOwn(themes,value))selected=value;}catch{}
 function apply(value){
  selected=value;document.documentElement.dataset.adminTheme=value;
  const button=document.getElementById('adminThemeToggle');if(!button)return;
  button.textContent=themes[value].icon+' '+themes[value].name;
  const order=['black','beige','sage'],next=order[(order.indexOf(value)+1)%order.length];
  button.setAttribute('aria-label','当前'+themes[value].name+'，切换为'+themes[next].name);button.title='切换显示模式：黑色、米色、护眼';
 }
 apply(selected);
 document.addEventListener('DOMContentLoaded',()=>{
  apply(selected);document.getElementById('adminThemeToggle')?.addEventListener('click',()=>{
   const order=['black','beige','sage'];apply(order[(order.indexOf(selected)+1)%order.length]);try{localStorage.setItem(key,selected);}catch{}
  });
 });
})();
