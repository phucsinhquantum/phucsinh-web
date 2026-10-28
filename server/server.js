/* Máy chủ dữ liệu Phúc Sinh QuanTum.
   Chạy: node --no-warnings server/server.js (Node 22.13 trở lên). Cấu hình bằng biến môi trường, xem .env.example.
   Đường dẫn:
     GET  /api/boot                 dữ liệu cho trang (theo quyền người đang đăng nhập) + nội dung trang
     POST /api/act {name, args}     thao tác (đăng ký, đăng nhập, đặt hàng, ví...), xem actions.js
     POST /api/logout
     GET  /api/admin/db             toàn bộ dữ liệu (quản trị)
     POST /api/admin/patch {patch}  quản trị lưu thay đổi (ghép theo từng phần tử, xem js/patch.js)
     POST /api/admin/content {key, value}  quản trị lưu nội dung trang (psq_*_v1)
     GET/POST /api/confirm?t=...    trang xác nhận đã nhận tiền mở từ tin Telegram
     GET  /api/bill?f=...[&t=...]   ảnh bill chuyển khoản (quản trị, hoặc kèm mã xác nhận của đơn đó)
     GET/POST /api/ship?t=...       trang Đã ship / Chưa ship mở từ tin nhắc giao hàng */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { openStore } = require('./store');
const { createEngine, esc, today } = require('./engine');
const { ACTIONS, scopeFor, hashPass, clean, botLookup, botProducts, botKeyOf } = require('./actions');
const { sendMail } = require('./mail');
const N = require('./notify'), { chatName, chatsOf } = N;
const P = require('../js/patch.js');

