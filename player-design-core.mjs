import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
export const catalog=createRequire(import.meta.url)('./public/player-type-catalog.js');
export const designHash=value=>createHash('sha256').update(value).digest('hex');
export function decodeDesignFont(font){
  if(!/^user_[a-f0-9]{32}$/.test(font?.id)||typeof font.name!=='string'||font.name.length>200)throw Error('字体信息无效。');
  if(typeof font.base64!=='string'||font.base64.length>90*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(font.base64))throw Error('字体文件无效或过大。');
  const bytes=Buffer.from(font.base64,'base64');if(bytes.length<12||bytes.length>64*1024*1024)throw Error('字体文件无效或超过 64 MB。');
  const signature=bytes.subarray(0,4).toString('latin1');
  const format={'\x00\x01\x00\x00':'ttf',OTTO:'otf',wOFF:'woff',wOF2:'woff2'}[signature];
  if(!format)throw Error('仅支持 TTF、OTF、WOFF、WOFF2 字体。');
  return {id:font.id,name:font.name,languages:['zh','en','he'],bytes,format,hash:designHash(bytes)};
}
export function sanitizeDesign(settings,fonts){
  if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('排版设置无效。');
  const library=[...catalog.fonts,...fonts];
  for(const value of Object.values(settings))for(const lang of ['zh','en','he'])if(value?.[lang]&&!library.some(f=>f.id===value[lang]&&f.languages.includes(lang)))throw Error('请先上传所选字体。');
  return catalog.sanitize(settings,library);
}
