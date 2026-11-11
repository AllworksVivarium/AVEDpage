import {readFileSync} from 'node:fs';
export const barDrinks=Object.freeze(JSON.parse(readFileSync(new URL('./public/assets/bar/catalog.json',import.meta.url),'utf8')).map(({id,name,image,price,width,height,orderable=true,displayScale=1,contentBox=[0,0,width,height]})=>Object.freeze({id,name,image,price,width,height,orderable,displayScale,contentBox})));
