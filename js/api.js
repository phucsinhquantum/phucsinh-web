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
    return r;
  }
  function put(p) {
    API.me = p.me || null; API.db = p.db || API.db; API.at = Date.now(); API.online = true;
    if (p.content) CONTENT.forEach(k => { try { if (k in p.content) rawSet.call(localStorage, k, JSON.stringify(p.content[k])); else rawRemove.call(localStorage, k); } catch (e) {} });
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
    logout() { call('POST', '/api/logout', {}); API.me = null; API.boot(); },
    saveContent(key, value) {
      const r = call('POST', '/api/admin/content', { key, value });
      if (r.error) API.fail('Chưa lưu được nội dung lên máy chủ: ' + r.error);
      return !r.error;
    },
    fail(msg) { if (window.PSQ && PSQ.toast) PSQ.toast(msg, 'err'); else alert(msg); }
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
