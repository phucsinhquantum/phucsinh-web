/* Tự kiểm tra code trước khi đưa lên bản chính. Không đụng dữ liệu thật, không gửi Telegram hay thư.
   Chạy: node --no-warnings server/tools/kiem-tra.js [đường dẫn bản sao psq.db]
   1. Chạy máy chủ trên thư mục tạm, dữ liệu trống, đi hết luồng thật qua API:
      đăng ký (mã công ty PS1000, mã thành viên), mua gói CTV, xác nhận đã nhận tiền, thưởng giới thiệu,
      lên đại lý khi đủ mốc, hoa hồng CTV, đại lý hưởng 40% thu nhập CTV mình tuyển,
      khách lẻ tính cho người gửi link đầu tiên, vòng quay chào mừng và mã giảm giá, quản trị xem thay và khóa tài khoản.
   2. Có bản sao dữ liệu thật: chạy máy chủ trên bản sao đó (đã bỏ cài đặt thư), xem có khởi động và đọc đủ dữ liệu không.
   Thoát mã 0 khi mọi bước đúng, mã 1 khi có bước sai (lệnh cập nhật sẽ dừng, không đưa lên). */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = process.argv[2];
let P;   // sản phẩm dùng để thử
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  đúng  ' : '  SAI   ') + msg); if (!cond) failed++; return cond; };
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

async function startServer(dataDir, fresh) {
  const port = await freePort(), out = [];
  const env = { PATH: process.env.PATH, PORT: String(port), DATA_DIR: dataDir, WEB_ROOT: ROOT, SERVE_STATIC: '0', ...(fresh ? { OWNER_EMAIL: 'chu@kiem-tra.vn', OWNER_NAME: 'Chủ kiểm tra' } : {}), BASE_URL: 'http://127.0.0.1:' + port, SITE_MODE: 'that', TZ: 'Asia/Ho_Chi_Minh' };
  const p = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', b => out.push(String(b))); p.stderr.on('data', b => out.push(String(b)));
  const log = () => out.join('');
  for (let i = 0; i < 100 && !/chạy cổng/.test(log()); i++) await new Promise(r => setTimeout(r, 100));
  return { port, proc: p, log, stop: () => p.kill() };
}

function client(port) {
  const jar = new Map(), cookie = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
  const req = async (method, url, body, form) => {
    const r = await fetch('http://127.0.0.1:' + port + url, { method, redirect: 'manual',
      headers: Object.assign({ 'x-psq': '1', cookie: cookie() }, form ? { 'content-type': 'application/x-www-form-urlencoded' } : body ? { 'content-type': 'application/json' } : {}),
      body: form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : undefined });
    for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'), i = kv.indexOf('='), k = kv.slice(0, i), v = kv.slice(i + 1); if (v && !/Max-Age=0\b/i.test(sc)) jar.set(k, v); else jar.delete(k); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { status: r.status, json: j, text: t, location: r.headers.get('location') };
  };
  return {
    req,
    act: async (name, args) => { const r = await req('POST', '/api/act', { name, args }); return r.json || { error: 'HTTP ' + r.status }; },
    boot: async () => (await req('GET', '/api/boot')).json
  };
}

// lấy đường dẫn xác nhận mới nhất trong nhật ký (khi chưa cài Telegram, máy chủ in tin ra nhật ký)
const lastConfirm = (log, n0) => { const m = log().slice(n0).match(/\/api\/confirm\?t=[\w-]+/g); return m && m[m.length - 1]; };
async function confirm(s, c, n0, what) {
  const u = lastConfirm(s.log, n0); if (!ok(!!u, what + ': có đường dẫn xác nhận đã nhận tiền')) return;
  const r = await c.req('POST', '/api/confirm', null, { t: new URL(u, 'http://x').searchParams.get('t') });
  ok(/Đã xác nhận/.test(r.text), what + ': bấm xác nhận thành công');
}

