window.AVEDBarJukeboxCatalog=function({root,esc,onChange,onPreview=()=>{}}){
 const host=root.querySelector('[data-juke-tracks]');host.classList.add('bar-jukebox-library');
 let albumId=null,trackId=null,whole=false,catalog=[],albums=[],renderKey='';
 const time=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 const credit=track=>track.artist?' <span class="bar-track-artist">— '+esc(track.artist)+'</span>':'';
 function render(music,price){
  catalog=music?.enabled?music.tracks||[]:[];
  const mapped=new Set(),groups=(music?.albums||[]).map(album=>({...album,tracks:album.trackIds.map(id=>catalog.find(t=>t.id===id)).filter(Boolean)})).filter(a=>a.tracks.length);
  for(const album of groups)for(const track of album.tracks)mapped.add(track.id);
  const loose=catalog.filter(t=>!mapped.has(t.id));if(loose.length)groups.push({id:'singles',title:'单曲',artist:'',tracks:loose});albums=groups;
  const album=albums.find(a=>a.id===albumId);if(!album){albumId=null;trackId=null;whole=false;}
  if(!album?.tracks.some(t=>t.id===trackId))trackId=null;
  const key=JSON.stringify([albums,albumId,trackId,whole,price]);
  if(renderKey!==key){
   renderKey=key;host.setAttribute('aria-label',album?'专辑 '+album.title:'可点播专辑');
   host.innerHTML=!catalog.length?'<p class="bar-extra-empty">唱片还没送到。</p>':!album?
    '<div class="bar-album-grid">'+albums.map(a=>`<button type="button" class="bar-album-cover" data-juke-album="${esc(a.id)}" aria-label="打开专辑 ${esc(a.title)}"><span class="bar-album-disc" aria-hidden="true"></span><b>${esc(a.title)}</b>${a.artist?`<span>${esc(a.artist)}</span>`:''}<small>${a.tracks.length} 首 · ${time(a.tracks.reduce((sum,t)=>sum+(t.durationSeconds||180),0))}</small></button>`).join('')+'</div>':
    `<div class="bar-album-heading"><button type="button" data-juke-back>← 返回专辑</button><h4 tabindex="-1">${esc(album.title)}</h4>${album.artist?`<span>${esc(album.artist)}</span>`:''}</div>`+
    (album.id==='singles'?'':`<button type="button" class="bar-album-whole" data-juke-whole aria-pressed="${whole}"><span>整张点播 · ${album.tracks.length} 首</span><small>${(price*album.tracks.length).toLocaleString()} ¤</small></button>`)+
    '<div class="bar-album-tracks">'+album.tracks.map((t,index)=>`<div class="bar-track-row"><button type="button" data-song="${t.id}" aria-pressed="${!whole&&trackId===t.id}"><span class="bar-track-number">${String(index+1).padStart(2,'0')}</span><span class="bar-track-copy">${esc(t.title)}${credit(t)}</span><small>${time(t.durationSeconds||180)}</small></button><button type="button" class="bar-track-preview" data-song-preview="${t.id}" aria-label="试听 ${esc(t.title)}">试听</button></div>`).join('')+'</div>'+
    (album.tracks[0]?.sourceUrl?`<p class="bar-album-license"><a href="${esc(album.tracks[0].sourceUrl)}" target="_blank" rel="noopener noreferrer">曲目来源 ↗</a>${album.tracks[0].licenseUrl?`<a href="${esc(album.tracks[0].licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(album.tracks[0].license||'许可')} ↗</a>`:''}</p>`:'');
  }
  return whole&&album&&album.id!=='singles'?{request:{albumId:album.id},count:album.tracks.length}:trackId?{request:{trackId},count:1}:null;
 }
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-juke-album],[data-juke-back],[data-song],[data-song-preview],[data-juke-whole]');if(!button||root.querySelector('[type=submit]')?.dataset.busy==='true')return;
  if(button.hasAttribute('data-song-preview')){const track=catalog.find(t=>t.id===Number(button.dataset.songPreview));if(track)onPreview(track);return;}
  let focus;
  if(button.hasAttribute('data-juke-album')){albumId=button.dataset.jukeAlbum;trackId=null;whole=false;focus='.bar-album-heading h4';}
  else if(button.hasAttribute('data-juke-back')){focus='[data-juke-album="'+albumId+'"]';albumId=null;trackId=null;whole=false;}
  else if(button.hasAttribute('data-juke-whole')){whole=true;trackId=null;focus='[data-juke-whole]';}
  else {trackId=Number(button.dataset.song);whole=false;const track=catalog.find(t=>t.id===trackId);if(track)onPreview(track);focus='[data-song="'+trackId+'"]';}
  onChange();host.querySelector(focus)?.focus({preventScroll:true});
 });
 return {render,clearSelection(){trackId=null;whole=false;}};
};
