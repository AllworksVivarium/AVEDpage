(function () {
  const app = document.getElementById('inner-app-view');
  if (!app) return;
  const ns = 'http://www.w3.org/2000/svg';
  const definitions = document.createElementNS(ns, 'svg');
  definitions.classList.add('signal-filter-definitions');
  definitions.setAttribute('aria-hidden', 'true');
  definitions.innerHTML = '<defs><filter id="aved-print-type" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".004 .18" numOctaves="1" seed="17" result="noise"/><feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="bands"/><feDisplacementMap in="SourceGraphic" in2="bands" scale="1.25" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="aved-print-rule" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="1" seed="7" result="ruleNoise"/><feDisplacementMap in="SourceGraphic" in2="ruleNoise" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  document.body.append(definitions);

  const canvas = document.createElement('canvas');
  canvas.id = 'aved-signal-dust';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const context = canvas.getContext('2d', {alpha:true});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, motes = [], frame = 0, previous = 0;
  function size() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(34, Math.max(12, Math.round(width * height / 40000)));
    motes = Array.from({length:count}, () => ({x:Math.random()*width,y:Math.random()*height,r:.35+Math.random()*.5,phase:Math.random()*Math.PI*2,speed:.05+Math.random()*.08}));
  }
  function active() { return context && !document.hidden && !reduced.matches && document.body.classList.contains('theme-inner') && document.body.classList.contains('signal-preview'); }
  function draw(now) {
    frame = 0;
    if (!active()) return;
    if (now - previous >= 100) {
      const elapsed = Math.min(250, now - previous || 100); previous = now;
      context.clearRect(0, 0, width, height);
      const night = document.body.classList.contains('dark-mode');
      for (const mote of motes) {
        mote.y = (mote.y - elapsed * mote.speed / 120 + height) % height;
        const alpha = .035 + .085 * (.5 + .5 * Math.sin(now / 3400 + mote.phase));
        context.fillStyle = night ? `rgba(250,228,184,${alpha * 1.7})` : `rgba(121,66,43,${alpha})`;
        context.beginPath(); context.arc(mote.x, mote.y, mote.r, 0, Math.PI*2); context.fill();
      }
    }
    frame = requestAnimationFrame(draw);
  }
  let framesPending = false;
  function decorateFrames() {
    framesPending = false;
    if (!document.body.classList.contains('signal-preview')) return;
    for (const box of app.querySelectorAll('.notice-card,#news-detail-article-box')) {
      if (box.querySelector(':scope > .signal-frame')) continue;
      box.classList.add('signal-framed');
      const outline = document.createElementNS(ns, 'svg');
      outline.classList.add('signal-frame'); outline.setAttribute('viewBox', '0 0 1000 1000');
      outline.setAttribute('preserveAspectRatio', 'none'); outline.setAttribute('aria-hidden', 'true');
      const rect = document.createElementNS(ns, 'rect');
      for (const [name, value] of Object.entries({x:'1',y:'1',width:'998',height:'998'})) rect.setAttribute(name, value);
      outline.append(rect); box.append(outline);
    }
  }
  function sync() {
    if (active() && !frame) { previous = performance.now(); frame = requestAnimationFrame(draw); }
    else if (!active() && frame) { cancelAnimationFrame(frame); frame = 0; context?.clearRect(0, 0, width, height); }
    decorateFrames();
  }
  new MutationObserver(sync).observe(document.body, {attributes:true, attributeFilter:['class']});
  new MutationObserver(records => {
    if (framesPending || !records.some(record => [...record.addedNodes].some(node => node.nodeType===1 && !node.classList.contains('signal-frame')))) return;
    framesPending = true; requestAnimationFrame(decorateFrames);
  }).observe(app, {childList:true, subtree:true});
  addEventListener('resize', () => {size(); sync();}, {passive:true});
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  size(); sync();
})();
