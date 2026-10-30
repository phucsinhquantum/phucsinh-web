/* Phúc Sinh QuanTum: chọn ngôn ngữ hiển thị.
   Tiếng Việt là bản gốc. Các ngôn ngữ khác dịch tự động bằng Google Dịch (bản dịch máy),
   lựa chọn lưu trên trình duyệt (psq_lang). Nạp file này ở <head> mọi trang, trước intro.js và app.js. */
(function () {
  const LANGS = [
    { code: 'vi', name: 'Tiếng Việt', tag: 'VI' },
    { code: 'en', name: 'English', tag: 'EN' },
    { code: 'zh-CN', name: '中文', tag: '中' },
    { code: 'ar', name: 'العربية', tag: 'ع' },
    { code: 'th', name: 'ไทย', tag: 'TH' },
    { code: 'km', name: 'ភាសាខ្មែរ', tag: 'KM' },
    { code: 'lo', name: 'ພາສາລາວ', tag: 'LO' },
    { code: 'ko', name: '한국어', tag: 'KO' },
    { code: 'ja', name: '日本語', tag: 'JA' }
  ];
  // cờ vẽ bằng SVG (Windows không hiện được biểu tượng cờ dạng emoji), tỉ lệ 3:2, giản lược cho cỡ nhỏ
  const svg = b => `<svg class="lang-flag" viewBox="0 0 30 20" aria-hidden="true">${b}</svg>`;
  const star = (cx, cy, r, f) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .4 : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2); } return `<path d="${d}Z" fill="${f}"/>`; };
  const FLAGS = {
    vi: svg(`<rect width="30" height="20" fill="#da251d"/>${star(15, 10.4, 6, '#ffde00')}`),
    en: svg(`<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#c8102e" stroke-width="3.4"/>`),
    'zh-CN': svg(`<rect width="30" height="20" fill="#de2910"/>${star(5.5, 5.5, 3.2, '#ffde00')}${star(10.5, 2.2, 1, '#ffde00')}${star(12.6, 4.4, 1, '#ffde00')}${star(12.6, 7.4, 1, '#ffde00')}${star(10.5, 9.4, 1, '#ffde00')}`),
    ar: svg(`<rect width="30" height="20" fill="#006c35"/><path d="M8 8.5h14M8 8.5c2-1.6 4 1.6 6 0s4 1.6 6 0" stroke="#fff" stroke-width="1" fill="none"/><path d="M9 13.5h12" stroke="#fff" stroke-width="1.2"/>`),
    th: svg(`<rect width="30" height="20" fill="#a51931"/><rect y="3.33" width="30" height="13.34" fill="#f4f5f8"/><rect y="6.67" width="30" height="6.66" fill="#2d2a4a"/>`),
    km: svg(`<rect width="30" height="20" fill="#032ea1"/><rect y="5" width="30" height="10" fill="#e00025"/><path d="M10 13.4h10v-1.2h-1v-2.2l-1 .6v-1.8l-1-1.4-1 1.4-1-1.4-1 1.4-1-1.4v1.8l-1-.6v2.2h-1z" fill="#fff"/>`),
    lo: svg(`<rect width="30" height="20" fill="#ce1126"/><rect y="5" width="30" height="10" fill="#002868"/><circle cx="15" cy="10" r="4" fill="#fff"/>`),
    ko: svg(`<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0a2.5 2.5 0 0 0-5 0a2.5 2.5 0 0 1-5 0z" fill="#0047a0"/><g stroke="#000" stroke-width="1.1"><path d="M4.5 4.5l3-2.2M5.2 5.5l3-2.2M5.9 6.5l3-2.2"/><path d="M21.6 15.7l3-2.2M22.3 16.7l3-2.2M23 17.7l3-2.2"/><path d="M21.6 4.3l3 2.2M22.3 3.3l3 2.2M23 2.3l3 2.2"/><path d="M4.5 15.5l3 2.2M5.2 14.5l3 2.2M5.9 13.5l3 2.2"/></g>`),
    ja: svg(`<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>`)
  };
  const KEY = 'psq_lang';
  const get = () => { try { const c = localStorage.getItem(KEY); return LANGS.some(l => l.code === c) ? c : 'vi'; } catch (e) { return 'vi'; } };
  const cur = get();

  // cookie mà Google Dịch đọc để tự dịch trang
  function setCookie(v) {
    const host = location.hostname, parts = host.split('.');
    const doms = ['', host]; if (parts.length > 2) doms.push('.' + parts.slice(-2).join('.'));
    doms.forEach(dm => {
      const d = dm ? '; domain=' + dm : '';
      document.cookie = v ? `googtrans=${v}; path=/${d}` : `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    });
  }
  if (cur === 'vi') setCookie(''); else setCookie('/vi/' + cur);

  document.documentElement.classList.toggle('lang-tr', cur !== 'vi');

  function loadGoogle() {
    if (cur === 'vi' || window.google && google.translate) return;
    const box = document.createElement('div'); box.id = 'gt-el'; box.style.display = 'none'; document.body.appendChild(box);
    window.psqGT = () => { try { new google.translate.TranslateElement({ pageLanguage: 'vi', autoDisplay: false }, 'gt-el'); } catch (e) {} };
    const s = document.createElement('script'); s.src = 'https://translate.google.com/translate_a/element.js?cb=psqGT'; s.async = true;
    s.onerror = () => console.warn('Không tải được Google Dịch');
    document.head.appendChild(s);
  }
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', loadGoogle) : loadGoogle();

  function set(code) {
    if (!LANGS.some(l => l.code === code)) return;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    if (code === cur) return;
    setCookie(code === 'vi' ? '' : '/vi/' + code);
    location.reload();
  }

  // bảng chọn ngôn ngữ, mở cạnh một nút
  function menu(anchor, opts = {}) {
    close();
    const pop = document.createElement('div'); pop.className = 'lang-pop notranslate'; pop.setAttribute('translate', 'no'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Chọn ngôn ngữ');
    pop.innerHTML = `<div class="lang-pop-h">Chọn ngôn ngữ · Language</div>` + LANGS.map(l => `<button type="button" data-lang="${l.code}" class="${l.code === cur ? 'on' : ''}">${FLAGS[l.code] || `<b>${l.tag}</b>`}<span>${l.name}</span>${l.code === cur ? '<i>✓</i>' : ''}</button>`).join('') +
      `<p class="lang-pop-n">Bản dịch tự động, tiếng Việt là bản chính.</p>`;
    (opts.parent || document.body).appendChild(pop);
    const r = anchor.getBoundingClientRect(), W = innerWidth, H = innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.right - pw), W - pw - 12), top = r.bottom + 8;
    if (opts.center) left = Math.max(12, Math.min(W - pw - 12, r.left + r.width / 2 - pw / 2));
    if (top + ph > H - 12) top = Math.max(12, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-lang]'); if (b) { close(); set(b.dataset.lang); } });
    setTimeout(() => { document.addEventListener('click', close, { once: true }); }, 0);
    const first = pop.querySelector('.on') || pop.querySelector('button'); first && first.focus();
    pop.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } });
    return pop;
  }
  function close() { document.querySelectorAll('.lang-pop').forEach(p => p.remove()); }

  window.PSQLang = { list: LANGS, current: cur, info: LANGS.find(l => l.code === cur), flag: c => FLAGS[c || cur] || '', set, menu, close };
})();
