/* =========================================================
   PHÚC SINH QUANTUM — khung web app dùng chung cho mọi trang
   - Dựng thanh bên, thanh trên, thanh dưới (điện thoại), chân trang
   - Nền khói trầm + đốm sáng
   - Giỏ hàng (trên trình duyệt), tài khoản, đơn hàng (trên máy chủ, qua js/api.js)
   - Biểu đồ SVG, hình vẽ sản phẩm khi chưa có ảnh
   ========================================================= */
(function () {
  const S = window.SITE || {};
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (Math.round(n) || 0).toLocaleString('vi-VN') + 'đ';
  const dec = (v, u) => (Math.round(v * 10) / 10).toLocaleString('vi-VN') + u;
  const short = n => n >= 1e9 ? dec(n / 1e9, ' tỷ') : n >= 1e6 ? dec(n / 1e6, ' tr') : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
  const initials = name => (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const qs = k => new URLSearchParams(location.search).get(k);
  const today = () => new Date().toISOString().slice(0, 10);
  const fdate = iso => { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); };

  /* ---------- biểu tượng (nét mảnh) ---------- */
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 7H6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 .8 1.6 2 2 2 2s-1-3.5 1-7z"/>',
    gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18M15 3l-3 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S10.5 3 8 4s0 4 4 4zM12 8s1.5-5 4-4 0 4-4 4z"/>',
    ring: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
    beads: '<circle cx="12" cy="4.5" r="2"/><circle cx="18.5" cy="8.5" r="2"/><circle cx="18.5" cy="15.5" r="2"/><circle cx="12" cy="19.5" r="2"/><circle cx="5.5" cy="15.5" r="2"/><circle cx="5.5" cy="8.5" r="2"/>',
    truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.3"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-15-1 9-6 15-15 15z"/><path d="M5 19l7-7"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 13H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.5 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"/>',
    zalo: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h4l-4 4h4M14 9v4M16.5 9a1.5 2 0 1 1 0 4 1.5 2 0 0 1 0-4z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
    messenger: '<path d="M12 3C6.9 3 3 6.7 3 11.4c0 2.6 1.2 4.9 3.2 6.4V21l2.9-1.6c.9.3 1.9.4 2.9.4 5.1 0 9-3.7 9-8.4S17.1 3 12 3z"/><path d="M7.5 13.5l3-3.2 2.2 2 3.8-2.8-3 3.3-2.2-2z" fill="currentColor"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5z"/>',
    youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
    tiktok: '<path d="M14 3v11a4 4 0 1 1-4-4"/><path d="M14 3a5 5 0 0 0 5 5"/>'
  };
  const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="i ${cls}" aria-hidden="true">${P[n] || P.sparkle}</svg>`;

  /* ---------- dữ liệu trên trình duyệt ---------- */
  const CART_KEY = 'psq_cart_v1';
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  // sản phẩm do quản trị thêm / sửa trên trình duyệt (ghi đè lên data.js)
  /* ---------- video khách hàng (YouTube) ---------- */
  const VID_KEY = 'psq_videos_v1';
  const ytId = u => { u = String(u || '').trim(); const m = u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || u.match(/^([\w-]{11})$/); return m ? m[1] : null; };
  const videos = {
    ytId,
    list() { return (store.get(VID_KEY, null) || window.VIDEOS || []).map(v => ({ ...v, id: ytId(v.url) })).filter(v => v.id); },
    save(list) { store.set(VID_KEY, list.map(({ url, title, name }) => ({ url, title, name }))); },
    thumb: id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    watch: id => `https://www.youtube.com/watch?v=${id}`,
    embed: id => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`
  };
  /* ---------- đại lý uy tín ---------- */
  const DL_KEY = 'psq_dealers_v1';
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dlcopy]'); if (!b) return;
    const code = b.dataset.dlcopy, done = () => toast(`Đã sao chép mã đại lý ${code}`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => prompt('Mã số đại lý:', code));
    else prompt('Mã số đại lý:', code);
  });
  const dealers = {
    all() { return (store.get(DL_KEY, null) || window.DEALERS || []).filter(x => x && x.name); },
    list() { return dealers.all().filter(x => !x.hidden); },
    save(list) { store.set(DL_KEY, list); },
    tel: p => String(p || '').replace(/[^0-9+]/g, ''),
    card(x, i = 0) {
      const tel = dealers.tel(x.phone), ini = initials(x.name.replace(/\(.*?\)/g, '').replace(/^Đại lý\s+/i, '')) || 'ĐL';
      return `<article class="card dealer-card ${['glow-gold', 'glow-cyan'][i % 2]}">
        <div class="dealer-top"><span class="dealer-ph">${x.photo ? `<img src="${esc(x.photo)}" alt="" loading="lazy">` : esc(ini)}</span>
          <div class="dealer-id"><span class="dealer-badge">${icon('shield')}Đại lý uy tín</span><h3>${esc(x.name)}</h3>${x.code ? `<span class="dealer-code">Mã số đại lý: <b>${esc(x.code)}</b><button type="button" class="dealer-copy" data-dlcopy="${esc(x.code)}" aria-label="Sao chép mã ${esc(x.code)}" title="Sao chép mã">${icon('copy')}</button></span>` : x.area ? `<small>${icon('pin')}${esc(x.area)}</small>` : ''}</div></div>
        ${x.note ? `<p class="dealer-note">${esc(x.note)}</p>` : ''}
        ${x.code ? `<a class="dealer-reg" href="thanh-vien.html?dang-ky=1&ref=${encodeURIComponent(x.code)}">${icon('user')}Đăng ký thành viên với mã ${esc(x.code)}</a>` : ''}
        ${x.address ? `<p class="dealer-line">${icon('home')}<span>${esc(x.address)}</span></p>` : ''}
        ${x.phone ? `<p class="dealer-line">${icon('phone')}<span>${esc(x.phone)}</span></p>` : ''}
        <div class="dealer-acts">${tel ? `<a class="btn btn-gold btn-sm" href="tel:${esc(tel)}">${icon('phone')} Gọi</a><a class="btn btn-outline-gold btn-sm" href="https://zalo.me/${esc(tel.replace(/^\+84/, '0'))}" target="_blank" rel="noopener">Zalo</a>` : `<a class="btn btn-outline-gold btn-sm" href="lien-he.html">${icon('chat')} Liên hệ</a>`}
          ${x.map ? `<a class="btn btn-ghost btn-sm" href="${esc(/^https?:/i.test(x.map) ? x.map : 'https://www.google.com/maps/search/' + encodeURIComponent(x.map))}" target="_blank" rel="noopener">${icon('map')} Bản đồ</a>` : x.address ? `<a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/${encodeURIComponent(x.address)}" target="_blank" rel="noopener">${icon('map')} Bản đồ</a>` : ''}</div>
      </article>`;
    }
  };
  const PROD_KEY = 'psq_products_v1';
  (function applyProductEdits() {
    const ed = store.get(PROD_KEY, null); if (!ed || !window.PRODUCTS) return;
    (ed.edits || []).forEach(e => { const p = PRODUCTS.find(x => x.id === e.id); if (p) Object.assign(p, e); else PRODUCTS.push(e); });
    if (ed.hidden) for (let i = PRODUCTS.length - 1; i >= 0; i--) if (ed.hidden.includes(PRODUCTS[i].id)) PRODUCTS.splice(i, 1);
  })();
  const products = {
    save(p) { const ed = store.get(PROD_KEY, { edits: [], hidden: [] }); ed.edits = (ed.edits || []).filter(e => e.id !== p.id); ed.edits.push(p); store.set(PROD_KEY, ed); },
    hide(id) { const ed = store.get(PROD_KEY, { edits: [], hidden: [] }); ed.hidden = [...new Set([...(ed.hidden || []), id])]; store.set(PROD_KEY, ed); },
    reset() { store.set(PROD_KEY, null); }
  };
  // dữ liệu nằm trên máy chủ (js/api.js); trang nhận bản theo quyền người đang đăng nhập
  const db = {
    load() { return API.load(); },
    save(d) { return API.save(d); }
  };

  /* ---------- tài khoản ---------- */
  const auth = {
    user() { const m = API.me; if (!m) return null; return (API.db.users || []).find(u => u.id === m.id) || m; },
    // đăng nhập bằng email, tên truy cập, mã thành viên hoặc số điện thoại
    login(login, pass) { const r = API.act('login', { login, pass }); return r.error ? r : { user: r.user }; },
    register(f) { const r = API.act('register', f); return r.error ? r : { user: r.user }; },
    update(patch) { const r = API.act('profile', patch); return r.error ? null : auth.user(); },
    logout() { API.logout(); },
    changePass(oldPass, newPass) { return API.act('changePass', { old: oldPass, pass: newPass }); }
  };

  /* ---------- giỏ hàng ---------- */
  const product = id => PRODUCTS.find(p => p.id === id);
  // tồn kho do quản trị cập nhật (Kho): null là chưa quản lý tồn kho, coi như còn hàng
  let stockC = null;
  const stockMap = () => stockC || (setTimeout(() => { stockC = null; }), stockC = (API.db || {}).stock || {});
  const stockOf = id => { const m = stockMap(); return id in m ? Math.max(0, +m[id] || 0) : null; };
  const soldOut = id => stockOf(id) === 0;
  const cart = {
    items() { return store.get(CART_KEY, []).filter(x => product(x.id)); },
    count() { return cart.items().reduce((s, x) => s + x.qty, 0); },
    total() { return cart.items().reduce((s, x) => s + product(x.id).price * x.qty, 0); },
    add(id, qty = 1) {
      const st = stockOf(id); if (st === 0) { toast('Sản phẩm này đã hết hàng.', 'err'); return false; }
      const it = cart.items(); const f = it.find(x => x.id === id); f ? f.qty += qty : it.push({ id, qty });
      const g = f || it[it.length - 1]; let capped = false; if (st !== null && g.qty > st) { g.qty = st; capped = true; }
      store.set(CART_KEY, it); cart.changed(); if (capped) toast(`Sản phẩm này chỉ còn ${st} trong kho.`, 'err'); return true;
    },
    set(id, qty) { let it = cart.items(); const f = it.find(x => x.id === id), st = stockOf(id); if (st !== null && qty > st) { qty = st; toast(`Sản phẩm này chỉ còn ${st} trong kho.`, 'err'); } if (f) f.qty = qty; it = it.filter(x => x.qty > 0); store.set(CART_KEY, it); cart.changed(); },
    clear() { store.set(CART_KEY, []); cart.changed(); },
    changed() { $$('[data-cart-count]').forEach(n => { const c = cart.count(); n.textContent = c; n.hidden = !c; }); renderDrawer(); document.dispatchEvent(new CustomEvent('cart:change')); }
  };
  // đặt hàng: máy chủ tính lại giá, tồn kho, trừ ví. extra: { useShop, useCash, saveAddr }
  function placeOrder(info, extra = {}) {
    const items = cart.items().map(x => ({ id: x.id, qty: x.qty }));
    if (!items.length) return { error: 'Giỏ hàng đang trống.' };
    const r = API.act('placeOrder', Object.assign({ items, info }, extra));
    if (r.error) return r;
    cart.clear(); return { order: r.order };
  }

  // mã QR chuyển khoản (VietQR): quét bằng ứng dụng ngân hàng, số tiền và nội dung tự điền
  function qr(amount, info) {
    const B = S.bank || {}; if (!B.account || !B.name) return '';
    const src = `https://img.vietqr.io/image/${encodeURIComponent(B.name.replace(/\s+/g, ''))}-${encodeURIComponent(B.account.replace(/\s/g, ''))}-compact2.png?amount=${Math.round(amount) || ''}&addInfo=${encodeURIComponent(info || '')}&accountName=${encodeURIComponent(B.owner || '')}`;
    return `<div class="qr-pay"><img src="${esc(src)}" alt="Mã QR chuyển khoản" width="200" height="236" loading="lazy" onerror="this.parentNode.remove()"><small>Quét mã bằng ứng dụng ngân hàng, số tiền và nội dung tự điền</small></div>`;
  }

  /* ---------- chờ thanh toán + gửi ảnh bill (đơn hàng, gói CTV, gói đại lý, nạp tiền) ----------
     payWait.html({ sent }) vẽ khung; payWait.start({ send(bill), check(), paidTitle, paidSub, onPaid, open }) gắn xử lý.
     Mỗi trang chỉ có một khung #payWait. Ảnh bill thu nhỏ còn tối đa 1600px trước khi gửi. */
  const payWait = (() => {
    let cfg = null, bill = null, timer = null;
    const sentTxt = ['Đã gửi bill, chờ công ty duyệt', 'Công ty đang đối chiếu với tài khoản ngân hàng. Anh chị giữ trang này, trang tự đổi khi được duyệt.'];
    const html = (o = {}) => `<div class="pay-wait mt-2" id="payWait" role="status" aria-live="polite"><span class="pw-ring" aria-hidden="true"><i></i></span><div><b>${o.sent ? sentTxt[0] : 'Đang chờ xác nhận thanh toán'}</b><small>${o.sent ? sentTxt[1] : 'Chuyển khoản xong anh chị bấm nút bên cạnh để gửi ảnh bill. Giữ trang này, trang tự cập nhật ngay khi công ty duyệt.'}</small></div><button class="btn btn-sm btn-gold" type="button" id="pwClaim">${icon(o.sent ? 'upload' : 'check')} ${o.sent ? 'Gửi lại bill' : 'Tôi đã chuyển khoản'}</button></div>`;
    const panel = () => `<div class="pw-bill" id="pwBill"><label class="pw-pick" for="pwFile">${bill ? `<img src="${bill}" alt="Ảnh bill đã chọn">` : `${icon('upload')}<span><b>Chọn ảnh bill chuyển khoản</b><small>Chụp màn hình giao dịch thành công trong ứng dụng ngân hàng</small></span>`}</label><input type="file" id="pwFile" accept="image/jpeg,image/png,image/webp" hidden><div class="pw-acts"><button class="btn btn-sm btn-gold" type="button" id="pwSend"${bill ? '' : ' disabled'}>${icon('check')} Gửi bill cho công ty</button><button class="btn btn-sm" type="button" id="pwCancel">Để sau</button></div></div>`;
    const shrink = file => new Promise((ok, no) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); ok(cv.toDataURL('image/jpeg', .82)); };
      img.onerror = () => { URL.revokeObjectURL(u); no(); }; img.src = u;
    });
    const openPanel = () => { const c = $('#pwClaim'), box = $('#payWait'); if (!box || $('#pwBill')) return; if (c) c.hidden = true; box.insertAdjacentHTML('afterend', panel()); };
    function paid(st) {
      clearInterval(timer); const box = $('#payWait'); if (!box) return;
      const bp = $('#pwBill'); if (bp) bp.remove();
      box.classList.add('paid');
      box.innerHTML = `<span class="pw-ok" aria-hidden="true">${icon('check')}</span><div><b>${esc(cfg.paidTitle || 'Đã nhận thanh toán')}</b><small>${esc(cfg.paidSub || 'Cảm ơn anh chị!')}</small></div>${'<i class="pw-dot"></i>'.repeat(14)}`;
      box.querySelectorAll('.pw-dot').forEach((d, i) => { const a = i / 14 * Math.PI * 2; d.style.setProperty('--x', Math.cos(a) * (70 + (i % 3) * 25) + 'px'); d.style.setProperty('--y', Math.sin(a) * (40 + (i % 4) * 14) + 'px'); d.style.setProperty('--c', ['#f3c76b', '#4fe6df', '#45e08f', '#b98cff'][i % 4]); });
      toast(cfg.paidTitle || 'Đã nhận thanh toán');
      if (cfg.onPaid) cfg.onPaid(st);
    }
    function start(o) {
      cfg = o; bill = null; clearInterval(timer); const t0 = Date.now();
      if (o.open) openPanel();
      timer = setInterval(() => {
        if (!$('#payWait') || Date.now() - t0 > 45 * 60e3) return clearInterval(timer);
        const st = cfg.check(); if (st && st !== 'pending') paid(st);
      }, 5000);
    }
    document.addEventListener('click', e => {
      if (!cfg || !e.target.closest) return;
      if (e.target.closest('#pwClaim')) { openPanel(); return; }
      if (e.target.closest('#pwCancel')) { bill = null; $('#pwBill').remove(); const c = $('#pwClaim'); if (c) c.hidden = false; return; }
      const s = e.target.closest('#pwSend'); if (!s || !bill) return;
      s.disabled = true; s.textContent = 'Đang gửi...';
      setTimeout(() => {
        const r = cfg.send(bill);
        if (r.error) { s.disabled = false; s.innerHTML = icon('check') + ' Gửi bill cho công ty'; toast(r.error, 'err'); return; }
        bill = null; $('#pwBill').remove();
        if (r.status && r.status !== 'pending') return paid(r.status);
        const box = $('#payWait'); if (box) box.outerHTML = html({ sent: true });
        toast('Đã gửi bill, công ty sẽ duyệt sớm');
      }, 30);
    });
    document.addEventListener('change', e => {
      if (!cfg || e.target.id !== 'pwFile' || !e.target.files[0]) return;
      const f = e.target.files[0];
      if (!/^image\//.test(f.type)) { toast('Anh chị chọn tệp ảnh giúp em', 'err'); return; }
      shrink(f).then(u => { bill = u; $('#pwBill').outerHTML = panel(); }, () => toast('Không đọc được ảnh này, anh chị chọn ảnh khác', 'err'));
    });
    return { html, start, stop: () => { clearInterval(timer); cfg = null; } };
  })();

  /* ---------- hình vẽ sản phẩm (khi chưa có ảnh thật) ---------- */
  const TONES = [['#6b3d1f', '#3a1f0e', '#c98a52'], ['#4a2a16', '#24130a', '#a8703f'], ['#7a4a26', '#3d2211', '#d9a066'], ['#5b3a22', '#2b190c', '#b98455'], ['#6a3a1c', '#2e170a', '#c28048']];
  let artN = 0;
  function art(p, cls = '') {
    if (p.image) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" class="${cls}">`;
    const [c1, c2, hi] = TONES[(p.tone || 0) % TONES.length];
    const id = 'a' + (artN++);
    const bead = (x, y, r, k = 0) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="url(#${id}b)"/><path d="M${(x - r * .55).toFixed(1)} ${(y - r * .2).toFixed(1)}q${(r * .4).toFixed(1)} ${(-r * .5).toFixed(1)} ${(r * .9).toFixed(1)} ${(-r * .25).toFixed(1)}" stroke="${hi}" stroke-opacity=".35" stroke-width="${(r * .12).toFixed(1)}" fill="none"/>`;
    const defs = `<defs><radialGradient id="${id}b" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
      <radialGradient id="${id}g" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#f3c76b"/><stop offset="1" stop-color="#9a6a22"/></radialGradient>
      <radialGradient id="${id}j" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d6fff9"/><stop offset=".5" stop-color="#3fbfb2"/><stop offset="1" stop-color="#0d4f4a"/></radialGradient>
      <filter id="${id}s"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity=".55"/></filter></defs>`;
    let body = '';
    if (p.art === 'bracelet' || p.art === 'mala' || p.art === 'necklace') {
      const isMala = p.art === 'mala', isNeck = p.art === 'necklace';
      const n = isMala ? 36 : isNeck ? 30 : Math.round(26 - (p.bead || 12) * .7);
      const R = isMala ? 70 : isNeck ? 72 : 62, ry = isNeck ? 1.12 : 1;
      const r = isMala ? 6.3 : isNeck ? 6.5 : Math.min(15, Math.PI * R / n * .98);
      const cx = 100, cy = isNeck ? 92 : 100;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i / n * Math.PI * 2;
        if (isNeck && Math.abs(a - Math.PI / 2) < .25) continue;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * ry;
        const charm = p.charm && (i === Math.floor(n / 2) || i === Math.floor(n / 2) - 3 || i === Math.floor(n / 2) + 3);
        if (charm) body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * .7).toFixed(1)}" fill="url(#${id}g)"/>`;
        else if (p.gem && i % 4 === 0) body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="url(#${id}j)"/>`;
        else body += bead(x, y, r);
      }
      if (isMala) body += `<circle cx="100" cy="178" r="9" fill="url(#${id}g)"/><path d="M96 186l-4 12M100 187v13M104 186l4 12" stroke="#c99a45" stroke-width="2"/>`;
      if (isNeck) body += `<ellipse cx="100" cy="176" rx="12" ry="16" fill="url(#${id}j)" stroke="#f3c76b" stroke-width="1.5"/>`;
    } else if (p.art === 'statue') {
      body = `<ellipse cx="100" cy="170" rx="58" ry="12" fill="${c2}"/><path d="M52 168c0-30 14-52 48-52s48 22 48 52z" fill="url(#${id}b)"/><circle cx="100" cy="84" r="34" fill="url(#${id}b)"/><path d="M80 82q6-5 12 0M108 82q6-5 12 0M88 100q12 9 24 0" stroke="${c2}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="66" cy="88" r="8" fill="url(#${id}b)"/><circle cx="134" cy="88" r="8" fill="url(#${id}b)"/>`;
    } else if (p.art === 'car') {
      body = `<path d="M100 18v40" stroke="#c99a45" stroke-width="2"/><circle cx="100" cy="22" r="6" fill="none" stroke="#f3c76b" stroke-width="2.5"/>`;
      for (let i = 0; i < 6; i++) body += bead(100, 66 + i * 15, 7.5);
      body += `<ellipse cx="100" cy="166" rx="22" ry="26" fill="url(#${id}b)" stroke="#f3c76b" stroke-width="2"/><text x="100" y="174" text-anchor="middle" font-size="20" fill="#f3c76b" font-family="Georgia">安</text><path d="M92 192l-3 6M100 193v7M108 192l3 6" stroke="#c99a45" stroke-width="2"/>`;
    } else if (p.art === 'cone') {
      body = `<ellipse cx="100" cy="164" rx="62" ry="14" fill="#1a1410" stroke="#c99a45" stroke-opacity=".5"/>`;
      [[70, 150], [100, 156], [130, 150], [86, 140], [116, 140]].forEach(([x, y], i) => body += `<path d="M${x - 13} ${y}L${x} ${y - 38}L${x + 13} ${y}z" fill="url(#${id}b)"/>`);
      body += `<path d="M100 104c-8-14 10-20 0-36s8-22 2-34" stroke="#e8e2d6" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    } else {
      body = `<rect x="38" y="70" width="124" height="98" rx="8" fill="#1d130c" stroke="#f3c76b" stroke-width="2"/><rect x="32" y="56" width="136" height="24" rx="6" fill="#2a1a0f" stroke="#f3c76b" stroke-width="2"/><path d="M100 56v112" stroke="#f3c76b" stroke-width="5"/><path d="M100 56c-18-30-46-14-30 0M100 56c18-30 46-14 30 0" stroke="#f3c76b" stroke-width="4" fill="none"/><text x="100" y="134" text-anchor="middle" font-size="22" fill="#f3c76b" font-family="Georgia" font-weight="700">PSQ</text>`;
    }
    return `<svg viewBox="0 0 200 200" class="${cls}" role="img" aria-label="${esc(p.name)}">${defs}<g filter="url(#${id}s)">${body}</g></svg>`;
  }

  /* ---------- biểu đồ ---------- */
  // sparkline nhỏ trong thẻ số liệu
  function spark(values, color = '#f3c76b') {
    const w = 120, h = 36, mx = Math.max(...values), mn = Math.min(...values);
    const pts = values.map((v, i) => [i / (values.length - 1) * w, h - 4 - (v - mn) / (mx - mn || 1) * (h - 8)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const id = 'sp' + (artN++);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${w} ${h}L0 ${h}z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${color})"/></svg>`;
  }
  // biểu đồ vùng nhiều đường, có điểm sáng và chú thích khi di chuột
  function area(el, { labels, series, fmt = short, height = 260, mark = -1 }) {
    const W = Math.max(320, el.clientWidth || 600), H = height, pl = 40, pr = 12, pt = 16, pb = 28;
    const all = series.flatMap(s => s.values), mx = (Math.max(...all, 0) || 1) * 1.15;
    const X = i => pl + i / (labels.length - 1) * (W - pl - pr), Y = v => pt + (1 - v / mx) * (H - pt - pb);
    const smooth = vals => vals.map((v, i) => { const x = X(i), y = Y(v); if (!i) return `M${x} ${y}`; const px = X(i - 1), py = Y(vals[i - 1]), cx = (px + x) / 2; return `C${cx} ${py} ${cx} ${y} ${x} ${y}`; }).join('');
    let g = '', defs = '';
    for (let k = 0; k <= 4; k++) { const v = mx / 1.15 * k / 4, y = Y(v); g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 5"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end">${fmt(v)}</text>`; }
    const step = Math.ceil(labels.length / (W < 500 ? 6 : 12));
    labels.forEach((l, i) => { if (i !== mark && (i % step || (mark != null && mark >= 0 && Math.abs(i - mark) < step * 0.75))) return; g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle"${i === mark ? ' fill="#4fe6df"' : ''}>${l}</text>`; });
    series.forEach((s, k) => {
      const id = 'ar' + (artN++); const d = smooth(s.values);
      defs += `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity="${k ? .12 : .32}"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
      g += `<path d="${d}L${X(labels.length - 1)} ${Y(0)}L${X(0)} ${Y(0)}z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" style="filter:drop-shadow(0 0 6px ${s.color})"/>`;
      if (s.dots) s.values.forEach((v, i) => { if (labels.length > 14 && i % 3 && i !== mark) return; g += `<circle cx="${X(i)}" cy="${Y(v)}" r="${i === mark ? 6 : 4.5}" fill="${s.color}" style="filter:drop-shadow(0 0 6px ${s.color})"/>`; });
    });
    if (mark >= 0) { const v = series[0].values[mark]; g += `<line x1="${X(mark)}" x2="${X(mark)}" y1="${Y(v)}" y2="${Y(0)}" stroke="#4fe6df" stroke-dasharray="3 4" stroke-opacity=".7"/><g transform="translate(${X(mark)},${Y(v) - 22})"><rect x="-32" y="-12" width="64" height="22" rx="11" fill="#0e2b2a" stroke="#4fe6df"/><text y="4" text-anchor="middle" fill="#bffcf7" font-weight="600">${fmt(v)}</text></g>`; }
    // đốm sáng trang trí
    let r = 3; for (let i = 0; i < 26; i++) { r = (r * 9301 + 49297) % 233280; const x = pl + (r / 233280) * (W - pl - pr); r = (r * 9301 + 49297) % 233280; const y = pt + (r / 233280) * (H - pt - pb) * .7; g += `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.6 : 2.6}" fill="${i % 2 ? '#4fe6df' : '#f3c76b'}" opacity=".55"/>`; }
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><defs>${defs}</defs>${g}<g class="hover"></g></svg><div class="chart-tip" hidden></div>`;
    const svg = el.querySelector('svg'), hv = svg.querySelector('.hover');
    svg.addEventListener('pointermove', e => {
      const b = svg.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width * W;
      const i = Math.max(0, Math.min(labels.length - 1, Math.round((x - pl) / (W - pl - pr) * (labels.length - 1))));
      hv.innerHTML = `<line x1="${X(i)}" x2="${X(i)}" y1="${pt}" y2="${Y(0)}" stroke="rgba(255,255,255,.18)"/>` + series.map(s => `<circle cx="${X(i)}" cy="${Y(s.values[i])}" r="5" fill="#0b0f12" stroke="${s.color}" stroke-width="2"/>`).join('') +
        `<g transform="translate(${Math.min(W - 70, Math.max(70, X(i)))},${pt + 6})"><rect x="-62" y="-4" width="124" height="${18 + series.length * 16}" rx="8" fill="rgba(10,14,16,.92)" stroke="rgba(255,255,255,.12)"/><text x="0" y="10" text-anchor="middle" fill="#eef2f1">${labels[i]}</text>${series.map((s, k) => `<text x="0" y="${27 + k * 16}" text-anchor="middle" fill="${s.color}">${esc(s.name || '')} ${fmt(s.values[i])}</text>`).join('')}</g>`;
    });
    svg.addEventListener('pointerleave', () => hv.innerHTML = '');
  }
  // biểu đồ vòng
  function donut(el, { segments, center, sub, size = 150 }) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1, R = 58, C = 2 * Math.PI * R;
    let off = 0, arcs = '';
    segments.forEach(s => { const len = s.value / total * C; arcs += `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${Math.max(0, len - 3)} ${C}" stroke-dashoffset="${-off}" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${s.color})"/>`; off += len; });
    el.innerHTML = `<svg viewBox="0 0 160 160" width="${size}" height="${size}" style="display:block;margin:0 auto"><g transform="rotate(-90 80 80)"><circle cx="80" cy="80" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="16"/>${arcs}</g><text x="80" y="80" text-anchor="middle" fill="#eef2f1" font-size="24" font-weight="700" font-family="Be Vietnam Pro, sans-serif">${esc(center)}</text><text x="80" y="100" text-anchor="middle" fill="#6f7c80" font-size="11" font-family="Be Vietnam Pro, sans-serif">${esc(sub || '')}</text></svg>`;
  }

  /* ---------- nền khói trầm + đốm sáng ---------- */
  function ambient() {
    const wrap = document.createElement('div'); wrap.className = 'ambient'; wrap.setAttribute('aria-hidden', 'true');
    const cv = document.createElement('canvas'); wrap.appendChild(cv); document.body.prepend(wrap);
    const ctx = cv.getContext('2d'); const reduce = document.documentElement.classList.contains('reduce-motion');
    let W, H, dpr, parts = [], smoke = [], last = 0, raf;
    const sprite = (r, stops) => { const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d'); const gr = g.createRadialGradient(r, r, 0, r, r, r); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; };
    const gold = sprite(32, [[0, 'rgba(255,226,150,1)'], [.25, 'rgba(243,199,107,.6)'], [1, 'rgba(243,199,107,0)']]);
    const cyan = sprite(32, [[0, 'rgba(190,255,250,1)'], [.25, 'rgba(79,230,223,.55)'], [1, 'rgba(79,230,223,0)']]);
    const puff = sprite(128, [[0, 'rgba(210,220,225,.16)'], [.5, 'rgba(190,200,205,.06)'], [1, 'rgba(190,200,205,0)']]);
    const rnd = (a, b) => a + Math.random() * (b - a);
    function size() {
      // khói và đốm sáng vốn mềm, vẽ ở nửa độ phân giải là đủ đẹp mà nhẹ máy hơn nhiều
      dpr = 0.5; W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = W < 700 ? 22 : 46;
      parts = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(2, 9), blur: Math.random() < .25, vy: rnd(4, 14), vx: rnd(-4, 4), ph: rnd(0, 6.3), c: Math.random() < .7 ? gold : cyan }));
      smoke = Array.from({ length: W < 700 ? 5 : 9 }, (_, i) => ({ x: rnd(-.1, .5) * W, y: rnd(.2, 1.1) * H, s: rnd(.5, 1.1) * Math.max(W, H) * .32, vx: rnd(4, 10), vy: rnd(-8, -3), ph: rnd(0, 6.3) }));
    }
    let slow = 0, n = 0;
    function draw(t) {
      raf = requestAnimationFrame(draw);
      if (t - last < 33) return;
      // máy không kịp vẽ (khung hình kéo dài) thì dừng nền động, giữ ảnh tĩnh để trang không giật
      if (n++ > 5) { slow = t - last > 60 ? slow + 1 : Math.max(0, slow - 1); if (slow > 12) { cancelAnimationFrame(raf); return; } }
      const dt = Math.min(.08, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of smoke) {
        s.x += s.vx * dt; s.y += s.vy * dt; if (s.x - s.s > W || s.y + s.s < 0) { s.x = -s.s * .6; s.y = rnd(.5, 1.1) * H; }
        const k = 1 + .08 * Math.sin(t / 3000 + s.ph);
        ctx.globalAlpha = .55; ctx.drawImage(puff, s.x - s.s * k, s.y - s.s * .55, s.s * 2 * k, s.s * 1.1);
      }
      for (const p of parts) {
        p.y -= p.vy * dt; p.x += (p.vx + Math.sin(t / 2000 + p.ph) * 5) * dt;
        if (p.y < -20) { p.y = H + 20; p.x = rnd(0, W); }
        const tw = .5 + .5 * Math.sin(t / 900 + p.ph), r = p.blur ? p.r * 2.6 : p.r;
        ctx.globalAlpha = (p.blur ? .22 : .5) * (.4 + tw * .6);
        ctx.drawImage(p.c, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (reduce) cancelAnimationFrame(raf);
    }
    size(); addEventListener('resize', size);
    let on = false;
    const run = () => { on = true; wrap.classList.add('on'); last = performance.now(); raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (on) { last = performance.now(); raf = requestAnimationFrame(draw); } });
    // đang chạy intro thì chờ intro tan xong mới bật, tránh 2 lớp hiệu ứng chạy cùng lúc gây giật
    if (document.documentElement.classList.contains('intro-cover')) document.addEventListener('psq:intro-leave', () => setTimeout(run, 1300), { once: true });
    else run();
  }

  /* ---------- khung trang ---------- */
  const NAV = [
    { id: 'home', href: 'index.html', label: 'Trang chủ', icon: 'home' },
    { id: 'about', href: 'gioi-thieu.html', label: 'Giới thiệu', icon: 'info' },
    { id: 'shop', href: 'san-pham.html', label: 'Sản phẩm', icon: 'bag' },
    { id: 'learn', href: 'kien-thuc.html', label: 'Kiến thức trầm', icon: 'book' },
    { id: 'order', href: 'dat-hang.html', label: 'Đặt hàng', icon: 'cart', cart: true },
    { id: 'member', href: 'thanh-vien.html', label: 'Thành viên', icon: 'user' },
    { id: 'wheel', href: 'vong-quay.html', label: 'Vòng quay may mắn', icon: 'gift' },
    { id: 'contact', href: 'lien-he.html', label: 'Liên hệ', icon: 'chat' }
  ];
  const TABS = ['home', 'shop', 'learn', 'order', 'member'];
  function shell() {
    const page = $('#page'); if (!page) return;
    const cur = document.body.dataset.page, u = auth.user();
    const link = (n, i = 9) => `<a href="${n.href}" style="--i:${i}" class="${n.id === cur ? 'active' : ''}${n.icon === 'gift' ? ' gift-blink' : ''}"${n.id === cur ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span>${n.cart ? '<span class="badge gold" data-cart-count hidden>0</span>' : ''}</a>`;
    const app = document.createElement('div'); app.className = 'app';
    try { if (localStorage.getItem('psq_side_pin') === '1') app.classList.add('side-pinned'); } catch (e) {}
    app.innerHTML = `
      <div class="side-back" data-nav-close></div>
      <aside class="side" aria-label="Điều hướng">
        <div class="side-in card">
          <a class="brand notranslate" translate="no" href="index.html"><img src="${S.logo}" alt="${esc(S.short)}"><b>${esc(S.brand)}</b></a>
          <nav class="nav">${NAV.map(link).join('')}</nav>
          ${u && u.role === 'admin' && u.status !== 'locked' ? `<div class="nav-label">Quản lý</div>
          <nav class="nav">${link({ id: 'admin', href: 'quan-tri.html', label: 'Quản trị', icon: 'grid' })}</nav>` : ''}
          <div class="nav-label nav-cats">Danh mục</div>
          <nav class="nav nav-cats">${CATEGORIES.slice(0, 4).map((c, i) => `<a href="san-pham.html?cat=${c.id}"><span class="dot" style="color:${['#4fe6df', '#b98cff', '#45e08f', '#f3c76b'][i]}"></span><span>${esc(c.name)}</span></a>`).join('')}</nav>
          <div class="side-promo"><div class="card glow-cyan" style="padding:16px">
            <div class="row" style="gap:8px;font-weight:600">${icon('sparkle', 'gold')}<span>Thành viên PSQ</span></div>
            <p class="dim" style="font-size:12px;margin:6px 0 12px">Kích hoạt cộng tác viên, lên đại lý để nhận hoa hồng và điểm thưởng.</p>
            <a class="btn btn-grad btn-sm btn-block" href="thanh-vien.html">${u ? 'Vào tài khoản' : 'Đăng ký thành viên'}</a>
          </div></div>
          <button class="side-pin" type="button" data-side-pin aria-label="Ghim thanh bên" title="Ghim thanh bên">${icon('menu')}</button>
          <a class="side-user" href="thanh-vien.html">
            <span class="avatar">${u ? (u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(initials(u.name))) : icon('user')}</span>
            <span><b>${u ? esc(u.name) : 'Khách'}</b><small>${u ? (u.role === 'admin' ? 'Quản trị viên' : 'Thành viên') : 'Đăng nhập / Đăng ký'}</small></span>
          </a>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" type="button" aria-label="Mở menu" data-nav-open>${icon('menu')}</button>
          <div><div class="crumb">${esc(S.brand)} / ${esc(page.dataset.crumb || page.dataset.title || '')}</div><h1>${esc(page.dataset.title || '')}</h1></div>
          <div class="top-actions">
            ${ctvCta()}
            <form class="search" action="san-pham.html" role="search">${icon('search')}<input name="q" placeholder="Tìm sản phẩm, bài viết..." aria-label="Tìm kiếm"></form>
            ${window.PSQLang ? `<button class="icon-btn lang-btn notranslate" type="button" translate="no" aria-label="Chọn ngôn ngữ" aria-haspopup="dialog" data-lang-open>${icon('globe')}<b>${esc(PSQLang.info.tag)}</b></button>` : ''}
            <a class="icon-btn gift-btn gift-blink" href="vong-quay.html" aria-label="Vòng quay may mắn">${icon('gift')}</a>
            <button class="icon-btn" type="button" aria-label="Giỏ hàng" data-cart-open>${icon('cart')}<span class="count" data-cart-count hidden>0</span></button>
            <button class="icon-btn user-btn${u ? ' on' : ''}" type="button" aria-label="Tài khoản" aria-haspopup="menu" aria-expanded="false" data-user-open>${u ? `<span class="avatar">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(initials(u.name))}</span>` : icon('user')}</button>
          </div>
        </header>
        <div class="content"></div>
        <footer class="foot">
          <div><a class="brand" href="index.html" style="padding:0 0 12px"><img src="${S.logo}" alt=""><b>${esc(S.brand)}</b></a>
            <p style="max-width:36ch">Trầm hương tự nhiên tuyển chọn, chế tác thủ công, có nguồn gốc rõ ràng.</p></div>
          <div><h4>Khám phá</h4><a href="gioi-thieu.html">Giới thiệu</a><a href="san-pham.html">Sản phẩm</a><a href="kien-thuc.html">Kiến thức trầm</a><a href="thanh-vien.html">Thành viên</a></div>
          <div><h4>Hỗ trợ</h4><a href="dat-hang.html">Đặt hàng</a><a href="lien-he.html">Liên hệ</a><a href="lien-he.html#chinh-sach">Chính sách đổi trả</a><a href="lien-he.html#chinh-sach">Bảo hành</a>${pwa.can() ? '<a href="#" data-user-act="install">Cài ứng dụng PSQ</a>' : ''}</div>
          <div><h4>Liên hệ</h4><a href="tel:${esc(S.phone.replace(/\s/g, ''))}">${esc(S.phone)}</a><a href="mailto:${esc(S.email)}">${esc(S.email)}</a><span style="display:block;padding:4px 0">${esc(S.address)}</span>${footSocial()}</div>
          <div class="copy"><span>© ${new Date().getFullYear()} ${esc(S.brand)}. Mọi quyền được bảo lưu.</span><span>Sản phẩm không phải là thuốc, không thay thế thuốc chữa bệnh.</span></div>
        </footer>
      </div>
      <nav class="tabbar" aria-label="Điều hướng nhanh">${TABS.map((id, i) => { const n = NAV.find(x => x.id === id); return `<a href="${n.href}" style="--i:${i}" class="${id === cur ? 'active' : ''}">${icon(n.icon)}<span>${n.label.replace(' trầm', '')}</span></a>`; }).join('')}</nav>`;
    page.parentNode.insertBefore(app, page);
    $('.content', app).appendChild(page);
    // giỏ hàng dạng ngăn kéo
    document.body.insertAdjacentHTML('beforeend', `
      <div class="drawer-back" data-cart-close></div>
      <aside class="drawer" aria-label="Giỏ hàng" aria-hidden="true">
        <div class="drawer-head"><h3>Giỏ hàng</h3><button class="icon-btn" type="button" aria-label="Đóng" data-cart-close>${icon('close')}</button></div>
        <div class="drawer-body" id="drawerBody"></div>
        <div class="drawer-foot" id="drawerFoot"></div>
      </aside>
      <div class="toasts" aria-live="polite"></div>
      ${cur === 'admin' ? '' : `<div class="contact-dock" aria-label="Liên hệ nhanh">
        <a class="cd-btn cd-zalo" href="${esc((S.social || {}).zalo || 'https://zalo.me/' + String(S.zalo || '').replace(/\D/g, ''))}" target="_blank" rel="noopener" aria-label="Chat Zalo"><span class="cd-ico notranslate" translate="no">Zalo</span><span class="cd-tip">Chat Zalo</span></a>
        <a class="cd-btn cd-mess" href="${S.messenger ? esc(S.messLink()) : 'lien-he.html'}"${S.messenger ? ' target="_blank" rel="noopener"' : ''} aria-label="Nhắn tin Messenger"><span class="cd-ico">${icon('messenger')}</span><span class="cd-tip">Nhắn Messenger</span></a>
        <a class="cd-btn cd-call" href="tel:${esc(String(S.phone || '').replace(/[^\d+]/g, ''))}" aria-label="Gọi ${esc(S.phone || '')}"><span class="cd-ico">${icon('phone')}</span><span class="cd-tip">Gọi ${esc(S.phone || '')}</span></a>
      </div>`}`);
    // các icon thanh bên nhấp nháy đỏ một lúc khi vào trang để khách chú ý; khách lần đầu thấy thêm lời nhắc đăng ký CTV
    const attn = () => { app.classList.remove('nav-attn'); void app.offsetWidth; app.classList.add('nav-attn'); setTimeout(() => app.classList.remove('nav-attn'), 7000); ctvTip(); };
    if (document.documentElement.classList.contains('intro-cover') || document.documentElement.classList.contains('intro-lock')) document.addEventListener('psq:intro-leave', attn, { once: true }); else attn();
    document.addEventListener('click', e => {
      const ub = e.target.closest('[data-user-open]');
      if (ub) { e.stopPropagation(); if (document.querySelector('.user-pop')) return closeUser(); userMenu(ub); return; }
      const ua = e.target.closest('[data-user-act]');
      if (ua) { e.preventDefault(); const a = ua.dataset.userAct; closeUser(); if (a === 'logout') { auth.logout(); toast('Đã đăng xuất'); setTimeout(() => location.href = cur === 'admin' ? 'index.html' : location.href.split('#')[0], 300); } if (a === 'pass') passModal(); if (a === 'install') pwa.install(); return; }
      if (!e.target.closest('.user-pop')) closeUser();
      const lb = e.target.closest('[data-lang-open]');
      if (lb) { e.stopPropagation(); if (document.querySelector('.lang-pop')) return PSQLang.close(); PSQLang.menu(lb); return; }
      const pin = e.target.closest('[data-side-pin]');
      if (pin) { const on = app.classList.toggle('side-pinned'); try { localStorage.setItem('psq_side_pin', on ? '1' : '0'); } catch (er) {} pin.blur(); setTimeout(() => dispatchEvent(new Event('resize')), 400); return; }
      const t = e.target.closest('[data-nav-open],[data-nav-close],[data-cart-open],[data-cart-close],[data-add],[data-qty]');
      if (!t) return;
      if (t.matches('[data-nav-open]')) app.classList.add('nav-open');
      if (t.matches('[data-nav-close]')) app.classList.remove('nav-open');
      if (t.matches('[data-cart-open]')) openCart(true);
      if (t.matches('[data-cart-close]')) openCart(false);
      if (t.matches('[data-add]')) { e.preventDefault(); if (t.disabled || !cart.add(t.dataset.add, +(t.dataset.n || 1))) return; toast('Đã thêm vào giỏ: ' + product(t.dataset.add).name); if (t.dataset.go) location.href = 'dat-hang.html'; }
      if (t.matches('[data-qty]')) { const [id, d] = t.dataset.qty.split('|'); const it = cart.items().find(x => x.id === id); if (it) cart.set(id, d === 'x' ? 0 : it.qty + +d); }
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') { openCart(false); app.classList.remove('nav-open'); closeUser(); } });
    // menu tài khoản ở góc trên
    function closeUser() { document.querySelectorAll('.user-pop').forEach(p => p.remove()); document.querySelectorAll('[data-user-open]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
    function userMenu(btn) {
      const u = auth.user(), pop = document.createElement('div'); pop.className = 'user-pop'; pop.setAttribute('role', 'menu');
      const it = (href, ic, label, act) => `<a role="menuitem" href="${href}"${act ? ` data-user-act="${act}"` : ''}>${icon(ic)}<span>${label}</span></a>`;
      pop.innerHTML = u ? `<div class="up-head"><span class="avatar">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(initials(u.name))}</span><div><b>${esc(u.name)}</b><small>${esc(u.email || '')}</small></div></div>
        ${it('thanh-vien.html#ho-so', 'user', 'Hồ sơ của tôi')}${it('thanh-vien.html#vi', 'wallet', 'Ví của tôi')}${it('#', 'lock', 'Đổi mật khẩu', 'pass')}${u.role === 'admin' ? it('quan-tri.html', 'grid', 'Trang quản trị') : ''}${pwa.can() ? it('#', 'download', 'Cài ứng dụng PSQ', 'install') : ''}<div class="up-sep"></div>${it('#', 'logout', 'Đăng xuất', 'logout')}`
        : `<div class="up-head"><span class="avatar">${icon('user')}</span><div><b>Khách</b><small>Đăng nhập để xem ví, đơn hàng</small></div></div>${it('thanh-vien.html', 'user', 'Đăng nhập')}${it('thanh-vien.html?dang-ky=1', 'plus', 'Đăng ký thành viên')}${pwa.can() ? '<div class="up-sep"></div>' + it('#', 'download', 'Cài ứng dụng PSQ', 'install') : ''}`;
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect(); pop.style.top = (r.bottom + 8) + 'px'; pop.style.left = Math.max(12, Math.min(innerWidth - pop.offsetWidth - 12, r.right - pop.offsetWidth)) + 'px';
      btn.setAttribute('aria-expanded', 'true'); const f = pop.querySelector('a'); f && f.focus();
    }
    function passModal() {
      const m = modal(`<form id="cpF" novalidate><div class="card-head"><div><h3>Đổi mật khẩu</h3><div class="sub">Mật khẩu mới ít nhất 6 ký tự</div></div><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
        <div class="field"><label for="cpO">Mật khẩu hiện tại</label><input class="input" id="cpO" type="password" autocomplete="current-password"></div>
        <div class="field mt-2"><label for="cpN">Mật khẩu mới</label><input class="input" id="cpN" type="password" autocomplete="new-password"></div>
        <div class="field mt-2"><label for="cpR">Nhập lại mật khẩu mới</label><input class="input" id="cpR" type="password" autocomplete="new-password"></div>
        <p class="red mt-1" id="cpE" style="font-size:13px;min-height:18px"></p>
        <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">${icon('check')} Lưu mật khẩu</button></div></form>`);
      const $m = s => m.el.querySelector(s);
      $m('#cpF').addEventListener('submit', e => {
        e.preventDefault(); const n = $m('#cpN').value;
        if (n !== $m('#cpR').value) return $m('#cpE').textContent = 'Hai lần nhập mật khẩu mới chưa giống nhau.';
        const r = auth.changePass($m('#cpO').value, n); if (r.error) return $m('#cpE').textContent = r.error;
        m.close(); toast('Đã đổi mật khẩu');
      });
      setTimeout(() => $m('#cpO').focus(), 60);
    }
    cart.changed();
  }
  function openCart(on) { $('.drawer')?.classList.toggle('open', on); $('.drawer-back')?.classList.toggle('open', on); $('.drawer')?.setAttribute('aria-hidden', String(!on)); }
  function renderDrawer() {
    const body = $('#drawerBody'), foot = $('#drawerFoot'); if (!body) return;
    const it = cart.items();
    body.innerHTML = it.length ? it.map(x => { const p = product(x.id); return `<div class="cart-line"><div class="cart-thumb">${art(p)}</div><div><b>${esc(p.name)}</b><span class="gold">${money(p.price)}</span><br><span class="qty"><button type="button" data-qty="${p.id}|-1" aria-label="Bớt">${icon('minus')}</button><span>${x.qty}</span><button type="button" data-qty="${p.id}|1" aria-label="Thêm">${icon('plus')}</button></span></div><button class="link-btn" type="button" data-qty="${p.id}|x">Xóa</button></div>`; }).join('')
      : `<div class="empty">${icon('cart')}Giỏ hàng đang trống.<div class="mt-2"><a class="btn btn-outline-gold btn-sm" href="san-pham.html">Xem sản phẩm</a></div></div>`;
    foot.innerHTML = it.length ? `<div class="row between"><span class="muted">Tạm tính</span><b class="gold" style="font-size:18px">${money(cart.total())}</b></div><a class="btn btn-gold btn-block" href="dat-hang.html">Đặt hàng ${icon('arrow')}</a>` : '';
  }
  // link mạng xã hội ở chân trang: chỉ hiện các mục đã có link trong Thiết lập
  function footSocial() {
    const so = S.social || {}, L = [['facebook', 'Facebook', so.facebook], ['messenger', 'Messenger', S.messenger ? S.messLink() : ''], ['zalo', 'Zalo', so.zalo || (S.zalo ? 'https://zalo.me/' + String(S.zalo).replace(/\D/g, '') : '')], ['youtube', 'YouTube', so.youtube], ['tiktok', 'TikTok', so.tiktok]].filter(x => x[2]);
    return L.length ? `<div class="foot-social">${L.map(([i, n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${n}" title="${n}">${icon(i)}</a>`).join('')}</div>` : '';
  }
  // nút "Đăng ký CTV" nổi bật trên thanh trên cùng (ẩn khi đã là CTV, đại lý hoặc quản trị)
  const ctvRate = () => ((((API.db || {}).settings || {}).plan || {}).ctvRate) || 10;
  const ctvHref = () => auth.user() ? 'thanh-vien.html#kich-hoat' : 'thanh-vien.html?dang-ky=1';
  function ctvCta() {
    const u = auth.user(); if (u && (u.role === 'admin' || u.tier === 'ctv' || u.tier === 'daily')) return '';
    return `<a class="ctv-cta" href="${ctvHref()}" title="Đăng ký cộng tác viên, nhận hoa hồng ${ctvRate()}%"><span class="ctv-hot">HOT</span><span class="ctv-txt"><b>Đăng ký CTV</b><small>Nhận hoa hồng ${ctvRate()}%</small></span><span class="ctv-short">CTV</span></a>`;
  }
  // khách lần đầu: bong bóng nhắc dưới nút, đóng rồi thì không hiện lại
  function ctvTip() {
    const a = $('.ctv-cta'); if (!a || store.get('psq_ctv_tip', 0)) return;
    const t = document.createElement('div'); t.className = 'ctv-tip'; t.setAttribute('role', 'status');
    t.innerHTML = `<button type="button" class="ctv-x" aria-label="Đóng">${icon('close')}</button><b>${icon('sparkle')} Cơ hội cho anh chị</b><p>Đăng ký cộng tác viên để bán hàng nhận hoa hồng ${ctvRate()}% và lên đại lý hưởng thu nhập không giới hạn.</p><a class="btn btn-gold btn-sm" href="${ctvHref()}">Đăng ký ngay</a>`;
    document.body.appendChild(t);
    const place = () => { const r = a.getBoundingClientRect(); t.style.top = (r.bottom + 12) + 'px'; t.style.left = Math.max(12, Math.min(innerWidth - t.offsetWidth - 12, r.left + r.width / 2 - t.offsetWidth / 2)) + 'px'; t.style.setProperty('--ax', (r.left + r.width / 2 - t.getBoundingClientRect().left) + 'px'); };
    place(); addEventListener('resize', place);
    const close = () => { store.set('psq_ctv_tip', 1); t.classList.add('out'); setTimeout(() => t.remove(), 300); removeEventListener('resize', place); };
    t.addEventListener('click', e => { if (e.target.closest('.ctv-x') || e.target.closest('a')) close(); });
    a.addEventListener('click', close, { once: true });
  }
  function toast(msg, kind) { const box = $('.toasts'); if (!box) return; const t = document.createElement('div'); t.className = 'toast' + (kind === 'err' ? ' toast-err' : ''); t.textContent = msg; if (kind === 'err') t.setAttribute('role', 'alert'); box.appendChild(t); setTimeout(() => t.remove(), kind === 'err' ? 6000 : 2600); }
  function modal(html) {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal card glow-mix" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back); requestAnimationFrame(() => back.classList.add('open'));
    const close = () => { back.classList.remove('open'); setTimeout(() => back.remove(), 300); };
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    return { el: back, close };
  }
  function reveal() {
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
    $$('.reveal').forEach(n => io ? io.observe(n) : n.classList.add('in'));
  }
  // thẻ sản phẩm dùng chung
  function productCard(p) {
    const out = soldOut(p.id);
    return `<article class="card p-card${out ? ' sold-out' : ''}">
      <a class="p-img" href="san-pham-chi-tiet.html?id=${p.id}">${art(p)}${out ? '<span class="badge failed tag">Hết hàng</span>' : p.old ? `<span class="badge gold tag">-${Math.round((1 - p.price / p.old) * 100)}%</span>` : p.hot ? '<span class="badge violet tag">Bán chạy</span>' : ''}</a>
      <div class="p-body"><h3><a href="san-pham-chi-tiet.html?id=${p.id}">${esc(p.name)}</a></h3>
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="p-price">${money(p.price)}</span>${p.old ? `<s class="dim" style="font-size:12px">${money(p.old)}</s>` : ''}</div>
</div>
      <div class="p-actions">${out ? `<button class="btn btn-ghost btn-sm" type="button" disabled>Hết hàng</button>` : `<button class="btn btn-outline-gold btn-sm" type="button" data-add="${p.id}">${icon('cart')} Thêm</button><button class="btn btn-gold btn-sm" type="button" data-add="${p.id}" data-go="1">Mua ngay</button>`}</div>
    </article>`;
  }
  const statusName = { pending: 'Chờ xác nhận', paid: 'Đã thanh toán', ship: 'Đang giao', done: 'Hoàn thành', failed: 'Đã hủy' };
  const statusBadge = s => `<span class="badge ${s === 'done' ? 'ok' : s}">${statusName[s] || s}</span>`;


  /* ---------- cài web như ứng dụng (PWA) ---------- */
  const pwa = (() => {
    let ev = null;
    const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; document.documentElement.classList.add('can-install'); });
    addEventListener('appinstalled', () => { ev = null; document.documentElement.classList.remove('can-install'); toast('Đã cài ứng dụng Phúc Sinh QuanTum'); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    return {
      can: () => !standalone(),
      async install() {
        if (ev) { ev.prompt(); const r = await ev.userChoice.catch(() => null); ev = null; if (r && r.outcome === 'accepted') toast('Đang cài ứng dụng...'); return; }
        modal(`<div class="card-head"><h3>Cài ứng dụng PSQ</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
          <p class="muted" style="font-size:14px">Cài vào màn hình chính để mở nhanh như ứng dụng, toàn màn hình, không cần vào kho ứng dụng.</p>
          <ol class="pwa-steps">${ios ? '<li>Mở trang này bằng <b>Safari</b>.</li><li>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) ở thanh dưới.</li><li>Chọn <b>Thêm vào MH chính</b> rồi bấm <b>Thêm</b>.</li>'
            : '<li>Mở trang này bằng <b>Chrome</b> (Android, máy tính) hoặc <b>Edge</b>.</li><li>Bấm nút menu <b>⋮</b> ở góc trên.</li><li>Chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.</li>'}</ol>
          <div class="row mt-2" style="justify-content:flex-end"><button class="btn btn-gold" type="button" data-close>Đã hiểu</button></div>`);
      }
    };
  })();

  window.PSQ = { pwa, qr, payWait, stockOf, soldOut, videos, dealers, products, $, $$, esc, money, short, initials, qs, fdate, today, icon, store, db, auth, cart, product, placeOrder, art, spark, area, donut, toast, modal, productCard, statusBadge, statusName, reveal, openCart };

  // mọi ô mật khẩu trên web có nút mắt để xem lại mật khẩu vừa gõ (kể cả ô vẽ sau)
  function pwEyes(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('input[type=password]:not([data-eye])').forEach(inp => {
      inp.dataset.eye = '1';
      const w = document.createElement('span'); w.className = 'pw-eye-wrap';
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye'; b.tabIndex = -1;
      const set = show => { inp.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eyeOff' : 'eye'); b.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); b.setAttribute('aria-pressed', show); };
      b.addEventListener('click', () => { set(inp.type === 'password'); inp.focus(); });
      set(false); w.appendChild(b);
    });
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) pwEyes(n.matches && n.matches('input[type=password]') ? n.parentNode : n); }))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => pwEyes(document));

  shell();
  ambient();
  document.addEventListener('DOMContentLoaded', reveal);
  if (document.readyState !== 'loading') setTimeout(reveal);
})();
