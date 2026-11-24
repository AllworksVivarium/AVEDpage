(function (root) {
  const time = (value, mode = 'relative') => root.AVEDTime.markup(value, mode);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const paragraphs = escaped => String(escaped).trim().split(/\r?\n\s*\r?\n/).map(text => `<p class="whitespace-pre-wrap">${text}</p>`).join('');
  // Announcement text is already escaped when the player data is loaded.
  root.AVEDNotices = {
    excerpt(value, limit = 140) {
      const characters = Array.from(String(value ?? '').replace(/\s+/g, ' ').trim());
      return characters.length > limit ? characters.slice(0, limit).join('') + '…' : characters.join('');
    },
    list(items) {
      const pinned = item => item.pinned ?? /置顶/.test(item.category || '');
      const ordered = [...items].sort((a,b) => Number(pinned(b))-Number(pinned(a)) || (Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0) || Number(b.id)-Number(a.id));
      return ordered.map(item => {
        const isPinned = Boolean(pinned(item));
        const cleanCategory = isPinned ? String(item.category || '').replace(/^置顶[·•\s/-]*/, '') || '通告' : item.category;
        return `<article class="retro-corner-box notice-card${isPinned ? ' is-pinned' : ''}">
        <div class="notice-meta"><span class="notice-meta-left">${isPinned ? '<b class="notice-pin-stamp">置顶</b>' : ''}<span class="notice-cat">${cleanCategory}</span></span><span class="notice-meta-right">${time(item.createdAt)}<span class="notice-comment-total">留言 ${Number(item.postCount)||0}</span></span></div>
        <h2 class="notice-title-secondary"><a href="#/news/${escape(item.id)}" data-cloud-news="${escape(item.id)}" class="notice-card-link">${item.title}</a></h2>
        <p class="notice-summary">${item.summary}</p>
      </article>`;
      }).join('') || '<p class="notice-empty">暂无通告。</p>';
    },
    article(item) {
      return `<header class="notice-article-heading"><div class="notice-meta"><span>${item.category}</span>${time(item.createdAt)}</div>
        <h2 class="notice-title-secondary">${item.title}</h2></header>${item.recipient?.trim()?`<p class="notice-recipient">${escape(item.recipient)}</p>`:''}
        <div class="notice-body terminal-prose">${String(item.fullContent).trim().split(/\r?\n+/).filter(text => text.trim()).map(text => `<p>${text}</p>`).join('')}</div>${item.issuer?.trim()?`<footer class="notice-signature"><p>${escape(item.issuer)}</p></footer>`:''}`;
    },
    comments(items) {
      return items.map(item => `<article class="notice-comment inner-card-alt">
        <header class="notice-comment-heading"><span class="notice-comment-avatar">${item.avatarUrl?`<img src="${escape(item.avatarUrl)}" width="32" height="32" loading="lazy" decoding="async" alt="">`:'<small class="avatar-noinfo">NOINFO</small>'}</span><div class="notice-comment-identity"><span class="notice-comment-author">${escape(item.displayName)}</span><span class="notice-real-badge">实名</span><span class="notice-comment-department">${escape([...new Set([/^公司直属(?:部|领导)?$/.test(item.department||'')&&item.positionTitle?'':item.department,item.positionTitle].filter(Boolean))].join(' '))}</span></div>${time(item.createdAt, 'relative-clock')}</header>
        <div class="notice-comment-body terminal-prose">${paragraphs(escape(item.body))}</div>
      </article>`).join('') || '<p class="notice-empty">暂无留言。</p>';
    }
  };
})(globalThis);
