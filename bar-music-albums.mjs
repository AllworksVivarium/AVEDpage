import {createHash} from 'node:crypto';

export function groupMusicAlbums(tracks){
 const groups=new Map();
 for(const track of tracks){
  if(!track.album)continue;
  const id=createHash('sha256').update(JSON.stringify([track.artist||'',track.album])).digest('hex').slice(0,24);
  if(!groups.has(id))groups.set(id,{id,title:track.album,artist:track.artist||'',tracks:[]});
  groups.get(id).tracks.push(track);
 }
 return [...groups.values()].map(album=>({...album,tracks:album.tracks.sort((a,b)=>(a.trackNumber||9999)-(b.trackNumber||9999)||a.id-b.id)}));
}

export function musicMetadata(data,previous={}){
 const out={};
 for(const [field,max] of [['artist',100],['album',100],['license',100],['licenseUrl',2048],['sourceUrl',2048]]){
  const value=data[field]===undefined?previous[field]||'':data[field];
  if(typeof value!=='string'||value.trim().length>max||/[\u0000-\u001f]/.test(value))throw Error('音乐署名或专辑信息无效。');
  out[field]=value.trim();
  if(field.endsWith('Url')&&out[field]){let url;try{url=new URL(out[field]);}catch{throw Error('音乐来源和许可链接须使用 HTTPS。');}if(url.protocol!=='https:'||url.username||url.password)throw Error('音乐来源和许可链接须使用 HTTPS。');}
 }
 out.trackNumber=data.trackNumber===undefined?previous.trackNumber||0:data.trackNumber;
 if(!Number.isSafeInteger(out.trackNumber)||out.trackNumber<0||out.trackNumber>999)throw Error('专辑曲序须为 0–999 的整数。');
 return out;
}
