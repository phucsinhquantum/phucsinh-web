/* Chạy chung bộ tính toán của web (js/data.js + js/psq-data.js) trên máy chủ,
   để hoa hồng, ví, đơn hàng tính đúng một chỗ và khách không tự sửa được. */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Math.round(n) || 0).toLocaleString('vi-VN') + 'đ';
const today = () => new Date().toISOString().slice(0, 10);

// ctx: { webRoot, content(key) -> giá trị nội dung đã lưu, state() -> dữ liệu, actor() -> người đang thao tác }
function createEngine(ctx) {
  const ls = {
    getItem: k => { const v = ctx.content(k); return v == null ? null : JSON.stringify(v); },
    setItem() {}, removeItem() {}
  };
  const noop = () => {};
  const doc = { createElement: () => ({ click: noop }), addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] };
  const sb = {
    console, Date, Math, JSON, Intl, Object, Array, String, Number, Boolean, RegExp, Set, Map, Promise, Error,
    setTimeout, clearTimeout, URLSearchParams, localStorage: ls, document: doc, navigator: {},
    location: { search: '', origin: '', pathname: '', hash: '' }, addEventListener: noop
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  const run = f => vm.runInContext(fs.readFileSync(path.join(ctx.webRoot, f), 'utf8'), sb, { filename: f });
  run('js/data.js');
  // sản phẩm do quản trị sửa (giống js/app.js)
  const ed = ctx.content('psq_products_v1');
  if (ed && Array.isArray(sb.PRODUCTS)) {
    (ed.edits || []).forEach(e => { const p = sb.PRODUCTS.find(x => x.id === e.id); if (p) Object.assign(p, e); else sb.PRODUCTS.push(e); });
    if (ed.hidden) for (let i = sb.PRODUCTS.length - 1; i >= 0; i--) if (ed.hidden.includes(sb.PRODUCTS[i].id)) sb.PRODUCTS.splice(i, 1);
  }
  sb.PSQ = {
    db: { load: () => ctx.state(), save: noop, reset: () => ctx.state() },
    auth: { user: () => ctx.actor() },
    today, money, esc
  };
  run('js/psq-data.js');
  return { ADB: sb.ADB, SITE: sb.SITE, PRODUCTS: sb.PRODUCTS, PERKS: sb.PERKS, sandbox: sb };
}

module.exports = { createEngine, money, esc, today };
