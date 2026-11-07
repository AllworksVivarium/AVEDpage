/* Shared integer-grid artwork. No font glyphs, image downloads or canvas redraws. */
window.AVEDPixelIcons=(()=>{
 const art={
  eye:['....oooo....','..ooaaaaoo..','.oabbbbbaao.','oabboccobbao','oabboccobbao','.oabbbbbaao.','..ooaaaaoo..','....oooo....'],
  rad:['....oooo....','...oaaaao...','...oabbao...','....oooo....','.oo..oo..oo.','oaaooccoaao','oaaaoccoaaao','.oaaooooaao.','..oo....oo..'],
  lock:['.....oo.....','....oaao....','....oaao....','...oabbao...','...oaccao...','..oabccbao..','..oabbbbao..','.oaaaccaaao.','.oooooooooo.'],
  file:['.ooooo......','.obbbboooo..','.obbbbbbbbo.','.oooooooooo.','.oaaaaaaaao.','.oabbbbaaao.','.oaaaaaaaao.','.oabbbbaaao.','.oooooooooo.'],
  dna:['...oooooo...','...obbbbo...','....obbo....','....obbo....','...obbbbo...','..obbaabbo..','.obbaaaabbo.','.obaaacccbo.','.obaaacccbo.','..oooooooo..'],
  pill:['.....oooo...','....obbbbo..','...obbbbbo..','..oabbbbbo..','.oaaabbbo...','.oaacabo....','.oaacao.....','..oooo......'],
  bomb:['.......ob.o.','......o.bbo.','.....oo..b..','...oooooo...','..oaabccco..','.oaabccccco.','.oabcccccco.','.oaccccccco.','..occcccco..','...oooooo...'],
  star:['.....oo.....','.....ao.....','....oaao....','.ooooaaoooo.','.oabbbbbbao.','..oabbbbao..','...oabbao...','..oaaooaao..','..ooo..ooo..'],
  orbit:['...ooo......','..oaao...oo.','.oaaao..oao.','.oabooooao..','..oabbbao...','...oaccao...','..oabbbbao..','.oao...oaao.','.oo.....ooo.'],
  bolt:['......ooo...','.....oaao...','....oaao....','...oaao.....','..oaaaoooo..','..ooooaaao..','.....oaao...','....oaao....','...oao......','...oo.......'],
  key:['....oooo....','...obbbbo...','..obboobbo..','..oboooobo..','..oaaaaaao..','..oaaccaao..','..oaaccaao..','..oaaaaaao..','..oooooooo..']
 };
 const names={eye:'收容之眼',rad:'高危核心',lock:'抑制锁',file:'机密卷宗',dna:'记忆血清',pill:'镇定剂',bomb:'炸弹',star:'星印',orbit:'环印',bolt:'电印',key:'锁印'};
 const colors={eye:'#d6a755',rad:'#e89853',lock:'#d2786e',file:'#c59d65',dna:'#75b89b',pill:'#d37b81',bomb:'#ca8170',star:'#ae96d0',orbit:'#70bfae',bolt:'#e2b85d',key:'#79a9c9'};
 const aliases={'💣':'bomb','🔺':'lock','👁️':'eye','☢️':'rad','🧬':'dna','⚡':'bolt','🔒':'key','📁':'file','💊':'pill',seal:'lock',archive:'file',three_match:'lock',lucky_num:'eye',step_climb:'bolt'};
 const cache=new Map();
 function render(value,cls='pixel-game-icon'){
  const id=aliases[value]||value;if(!art[id])return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!cache.has(id)){const paths={};art[id].forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='.')paths[c]=(paths[c]||'')+`M${x} ${y+1}h1v1h-1z`;}));const palette={o:'#283437',a:colors[id],b:'#f4e6c7',c:'#4a5b62'};cache.set(id,Object.entries(paths).map(([c,d])=>`<path fill="${palette[c]}" d="${d}"/>`).join(''));}
  return `<svg class="${cls}" data-type-ignore role="img" aria-label="${names[id]}" viewBox="0 0 12 12" shape-rendering="crispEdges" stroke="none" style="--mark-ink:${colors[id]}">${cache.get(id)}</svg>`;
 }
 return {render};
})();
