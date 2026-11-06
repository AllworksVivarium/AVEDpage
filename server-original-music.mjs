// Original instrumental sketches synthesized locally, without external samples.
const tracks=[
 {id:'night-transit',title:'夜航信号 / Night Transit',bpm:92,root:45},
 {id:'containment-lights',title:'收容灯列 / Containment Lights',bpm:84,root:48},
 {id:'empty-corridor',title:'无人走廊 / Empty Corridor',bpm:100,root:43}
];
async function synth(track){
 const rate=22050,beat=60/track.bpm,seconds=beat*64,count=Math.floor(rate*seconds),buffer=Buffer.alloc(44+count*2);
 buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
 const hz=note=>440*2**((note-69)/12),chords=[0,5,3,7],arp=[0,7,12,15,12,7,3,7];let noise=1977;
 for(let start=0;start<count;start+=22050){for(let i=start;i<Math.min(count,start+22050);i++){
  const t=i/rate,b=t/beat,bar=Math.floor(b/4),root=track.root+chords[Math.floor(bar/2)%4],phase=(b%1)*beat,half=(b*2%1)*beat/2;
  const pad=[0,3,7].reduce((sum,n)=>sum+Math.sin(2*Math.PI*hz(root+12+n)*t)+.25*Math.sin(2*Math.PI*hz(root+12+n)*1.003*t),0)*.037;
  const bass=(Math.sin(2*Math.PI*hz(root-12)*t)+.22*Math.sin(4*Math.PI*hz(root-12)*t))*.18*Math.exp(-phase*4);
  const melody=Math.sin(2*Math.PI*hz(root+12+arp[Math.floor(b*2)%8])*t)*.09*Math.exp(-half*12);
  const kick=Math.sin(2*Math.PI*(48*phase+3*(1-Math.exp(-phase*22))))*.24*Math.exp(-phase*20);
  noise=(Math.imul(noise,1664525)+1013904223)|0;const hiss=noise/2147483648,hat=hiss*.035*Math.exp(-half*60),snare=(Math.floor(b)%2?hiss*.08*Math.exp(-phase*28):0);
  const fade=Math.min(1,t/2,(seconds-t)/3),sample=Math.tanh((pad+bass+melody+kick+hat+snare)*1.2)*fade;
  buffer.writeInt16LE(Math.round(sample*28000),44+i*2);
 }await new Promise(resolve=>setImmediate(resolve));}
 return buffer;
}
export function installOriginalMusic({db,requireEmployee}) {
 db.prepare("UPDATE music_tracks SET kind='音乐' WHERE kind IN ('lofi','synthwave')").run();
 const cache=new Map();
 db.exec('CREATE TABLE IF NOT EXISTS content_initializations(name TEXT PRIMARY KEY)');
 if(!db.prepare("SELECT 1 FROM content_initializations WHERE name='original-music'").get()){
 for(const track of tracks){const url='/api/music/original/'+track.id+'.wav';if(!db.prepare('SELECT 1 FROM music_tracks WHERE url=?').get(url))db.prepare('INSERT INTO music_tracks(title,url,kind) VALUES(?,?,?)').run(track.title,url,'音乐');}
 db.prepare("INSERT INTO content_initializations VALUES('original-music')").run();
 }
 return {async handle(req,res,url){
  const match=url.pathname.match(/^\/api\/music\/original\/([-a-z]+)\.wav$/);if(!match)return false;if(!requireEmployee(req,res))return true;
  if(!db.prepare('SELECT 1 FROM music_tracks WHERE url=? AND enabled=1').get(url.pathname)){res.writeHead(404);res.end();return true;}
  const track=tracks.find(x=>x.id===match[1]);if(!track){res.writeHead(404);res.end();return true;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return true;}
  if(!cache.has(track.id))cache.set(track.id,synth(track).catch(e=>{cache.delete(track.id);throw e;}));const data=await cache.get(track.id);
  const headers={'Content-Type':'audio/wav','Accept-Ranges':'bytes','Cache-Control':'private, max-age=86400'};let start=0,end=data.length-1,status=200;
  if(req.headers.range){const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!range||!range[1]&&!range[2]){res.writeHead(416,{'Content-Range':'bytes */'+data.length});res.end();return true;}if(range[1]){start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}else start=Math.max(0,data.length-Number(range[2]));if(start>end||start>=data.length){res.writeHead(416,{'Content-Range':'bytes */'+data.length});res.end();return true;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;}
  res.writeHead(status,{...headers,'Content-Length':end-start+1});res.end(req.method==='HEAD'?undefined:data.subarray(start,end+1));return true;
 }};
}
