(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AVEDPersonnelName=api;})(globalThis,function(){
 function normalizeRealName(value){
  if(typeof value!=='string')return value;
  const name=value.trim();
  return /^[A-Za-z][A-Za-z .'’-]*$/.test(name)?name[0].toUpperCase()+name.slice(1):name;
 }
 return {normalizeRealName};
});