async function flow() {
  console.log('1. Luồng đăng ký, thanh toán, hoa hồng trên dữ liệu trống');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psq-kt-'));
  const s = await startServer(dir, true);
  try {
    if (!ok(/chạy cổng/.test(s.log()), 'máy chủ khởi động')) return console.log(s.log().slice(-2000));
    const guest = client(s.port);
    ok((await guest.boot()).content !== undefined, 'trang tải được dữ liệu (/api/boot)');
    const tok = (s.log().match(/dat-lai=([\w-]+)/) || [])[1];
    const owner = client(s.port);
    ok(tok && !(await owner.act('resetPass', { token: tok, pass: 'KiemTra@2026' })).error, 'chủ sở hữu đặt mật khẩu');
    ok(!(await owner.act('login', { login: 'chu@kiem-tra.vn', pass: 'KiemTra@2026' })).error, 'chủ sở hữu đăng nhập');
    const plan = Object.assign({}, ((await owner.req('GET', '/api/admin/db')).json.db.settings || {}).plan);

    const reg = async (name, user, ref) => { const c = client(s.port); const r = await c.act('register', { name, username: user, email: user + '@kiem-tra.vn', pass: '123456a', ref, agree: true }); c.me = r.me; return { c, r }; };
    const A = await reg('Đại lý A', 'kta', 'PS1000');
    ok(!A.r.error && A.r.me && !A.r.me.sponsor, 'đăng ký bằng mã công ty PS1000 được, không có tuyến trên' + (A.r.error ? ': ' + A.r.error : ''));
    const B = await reg('CTV B', 'ktb', A.r.me && A.r.me.code);
    ok(!B.r.error && B.r.me && B.r.me.sponsor === A.r.me.id, 'đăng ký bằng mã của A, B thuộc tuyến A');
    const C = await reg('Khách C', 'ktc', B.r.me && B.r.me.code);
    ok(!C.r.error && C.r.me && C.r.me.sponsor === B.r.me.id, 'C đăng ký bằng mã của B');
    ok((await guest.act('checkRef', { code: 'PS9999' })).error, 'mã giới thiệu sai bị chặn');
    ok((await client(s.port).act('register', { name: 'Trùng', username: 'kttrung', email: 'kta@kiem-tra.vn', pass: '123456a', agree: true })).error, 'email đã có tài khoản bị chặn');
    ok(!!(await client(s.port).act('login', { login: 'kta@kiem-tra.vn', pass: 'sai-mat-khau' })).error, 'sai mật khẩu không đăng nhập được');

    // A và B mua gói CTV, xác nhận đã nhận tiền
    for (const [X, nm] of [[A, 'A'], [B, 'B']]) {
      const n0 = s.log().length, r = await X.c.act('buyPackage', {});
      ok(!r.error && r.result && r.result.order, nm + ' đặt gói CTV');
      await confirm(s, owner, n0, nm + ' gói CTV');
      ok(((await X.c.boot()).me || {}).tier === 'ctv', nm + ' lên CTV sau khi xác nhận');
    }
    let db = (await owner.req('GET', '/api/admin/db')).json.db;
    const com = (u, kind) => (db.commissions || []).filter(c => c.user === u && c.kind === kind);
    ok(com(A.r.me.id, 'ref').some(c => c.amount === plan.refBonus), `A nhận thưởng giới thiệu ${plan.refBonus}đ khi B kích hoạt CTV`);

    // A mua đủ mốc lên đại lý
    const info = { name: 'Đại lý A', phone: '0912345678', address: '1 Đường Thử, Quận 1', pay: 'bank' };
    const qty = Math.ceil(plan.agentThreshold / P.price);
    let n0 = s.log().length;
    const oa = await A.c.act('placeOrder', { items: [{ id: P.id, qty }], info });
    ok(!oa.error, `A đặt đơn ${qty} x ${P.name}` + (oa.error ? ': ' + oa.error : ''));
    await confirm(s, owner, n0, 'đơn của A');
    ok(((await A.c.boot()).me || {}).tier === 'daily', 'A tự lên đại lý khi tổng mua đã thanh toán đủ mốc');

    // C mua qua CTV B: B 10%, A (đại lý tuyển B) 40% thu nhập của B
    n0 = s.log().length;
    const oc = await C.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách C', phone: '0987654321' }) });
    ok(!oc.error, 'C đặt đơn' + (oc.error ? ': ' + oc.error : ''));
    await confirm(s, owner, n0, 'đơn của C');
    db = (await owner.req('GET', '/api/admin/db')).json.db;
    const ocId = ((oc.result || {}).order || {}).id || (db.orders.find(o => o.userId === C.r.me.id) || {}).id;
    const bDirect = com(B.r.me.id, 'direct').find(c => c.order === ocId);
    const want = Math.round(P.price * plan.ctvRate / 100);
    ok(bDirect && bDirect.amount === want && bDirect.status === 'paid', `B (CTV) nhận ${plan.ctvRate}% = ${want}đ trên đơn của C` + (bDirect ? ` (thực tế ${bDirect.amount}, ${bDirect.status})` : ''));
    const aOv = com(A.r.me.id, 'override').find(c => c.order === ocId);
    const wantOv = Math.round(want * plan.overrideRate / 100);
    ok(aOv && aOv.amount === wantOv && aOv.status === 'paid', `A (đại lý) nhận ${plan.overrideRate}% thu nhập của B = ${wantOv}đ` + (aOv ? ` (thực tế ${aOv.amount}, ${aOv.status})` : ''));

    // khách lẻ bấm link của B rồi đặt hàng không tài khoản: tính cho B; lần sau vào link của A vẫn tính cho B
    const guestInfo = { name: 'Khách lẻ thử', phone: '0909111222', address: '2 Đường Thử, Quận 3', pay: 'bank' };
    n0 = s.log().length;
    const og = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: guestInfo, ref: B.r.me.code });
    ok(!og.error, 'khách lẻ đặt đơn qua link của B' + (og.error ? ': ' + og.error : ''));
    await confirm(s, owner, n0, 'đơn khách lẻ');
    n0 = s.log().length;
    const og2 = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: guestInfo, ref: A.r.me.code });
    ok(!og2.error, 'khách lẻ đó đặt lần 2 qua link của A');
    await confirm(s, owner, n0, 'đơn khách lẻ lần 2');
    db = (await owner.req('GET', '/api/admin/db')).json.db;
    const gOrders = db.orders.filter(o => !o.userId && o.phone === guestInfo.phone);
    ok(gOrders.length === 2 && gOrders.every(o => o.refBy === B.r.me.id), 'cả 2 đơn khách lẻ ghi cho B (người gửi link đầu tiên)');
    ok(gOrders.every(o => com(B.r.me.id, 'direct').some(c => c.order === o.id && c.amount === want)), `B nhận ${plan.ctvRate}% trên đơn khách lẻ`);

    // vòng quay chào mừng: C quay 1 lần, nhận mã, dùng mã khi đặt hàng
    const sp = await C.c.act('welcomeSpin', {});
    ok(!sp.error && sp.result && sp.result.prize, 'C quay vòng quay chào mừng' + (sp.error ? ': ' + sp.error : ''));
    ok(!!(await C.c.act('welcomeSpin', {})).error, 'quay lần 2 bị chặn');
    const cp = sp.result && sp.result.coupon;
    if (ok(!!cp, 'C nhận mã giảm giá ' + (cp ? cp.code : ''))) {
      ok(!!(await B.c.act('couponCheck', { code: cp.code, items: [{ id: P.id, qty: 1 }] })).error, 'người khác không dùng được mã của C');
      const ck = await C.c.act('couponCheck', { code: cp.code, items: [{ id: P.id, qty: 1 }] });
      ok(!ck.error && ck.result.discount > 0, 'mã hợp lệ, giảm ' + (ck.result || {}).discount);
      const oq = await C.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách C', phone: '0987654321' }), coupon: cp.code });
      const oo = (oq.result || {}).order || {};
      ok(!oq.error && oo.discount === ck.result.discount && oo.coupon === cp.code, 'đặt hàng trừ đúng tiền mã giảm giá' + (oq.error ? ': ' + oq.error : ''));
      ok(!!(await C.c.act('couponCheck', { code: cp.code, items: [{ id: P.id, qty: 1 }] })).error, 'mã đã dùng không dùng lại được');
    }

    // quản trị xem tài khoản C: thấy dữ liệu của C, không thao tác được, thoát ra về lại quản trị
    const im = await owner.req('POST', '/api/admin/impersonate', { id: C.r.me.id });
    ok(im.status === 200 && ((await owner.boot()).me || {}).id === C.r.me.id, 'quản trị vào xem tài khoản C');
    ok(/chỉ xem/.test((await owner.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info })).error || ''), 'đang xem thì không đặt hàng thay được');
    const lo = await owner.req('POST', '/api/logout', {});
    ok(lo.json && lo.json.back && ((await owner.boot()).me || {}).id !== C.r.me.id && (await owner.req('GET', '/api/admin/db')).status === 200, 'thoát xem, quay về tài khoản quản trị');

    // sửa thông tin và khóa tài khoản C
    const ed = await owner.act('adminEditMember', { id: C.r.me.id, name: 'Khách C sửa', email: 'ktc@kiem-tra.vn', phone: '0987654321', username: 'ktc', status: 'locked' });
    ok(!ed.error, 'quản trị sửa và khóa tài khoản C' + (ed.error ? ': ' + ed.error : ''));
    ok(!(await C.c.boot()).me, 'C bị đăng xuất khi khóa');
    ok(!!(await client(s.port).act('login', { login: 'ktc@kiem-tra.vn', pass: '123456a' })).error, 'tài khoản khóa không đăng nhập được');

    // đường dẫn kích hoạt trong thư: sai mã thì hiện trang báo, không trơ ra
    const vf = await guest.req('GET', '/api/verify?t=sai-ma');
    ok(vf.status === 200 && /Chưa kích hoạt được/.test(vf.text), 'đường dẫn kích hoạt sai hiện trang báo rõ ràng');
    ok(!/TypeError|ReferenceError|SyntaxError|\[lỗi/.test(s.log()), 'nhật ký máy chủ không có lỗi');
  } finally { s.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
}

