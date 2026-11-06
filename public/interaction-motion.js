(function () {
  // Only containment titles and primary actions opt into a small magnetic offset.
  const scope = document.getElementById('view-containment');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const offsets = new Map();
  let pointer = null;
  let frame = 0;

  function reset(button) {
    button.style.removeProperty('--aved-magnet-x');
    button.style.removeProperty('--aved-magnet-y');
    offsets.delete(button);
  }

  function resetAll() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    for (const button of offsets.keys()) reset(button);
  }

  function update() {
    frame = 0;
    if (!pointer || !scope || scope.classList.contains('hidden') || reducedMotion.matches || !finePointer.matches || document.body.classList.contains('effects-off')) {
      resetAll();
      return;
    }
    for (const button of offsets.keys()) {
      if (!button.isConnected || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.offsetParent === null) reset(button);
    }
    for (const button of scope.querySelectorAll('.magnetic-cta')) {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' || button.offsetParent === null) continue;
      // Keep the hit area stable instead of chasing the translated button.
      if (button.matches(':active')) continue;
      const rect = button.getBoundingClientRect();
      const transform = getComputedStyle(button).transform;
      const current = transform === 'none' ? { m41: 0, m42: 0 } : new DOMMatrixReadOnly(transform);
      const dx = pointer.x - (rect.left - current.m41 + rect.width / 2);
      const dy = pointer.y - (rect.top - current.m42 + rect.height / 2);
      const hotWidth = rect.width * .65;
      const hotHeight = rect.height * .65;
      if (!hotWidth || !hotHeight || Math.abs(dx) > hotWidth || Math.abs(dy) > hotHeight) {
        reset(button);
        continue;
      }
      const x = Number((dx / hotWidth * 6).toFixed(1));
      const y = Number((dy / hotHeight * 6).toFixed(1));
      offsets.set(button, { x, y });
      button.style.setProperty('--aved-magnet-x', `${x}px`);
      button.style.setProperty('--aved-magnet-y', `${y}px`);
    }
  }

  // Enable native :active feedback on touch without intercepting clicks or scroll.
  document.addEventListener('touchstart', () => {}, { passive: true });
  if (!scope) return;
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', resetAll);
  window.addEventListener('pointercancel', resetAll);
  window.addEventListener('blur', resetAll);
  window.addEventListener('scroll', resetAll, { capture: true, passive: true });
  window.addEventListener('resize', resetAll);
  document.addEventListener('visibilitychange', resetAll);
  document.addEventListener('aved-effects-change', resetAll);
  finePointer.addEventListener('change', resetAll);
  reducedMotion.addEventListener('change', resetAll);
  new MutationObserver(() => {
    if (scope.classList.contains('hidden')) resetAll();
  }).observe(scope, { attributes: true, attributeFilter: ['class'] });
})();
