import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import sharp from 'sharp';
import {forumReactionCatalog} from '../server-forum-reactions.mjs';

test('all approved reactions have matching names and visible pixel artwork with only local transparent assets',async()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/forum-reaction-art.js',import.meta.url),'utf8'),{window});const {art,icon}=window.AVEDForumReactionArt;
 const approved=["+1","心动一下","大拇指","鲜花","值得表彰","满分！","这杯敬你","醍醐灌顶","对勾","围观","中","我扇！","闪耀登场","热度拉满","肃然起敬","猪","思考","问号"];
 assert.deepEqual(forumReactionCatalog.map(x=>x.name),approved);
 for(const item of forumReactionCatalog){
  assert.equal(art[item.id][0],item.name);const svg=icon(item.id);assert.ok(svg.includes('viewBox="0 0 32 32"'));assert.ok(!/<text|https?:/.test(svg));
  let embedded=svg;
  for(const [attribute,url] of svg.matchAll(/href="([^"]+)"/g)){
   assert.match(url,/^\/assets\/forum-reactions\/[a-z-]+\.webp\?v=[a-z0-9-]+$/);
   const bytes=readFileSync(new URL('../public'+url.split('?')[0],import.meta.url));
   assert.equal((await sharp(bytes).metadata()).hasAlpha,true);
   // librsvg's image loader needs PNG; browsers decode the original WebP.
   embedded=embedded.replace(attribute,'href="data:image/png;base64,'+(await sharp(bytes).png().toBuffer()).toString('base64')+'"');
  }
  const {data,info}=await sharp(Buffer.from(embedded.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let visible=0;for(let i=3;i<data.length;i+=info.channels)if(data[i])visible++;assert.ok(visible>70&&visible<1024,item.name+' must remain legible with a transparent background');
 }
});

test('saluting hand is a separate layer and old eyes keep their movable pupils',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/forum-reaction-art.js',import.meta.url),'utf8'),{window});
 const {icon}=window.AVEDForumReactionArt;
 assert.match(icon('applause'),/salute-face/);assert.match(icon('applause'),/reaction-part-hand.*salute-hand/);
 assert.match(icon('eyes'),/reaction-part-pupils/);assert.ok(!icon('eyes').includes('<image'));
 const css=readFileSync(new URL('../public/forum-reactions.css',import.meta.url),'utf8');
 assert.match(css,/reaction-part-hand\{[^}]*animation:reaction-salute-hand/);
 assert.ok(!/reaction-motion-salute\{[^}]*animation/.test(css));
});
