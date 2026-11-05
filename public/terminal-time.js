/* Shared display clock. Absolute timestamps remain in the database. */
(function (root) {
  const zone = 'Asia/Shanghai';
  const days = new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit'});
  const hours = new Intl.DateTimeFormat('en-GB', {timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  let offset = 0;
  const now = () => Date.now() + offset;
  function parse(value) {
    if (typeof value === 'number') return new Date(value);
    if (value instanceof Date) return value;
    if (!value) return new Date(NaN);
    let text=String(value).trim();
    if (/^\d{4}-\d\d-\d\d$/.test(text)) text+='T00:00:00+08:00';
    else if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(text)) text=text.replace(' ','T')+'Z';
    return new Date(text);
  }
  function dayNumber(value) {
    const date=parse(value);if(!Number.isFinite(date.getTime()))return NaN;
    const parts=Object.fromEntries(days.formatToParts(date).map(p=>[p.type,p.value]));
    return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/86400000;
  }
  function relative(value, reference=now()) {
    const gap=dayNumber(reference)-dayNumber(value);
    if(!Number.isFinite(gap))return '记录待核';
    if(gap<=0)return '今天';if(gap===1)return '昨天';if(gap===2)return '前天';
    return gap+'天前';
  }
  const clock=value=>{const d=parse(value);return Number.isFinite(d.getTime())?hours.format(d):'—';};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function markup(value,mode='relative') {
    return '<time data-aved-time="'+escape(value)+'" data-time-mode="'+mode+'">'+escape(mode==='clock'?clock(value):relative(value))+'</time>';
  }
  function refresh() {
    if(!root.document)return;
    root.document.querySelectorAll('time[data-aved-time]').forEach(el=>{el.textContent=el.dataset.timeMode==='clock'?clock(el.dataset.avedTime):relative(el.dataset.avedTime);});
  }
  function sanitize(value,key='') {
    if(Array.isArray(value))return value.map(v=>sanitize(v));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sanitize(v,k)]));
    if(typeof value==='string'&&/(?:created|updated|checkin|date|day|time)/i.test(key)&&/^\d{4}-\d\d-\d\d/.test(value))return relative(value);
    return value;
  }
  root.AVEDTime={parse,relative,clock,markup,dayNumber,sanitize,now,refresh,sync(serverTime){if(Number.isFinite(serverTime))offset=serverTime-Date.now();refresh();}};
  if(root.document){setInterval(refresh,30000);root.document.addEventListener('visibilitychange',refresh);}
})(globalThis);
