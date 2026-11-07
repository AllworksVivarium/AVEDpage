window.AVEDScratchSymbols=(()=>{
 const marks={
  bomb:{name:'炸弹',color:'#f09180',path:'<circle cx="10" cy="15" r="7"/><path d="m14 8 3-3 3 3-3 3m1-5c0-5 5-2 4-5M6 12l-1 3"/>'},
  seal:{name:'朱印',color:'#ed6268',path:'<path d="M12 3 22 20H2Z"/><path d="M12 9v5m0 3v1"/>'},
  eye:{name:'目印',color:'#e2bb6d',path:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'},
  star:{name:'星印',color:'#b39aef',path:'<path d="m12 2 2.7 6.8L22 9l-5.5 4.8 1.8 7.2-6.3-4-6.3 4 1.8-7.2L2 9l7.3-.2Z"/>'},
  orbit:{name:'环印',color:'#63c9ac',path:'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><path d="M8 3c-3 6 1 17 8 18"/>'},
  bolt:{name:'电印',color:'#f0bf56',path:'<path d="m14 2-9 12h6l-1 8 9-13h-6Z"/>'},
  lock:{name:'锁印',color:'#76b5ef',path:'<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v3"/>'},
  archive:{name:'档印',color:'#df9e79',path:'<path d="M3 6h7l2 3h9v12H3Zm0 0V3h7l2 3h7v3"/>'}
 };
 const aliases={'💣':'bomb','🔺':'seal','👁️':'eye','☢️':'star','🧬':'orbit','⚡':'bolt','🔒':'lock','📁':'archive',three_match:'seal',lucky_num:'eye',step_climb:'bolt'};
 function render(value){const mark=marks[aliases[value]||value];if(!mark)return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<svg class="scratch-printed-mark" data-type-ignore role="img" aria-label="${mark.name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter" style="--mark-ink:${mark.color}">${mark.path}</svg>`;}
 return {render};
})();
