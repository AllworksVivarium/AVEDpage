/* Integer-grid podium sprites. Shared SVG, no image files or avatar requests. */
window.AVEDRankingArt=(()=>{
 const palette={wealth:{edge:'#51342d',metal:'#bd842e',light:'#ffe69a',seat:'#94373b',trim:'#e6b74f'},bankrupt:{edge:'#283c43',metal:'#607d83',light:'#c7d8cf',seat:'#46585b',trim:'#a5b9af'},kindness:{edge:'#633337',metal:'#ba5960',light:'#ffe0b9',seat:'#783d4f',trim:'#f09a8c'}};
 const star=(x,y,c)=>`<path fill="${c}" d="M${x} ${y-3}h2v2h2v2h-2v2h-2v-2h-2v-2h2z"/>`;
 const heart=(x,y,c)=>`<path fill="${c}" d="M${x} ${y}h4v2h2v-2h4v2h2v6h-2v2h-2v2h-2v-2h-2v-2h-2v-6h2z"/>`;
 function person(){return '<path fill="#171e22" d="M40 32h16v4h4v4h4v14H32V40h4v-4h4z"/><path fill="#f2ebd8" d="M41 34h14v4h-3v7h-8v-7h-3z"/><path fill="#171e22" d="M47 35h3v4h-1v9h-3v-9h1z"/><path fill="#343c40" d="M36 38h5l4 15h-5v-7h-4zm19 0h5v8h-4v7h-5z"/><path fill="#c8c3b0" d="M42 17h12v3h3v10h-3v3H42v-3h-3V20h3z"/><path fill="#e6e1ce" d="M42 20h12v10H42z"/><path fill="#161c20" d="M36 53h9v10h-5v3h-8v-5h4zm15 0h9v8h4v5h-8v-3h-5z"/>'}
 function coins(x,y,c){return `<path fill="${c}" d="M${x} ${y}h14v3h-14zm-2 4h18v3h-18zm0 4h18v3h-18z"/><path fill="#ffe9a0" d="M${x+2} ${y+1}h7v1h-7zm-2 4h9v1h-9zm0 4h9v1h-9z"/>`;}
 function champion(mode,p){
  const back=`<path fill="${p.edge}" d="M28 6h40v4h4v41h5v17H19V51h5V10h4z"/><path fill="${p.metal}" d="M29 11h38v43h7v11H22V54h7z"/><path fill="${p.light}" d="M31 13h3v38h-3zm31 0h3v38h-3zM25 56h46v3H25z"/><path fill="${p.seat}" d="M35 16h26v38H35zM27 52h42v7H27z"/><path fill="${p.trim}" d="M20 48h13v6H20zm43 0h13v6H63z"/>`;
  const base=`<path fill="${p.edge}" d="M19 66h58v5h7v7H12v-7h7z"/><path fill="${p.metal}" d="M22 67h52v3H22zm-7 6h66v3H15z"/><path fill="${p.light}" d="M29 68h38v1H29zm-7 6h52v1H22z"/>`;
  const crown=`<path fill="${p.edge}" d="M37 8h5v4h3V4h6v8h3V8h5v10H37z"/><path fill="${p.light}" d="M39 10h2v4h6V6h2v8h7v-4h1v6H39z"/><path fill="${p.trim}" d="M40 17h16v2H40z"/>`;
  let extras='';
  if(mode==='wealth')extras=coins(2,56,p.metal)+coins(80,55,p.metal)+`<path fill="${p.trim}" d="M6 30h8v3H6zm76 3h8v3h-8z"/>`;
  if(mode==='bankrupt')extras=`<path fill="#d3c7a6" d="M4 46h17v22H4zm73-3h16v23H77z"/><path fill="${p.edge}" d="M8 51h9v2H8zm0 5h7v2H8zm73-7h8v2h-8zm0 5h6v2h-6zM60 11h4l-4 8h4l-5 11h-3l4-9h-4z"/><path fill="#637c7f" d="M4 72h8v3H4zm81-2h8v3h-8z"/>`;
  if(mode==='kindness')extras=heart(0,48,p.trim)+heart(78,45,p.trim)+`<path fill="#edd6b3" d="M6 65h14v10H6zm71-1h16v11H77z"/><path fill="${p.metal}" d="M11 64h4v12h-4zm-6 4h16v3H5zm77-5h4v13h-4zm-6 4h18v3H76z"/>`;
  return `<g class="rank-pixel-sparks">${star(13,19,p.trim)}${star(80,16,p.light)}${star(7,37,p.light)}${star(86,36,p.trim)}</g>${back}${person()}${crown}${base}${extras}`;
 }
 function podium(mode,p,place){
  const metal=place===2?'#aebfc5':'#b77d52',light=place===2?'#e3ede3':'#e8b882';
  const theme=mode==='wealth'?coins(4,60,p.metal):mode==='kindness'?heart(6,52,p.trim):`<path fill="#c3bba4" d="M7 51h13v20H7z"/><path fill="${p.edge}" d="M10 56h7v2h-7zm0 5h5v2h-5z"/>`;
  return `<path fill="${p.edge}" d="M23 51h50v22h7v5H16v-5h7z"/><path fill="${metal}" d="M26 54h44v20H26z"/><path fill="${light}" d="M28 55h40v3H28z"/>${person()}<path fill="${metal}" d="M34 5h9v8h-4v5h-5zm19 0h9v13h-5v-5h-4z"/><path fill="${light}" d="M41 9h14v3h5v9h-5v4H41v-4h-5v-9h5z"/><path fill="${metal}" d="M43 12h10v10H43z"/><path fill="${p.edge}" d="${place===2?'M45 14h6v4h-4v1h4v2h-6v-4h4v-1h-4z':'M45 14h6v7h-6v-2h4v-1h-3v-1h3v-1h-4z'}"/>${theme}${star(82,42,light)}`;
 }
 function bill(x,y,w=16,h=21){return `<g transform="translate(${x} ${y})"><path fill="#ddd2b4" d="M0 0h${w}v${h}H0z"/><path fill="#927e67" d="M3 4h${w-6}v2H3zm0 5h${w-8}v2H3zm0 5h${w-7}v2H3z"/></g>`;}
 function broke(place,p){
  const floor='<path fill="#738078" d="M3 74h90v2H3z"/>';
  if(place===1)return floor+`<path fill="#171e22" d="M29 56h34v13H29zm32 3h21v6H61zm16-4h9v10h-9zm-11 12h19v5H66z"/><path fill="#343c40" d="M35 58h27v4H35z"/><path fill="#d4cbb4" d="M16 59h16v11H16zm15 8h17v5H31z"/><path fill="#171e22" d="M25 59h7v11h-7z"/><path fill="#a94d42" d="M31 69h9v3h-9z"/>${bill(37,40,26,15)}${bill(40,28,25,15)}${bill(35,17,26,14)}<path fill="#b46653" d="M46 19h3v9h-3zm-3 3h9v2h-9z"/><path fill="#493d32" d="M3 62h12v10H3zm1-4h8v4H4z"/><path fill="#d4cbb4" d="M5 60h5v2H5z"/><g class="rank-pixel-sparks"><path fill="#9b9581" d="M8 42h5v5H8zm6 0h5v5h-5z"/><path fill="#4e5148" d="M12 41h2v8h-2z"/></g><path fill="#738078" d="M23 48h2v6h-2zm-5 1h2v4h-2z"/>`;
  if(place===2)return floor+`<path fill="#171e22" d="M32 30h32v29H32zM23 60h24v12H23zm27 0h24v12H50zM19 34h14v7H19zm45 0h14v7H64z"/><path fill="#343c40" d="M33 31h7v25h-7zm23 0h7v25h-7z"/><path fill="#eee4cb" d="M42 31h12l-4 19h-4z"/><path fill="#c8c3b0" d="M38 7h20v20H38zM15 33h8v9h-8zm60 0h8v9h-8z"/><path fill="#52616a" d="M41 19h4v2h-4zm10 0h4v2h-4zm-7 4h9v2h-9z"/><path fill="#68a4b7" d="M39 22h3v7h-3zm15 0h3v7h-3z"/><path fill="#646c65" d="M6 40h27v20H6zm58 0h27v20H64z"/><path fill="#f1ead4" d="M8 42h23v11h-4v6H12v-6H8zm58 0h23v11h-4v6H70v-6h-4z"/><path fill="#b8ad94" d="M12 44h15v2H12zm58 0h15v2H70z"/>`;
  return floor+`<path fill="#171e22" d="M27 32h30v29H27zm-6 28h23v12H21zm27 0h19v12H48zM53 32h12V21h7v21H53z"/><path fill="#343c40" d="M29 34h7v22h-7zm20 0h6v21h-6z"/><path fill="#eee4cb" d="M38 33h12l-4 19h-4z"/><path fill="#c8c3b0" d="M33 9h20v20H33zm31 7h9v8h-9zM20 43h10v8H20z"/><path fill="#52616a" d="M36 20h4v2h-4zm8 0h4v2h-4zm-6 5h9v2h-9z"/><path fill="#49362a" d="M65 4h27v17H65z"/><path fill="#b2a17d" d="M68 7h21v6H68z"/><path fill="#292724" d="M70 9h17v4H70z"/><path fill="#846b4b" d="M67 15h23v3H67z"/><path fill="#829487" d="M78 26h2v5h-2zm0 11h2v5h-2z"/><g class="rank-pixel-sparks"><path fill="#c48a35" d="M75 51h10v8H75z"/><path fill="#ffe298" d="M77 52h6v2h-6z"/></g><path fill="#829487" d="M81 66h9v2h-9z"/>`;

 }
 function saint(place,p){
  const halo=place===1?`<path fill="#c89743" d="M35 3h26v3h8v6h5v19h-5v7h-8v3H35v-3h-8v-7h-5V12h5V6h8z"/><path fill="#e6ca76" d="M36 7h24v3h6v5h4v13h-4v6h-6v3H36v-3h-6v-6h-4V15h4v-5h6z"/>`:`<path fill="#d5b86b" d="M37 10h22v3h5v15h-5v3H37v-3h-5V13h5z"/>`;
  const lotus=`<path fill="#7d444e" d="M13 60h16v-7h12v-5h14v5h12v7h16v9H72v5H24v-5H13z"/><path fill="#c67a7e" d="M17 61h15v5h12V55h8v11h12v-5h15v6H67v4H29v-4H17z"/><path fill="#edd5b2" d="M28 74h40v3H28z"/>`;
  const aura=place===1?`<g class="rank-pixel-sparks"><path fill="#c89743" d="M46 0h4v3h-4zM12 13h6v3h-6zm65 0h6v3h-6zM9 32h6v3H9zm72 0h6v3h-6z"/>${heart(12,44,p.trim)}${heart(72,44,p.trim)}</g>`:'';
  const body=`<path fill="#171e22" d="M34 34h28v20h8v10H26V54h8z"/><path fill="#343c40" d="M35 38h7v15l-9 8h-6v-5h8zm20 0h6v18h8v5h-6l-8-8z"/><path fill="#eee4cb" d="M42 35h12l-4 15h-4z"/><path fill="#171e22" d="M47 36h3v14h-3z"/><path fill="#c8c3b0" d="M40 18h16v14H40z"/><path fill="#e6e1ce" d="M43 20h10v10H43z"/>`;
  const hands='<path fill="#343c40" d="M34 40h5v7h6v5H34zm23 0h5v12H51v-5h6z"/><path fill="#eee0bd" d="M43 39h4v11h-4zm6 0h4v11h-4z"/>';
  return halo+aura+lotus+body+hands+(place===1?`<g class="rank-pixel-sparks">${star(9,30,'#d8b35d')}${star(86,27,'#e7ce8a')}</g>`:heart(9,43,p.trim));
 }
 function render(mode,place){const p=palette[mode]||palette.wealth;return `<svg class="rank-pixel-art" viewBox="0 0 96 80" fill="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${mode==='bankrupt'?broke(place,p):mode==='kindness'?saint(place,p):place===1?champion(mode,p):podium(mode,p,place)}</svg>`;}
 return {render};
})();
