/* Các thao tác người dùng gửi lên máy chủ. Mỗi thao tác chạy trên dữ liệu gốc bằng chính bộ tính
   ADB của web, kiểm tra quyền và số liệu, rồi máy chủ lưu lại.
   auth: guest (ai cũng gọi được), member (đã đăng nhập), admin (tài khoản quản trị), owner (chủ sở hữu) */
'use strict';
const crypto = require('crypto');

const UNAME = /^[a-z0-9._]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// gõ nhầm tên miền email hay gặp: thư kích hoạt gửi đi rồi bị trả về, khách tưởng không nhận được thư
const MAIL_FIX = { 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.vn': 'gmail.com', 'gmail.com.vn': 'gmail.com', 'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmali.com': 'gmail.com', 'gmail.comm': 'gmail.com', 'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'hotmail.con': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'outlook.con': 'outlook.com', 'icloud.con': 'icloud.com' };
const mailTypo = e => { const at = e.lastIndexOf('@'), fix = at > 0 && MAIL_FIX[e.slice(at + 1)]; return fix ? e.slice(0, at + 1) + fix : ''; };
const PHONE = /^[0-9 +.]{9,15}$/;
const money = n => (Math.round(n) || 0).toLocaleString('vi-VN') + 'đ';
const ps = n => (Math.round(n) || 0).toLocaleString('vi-VN') + ' PS';
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const int = v => Math.round(+v || 0);
const normPhone = p => String(p || '').replace(/[^\d]/g, '').replace(/^84/, '0');
const err = e => ({ error: e });