async function seed() {
  if (!SEED) return;
  console.log('2. Khởi động trên bản sao dữ liệu thật');
  if (!ok(fs.existsSync(SEED), 'có tệp ' + SEED)) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psq-kt-'));
  fs.copyFileSync(SEED, path.join(dir, 'psq.db'));
  for (const x of ['-wal', '-shm']) if (fs.existsSync(SEED + x)) fs.copyFileSync(SEED + x, path.join(dir, 'psq.db' + x));
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dir, 'psq.db'));
  db.prepare("DELETE FROM kv WHERE k = 'secret:mail'").run();   // không gửi thư thật khi kiểm tra
  const row = db.prepare("SELECT v FROM kv WHERE k = 'db'").get(), before = row ? JSON.parse(row.v) : {};
  db.close();
  const s = await startServer(dir);
  try {
    ok(/chạy cổng/.test(s.log()), 'máy chủ khởi động với dữ liệu thật');
    const b = await client(s.port).boot();
    ok(b && b.content, 'trang tải được dữ liệu');
    await new Promise(r => setTimeout(r, 1500));
    const db2 = new DatabaseSync(path.join(dir, 'psq.db')), after = JSON.parse(db2.prepare("SELECT v FROM kv WHERE k = 'db'").get().v); db2.close();
    for (const k of ['users', 'orders', 'commissions', 'topups']) ok(((after[k] || []).length) >= ((before[k] || []).length), `không mất ${k}: ${(before[k] || []).length} -> ${(after[k] || []).length}`);
    ok(!/TypeError|ReferenceError|SyntaxError|\[lỗi/.test(s.log()), 'nhật ký máy chủ không có lỗi');
  } finally { s.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
}

(async () => {
  // sản phẩm dùng để thử: sản phẩm đang bán có giá từ 1 triệu (lấy từ js/data.js qua bộ tính toán)
  const { createEngine } = require('../engine');
  const E = createEngine({ webRoot: ROOT, content: () => null, state: () => ({}), actor: () => null });
  P = E.PRODUCTS.filter(p => p.price >= 1e6 && p.active !== false && p.id !== E.ADB.PKG_ID && p.id !== E.ADB.AGENT_PKG_ID).sort((a, b) => a.price - b.price)[0];
  try { await flow(); await seed(); }
  catch (e) { ok(false, 'lỗi khi kiểm tra: ' + (e.stack || e.message)); }
  console.log(failed ? `\nCÓ ${failed} BƯỚC SAI, KHÔNG ĐƯA LÊN.` : '\nTẤT CẢ ĐỀU ĐÚNG.');
  process.exit(failed ? 1 : 0);
})();
