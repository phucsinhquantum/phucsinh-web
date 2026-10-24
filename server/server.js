/* Máy chủ dữ liệu Phúc Sinh QuanTum.
   Chạy: node --no-warnings server/server.js (Node 22.13 trở lên). Cấu hình bằng biến môi trường, xem .env.example.
   Đường dẫn:
     GET  /api/boot                 dữ liệu cho trang (theo quyền người đang đăng nhập) + nội dung trang
     POST /api/act {name, args}     thao tác (đăng ký, đăng nhập, đặt hàng, ví...), xem actions.js
     POST /api/logout
     GET  /api/admin/db             toàn bộ dữ liệu (quản trị)
     POST /api/admin/patch {patch}  quản trị lưu thay đổi (ghép theo từng phần tử, xem js/patch.js)
     POST /api/admin/content {key, value}  quản trị lưu nội dung trang (psq_*_v1)
     GET/POST /api/confirm?t=...    trang xác nhận đã nhận tiền mở từ tin Telegram */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { openStore } = require('./store');
const { createEngine, esc, today } = require('./engine');
const { ACTIONS, scopeFor, hashPass, clean } = require('./actions');
const { sendMail } = require('./mail');
const { notify } = require('./notify');
const P = require('../js/patch.js');

const env = process.env;
const PORT = +env.PORT || 8080;
const WEB_ROOT = path.resolve(env.WEB_ROOT || path.join(__dirname, '..'));
const DATA_DIR = path.resolve(env.DATA_DIR || path.join(__dirname, '..', '..', 'psq-data'));
const BASE = (env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : BASE.startsWith('https://');
const CONTENT_KEYS = ['psq_about_v1', 'psq_cats_v1', 'psq_dealers_v1', 'psq_perks_v1', 'psq_postcats_v1', 'psq_posts_v1', 'psq_products_v1', 'psq_reviews_v1', 'psq_site_v1', 'psq_terms_v1', 'psq_videos_v1'];
const PRODUCT_KEYS = ['psq_products_v1', 'psq_site_v1'];

const store = openStore(DATA_DIR);
const content = new Map(CONTENT_KEYS.map(k => [k, store.getJSON(k)]));
let D = store.getJSON('db') || {};
let ACTOR = null;
let E = null;
const buildEngine = () => { E = createEngine({ webRoot: WEB_ROOT, content: k => content.get(k) ?? null, state: () => D, actor: () => ACTOR }); };
buildEngine();
const A = () => E.ADB;

// lần đầu: dữ liệu trống, tài khoản chủ sở hữu theo OWNER_EMAIL (chưa có mật khẩu, đặt qua đường dẫn in ra nhật ký)
if (A().migrate(D)) console.log('Đã tạo dữ liệu trống phiên bản', D.v);
if (env.OWNER_EMAIL && !D.users.some(u => (u.email || '').toLowerCase() === env.OWNER_EMAIL.toLowerCase())) {
  D.users.push({ id: 'u-owner', name: env.OWNER_NAME || 'Chủ sở hữu', email: env.OWNER_EMAIL.toLowerCase(), phone: E.SITE.phone, pass: '', role: 'admin', adminRole: 'owner', created: today(), status: 'active', code: 'PS1000', username: 'admin', placed: true });
  console.log('Đã tạo tài khoản chủ sở hữu', env.OWNER_EMAIL);
}
A().wheel(D);
store.setJSON('db', D);
// đường dẫn đặt mật khẩu lần đầu cho chủ sở hữu chưa có mật khẩu
D.users.filter(u => u.role === 'admin' && !u.pass).forEach(u => {
  const t = store.newToken('reset', u.id, 48);
  console.log(`\n=== Đặt mật khẩu cho ${u.email} (dùng 1 lần, 48 giờ) ===\n${BASE}/thanh-vien.html?dat-lai=${t}\n`);
});

const save = () => store.setJSON('db', D);
const stamp = () => { const t = new Date(Date.now() + 7 * 36e5); return t.toISOString().slice(0, 10) + ' ' + t.toISOString().slice(11, 16); };
function after() { try { A().wheelSync(D); A().releaseHeld(D); } catch (e) { console.error(e); } save(); }

/* ---------- thư và báo tin ---------- */
const mailCfg = () => store.getJSON('secret:mail');
function mail(to, subject, type, html, opt = {}) {
  if (!to) return;
  const m = { id: A().uid('ml'), date: stamp(), to, subject, type, status: mailCfg() ? 'sending' : 'failed', html: opt.secret ? '' : html, secret: !!opt.secret };
  if (opt.resendOf) { const o = D.mails.find(x => x.id === opt.resendOf); if (o) o.resent = stamp(); }
  (D.mails = D.mails || []).unshift(m); if (D.mails.length > 2000) D.mails.length = 2000;
  if (!mailCfg()) { m.error = 'Chưa cấu hình email gửi thư'; return; }
  sendMail(mailCfg(), { to, subject, html }).then(() => { m.status = 'sent'; }, e => { m.status = 'failed'; m.error = e.message; console.error('[thư lỗi]', to, e.message); }).finally(save);
}
function tell(text, confirm) {
  let url = null;
  if (confirm) url = `${BASE}/api/confirm?t=${store.newToken('confirm', confirm.kind + ':' + confirm.ref, 24 * 14)}`;
  notify(env, { text, url, button: confirm && confirm.button, kind: confirm && confirm.kind }).catch(e => console.error('[báo tin]', e.message));
}

/* ---------- http ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const cookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function send(res, code, body, headers = {}) {
  const json = typeof body !== 'string';
  const buf = Buffer.from(json ? JSON.stringify(body) : body);
  res.writeHead(code, Object.assign({ 'content-type': json ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, headers));
  res.end(buf);
}
function readBody(req, limit) {
  return new Promise((ok, fail) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { fail(Object.assign(new Error('Dữ liệu gửi lên quá lớn.'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}
const sidCookie = (t, maxAge) => `psq_sid=${t || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
const meOf = req => { const id = store.session(cookies(req).psq_sid); const u = id && A().user(D, id); return u && u.status !== 'locked' ? u : null; };
const isAdmin = u => !!u && u.role === 'admin' && u.status !== 'locked';
const can = (u, perm) => { if (!isAdmin(u)) return false; if (A().isOwner(u)) return true; const r = (D.roles || []).find(x => x.id === (u.adminRole || 'owner')); return !!r && (r.perms.includes('*') || r.perms.includes(perm)); };

// chống dò mật khẩu: tối đa 10 lần sai mỗi 15 phút theo IP
const fails = new Map();
const limited = ip => { const f = fails.get(ip); return f && f.n >= 10 && Date.now() - f.at < 15 * 6e4; };
const failed = ip => { const f = fails.get(ip); if (!f || Date.now() - f.at > 15 * 6e4) fails.set(ip, { n: 1, at: Date.now() }); else f.n++; };

function bootPayload(me) {
  const c = {}; content.forEach((v, k) => { if (v != null) c[k] = v; });
  return { me: me ? clean(me) : null, db: scopeFor(D, me, A()), content: c, at: Date.now() };
}

async function api(req, res, url) {
  const me = meOf(req), route = url.pathname;
  if (req.method === 'GET' && route === '/api/boot') return send(res, 200, bootPayload(me));
  if (route === '/api/confirm') return confirmPage(req, res, url);
  if (req.method !== 'POST') return send(res, 405, { error: 'Sai phương thức.' });
  // chống gửi giả từ trang khác: trình duyệt chỉ gửi được tiêu đề này khi cùng tên miền
  if (req.headers['x-psq'] !== '1') return send(res, 403, { error: 'Yêu cầu không hợp lệ.' });
  const raw = await readBody(req, route.startsWith('/api/admin') ? 25e6 : 2e6);
  let body; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(res, 400, { error: 'Dữ liệu không đọc được.' }); }

  if (route === '/api/logout') { store.endSession(cookies(req).psq_sid); return send(res, 200, { ok: true }, { 'set-cookie': sidCookie('', 0) }); }

  if (route === '/api/act') {
    const def = ACTIONS[body.name]; if (!def) return send(res, 404, { error: 'Thao tác không có.' });
    if (def.auth === 'member' && !me) return send(res, 401, { error: 'Anh chị đăng nhập lại giúp em.' });
    if (def.auth === 'admin' && !(isAdmin(me) && (!def.perm || can(me, def.perm)))) return send(res, 403, { error: 'Tài khoản không có quyền làm việc này.' });
    if (def.auth === 'owner' && !A().isOwner(me)) return send(res, 403, { error: 'Chỉ chủ sở hữu làm được việc này.' });
    const ip = ipOf(req), guarded = ['login', 'resetPass', 'forgot', 'register'].includes(body.name);
    if (guarded && limited(ip)) return send(res, 429, { error: 'Anh chị thử lại sau 15 phút.' });
    ACTOR = me; const sid = cookies(req).psq_sid;
    const ctx = {
      d: D, me, args: body.args || {}, A: A(), site: E.SITE, products: E.PRODUCTS, store, base: BASE, sid, today, stamp, e: esc,
      log: (action, detail, actor) => { const u = actor || me; (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: u ? u.name : 'Khách', action, detail: detail || '' }); if (D.logs.length > 5000) D.logs.length = 5000; },
      mail, mailReady: () => !!mailCfg(), notify: (text, confirm) => tell(text, confirm),
      sendNow: (to, subject, type, html) => sendMail(mailCfg(), { to, subject, html }).then(() => { (D.mails = D.mails || []).unshift({ id: A().uid('ml'), date: stamp(), to, subject, type, status: 'sent', html }); save(); })
    };
    let r;
    try { r = def.async ? await def.run(ctx) : def.run(ctx); }
    catch (e) { console.error('[lỗi thao tác]', body.name, e); ACTOR = null; D = store.getJSON('db'); return send(res, 500, { error: 'Máy chủ gặp lỗi, anh chị thử lại giúp em.' }); }
    ACTOR = null;
    if (r && r.error) { if (guarded) failed(ip); return send(res, 200, { error: r.error }); }
    after();
    const headers = {};
    let who = me;
    if (r && r.login) { headers['set-cookie'] = sidCookie(store.newSession(r.login, req.headers['user-agent'], ip), 30 * 86400); who = A().user(D, r.login); delete r.login; }
    return send(res, 200, Object.assign({ result: r || { ok: true } }, bootPayload(who)), headers);
  }

  if (route.startsWith('/api/admin/')) {
    if (!isAdmin(me)) return send(res, 403, { error: 'Anh chị đăng nhập tài khoản quản trị.' });
    if (route === '/api/admin/patch') {
      const patch = body.patch; if (!patch) return send(res, 200, bootPayload(me));
      stripPass(patch);
      ACTOR = me;
      try { D = P.apply(D, patch); A().migrate(D); after(); }
      catch (e) { console.error('[lỗi lưu quản trị]', e); D = store.getJSON('db'); ACTOR = null; return send(res, 500, { error: 'Không lưu được, anh chị tải lại trang.' }); }
      ACTOR = null;
      store.history(me.email, 'patch', JSON.stringify(patch).slice(0, 2000));
      return send(res, 200, bootPayload(me));
    }
    if (route === '/api/admin/content') {
      if (!CONTENT_KEYS.includes(body.key)) return send(res, 400, { error: 'Mục nội dung không có.' });
      content.set(body.key, body.value ?? null); store.setJSON(body.key, body.value ?? null);
      store.history(me.email, 'content', body.key);
      if (PRODUCT_KEYS.includes(body.key)) buildEngine();
      return send(res, 200, { ok: true });
    }
    if (route === '/api/admin/db') return send(res, 200, bootPayload(me));
  }
  return send(res, 404, { error: 'Không có đường dẫn này.' });
}
// quản trị không sửa được mật khẩu qua đường lưu chung
function stripPass(p) {
  const users = p && p.$o && p.$o.users; if (!users) return;
  if (users.$v) { const old = new Map(D.users.map(u => [u.id, u.pass])); users.$v.forEach(u => { u.pass = old.get(u.id) || ''; }); return; }
  if (users.$a) {
    Object.values(users.set || {}).forEach(s => { if (s.$o) delete s.$o.pass; if (s.$v) delete s.$v.pass; });
    (users.add || []).forEach(x => { x.item.pass = ''; });
  }
}

/* ---------- xác nhận đã nhận tiền (mở từ tin Telegram) ---------- */
async function confirmPage(req, res, url) {
  let t = url.searchParams.get('t');
  if (req.method === 'POST') { const raw = await readBody(req, 4096); t = new URLSearchParams(raw).get('t'); }
  const ref = store.token('confirm', t), [kind, id] = String(ref || '').split(':');
  const page = (title, body) => send(res, 200, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;background:#0e1417;color:#eee;margin:0;padding:24px 16px}main{max-width:460px;margin:auto;background:#151d21;border:1px solid #3a3122;border-radius:16px;padding:22px}h1{font-size:20px;color:#f3c76b;margin:0 0 12px}dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0 0 18px}dt{color:#9aa7ab}dd{margin:0}button{width:100%;padding:14px;border:0;border-radius:12px;background:#f3c76b;color:#1a1408;font-size:16px;font-weight:700}p{color:#c9d1d3}</style></head><body><main>${body}</main></body></html>`);
  const o = kind === 'order' && D.orders.find(x => x.id === id), tp = kind === 'topup' && (D.topups || []).find(x => x.id === id);
  if (!o && !tp) return page('Đường dẫn hết hạn', '<h1>Đường dẫn đã hết hạn hoặc đã dùng</h1><p>Anh vào Quản trị để xem và xác nhận.</p>');
  const money = n => (Math.round(n) || 0).toLocaleString('vi-VN') + 'đ';
  const owner = D.users.find(u => A().isOwner(u)) || null;
  if (o) {
    const due = Math.max(0, o.total - (o.shopPaid || 0) - (o.cashPaid || 0));
    if (o.status !== 'pending') { store.useToken(t); return page('Đơn đã xử lý', `<h1>Đơn ${esc(o.id)} đã được xử lý</h1><p>Trạng thái hiện tại: ${esc(o.status)}.</p>`); }
    if (req.method === 'POST') {
      ACTOR = owner; const r = A().setStatus(D, o, 'paid');
      if (!r.error) (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: (owner || {}).name || 'Chủ sở hữu', action: 'Cập nhật đơn hàng', detail: `${o.id}: Xác nhận đã nhận ${money(due)} (từ tin Telegram)` });
      ACTOR = null; store.useToken(t); after();
      return page('Đã xác nhận', r.error ? `<h1>Chưa xác nhận được</h1><p>${esc(r.error)}</p>` : `<h1>✅ Đã xác nhận đơn ${esc(o.id)}</h1><p>Đơn chuyển sang ${o.status === 'done' ? 'Hoàn thành' : 'Đã thanh toán'}.</p>`);
    }
    return page('Xác nhận đơn ' + o.id, `<h1>Xác nhận đã nhận tiền</h1><dl><dt>Đơn</dt><dd><b>${esc(o.id)}</b></dd><dt>Khách</dt><dd>${esc(o.name)} · ${esc(o.phone || '')}</dd><dt>Sản phẩm</dt><dd>${o.items.map(x => esc(x.qty + ' x ' + x.name)).join('<br>')}</dd><dt>Số tiền</dt><dd><b>${money(due)}</b></dd><dt>Nội dung CK</dt><dd>${esc(o.id)}</dd></dl>
      <form method="post"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">✅ Đã nhận ${money(due)}</button></form><p style="font-size:13px">Chỉ bấm khi tiền đã vào tài khoản.</p>`);
  }
  const u = A().user(D, tp.user) || {};
  if (tp.status !== 'pending') { store.useToken(t); return page('Đã xử lý', `<h1>Yêu cầu nạp tiền đã được xử lý</h1>`); }
  if (req.method === 'POST') {
    ACTOR = owner; tp.status = 'done'; const tw = tp.wallet || 'cash';
    A().credit(D, tp.user, tw, 'topup', tp.amount, 'Nạp tiền qua ' + (tp.method || ''), tp.id);
    (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: (owner || {}).name || 'Chủ sở hữu', action: 'Duyệt nạp tiền', detail: `${u.name}: ${money(tp.amount)} (từ tin Telegram)` });
    ACTOR = null; store.useToken(t); after();
    return page('Đã xác nhận', `<h1>✅ Đã cộng ${money(tp.amount)} vào ví của ${esc(u.name || '')}</h1>`);
  }
  return page('Xác nhận nạp tiền', `<h1>Xác nhận nạp tiền vào ví</h1><dl><dt>Thành viên</dt><dd>${esc(u.name || '')} (@${esc(u.username || '')})</dd><dt>Số tiền</dt><dd><b>${money(tp.amount)}</b></dd><dt>Hình thức</dt><dd>${esc(tp.method)}</dd><dt>Nội dung CK</dt><dd>${esc(tp.code || '')}</dd></dl>
    <form method="post"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">✅ Đã nhận ${money(tp.amount)}</button></form><p style="font-size:13px">Chỉ bấm khi tiền đã vào tài khoản.</p>`);
}