/* ---------- mật khẩu (scrypt) ---------- */
function hashPass(p) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('base64') + '$' + crypto.scryptSync(String(p), salt, 64).toString('base64');
}
function verifyPass(p, h) {
  if (!h || !String(h).startsWith('scrypt$')) return false;
  const [, s, k] = String(h).split('$'), a = Buffer.from(k, 'base64'), b = crypto.scryptSync(String(p), Buffer.from(s, 'base64'), 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- dữ liệu gửi về trình duyệt ---------- */
const PUBLIC_USER = ['id', 'name', 'username', 'code', 'tier', 'role', 'created', 'activated', 'agentSince', 'avatar', 'status'];
const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
const clean = u => { const r = Object.assign({}, u); delete r.pass; delete r.resetAt; return r; };

// quản trị: toàn bộ dữ liệu, bỏ mật khẩu. Thành viên: phần của mình và tuyến dưới. Khách: phần công khai.
function scopeFor(d, me, A) {
  // quản trị: không kèm nội dung thư (nặng), xem thư thì lấy riêng bằng mailHtml
  if (me && me.role === 'admin' && me.status !== 'locked') { const o = Object.assign({}, d); o.users = d.users.map(clean); o.deletedUsers = (d.deletedUsers || []).map(clean); o.mails = (d.mails || []).map(m => { if (!m.html) return m; const x = Object.assign({}, m); delete x.html; x.hasHtml = true; return x; }); return o; }
  const out = { v: d.v, settings: Object.assign({}, d.settings), stock: d.stock || {}, stockMin: d.stockMin, users: [], orders: [], commissions: [], wallet: [], topups: [], addresses: [], messages: [], logs: [], mails: [], fundbook: [], receipts: [], expenses: [], stores: d.stores || [], roles: [] };
  delete out.settings.fundWarn; delete out.settings.codeReserve;
  // chương trình khuyến mãi đang chạy (công khai), không gửi danh sách người đã dùng
  out.promos = A.promosLive(d).map(p => pick(p, ['id', 'title', 'desc', 'start', 'end', 'code', 'type', 'value', 'maxOff', 'minOrder', 'color', 'link']));
  const users = new Map();
  const addU = (u, keys) => { if (!u) return; const prev = users.get(u.id) || {}; users.set(u.id, Object.assign(prev, keys ? pick(u, keys) : clean(u))); };
  // danh sách thành viên mới ở trang chủ
  d.users.filter(x => x.role !== 'admin' && x.status !== 'locked' && (x.tier === 'ctv' || x.tier === 'daily'))
    .map(x => ({ x, at: x.tier === 'daily' ? (x.agentSince || x.activated || '') : (x.activated || '') }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8).forEach(({ x }) => addU(x, PUBLIC_USER));
  // vòng quay: quà, cài đặt, người trúng gần đây (tên che bớt ở giao diện)
  const W = A.wheel(d);
  out.wheel = { prizes: W.prizes, settings: W.settings, rv: W.rv, events: (W.events || []).map(e => Object.assign({}, e, { fixedWinners: [] })), forced: {}, seen: {}, codes: [], spins: W.spins.slice(0, 12).map(s => pick(s, ['id', 'user', 'prize', 'prizeName', 'date'])) };
  out.wheel.spins.forEach(s => addU(A.user(d, s.user), ['id', 'name']));
  if (me) {
    addU(me);
    // tuyến dưới (người mình giới thiệu và cây), đơn hàng của họ để tính doanh số nhóm
    const team = new Set(), q = [me.id];
    while (q.length) { const id = q.shift(); d.users.forEach(u => { if ((u.sponsor === id || u.parent === id) && !team.has(u.id) && u.id !== me.id) { team.add(u.id); q.push(u.id); } }); }
    team.forEach(id => addU(A.user(d, id), PUBLIC_USER.concat(['sponsor', 'parent', 'placed', 'phone', 'city'])));
    const sp = me.sponsor && A.user(d, me.sponsor); if (sp) addU(sp, PUBLIC_USER.concat(['phone']));
    if (me.parent && me.parent !== me.sponsor) addU(A.user(d, me.parent), PUBLIC_USER);
    out.orders = d.orders.filter(o => o.userId === me.id).concat(d.orders.filter(o => team.has(o.userId)).map(o => pick(o, ['id', 'userId', 'name', 'items', 'total', 'status', 'date', 'settled', 'pay'])));
    out.commissions = (d.commissions || []).filter(c => c.user === me.id);
    (out.commissions).forEach(c => { if (c.from) addU(A.user(d, c.from), ['id', 'name', 'username', 'code', 'tier']); });
    // lịch sử ví: khoản nhận từ đơn hàng ghi kèm người mua, người tuyến dưới mang lại khoản đó, giá trị đơn
    const kindOf = { commission: 'direct', referral: 'ref', override: 'override' };
    out.wallet = (d.wallet || []).filter(w => w.user === me.id).map(w => {
      const o = w.ref && kindOf[w.type] && d.orders.find(x => x.id === w.ref); if (!o) return w;
      const cm = (d.commissions || []).find(x => x.user === me.id && x.order === o.id && x.kind === kindOf[w.type]);
      const buyer = A.user(d, o.userId), via = cm && cm.from && A.user(d, cm.from), tag = u => `${u.name}${u.code ? ' (' + u.code + ')' : ''}`;
      return Object.assign({}, w, { info: { buyer: buyer ? tag(buyer) : 'Khách lẻ ' + (o.name || ''), via: via && (!buyer || via.id !== buyer.id) ? tag(via) : '', order: o.id, total: o.total, items: (o.items || []).map(x => `${x.qty} x ${x.name}`).join(', ') } });
    });
    // khách mua qua link của mình mà chưa có tài khoản: để người giới thiệu gọi chăm sóc, mời đăng ký (không gửi địa chỉ nhà)
    out.guests = A.guests(d, me.id).map(g => ({ phone: g.phone, name: g.name, paid: g.paid, last: g.last, orders: g.orders.map(o => pick(o, ['id', 'items', 'total', 'status', 'date'])) }));
    out.coupons = (d.coupons || []).filter(x => x.user === me.id);
    // fanpage của mình: trạng thái và lý do chưa hiện trên trang chủ
    out.fanpages = (d.fanpages || []).filter(f => f.userId === me.id).map(f => Object.assign(pick(f, ['id', 'kind', 'url', 'title', 'status', 'stats', 'managed']), { why: fanWhy(d, f) }));
    out.topups = (d.topups || []).filter(t => t.user === me.id);
    out.addresses = (d.addresses || []).filter(a => a.user === me.id);
    out.wheel.codes = W.codes.filter(c => c.user === me.id);
    out.wheel.codes.forEach(c => { if (c.from) addU(A.user(d, c.from), ['id', 'name']); });
  }
  out.users = [...users.values()];
  return out;
}

// nội dung đơn cho tin Telegram: người mua, người giới thiệu, sản phẩm, mã giảm giá, đã trả bằng ví, địa chỉ
const FAN_HOSTS = [[/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me)$/, 'facebook'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)zalo\.me$/, 'zalo'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'], [/(^|\.)instagram\.com$/, 'instagram']];
function fanKind(raw) {
  try { const u = new URL(raw); if (u.protocol !== 'https:' || u.username || u.password) return ''; const h = u.hostname.toLowerCase(); const m = FAN_HOSTS.find(([re]) => re.test(h)); return m ? m[1] : ''; } catch (e) { return ''; }
}
const fanKey = url => { try { const u = new URL(url); return (u.hostname.replace(/^(www|m|web)\./, '') + u.pathname.replace(/\/+$/, '') + (/profile\.php/.test(u.pathname) ? '?' + u.searchParams.get('id') : '')).toLowerCase(); } catch (e) { return String(url || '').toLowerCase(); } };
// điều kiện hiện fanpage: anh cài ở Quản trị fanpage. managed = phải có trong danh sách An An gửi; posts/days = số bài tối thiểu trong 1 hoặc 7 ngày
const FAN_RULE = { managed: true, posts: 5, days: 7 };
const fanRule = d => Object.assign({}, FAN_RULE, (d.settings || {}).fanRule || {});
// lý do chưa hiện (trống = đang hiện); An An gửi số liệu quá 2 ngày coi như chưa có
function fanWhy(d, f, now = Date.now()) {
  const u = f.userId && d.users.find(x => x.id === f.userId), R = fanRule(d);
  if (f.status === 'pending') return 'Chờ duyệt';
  if (f.status === 'off') return 'Đang ẩn';
  if (!u && !f.always) return 'Chưa gắn thành viên';
  if (u && u.status === 'locked') return 'Thành viên bị khóa';
  if (f.always) return '';
  const fresh = f.stats && f.stats.at && now - f.stats.at < 2 * 864e5;
  if (R.managed && !(f.managed && fresh)) return 'Chưa có trong danh sách An An quản lý';
  if (R.posts > 0) { if (!fresh) return 'Chưa có số bài đăng từ An An'; const n = R.days === 1 ? (f.stats.today || 0) : (f.stats.d7 || 0); if (n < R.posts) return `Mới ${n}/${R.posts} bài trong ${R.days === 1 ? 'hôm nay' : '7 ngày'}`; }
  return '';
}
// danh sách fanpage hiện công khai: trang đăng nhiều xếp trước, rồi theo thứ tự anh đặt
function fanList(d) {
  const now = Date.now(), act = f => (f.stats && f.stats.at && now - f.stats.at < 2 * 864e5) ? (f.stats.d7 || 0) : 0;
  return (d.fanpages || []).filter(f => !fanWhy(d, f, now) && fanKind(f.url))
    .sort((a, b) => (a.pos ?? 9999) - (b.pos ?? 9999) || act(b) - act(a) || String(a.at).localeCompare(String(b.at)))
    .map(f => { const u = d.users.find(x => x.id === f.userId) || { name: f.title || 'Phúc Sinh QuanTum', code: '', tier: 'company', avatar: 'img/icon-192.png' }; return { name: u.name, code: u.code || '', tier: u.tier || 'khach', avatar: u.avatar || '', title: f.title || '', kind: f.kind, url: f.url, today: act(f) ? (f.stats.today || 0) : 0, d7: act(f) }; })
    .reduce((L, f) => { const g = L.find(x => x.code === f.code && x.name === f.name); const l = { kind: f.kind, url: f.url };
      if (g) { g.links.push(l); g.today += f.today; g.d7 += f.d7; if (!g.title) g.title = f.title; } else L.push({ name: f.name, code: f.code, tier: f.tier, avatar: f.avatar, title: f.title, today: f.today, d7: f.d7, links: [l] }); return L; }, []);
}
// An An (n8n) gửi danh sách trang nó quản lý + số bài: [{ pageId, name, url, code, today, d7, lastPost }]
function botFanpages(d, A, body, stamp) {
  const pages = [].concat(body.pages || []).slice(0, 500), F = d.fanpages = d.fanpages || [], now = Date.now(), seen = new Set();
  let added = 0, updated = 0; const bad = [];
  for (const p of pages) {
    const url = String(p.url || (p.pageId ? 'https://www.facebook.com/' + String(p.pageId).replace(/\D/g, '') : '')).trim();
    if (!fanKind(url)) { bad.push(p.name || p.url || p.pageId || '?'); continue; }
    const pid = String(p.pageId || '').replace(/\D/g, ''), key = fanKey(url);
    let f = F.find(x => (pid && x.pageId === pid) || fanKey(x.url) === key);
    const code = String(p.code || '').trim().toUpperCase(), u = code && d.users.find(x => x.role !== 'admin' && ((x.code || '').toUpperCase() === code || (x.oldCodes || []).some(o => o.toUpperCase() === code)));
    if (!f) { f = { id: A.uid('fp'), url, kind: fanKind(url), source: 'anan', status: 'ok', at: stamp() }; F.push(f); added++; } else updated++;
    if (pid) f.pageId = pid; if (!f.title && p.name) f.title = String(p.name).slice(0, 60); if (u && !f.userId) f.userId = u.id;
    f.managed = true; f.stats = { today: Math.max(0, +p.today || 0), d7: Math.max(0, +p.d7 || 0), lastPost: String(p.lastPost || '').slice(0, 30), at: now }; seen.add(f.id);
  }
  if (body.full !== false) F.forEach(f => { if (f.managed && !seen.has(f.id)) f.managed = false; });
  return { ok: true, added, updated, bad, showing: fanList(d).length };
}
function orderText(o) {
  const paid = (o.shopPaid || 0) + (o.cashPaid || 0);
  return `${o.name} · ${o.phone}\n${(o.items || []).map(x => `${x.qty} x ${x.name}`).join('\n')}\nTổng ${money(o.total)}${o.discount ? ` (đã giảm ${money(o.discount)}, mã ${o.coupon})` : ''}${paid ? `, đã trả bằng ví ${money(paid)}` : ''}${o.address ? `\nĐịa chỉ: ${o.address}` : ''}`;
}

/* ---------- thư mẫu ---------- */
const wrapMail = (site, title, body) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222;line-height:1.55">
  <h2 style="color:#9a6b1f;margin:0 0 12px">${title}</h2>${body}
  <p style="color:#777;font-size:13px;margin-top:24px">${site.brand} · Hotline ${site.phone} · ${site.email}<br>${site.address}</p></div>`;

/* ---------- các thao tác ---------- */
// ảnh bill: data URL JPG/PNG/WebP, tối đa 1,5MB, kiểm tra cả phần đầu tệp
function readBill(c, url) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(url || ''));
  if (!m) return err('Anh chị chọn ảnh bill chuyển khoản (JPG, PNG) giúp em.');
  const buf = Buffer.from(m[2], 'base64'), type = m[1];
  if (buf.length < 200 || buf.length > 1.5e6) return err('Ảnh bill quá lớn hoặc bị lỗi, anh chị chọn ảnh khác.');
  const sig = { 'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8, 'image/png': b => b.slice(1, 4).toString() === 'PNG', 'image/webp': b => b.slice(8, 12).toString() === 'WEBP' };
  if (!sig[type](buf)) return err('Tệp này không phải ảnh, anh chị chọn lại.');
  return { buf, type };
}

// trả đơn gói bằng ví điểm khả dụng: đủ điểm thì trừ ví, đơn tự thanh toán, tài khoản lên hạng ngay, không cần duyệt
function payByPoints(c, o, what) {
  const { d, A, me } = c;
  if (o.status !== 'pending') return { order: o };
  const r = A.spendAvail(d, me, o);
  if (r.error) { if (o.pay === 'points' && !o.availPaid) d.orders.splice(d.orders.indexOf(o), 1); return r; }
  const s = A.setStatus(d, o, 'paid'); if (s.error) return s;
  c.log(what + ' bằng điểm', `${me.name}: đơn ${o.id}, ${money(r.paid).replace('đ', ' PS')} từ ví điểm khả dụng`);
  c.notify(`✅ ${what} bằng điểm khả dụng\n${me.name} (@${me.username}) · đơn ${o.id}\nĐã trừ ${money(r.paid).replace('đ', ' PS')}, hệ thống tự kích hoạt, anh không cần duyệt.`);
  return { order: o, paidByPoints: true };
}

function verifyMail(c, u) {
  u.verifySent = Date.now();
  const t = c.store.newToken('verify', u.id, 72);
  c.mail(u.email, 'Kích hoạt tài khoản ' + c.site.brand, 'Kích hoạt', wrapMail(c.site, 'Kích hoạt tài khoản của anh chị',
    `<p>Chào ${c.e(u.name)},</p><p>Cảm ơn anh chị đã đăng ký thành viên. Anh chị bấm nút bên dưới để kích hoạt tài khoản <b>@${c.e(u.username)}</b>.</p><p><a href="${c.base}/api/verify?t=${t}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#f3c76b;color:#1a1408;font-weight:700;text-decoration:none">Kích hoạt tài khoản</a></p><p style="font-size:13px;color:#777">Đường dẫn dùng 1 lần trong 72 giờ. Nếu anh chị không đăng ký, hãy bỏ qua thư này.</p>`), { secret: true });
}
function welcomeMail(c, u) {
  c.mail(u.email, 'Chào mừng anh chị đến với ' + c.site.brand, 'Đăng ký', wrapMail(c.site, 'Chào mừng ' + c.e(u.name) + '!',
    `<p>Tài khoản thành viên của anh chị đã được tạo.</p><p>Tên truy cập: <b>@${c.e(u.username)}</b><br>Mã giới thiệu: <b>${c.e(u.code)}</b></p><p><a href="${c.base}/thanh-vien.html">Vào trang thành viên</a></p>`));
}

// tìm người giới thiệu theo mã PS.../tên truy cập. Mã của quản trị (PS1000 của chủ sở hữu) là công ty giới thiệu:
// hợp lệ nhưng không gắn tuyến trên, nên không phát sinh hoa hồng hay thưởng.
// mã PS: mã hiện tại hoặc mã cũ (đổi số đẹp vẫn giữ link cũ đã gửi đi). Số đẹp giữ lại thì không cấp tự động.
const CODE = /^PS\d{3,9}$/;
const hasCode = (u, k) => (u.code || '').toUpperCase() === k || (u.oldCodes || []).some(x => x.toUpperCase() === k);
const reserved = d => ((d.settings || {}).codeReserve || []).map(x => String(x.code || x).toUpperCase());
// mã của người đã xóa cũng không cấp lại (link giới thiệu cũ có thể còn ngoài kia)
const codeTaken = (d, k, except) => d.users.some(u => u !== except && (hasCode(u, k) || (u.username || '').toUpperCase() === k)) || (d.deletedUsers || []).some(u => hasCode(u, k));
const findRef = (d, ref) => {
  const k = String(ref || '').trim().toUpperCase(); if (!k) return null;
  const u = d.users.find(x => x.status !== 'locked' && (hasCode(x, k) || (x.username || '').toUpperCase() === k));
  return u ? { user: u, company: u.role === 'admin' } : null;
};

const ACTIONS = {
  /* ===== khách chưa đăng nhập ===== */
  checkRef: { auth: 'guest', run(c) {
    const k = str(c.args.code, 40).toUpperCase(); if (!k) return { ok: true };
    const r = findRef(c.d, k);
    return r ? { name: r.company ? c.site.brand || 'Công ty' : r.user.name } : err('Mã giới thiệu chưa đúng, anh chị kiểm tra lại hoặc để trống.');
  } },
  checkUsername: { auth: 'guest', run(c) {
    const v = str(c.args.username, 40).toLowerCase();
    if (!UNAME.test(v)) return err('Tên truy cập dài 3 đến 30 ký tự, chỉ gồm a-z, 0-9, dấu chấm, gạch dưới.');
    if (c.d.users.some(u => u.id !== (c.me && c.me.id) && ((u.username || '').toLowerCase() === v || hasCode(u, v.toUpperCase()))) || reserved(c.d).includes(v.toUpperCase())) return err('Tên truy cập này đã có người dùng.');
    return { ok: true };
  } },
  register: { auth: 'guest', run(c) {
    const { d, A, args } = c, name = str(args.name, 80), email = str(args.email, 120).toLowerCase(), phone = str(args.phone, 20), pass = String(args.pass || '');
    let username = str(args.username, 40).toLowerCase();
    if (name.length < 2 || !email || !pass) return err('Anh chị điền đủ họ tên, email và mật khẩu.');
    if (!EMAIL.test(email)) return err('Email chưa đúng định dạng.');
    if (mailTypo(email)) return err(`Email có vẻ gõ nhầm, có phải là ${mailTypo(email)} không? Anh chị sửa lại để nhận được thư kích hoạt.`);
    if (phone && !PHONE.test(phone)) return err('Số điện thoại chưa đúng.');
    if (pass.length < 6 || pass.length > 100) return err('Mật khẩu tối thiểu 6 ký tự.');
    if (!args.agree) return err('Anh chị cần đồng ý với điều khoản.');
    if (d.users.some(x => (x.email || '').toLowerCase() === email)) return err('Email này đã có tài khoản.');
    const taken = n => d.users.some(u => (u.username || '').toLowerCase() === n || hasCode(u, n.toUpperCase())) || reserved(d).includes(n.toUpperCase());
    if (username) { if (!UNAME.test(username)) return err('Tên truy cập dài 3 đến 30 ký tự, chỉ gồm a-z, 0-9, dấu chấm, gạch dưới.'); if (taken(username)) return err('Tên truy cập này đã có người dùng.'); }
    else { const b = email.split('@')[0].replace(/[^a-z0-9._]/g, '').slice(0, 24) || 'tv'; username = b.length < 3 ? b + 'psq' : b; let k = 1; const base = username; while (taken(username)) username = base + (++k); }
    let k = 1001 + d.users.filter(u => u.role !== 'admin').length; const rs = reserved(d); while (codeTaken(d, 'PS' + k) || rs.includes('PS' + k)) k++;
    const u = { id: 'u' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), name, email, phone, pass: hashPass(pass), role: 'member', created: c.today(), status: 'active', code: 'PS' + k, username, tier: 'khach', placed: false, parent: null };
    const ref = str(args.ref, 40).toUpperCase();
    const found = findRef(d, ref), sp = found && !found.company ? found.user : null;
    if (!ref) return err('Anh chị cần nhập mã giới thiệu. Hãy liên hệ người giới thiệu mình để lấy mã, hoặc chọn một đại lý uy tín trong danh sách.');
    if (!found) return err('Mã giới thiệu chưa đúng, anh chị kiểm tra lại với người giới thiệu.');
    if (found && found.company) u.refCode = found.user.code;
    if (sp) { u.sponsor = sp.id; u.placed = true; u.parent = sp.id; }   // đăng ký là lên cây ngay dưới người giới thiệu
    else { u.sponsor = null; u.placed = true; }
    // email gửi thư đã cài: tài khoản chờ kích hoạt qua thư; chưa cài thì dùng được ngay
    const verify = c.mailReady(); if (verify) u.verified = false;
    d.users.push(u);
    c.log('Đăng ký thành viên', `${u.name} (@${u.username})${sp ? ', giới thiệu bởi ' + sp.name : ''}`, u);
    A.wheelSync(d);
    if (verify) { verifyMail(c, u); return { needVerify: true, email: u.email }; }
    welcomeMail(c, u);
    return { user: clean(u), login: u.id };
  } },
  login: { auth: 'guest', run(c) {
    const k = str(c.args.login, 120).toLowerCase().replace(/^@/, ''), p = String(c.args.pass || '');
    if (!k || !p) return err('Anh chị nhập email hoặc tên truy cập và mật khẩu.');
    const ph = normPhone(k);
    const u = c.d.users.find(x => (x.email || '').toLowerCase() === k || (x.username || '').toLowerCase() === k || hasCode(x, k.toUpperCase()) || (ph.length >= 9 && normPhone(x.phone) === ph));
    if (!u || !verifyPass(p, u.pass)) return err(u && !u.pass ? 'Tài khoản chưa đặt mật khẩu. Anh chị bấm Quên mật khẩu để đặt.' : 'Email, tên truy cập hoặc mật khẩu chưa đúng.');
    if (u.status === 'locked') return err('Tài khoản này đang bị khóa. Anh chị liên hệ ' + c.site.phone + '.');
    if (u.verified === false) return err('Tài khoản chưa kích hoạt. Anh chị mở email ' + u.email + ' (xem cả mục Thư rác) và bấm nút Kích hoạt trong thư.');
    u.lastLogin = c.stamp();
    if (u.role === 'admin') c.log('Đăng nhập', 'Đăng nhập trang quản trị', u);
    return { user: clean(u), login: u.id };
  } },
  forgot: { auth: 'guest', run(c) {
    const email = str(c.args.email, 120).toLowerCase(), u = email && c.d.users.find(x => (x.email || '').toLowerCase() === email);
    if (!EMAIL.test(email)) return err('Anh chị nhập email đã đăng ký.');
    if (u && u.status !== 'locked') {
      const t = c.store.newToken('reset', u.id, 2), link = `${c.base}/thanh-vien.html?dat-lai=${t}`;
      c.mail(u.email, 'Đặt lại mật khẩu ' + c.site.brand, 'Quên mật khẩu', wrapMail(c.site, 'Đặt lại mật khẩu',
        `<p>Chào ${c.e(u.name)}, có yêu cầu đặt lại mật khẩu cho tài khoản @${c.e(u.username || '')}.</p><p><a href="${link}" style="display:inline-block;background:#c9932f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Đặt mật khẩu mới</a></p><p style="font-size:13px;color:#666">Đường dẫn dùng được 1 lần trong 2 giờ. Nếu anh chị không yêu cầu, hãy bỏ qua thư này.</p>`), { secret: true });
    }
    return { ok: true, sent: !!c.mailReady() };
  } },
  // bấm đường dẫn kích hoạt trong thư: tài khoản hoạt động, đăng nhập luôn
  verifyEmail: { auth: 'guest', run(c) {
    const id = c.store.token('verify', c.args.token), u = id && c.A.user(c.d, id);
    if (!u) return err('Đường dẫn kích hoạt đã hết hạn hoặc đã dùng. Anh chị đăng nhập để được gửi lại thư kích hoạt.');
    c.store.useToken(c.args.token);
    if (u.verified === false) { u.verified = true; u.verifiedAt = c.stamp(); c.log('Kích hoạt tài khoản', '@' + u.username, u); welcomeMail(c, u); }
    if (u.status === 'locked') return err('Tài khoản này đang bị khóa. Anh chị liên hệ ' + c.site.phone + '.');
    return { user: clean(u), login: u.id };
  } },
  resendVerify: { auth: 'guest', run(c) {
    const k = str(c.args.email, 120).toLowerCase(), u = k && c.d.users.find(x => (x.email || '').toLowerCase() === k || (x.username || '').toLowerCase() === k);
    if (u && u.verified === false && u.status !== 'locked') {
      const now = Date.now(); if (u.verifySent && now - u.verifySent < 60e3) return err('Thư vừa được gửi, anh chị chờ 1 phút rồi thử lại.');
      verifyMail(c, u);
    }
    return { ok: true };
  } },
  // màn hình chờ kích hoạt: khách gõ nhầm email thì tự sửa (cần đúng mật khẩu vừa đặt), thư gửi lại địa chỉ mới
  fixVerifyEmail: { auth: 'guest', run(c) {
    const k = str(c.args.email, 120).toLowerCase(), ne = str(c.args.newEmail, 120).toLowerCase();
    const u = k && c.d.users.find(x => (x.email || '').toLowerCase() === k);
    if (!u || u.verified !== false || !verifyPass(String(c.args.pass || ''), u.pass)) return err('Không sửa được email, anh chị đăng ký lại hoặc liên hệ ' + c.site.phone + '.');
    if (!EMAIL.test(ne)) return err('Email chưa đúng định dạng.');
    if (mailTypo(ne)) return err(`Email có vẻ gõ nhầm, có phải là ${mailTypo(ne)} không?`);
    if (ne !== k && c.d.users.some(x => x !== u && (x.email || '').toLowerCase() === ne)) return err('Email này đã có tài khoản.');
    if (u.verifySent && Date.now() - u.verifySent < 5e3) return err('Anh chị chờ vài giây rồi thử lại.');
    c.log('Sửa email chờ kích hoạt', `${u.name}: ${u.email} → ${ne}`, u);
    u.email = ne; u.verifyNudged = false; verifyMail(c, u);
    return { ok: true, email: ne };
  } },
  resetPass: { auth: 'guest', run(c) {
    const id = c.store.token('reset', c.args.token), u = id && c.A.user(c.d, id), p = String(c.args.pass || '');
    if (!u) return err('Đường dẫn đặt lại mật khẩu đã hết hạn hoặc đã dùng. Anh chị yêu cầu lại.');
    if (p.length < 6 || p.length > 100) return err('Mật khẩu mới cần ít nhất 6 ký tự.');
    u.pass = hashPass(p); u.passChanged = c.today(); if (u.verified === false) u.verified = true; c.store.useToken(c.args.token); c.store.endSessionsOf(u.id);
    c.log('Đặt lại mật khẩu', '@' + (u.username || u.email), u);
    return { user: clean(u), login: u.id };
  } },
  trackOrder: { auth: 'guest', run(c) {
    const id = str(c.args.id, 30).toUpperCase().replace(/\s/g, ''), ph = normPhone(c.args.phone);
    const o = id && ph && c.d.orders.find(x => x.id.toUpperCase() === id && normPhone(x.phone) === ph);
    return o ? { order: pick(o, ['id', 'status', 'date', 'items', 'total']) } : { order: null };
  } },
  // khách bấm "Tôi đã chuyển khoản": nhắc chủ cửa hàng kiểm tra (mỗi đơn tối đa 3 lần)
  paidClaim: { auth: 'guest', run(c) {
    // khách tra theo mã đơn + số điện thoại; thành viên gửi cho đơn của chính mình (gói CTV, gói đại lý)
    const id = str(c.args.id, 30).toUpperCase(), ph = normPhone(c.args.phone), o = c.d.orders.find(x => x.id === id && ((c.me && x.userId === c.me.id) || (ph && normPhone(x.phone) === ph)));
    if (!o) return err('Không tìm thấy đơn hàng.');
    if (o.status !== 'pending') return { status: o.status };
    if ((o.claims || 0) >= 3) return err('Công ty đã nhận được bill, anh chị chờ một chút giúp em.');
    const bill = readBill(c, c.args.bill); if (bill.error) return bill;
    o.claims = (o.claims || 0) + 1;
    const f = c.saveBill(o.id, bill.buf, bill.type);
    (o.bills = o.bills || []).push({ f, at: c.stamp() });
    const due = Math.max(0, o.total - (o.shopPaid || 0) - (o.cashPaid || 0));
    const what = c.A.isAgentPkgOrder(o) ? 'gói đại lý' : (o.items || []).some(x => x.id === c.A.PKG_ID) ? 'gói kích hoạt CTV' : 'đơn';
    c.notify(`🧾 Khách gửi bill chuyển khoản ${what} ${o.id}\n${orderText(o)}\nSố tiền cần nhận ${money(due)}, nội dung ${o.id}\nAnh đối chiếu với tài khoản ${c.site.bank && c.site.bank.name || 'ngân hàng'} rồi bấm duyệt.`, { kind: 'order', ref: o.id, button: '✅ Duyệt đã nhận tiền' }, bill);
    c.log('Khách gửi bill chuyển khoản', o.id);
    return { ok: true };
  } },
  // bill nạp tiền vào ví (yêu cầu nạp đang chờ của chính thành viên)
  topupClaim: { auth: 'member', run(c) {
    const { d, me } = c, tp = (d.topups || []).find(x => x.id === str(c.args.id, 40) && x.user === me.id);
    if (!tp) return err('Không tìm thấy yêu cầu nạp tiền.');
    if (tp.status !== 'pending') return { status: tp.status };
    if ((tp.claims || 0) >= 3) return err('Công ty đã nhận được bill, anh chị chờ một chút giúp em.');
    const bill = readBill(c, c.args.bill); if (bill.error) return bill;
    tp.claims = (tp.claims || 0) + 1;
    (tp.bills = tp.bills || []).push({ f: c.saveBill(tp.id, bill.buf, bill.type), at: c.stamp() });
    c.notify(`🧾 Bill nạp tiền ví\n${me.name} (@${me.username})\nSố tiền ${money(tp.amount)}, nội dung ${tp.code || ''}\nAnh đối chiếu với tài khoản ${c.site.bank && c.site.bank.name || 'ngân hàng'} rồi bấm duyệt.`, { kind: 'topup', ref: tp.id, button: '✅ Duyệt đã nhận tiền' }, bill);
    c.log('Thành viên gửi bill nạp tiền', `@${me.username}: ${money(tp.amount)}`);
    return { ok: true };
  } },
  // trang chờ thanh toán của thành viên hỏi trạng thái đơn gói hoặc yêu cầu nạp tiền
  payStatus: { auth: 'member', run(c) {
    const { d, me } = c, id = str(c.args.id, 40);
    const x = c.args.kind === 'topup' ? (d.topups || []).find(t => t.id === id && t.user === me.id) : d.orders.find(o => o.id === id && o.userId === me.id);
    return x ? { status: x.status } : err('Không tìm thấy.');
  } },
  contact: { auth: 'guest', run(c) {
    const a = c.args, m = { id: 'm' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), name: str(a.name, 80), phone: str(a.phone, 20), email: str(a.email, 120), topic: str(a.topic, 80), text: str(a.text, 3000), date: new Date().toISOString(), status: 'new' };
    if (m.name.length < 2 || !/^(\+?84|0)\d{8,10}$/.test(m.phone.replace(/[\s.-]/g, '')) || m.text.length < 5) return err('Anh chị kiểm tra lại họ tên, số điện thoại và nội dung.');
    (c.d.messages = c.d.messages || []).unshift(m);
    c.notify(`Lời nhắn mới: ${m.name} (${m.phone})\nChủ đề: ${m.topic}\n${m.text.slice(0, 500)}`);
    return { message: m };
  } },
  placeOrder: { auth: 'guest', run(c) {
    const { d, A, args, me } = c, info = args.info || {};
    const items = [];
    for (const x of (Array.isArray(args.items) ? args.items : []).slice(0, 50)) {
      const p = c.products.find(q => q.id === x.id), qty = int(x.qty);
      if (!p || p.id === A.PKG_ID || p.id === A.AGENT_PKG_ID || p.active === false) return err('Có sản phẩm không còn bán, anh chị tải lại trang giúp em.');
      if (qty < 1 || qty > 999) return err('Số lượng chưa đúng.');
      const st = A.stockOf(d, p.id); if (st !== null && qty > st) return err(st ? `${p.name} chỉ còn ${st} trong kho, anh chị giảm số lượng giúp em.` : `${p.name} đã hết hàng, anh chị bỏ sản phẩm này khỏi giỏ.`);
      const f = items.find(i => i.id === p.id); if (f) f.qty += qty; else items.push(Object.assign({ id: p.id, name: p.name, price: p.price, qty }, p.ps != null && p.ps !== '' ? { ps: A.psOf(p) } : {}));
    }
    if (!items.length) return err('Giỏ hàng đang trống.');
    const name = str(info.name, 80), phone = normPhone(info.phone), email = str(info.email, 120), address = str(info.address, 300), pay = info.pay === 'wallet' ? 'wallet' : 'bank';
    if (name.length < 2 || !/^0\d{9}$/.test(phone) || address.length < 5) return err('Anh chị kiểm tra lại họ tên, số điện thoại và địa chỉ nhận hàng.');
    if (email && !EMAIL.test(email)) return err('Email chưa đúng định dạng.');
    const num = Math.max(1100, ...d.orders.map(o => +String(o.id).replace(/\D/g, '') || 0)) + 1;
    const o = { id: 'PSQ' + num, userId: me ? me.id : null, name, phone, email, address, note: str(info.note, 500), pay, items, total: items.reduce((s, x) => s + x.price * x.qty, 0) + (+c.site.shipFee || 0), status: 'pending', date: c.today(), at: c.stamp() };
    // khách mua không đăng nhập: tính cho người giới thiệu. Số điện thoại đã là thành viên thì theo tuyến của thành viên đó;
    // số điện thoại đã từng mua qua link thì giữ người gửi link đầu tiên; còn lại theo mã link đầu tiên trình duyệt nhớ (args.ref).
    if (!me) {
      const mem = d.users.find(u => u.role !== 'admin' && phone && normPhone(u.phone) === phone);
      const kept = (d.guestRefs || {})[phone], found = findRef(d, args.ref), fromLink = found && !found.company && found.user.role !== 'admin' ? found.user.id : null;
      const sp = mem ? mem.sponsor : kept && c.A.user(d, kept) ? kept : fromLink;
      if (sp) { o.refBy = sp; if (!mem && !kept) (d.guestRefs = d.guestRefs || {})[phone] = sp; }
      if (mem && d.users.filter(u => u.role !== 'admin' && normPhone(u.phone) === phone).length === 1) { o.userId = mem.id; o.linked = 'phone'; }   // số điện thoại là của thành viên: đơn tính cho tài khoản đó
    }
    // 1 mã giảm giá mỗi đơn (mã cá nhân hoặc mã chương trình khuyến mãi): giảm trên tiền hàng, trước khi trừ ví
    if (args.coupon) {
      const cc = c.A.codeCheck(d, args.coupon, me, o.total - (+c.site.shipFee || 0), phone); if (cc.error) return cc;
      c.A.codeUse(d, cc, o);
    }
    d.orders.unshift(o);
    let used = 0, usedC = 0;
    if (me) {
      if (int(args.useShop) > 0) used = A.spendShop(d, me, o, int(args.useShop));
      if (int(args.useCash) > 0) usedC = A.spendCash(d, me, o, int(args.useCash));
      if (used || usedC) {
        const full = used + usedC >= o.total;
        if (full) A.setStatus(d, o, 'paid');
        c.log('Thanh toán bằng ví', `${o.id}: ${me.name}${used ? ` dùng ${ps(used)} ví mua hàng` : ''}${usedC ? ` trả ${money(usedC)} ví tiền mặt` : ''}${full ? ', đã thanh toán đủ' : ''}`);
      }
      const sa = args.saveAddr;
      if (sa && str(sa.line).length >= 5) {
        const mine = d.addresses.filter(a => a.user === me.id), line = str(sa.line, 300), province = str(sa.province, 80);
        if (!mine.some(a => a.line === line && a.province === province)) d.addresses.push({ id: A.uid('dc'), user: me.id, name, phone, line, province, isDefault: !mine.length });
      }
    }
    c.log('Đặt hàng', `${o.id}: ${name}, ${money(o.total)}`);
    const due = Math.max(0, o.total - (o.shopPaid || 0) - (o.cashPaid || 0));
    // chưa thanh toán thì chưa báo Telegram; khách gửi bill chuyển khoản (paidClaim) mới báo kèm đủ chi tiết đơn
    if (!due) c.notify(`Đơn hàng mới ${o.id} (đã thanh toán bằng ví)\n${orderText(o)}`);
    if (email) c.mail(email, `Xác nhận đơn hàng ${o.id}`, 'Đơn hàng', wrapMail(c.site, 'Cảm ơn ' + c.e(name) + ' đã đặt hàng',
      `<p>Mã đơn: <b>${o.id}</b></p><table style="width:100%;border-collapse:collapse">${items.map(x => `<tr><td style="padding:4px 0">${x.qty} x ${c.e(x.name)}</td><td style="text-align:right">${money(x.price * x.qty)}</td></tr>`).join('')}${o.discount ? `<tr><td>Mã giảm giá ${c.e(o.coupon)}</td><td style="text-align:right">-${money(o.discount)}</td></tr>` : ''}<tr><td style="padding-top:8px"><b>Tổng</b></td><td style="text-align:right"><b>${money(o.total)}</b></td></tr></table>
       ${due ? `<p>Anh chị chuyển khoản <b>${money(due)}</b> tới ${c.e(c.site.bank.name)} ${c.e(c.site.bank.account)} (${c.e(c.site.bank.owner)}), nội dung <b>${o.id}</b>.</p>` : '<p>Đơn đã thanh toán đủ bằng ví.</p>'}
       <p>Giao tới: ${c.e(address)}</p>`));
    return { order: o };
  } },

  /* ===== thành viên ===== */
  profile: { auth: 'member', run(c) {
    const name = str(c.args.name, 80), phone = str(c.args.phone, 20), birthday = str(c.args.birthday, 10);
    if (name.length < 2) return err('Anh chị nhập họ và tên.');
    if (phone && !PHONE.test(phone)) return err('Số điện thoại chưa đúng.');
    Object.assign(c.me, { name, phone, birthday }); c.log('Cập nhật hồ sơ', `@${c.me.username}: ${name}`); return { ok: true };
  } },
  avatar: { auth: 'member', run(c) {
    const url = c.args.url;
    if (url == null) { delete c.me.avatar; c.log('Xóa ảnh đại diện', '@' + c.me.username); return { ok: true }; }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(url)) || String(url).length > 400000) return err('Ảnh chưa hợp lệ, anh chị chọn ảnh khác.');
    c.me.avatar = c.media ? c.media(url) : url; c.log('Cập nhật ảnh đại diện', '@' + c.me.username); return { ok: true };
  } },
  // fanpage thành viên tự gửi (tối đa 3 link), vào d.fanpages chờ quản trị duyệt
  fanSet: { auth: 'member', run(c) {
    const links = [].concat(c.args.links || []).slice(0, 3).map(x => String(x || '').trim()).filter(Boolean), title = str(c.args.title, 60), out = [];
    for (const raw of links) { const k = fanKind(raw); if (!k) return err('Link chưa đúng. Anh chị dán link trang Facebook, TikTok, Zalo, YouTube hoặc Instagram (bắt đầu bằng https://).'); out.push({ kind: k, url: raw.slice(0, 300), key: fanKey(raw) }); }
    const F = c.d.fanpages = c.d.fanpages || [], me = c.me, added = [];
    for (let i = F.length - 1; i >= 0; i--) { const f = F[i]; if (f.userId === me.id && f.source === 'member' && !out.some(o => o.key === fanKey(f.url))) F.splice(i, 1); }
    out.forEach(o => {
      const f = F.find(x => fanKey(x.url) === o.key);
      if (f && f.userId && f.userId !== me.id) return;
      if (f) { f.userId = me.id; if (title) f.title = title; return; }
      F.push({ id: c.A.uid('fp'), userId: me.id, kind: o.kind, url: o.url, title, source: 'member', status: 'pending', at: c.stamp() }); added.push(o.url);
    });
    if (added.length) { c.log('Gửi fanpage chờ duyệt', `@${me.username}: ${added.join(', ')}`); c.notify(`📣 ${me.name} (${me.code || '@' + me.username}) gửi fanpage chờ duyệt:\n${added.join('\n')}\nAnh vào Quản trị > Quản trị fanpage để duyệt.`); }
    return { ok: true, pages: F.filter(f => f.userId === me.id).map(f => ({ url: f.url, kind: f.kind, status: f.status })) };
  } },
  // quản trị fanpage: thêm, sửa, xóa, ẩn hiện, sắp thứ tự, cài điều kiện hiển thị
  fanAdmin: { auth: 'admin', perm: 'content', run(c) {
    const { d, args: a } = c, F = d.fanpages = d.fanpages || [];
    if (a.op === 'list') return { rule: fanRule(d), pages: F.map(f => { const u = f.userId && d.users.find(x => x.id === f.userId); return Object.assign({}, f, { why: fanWhy(d, f), owner: u ? { name: u.name, code: u.code || '', tier: u.tier || 'khach', avatar: u.avatar || '' } : null }); }), botOn: !!c.botOn };
    if (a.op === 'rule') {
      const st = d.settings = d.settings || {};
      st.fanRule = { managed: !!a.managed, posts: Math.max(0, Math.min(99, Math.round(+a.posts || 0))), days: [1, 7].includes(+a.days) ? +a.days : 7 };
      c.log('Điều kiện hiện fanpage', JSON.stringify(st.fanRule)); return { ok: true, rule: st.fanRule };
    }
    if (a.op === 'del') { const i = F.findIndex(f => f.id === a.id); if (i < 0) return err('Không tìm thấy fanpage.'); const f = F.splice(i, 1)[0]; c.log('Xóa fanpage', f.url); return { ok: true }; }
    let f = a.id ? F.find(x => x.id === a.id) : null; if (a.id && !f) return err('Không tìm thấy fanpage.');
    if (a.url != null || !f) {
      const url = String(a.url || '').trim(), k = fanKind(url); if (!k) return err('Link chưa đúng. Dán link Facebook, TikTok, Zalo, YouTube hoặc Instagram (bắt đầu bằng https://).');
      const dup = F.find(x => x !== f && fanKey(x.url) === fanKey(url)); if (dup) return err('Fanpage này đã có trong danh sách.');
      if (!f) { f = { id: c.A.uid('fp'), source: 'admin', status: 'ok', at: c.stamp() }; F.push(f); }
      Object.assign(f, { url: url.slice(0, 300), kind: k });
    }
    if (a.code !== undefined) { const code = String(a.code || '').trim().toUpperCase(); if (code) { const u = c.d.users.find(x => x.role !== 'admin' && ((x.code || '').toUpperCase() === code || (x.oldCodes || []).some(o => o.toUpperCase() === code))); if (!u) return err('Không có thành viên mã ' + code + '.'); f.userId = u.id; } else f.userId = null; }
    if (a.title !== undefined) f.title = str(a.title, 60);
    if (['ok', 'off', 'pending'].includes(a.status)) f.status = a.status;
    if (a.pos !== undefined) f.pos = a.pos === '' || a.pos == null ? null : Math.max(0, Math.min(9999, Math.round(+a.pos) || 0));
    if (a.always !== undefined) f.always = !!a.always;
    c.log('Quản trị fanpage', `${f.url}: ${f.status === 'ok' ? 'Hiện' : f.status === 'off' ? 'Ẩn' : 'Chờ duyệt'}${f.always ? ', luôn hiện' : ''}`);
    return { ok: true, id: f.id };
  } },
  changePass: { auth: 'member', run(c) {
    const o = String(c.args.old || ''), n = String(c.args.pass || '');
    if (!verifyPass(o, c.me.pass)) return err('Mật khẩu hiện tại chưa đúng.');
    if (n.length < 6 || n.length > 100) return err('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (verifyPass(n, c.me.pass)) return err('Mật khẩu mới cần khác mật khẩu cũ.');
    c.me.pass = hashPass(n); c.me.passChanged = c.today(); c.store.endSessionsOf(c.me.id, c.sid);
    c.log('Đổi mật khẩu', '@' + (c.me.username || c.me.email)); return { ok: true };
  } },
  addrSave: { auth: 'member', run(c) {
    const { d, me } = c, a = c.args, v = { name: str(a.name, 80), phone: str(a.phone, 20), line: str(a.line, 300), province: str(a.province, 80), isDefault: !!a.isDefault };
    if (!v.name || !v.phone || v.line.length < 5 || !v.province) return err('Anh chị điền đủ người nhận, số điện thoại, địa chỉ và tỉnh thành.');
    d.addresses = d.addresses || [];
    const mine = () => d.addresses.filter(x => x.user === me.id), cur = a.id && mine().find(x => x.id === a.id);
    if (a.id && !cur) return err('Không tìm thấy địa chỉ.');
    if (v.isDefault) mine().forEach(x => x.isDefault = false);
    if (cur) Object.assign(cur, v); else d.addresses.push({ id: c.A.uid('dc'), user: me.id, ...v });
    if (!mine().some(x => x.isDefault)) mine()[0].isDefault = true;
    c.log(cur ? 'Sửa địa chỉ' : 'Thêm địa chỉ', me.name); return { ok: true };
  } },
  addrDefault: { auth: 'member', run(c) {
    const mine = c.d.addresses.filter(x => x.user === c.me.id); if (!mine.some(x => x.id === c.args.id)) return err('Không tìm thấy địa chỉ.');
    mine.forEach(x => x.isDefault = x.id === c.args.id); c.log('Đặt địa chỉ mặc định', c.me.name); return { ok: true };
  } },
  addrDelete: { auth: 'member', run(c) {
    const { d, me } = c, a = d.addresses.find(x => x.user === me.id && x.id === c.args.id); if (!a) return err('Không tìm thấy địa chỉ.');
    d.addresses = d.addresses.filter(x => x !== a); const rest = d.addresses.filter(x => x.user === me.id); if (a.isDefault && rest.length) rest[0].isDefault = true;
    c.log('Xóa địa chỉ', me.name); return { ok: true };
  } },
  buyPackage: { auth: 'member', run(c) {
    const { d, A, me } = c;
    if ((me.tier || 'khach') !== 'khach') return err('Tài khoản đã kích hoạt.');
    const has = d.orders.find(o => o.userId === me.id && o.status !== 'failed' && (o.items || []).some(x => x.id === A.PKG_ID));
    if (c.args.pay === 'points') return payByPoints(c, has || A.buyPackage(d, me, 'points'), 'Kích hoạt CTV');
    if (has) return { order: has };
    const o = A.buyPackage(d, me, 'bank');
    c.log('Đặt gói kích hoạt CTV', `${me.name}: đơn ${o.id}, ${money(o.total)}`);
    return { order: o };
  } },
  buyAgentPackage: { auth: 'member', run(c) {
    const { d, A, me } = c;
    if (!A.plan(d).agentPkgOn) return err('Hiện công ty chưa mở đăng ký gói đại lý.');
    if (me.tier === 'daily') return err('Tài khoản đã là Đại lý.');
    const has = d.orders.find(o => o.userId === me.id && o.status !== 'failed' && A.isAgentPkgOrder(o));
    if (c.args.pay === 'points') return payByPoints(c, has || A.buyAgentPackage(d, me, 'points'), 'Lên đại lý');
    if (has) return { order: has };
    const o = A.buyAgentPackage(d, me, 'bank');
    c.log('Đặt gói đại lý', `${me.name}: đơn ${o.id}, ${money(o.total)}`);
    return { order: o };
  } },
  deposit: { auth: 'member', run(c) {
    const { d, A, me } = c, a = int(c.args.amount), method = c.args.method === 'Tiền mặt tại cửa hàng' ? 'Tiền mặt tại cửa hàng' : 'Chuyển khoản';
    if (a < 10000) return err('Số tiền nạp tối thiểu 10.000đ.');
    if (a > 2e9) return err('Số tiền nạp quá lớn, anh chị liên hệ công ty.');
    const code = 'NAP ' + String(me.username || me.code || '').toUpperCase();
    const r = A.deposit(d, me, a, method, { status: 'pending', code }); if (r.error) return r;
    c.log('Yêu cầu nạp tiền', `${me.name}: ${money(a)} qua ${method}`);
    // chuyển khoản: chờ thành viên gửi bill (topupClaim) mới báo; nộp tiền mặt tại cửa hàng thì báo luôn
    if (method !== 'Chuyển khoản') c.notify(`Yêu cầu nạp tiền ví\n${me.name} (@${me.username})\nSố tiền ${money(a)} nộp tiền mặt tại cửa hàng`, { kind: 'topup', ref: r.topup.id, button: '✅ Xác nhận đã nhận tiền' });
    return { topup: r.topup };
  } },
  wallet: { auth: 'member', run(c) {
    const { d, A, me, args } = c, a = int(args.amount), k = args.kind; let r;
    if (k === 'withdraw') {
      const bank = str(args.bank, 80), account = str(args.account, 120);
      if (!bank || !account) return err('Anh chị điền tên ngân hàng và số tài khoản.');
      r = A.withdraw(d, me, a, { bank, account }); if (r.error) return r;
      c.log('Yêu cầu rút tiền', `@${me.username}: ${money(a)} từ ví tiền mặt về ${bank} ${account}`);
      c.notify(`Yêu cầu rút tiền\n${me.name} (@${me.username})\n${money(a)} về ${bank} ${account}\nDuyệt trong Quản trị > Tài chính.`);
    } else if (k === 'tocash') { r = A.toCash(d, me, a); if (r.error) return r; c.log('Rút sang ví tiền mặt', `@${me.username}: ${money(a)}, thuế ${money(r.tax)}, thực nhận ${money(r.net)}`); }
    else if (k === 'topoints') { r = A.cashToPoints(d, me, a); if (r.error) return r; c.log('Đổi tiền mặt sang điểm PS', `@${me.username}: ${money(a)} thành ${ps(a)}`); }
    else if (k === 'convert') { r = A.convert(d, me, a); if (r.error) return r; c.log('Chuyển điểm thưởng', `@${me.username}: ${ps(a)}, thuế ${ps(r.tax)}`); }
    else if (k === 'toshop') { r = A.toShop(d, me, a); if (r.error) return r; c.log('Chuyển sang ví mua hàng', `@${me.username}: ${ps(a)}`); }
    else if (k === 'transfer') {
      const to = A.byUsername(d, args.user);
      if (args.check) { if (!to || to.role === 'admin') return err('Không tìm thấy thành viên có tên truy cập này.'); if (to.id === me.id) return err('Không thể chuyển cho chính mình.'); if (!(a > 0)) return err('Anh chị nhập số điểm cần chuyển.'); if (a > A.balances(d, me.id).avail) return err('Ví điểm khả dụng không đủ.'); return { to: pick(to, ['id', 'name', 'username']), check: true }; }
      r = A.transfer(d, me, args.user, a, str(args.note, 80)); if (r.error) return r;
      c.log('Chuyển điểm', `@${me.username} chuyển ${ps(a)} cho @${r.to.username}`);
      r = { to: pick(r.to, ['id', 'name', 'username']) };
    } else return err('Thao tác không hợp lệ.');
    return Object.assign({ ok: true }, r);
  } },
  lookupUser: { auth: 'member', run(c) {
    const to = c.A.byUsername(c.d, c.args.username);
    return to && to.role !== 'admin' ? { user: pick(to, ['id', 'name', 'username', 'tier', 'avatar']) } : { user: null };
  } },
  spin: { auth: 'member', run(c) {
    const r = c.A.wheelSpin(c.d, c.args.code, c.me); if (r.error) return r;
    c.log('Quay thưởng', `${c.me.name} dùng mã ${r.spin.code}: ${r.prize.name}`);
    return { prize: r.prize, index: r.index, spin: r.spin, segments: r.segments };
  } },

  // vòng quay chào mừng: mỗi thành viên quay 1 lần sau khi đăng ký, trúng là nhận mã giảm giá
  welcomeSpin: { auth: 'member', run(c) {
    const r = c.A.welcomeSpin(c.d, c.me); if (r.error) return r;
    c.log('Vòng quay chào mừng', `${c.me.name} (${c.me.code || ''}): ${r.prize.label}${r.coupon ? ', mã ' + r.coupon.code : ''}`);
    return { prize: r.prize, index: r.index, segments: r.segments, coupon: r.coupon };
  } },
  couponCheck: { run(c) {
    const sub = (Array.isArray(c.args.items) ? c.args.items : []).reduce((s, x) => { const p = c.products.find(q => q.id === x.id); return s + (p ? p.price * Math.max(0, int(x.qty)) : 0); }, 0);
    const r = c.A.codeCheck(c.d, c.args.code, c.me, sub, normPhone(c.args.phone)); if (r.error) return r;
    return r.coupon ? { code: r.coupon.code, label: r.coupon.label, discount: r.discount } : { code: String(r.promo.code).toUpperCase(), label: r.promo.title, discount: r.discount, promo: true };
  } },

  /* ===== quản trị ===== */
  adminCreate: { auth: 'admin', perm: 'admins', run(c) {
    const a = c.args, email = str(a.email, 120).toLowerCase(), pass = String(a.pass || '');
    if (!EMAIL.test(email)) return err('Email chưa đúng định dạng.');
    if (c.d.users.some(u => (u.email || '').toLowerCase() === email)) return err('Email này đã có tài khoản.');
    if (pass.length < 6) return err('Mật khẩu tạm cần ít nhất 6 ký tự.');
    const role = (c.d.roles || []).some(r => r.id === a.role) ? a.role : 'sale';
    if (role === 'owner' && !c.A.isOwner(c.me)) return err('Chỉ chủ sở hữu mới tạo được tài khoản chủ sở hữu.');
    const u = { id: c.A.uid('u-adm'), name: str(a.name, 80), email, phone: str(a.phone, 20), pass: hashPass(pass), role: 'admin', adminRole: role, created: c.today(), status: 'active', mustChange: true };
    c.d.users.push(u); c.log('Tạo tài khoản quản trị', `${u.name} (${u.email})`); return { user: clean(u) };
  } },
  // quản trị sửa thông tin, khóa hoặc mở khóa tài khoản thành viên
  adminEditMember: { auth: 'admin', perm: 'members', run(c) {
    const { d, args } = c, u = c.A.user(d, args.id);
    if (!u || u.role === 'admin') return err('Chỉ sửa được tài khoản thành viên ở đây.');
    const name = str(args.name, 80), email = str(args.email, 120).toLowerCase(), phone = str(args.phone, 20), username = str(args.username, 40).toLowerCase().replace(/^@/, '');
    const status = args.status === 'locked' ? 'locked' : 'active';
    if (name.length < 2) return err('Họ tên cần ít nhất 2 ký tự.');
    if (!EMAIL.test(email)) return err('Email chưa đúng định dạng.');
    if (phone && !PHONE.test(phone)) return err('Số điện thoại chưa đúng.');
    if (!UNAME.test(username)) return err('Tên truy cập dài 3 đến 30 ký tự, chỉ gồm a-z, 0-9, dấu chấm, gạch dưới.');
    if (d.users.some(x => x.id !== u.id && (x.email || '').toLowerCase() === email)) return err('Email này đã có tài khoản khác dùng.');
    if (d.users.some(x => x.id !== u.id && ((x.username || '').toLowerCase() === username || (x.code || '').toLowerCase() === username))) return err('Tên truy cập này đã có người dùng.');
    const changes = [['Họ tên', u.name, name], ['Email', u.email, email], ['Điện thoại', u.phone || '', phone], ['Tên truy cập', u.username, username], ['Trạng thái', u.status === 'locked' ? 'Khóa' : 'Hoạt động', status === 'locked' ? 'Khóa' : 'Hoạt động']].filter(x => String(x[1] || '') !== String(x[2]));
    Object.assign(u, { name, email, phone, username, status });
    if (status === 'locked') c.store.endSessionsOf(u.id);   // khóa là đăng xuất ngay mọi nơi
    if (changes.length) c.log(status === 'locked' && changes.some(x => x[0] === 'Trạng thái') ? 'Khóa tài khoản thành viên' : 'Sửa thông tin thành viên', `${u.name} (${u.code || ''}): ` + changes.map(x => `${x[0]} ${x[1] || '(trống)'} → ${x[2] || '(trống)'}`).join('; '));
    return { ok: true, changed: changes.length };
  } },
  // đổi mã PS (chọn số đẹp). Mã cũ vẫn dùng được cho link giới thiệu, đăng nhập đã gửi trước đó.
  memberCode: { auth: 'admin', perm: 'members', run(c) {
    const { d } = c, u = c.A.user(d, c.args.id), k = str(c.args.code, 12).toUpperCase().replace(/\s/g, '');
    if (!u || u.role === 'admin') return err('Chỉ đổi mã cho tài khoản thành viên.');
    if (!CODE.test(k)) return err('Mã gồm chữ PS và 3 đến 9 chữ số, ví dụ PS8888.');
    if ((u.code || '').toUpperCase() === k) return err('Thành viên đang dùng mã này rồi.');
    if (codeTaken(d, k, u)) return err(k + ' đã có người dùng (hoặc là mã cũ của người khác).');
    const old = u.code; if (old && !(u.oldCodes || []).includes(old)) u.oldCodes = [...(u.oldCodes || []), old];
    u.oldCodes = (u.oldCodes || []).filter(x => x.toUpperCase() !== k); if (!u.oldCodes.length) delete u.oldCodes;
    u.code = k;
    const rs = (d.settings.codeReserve || []), i = rs.findIndex(x => String(x.code || x).toUpperCase() === k), sold = i >= 0 ? rs.splice(i, 1)[0] : null;
    c.log('Đổi mã thành viên', `${u.name}: ${old || '(trống)'} → ${k}${sold && sold.price ? ', số đẹp giá ' + sold.price : ''}`, u);
    return { ok: true, code: k, old };
  } },
  // đổi người giới thiệu (tuyến trên) của thành viên sang đại lý/CTV khác hoặc về công ty. Hoa hồng đã ghi giữ nguyên, đơn sau tính cho người mới.
  memberSponsor: { auth: 'admin', perm: 'members', run(c) {
    const { d, A } = c, u = A.user(d, c.args.id), k = str(c.args.code, 40).toUpperCase();
    if (!u || u.role === 'admin') return err('Chỉ đổi được cho tài khoản thành viên.');
    const r = k ? findRef(d, k) : { company: true };
    if (!r) return err('Mã giới thiệu chưa đúng.');
    const sp = r.company ? null : r.user;
    if (sp && sp.id === u.id) return err('Không chọn chính người này làm người giới thiệu.');
    for (let x = sp, n = 0; x && n < 200; x = x.sponsor && A.user(d, x.sponsor), n++) if (x.sponsor === u.id) return err(`${sp.name} đang ở tuyến dưới của ${u.name}, không đổi ngược lên được.`);
    if ((u.sponsor || null) === (sp ? sp.id : null)) return err('Người này đang thuộc tuyến đó rồi.');
    const old = u.sponsor && A.user(d, u.sponsor), nm = x => x ? `${x.name} (${x.code})` : 'Công ty';
    u.sponsor = sp ? sp.id : null; u.parent = sp ? sp.id : null; u.placed = true;
    if (sp) delete u.refCode; else u.refCode = (d.users.find(x => x.role === 'admin' && x.code) || {}).code || 'PS1000';
    c.log('Đổi người giới thiệu', `${u.name} (${u.code}): ${nm(old)} → ${nm(sp)}`, u);
    return { ok: true, sponsor: sp ? { id: sp.id, name: sp.name, code: sp.code } : null };
  } },
  // đơn sót: đơn chờ thanh toán quá 10 phút; send = bot gửi lên Telegram; auto = bật/tắt tự quét 9h, 14h, 20h
  staleOrders: { auth: 'admin', perm: 'orders', run(c) {
    const st = c.d.settings = c.d.settings || {};
    if (typeof c.args.auto === 'boolean') { st.staleAuto = c.args.auto; c.log('Tự quét đơn sót', c.args.auto ? 'Bật' : 'Tắt'); }
    const list = c.stale.list(); let sent = null;
    if (c.args.send) { if (!c.notifyReady) return err('Chưa cấu hình Telegram nên bot chưa gửi được.'); sent = c.stale.send(list); c.log('Gửi đơn sót lên Telegram', `${sent.sent} đơn`); }
    return { list: c.stale.list(), sent, auto: st.staleAuto !== false };
  } },
  mailHtml: { auth: 'admin', perm: 'system', run(c) { const m = (c.d.mails || []).find(x => x.id === c.args.id); return m ? { html: m.html || '' } : err('Không tìm thấy thư.'); } },
  // xóa thành viên (chủ sở hữu, nhập lại mật khẩu): chỉ người chưa có tuyến dưới, chưa có đơn đã trả, hoa hồng, giao dịch ví.
  // Đơn chưa thanh toán của họ được hủy cùng lúc. Hồ sơ chuyển vào d.deletedUsers để khôi phục; mã PS không cấp lại cho ai.
  memberDelete: { auth: 'owner', run(c) {
    const { d, A } = c, ids = [].concat(c.args.ids || []).slice(0, 200), done = [], skip = [];
    if (!verifyPass(String(c.args.pass || ''), c.me.pass)) return err('Mật khẩu xác nhận chưa đúng.');
    const PAIDST = ['paid', 'ship', 'done'];
    const why = u => {
      if (!u || u.role === 'admin') return 'không phải thành viên';
      if (d.users.some(x => x.sponsor === u.id || x.parent === u.id)) return 'đã có tuyến dưới';
      if (d.orders.some(o => (o.userId === u.id || o.refBy === u.id) && (PAIDST.includes(o.status) || o.settled))) return 'đã có đơn đã thanh toán';
      if ((d.commissions || []).some(x => x.user === u.id || x.from === u.id)) return 'đã có hoa hồng';
      if ((d.wallet || []).some(w => w.user === u.id) || (d.topups || []).some(t => t.user === u.id)) return 'đã có giao dịch ví';
      return '';
    };
    ids.forEach(id => { const u = A.user(d, id), r = why(u); if (r) { skip.push(`${u ? u.name : id}: ${r}`); return; }
      const cancel = d.orders.filter(o => o.userId === u.id && o.status === 'pending');
      cancel.forEach(o => { o.status = 'failed'; o.note = ((o.note || '') + ' [Hủy do xóa tài khoản]').trim(); });
      d.users.splice(d.users.indexOf(u), 1);
      (d.deletedUsers = d.deletedUsers || []).push(Object.assign({}, u, { deletedAt: c.stamp(), deletedBy: c.me.name, cancelled: cancel.map(o => o.id) }));
      Object.keys(d.guestRefs || {}).forEach(k => { if (d.guestRefs[k] === u.id) delete d.guestRefs[k]; });
      c.store.endSessionsOf(u.id); done.push(u); });
    if (done.length) c.log('Xóa thành viên', done.map(u => `${u.name} (${u.code || '@' + u.username})`).join(', '));
    if (!done.length) return err('Không xóa được: ' + skip.join('; '));
    return { ok: true, count: done.length, skipped: skip };
  } },
  // khôi phục thành viên đã xóa (nếu email, tên truy cập, SĐT chưa bị người khác dùng)
  memberRestore: { auth: 'owner', run(c) {
    const { d } = c, arr = d.deletedUsers || [], i = arr.findIndex(x => x.id === c.args.id); if (i < 0) return err('Không tìm thấy hồ sơ đã xóa.');
    const u = arr[i], low = s => String(s || '').toLowerCase();
    const clash = d.users.find(x => (u.email && low(x.email) === low(u.email)) || (u.username && low(x.username) === low(u.username)) || (u.phone && normPhone(x.phone) === normPhone(u.phone)));
    if (clash) return err(`Không khôi phục được: ${clash.name} đang dùng email, tên truy cập hoặc số điện thoại này.`);
    arr.splice(i, 1); const back = Object.assign({}, u); delete back.deletedAt; delete back.deletedBy; delete back.cancelled;
    if (back.sponsor && !c.A.user(d, back.sponsor)) { back.sponsor = null; back.parent = null; }
    d.users.push(back); c.log('Khôi phục thành viên', `${back.name} (${back.code || ''})`);
    return { ok: true };
  } },
  // danh sách số đẹp giữ lại (không cấp tự động khi đăng ký): thêm hoặc bỏ, kèm giá và ghi chú để sau này bán
  codeReserve: { auth: 'admin', perm: 'members', run(c) {
    const { d } = c, rs = d.settings.codeReserve = d.settings.codeReserve || [];
    const list = [].concat(c.args.codes || []).map(x => str(x, 12).toUpperCase().replace(/\s/g, '')).filter(Boolean).slice(0, 200);
    if (c.args.remove) { const n = rs.length; d.settings.codeReserve = rs.filter(x => !list.includes(String(x.code || x).toUpperCase())); c.log('Bỏ giữ số đẹp', list.join(', ')); return { ok: true, removed: n - d.settings.codeReserve.length }; }
    const bad = list.filter(k => !CODE.test(k)); if (bad.length) return err('Mã chưa đúng: ' + bad.join(', ') + '. Mã gồm PS và 3 đến 9 chữ số.');
    const used = list.filter(k => codeTaken(d, k)); const have = reserved(d);
    const add = list.filter(k => !used.includes(k) && !have.includes(k)), price = Math.max(0, Math.round(+c.args.price || 0)), note = str(c.args.note, 100);
    add.forEach(k => rs.push({ code: k, price, note, at: c.today() }));
    if (add.length) c.log('Giữ số đẹp', add.join(', ') + (price ? ', giá ' + price : ''));
    return { ok: true, added: add, used };
  } },
  // quản trị kích hoạt tay tài khoản chưa bấm thư kích hoạt (một hoặc nhiều người), gửi thư chào mừng như khi tự kích hoạt
  memberVerify: { auth: 'admin', perm: 'members', run(c) {
    const ids = [].concat(c.args.ids || []).slice(0, 500), done = [];
    ids.forEach(id => { const u = c.A.user(c.d, id); if (!u || u.role === 'admin' || u.verified !== false) return;
      u.verified = true; u.verifiedAt = c.stamp() + ' (quản trị)'; done.push(u); welcomeMail(c, u); });
    if (!done.length) return err('Không có tài khoản nào đang chờ kích hoạt trong số đã chọn.');
    c.log('Kích hoạt tay', done.map(u => `${u.name} (${u.code || '@' + u.username})`).join(', '));
    return { ok: true, count: done.length };
  } },
  adminSetPass: { auth: 'admin', perm: 'members', run(c) {
    const u = c.A.user(c.d, c.args.id), p = String(c.args.pass || '');
    if (!u) return err('Không tìm thấy tài khoản.');
    if (u.role === 'admin' && !c.A.isOwner(c.me)) return err('Chỉ chủ sở hữu mới đặt lại mật khẩu tài khoản quản trị.');
    if (p.length < 6) return err('Mật khẩu cần ít nhất 6 ký tự.');
    u.pass = hashPass(p); u.passChanged = c.today(); c.store.endSessionsOf(u.id);
    c.log('Đặt lại mật khẩu', `${u.name} (@${u.username || u.email})`); return { ok: true };
  } },
  fund: { auth: 'owner', run(c) {
    if (!verifyPass(c.args.pass || '', c.me.pass)) return err('Mật khẩu xác nhận chưa đúng.');
    const r = c.A.fundAction(c.d, c.me, c.args.kind, c.args.amount, c.args.note, true); if (r.error) return r;
    c.log({ mint: 'Tạo điểm', give: 'Cấp quỹ kế toán', back: 'Thu hồi về quỹ phát hành', burn: 'Hủy điểm' }[c.args.kind] || 'Quỹ điểm', `${money(r.entry.amount).replace('đ', ' PS')}: ${r.entry.note}`);
    return r;
  } },
  botKeyGet: { auth: 'owner', run(c) { const k = c.store.getJSON('secret:bot') || {}; return { on: !!k.key, tail: k.key ? k.key.slice(-4) : '', at: k.at || '', used: k.used || '' }; } },
  botKeyNew: { auth: 'owner', run(c) {
    const key = 'psqbot_' + crypto.randomBytes(24).toString('base64url');
    c.store.setJSON('secret:bot', { key, at: c.today() }); c.log('Tạo khóa tra cứu cho An An', 'đuôi ' + key.slice(-4)); return { key };
  } },
  botKeyOff: { auth: 'owner', run(c) { c.store.setJSON('secret:bot', {}); c.log('Khóa cổng tra cứu An An', ''); return { ok: true }; } },
  mailGet: { auth: 'owner', run(c) { const m = c.store.getJSON('secret:mail') || {}; return { user: m.user || '', fromName: m.fromName || '', host: m.host || 'smtp.gmail.com', configured: !!(m.user && m.pass) }; } },
  mailSet: { auth: 'owner', run(c) {
    const cur = c.store.getJSON('secret:mail') || {}, user = str(c.args.user, 120).toLowerCase(), pass = String(c.args.pass || '').replace(/\s+/g, '');
    if (!EMAIL.test(user)) return err('Anh nhập địa chỉ Gmail gửi thư.');
    const next = { user, pass: pass || cur.pass || '', fromName: str(c.args.fromName, 80) || c.site.brand, host: str(c.args.host, 80) || 'smtp.gmail.com', port: int(c.args.port) || 465 };
    if (!next.pass) return err('Anh dán mật khẩu ứng dụng 16 ký tự của Gmail.');
    c.store.setJSON('secret:mail', next); c.log('Cấu hình email gửi thư', user); return { ok: true };
  } },
  mailTest: { auth: 'owner', async: true, async run(c) {
    const to = str(c.args.to, 120) || c.me.email;
    try { await c.sendNow(to, 'Thư thử từ ' + c.site.brand, 'Thử', wrapMail(c.site, 'Gửi thư thành công', '<p>Email gửi thư tự động của web đã hoạt động.</p>')); return { ok: true, to }; }
    catch (e) { return err(e.message); }
  } },
  notifyTest: { auth: 'owner', async: true, async run(c) {
    const r = await c.notifyNow(`Tin thử từ web ${c.site.brand}: báo đơn mới qua Telegram đã hoạt động.`);
    return r.ok ? { ok: true } : err('Chưa gửi được: ' + (r.error || 'không rõ lỗi'));
  } },
  shipRemindNow: { auth: 'admin', async: true, async run(c) {
    const r = await c.remindShip(true);
    if (r.error && !r.sent) return err('Chưa gửi được: ' + r.error);
    return { sent: r.sent, orders: r.orders || 0 };
  } },
  mailResend: { auth: 'admin', run(c) {
    const m = (c.d.mails || []).find(x => x.id === c.args.id); if (!m) return err('Không tìm thấy thư.');
    if (m.secret) return err('Thư đặt lại mật khẩu không gửi lại được, người dùng yêu cầu lại.');
    if (!m.html) return err('Thư này không còn nội dung để gửi lại.');
    c.mail(m.to, m.subject, m.type, m.html, { resendOf: m.id }); return { ok: true };
  } }
};

