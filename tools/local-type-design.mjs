import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {decodeDesignFont,sanitizeDesign,designHash} from '../player-design-core.mjs';
export async function saveProjectType(root,input){
  const path=resolve(root,'public/player-type-design.json');
  let previous={fonts:[]};try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!Array.isArray(input.fonts)||input.fonts.length>48)throw Error('字体清单无效。');
  const fonts=[];
  for(const item of input.fonts){
    if(item.base64){const font=decodeDesignFont(item),url='/assets/fonts/design/'+font.hash+'.'+font.format;
      await mkdir(resolve(root,'public/assets/fonts/design'),{recursive:true});await writeFile(resolve(root,'public'+url),font.bytes);
      fonts.push({id:font.id,name:font.name,languages:font.languages,url});
    }else{const font=previous.fonts.find(f=>f.id===item.id);if(!font)throw Error('请重新导入缺失的字体。');fonts.push(font);}
  }
  const settings=sanitizeDesign(input.settings,fonts),body=JSON.stringify({version:1,settings,fonts},null,2)+'\n';
  const history=resolve(root,'.local-text-history');await mkdir(history,{recursive:true});
  await writeFile(resolve(history,'type-'+randomBytes(8).toString('hex')+'.json'),JSON.stringify(previous));
  const temp=path+'.'+randomBytes(5).toString('hex')+'.tmp';
  try{await writeFile(temp,body,{flag:'wx'});try{await rename(temp,path);}catch(e){if(process.platform!=='win32'||!['EPERM','EACCES'].includes(e.code))throw e;await writeFile(path,body);}}finally{await unlink(temp).catch(()=>{});}
  return {ok:true,settings,fonts,revision:designHash(body)};
}
