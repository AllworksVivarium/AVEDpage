import {readFileSync} from 'node:fs';
export const barDrinks=Object.freeze(JSON.parse(readFileSync(new URL('./public/assets/bar/catalog.json',import.meta.url),'utf8')).map(item=>{
 const {id,name,image,images,price,width,height,orderable=true,displayScale=1,contentBox=[0,0,width,height],container=id.startsWith('energy-jelly')?'pouch':id==='lemon-cocktail'||id.endsWith('-shot')?'glass':'bottle',pourable=container==='bottle',serving,liquidColor,pixelArt,ice=false,menuGroup}=item;
 return Object.freeze({id,name,image,price,width,height,orderable,displayScale,contentBox,container,pourable,ice,...(menuGroup?{menuGroup:Object.freeze(menuGroup)}:{}),...(serving?{serving:Object.freeze(serving)}:{}),...(liquidColor?{liquidColor}:{}),...(pixelArt?{pixelArt:Object.freeze(pixelArt)}:{}),...(images?.length?{images:Object.freeze(images)}:{})});
}).sort((a,b)=>a.price-b.price));
