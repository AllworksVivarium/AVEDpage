(function (root) {
  const time = (value, mode = 'relative') => root.AVEDTime.markup(value, mode);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const paragraphs = escaped => String(escaped).trim().split(/\r?\n\s*\r?\n/).map(text => `<p class="whitespace-pre-wrap">${text}</p>`).join('');
  const issueDate = item => {
    const value=item.issuedOn||String(item.createdAt||'').slice(0,10),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match?`${match[1]}年${Number(match[2])}月${Number(match[3])}日`:'';
  };
  // Announcement text is already escaped when the player data is loaded.
  root.AVEDNotices = {
    excerpt(value, limit = 140) {
      const characters = Array.from(String(value ?? '').replace(/\s+/g, ' ').trim());
      return characters.length > limit ? characters.slice(0, limit).join('') + '…' : characters.join('');
    },
    list(items) {
      const pinned = item => item.pinned ?? /置顶/.test(item.category || '');
      const ordered = [...items].sort((a,b) => Number(pinned(b))-Number(pinned(a)) || (Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0) || Number(b.id)-Number(a.id));
      return ordered.map(item => `<article class="retro-corner-box notice-card">
        <div class="notice-meta"><span>${item.category}</span>${time(item.createdAt)}</div>
        <h2 class="notice-title-secondary">${item.title}</h2>
        <p class="notice-summary">${item.summary}</p>
        <button type="button" data-cloud-news="${escape(item.id)}" class="inner-btn-primary notice-button">查阅全文 →</button><span class="notice-comment-total">留言 ${Number(item.postCount)||0}</span>
      </article>`).join('') || '<p class="notice-empty">暂无通告。</p>';
    },
    article(item) {
      return `<header class="notice-article-heading"><div class="notice-meta"><span>${item.category}</span>${time(item.createdAt)}</div>
        <h2 class="notice-title-secondary">${item.title}</h2>${item.drafter?`<p class="notice-drafter">起草：${escape(item.drafter)}</p>`:''}</header>
        <div class="notice-body terminal-prose">${String(item.fullContent).trim().split(/\r?\n+/).filter(text => text.trim()).map(text => `<p>${text}</p>`).join('')}</div><footer class="notice-signature"><p>${escape(item.issuer||'万业携生')}</p><p>${issueDate(item)}</p></footer>`;
    },
    comments(items) {
      return items.map(item => `<article class="notice-comment inner-card-alt">
        <header class="notice-comment-heading"><div class="notice-comment-identity"><span class="notice-comment-author">${escape(item.displayName)}</span><span class="notice-comment-department">${escape([...new Set([item.department,item.positionTitle].filter(Boolean))].join(' '))}</span></div>${time(item.createdAt, 'relative-clock')}</header>
        <div class="notice-comment-body terminal-prose">${paragraphs(escape(item.body))}</div>
      </article>`).join('') || '<p class="notice-empty">暂无留言。</p>';
    }
  };
})(globalThis);
