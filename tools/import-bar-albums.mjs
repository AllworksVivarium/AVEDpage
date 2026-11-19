import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,basename,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function importBarAlbums({base,cookie,directory,manifestPath=new URL('../docs/music/purrple-cat-albums.json',import.meta.url)}){
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const call=async(path,body,method=body?'POST':'GET')=>{
  const response=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Music import failed');return data;
 };
 const existing=(await call('/api/admin/bar-music')).items;let imported=0;
 for(const album of manifest.albums)for(const track of album.tracks){
  const path=resolve(directory,track.file),within=relative(resolve(directory),path);
  if(within.startsWith('..')||isAbsolute(within))throw Error('Audio path must stay inside its source directory');
  const buffer=await readFile(path);if(createHash('sha256').update(buffer).digest('hex')!==track.sha256)throw Error('Audio checksum mismatch: '+track.title);
  const metadata={title:track.title,artist:album.artist,album:album.title,trackNumber:track.trackNumber,durationSeconds:track.durationSeconds,license:album.license,licenseUrl:album.licenseUrl,sourceUrl:album.sourceUrl};
  const old=existing.find(t=>t.title===track.title&&t.artist===album.artist&&t.album===album.title);
  if(old){await call('/api/admin/bar-music/'+old.id,metadata,'PUT');continue;}
  await call('/api/admin/bar-music/upload',{...metadata,fileName:basename(path),data:buffer.toString('base64')});imported++;
 }
 return {imported,total:manifest.albums.reduce((sum,a)=>sum+a.tracks.length,0),albums:manifest.albums.map(a=>a.title)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=process.env.AVED_BAR_IMPORT_URL||'http://127.0.0.1:4173',directory=process.argv[2],manifestPath=process.argv[3]?resolve(process.argv[3]):undefined;
 if(!directory||!process.env.AVED_BAR_IMPORT_COOKIE)throw Error('Provide an audio folder, optional manifest path and AVED_BAR_IMPORT_COOKIE');
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw Error('Run this importer on the intended application host using its loopback URL');
 console.log(JSON.stringify(await importBarAlbums({base,cookie:process.env.AVED_BAR_IMPORT_COOKIE,directory,manifestPath})));
}
