/* Shared code-native print artwork for the live selection and scratch views. */
window.AVEDScratchTicketArt=(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const star=(x,y,s=1,color='#f6d36c')=>`<path fill="${color}" d="M${x} ${y-4*s}h${2*s}v${3*s}h${3*s}v${2*s}h${-3*s}v${3*s}h${-2*s}v${-3*s}h${-3*s}v${-2*s}h${3*s}z"/>`;
function art(kind){
 const spark=Array.from({length:20},(_,i)=>star(12+i*37%350,8+i*29%175,i%3===0?1.1:.6,i%4===0?'#e9ad56':'#f3d886')).join('');
 let scene='';
 if(kind==='lucky'){
  const rays=Array.from({length:17},(_,i)=>{const a=(i*360/17)*Math.PI/180,b=a+.065;return `<path d="M180 84L${180+230*Math.cos(a)} ${84+230*Math.sin(a)}L${180+230*Math.cos(b)} ${84+230*Math.sin(b)}Z" fill="${i%2?'#c8792b':'#e8b655'}" opacity=".21"/>`;}).join('');
  scene=rays+`<g fill="#d4a64f" stroke="#4b2020" stroke-width="2"><path d="M18 109h17v-4h30v4h9v31h-9v5H35v-5H18z"/><path d="M292 27h10v-6h31v6h9v26h-9v6h-31v-6h-10z"/><path d="M310 134h13v-5h22v5h9v27h-9v6h-22v-6h-13z"/></g><g fill="#74412e"><path d="M38 115h18v18H38zm270-84h17v15h-17zm17 111h13v14h-13z"/></g><path d="M130 40h10V26h14V17h52v9h14v14h10v39H130z" fill="#6f2826" stroke="#e2b661" stroke-width="2"/><path d="M145 45h10v-7h50v7h10v15h-10v7h-50v-7h-10z" fill="#edc970"/><path d="M170 42h20v20h-20z" fill="#542520"/><path d="M175 45h6v6h-6z" fill="#f5e4ac"/>`;
 }else if(kind==='seals'){
  scene=Array.from({length:8},(_,i)=>{const x=i%4*110-35,y=Math.floor(i/4)*110+5;return `<g transform="translate(${x} ${y}) rotate(${i%2?15:-12} 40 40)" fill="none" stroke="#94bea2" opacity=".22" stroke-width="3"><path d="M8 0h55v8h9v55h-9v9H8v-9H0V8h8z"/><path d="M10 10h52v52H10z"/><path d="M20 25h31v9H20zm0 18h31v9H20z"/></g>`;}).join('')+`<g transform="translate(150 11)" fill="#d8c88a" stroke="#193f38" stroke-width="3"><path d="M12 0h44v8h8v44h-8v8H12v-8H4V8h8z"/><path d="M17 13h26v6H17zm0 13h26v6H17zm0 13h26v6H17z" fill="#33654e"/></g><g fill="#dfc16a"><path d="M22 137h30v6h6v27h-6v6H22v-6h-6v-27h6z"/><path d="M306 22h30v6h6v27h-6v6h-30v-6h-6V28h6z"/></g>`;
 }else{
  scene=`<path d="M0 180V124h22V94h27v46h16V80h31v40h26V55h30v75h20V87h25v53h22V47h32v78h24V82h24v48h25V68h24v112z" fill="#16394b"/><g fill="#e4b660" opacity=".7">${Array.from({length:42},(_,i)=>`<path d="M${8+i*29%350} ${91+i*17%85}h3v4h-3z"/>`).join('')}</g><path d="M35 181v-19h42v-20h42v-20h42v-20h42V82h42V62h42V42h42V22h31" fill="none" stroke="#e4aa51" stroke-width="9"/><path d="M35 157h39v-20h42v-20h42V97h42V77h42V57h42V37h42V17h34" fill="none" stroke="#f3d987" stroke-width="2"/><path d="M305 18h11v13h-11zm-3 14h17v20h-7v12h-4V52h-6z" fill="#efe0b0"/>`;
 }
 return `<svg class="hero-art" viewBox="0 0 360 190" aria-hidden="true" shape-rendering="crispEdges">${scene}${spark}</svg>`;
}

const kinds={lucky_num:'lucky',three_match:'seals',step_climb:'steps'},english={lucky_num:'LUCKY NUMBER',three_match:'THREE SECRET SEALS',step_climb:'FIVE LUCKY STATIONS'},slogans={lucky_num:'凭号领赏 · 好运加倍',three_match:'三印同开 · 好彩成串',step_climb:'一路巡签 · 步步添彩'};
const arts=Object.fromEntries(Object.values(kinds).map(k=>[k,art(k).replaceAll('hero-art','sp-hero-art')]));
function header(game){const type=game.type;return '<div class="sp-stock-strip"><span>万业携生 / 员工福利票券</span><span>AVED · 007</span></div><header class="sp-hero">'+arts[kinds[type]]+'<div class="sp-hero-kicker">A.V.E.D. / EMPLOYEE LOTTERY</div><h2 class="sp-name"><strong>'+esc(game.title)+'</strong></h2><div class="sp-ribbon">'+slogans[type]+'</div><div class="sp-hero-en">'+english[type]+'</div></header>';}
function footer(){return '<div class="sp-paper-end"><span>AVED / AFTER HOURS<br>请核对票面规则</span><div class="sp-barcode" aria-hidden="true"></div></div><div class="sp-endband"></div>';}
function mini(game){const foil='<span class="sp-coat">'+AVEDPixelIcons.render('eye','pixel-icon')+'<b>刮开好运</b></span>',cell=()=>'<span class="sp-cell sp-covered">'+foil+'</span>';
if(game.type==='lucky_num')return '<div class="sp-refs">'+Array.from({length:4},cell).join('')+'</div><div class="sp-nums">'+Array.from({length:9},cell).join('')+'</div>';
return '<div class="'+(game.type==='three_match'?'sp-stamps':'sp-step-grid')+'">'+Array.from({length:game.cellsCount},cell).join('')+'</div>';}
function lobby(game,cost,top){return '<article class="scratch-ticket-card scratch-print" data-ticket-kind="'+game.type+'" data-print-kind="'+kinds[game.type]+'">'+header(game)+'<div class="sp-paper"><div class="sp-ticket-info"><span>'+esc(game.sub)+'</span><b>票价 '+Number(cost).toLocaleString()+'</b></div><p class="sp-rule-line">'+esc(game.tagline)+'</p><div class="sp-mini">'+mini(game)+'</div><div class="sp-ticket-info sp-prize"><span>最高津贴</span><b>'+Number(top||0).toLocaleString()+'</b></div><button type="button" data-pick-game="'+game.type+'" class="pick-scratch-game-btn terminal-key">申领此票 '+Number(cost).toLocaleString()+'</button>'+footer()+'</div></article>';}
function board(ticket,cells){const game=ticket.gameType;return '<div class="scratch-print is-active" data-print-kind="'+kinds[game.type]+'">'+header(game)+'<div class="sp-paper"><div class="sp-ticket-info"><span>'+esc(game.sub)+'</span><b>票价 '+Number(ticket.cost||ticket.tier.cost).toLocaleString()+'</b></div>'+cells+footer()+'</div></div>';}
return {header,lobby,board};
})();
