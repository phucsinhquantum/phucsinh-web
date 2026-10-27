/* Tự kiểm tra code trước khi đưa lên bản chính. Không đụng dữ liệu thật, không gửi Telegram hay thư.
   Chạy: node --no-warnings server/tools/kiem-tra.js [đường dẫn bản sao psq.db]
   1. Chạy máy chủ trên thư mục tạm, dữ liệu trống, đi hết luồng thật qua API:
      đăng ký (mã công ty PS1000, mã thành viên), mua gói CTV, xác nhận đã nhận tiền, thưởng giới thiệu,
      lên đại lý khi đủ mốc, hoa hồng CTV, đại lý hưởng 40% thu nhập CTV mình tuyển.
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
  let cookie = '';
  const req = async (method, url, body, form) => {
    const r = await fetch('http://127.0.0.1:' + port + url, { method, redirect: 'manual',
      headers: Object.assign({ 'x-psq': '1', cookie }, form ? { 'content-type': 'application/x-www-form-urlencoded' } : body ? { 'content-type': 'application/json' } : {}),
      body: form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { status: r.status, json: j, text: t };
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
