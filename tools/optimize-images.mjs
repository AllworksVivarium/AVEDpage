// Build-time only: keep original artwork in Git history, ship bounded WebP assets.
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,basename} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split('\n');
const images=tracked.filter(f=>/^public\/assets\/.*\.(png|jpe?g)$/.test(f));
const replacements=[],report=[];
for(const file of images){
 const input=await readFile(resolve(root,file));
 const bytes=await sharp(input).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:84,alphaQuality:95,effort:6}).toBuffer();
 const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
 const target=file.replace(/\.(png|jpe?g)$/,'.'+hash+'.webp');
 await writeFile(resolve(root,target),bytes);
 replacements.push([file.slice(7),target.slice(7)]);
 report.push({file:basename(file),output:basename(target),before:input.length,after:bytes.length});
}
for(const file of tracked.filter(f=>/\.(html|css|js|json|mjs|md)$/.test(f)&&!f.startsWith('tools/vendor/'))){
 const path=resolve(root,file),source=await readFile(path,'utf8');let result=source;
 for(const [before,after] of replacements)result=result.replaceAll(before,after).replaceAll(basename(before),basename(after));
 if(result!==source)await writeFile(path,result);
}
for(const file of images)await unlink(resolve(root,file));
console.log(JSON.stringify({before:report.reduce((n,x)=>n+x.before,0),after:report.reduce((n,x)=>n+x.after,0),images:report},null,2));
