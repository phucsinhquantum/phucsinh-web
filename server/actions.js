/* Các thao tác người dùng gửi lên máy chủ. Mỗi thao tác chạy trên dữ liệu gốc bằng chính bộ tính
   ADB của web, kiểm tra quyền và số liệu, rồi máy chủ lưu lại.
   auth: guest (ai cũng gọi được), member (đã đăng nhập), admin (tài khoản quản trị), owner (chủ sở hữu) */
'use strict';
const crypto = require('crypto');

const UNAME = /^[a-z0-9._]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  if (me && me.role === 'admin' && me.status !== 'locked') { const o = Object.assign({}, d); o.users = d.users.map(clean); return o; }
  const out = { v: d.v, settings: Object.assign({}, d.settings), stock: d.stock || {}, stockMin: d.stockMin, users: [], orders: [], commissions: [], wallet: [], topups: [], addresses: [], messages: [], logs: [], mails: [], fundbook: [], receipts: [], expenses: [], stores: d.stores || [], roles: [] };
  delete out.settings.fundWarn;
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
    out.wallet = (d.wallet || []).filter(w => w.user === me.id);
    out.coupons = (d.coupons || []).filter(x => x.user === me.id);
    out.topups = (d.topups || []).filter(t => t.user === me.id);
    out.addresses = (d.addresses || []).filter(a => a.user === me.id);
    out.wheel.codes = W.codes.filter(c => c.user === me.id);
    out.wheel.codes.forEach(c => { if (c.from) addU(A.user(d, c.from), ['id', 'name']); });
  }
  out.users = [...users.values()];
  return out;
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
const findRef = (d, ref) => {
  const k = String(ref || '').trim().toUpperCase(); if (!k) return null;
  const u = d.users.find(x => x.status !== 'locked' && ((x.code || '').toUpperCase() === k || (x.username || '').toUpperCase() === k));
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
    if (c.d.users.some(u => u.id !== (c.me && c.me.id) && ((u.username || '').toLowerCase() === v || (u.code || '').toLowerCase() === v))) return err('Tên truy cập này đã có người dùng.');
    return { ok: true };
  } },
  register: { auth: 'guest', run(c) {
    const { d, A, args } = c, name = str(args.name, 80), email = str(args.email, 120).toLowerCase(), phone = str(args.phone, 20), pass = String(args.pass || '');
    let username = str(args.username, 40).toLowerCase();
    if (name.length < 2 || !email || !pass) return err('Anh chị điền đủ họ tên, email và mật khẩu.');
    if (!EMAIL.test(email)) return err('Email chưa đúng định dạng.');
    if (phone && !PHONE.test(phone)) return err('Số điện thoại chưa đúng.');
    if (pass.length < 6 || pass.length > 100) return err('Mật khẩu tối thiểu 6 ký tự.');
    if (!args.agree) return err('Anh chị cần đồng ý với điều khoản.');
    if (d.users.some(x => (x.email || '').toLowerCase() === email)) return err('Email này đã có tài khoản.');
    const taken = n => d.users.some(u => (u.username || '').toLowerCase() === n || (u.code || '').toLowerCase() === n);
    if (username) { if (!UNAME.test(username)) return err('Tên truy cập dài 3 đến 30 ký tự, chỉ gồm a-z, 0-9, dấu chấm, gạch dưới.'); if (taken(username)) return err('Tên truy cập này đã có người dùng.'); }
    else { const b = email.split('@')[0].replace(/[^a-z0-9._]/g, '').slice(0, 24) || 'tv'; username = b.length < 3 ? b + 'psq' : b; let k = 1; const base = username; while (taken(username)) username = base + (++k); }
    let k = 1001 + d.users.filter(u => u.role !== 'admin').length; while (d.users.some(x => x.code === 'PS' + k)) k++;
    const u = { id: 'u' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), name, email, phone, pass: hashPass(pass), role: 'member', created: c.today(), status: 'active', code: 'PS' + k, username, tier: 'khach', placed: false, parent: null };
    const ref = str(args.ref, 40).toUpperCase();
    const found = findRef(d, ref), sp = found && !found.company ? found.user : null;
    if (!ref) return err('Anh chị cần nhập mã giới thiệu. Hãy liên hệ người giới thiệu mình để lấy mã, hoặc chọn một đại lý uy tín trong danh sách.');
    if (!found) return err('Mã giới thiệu chưa đúng, anh chị kiểm tra lại với người giới thiệu.');
    if (found && found.company) u.refCode = found.user.code;
    if (sp) { u.sponsor = sp.id; const auto = d.settings && d.settings.autoPlace; u.placed = !!auto; u.parent = auto ? sp.id : null; }
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
    const u = c.d.users.find(x => (x.email || '').toLowerCase() === k || (x.username || '').toLowerCase() === k || (x.code || '').toLowerCase() === k || (ph.length >= 9 && normPhone(x.phone) === ph));
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
    c.notify(`🧾 Khách gửi bill chuyển khoản ${what} ${o.id}\n${o.name} · ${o.phone}\nSố tiền ${money(due)}, nội dung ${o.id}\nAnh đối chiếu với tài khoản ${c.site.bank && c.site.bank.name || 'ngân hàng'} rồi bấm duyệt.`, { kind: 'order', ref: o.id, button: '✅ Duyệt đã nhận tiền' }, bill);
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
      const f = items.find(i => i.id === p.id); if (f) f.qty += qty; else items.push({ id: p.id, name: p.name, price: p.price, qty });
    }
    if (!items.length) return err('Giỏ hàng đang trống.');
    const name = str(info.name, 80), phone = normPhone(info.phone), email = str(info.email, 120), address = str(info.address, 300), pay = info.pay === 'wallet' ? 'wallet' : 'bank';
    if (name.length < 2 || !/^0\d{9}$/.test(phone) || address.length < 5) return err('Anh chị kiểm tra lại họ tên, số điện thoại và địa chỉ nhận hàng.');
    if (email && !EMAIL.test(email)) return err('Email chưa đúng định dạng.');
    const num = Math.max(1100, ...d.orders.map(o => +String(o.id).replace(/\D/g, '') || 0)) + 1;
    const o = { id: 'PSQ' + num, userId: me ? me.id : null, name, phone, email, address, note: str(info.note, 500), pay, items, total: items.reduce((s, x) => s + x.price * x.qty, 0) + (+c.site.shipFee || 0), status: 'pending', date: c.today() };
    // khách mua không đăng nhập: tính cho người giới thiệu. Số điện thoại đã là thành viên thì theo tuyến của thành viên đó;
    // số điện thoại đã từng mua qua link thì giữ người gửi link đầu tiên; còn lại theo mã link đầu tiên trình duyệt nhớ (args.ref).
    if (!me) {
      const mem = d.users.find(u => u.role !== 'admin' && phone && normPhone(u.phone) === phone);
      const kept = (d.guestRefs || {})[phone], found = findRef(d, args.ref), fromLink = found && !found.company && found.user.role !== 'admin' ? found.user.id : null;
      const sp = mem ? mem.sponsor : kept && c.A.user(d, kept) ? kept : fromLink;
      if (sp) { o.refBy = sp; if (!mem && !kept) (d.guestRefs = d.guestRefs || {})[phone] = sp; }
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
    c.notify(`Đơn hàng mới ${o.id}\n${name} · ${phone}\n${items.map(x => `${x.qty} x ${x.name}`).join('\n')}\nTổng ${money(o.total)}${o.discount ? ` (đã giảm ${money(o.discount)}, mã ${o.coupon})` : ''}${due < o.total ? `, đã trả bằng ví ${money(o.total - due)}` : ''}\n${due ? `Chờ chuyển khoản ${money(due)} (nội dung ${o.id})` : 'Đã thanh toán đủ bằng ví'}\nĐịa chỉ: ${address}`,
      due ? { kind: 'order', ref: o.id, button: '✅ Xác nhận đã nhận tiền' } : null);
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
    c.me.avatar = url; c.log('Cập nhật ảnh đại diện', '@' + c.me.username); return { ok: true };
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
    c.notify(`Đơn gói kích hoạt CTV ${o.id}\n${me.name} (@${me.username}) · ${me.phone || ''}\nSố tiền ${money(o.total)}, nội dung chuyển khoản ${o.id}`, { kind: 'order', ref: o.id, button: '✅ Xác nhận đã nhận tiền' });
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
    c.notify(`Đơn gói đại lý ${o.id}\n${me.name} (@${me.username}) · ${me.phone || ''}\nSố tiền ${money(o.total)}, nội dung chuyển khoản ${o.id}`, { kind: 'order', ref: o.id, button: '✅ Xác nhận đã nhận tiền' });
    return { order: o };
  } },
  deposit: { auth: 'member', run(c) {
    const { d, A, me } = c, a = int(c.args.amount), method = c.args.method === 'Tiền mặt tại cửa hàng' ? 'Tiền mặt tại cửa hàng' : 'Chuyển khoản';
    if (a < 10000) return err('Số tiền nạp tối thiểu 10.000đ.');
    if (a > 2e9) return err('Số tiền nạp quá lớn, anh chị liên hệ công ty.');
    const code = 'NAP ' + String(me.username || me.code || '').toUpperCase();
    const r = A.deposit(d, me, a, method, { status: 'pending', code }); if (r.error) return r;
    c.log('Yêu cầu nạp tiền', `${me.name}: ${money(a)} qua ${method}`);
    c.notify(`Yêu cầu nạp tiền ví\n${me.name} (@${me.username})\nSố tiền ${money(a)} qua ${method}${method === 'Chuyển khoản' ? `, nội dung ${code}` : ''}`, { kind: 'topup', ref: r.topup.id, button: '✅ Xác nhận đã nhận tiền' });
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

module.exports = { ACTIONS, scopeFor, hashPass, verifyPass, clean, wrapMail };
