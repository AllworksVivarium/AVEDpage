/* Only leaf drinks can be ordered. Families are a compact view of the same server catalog. */
window.AVEDBarMenuCatalog=(()=>{
 function entries(drinks,groupId=null){
  const sale=drinks.filter(drink=>drink.orderable!==false).sort((a,b)=>a.price-b.price);
  if(groupId)return sale.filter(drink=>drink.menuGroup?.id===groupId);
  const families=new Map(),result=[];
  for(const drink of sale){
   if(!drink.menuGroup){result.push(drink);continue;}
   const id=drink.menuGroup.id;
   if(!families.has(id)){const family={...drink,id:'family-'+id,name:drink.menuGroup.name,groupId:id,choices:0,minPrice:drink.price,maxPrice:drink.price};families.set(id,family);result.push(family);}
   const family=families.get(id);family.choices++;family.maxPrice=Math.max(family.maxPrice,drink.price);
  }
  const priority=entry=>entry.id==='mineral-water'?0:entry.groupId==='jelly'?1:entry.groupId==='soft'?2:3;
  return result.sort((a,b)=>priority(a)-priority(b)||a.price-b.price);
 }
 return {entries};
})();
