/* Small, shared feedback windows. No request, polling or animation library. */
(() => {
  let queue = Promise.resolve();

  function messageWindow(message, options, confirm) {
    const show = () => new Promise(resolve => {
      const trigger = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'system-message-window';
      dialog.dataset.tone = options.tone || (confirm ? 'warning' : 'info');
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-labelledby', 'system-message-title');
      dialog.setAttribute('aria-describedby', 'system-message-copy');
      dialog.innerHTML = '<header><h2 id="system-message-title"></h2><button type="button" aria-label="关闭提示">×</button></header><div class="system-message-body"><p id="system-message-copy"></p><footer><button type="button" data-cancel></button><button type="button" data-accept></button></footer></div>';
      dialog.querySelector('h2').textContent = options.title || (confirm ? '请确认操作' : '系统提示');
      dialog.querySelector('p').textContent = String(message);
      const cancel = dialog.querySelector('[data-cancel]');
      const accept = dialog.querySelector('[data-accept]');
      cancel.textContent = options.cancelLabel || '取消';
      cancel.hidden = !confirm;
      accept.textContent = options.confirmLabel || (confirm ? '确认执行' : '知道了');
      let accepted = false;
      accept.onclick = () => { accepted = true; dialog.close(); };
      cancel.onclick = dialog.querySelector('header button').onclick = () => dialog.close();
      // Escape follows the same cancellation path as the close button.
      dialog.addEventListener('close', () => {
        dialog.remove();
        if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus({preventScroll:true});
        resolve(accepted);
      }, {once:true});
      document.body.append(dialog);
      dialog.showModal();
      (confirm ? cancel : accept).focus({preventScroll:true});
    });
    const result = queue.then(show);
    queue = result.catch(() => {});
    return result;
  }

  function toast(message, type = 'info', options = {}) {
    const text = String(message);
    const tone = ['info', 'success', 'warn', 'error'].includes(type) ? type : 'info';
    // A native modal is in the top layer: keep its feedback in that layer too.
    const modal = [...document.querySelectorAll('dialog[open]')].reverse().find(d => d.matches(':modal'));
    let container = modal?.querySelector(':scope > .system-toast-stack') || (!modal && document.getElementById('toast-container'));
    if (!container) {
      container = document.createElement('div');
      container.className = 'system-toast-stack';
      if (!modal) container.id = 'toast-container';
      (modal || document.body).append(container);
    }
    // Repeated failures should not cover the page with duplicate notices.
    if ([...container.children].some(el => el.dataset.message === text && el.dataset.type === tone)) return;
    while (container.children.length >= 3) container.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'aved-toast';
    el.dataset.type = tone;
    el.dataset.message = text;
    el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-atomic', 'true');
    if (tone === 'success' && typeof options.stamp === 'string' && options.stamp) {
      el.dataset.stamp = options.stamp;
      const stamp = document.createElement('b');
      stamp.className = 'feedback-paper-stamp';
      stamp.textContent = options.stamp;
      stamp.setAttribute('aria-hidden', 'true');
      el.append(stamp);
    }
    const copy = document.createElement('span');
    copy.textContent = text;
    el.append(copy);
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭提示');
    close.textContent = '×';
    el.append(close);
    let timer;
    const dismiss = () => { clearTimeout(timer); el.remove(); };
    const schedule = () => { clearTimeout(timer); if (tone !== 'error') timer = setTimeout(dismiss, tone === 'warn' ? 8000 : 5000); };
    close.onclick = dismiss;
    el.onpointerenter = el.onfocusin = () => clearTimeout(timer);
    el.onpointerleave = schedule;
    el.onfocusout = e => { if (!el.contains(e.relatedTarget)) schedule(); };
    container.append(el);
    schedule();
  }

  window.AVEDFeedback = {
    confirm: (message, options = {}) => messageWindow(message, options, true),
    alert: (message, options = {}) => messageWindow(message, options, false),
    toast
  };

  // The login and ticket surfaces predate <dialog>. Keep their existing handlers,
  // but give them the same Escape, focus containment and focus-return behavior.
  const overlays = [
    ['login-modal', 'close-login-btn', '员工账号登录'],
    ['ticket-confirm-modal', 'ticket-modal-close', '选票确认']
  ];
  for (const [id, closeId, label] of overlays) {
    const overlay = document.getElementById(id);
    if (!overlay) continue;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', label);
    let open = false, trigger = null, background = [];
    const focusable = () => [...overlay.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const sync = () => {
      const visible = !overlay.classList.contains('hidden');
      if (visible === open) return;
      open = visible;
      if (open) {
        trigger = document.activeElement;
        background = ['landing-view', 'inner-app-view'].map(key => document.getElementById(key))
          .filter(el => el && !el.contains(overlay)).map(el => [el, el.inert]);
        for (const [el] of background) el.inert = true;
        (overlay.querySelector('input:not([type=hidden])') || focusable()[0])?.focus({preventScroll:true});
      } else {
        for (const [el, inert] of background) el.inert = inert;
        background = [];
        if (trigger?.isConnected && !trigger.closest('[inert]') && !document.querySelector('dialog[open]')) trigger.focus({preventScroll:true});
      }
    };
    new MutationObserver(sync).observe(overlay, {attributes:true, attributeFilter:['class']});
    overlay.addEventListener('keydown', event => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();event.stopPropagation();document.getElementById(closeId)?.click();
      } else if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
      }
    });
    sync();
  }
})();