/* ---------- An An (bot Zalo, Messenger qua n8n) tra cứu thành viên: chỉ đọc, khóa bí mật secret:bot ----------
   Ai hỏi cũng biết: tên, cấp bậc, mã giới thiệu, ngày tham gia; đại lý uy tín đang hiện trên web thì kèm khu vực, SĐT, Zalo như trang Đại lý uy tín.
   Chỉ chính chủ (asker = SĐT của người đang chat, trùng SĐT tài khoản): điểm các ví, đơn gần đây.
   Không bao giờ trả: SĐT, email, địa chỉ, tiền của người khác. */
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const FILLER = new Set(['ho', 'ten', 'la', 'ban', 'nguoi', 'co', 'o', 'anh', 'chi', 'em', 'tham', 'gia', 'cong', 'tac', 'vien', 'dai', 'ly', 'ctv', 'gioi', 'thieu', 'cua', 'minh', 'toi', 'nhe', 'a', 'oi']);
const CALL = /^(anh|chi|em|co|chu|bac|ong|ba|di|cau|thim|mo|ban|a|c|e)\s+/;
const ORDER_ST = { pending: 'Chờ xác nhận', paid: 'Đã thanh toán', ship: 'Đang giao', done: 'Hoàn thành', failed: 'Đã hủy' };
function botLookup(d, A, dealers, q, asker, base) {
  const refLink = code => code ? String(base || '').replace(/\/$/, '') + '/thanh-vien.html?ref=' + encodeURIComponent(code) : '';
  q = str(q, 80); const me = normPhone(asker), qp = normPhone(q), qc = q.toUpperCase().replace(/\s+/g, '');
  let qf = fold(q); while (CALL.test(qf)) qf = qf.replace(CALL, '');
  const shown = (dealers || []).filter(x => x && !x.hidden && !/^dl-mau-/.test(x.id || ''));
  const dealerOf = u => shown.find(x => (x.code || '').toUpperCase() === (u.code || '').toUpperCase());
  // khớp tên theo từng chữ, không cần đúng thứ tự: "Lê Nhị" ra "Lê Thị Nhị". Không ra ai thì bỏ các chữ nói thêm (họ, tên, bạn...) rồi thử lại.
  let toks = qf.split(' ').filter(Boolean);
  const words = name => new Set(fold(name).replace(/^dai ly /, '').split(' '));
  const hit = name => { const w = words(name); return toks.length > 0 && toks.every(t => w.has(t)); };
  const pub = x => ({ name: x.name, code: x.code || '', refLink: refLink(x.code), area: x.area || '', address: x.address || '', phone: x.phone || '', zalo: x.zalo || x.phone || '', note: x.note || '' });
  if (!q) return { error: 'Thiếu nội dung cần tra (q): tên, số điện thoại hoặc mã PS.' };
  const users = d.users.filter(u => u.role !== 'admin' && u.status !== 'locked' && u.verified !== false && u.code);
  const find = () => users.filter(u => hasCode(u, qc) || (qp.length >= 9 && normPhone(u.phone) === qp) || hit(u.name));
  let found = find();
  if (!found.length) { const t2 = toks.filter(t => !FILLER.has(t)); if (t2.length && t2.length < toks.length) { toks = t2; found = find(); } }
  const results = found.slice(0, 5).map(u => {
    const dl = dealerOf(u), r = { name: u.name, code: u.code, refLink: refLink(u.code), tier: A.tierOf(u).name, since: u.created || '', trusted: !!dl, dealer: dl ? pub(dl) : null };
    if (me.length >= 9 && normPhone(u.phone) === me) {
      const b = A.balances(d, u.id);
      r.self = { phone: u.phone, email: u.email, wallets: Object.fromEntries(Object.entries(A.WALLETS).map(([k, w]) => [w.name, b[k] || 0])),
        orders: d.orders.filter(o => o.userId === u.id).slice(-5).reverse().map(o => ({ id: o.id, date: o.date, status: ORDER_ST[o.status] || o.status, total: o.total, items: (o.items || []).map(x => x.name + ' x' + x.qty).join(', ') })),
        directMembers: d.users.filter(x => x.sponsor === u.id).length };
    }
    return r;
  });
  const dl = shown.filter(x => !found.some(u => (u.code || '').toUpperCase() === (x.code || '').toUpperCase()) && (hit(x.name) || (qf && fold(x.area).includes(qf)) || (x.code && x.code.toUpperCase() === qc))).slice(0, 8).map(pub);
  return { query: q, count: found.length, results, dealers: dl,
    rule: 'Chỉ nói tên, cấp bậc, mã giới thiệu, ngày tham gia. Thông tin liên hệ chỉ nói khi có trong dealer (đại lý uy tín, đã công khai). Mục self chỉ có khi người đang chat là chính chủ. Trùng nhiều người thì hỏi thêm khu vực hoặc mã PS. Khách xác nhận đúng người giới thiệu và đồng ý thì gửi refLink của người đó để khách đăng ký. Không tự nêu con số hoa hồng, thu nhập: mời khách hỏi người giới thiệu.' };
}
// An An hỏi sản phẩm đang bán trên web: không có trong danh sách = đã ngừng bán. Không trả giá tính thưởng (thông tin nội bộ).
function botProducts(d, A, products, q, base) {
  const qf = fold(str(q, 80)), b = String(base || '').replace(/\/$/, '');
  const list = (products || []).filter(p => p.id !== A.PKG_ID && p.id !== A.AGENT_PKG_ID && p.active !== false);
  const hit = qf ? list.filter(p => (' ' + fold(p.name + ' ' + (p.partnerName || '')) + ' ').includes(' ' + qf + ' ') || fold(p.id).includes(qf)) : list;
  const out = hit.slice(0, 30).map(p => { const st = A.stockOf(d, p.id);
    return { name: p.name, price: p.price, old: p.old || null, partner: !!p.partner, partnerName: p.partnerName || '', inStock: st !== 0, stock: st, spec: p.spec || '', warranty: p.warranty || '', link: b + '/san-pham-chi-tiet.html?id=' + encodeURIComponent(p.id) }; });
  return { query: q || '', count: hit.length, total: list.length, products: out,
    rule: 'Chỉ giới thiệu sản phẩm có trong danh sách này. Sản phẩm khách hỏi mà không có ở đây thì báo đã hết hàng hoặc ngừng bán, gợi ý sản phẩm tương tự. inStock false thì báo tạm hết hàng. Bảo hành theo trường warranty của từng sản phẩm; trống thì theo chính sách chung của công ty (hàng đối tác trống thì mời khách hỏi lại, em kiểm tra). Hàng đối tác do công ty giao.' };
}
const botKeyOf = store => (store.getJSON('secret:bot') || {}).key || '';

module.exports = { botLookup, botProducts, fanList, fanWhy, fanRule, botFanpages, botKeyOf, ACTIONS, scopeFor, hashPass, verifyPass, clean, wrapMail };
