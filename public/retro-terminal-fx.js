/* AVED Retro-Futurist Terminal Micro-FX (Shader.se-inspired, restrained)
   1) Signal Scramble on short ASCII/English kickers & division codes
   2) Telemetry Number Roll on balance & KARMA index updates
   3) Subtle monochrome CRT surface sheen following desktop pointer
   4) Crisp 160ms CRT channel-switch horizontal scanline on view switch
   Strictly respects body.effects-off and prefers-reduced-motion: reduce. */
(() => {
  if (window.__AVEDRetroTerminalFX) return;
  window.__AVEDRetroTerminalFX = true;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const fxAllowed = () =>
    !reducedMotion.matches &&
    !document.body.classList.contains('effects-off') &&
    window.AVEDEffectsEnabled?.() !== false;

  /* ----------------------------------------------------------------------
     1. SIGNAL SCRAMBLE (short ASCII/English kickers & codes only)
     ---------------------------------------------------------------------- */
  const GLYPHS = '0123456789ABCDEF/_-+#';
  const scrambleTimers = new WeakMap();

  function scrambleText(el) {
    if (!fxAllowed() || !el || !el.isConnected) return;
    if (el.closest('[data-contamination-exempt]') || document.body.classList.contains('signal-contaminated')) return;
    const raw = (el.dataset.avedScrambleOrig || el.textContent || '').trim();
    if (!raw || raw.length > 36 || !/^[\x20-\x7E]+$/.test(raw)) return;
    el.dataset.avedScrambleOrig = raw;
    const prev = scrambleTimers.get(el);
    if (prev) clearInterval(prev);

    const totalFrames = 7;
    let frame = 0;
    const id = setInterval(() => {
      if (!el.isConnected || !fxAllowed()) {
        clearInterval(id);
        scrambleTimers.delete(el);
        el.textContent = raw;
        return;
      }
      frame++;
      const settled = Math.floor((frame / totalFrames) * raw.length);
      let out = '';
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (i < settled || ch === ' ' || ch === '/' || ch === '.') {
          out += ch;
        } else {
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      el.textContent = out;
      if (frame >= totalFrames) {
        clearInterval(id);
        scrambleTimers.delete(el);
        el.textContent = raw;
      }
    }, 26);
    scrambleTimers.set(el, id);
  }

  /* ----------------------------------------------------------------------
     2. TELEMETRY NUMBER ROLL (balance & KARMA index smooth odometer)
     ---------------------------------------------------------------------- */
  const rollState = new WeakMap();

  function parseNumericNode(el) {
    // Find the last text node containing digits so currency mark spans stay untouched
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let target = null;
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement?.classList?.contains('aved-currency-source')) continue;
      if (/\d/.test(n.nodeValue || '')) target = n;
    }
    if (!target) return null;
    const text = target.nodeValue;
    const match = text.match(/(-?\d[\d,]*(?:\.\d+)?)/);
    if (!match) return null;
    const numStr = match[1];
    const value = Number(numStr.replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    const hasCommas = numStr.includes(',');
    const prefix = text.slice(0, match.index);
    const suffix = text.slice(match.index + numStr.length);
    return { node: target, value, decimals, hasCommas, prefix, suffix, raw: text };
  }

  function formatRolled(val, decimals, hasCommas) {
    const fixed = decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
    if (!hasCommas) return fixed;
    const [intPart, decPart] = fixed.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
  }

  function observeNumberRoll(el) {
    if (!el || rollState.has(el)) return;
    const init = parseNumericNode(el);
    const state = { last: init ? init.value : null, raf: 0, internal: false };
    rollState.set(el, state);

    const obs = new MutationObserver(() => {
      if (state.internal) return;
      const parsed = parseNumericNode(el);
      if (!parsed) return;
      const prev = state.last;
      state.last = parsed.value;
      if (prev === null || prev === parsed.value || !fxAllowed()) return;
      if (state.raf) cancelAnimationFrame(state.raf);

      const start = performance.now();
      const duration = 240;
      const diff = parsed.value - prev;
      const step = (now) => {
        if (!el.isConnected || !parsed.node.isConnected) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        state.internal = true;
        if (t >= 1) {
          parsed.node.nodeValue = parsed.raw;
          state.raf = 0;
        } else {
          const cur = prev + diff * eased;
          parsed.node.nodeValue =
            parsed.prefix + formatRolled(cur, parsed.decimals, parsed.hasCommas) + parsed.suffix;
          state.raf = requestAnimationFrame(step);
        }
        state.internal = false;
      };
      state.raf = requestAnimationFrame(step);
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
  }

  /* ----------------------------------------------------------------------
     3. SUBTLE CRT SURFACE SHEEN (desktop hover only, GPU radial light)
     ---------------------------------------------------------------------- */
  const SHEEN_SEL =
    '.division-overview-card, .scp-item-card, .notice-card, .company-fund-panel, .company-ranking-panel';
  let sheenRaf = 0;
  let sheenEvent = null;

  function applySheen() {
    sheenRaf = 0;
    if (!sheenEvent || !fxAllowed() || !finePointer.matches) return;
    const card = sheenEvent.target?.closest?.(SHEEN_SEL);
    if (!card) return;
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((sheenEvent.clientX - r.left) / r.width) * 100;
    const y = ((sheenEvent.clientY - r.top) / r.height) * 100;
    card.style.setProperty('--aved-sheen-x', `${x.toFixed(1)}%`);
    card.style.setProperty('--aved-sheen-y', `${y.toFixed(1)}%`);
  }

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || !fxAllowed() || !finePointer.matches) return;
      if (!e.target?.closest?.(SHEEN_SEL)) return;
      sheenEvent = e;
      if (!sheenRaf) sheenRaf = requestAnimationFrame(applySheen);
    },
    { passive: true }
  );

  // Trigger short code scramble on hovering department cards (desktop)
  document.addEventListener(
    'pointerenter',
    (e) => {
      if (!fxAllowed() || !finePointer.matches) return;
      const card = e.target?.closest?.('.division-overview-card');
      if (!card) return;
      const codeEl = card.querySelector('.division-card-meta > span:first-child');
      if (codeEl) scrambleText(codeEl);
    },
    true
  );

  /* ----------------------------------------------------------------------
     4. CHANNEL-SWITCH HORIZONTAL SCANLINE WIPE (on view/panel change)
     ---------------------------------------------------------------------- */
  let wipeEl = null;
  let wipeTimer = 0;

  function triggerChannelWipe(viewEl) {
    if (!fxAllowed()) return;
    if (!wipeEl) {
      wipeEl = document.createElement('div');
      wipeEl.id = 'aved-channel-wipe';
      wipeEl.setAttribute('aria-hidden', 'true');
      document.body.append(wipeEl);
    }
    wipeEl.classList.remove('is-wiping');
    void wipeEl.offsetWidth;
    wipeEl.classList.add('is-wiping');
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => wipeEl?.classList.remove('is-wiping'), 220);

    // Scramble the newly visible view's short English kicker
    const kicker = viewEl?.querySelector?.('.player-section-kicker > span, .section-kicker');
    if (kicker) scrambleText(kicker);
  }

  function init() {
    // Watch numeric telemetry readouts
    ['top-balance-val', 'hub-balance', 'karma-index-val'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observeNumberRoll(el);
    });
    const compactBal = document.querySelector('.casino-compact-balance strong');
    if (compactBal) observeNumberRoll(compactBal);

    // Watch main view switches for channel-wipe & kicker scramble
    const views = document.querySelectorAll(
      '#view-profile, #view-news, #view-departments, #view-containment, #view-life, #view-forum, #view-casino'
    );
    const viewObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName !== 'class') continue;
        const el = m.target;
        if (m.oldValue && /\bhidden\b/.test(m.oldValue) && !el.classList.contains('hidden')) {
          triggerChannelWipe(el);
          // Re-attach hub-balance observer if profile re-rendered
          const hb = document.getElementById('hub-balance');
          if (hb) observeNumberRoll(hb);
        }
      }
    });
    views.forEach((v) =>
      viewObs.observe(v, { attributes: true, attributeOldValue: true, attributeFilter: ['class'] })
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
