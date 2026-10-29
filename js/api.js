/* Kết nối máy chủ dữ liệu. Nạp trước js/data.js trên mọi trang.
   - Lấy dữ liệu theo quyền người đang đăng nhập và nội dung trang (bài viết, sản phẩm, thiết lập...)
     rồi đặt nội dung vào localStorage để data.js đọc như trước.
   - Thao tác của thành viên gửi lên máy chủ (API.act), máy chủ tính và trả về dữ liệu mới.
   - Quản trị lưu: chỉ gửi phần thay đổi (js/patch.js), máy chủ ghép vào bản mới nhất.
   Gọi đồng bộ để mã các trang giữ nguyên cách viết "làm xong rồi vẽ lại". */
(function () {
  const CONTENT = ['psq_about_v1', 'psq_cats_v1', 'psq_dealers_v1', 'psq_perks_v1', 'psq_postcats_v1', 'psq_posts_v1', 'psq_products_v1', 'psq_reviews_v1', 'psq_site_v1', 'psq_terms_v1', 'psq_videos_v1'];
  const OLD = ['psq_db_v1', 'psq_session_v1'];   // dữ liệu chạy thử cũ trên trình duyệt
  const SP = Storage.prototype, rawSet = SP.setItem, rawRemove = SP.removeItem;
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const bases = new WeakMap();
  const OFFLINE = 'Không kết nối được máy chủ, anh chị kiểm tra mạng rồi thử lại.';

  function call(method, url, body) {
    const x = new XMLHttpRequest();
    try {
      x.open(method, url, false);
      x.setRequestHeader('x-psq', '1');
      if (body !== undefined) x.setRequestHeader('content-type', 'application/json');
      x.send(body === undefined ? null : JSON.stringify(body));
    } catch (e) { return { error: OFFLINE, offline: true }; }
    let r; try { r = JSON.parse(x.responseText); } catch (e) { r = { error: x.status ? 'Máy chủ trả lời lỗi (' + x.status + '), anh chị thử lại.' : OFFLINE, offline: !x.status }; }
    if (x.status >= 400 && !r.error) r.error = 'Lỗi ' + x.status;
    // máy chủ không nhận ra quản trị: phiên đã hết hoặc tab khác vừa đăng nhập tài khoản khác
    if (x.status === 403 && url.indexOf('/api/admin/') === 0) r.error = 'Phiên đăng nhập quản trị đã hết, hoặc trình duyệt vừa đăng nhập tài khoản khác ở tab khác. Anh chị tải lại trang, đăng nhập lại tài khoản quản trị rồi lưu lại.';
    return r;
  }
  function put(p) {
    API.me = p.me || null; API.db = p.db || API.db; API.at = Date.now(); API.online = true;
    if (p.mode === 'thu' && !API.test) { API.test = true; testBanner(); }
    if (p.fans) API.fans = p.fans;
    API.imp = p.imp || null; if (API.imp) impBanner();
    if (p.content) CONTENT.forEach(k => { try { if (k in p.content) rawSet.call(localStorage, k, JSON.stringify(p.content[k])); else rawRemove.call(localStorage, k); } catch (e) {} });
  }
  // quản trị đang xem tài khoản thành viên: thanh vàng dưới cùng, bấm Thoát xem để quay lại quản trị
  function impBanner() {
    const add = () => {
      if (document.getElementById('psqImp')) return;
      const b = document.createElement('div'); b.id = 'psqImp'; b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:10001;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px);padding:8px 10px 8px 14px;border-radius:12px;background:#f3c76b;color:#1a1408;font:600 13px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)';
      const t = document.createElement('span'); t.textContent = 'Đang xem tài khoản ' + ((API.me || {}).name || '') + ' (' + ((API.me || {}).code || '') + ') với quyền quản trị, chỉ xem';
      const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Thoát xem';
      x.style.cssText = 'flex:none;border:0;border-radius:9px;padding:7px 12px;background:#1a1408;color:#f3c76b;font:inherit;cursor:pointer';
      x.onclick = () => { const r = API.logout(); location.href = (r && r.back) || 'quan-tri.html'; };
      b.append(t, x); document.body.appendChild(b);
    };
    document.body ? add() : document.addEventListener('DOMContentLoaded', add);
  }
  // bản thử: dải đỏ cố định trên cùng để không nhầm với trang bán hàng thật
  function testBanner() {
    try { if (!/^\[THỬ\]/.test(document.title)) document.title = '[THỬ] ' + document.title; } catch (e) {}
    const add = () => {
      if (document.getElementById('psqTest')) return;
      const b = document.createElement('div'); b.id = 'psqTest'; b.setAttribute('role', 'note');
      b.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:10000;padding:1px 12px;border-radius:0 0 8px 8px;background:#c62828;color:#fff;font:600 11px/1.5 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;white-space:nowrap';
      b.textContent = 'BẢN THỬ · không phải trang thật';
      document.body.appendChild(b);
    };
    document.body ? add() : document.addEventListener('DOMContentLoaded', add);
  }
  const isAdmin = () => !!API.me && API.me.role === 'admin';

  const API = {
    me: null, db: { users: [], orders: [], settings: {} }, at: 0, online: false, error: '',
    isAdmin,
    boot() {
      try { OLD.forEach(k => rawRemove.call(localStorage, k)); } catch (e) {}
      const r = call('GET', '/api/boot');
      if (r.error) { API.error = r.error; API.online = false; return false; }
      put(r); return true;
    },
    // bản sao dữ liệu để trang đọc, sửa (quản trị lưu lại bằng API.save)
    load() {
      if (isAdmin() && Date.now() - API.at > 4000) { const r = call('GET', '/api/admin/db'); if (!r.error) put(r); }
      const d = clone(API.db); bases.set(d, clone(API.db)); return d;
    },
    save(d) {
      if (!isAdmin()) { console.warn('[psq] trang thành viên không lưu trực tiếp, dùng API.act'); return false; }
      const base = bases.get(d) || API.db, patch = window.PSQPatch.diff(base, d);
      if (patch === undefined) return true;
      const r = call('POST', '/api/admin/patch', { patch });
      if (r.error) { API.fail(r.error); return false; }
      put(r); bases.set(d, clone(d)); return true;
    },
    // thao tác gửi lên máy chủ; trả về kết quả hoặc { error }
    act(name, args) {
      const r = call('POST', '/api/act', { name, args: args || {} });
      if (r.db) put(r);
      if (r.error) return { error: r.error };
      return r.result || { ok: true };
    },
    logout() { const r = call('POST', '/api/logout', {}); API.me = null; API.imp = null; API.boot(); return r; },
    saveContent(key, value) {
      const r = call('POST', '/api/admin/content', { key, value });
      if (r.error) API.fail(r.error);
      return !r.error;
    },
    failAt: 0,
    fail(msg) {
      const dup = msg === API.lastFail && Date.now() - API.failAt < 3000;
      API.failAt = Date.now(); API.lastFail = msg;
      if (dup) return;
      if (window.PSQ && PSQ.toast) PSQ.toast(msg, 'err'); else alert(msg);
    }
  };
  window.API = API;

  // nội dung trang quản trị sửa (localStorage) được gửi luôn lên máy chủ
  SP.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === window.localStorage && CONTENT.includes(k) && isAdmin()) { let val = null; try { val = JSON.parse(v); } catch (e) { val = v; } API.saveContent(k, val); }
  };
  SP.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === window.localStorage && CONTENT.includes(k) && isAdmin()) API.saveContent(k, null);
  };

  if (!API.boot()) document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;padding:12px 16px;border-radius:12px;background:#5a1d1d;color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center';
    b.textContent = API.error + ' Đăng nhập, đặt hàng tạm thời chưa dùng được.';
    document.body.appendChild(b);
  });
})();
