(function (root) {
  const time = (value, mode = 'relative') => root.AVEDTime.markup(value, mode);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  // Announcement text is already escaped when the player data is loaded.
  root.AVEDNotices = {
    excerpt(value, limit = 140) {
      const characters = Array.from(String(value ?? '').replace(/\s+/g, ' ').trim());
      return characters.length > limit ? characters.slice(0, limit).join('') + '…' : characters.join('');
    },
    list(items) {
      return items.map(item => `<article class="retro-corner-box notice-card">
        <div class="notice-meta"><span>${item.category} / ${item.code}</span>${time(item.createdAt)}</div>
        <h2 class="notice-title-secondary">${item.title}</h2>
        <p class="notice-summary">${item.summary}</p>
        <button type="button" data-cloud-news="${escape(item.id)}" class="inner-btn-primary notice-button">查阅全文 →</button>
      </article>`).join('') || '<p class="notice-empty">暂无通告。</p>';
    },
    article(item) {
      return `<header class="notice-article-heading"><div class="notice-meta"><span>${item.category} / ${item.code}</span>${time(item.createdAt)}</div>
        <h2 class="notice-title-secondary">${item.title}</h2></header>
        <div class="notice-body whitespace-pre-wrap">${item.fullContent}</div>`;
    },
    comments(items) {
      return items.map(item => `<article class="notice-comment inner-card-alt">
        <header class="notice-comment-heading"><div class="notice-comment-identity"><span class="notice-comment-author">${escape(item.displayName)}</span><span class="notice-comment-department">${escape(item.department)}</span></div>${time(item.createdAt, 'relative-clock')}</header>
        <p class="notice-comment-body whitespace-pre-wrap">${escape(item.body)}</p>
      </article>`).join('') || '<p class="notice-empty">暂无留言。</p>';
    }
  };
})(globalThis);