/* ---------- tệp tĩnh (khi chạy riêng, không qua Caddy) ---------- */
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(WEB_ROOT, p));
  if (!f.startsWith(WEB_ROOT + path.sep) || /[\\/](server|\.git|notes)([\\/]|$)|\.md$/i.test(f.slice(WEB_ROOT.length))) return send(res, 404, 'Không tìm thấy');
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) return send(res, 404, 'Không tìm thấy');
    const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', gz = /text|javascript|json|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, { 'content-type': type, 'cache-control': /\.html$/.test(f) ? 'no-cache' : 'public, max-age=3600', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
    const s = fs.createReadStream(f); (gz ? s.pipe(zlib.createGzip()) : s).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return api(req, res, url).catch(e => { console.error(e); if (!res.headersSent) send(res, e.code === 413 ? 413 : 500, { error: e.code === 413 ? e.message : 'Máy chủ gặp lỗi.' }); });
  if (env.SERVE_STATIC === '0') return send(res, 404, 'Không tìm thấy');
  serveStatic(req, res, url);
});
server.listen(PORT, () => console.log(`Máy chủ PSQ chạy cổng ${PORT}, dữ liệu ${DATA_DIR}, web ${WEB_ROOT}, địa chỉ ${BASE}`));

// sao lưu mỗi ngày, dọn phiên hết hạn, nhả hoa hồng đang giữ
const daily = () => { try { const f = store.backup(); if (f) console.log('Đã sao lưu', f); store.cleanup(); A().releaseHeld(D) && save(); } catch (e) { console.error('[sao lưu lỗi]', e); } };
daily(); setInterval(daily, 36e5);
process.on('SIGTERM', () => { save(); process.exit(0); });
