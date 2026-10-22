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
    pop.innerHTML = `<div class="lang-pop-h">Chọn ngôn ngữ · Language</div>` + LANGS.map(l => `<button type="button" data-lang="${l.code}" class="${l.code === cur ? 'on' : ''}"><b>${l.tag}</b><span>${l.name}</span>${l.code === cur ? '<i>✓</i>' : ''}</button>`).join('') +
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

  window.PSQLang = { list: LANGS, current: cur, info: LANGS.find(l => l.code === cur), set, menu, close };
})();
