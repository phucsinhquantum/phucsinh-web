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
let ENG; // bộ tính toán (ADB) để đối chiếu số dư, quỹ điểm
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
// ảnh bill giả (đúng đầu tệp PNG) để thử bước khách gửi bill
const BILL = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400)]).toString('base64');
// đơn chuyển khoản: lúc đặt chưa báo Telegram; khách gửi bill mới báo kèm nút xác nhận
async function confirm(s, c, n0, what, payer, id, phone) {
  ok(!lastConfirm(s.log, n0), what + ': đặt xong chưa thanh toán thì chưa báo Telegram');
  const pc = await payer.act('paidClaim', { id, phone, bill: BILL });
  ok(!pc.error, what + ': khách gửi bill' + (pc.error ? ': ' + pc.error : ''));
  const u = lastConfirm(s.log, n0); if (!ok(!!u, what + ': gửi bill xong mới báo, có đường dẫn xác nhận đã nhận tiền')) return;
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
    ok(/mã giới thiệu/.test((await client(s.port).act('register', { name: 'Không mã', username: 'ktkhongma', email: 'ktkhongma@kiem-tra.vn', pass: '123456a', agree: true })).error || ''), 'đăng ký không có mã giới thiệu bị chặn');
    ok(/gmail\.com không/.test((await client(s.port).act('register', { name: 'Gõ Nhầm', username: 'ktnham', email: 'ktnham@gmail.con', pass: '123456a', ref: 'PS1000', agree: true })).error || ''), 'email gõ nhầm tên miền (gmail.con) bị chặn, gợi ý gmail.com');
    ok((await client(s.port).act('register', { name: 'Trùng', username: 'kttrung', email: 'kta@kiem-tra.vn', pass: '123456a', agree: true })).error, 'email đã có tài khoản bị chặn');
    ok(!!(await client(s.port).act('login', { login: 'kta@kiem-tra.vn', pass: 'sai-mat-khau' })).error, 'sai mật khẩu không đăng nhập được');

    // A và B mua gói CTV, xác nhận đã nhận tiền
    for (const [X, nm] of [[A, 'A'], [B, 'B']]) {
      const n0 = s.log().length, r = await X.c.act('buyPackage', {});
      ok(!r.error && r.result && r.result.order, nm + ' đặt gói CTV');
      await confirm(s, owner, n0, nm + ' gói CTV', X.c, (r.result.order || {}).id);
      ok(((await X.c.boot()).me || {}).tier === 'ctv', nm + ' lên CTV sau khi xác nhận');
    }
    let db = (await owner.req('GET', '/api/admin/db')).json.db;
    const com = (u, kind) => (db.commissions || []).filter(c => c.user === u && c.kind === kind);
    const refAmt = Math.round(plan.pkgPrice * plan.refRate / 100), cashOf = (u, t) => (db.wallet || []).filter(w => w.user === u && w.wallet === 'cash' && w.type === t);
    ok(plan.pkgPoints === plan.pkgPrice && (db.wallet || []).some(w => w.user === B.r.me.id && w.wallet === 'shop' && w.type === 'package' && w.amount === plan.pkgPoints), `gói CTV nhận đủ ${plan.pkgPoints} PS vào ví mua hàng`);
    ok(com(A.r.me.id, 'ref').some(c => c.amount === refAmt) && cashOf(A.r.me.id, 'referral').some(w => w.amount === refAmt && w.taxable), `A nhận thưởng giới thiệu ${plan.refRate}% gói = ${refAmt}đ vào ví tiền mặt khi B kích hoạt CTV`);

    // A mua đủ mốc lên đại lý
    const info = { name: 'Đại lý A', phone: '0912345678', address: '1 Đường Thử, Quận 1', pay: 'bank' };
    const qty = Math.ceil(plan.agentThreshold / P.price);
    let n0 = s.log().length;
    const oa = await A.c.act('placeOrder', { items: [{ id: P.id, qty }], info });
    ok(!oa.error, `A đặt đơn ${qty} x ${P.name}` + (oa.error ? ': ' + oa.error : ''));
    await confirm(s, owner, n0, 'đơn của A', A.c, ((oa.result || {}).order || {}).id);
    ok(((await A.c.boot()).me || {}).tier === 'daily', 'A tự lên đại lý khi tổng mua đã thanh toán đủ mốc');

    // slide thuyết trình: tệp ở thư mục dữ liệu, chỉ CTV, đại lý, quản trị mở được
    fs.mkdirSync(path.join(dir, 'tai-lieu'), { recursive: true }); fs.writeFileSync(path.join(dir, 'tai-lieu', 'slide-thuyet-trinh.html'), '<title>SLIDE-KT</title>');
    const kl = client(s.port); await kl.act('register', { name: 'Khách Slide', username: 'ktslide', email: 'ktslide@kiem-tra.vn', pass: '123456a', ref: 'PS1000', agree: true });
    const sl = async c => { const r = await c.req('GET', '/api/tai-lieu/slide'); return r.status === 200 && /SLIDE-KT/.test(r.text); };
    ok(!(await sl(guest)) && !(await sl(kl)), 'slide thuyết trình: chưa đăng nhập và khách không mở được');
    ok(await sl(A.c) && await sl(B.c) && await sl(owner), 'slide thuyết trình: đại lý, CTV, quản trị mở được');

    // C mua qua CTV B: B 10%, A (đại lý tuyển B) 40% thu nhập của B
    n0 = s.log().length;
    const oc = await C.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách C', phone: '0987654321' }) });
    ok(!oc.error, 'C đặt đơn' + (oc.error ? ': ' + oc.error : ''));
    await confirm(s, owner, n0, 'đơn của C', C.c, ((oc.result || {}).order || {}).id);
    db = (await owner.req('GET', '/api/admin/db')).json.db;
    const ocId = ((oc.result || {}).order || {}).id || (db.orders.find(o => o.userId === C.r.me.id) || {}).id;
    const bDirect = com(B.r.me.id, 'direct').find(c => c.order === ocId);
    const want = Math.round(P.price * plan.ctvRate / 100);
    ok(bDirect && bDirect.amount === want && bDirect.status === 'paid', `B (CTV) nhận ${plan.ctvRate}% = ${want}đ trên đơn của C` + (bDirect ? ` (thực tế ${bDirect.amount}, ${bDirect.status})` : ''));
    const aOv = com(A.r.me.id, 'override').find(c => c.order === ocId);
    const wantOv = Math.round(want * plan.overrideRate / 100);
    ok(aOv && aOv.amount === wantOv && aOv.status === 'paid', `A (đại lý) nhận ${plan.overrideRate}% thu nhập của B = ${wantOv}đ` + (aOv ? ` (thực tế ${aOv.amount}, ${aOv.status})` : ''));

    // chính sách CTV 30/10: tuyến trên là CTV hưởng 10% hoa hồng bán hàng; tiêu điểm gói không tính hoa hồng lần 2; rút tiền mặt trừ thuế phần chưa chịu thuế
    {
      const D = await reg('CTV D', 'ktd', B.r.me.code), Ek = await reg('Khách E', 'kte', D.r.me && D.r.me.code);
      let n1 = s.log().length; const rd = await D.c.act('buyPackage', {});
      await confirm(s, owner, n1, 'D gói CTV', D.c, ((rd.result || {}).order || {}).id);
      ok(((await D.c.boot()).me || {}).tier === 'ctv', 'D lên CTV ngay khi gói được xác nhận, chưa cần mua hàng');
      n1 = s.log().length; const oe = await Ek.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách E', phone: '0987650001' }) });
      const oeId = ((oe.result || {}).order || {}).id; await confirm(s, owner, n1, 'đơn của E', Ek.c, oeId);
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const dDir = com(D.r.me.id, 'direct').find(c => c.order === oeId), bOv = com(B.r.me.id, 'override').find(c => c.order === oeId && c.ctv);
      ok(dDir && bOv && bOv.amount === Math.round(dDir.amount * plan.ctvOverRate / 100) && bOv.status === 'paid' && cashOf(B.r.me.id, 'override').some(w => w.amount === bOv.amount && w.taxable), `B (CTV) nhận ${plan.ctvOverRate}% hoa hồng bán hàng của D = ${bOv ? bOv.amount : '?'}đ vào ví tiền mặt`);
      ok(!com(A.r.me.id, 'override').some(c => c.order === oeId), 'thu nhập CTV 10% chỉ 1 tầng, không tính tiếp lên đại lý A');
      // D tiêu 686.000 PS của gói vào đơn: B chỉ nhận hoa hồng trên phần trả thêm
      n1 = s.log().length; const od = await D.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'CTV D', phone: '0987650002' }), useShop: plan.pkgPoints });
      const odId = ((od.result || {}).order || {}).id; ok(!od.error, 'D đặt đơn dùng điểm gói' + (od.error ? ': ' + od.error : ''));
      await confirm(s, owner, n1, 'đơn của D', D.c, odId);
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const odO = db.orders.find(o => o.id === odId) || {}, bD = com(B.r.me.id, 'direct').find(c => c.order === odId), wantD = Math.round(Math.round(P.price * (P.price - plan.pkgPoints) / P.price) * plan.ctvRate / 100);
      ok(odO.pkgPaid === plan.pkgPoints && bD && bD.amount === wantD, `đơn trả bằng điểm gói: B chỉ nhận ${plan.ctvRate}% phần trả thêm = ${wantD}đ (thực tế ${bD ? bD.amount : 'không có'})`);
      // gói do quản trị cấp: lên CTV, không có thưởng giới thiệu
      const G = await reg('CTV cấp G', 'ktg', B.r.me.code);
      ok(!(await owner.act('ctvGrant', { id: G.r.me.id, note: 'Thử cấp' })).error && ((await G.c.boot()).me || {}).tier === 'ctv', 'chủ sở hữu cấp gói CTV: lên CTV ngay');
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      ok(!com(B.r.me.id, 'ref').some(c => c.from === G.r.me.id), 'gói CTV do quản trị cấp không trả thưởng giới thiệu');
      // rút tiền mặt: thuế chỉ trên phần chưa chịu thuế (thưởng giới thiệu, thu nhập CTV); tiền từ ví hoa hồng đã trừ thuế
      const bb = ENG.ADB.balances(db, B.r.me.id); if (bb.sales > 0) await B.c.act('wallet', { kind: 'tocash', amount: bb.sales });
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const cash = ENG.ADB.balances(db, B.r.me.id).cash, taxable = (db.wallet || []).filter(w => w.user === B.r.me.id && w.wallet === 'cash' && w.taxable).reduce((x, w) => x + w.amount, 0);
      n1 = s.log().length; const rw0 = await B.c.act('wallet', { kind: 'withdraw', amount: cash, bank: 'Ngân hàng Thử', account: '0123 CTV B' }), rw = Object.assign({}, rw0.result, rw0);
      const wantTax = Math.round(taxable * plan.taxRate / 100);
      ok(!rw.error && rw.tax === wantTax && rw.net === cash - wantTax, `rút ${cash}đ tiền mặt: thuế ${plan.taxRate}% trên ${taxable}đ chưa chịu thuế = ${wantTax}đ, chuyển khoản ${cash - wantTax}đ` + (rw.error ? ': ' + rw.error : ` (thực tế thuế ${rw.tax})`));
      ok(new RegExp('Khách rút: ' + cash.toLocaleString('vi-VN') + 'đ[\\s\\S]*Trừ thuế[\\s\\S]*Công ty chuyển khoản: ' + (cash - wantTax).toLocaleString('vi-VN') + 'đ').test(s.log().slice(n1)), 'tin báo rút tiền ghi rõ số khách rút, thuế, số công ty chuyển khoản');
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const wd = db.wallet.find(w => w.user === B.r.me.id && w.type === 'withdraw' && w.status === 'pending');
      if (wd) { wd.status = 'done'; const f = ENG.ADB.fund(db); ok(!f.diff && f.thue >= wantTax, 'quỹ điểm cân đối sau khi duyệt rút, thuế giữ lại ghi vào dòng thuế' + (f.diff ? ' (lệch ' + f.diff + ')' : '')); }
    }

    // giá tính thưởng (PS) riêng cho hàng đối tác: hoa hồng tính trên PS, đơn giữ PS lúc đặt
    {
      const Q = { id: 'kt-doi-tac', cat: P.cat, name: 'Hàng đối tác thử', price: 10000000, ps: 8000000, partner: true, partnerName: 'Đối tác thử', art: 'box' };
      ok(!(await owner.req('POST', '/api/admin/content', { key: 'psq_products_v1', value: { edits: [Q], hidden: [] } })).json.error, 'quản trị thêm hàng đối tác 10.000.000đ tính 8.000.000 PS');
      n0 = s.log().length;
      const oq = await C.c.act('placeOrder', { items: [{ id: Q.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách C', phone: '0987654321' }) });
      const oqId = ((oq.result || {}).order || {}).id;
      ok(!oq.error && oqId, 'C đặt hàng đối tác' + (oq.error ? ': ' + oq.error : ''));
      await confirm(s, owner, n0, 'đơn hàng đối tác của C', C.c, oqId);
      await owner.req('POST', '/api/admin/content', { key: 'psq_products_v1', value: { edits: [Object.assign({}, Q, { ps: 1000000 })], hidden: [] } });
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const oqo = db.orders.find(o => o.id === oqId) || {}, bq = com(B.r.me.id, 'direct').find(c => c.order === oqId), aq = com(A.r.me.id, 'override').find(c => c.order === oqId);
      ok((oqo.items || [])[0] && oqo.items[0].ps === 8000000 && oqo.total >= 10000000, 'đơn ghi lại 8.000.000 PS lúc đặt, khách trả 10.000.000đ');
      ok(bq && bq.amount === 800000, 'CTV B nhận 10% của 8.000.000 PS = 800.000đ' + (bq ? ` (thực tế ${bq.amount})` : ''));
      ok(aq && aq.amount === 320000, 'đại lý A nhận 40% của 800.000đ = 320.000đ' + (aq ? ` (thực tế ${aq.amount})` : ''));
      const bp = async q => (await (await fetch(`http://127.0.0.1:${s.port}/api/bot/products?q=${encodeURIComponent(q)}`, { headers: { 'x-bot-key': (await owner.act('botKeyNew', {})).result.key } })).json());
      const p1 = await bp('đối tác thử'); ok(p1.count === 1 && p1.products[0].partner && !('ps' in p1.products[0]) && /san-pham-chi-tiet/.test(p1.products[0].link), 'An An tra được hàng đối tác đang bán, không lộ giá tính thưởng');
      await owner.req('POST', '/api/admin/content', { key: 'psq_products_v1', value: null });
      ok((await bp('đối tác thử')).count === 0, 'An An: sản phẩm gỡ khỏi web thì không còn trong danh sách');
    }

    // khách lẻ bấm link của B rồi đặt hàng không tài khoản: tính cho B; lần sau vào link của A vẫn tính cho B
    const guestInfo = { name: 'Khách lẻ thử', phone: '0909111222', address: '2 Đường Thử, Quận 3', pay: 'bank' };
    n0 = s.log().length;
    const og = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: guestInfo, ref: B.r.me.code });
    ok(!og.error, 'khách lẻ đặt đơn qua link của B' + (og.error ? ': ' + og.error : ''));
    await confirm(s, owner, n0, 'đơn khách lẻ', guest, ((og.result || {}).order || {}).id, guestInfo.phone);
    n0 = s.log().length;
    const og2 = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: guestInfo, ref: A.r.me.code });
    ok(!og2.error, 'khách lẻ đó đặt lần 2 qua link của A');
    await confirm(s, owner, n0, 'đơn khách lẻ lần 2', guest, ((og2.result || {}).order || {}).id, guestInfo.phone);
    db = (await owner.req('GET', '/api/admin/db')).json.db;
    const gOrders = db.orders.filter(o => !o.userId && o.phone === guestInfo.phone);
    ok(gOrders.length === 2 && gOrders.every(o => o.refBy === B.r.me.id), 'cả 2 đơn khách lẻ ghi cho B (người gửi link đầu tiên)');
    ok(gOrders.every(o => com(B.r.me.id, 'direct').some(c => c.order === o.id && c.amount === want)), `B nhận ${plan.ctvRate}% trên đơn khách lẻ`);
    const bBoot = (await B.c.boot()).db, bg = (bBoot.guests || []).find(g => g.phone === guestInfo.phone);
    ok(bg && bg.orders.length === 2 && !('address' in bg.orders[0]), 'B thấy khách lẻ của mình (2 đơn, có SĐT, không có địa chỉ nhà) để gọi chăm sóc');
    ok(!((await A.c.boot()).db.guests || []).some(g => g.phone === guestInfo.phone), 'A không thấy khách lẻ của B');
    ok(db.users.filter(u => u.role !== 'admin').every(u => u.placed) && db.users.find(u => u.id === B.r.me.id).parent === A.r.me.id, 'thành viên đăng ký tự lên cây ngay dưới người giới thiệu');
    const bw = ((await B.c.boot()).db.wallet || []).find(w => w.ref === gOrders[0].id && w.type === 'commission');
    ok(bw && bw.info && /Khách lẻ thử/.test(bw.info.buyer), 'lịch sử ví của B ghi rõ người mua (khách lẻ)');
    const aw = ((await A.c.boot()).db.wallet || []).find(w => w.ref === ocId && w.type === 'override');
    ok(aw && aw.info && /Khách C/.test(aw.info.buyer) && /CTV B/.test(aw.info.via), 'lịch sử ví của A ghi người mua C, qua CTV B' + (aw && aw.info ? ` (${aw.info.buyer} · ${aw.info.via})` : ''));

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

    // chương trình khuyến mãi kèm mã: khách lẻ dùng được 1 lần, công khai ở trang, mỗi đơn 1 mã
    const pr = { id: 'kmkt', title: 'Khuyến mãi thử', active: true, start: '2020-01-01', end: '', code: 'KMTHU', type: 'pct', value: 10, maxOff: 0, minOrder: 0, limit: 0, used: 0, uses: [] };
    const pp = await owner.req('POST', '/api/admin/patch', { patch: { $o: { promos: { $v: [pr] } } } });
    ok(pp.status === 200 && ((await guest.boot()).db.promos || []).some(x => x.code === 'KMTHU' && !x.uses), 'quản trị đăng chương trình khuyến mãi, trang công khai thấy (không lộ người dùng mã)');
    const gk = client(s.port), gInfo = { name: 'Khách khuyến mãi', phone: '0908777666', address: '3 Đường Thử, Quận 5', pay: 'bank' };
    const gck = await gk.act('couponCheck', { code: 'kmthu', phone: gInfo.phone, items: [{ id: P.id, qty: 1 }] });
    ok(!gck.error && gck.result.discount === Math.round(P.price * 0.1), 'khách lẻ kiểm tra mã khuyến mãi được giảm 10%' + (gck.error ? ': ' + gck.error : ''));
    const gq = await gk.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: gInfo, coupon: 'KMTHU' });
    ok(!gq.error && ((gq.result || {}).order || {}).discount === Math.round(P.price * 0.1), 'khách lẻ đặt hàng có mã khuyến mãi' + (gq.error ? ': ' + gq.error : ''));
    ok(/đã dùng mã này/.test((await client(s.port).act('couponCheck', { code: 'KMTHU', phone: gInfo.phone, items: [{ id: P.id, qty: 1 }] })).error || ''), 'cùng số điện thoại không dùng mã lần 2');

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
    // thành viên đặt hàng khi chưa đăng nhập (vd chưa kích hoạt email): đơn tự gắn vào tài khoản trùng SĐT, tính doanh số, lên đại lý, người giới thiệu có hoa hồng
    const T = client(s.port), tr = await T.act('register', { name: 'Thành Viên Quên Đăng Nhập', username: 'ktquen', email: 'ktquen@kiem-tra.vn', phone: '0977000111', pass: '123456a', ref: B.r.me.code, agree: true });
    ok(!tr.error, 'thêm thành viên có SĐT 0977000111, người giới thiệu B');
    const qty2 = Math.ceil(plan.agentThreshold / P.price), tInfo = { name: 'Thành Viên Quên Đăng Nhập', phone: '0977 000 111', address: '9 Đường Thử, Quận 1', pay: 'bank' };
    n0 = s.log().length;
    const ot = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: qty2 }], info: tInfo });
    ok(!ot.error, `đặt ${qty2} sản phẩm không đăng nhập, cùng SĐT thành viên` + (ot.error ? ': ' + ot.error : ''));
    const otId = ((ot.result || {}).order || {}).id;
    await confirm(s, owner, n0, 'đơn chưa đăng nhập', guest, otId, '0977000111');
    db = (await owner.req('GET', '/api/admin/db')).json.db;
    const tu = db.users.find(u => u.username === 'ktquen'), tOrd = db.orders.find(o => o.id === otId);
    ok(tOrd && tOrd.userId === (tu || {}).id, 'đơn tự gắn vào tài khoản trùng số điện thoại');
    ok(tu && tu.tier === 'daily', 'thành viên lên đại lý nhờ đơn đặt khi chưa đăng nhập');
    ok((db.commissions || []).some(c => c.order === otId && c.user === B.r.me.id && c.kind === 'direct' && c.amount > 0), 'người giới thiệu (B) nhận hoa hồng đơn đó');
    // An An tra cứu thành viên: có khóa mới tra được, người lạ không thấy SĐT, email, ví; chính chủ (SĐT trùng) thấy ví và đơn
    const bot = async (q, key, asker) => { const r = await fetch(`http://127.0.0.1:${s.port}/api/bot/lookup?q=${encodeURIComponent(q)}${asker ? '&asker=' + encodeURIComponent(asker) : ''}`, { headers: key ? { 'x-bot-key': key } : {} }); return { status: r.status, j: await r.json() }; };
    ok((await bot('CTV B')).status === 401, 'An An: chưa có khóa thì không tra được');
    const bk = (await owner.act('botKeyNew', {})).result || {};
    ok(/^psqbot_/.test(bk.key || ''), 'An An: chủ sở hữu tạo khóa tra cứu');
    ok(!!(await B.c.act('botKeyNew', {})).error, 'An An: thành viên thường không tạo được khóa');
    ok((await bot('CTV B', bk.key + 'x')).status === 401, 'An An: khóa sai bị chặn');
    const hb = await bot('CTV B', bk.key), rb = (hb.j.results || [])[0];
    ok(hb.status === 200 && rb && rb.code === B.r.me.code && rb.tier === 'Cộng tác viên', 'An An: tra theo tên ra đúng B, cấp Cộng tác viên');
    ok(!/@kiem-tra\.vn|"phone"|"email"|"self"/.test(JSON.stringify(hb.j)), 'An An: người lạ hỏi không thấy email, SĐT, ví của thành viên');
    ok(((await bot(B.r.me.code, bk.key)).j.results || []).length === 1, 'An An: tra theo mã PS được');
    ok(rb && rb.refLink === `http://127.0.0.1:${s.port}/thanh-vien.html?ref=${B.r.me.code}`, 'An An: có link giới thiệu của người được tra để gửi khách đăng ký');
    const H = client(s.port), hr = await H.act('register', { name: 'Nguyễn Văn Hà', username: 'ktha', email: 'ktha@kiem-tra.vn', phone: '0912345678', pass: '123456a', ref: A.r.me.code, agree: true });
    ok(!hr.error, 'An An: thêm thành viên Nguyễn Văn Hà' + (hr.error ? ': ' + hr.error : ''));
    const h1 = await bot('anh Hà', bk.key, '0900000000'), r1 = (h1.j.results || [])[0];
    ok(r1 && r1.name === 'Nguyễn Văn Hà' && !r1.self, 'An An: "anh Hà" (có xưng hô) ra đúng người, người lạ không có mục chính chủ');
    ok((((await bot('bạn Hà họ Nguyễn', bk.key)).j.results || [])[0] || {}).name === 'Nguyễn Văn Hà', 'An An: nhớ họ và tên không liền nhau (bạn Hà họ Nguyễn) vẫn ra đúng người');
    const r2 = ((await bot('ha', bk.key, '+84 912 345 678')).j.results || [])[0];
    ok(r2 && r2.self && r2.self.wallets && Array.isArray(r2.self.orders), 'An An: chính chủ (SĐT trùng) xem được ví và đơn của mình');
    // số đẹp: giữ PS8888 trong kho, cấp cho B; mã cũ của B vẫn dùng được, không ai lấy được nữa
    const oldB = B.r.me.code;
    ok(((await owner.act('codeReserve', { codes: ['PS8888', oldB], price: 5000000 })).result || {}).used.includes(oldB), 'kho số đẹp: không giữ được số đã có người dùng');
    ok(!!(await B.c.act('memberCode', { id: B.r.me.id, code: 'PS9999' })).error, 'thành viên thường không tự đổi mã được');
    ok(!!(await owner.act('memberCode', { id: B.r.me.id, code: A.r.me.code })).error, 'không đổi sang mã của người khác');
    ok(!(await owner.act('memberCode', { id: B.r.me.id, code: 'PS8888' })).error, 'chủ sở hữu đổi mã của B sang số đẹp PS8888');
    let dbc = (await owner.req('GET', '/api/admin/db')).json.db, Bu = dbc.users.find(u => u.id === B.r.me.id);
    ok(Bu.code === 'PS8888' && (Bu.oldCodes || []).includes(oldB) && !(dbc.settings.codeReserve || []).some(x => x.code === 'PS8888'), 'B mang mã PS8888, giữ mã cũ ' + oldB + ', số rời khỏi kho');
    ok(((await guest.act('checkRef', { code: oldB })).result || {}).name === 'CTV B', 'link giới thiệu bằng mã cũ vẫn ra B');
    ok((((await bot('PS8888', bk.key)).j.results || [])[0] || {}).code === 'PS8888' && (((await bot(oldB, bk.key)).j.results || [])[0] || {}).code === 'PS8888', 'An An tra mã mới hoặc mã cũ đều ra B');
    ok(!(await client(s.port).act('login', { login: oldB, pass: '123456a' })).error, 'B đăng nhập bằng mã cũ được');
    // đổi người giới thiệu: C từ B sang A; không cho A về dưới C (vòng)
    const cyc = await owner.act('memberSponsor', { id: A.r.me.id, code: 'PS8888' }); ok(/tuyến dưới/.test(cyc.error || ''), 'không chuyển được người lên dưới chính tuyến dưới của mình ' + JSON.stringify(cyc).slice(0, 120));
    ok(!(await owner.act('memberSponsor', { id: C.r.me.id, code: A.r.me.code })).error, 'chuyển C sang người giới thiệu A');
    dbc = (await owner.req('GET', '/api/admin/db')).json.db;
    const Cu = dbc.users.find(u => u.id === C.r.me.id);
    ok(Cu.sponsor === A.r.me.id && Cu.parent === A.r.me.id && com(B.r.me.id, 'direct').length > 0, 'C thuộc tuyến A trên cây, hoa hồng cũ của B giữ nguyên');
    await owner.act('memberSponsor', { id: C.r.me.id, code: 'PS8888' });
    // ảnh tải lên trong quản trị lưu thành tệp, dữ liệu trang chỉ giữ đường dẫn
    {
      const png = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'img', 'icon-32.png')).toString('base64').padEnd(0);
      await owner.req('POST', '/api/admin/content', { key: 'psq_reviews_v1', value: [{ id: 'kt', name: 'Ảnh thử', photo: png, text: 'x <img src="' + png + '">' }] });
      const bt = await guest.req('GET', '/api/boot'), rv = ((bt.json.content || {}).psq_reviews_v1 || [])[0] || {};
      ok(/^\/api\/media\/[a-f0-9]{24}\.png$/.test(rv.photo || '') && !/base64/.test(JSON.stringify(bt.json)), 'ảnh base64 thành tệp /api/media, dữ liệu trang không còn base64');
      const im = await fetch(`http://127.0.0.1:${s.port}${rv.photo}`);
      ok(im.status === 200 && im.headers.get('content-type') === 'image/png', 'mở được ảnh đã lưu');
      ok(/gzip/.test((await fetch(`http://127.0.0.1:${s.port}/api/boot`, { headers: { 'accept-encoding': 'gzip' } })).headers.get('content-encoding') || ''), 'dữ liệu trả về được nén');
      await owner.req('POST', '/api/admin/content', { key: 'psq_reviews_v1', value: null });
    }
    // xóa thành viên: chỉ người chưa có tuyến dưới, chưa phát sinh tiền; mã không cấp lại; khôi phục được
    {
      const X = client(s.port), xr = await X.act('register', { name: 'Đăng Ký Nhầm', username: 'ktnham2', email: 'ktnham2@kiem-tra.vn', pass: '123456a', ref: A.r.me.code, agree: true });
      const xid = (xr.me || xr.result && xr.result.user || {}).id || ((await owner.req('GET', '/api/admin/db')).json.db.users.find(u => u.username === 'ktnham2') || {}).id;
      ok(/Mật khẩu/.test((await owner.act('memberDelete', { ids: [xid], pass: 'sai' })).error || ''), 'xóa thành viên phải nhập đúng mật khẩu chủ sở hữu');
      ok(/tuyến dưới/.test((await owner.act('memberDelete', { ids: [A.r.me.id], pass: 'KiemTra@2026' })).error || ''), 'không xóa được người đã có tuyến dưới');
      ok(!!(await B.c.act('memberDelete', { ids: [xid], pass: '123456a' })).error, 'thành viên thường không xóa được ai');
      ok(!(await owner.act('memberDelete', { ids: [xid], pass: 'KiemTra@2026' })).error, 'chủ sở hữu xóa được người đăng ký nhầm');
      let dx = (await owner.req('GET', '/api/admin/db')).json.db; const gone = (dx.deletedUsers || []).find(u => u.id === xid) || {};
      ok(!dx.users.some(u => u.id === xid) && gone.code && !gone.pass, 'người bị xóa vào mục Đã xóa, không lộ mật khẩu');
      ok((((await owner.act('codeReserve', { codes: [gone.code] })).result || {}).used || []).includes(gone.code), 'mã của người đã xóa không cấp lại');
      ok(!(await owner.act('memberRestore', { id: xid })).error && (await owner.req('GET', '/api/admin/db')).json.db.users.some(u => u.id === xid), 'khôi phục được người đã xóa');
    }
    // đơn sót, fanpage thành viên, ảnh đại lý uy tín theo ảnh tài khoản
    {
      const so = await owner.act('staleOrders', { auto: false });
      ok(Array.isArray((so.result || {}).list) && so.result.auto === false, 'đơn sót: quản trị xem được danh sách, tắt được tự quét');
      ok((await owner.act('staleOrders', { auto: true })).result.auto === true, 'đơn sót: bật lại tự quét');
      ok(!!(await B.c.act('staleOrders', {})).error, 'thành viên thường không xem được đơn sót');
      ok(/Link chưa đúng/.test((await B.c.act('fanSet', { links: ['https://trang-la.vn/abc'] })).error || ''), 'fanpage: không nhận link lạ');
      ok(/Link chưa đúng/.test((await B.c.act('fanSet', { links: ['javascript:alert(1)'] })).error || ''), 'fanpage: không nhận link javascript');
      ok(!(await B.c.act('fanSet', { title: 'Trang B', links: ['https://www.facebook.com/trang.b', 'https://www.tiktok.com/@trangb'] })).error, 'fanpage: thành viên gửi link');
      const fl = async () => (await owner.act('fanAdmin', { op: 'list' })).result;
      let FL = await fl(); const fpB = FL.pages.find(f => f.url === 'https://www.facebook.com/trang.b') || {};
      ok(fpB.status === 'pending' && fpB.why === 'Chờ duyệt', 'fanpage thành viên gửi vào danh sách chờ duyệt');
      ok(!((await guest.boot()).fans || []).length, 'fanpage chưa duyệt thì chưa hiện trên trang chủ');
      ok(!!(await B.c.act('fanAdmin', { id: fpB.id, status: 'ok' })).error, 'thành viên thường không tự duyệt fanpage');
      await owner.act('fanAdmin', { id: fpB.id, status: 'ok' });
      ok(((await fl()).pages.find(f => f.id === fpB.id) || {}).why === 'Chưa có trong danh sách An An quản lý', 'mặc định chỉ hiện fanpage An An quản lý');
      ok(!((await guest.boot()).fans || []).length, 'đã duyệt nhưng An An chưa quản lý thì chưa hiện');
      const bk2 = (await owner.act('botKeyNew', {})).result.key, bCode2 = ((await B.c.boot()).me || {}).code;
      const push = async pages => (await fetch(`http://127.0.0.1:${s.port}/api/bot/fanpages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bot-key': bk2 }, body: JSON.stringify({ pages }) })).json();
      let pr = await push([{ pageId: '1001', name: 'Trang B', url: 'https://facebook.com/trang.b/', code: bCode2, today: 0, d7: 3 }, { pageId: '1002', name: 'Trang mới An An', code: bCode2, today: 1, d7: 9 }]);
      ok(pr.updated === 1 && pr.added === 1, 'An An gửi danh sách fanpage: khớp trang đã có, thêm trang mới');
      FL = await fl(); ok(/3\/5 bài/.test((FL.pages.find(f => f.id === fpB.id) || {}).why || ''), 'chưa đủ 5 bài trong 7 ngày thì chưa hiện, ghi rõ lý do');
      let gf = (await guest.boot()).fans || [];
      ok(gf.length === 1 && gf[0].links.length === 1 && gf[0].d7 === 9 && !gf[0].phone, 'trang đủ bài (9/7 ngày) hiện trên trang chủ, không lộ SĐT');
      await owner.act('fanAdmin', { op: 'rule', managed: true, posts: 1, days: 1 });
      ok(!((await guest.boot()).fans || [])[0] || ((await guest.boot()).fans[0].links.length === 1), 'điều kiện 1 bài/ngày: trang hôm nay chưa đăng thì ẩn');
      await owner.act('fanAdmin', { id: fpB.id, always: true });
      ok((((await guest.boot()).fans || [])[0] || {}).links.length === 2, 'bật Luôn hiện thì bỏ qua điều kiện');
      await owner.act('fanAdmin', { op: 'rule', managed: true, posts: 5, days: 7 });
      ok(!!(await owner.act('fanAdmin', { url: 'https://trang-la.vn/x', code: bCode2 })).error, 'quản trị thêm tay: không nhận link lạ');
      ok(!(await owner.act('fanAdmin', { url: 'https://www.tiktok.com/@congty', code: bCode2, always: true })).error, 'quản trị thêm tay fanpage, gắn thành viên');
      ok(((await (await fetch(`http://127.0.0.1:${s.port}/api/bot/fanpages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bot-key': 'sai' }, body: '{}' })).status)) === 401, 'cổng fanpage An An: khóa sai bị chặn');
      ok(!(await owner.act('fanAdmin', { url: 'https://www.facebook.com/phucsinhcongty', title: 'Phúc Sinh QuanTum', always: true })).error && ((await guest.boot()).fans || []).some(x => x.tier === 'company'), 'trang công ty bật Luôn hiện thì hiện, không cần gắn thành viên');
      await owner.act('fanAdmin', { id: fpB.id, status: 'off' });
      ok(!((await guest.boot()).fans || []).some(x => x.links.some(l => l.url === fpB.url)), 'fanpage bị ẩn thì không hiện');
      const myF = (await B.c.boot()).db.fanpages || []; ok(myF.length === 4 && myF.every(f => typeof f.why === 'string'), 'thành viên xem được fanpage của mình và lý do' + (myF.length === 4 ? '' : ' (' + myF.length + ')'));
      const AV = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]).toString('base64');
      await B.c.act('avatar', { url: AV });
      const bAv = ((await B.c.boot()).me || {}).avatar, bCode = ((await B.c.boot()).me || {}).code;
      await owner.req('POST', '/api/admin/content', { key: 'psq_dealers_v1', value: [{ id: 'dl1', code: bCode, name: 'Đại lý B', photo: '' }, { id: 'dl2', code: bCode, name: 'Ảnh riêng', photo: '/img/rieng.jpg', photoOwn: true }] });
      const dls = (await guest.boot()).content.psq_dealers_v1 || [];
      ok(bAv && dls[0].photo === bAv, 'đại lý uy tín chưa có ảnh lấy ảnh đại diện hiện tại của thành viên');
      ok(dls[1].photo === '/img/rieng.jpg', 'ảnh đại lý quản trị tự tải lên được giữ');
      await owner.req('POST', '/api/admin/content', { key: 'psq_dealers_v1', value: null });
    }
    await owner.act('botKeyOff', {});
    ok((await bot('CTV B', bk.key)).status === 401, 'An An: khóa cổng xong thì khóa cũ hết dùng được');
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
  const E = ENG = createEngine({ webRoot: ROOT, content: () => null, state: () => ({}), actor: () => null });
  P = E.PRODUCTS.filter(p => p.price >= 1e6 && p.active !== false && p.id !== E.ADB.PKG_ID && p.id !== E.ADB.AGENT_PKG_ID).sort((a, b) => a.price - b.price)[0];
  ok(!(E.sandbox.DEALERS || []).length, 'không còn đại lý mẫu (mã mẫu đã trùng thành viên thật)');
  try { await flow(); await seed(); }
  catch (e) { ok(false, 'lỗi khi kiểm tra: ' + (e.stack || e.message)); }
  console.log(failed ? `\nCÓ ${failed} BƯỚC SAI, KHÔNG ĐƯA LÊN.` : '\nTẤT CẢ ĐỀU ĐÚNG.');
  process.exit(failed ? 1 : 0);
})();
