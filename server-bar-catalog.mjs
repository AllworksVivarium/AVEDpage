import {readFileSync} from 'node:fs';
export const barDrinks=Object.freeze(JSON.parse(readFileSync(new URL('./public/assets/bar/catalog.json',import.meta.url),'utf8')).map(({id,name,image,price})=>Object.freeze({id,name,image,price})));
