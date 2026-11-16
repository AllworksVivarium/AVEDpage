(function(root){
 const BASE='/assets/income-voice/receipt-v2/';
 const available=new Set([0,1,5,11,37,100,102,108,112,113,114,137,155,175,200,202,205,208,211,213,214,237,255,275,300,303,305,306,309,311,312,313,314,337,355,375,400,405,406,408,411,412,416,437,455,475,500,502,505,511,512,513,514,537,555,575,600,605,607,608,611,614,637,655,675,700,701,703,705,708,709,712,713,737,755,775,800,801,802,806,807,812,813,837,855,875,900,901,902,905,906,908,911,912,913,914,916,937,955,975,1013,1014,1016,1037,1055,1075,1103,1200,1202,1205,1206,1207,1208,1209,1216,1237,1255,1275,1300,1302,1309,1311,1337,1355,1375,1403,1416,1437,1455,1475,1500,1600,1602,1608,1611,1637,9001,9002,9003]);
 const aliases={"2":1,"3":1,"6":1,"7":1,"8":1,"9":1,"101":102,"103":102,"105":102,"106":102,"107":102,"109":102,"111":108,"116":102,"201":214,"203":214,"206":214,"207":214,"209":214,"212":214,"216":211,"301":311,"302":311,"307":311,"308":311,"316":311,"401":406,"402":406,"403":412,"407":412,"409":406,"413":408,"414":412,"501":502,"503":512,"506":502,"507":502,"508":502,"509":511,"516":502,"601":607,"602":607,"603":607,"606":607,"609":607,"612":614,"613":611,"616":614,"702":701,"706":703,"707":709,"711":709,"714":709,"716":701,"803":812,"805":801,"808":813,"809":807,"811":807,"814":807,"816":801,"903":912,"907":901,"909":911,"1100":1103,"1101":1103,"1102":1103,"1105":1103,"1106":1103,"1107":1103,"1108":1103,"1109":1103,"1201":1216,"1203":1207,"1211":1207,"1301":1302,"1303":1302,"1305":1309,"1306":1302,"1307":1302,"1308":1302,"1316":1302,"1400":1403,"1401":1416,"1402":1403,"1405":1403,"1406":1403,"1407":1403,"1408":1403,"1409":1403,"1411":1403};
 function resolveClip(id){
  let key=id;
  for(let i=0;i<4;i++){if(available.has(key))return key;if(aliases[key]===undefined)break;key=aliases[key];}
  const base=Math.floor(id/100)*100;
  return available.has(base)?base:available.has(aliases[base])?aliases[base]:137;
 }
 function sequence(amount){
  if(!Number.isSafeInteger(amount)||amount<=0)throw Error('请提供有效的到账金额。');
  const digits=String(Math.min(amount,999999999999)),units=[12,13,14,15,12,13,14,16],tokens=[0,9001];
  let position;
  if(digits.length===2&&digits[0]==='1')position=0;
  else{tokens.push(Number(digits[0]));position=digits.length-2;}
  if(digits.length>=2){
   tokens.push(units[position&7]);position--;
   for(let i=1;i<digits.length;i++,position--){
    const digit=Number(digits[i]),previous=Number(digits[i-1]),remaining=digits.length-i;
    if(digit===0){
     const place=position>=0?position&7:-((-position)&7);
     if(place===7)tokens.push(16);
     else if(place===3&&(i<3||digits[i-1]!=='0'||digits[i-2]!=='0'||digits[i-3]!=='0'))tokens.push(15);
    }else{
     if(previous===0)tokens.push(0);
     tokens.push(digit);if(remaining>=2)tokens.push(units[(remaining+6)&7]);
    }
   }
  }
  tokens.push(17);
  // Preserve the supplied voice bank's contextual syllables and sentence endings.
  for(let i=2;i<tokens.length-1;i++)if(tokens[i]===2&&tokens[i+1]>=14&&tokens[i+1]<=16&&![0,11,12].includes(tokens[i-1]))tokens[i]=10;
  const clips=[];
  for(let i=2;i<tokens.length-1;){
   const current=tokens[i],next=tokens[i+1];
   let id=current===16&&next!==17?9002:current*100+(next===4?3:next);
   if(next===15){id+=40;i+=2;if(tokens[i]===17)id+=20;}
   else{i++;if(next===17)id+=20;}
   clips.push(id);
  }
  if(clips.length===1&&clips[0]===175)clips[0]=9003;
  return ['arrived',...clips.map(id=>'clip-'+resolveClip(id))];
 }
 // Preserve consonant attacks and a short final tail while removing recording gaps.
 function trim(samples,rate,first,last){
  let start=0,end=samples.length;
  while(start<end&&Math.abs(samples[start])<.0045)start++;
  while(end>start&&Math.abs(samples[end-1])<.0045)end--;
  if(start===end)return new Float32Array(0);
  return samples.slice(Math.max(0,start-Math.round(rate*(first?.012:.006))),Math.min(samples.length,end+Math.round(rate*(last?.035:.01))));
 }
 function stitch(parts,rate){
  const clips=parts.map((part,i)=>trim(part,rate,i===0,i===parts.length-1)).filter(part=>part.length);
  const out=new Float32Array(clips.reduce((sum,part)=>sum+part.length,0));let end=0;
  clips.forEach((part,i)=>{
   const overlap=i?Math.min(Math.round(rate*.01),Math.floor(part.length/3),Math.floor(end/3)):0,start=end-overlap;
   for(let p=0;p<overlap;p++){const mix=(p+1)/(overlap+1);out[start+p]=out[start+p]*(1-mix)+part[p]*mix;}
   out.set(part.subarray(overlap),end);end+=part.length-overlap;
  });
  return out.slice(0,end);
 }
 // Start speech 200 ms after the coin attack, with a softer tail under the words.
 function mixReceipt(chime,samples,rate){
  const voiceStart=Math.round(.2*rate),voiceLength=Math.ceil(samples.length/1.05),output=new Float32Array(Math.max(chime.length,voiceStart+voiceLength));
  for(let i=0;i<chime.length;i++){const duck=Math.min(1,Math.max(0,(i/rate-.12)/.08));output[i]=chime[i]*(1-duck*.65);}
  for(let i=0;i<voiceLength;i++){const position=i*1.05,left=Math.floor(position),right=Math.min(samples.length-1,left+1),mix=position-left;output[voiceStart+i]+=samples[left]*(1-mix)+samples[right]*mix;}
  let peak=1;for(const value of output)peak=Math.max(peak,Math.abs(value));if(peak>1)for(let i=0;i<output.length;i++)output[i]/=peak;
  return output;
 }
 function create({AudioContext=root.AudioContext||root.webkitAudioContext,fetcher=root.fetch?.bind(root)}={}){
  const cache=new Map();let context=null,source=null,finish=null,serial=0;
  function unlock(){
   if(!AudioContext||!fetcher)return Promise.reject(Error('请使用支持音频播放的浏览器。'));
   if(!context)context=new AudioContext({sampleRate:24000});
   return context.state==='suspended'?context.resume():Promise.resolve();
  }
  function cancel(){serial++;if(source){try{source.stop();}catch{}source.disconnect();source=null;}if(finish){finish();finish=null;}}
  function load(name){
   if(cache.has(name))return cache.get(name);
   const task=(async()=>{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
    try{const response=await fetcher(BASE+name+'.mp3',{signal:abort.signal});if(!response.ok)throw Error('音频加载失败，请点击试听重试。');
     const audio=await context.decodeAudioData(await response.arrayBuffer());return audio.getChannelData(0).slice();
    }finally{clearTimeout(timer);}
   })();cache.set(name,task);task.catch(()=>{if(cache.get(name)===task)cache.delete(name);});return task;
  }
  async function speak(amount,volume=.8){
   cancel();const token=serial;await unlock();if(token!==serial)return;
   if(context.state!=='running')throw Error('请点击试听以启用音频播放。');
   const [parts,chime]=await Promise.all([Promise.all(sequence(amount).map(load)),load(amount<100?'chime-small':'chime-large')]);if(token!==serial)return;
   const rate=context.sampleRate,samples=stitch(parts,rate);if(!samples.length)throw Error('音频为空，请重新加载页面。');
   const output=mixReceipt(chime,samples,rate);
   const buffer=context.createBuffer(1,output.length,rate);buffer.copyToChannel(output,0);
   const gain=context.createGain();gain.gain.value=Math.min(1,Math.max(0,volume));gain.connect(context.destination);
   const node=context.createBufferSource();source=node;node.buffer=buffer;node.connect(gain);
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{if(source===node)cancel();},Math.ceil(buffer.duration*1000)+2000);
    let settled=false;const done=error=>{if(settled)return;settled=true;clearTimeout(timer);node.disconnect();gain.disconnect();if(source===node)source=null;if(finish===done)finish=null;error?reject(error):resolve();};
    finish=done;node.onended=()=>done();try{node.start();}catch(e){done(e);}
   });
  }

  return {available:!!AudioContext&&!!fetcher,unlock,speak,cancel,close(){cancel();cache.clear();if(context){context.close();context=null;}}};
 }
 root.AVEDReceiptAudio={create,sequence,trim,stitch,mixReceipt};
})(globalThis);
