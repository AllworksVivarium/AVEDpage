import sharp from 'sharp';
const pattern=/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
sharp.cache({memory:16,files:0,items:32});sharp.concurrency(1);
let active=0;const waiting=[];
export async function avatarBytes(value,size=64){
 const match=String(value||'').match(pattern);if(!match)throw Error('头像不是本地图片。');
 const input=Buffer.from(match[1],'base64');if(input.length>1650000)throw Error('头像不能超过 1.5 MB。');
 // Bound simultaneous decoders as well as libvips threads on small servers.
 if(active>=2)await new Promise(resolve=>waiting.push(resolve));else active++;
 try{return await sharp(input,{limitInputPixels:16000000,animated:false}).rotate().resize(size,size,{fit:'cover',position:'centre'}).webp({quality:size===64?65:80,effort:3}).toBuffer();}
 finally{const next=waiting.shift();if(next)next();else active--;}
}
export async function normalizeAvatar(value){return 'data:image/webp;base64,'+(await avatarBytes(value,256)).toString('base64');}
