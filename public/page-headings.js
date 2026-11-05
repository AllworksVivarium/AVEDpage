(function () {
  const pages = [
    ['view-news', 'A.V.E.D. CENTRAL BROADCAST // OFFICIAL BULLETINS', 'שידור מרכזי // הודעות רשמיות'],
    ['view-departments', 'ORGANIZATIONAL STRUCTURE // PERSONNEL DIRECTORY', 'מבנה ארגוני // מדריך עובדים'],
    ['view-containment', 'VIVARIUM ARCHIVE BOARD // CONTAINMENT FILES', 'ארכיון ישויות חריגות'],
    ['view-life', 'PERSONNEL LIFE ARCHIVE', 'ארכיון חיי העובדים'],
    ['view-forum', 'A.V.E.D. ANONYMOUS CHANNEL // INTERNAL', 'ערוץ אנונימי // פנימי'],
    ['view-casino', 'PERSONNEL COMMON ROOM', 'חדר פנאי לעובדים'],
    ['view-profile', 'PERSONNEL PROFILE // INTERNAL', 'תיק אישי // פנימי']
  ];
  const app = document.getElementById('inner-app-view');
  if (!app) return;
  app.querySelector('#view-casino [data-game]')?.parentElement.classList.add('terminal-game-tabs');
  function update() {
    for (const [id, english, hebrew] of pages) {
      const page = document.getElementById(id);
      if (!page) continue;
      let heading;
      if (id === 'view-casino') {
        let masthead = page.querySelector(':scope > .terminal-page-heading');
        if (!masthead) {
          masthead = document.createElement('header');
          masthead.className = 'terminal-page-heading';
          const title = document.createElement('h2');
          title.textContent = '员工愉乐室';
          masthead.append(title);
          page.prepend(masthead);
        }
        heading = masthead.querySelector('h2');
      } else heading = page.querySelector('h1, h2');
      if (!heading || heading.classList.contains('terminal-page-title')) continue;
      heading.classList.add('terminal-page-title');
      if (id === 'view-news') heading.textContent = '万业携生内部通告';
      const parent = heading.parentElement;
      parent.classList.add('terminal-page-heading');
      let kicker = parent.querySelector(':scope > .notice-kicker, :scope > .section-kicker, :scope > .font-mono-tech');
      if (!kicker) {
        kicker = document.createElement('div');
        heading.before(kicker);
      }
      kicker.classList.add('terminal-page-kicker');
      const en = document.createElement('span');
      en.lang = 'en';
      en.textContent = english;
      const separator = document.createElement('span');
      separator.className = 'terminal-page-separator';
      separator.setAttribute('aria-hidden', 'true');
      separator.textContent = '|';
      const he = document.createElement('bdi');
      he.lang = 'he';
      he.dir = 'rtl';
      he.textContent = hebrew;
      kicker.replaceChildren(en, separator, he);
    }
  }
  update();
  new MutationObserver(update).observe(app, {childList:true, subtree:true});
})();