const env = process.env;
const PORT = +env.PORT || 8080;
const WEB_ROOT = path.resolve(env.WEB_ROOT || path.join(__dirname, '..'));
const DATA_DIR = path.resolve(env.DATA_DIR || path.join(__dirname, '..', '..', 'psq-data'));
const BASE = (env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : BASE.startsWith('https://');
const CONTENT_KEYS = ['psq_about_v1', 'psq_cats_v1', 'psq_dealers_v1', 'psq_perks_v1', 'psq_postcats_v1', 'psq_posts_v1', 'psq_products_v1', 'psq_reviews_v1', 'psq_site_v1', 'psq_terms_v1', 'psq_videos_v1'];
const PRODUCT_KEYS = ['psq_products_v1', 'psq_site_v1'];
// bản thử (thu.phucsinhquantum.com hoặc SITE_MODE=thu): tin Telegram có nhãn [THỬ], không gửi thư cho khách
// (chỉ gửi về TEST_MAIL_TO nếu có), trang hiện dải BẢN THỬ. Tránh nhầm đơn, thư thử với hệ thống thật.
const TEST = env.SITE_MODE ? env.SITE_MODE === 'thu' : /^https?:\/\/thu\./i.test(env.BASE_URL || '');
const tag = t => TEST ? '[THỬ] ' + t : t;
const notify = (e, o) => N.notify(e, Object.assign({}, o, { text: tag(o.text || '') }));
const sendTo = (e, chat, o) => N.sendTo(e, chat, Object.assign({}, o, { text: tag(o.text || '') }));

const store = openStore(DATA_DIR);
const content = new Map(CONTENT_KEYS.map(k => [k, store.getJSON(k)]));
// 24/10: nút Zalo và Messenger nổi dẫn vào bot An An (anh Tuân chốt), chạy một lần
if (!store.getJSON('mig:anan')) {
  const v = content.get('psq_site_v1');
  if (v && typeof v === 'object') {
    if (!v.zalo || String(v.zalo).replace(/\D/g, '') === '0931133199') v.zalo = '0839153514';
    if (!v.messenger) v.messenger = 'phucsinhquantum';
    content.set('psq_site_v1', v); store.setJSON('psq_site_v1', v);
  }
  store.setJSON('mig:anan', 1);
}
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
if (A().placeAll(D)) console.log('Đã xếp thành viên chờ lên cây vào dưới người giới thiệu');
// gắn đơn khách lẻ vào tài khoản trùng SĐT; lên đại lý trước rồi mới tính hoa hồng các đơn gắn lại, để người giới thiệu đã đủ mốc được hưởng đúng mức đại lý
if (A().linkGuests(D)) { console.log('Đã ghi đơn khách lẻ vào tài khoản trùng số điện thoại'); A().agentSync(D); }
{ const n = A().settleSync(D); if (n) console.log('Đã ghi nhận hoa hồng cho', n, 'đơn đã thanh toán'); }
if (A().agentSync(D)) console.log('Đã cập nhật thành viên đủ mốc lên đại lý');
store.setJSON('db', D);
// đường dẫn đặt mật khẩu lần đầu cho chủ sở hữu chưa có mật khẩu
D.users.filter(u => u.role === 'admin' && !u.pass).forEach(u => {
  const t = store.newToken('reset', u.id, 48);
  console.log(`\n=== Đặt mật khẩu cho ${u.email} (dùng 1 lần, 48 giờ) ===\n${BASE}/thanh-vien.html?dat-lai=${t}\n`);
});

const save = () => store.setJSON('db', D);
const stamp = () => { const t = new Date(Date.now() + 7 * 36e5); return t.toISOString().slice(0, 10) + ' ' + t.toISOString().slice(11, 16); };
function after() { try { A().placeAll(D); if (A().linkGuests(D)) A().agentSync(D); A().wheelSync(D); A().releaseHeld(D); A().settleSync(D); A().agentSync(D); } catch (e) { console.error(e); } save(); }

/* ---------- thư và báo tin ---------- */
const mailCfg = () => TEST && !env.TEST_MAIL_TO ? null : store.getJSON('secret:mail');
// bản thử: mọi thư chuyển về TEST_MAIL_TO, tiêu đề ghi người nhận gốc
const mailTo = (to, subject) => TEST ? { to: env.TEST_MAIL_TO, subject: `[THỬ, gửi ${to}] ${subject}` } : { to, subject };
function mail(to, subject, type, html, opt = {}) {
  if (!to) return;
  const m = { id: A().uid('ml'), date: stamp(), to, subject, type, status: mailCfg() ? 'sending' : 'failed', html: opt.secret ? '' : html, secret: !!opt.secret };
  if (opt.resendOf) { const o = D.mails.find(x => x.id === opt.resendOf); if (o) o.resent = stamp(); }
  (D.mails = D.mails || []).unshift(m); if (D.mails.length > 2000) D.mails.length = 2000;
  if (!mailCfg()) { m.error = TEST ? 'Bản thử không gửi thư cho khách' : 'Chưa cấu hình email gửi thư'; return; }
  sendMail(mailCfg(), Object.assign(mailTo(to, subject), { html })).then(() => { m.status = 'sent'; }, e => { m.status = 'failed'; m.error = e.message; console.error('[thư lỗi]', to, e.message); }).finally(save);
}
function tell(text, confirm, photo) {
  let url = null;
  if (confirm) url = `${BASE}/api/confirm?t=${store.newToken('confirm', confirm.kind + ':' + confirm.ref, 24 * 14)}`;
  notify(env, { text, url, button: confirm && confirm.button, kind: confirm && confirm.kind, photo }).catch(e => console.error('[báo tin]', e.message));
}

/* ---------- ảnh bill chuyển khoản: lưu trong thư mục dữ liệu, không nằm trong thư mục web ---------- */
const BILL_DIR = path.join(DATA_DIR, 'bills');
const BILL_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const BILL_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function saveBill(ref, buf, type) {
  fs.mkdirSync(BILL_DIR, { recursive: true });
  const f = `${String(ref).replace(/[^\w-]/g, '')}-${Date.now().toString(36)}${require('crypto').randomBytes(4).toString('hex')}.${BILL_TYPES[type]}`;
  fs.writeFileSync(path.join(BILL_DIR, f), buf);
  return f;
}
function serveBill(req, res, url, me) {
  const f = url.searchParams.get('f') || '', m = /^([\w-]+)-[a-z0-9]+\.(jpg|png|webp)$/.exec(f);
  if (!m) return send(res, 404, { error: 'Không có ảnh.' });
  const has = o => !!o && (o.bills || []).some(b => b.f === f);
  let ok = isAdmin(me) && (D.orders.some(has) || (D.topups || []).some(has));
  if (!ok) { const [kind, id] = String(store.token('confirm', url.searchParams.get('t')) || '').split(':'); ok = has(kind === 'order' ? D.orders.find(x => x.id === id) : (D.topups || []).find(x => x.id === id)); }
  if (!ok) return send(res, 403, { error: 'Không xem được ảnh này.' });
  fs.readFile(path.join(BILL_DIR, f), (e, buf) => {
    if (e) return send(res, 404, { error: 'Không có ảnh.' });
    res.writeHead(200, { 'content-type': BILL_MIME[m[2]], 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' }); res.end(buf);
  });
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
const sidCookie = (t, maxAge, name = 'psq_sid') => `${name}=${t || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
const meOf = req => { const id = store.session(cookies(req).psq_sid); const u = id && A().user(D, id); return u && u.status !== 'locked' ? u : null; };
// quản trị đang xem tài khoản thành viên: phiên thành viên tạo riêng, ghi mã quản trị; phiên quản trị gốc giữ ở cookie psq_asid
const IMP_HOURS = 2;
const impOf = req => { const i = store.sessionInfo(cookies(req).psq_sid); if (!i || !/^imp:/.test(i.ua)) return null; const a = A().user(D, i.ua.slice(4)); return isAdmin(a) ? a : null; };
// đang xem thay thì chỉ được xem: các thao tác này đọc dữ liệu, không đổi gì
const IMP_READ = ['payStatus', 'checkRef', 'checkUsername', 'lookupUser', 'trackOrder'];
const isAdmin = u => !!u && u.role === 'admin' && u.status !== 'locked';
const can = (u, perm) => { if (!isAdmin(u)) return false; if (A().isOwner(u)) return true; const r = (D.roles || []).find(x => x.id === (u.adminRole || 'owner')); return !!r && (r.perms.includes('*') || r.perms.includes(perm)); };

// chống dò mật khẩu: tối đa 10 lần sai mỗi 15 phút theo IP
const fails = new Map();
const limited = ip => { const f = fails.get(ip); return f && f.n >= 10 && Date.now() - f.at < 15 * 6e4; };
const failed = ip => { const f = fails.get(ip); if (!f || Date.now() - f.at > 15 * 6e4) fails.set(ip, { n: 1, at: Date.now() }); else f.n++; };

function bootPayload(me, imp) {
  const c = {}; content.forEach((v, k) => { if (v != null) c[k] = v; });
  return { me: me ? clean(me) : null, db: scopeFor(D, me, A()), content: c, at: Date.now(), ...(TEST ? { mode: 'thu' } : {}), ...(imp ? { imp: { name: imp.name } } : {}) };
}

// bối cảnh chạy một thao tác (actions.js)
function ctxFor(me, args, sid) {
  return {
    d: D, me, args, A: A(), site: E.SITE, products: E.PRODUCTS, store, base: BASE, sid, today, stamp, e: esc,
    log: (action, detail, actor) => { const u = actor || me; (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: u ? u.name : 'Khách', action, detail: detail || '' }); if (D.logs.length > 5000) D.logs.length = 5000; },
    mail, mailReady: () => !!mailCfg(), notify: (text, confirm, photo) => tell(text, confirm, photo), saveBill, BILL_TYPES, notifyNow: text => notify(env, { text }), remindShip, notifyReady: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    sendNow: (to, subject, type, html) => sendMail(mailCfg(), Object.assign(mailTo(to, subject), { html })).then(() => { (D.mails = D.mails || []).unshift({ id: A().uid('ml'), date: stamp(), to, subject, type, status: 'sent', html }); save(); })
  };
}

async function api(req, res, url) {
  const me = meOf(req), route = url.pathname, imp = me && impOf(req);
  if (req.method === 'GET' && route === '/api/boot') return send(res, 200, bootPayload(me, imp));
  if (route === '/api/confirm') return confirmPage(req, res, url);
  if (req.method === 'GET' && route === '/api/verify') return verifyPage(req, res, url);
  if (route === '/api/ship') return shipPage(req, res, url);
  if (req.method === 'GET' && route === '/api/bill') return serveBill(req, res, url, me);
  if (req.method === 'GET' && route === '/api/admin/db') return isAdmin(me) ? send(res, 200, bootPayload(me)) : send(res, 403, { error: 'Anh chị đăng nhập tài khoản quản trị.' });
  if (route === '/api/bot/lookup' || route === '/api/bot/products') return botApi(req, res, url, route.endsWith('products'));
  if (req.method !== 'POST') return send(res, 405, { error: 'Sai phương thức.' });
  // chống gửi giả từ trang khác: trình duyệt chỉ gửi được tiêu đề này khi cùng tên miền
  if (req.headers['x-psq'] !== '1') return send(res, 403, { error: 'Yêu cầu không hợp lệ.' });
  const raw = await readBody(req, route.startsWith('/api/admin') ? 25e6 : 3e6);
  let body; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(res, 400, { error: 'Dữ liệu không đọc được.' }); }

  if (route === '/api/logout') {
    const ck = cookies(req); store.endSession(ck.psq_sid);
    // thoát chế độ xem thay: trả lại phiên quản trị gốc
    if (imp && store.session(ck.psq_asid) === imp.id) {
      (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: imp.name, action: 'Thôi xem tài khoản', detail: `${me.name} (@${me.username || ''})` }); save();
      return send(res, 200, { ok: true, back: 'quan-tri.html#members' }, { 'set-cookie': [sidCookie(ck.psq_asid, 30 * 86400), sidCookie('', 0, 'psq_asid')] });
    }
    return send(res, 200, { ok: true }, { 'set-cookie': sidCookie('', 0) });
  }
  // quản trị xem tài khoản thành viên (để kiểm tra ví, điểm, đơn): chỉ xem, tối đa 2 giờ, ghi nhật ký
  if (route === '/api/admin/impersonate') {
    if (!(isAdmin(me) && can(me, 'members'))) return send(res, 403, { error: 'Tài khoản không có quyền xem thành viên.' });
    const u = A().user(D, body.id);
    if (!u || u.role === 'admin') return send(res, 400, { error: 'Chỉ xem được tài khoản thành viên.' });
    const t = store.newSession(u.id, 'imp:' + me.id, ipOf(req), IMP_HOURS / 24);
    (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: me.name, action: 'Xem tài khoản thành viên', detail: `${u.name} (@${u.username || ''}, ${u.code || ''})` }); save();
    store.history(me.email, 'impersonate', u.id);
    return send(res, 200, { ok: true }, { 'set-cookie': [sidCookie(t, IMP_HOURS * 3600), sidCookie(cookies(req).psq_sid, IMP_HOURS * 3600, 'psq_asid')] });
  }

  if (route === '/api/act') {
    const def = ACTIONS[body.name]; if (!def) return send(res, 404, { error: 'Thao tác không có.' });
    if (imp && !IMP_READ.includes(body.name)) return send(res, 200, { error: 'Anh chị đang xem tài khoản này với quyền quản trị (chỉ xem), không thao tác được. Bấm Thoát xem để quay lại.' });
    if (def.auth === 'member' && !me) return send(res, 401, { error: 'Anh chị đăng nhập lại giúp em.' });
    if (def.auth === 'admin' && !(isAdmin(me) && (!def.perm || can(me, def.perm)))) return send(res, 403, { error: 'Tài khoản không có quyền làm việc này.' });
    if (def.auth === 'owner' && !A().isOwner(me)) return send(res, 403, { error: 'Chỉ chủ sở hữu làm được việc này.' });
    const ip = ipOf(req), guarded = ['login', 'resetPass', 'forgot', 'register'].includes(body.name);
    if (guarded && limited(ip)) return send(res, 429, { error: 'Anh chị thử lại sau 15 phút.' });
    ACTOR = me; const sid = cookies(req).psq_sid;
    const ctx = ctxFor(me, body.args || {}, sid);
    let r;
    try { r = def.async ? await def.run(ctx) : def.run(ctx); }
    catch (e) { console.error('[lỗi thao tác]', body.name, e); ACTOR = null; D = store.getJSON('db'); return send(res, 500, { error: 'Máy chủ gặp lỗi, anh chị thử lại giúp em.' }); }
    ACTOR = null;
    if (r && r.error) { if (guarded) failed(ip); return send(res, 200, { error: r.error }); }
    after();
    const headers = {};
    let who = me;
    if (r && r.login) { headers['set-cookie'] = sidCookie(store.newSession(r.login, req.headers['user-agent'], ip), 30 * 86400); who = A().user(D, r.login); delete r.login; }
    return send(res, 200, Object.assign({ result: r || { ok: true } }, bootPayload(who, who === me ? imp : null)), headers);
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
/* ---------- An An (n8n) tra cứu thành viên: GET ?q=&asker= hoặc POST {q, asker}, tiêu đề x-bot-key hoặc Authorization: Bearer ---------- */
async function botApi(req, res, url, prod) {
  const ip = ipOf(req); if (limited(ip)) return send(res, 429, { error: 'Thử lại sau 15 phút.' });
  const key = botKeyOf(store), got = String(req.headers['x-bot-key'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const ok = key && got.length === key.length && require('crypto').timingSafeEqual(Buffer.from(got), Buffer.from(key));
  if (!ok) { failed(ip); return send(res, 401, { error: key ? 'Khóa tra cứu chưa đúng.' : 'Cổng tra cứu đang tắt. Chủ sở hữu tạo khóa trong Quản trị > Thiết lập.' }); }
  let a = Object.fromEntries(url.searchParams);
  if (req.method === 'POST') { try { const raw = await readBody(req, 4096); Object.assign(a, raw ? JSON.parse(raw) : {}); } catch (e) { return send(res, 400, { error: 'Dữ liệu không đọc được.' }); } }
  const r = prod ? botProducts(D, A(), E.PRODUCTS, a.q, BASE) : botLookup(D, A(), content.get('psq_dealers_v1') ?? E.sandbox.DEALERS, a.q, a.asker, BASE);
  return send(res, r.error ? 400 : 200, r, { 'cache-control': 'no-store' });
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

/* ---------- kích hoạt tài khoản từ thư: làm hết trên máy chủ rồi chuyển trang, không cần trình duyệt chạy mã
   (trước đây trang tự gọi kích hoạt bằng mã chạy trên trình duyệt, máy cũ hoặc trình duyệt trong app Gmail, Zalo đứng im) ---------- */
function verifyPage(req, res, url) {
  const r = ACTIONS.verifyEmail.run(ctxFor(null, { token: url.searchParams.get('t') || '' }, null));
  if (r && r.error) return send(res, 200, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Kích hoạt tài khoản</title>
    <style>body{font-family:system-ui,Arial,sans-serif;background:#0e1417;color:#eee;margin:0;padding:24px 16px}main{max-width:460px;margin:auto;background:#151d21;border:1px solid #3a3122;border-radius:16px;padding:22px}h1{font-size:20px;color:#f3c76b;margin:0 0 12px}a{display:block;text-align:center;padding:14px;border-radius:12px;background:#f3c76b;color:#1a1408;font-weight:700;text-decoration:none}p{color:#c9d1d3}</style></head>
    <body><main><h1>Chưa kích hoạt được</h1><p>${esc(r.error)}</p><p>Nếu anh chị đã bấm đường dẫn này trước đó thì tài khoản đã kích hoạt rồi, chỉ cần đăng nhập.</p><a href="/thanh-vien.html">Đăng nhập</a></main></body></html>`);
  after();
  const ip = ipOf(req), sid = store.newSession(r.login, req.headers['user-agent'], ip);
  res.writeHead(302, { location: '/thanh-vien.html?da-kich-hoat=1#tong-quan', 'set-cookie': sidCookie(sid, 30 * 86400), 'cache-control': 'no-store' });
  res.end();
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
  const billImgs = (x, t) => (x.bills || []).length ? `<p style="margin:0 0 8px"><b>Ảnh bill khách gửi</b> (đối chiếu với tài khoản ngân hàng)</p>${x.bills.map(b => `<a href="/api/bill?f=${encodeURIComponent(b.f)}&t=${encodeURIComponent(t)}" target="_blank"><img src="/api/bill?f=${encodeURIComponent(b.f)}&t=${encodeURIComponent(t)}" alt="Bill chuyển khoản" style="display:block;width:100%;border-radius:10px;margin:0 0 10px;border:1px solid #3a3122"></a>`).join('')}` : '<p style="font-size:13px">Khách chưa gửi ảnh bill.</p>';
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
    return page('Xác nhận đơn ' + o.id, `<h1>Xác nhận đã nhận tiền</h1><dl><dt>Đơn</dt><dd><b>${esc(o.id)}</b></dd><dt>Khách</dt><dd>${esc(o.name)} · ${esc(o.phone || '')}</dd><dt>Sản phẩm</dt><dd>${o.items.map(x => esc(x.qty + ' x ' + x.name)).join('<br>')}</dd><dt>Số tiền</dt><dd><b>${money(due)}</b></dd><dt>Nội dung CK</dt><dd>${esc(o.id)}</dd></dl>${billImgs(o, t)}
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
  return page('Xác nhận nạp tiền', `<h1>Xác nhận nạp tiền vào ví</h1><dl><dt>Thành viên</dt><dd>${esc(u.name || '')} (@${esc(u.username || '')})</dd><dt>Số tiền</dt><dd><b>${money(tp.amount)}</b></dd><dt>Hình thức</dt><dd>${esc(tp.method)}</dd><dt>Nội dung CK</dt><dd>${esc(tp.code || '')}</dd></dl>${billImgs(tp, t)}
    <form method="post"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">✅ Đã nhận ${money(tp.amount)}</button></form><p style="font-size:13px">Chỉ bấm khi tiền đã vào tài khoản.</p>`);
}

/* ---------- nhắc giao hàng: đơn Đã thanh toán chưa ship, từ ngày sau ngày đặt, 8h-18h giờ VN, mỗi đơn 1 lần/ngày ----------
   Người nhận: SHIP_CHAT_ID (mặc định TELEGRAM_CHAT_ID). Mỗi người một đường dẫn riêng nên biết ai bấm Đã ship. */
const vnNow = () => new Date(Date.now() + 7 * 36e5);
const vnDay = () => vnNow().toISOString().slice(0, 10);
const shipChats = () => chatsOf(env.SHIP_CHAT_ID || env.TELEGRAM_CHAT_ID);
const toShip = day => D.orders.filter(o => o.status === 'paid' && !A().isPkgOrder(o) && String(o.date || '').slice(0, 10) < day);
function productPhoto(o) {
  for (const x of o.items || []) {
    const p = E.PRODUCTS.find(q => q.id === x.id), img = p && (p.image || (p.images || [])[0]);
    if (!img || /^https?:/.test(img)) continue;
    const f = path.normalize(path.join(WEB_ROOT, img)), ext = path.extname(f).toLowerCase();
    if (!f.startsWith(WEB_ROOT + path.sep) || !BILL_MIME[ext.slice(1).replace('jpeg', 'jpg')]) continue;
    try { return { buf: fs.readFileSync(f), type: BILL_MIME[ext.slice(1).replace('jpeg', 'jpg')] }; } catch (e) {}
  }
  return null;
}
const shipText = (o, n) => `🚚 Nhắc giao hàng${n > 1 ? ` (lần ${n})` : ''}: đơn ${o.id}
Đặt ngày ${String(o.date || '').slice(0, 10).split('-').reverse().join('/')}, đã thanh toán
Khách: ${o.name} · ${o.phone || ''}
Địa chỉ: ${o.address || ''}
${(o.items || []).map(x => `• ${x.qty} x ${x.name}`).join('\n')}
Tổng: ${(Math.round(o.total) || 0).toLocaleString('vi-VN')}đ${o.note ? `\nGhi chú: ${o.note}` : ''}
Đã gửi hàng thì bấm "Đã ship", chưa thì bấm "Chưa ship", mai em nhắc tiếp.`;
async function remindShip(force) {
  const h = vnNow().getUTCHours(), day = vnDay(), chats = shipChats();
  if (!env.TELEGRAM_BOT_TOKEN || !chats.length) return { sent: 0, error: 'Chưa cấu hình Telegram.' };
  if (!force && (h < 8 || h >= 18)) return { sent: 0 };
  const list = toShip(force ? '9999' : day).filter(o => force || o.remindedOn !== day);
  // đánh dấu và lưu trước khi gửi, để lần kiểm tra sau không nhắc trùng dù đang gửi dở
  const jobs = list.map(o => { o.reminds = (o.reminds || 0) + 1; o.remindedOn = day; return { o, photo: productPhoto(o), text: shipText(o, o.reminds) }; });
  if (jobs.length) save();
  let sent = 0; const errors = [];
  for (const { o, photo, text } of jobs) {
    for (const chat of chats) {
      const link = k => `${BASE}/api/ship?t=${store.newToken('ship', `${o.id}:${chat}:${k}`, 72)}`;
      const r = await sendTo(env, chat, { text, photo, buttons: [[{ text: '🚚 Đã ship', url: link('yes') }, { text: '⏳ Chưa ship', url: link('no') }]] });
      if (r.ok) sent++; else errors.push(r.error);
    }
  }
  errors.forEach(e => console.error('[nhắc ship lỗi]', e));
  return { sent, orders: list.length, error: errors[0] || '' };
}
async function shipPage(req, res, url) {
  let t = url.searchParams.get('t');
  if (req.method === 'POST') { const raw = await readBody(req, 4096); t = new URLSearchParams(raw).get('t'); }
  const ref = store.token('ship', t), [id, chat, kind] = String(ref || '').split(':'), who = ref ? await chatName(env, chat) : '';
  const page = (title, body) => send(res, 200, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;background:#0e1417;color:#eee;margin:0;padding:24px 16px}main{max-width:460px;margin:auto;background:#151d21;border:1px solid #3a3122;border-radius:16px;padding:22px}h1{font-size:20px;color:#f3c76b;margin:0 0 12px}dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0 0 18px}dt{color:#9aa7ab}dd{margin:0}button{width:100%;padding:14px;border:0;border-radius:12px;background:#f3c76b;color:#1a1408;font-size:16px;font-weight:700}p{color:#c9d1d3}</style></head><body><main>${body}</main></body></html>`);
  const o = id && D.orders.find(x => x.id === id);
  if (!o) return page('Đường dẫn hết hạn', '<h1>Đường dẫn đã hết hạn</h1><p>Anh chờ tin nhắc mới, hoặc vào Quản trị > Đơn hàng để cập nhật.</p>');
  if (o.status !== 'paid') { return page('Đơn đã cập nhật', `<h1>Đơn ${esc(o.id)} đã được cập nhật</h1><p>${o.shipBy ? `${esc(o.shipBy)} đã xác nhận ship lúc ${esc(o.shipAt || '')}.` : 'Trạng thái hiện tại: ' + esc(o.status) + '.'}</p>`); }
  const info = `<dl><dt>Đơn</dt><dd><b>${esc(o.id)}</b></dd><dt>Khách</dt><dd>${esc(o.name)} · ${esc(o.phone || '')}</dd><dt>Địa chỉ</dt><dd>${esc(o.address || '')}</dd><dt>Sản phẩm</dt><dd>${(o.items || []).map(x => esc(x.qty + ' x ' + x.name)).join('<br>')}</dd><dt>Người bấm</dt><dd>${esc(who)}</dd></dl>`;
  if (kind === 'no') {
    store.useToken(t);
    (o.shipLog = o.shipLog || []).push({ at: stamp(), by: who, ship: false });
    (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: who, action: 'Nhắc giao hàng', detail: `${o.id}: chưa ship (từ Telegram)` }); save();
    return page('Chưa ship', `<h1>⏳ Đã ghi nhận: đơn ${esc(o.id)} chưa ship</h1><p>Mai trợ lý nhắc tiếp.</p>`);
  }
  if (req.method === 'POST') {
    const owner = D.users.find(u => A().isOwner(u)) || null;
    ACTOR = owner; const r = A().setStatus(D, o, 'ship'); ACTOR = null;
    if (r.error) return page('Chưa cập nhật được', `<h1>Chưa cập nhật được</h1><p>${esc(r.error)}</p>`);
    store.useToken(t); o.shipBy = who; o.shipAt = stamp();
    (o.shipLog = o.shipLog || []).push({ at: o.shipAt, by: who, ship: true });
    (D.logs = D.logs || []).unshift({ id: A().uid('nk'), date: stamp(), actor: who, action: 'Cập nhật đơn hàng', detail: `${o.id}: Đã ship, chuyển sang Đang giao (từ Telegram)` });
    after();
    return page('Đã ship', `<h1>🚚 Đơn ${esc(o.id)} đã chuyển sang Đang giao</h1><p>Người xác nhận: ${esc(who)}, lúc ${esc(o.shipAt)}. Đơn này không nhắc lại nữa.</p>`);
  }
  return page('Xác nhận đã ship ' + o.id, `<h1>Xác nhận đã gửi hàng</h1>${info}<form method="post"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">🚚 Đã ship đơn ${esc(o.id)}</button></form><p style="font-size:13px">Chỉ bấm khi hàng đã giao cho bên vận chuyển.</p>`);
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
server.listen(PORT, () => console.log(`Máy chủ PSQ${TEST ? ' (BẢN THỬ)' : ''} chạy cổng ${PORT}, dữ liệu ${DATA_DIR}, web ${WEB_ROOT}, địa chỉ ${BASE}`));

// sao lưu mỗi ngày, dọn phiên hết hạn, nhả hoa hồng đang giữ
const daily = () => { try { const f = store.backup(); if (f) console.log('Đã sao lưu', f); store.cleanup(); A().releaseHeld(D) && save(); } catch (e) { console.error('[sao lưu lỗi]', e); } };
daily(); setInterval(daily, 36e5);
// nhắc giao hàng: kiểm tra mỗi 10 phút, mỗi đơn chỉ nhắc 1 lần mỗi ngày trong giờ 8h-18h
const shipTick = () => remindShip().catch(e => console.error('[nhắc ship]', e));
setTimeout(shipTick, 15e3); setInterval(shipTick, 10 * 6e4);
// đăng ký quá 30 phút chưa kích hoạt: báo Telegram 1 lần (7h-22h) để gọi khách hoặc kích hoạt tay
const verifyTick = () => {
  try {
    const h = vnNow().getUTCHours(), now = Date.now(); if (h < 7 || h >= 22 || !env.TELEGRAM_BOT_TOKEN) return;
    const list = D.users.filter(u => u.verified === false && u.status !== 'locked' && !u.verifyNudged && u.verifySent && now - u.verifySent > 30 * 6e4 && now - u.verifySent < 3 * 864e5);
    if (!list.length) return;
    list.forEach(u => { u.verifyNudged = true; }); save();
    tell(`📩 ${list.length} người đăng ký quá 30 phút chưa kích hoạt email:\n${list.map(u => `• ${u.name} · ${u.phone || 'chưa có SĐT'} · ${u.email}`).join('\n')}\nAnh gọi nhắc khách xem thư (cả Quảng cáo, Thư rác) hoặc vào Quản trị > Thành viên bấm Kích hoạt.`);
  } catch (e) { console.error('[nhắc kích hoạt]', e); }
};
setInterval(verifyTick, 10 * 6e4);
process.on('SIGTERM', () => { save(); process.exit(0); });
