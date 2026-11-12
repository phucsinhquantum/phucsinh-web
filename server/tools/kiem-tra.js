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
let PH = 90000000; const ph = () => '09' + (PH++);
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

    const reg = async (name, user, ref) => { const c = client(s.port); const r = await c.act('register', { name, username: user, phone: ph(), email: user + '@kiem-tra.vn', pass: '123456a', ref, agree: true }); c.me = r.me; return { c, r }; };
    const A = await reg('Đại lý A', 'kta', 'PS1000');
    ok(!A.r.error && A.r.me && !A.r.me.sponsor, 'đăng ký bằng mã công ty PS1000 được, không có tuyến trên' + (A.r.error ? ': ' + A.r.error : ''));
    const B = await reg('CTV B', 'ktb', A.r.me && A.r.me.code);
    ok(!B.r.error && B.r.me && B.r.me.sponsor === A.r.me.id, 'đăng ký bằng mã của A, B thuộc tuyến A');
    const C = await reg('Khách C', 'ktc', B.r.me && B.r.me.code);
    ok(!C.r.error && C.r.me && C.r.me.sponsor === B.r.me.id, 'C đăng ký bằng mã của B');
    ok((await guest.act('checkRef', { code: 'PS9999' })).error, 'mã giới thiệu sai bị chặn');
    ok(/mã giới thiệu/.test((await client(s.port).act('register', { name: 'Không mã', username: 'ktkhongma', phone: ph(), email: 'ktkhongma@kiem-tra.vn', pass: '123456a', agree: true })).error || ''), 'đăng ký không có mã giới thiệu bị chặn');
    ok(/gmail\.com không/.test((await client(s.port).act('register', { name: 'Gõ Nhầm', username: 'ktnham', email: 'ktnham@gmail.con', pass: '123456a', ref: 'PS1000', agree: true })).error || ''), 'email gõ nhầm tên miền (gmail.con) bị chặn, gợi ý gmail.com');
    ok((await client(s.port).act('register', { name: 'Trùng', username: 'kttrung', email: 'kta@kiem-tra.vn', pass: '123456a', agree: true })).error, 'email đã có tài khoản bị chặn');
    ok(!!(await client(s.port).act('login', { login: 'kta@kiem-tra.vn', pass: 'sai-mat-khau' })).error, 'sai mật khẩu không đăng nhập được');

    // A và B mua gói CTV, xác nhận đã nhận tiền
    for (const [X, nm] of [[A, 'A'], [B, 'B']]) {
      const n0 = s.log().length, r = await X.c.act('buyPackage', {});
      ok(!r.error && r.result && r.result.order, nm + ' đặt gói CTV');
      await confirm(s, owner, n0, nm + ' gói CTV', X.c, (r.result.order || {}).id);
      ok(((await X.c.boot()).me || {}).tier === 'khach', nm + ' đóng gói xong chưa lên CTV, điểm vào ví mua hàng');
    }
    // đơn hàng đầu tiên (trả bằng điểm gói, phần còn lại chuyển khoản) được thanh toán thì mới lên CTV
    const first = async (X, nm, phone) => {
      const n = s.log().length, r = await X.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: { name: 'Thành viên ' + nm, phone, address: '1 Đường Thử, Quận 1', pay: 'bank' }, useShop: plan.pkgPoints });
      ok(!r.error, nm + ' đặt đơn đầu tiên bằng điểm gói' + (r.error ? ': ' + r.error : ''));
      await confirm(s, owner, n, nm + ' đơn đầu tiên', X.c, ((r.result || {}).order || {}).id);
      ok(((await X.c.boot()).me || {}).tier === 'ctv', nm + ' lên CTV khi đơn hàng đầu tiên được thanh toán');
      return ((r.result || {}).order || {}).id;
    };
    await first(A, 'A', '0912000101'); const bFirst = await first(B, 'B', '0912000102');
    let db = (await owner.req('GET', '/api/admin/db')).json.db;
    const com = (u, kind) => (db.commissions || []).filter(c => c.user === u && c.kind === kind);
    const cashOf = (u, t) => (db.wallet || []).filter(w => w.user === u && w.wallet === 'cash' && w.type === t);
    ok(plan.pkgPoints === plan.pkgPrice && (db.wallet || []).some(w => w.user === B.r.me.id && w.wallet === 'shop' && w.type === 'package' && w.amount === plan.pkgPoints), `gói CTV nhận đủ ${plan.pkgPoints} PS vào ví mua hàng`);
    ok(!com(A.r.me.id, 'ref').length, 'đóng gói không có thưởng giới thiệu');
    const aB = com(A.r.me.id, 'direct').find(c => c.order === bFirst);
    ok(aB && aB.amount === Math.round(P.price * plan.ctvRate / 100) && (() => { const o = db.orders.find(x => x.id === bFirst), pt = Math.round(aB.amount * ((o.shopPaid || 0) + (o.availPaid || 0)) / o.total), w = (db.wallet || []).filter(x => x.user === A.r.me.id && x.ref === bFirst && x.type === 'commission');
      return pt > 0 && w.some(x => x.wallet === 'bonus' && x.amount === pt && /trả bằng điểm/.test(x.note)) && w.some(x => x.wallet === 'cash' && x.amount === aB.amount - pt && x.taxable); })(), `A nhận ${plan.ctvRate}% cả đơn đầu tiên của B: phần trả bằng điểm gói vào ví điểm thưởng, phần chuyển khoản vào ví tiền mặt`);

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
    const kl = client(s.port); await kl.act('register', { name: 'Khách Slide', username: 'ktslide', phone: ph(), email: 'ktslide@kiem-tra.vn', pass: '123456a', ref: 'PS1000', agree: true });
    const sl = async c => { const r = await c.req('GET', '/api/tai-lieu/slide'); return r.status === 200 && /SLIDE-KT/.test(r.text); };
    ok(!(await sl(guest)) && !(await sl(kl)), 'slide thuyết trình: chưa đăng nhập và khách không mở được');
    ok(await sl(A.c) && await sl(B.c) && await sl(owner), 'slide thuyết trình: đại lý, CTV, quản trị mở được');
    // sửa chữ trên slide: quản trị lưu, CTV mở thấy bản mới; CTV không lưu được, không thấy nút sửa
    fs.writeFileSync(path.join(dir, 'tai-lieu', 'slide-thuyet-trinh.html'), '<title>SLIDE-KT</title><script type="application/json" id="psq-edits">{}</script>');
    const sv = (c, body) => c.req('POST', '/api/admin/slide', body);
    ok((await sv(B.c, { edits: { 3: 'x' } })).status === 403, 'slide: CTV không lưu được chữ');
    ok((await sv(owner, { edits: { 3: 'Chữ <em>mới</em><img src=x onerror=alert(1)>' } })).status === 200, 'slide: quản trị lưu được chữ');
    const sB = (await B.c.req('GET', '/api/tai-lieu/slide')).text, sO = (await owner.req('GET', '/api/tai-lieu/slide')).text;
    ok(sB.includes('{"3":"Chữ \\u003cem>mới\\u003c/em>"}') && !/onerror/.test(sB), 'slide: CTV thấy chữ đã sửa, thẻ lạ bị bỏ');
    ok(!sB.includes('PSQ_SLIDE') && sO.includes('PSQ_SLIDE'), 'slide: chỉ quản trị thấy chế độ sửa');
    ok((await sv(owner, { html: '<title>SLIDE-MOI</title>' })).status === 400, 'slide: không nhận tệp không phải slide');
    ok((await sv(owner, { html: '<title>SLIDE-MOI</title><script type="application/json" id="psq-edits">{}</script>' })).status === 200 && /SLIDE-MOI/.test((await B.c.req('GET', '/api/tai-lieu/slide')).text), 'slide: chủ sở hữu thay được tệp slide');

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
      ok(((await D.c.boot()).me || {}).tier === 'khach', 'D đóng gói chưa lên CTV');
      // D tiêu 686.000 PS của gói vào đơn đầu tiên: lên CTV, B vẫn nhận hoa hồng cả đơn
      n1 = s.log().length; const od = await D.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'CTV D', phone: '0987650002' }), useShop: plan.pkgPoints });
      const odId = ((od.result || {}).order || {}).id; ok(!od.error, 'D đặt đơn dùng điểm gói' + (od.error ? ': ' + od.error : ''));
      await confirm(s, owner, n1, 'đơn của D', D.c, odId);
      ok(((await D.c.boot()).me || {}).tier === 'ctv', 'D lên CTV khi đơn đầu tiên được thanh toán');
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const odO = db.orders.find(o => o.id === odId) || {}, bD = com(B.r.me.id, 'direct').find(c => c.order === odId);
      ok(odO.pkgPaid === plan.pkgPoints && bD && bD.amount === Math.round(P.price * plan.ctvRate / 100), `đơn trả bằng điểm gói vẫn tính hoa hồng: B nhận ${plan.ctvRate}% cả đơn (thực tế ${bD ? bD.amount : 'không có'})`);
      n1 = s.log().length; const oe = await Ek.c.act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách E', phone: '0987650001' }) });
      const oeId = ((oe.result || {}).order || {}).id; await confirm(s, owner, n1, 'đơn của E', Ek.c, oeId);
      db = (await owner.req('GET', '/api/admin/db')).json.db;
      const dDir = com(D.r.me.id, 'direct').find(c => c.order === oeId), bOv = com(B.r.me.id, 'override').find(c => c.order === oeId && c.ctv);
      ok(dDir && bOv && bOv.amount === Math.round(dDir.amount * plan.ctvOverRate / 100) && bOv.status === 'paid' && cashOf(B.r.me.id, 'override').some(w => w.amount === bOv.amount && w.taxable), `B (CTV) nhận ${plan.ctvOverRate}% hoa hồng bán hàng của D = ${bOv ? bOv.amount : '?'}đ vào ví tiền mặt`);
      const aOv2 = com(A.r.me.id, 'override').find(c => c.order === oeId && c.from === B.r.me.id);
      ok(bOv && aOv2 && aOv2.amount === Math.round(bOv.amount * plan.overrideRate / 100) && aOv2.status === 'paid', `đại lý A nhận ${plan.overrideRate}% trên khoản 10% của CTV B = ${aOv2 ? aOv2.amount : '?'}đ, tính tiếp lên trên`);
      // gói do quản trị cấp: lên CTV, không có thưởng giới thiệu
      const G = await reg('CTV cấp G', 'ktg', B.r.me.code);
      ok(!(await owner.act('ctvGrant', { id: G.r.me.id, note: 'Thử cấp' })).error && ((await G.c.boot()).me || {}).tier === 'ctv', 'chủ sở hữu cấp gói CTV: lên CTV ngay');
      {
        const dbg = async () => (await owner.req('GET', '/api/admin/db')).json.db, d0 = await dbg(), g0 = ENG.ADB.balances(d0, G.r.me.id).shop, nC = (d0.commissions || []).length;
        ok(!!(await G.c.act('agentGrant', { id: G.r.me.id, note: 'x' })).error, 'cấp gói đại lý: thành viên tự cấp bị chặn');
        ok(/lý do/.test((await owner.act('agentGrant', { id: G.r.me.id, note: '', pass: 'KiemTra@2026' })).error || ''), 'cấp gói đại lý: bắt buộc ghi lý do');
        ok(/Mật khẩu/.test((await owner.act('agentGrant', { id: G.r.me.id, note: 'Thử', pass: 'sai' })).error || ''), 'cấp gói đại lý: sai mật khẩu bị chặn');
        ok(!(await owner.act('agentGrant', { id: G.r.me.id, note: 'Thử cấp đại lý', pass: 'KiemTra@2026' })).error, 'chủ sở hữu cấp gói đại lý');
        const d1 = await dbg(), plan1 = ENG.ADB.plan(d1);
        ok(((await G.c.boot()).me || {}).tier === 'daily' && ENG.ADB.balances(d1, G.r.me.id).shop === g0 + plan1.agentPkgPoints && (d1.commissions || []).length === nC && !ENG.ADB.fund(d1).diff, 'cấp gói đại lý: lên Đại lý ngay, cộng điểm gói vào ví mua hàng, tuyến trên không có hoa hồng, quỹ cân');
        ok(/đã là Đại lý/.test((await owner.act('agentGrant', { id: G.r.me.id, note: 'lần 2', pass: 'KiemTra@2026' })).error || ''), 'cấp gói đại lý: không cấp 2 lần');
      }
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
    // khách để lại số khi xem qua link của A, sau đó vào bằng trình duyệt khác (mã B) rồi mua: vẫn tính cho A; số đã để lại cho A thì B không giành được
    const leadInfo = { name: 'Khách để lại số', phone: '0909333444', address: '3 Đường Thử, Quận 3', pay: 'bank' };
    ok(!(await client(s.port).act('captureLead', { phone: leadInfo.phone, ref: A.r.me.code, product: P.id })).error, 'khách để lại số qua link của A');
    ok(!(await client(s.port).act('captureLead', { phone: leadInfo.phone, ref: B.r.me.code, product: P.id })).error, 'khách để lại số lần 2 qua link của B (không đổi người)');
    ok((await client(s.port).act('captureLead', { phone: '12345', ref: A.r.me.code })).error, 'số điện thoại sai bị chặn');
    const ld = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: leadInfo, ref: B.r.me.code });
    ok(!ld.error && ((ld.result || {}).order || {}).refBy === A.r.me.id, 'đơn của khách đã để lại số qua link A tính cho A dù trình duyệt nhớ mã B');
    // khách đã để lại số qua link A, sau đó ĐĂNG KÝ thành viên dưới B: từ đó tính cho B (người mới), không còn tính cho A
    const regInfo = { name: 'Khách đổi người', phone: '0909555666', address: '4 Đường Thử, Quận 3', pay: 'bank' };
    await client(s.port).act('captureLead', { phone: regInfo.phone, ref: A.r.me.code, product: P.id });
    const rg = await client(s.port).act('register', { name: regInfo.name, username: 'ktdoinguoi', email: 'ktdoinguoi@kiem-tra.vn', phone: regInfo.phone, pass: '123456a', ref: B.r.me.code, agree: true });
    ok(!rg.error, 'khách đã để lại số qua A đăng ký thành viên dưới B' + (rg.error ? ': ' + rg.error : ''));
    const rd = await client(s.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: regInfo, ref: A.r.me.code });
    ok(!rd.error && ((rd.result || {}).order || {}).refBy === B.r.me.id, 'sau khi đăng ký dưới B, đơn tính cho B (người mới), không tính cho A');
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
    // bot Trợ Lý xuất đơn chưa giao: cần khóa, có SĐT/địa chỉ, chỉ đơn chờ/đã thanh toán/đang giao
    const bo = async (q, key) => { const r = await fetch(`http://127.0.0.1:${s.port}/api/bot/orders${q}`, { headers: key ? { 'x-bot-key': key } : {} }); return { status: r.status, j: await r.json() }; };
    ok((await bo('', '')).status === 401, 'Trợ Lý: lấy đơn cần khóa bot');
    const bo1 = await bo('', bk.key), od = (await owner.req('GET', '/api/admin/db')).json.db;
    const open = (od.orders || []).filter(o => ['pending', 'paid', 'ship'].includes(o.status));
    ok(bo1.status === 200 && bo1.j.count === open.length && bo1.j.orders.every(o => ['pending', 'paid', 'ship'].includes(o.status) && 'phone' in o && Array.isArray(o.items)), 'Trợ Lý: đơn chưa giao đúng số lượng, có SĐT và sản phẩm');
    ok((await bo('?status=all', bk.key)).j.count === (od.orders || []).length, 'Trợ Lý: status=all lấy hết đơn');
    ok((await fetch(`http://127.0.0.1:${s.port}/api/sepay`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-psq': '1', authorization: 'Apikey x' }, body: '{}' })).status === 404, 'Đã bỏ SePay: /api/sepay không còn nhận tin');
    {
    // tài khoản phân phối điểm mua hàng (anh Tuân 12/11): chỉ chủ sở hữu bật quyền, nhập lại mật khẩu, có hạn mức, hoàn lại được
    const shopOf = async uid => { const db = (await owner.req('GET', '/api/admin/db')).json.db; return db.wallet.filter(w => w.user === uid && (w.wallet || '') === 'shop' && (w.status === 'done' || (w.status === 'pending' && w.amount < 0))).reduce((x, w) => x + w.amount, 0); };
    const B = await reg('Phân Phối Thử', 'ktpp', A.r.me && A.r.me.code); B.r.me = B.r.me || B.c.me;
    ok(!(await owner.act('ctvGrant', { id: B.r.me.id, note: 'kiểm tra phân phối' })).error, 'Phân phối: cấp gói CTV để có điểm mua hàng');
    const bShop0 = await shopOf(B.r.me.id), aShop0 = await shopOf(A.r.me.id);
    ok(bShop0 >= 2000, 'Phân phối: tài khoản thử có điểm mua hàng để thử (' + bShop0 + ')');
    ok(/chưa được chủ sở hữu bật/.test((await B.c.act('giveShop', { user: A.r.me.code, amount: 1000, pass: '123456a' })).error || ''), 'Phân phối: chưa bật quyền thì không chuyển được');
    ok(!!(await B.c.act('giveSet', { id: B.r.me.id, on: true, pass: '123456a' })).error, 'Phân phối: thành viên tự bật quyền bị chặn');
    ok(/Mật khẩu/.test((await owner.act('giveSet', { id: B.r.me.id, on: true, pass: 'sai' })).error || ''), 'Phân phối: chủ sở hữu bật quyền cần đúng mật khẩu');
    ok(!(await owner.act('giveSet', { id: B.r.me.id, on: true, pass: 'KiemTra@2026' })).error, 'Phân phối: chủ sở hữu bật quyền cho tài khoản thử');
    ok(!(await owner.act('giveCfg', { save: true, max: 1000, day: 1500 })).error, 'Phân phối: chủ sở hữu đặt hạn mức 1.000/lần, 1.500/ngày');
    const gi = (await B.c.act('giveInfo', {})).result || {};
    ok(gi.on && gi.max === 1000 && gi.day === 1500, 'Phân phối: tài khoản thử thấy quyền và hạn mức');
    const ck = (await B.c.act('giveShop', { user: A.r.me.code, check: true })).result || {};
    ok(ck.to && ck.to.id === A.r.me.id && ck.to.code === A.r.me.code, 'Phân phối: tìm người nhận theo mã PS');
    ok(/chính mình/.test((await B.c.act('giveShop', { user: 'ktpp', amount: 10, pass: '123456a' })).error || ''), 'Phân phối: không chuyển cho chính mình');
    ok(/Mật khẩu/.test((await B.c.act('giveShop', { user: 'kta', amount: 1000, pass: 'sai' })).error || ''), 'Phân phối: sai mật khẩu bị chặn');
    ok(/tối đa/.test((await B.c.act('giveShop', { user: 'kta', amount: 1001, pass: '123456a' })).error || ''), 'Phân phối: vượt hạn mức mỗi lần bị chặn');
    const g1 = await B.c.act('giveShop', { user: 'kta', amount: 1000, note: 'thử', pass: '123456a', tx: 'ktx1' });
    ok(!g1.error && (await shopOf(B.r.me.id)) === bShop0 - 1000 && (await shopOf(A.r.me.id)) === aShop0 + 1000, 'Phân phối: chuyển 1.000 PS, ví mua hàng hai bên đúng');
    ok(((await B.c.act('giveShop', { user: 'kta', amount: 1000, pass: '123456a', tx: 'ktx1' })).result || {}).dup && (await shopOf(A.r.me.id)) === aShop0 + 1000, 'Phân phối: bấm đôi cùng mã giao dịch không chuyển 2 lần');
    ok(/hạn mức mỗi ngày/.test((await B.c.act('giveShop', { user: 'kta', amount: 600, pass: '123456a' })).error || ''), 'Phân phối: vượt hạn mức mỗi ngày bị chặn');
    const hs = ((await owner.act('giveCfg', {})).result || {}).hist || [];
    ok(hs.length === 1 && hs[0].amount === 1000, 'Phân phối: chủ sở hữu xem được lịch sử chuyển');
    ok(!!(await B.c.act('giveBack', { ref: hs[0].ref, pass: '123456a' })).error, 'Phân phối: thành viên không tự hoàn lại được');
    const bk1 = (await owner.act('giveBack', { ref: hs[0].ref, pass: 'KiemTra@2026' })).result || {};
    ok(bk1.take === 1000 && (await shopOf(B.r.me.id)) === bShop0 && (await shopOf(A.r.me.id)) === aShop0, 'Phân phối: hoàn lại đưa điểm về đúng hai ví');
    ok(/hoàn lại hết/.test((await owner.act('giveBack', { ref: hs[0].ref, pass: 'KiemTra@2026' })).error || ''), 'Phân phối: không hoàn lại 2 lần');
    ok(!(await owner.act('giveSet', { id: B.r.me.id, on: false, pass: 'KiemTra@2026' })).error && !((await B.c.act('giveInfo', {})).result || {}).on, 'Phân phối: tắt quyền thì tài khoản thử không còn thấy chức năng');
    // chủ sở hữu điều chỉnh điểm thành viên: thu về công ty, chuyển sang ví mua hàng, hoàn lại
    const fundOk = async () => { const db = (await owner.req('GET', '/api/admin/db')).json.db; const f = ENG.ADB.fund(db); return { f, bal: ENG.ADB.balances(db, B.r.me.id) }; };
    const sh0 = await shopOf(B.r.me.id), f0 = (await fundOk()).f;
    ok(!!(await B.c.act('memberWallet', { id: B.r.me.id, op: 'recall', from: 'shop', amount: 1000, note: 'x', pass: '123456a' })).error, 'Điều chỉnh điểm: không phải chủ sở hữu bị chặn');
    ok(/Mật khẩu/.test((await owner.act('memberWallet', { id: B.r.me.id, op: 'recall', from: 'shop', amount: 1000, note: 'thử', pass: 'sai' })).error || ''), 'Điều chỉnh điểm: sai mật khẩu bị chặn');
    ok(/chỉ còn/.test((await owner.act('memberWallet', { id: B.r.me.id, op: 'recall', from: 'shop', amount: sh0 + 1, note: 'thử', pass: 'KiemTra@2026' })).error || ''), 'Điều chỉnh điểm: thu quá số dư bị chặn');
    ok(/lý do/.test((await owner.act('memberWallet', { id: B.r.me.id, op: 'recall', from: 'shop', amount: 1000, note: '', pass: 'KiemTra@2026' })).error || ''), 'Điều chỉnh điểm: bắt buộc ghi lý do');
    ok(!(await owner.act('memberWallet', { id: B.r.me.id, op: 'recall', from: 'shop', amount: 1000, note: 'thu thử', pass: 'KiemTra@2026', tx: 'mw1' })).error && (await shopOf(B.r.me.id)) === sh0 - 1000, 'Điều chỉnh điểm: thu 1.000 PS từ ví mua hàng');
    ok(((await owner.act('memberWallet', { id: B.r.me.id, op: 'recall', from: 'shop', amount: 1000, note: 'thu thử', pass: 'KiemTra@2026', tx: 'mw1' })).result || {}).dup && (await shopOf(B.r.me.id)) === sh0 - 1000, 'Điều chỉnh điểm: bấm đôi không thu 2 lần');
    const f1 = (await fundOk()).f; ok(!f1.diff && f1.kt === f0.kt + 1000, 'Điều chỉnh điểm: điểm thu về Quỹ kế toán, quỹ cân đối');
    const lg = ((await owner.act('memberWalletLog', { id: B.r.me.id })).result || {}).rows || [];
    ok(lg.length === 1 && lg[0].op === 'recall' && lg[0].amount === 1000, 'Điều chỉnh điểm: có lịch sử');
    ok(!(await owner.act('memberWalletUndo', { ref: lg[0].ref, pass: 'KiemTra@2026' })).error && (await shopOf(B.r.me.id)) === sh0 && !(await fundOk()).f.diff, 'Điều chỉnh điểm: hoàn lại lần thu, quỹ vẫn cân');
    ok(/đã hoàn lại/.test((await owner.act('memberWalletUndo', { ref: lg[0].ref, pass: 'KiemTra@2026' })).error || ''), 'Điều chỉnh điểm: không hoàn lại 2 lần');
    ok(/khả dụng hoặc điểm thưởng/.test((await owner.act('memberWallet', { id: B.r.me.id, op: 'toshop', from: 'shop', amount: 10, note: 'x', pass: 'KiemTra@2026' })).error || ''), 'Điều chỉnh điểm: chỉ chuyển từ ví khả dụng, điểm thưởng sang ví mua hàng');
    }
    {
    // khách tự đổi sản phẩm khi đơn chưa giao (anh Tuân 12/11): chỉ bằng hoặc cao hơn, bù bằng ví hoặc chuyển khoản, tối đa 3 lần
    const dbNow = async () => (await owner.req('GET', '/api/admin/db')).json.db;
    const balOf = async uid => ENG.ADB.balances(await dbNow(), uid);
    const S = await reg('Đổi Đơn Thử', 'ktsd', A.r.me && A.r.me.code); S.r.me = S.r.me || S.c.me;
    ok(!(await owner.act('ctvGrant', { id: S.r.me.id, note: 'kiểm tra đổi đơn' })).error, 'Đổi đơn: cấp gói CTV để có điểm mua hàng');
    const prods = ENG.PRODUCTS.filter(p => p.active !== false && p.id !== ENG.ADB.PKG_ID && p.id !== ENG.ADB.AGENT_PKG_ID && !(p.variants || []).length).sort((a, b) => a.price - b.price);
    const Q = prods[0], Q2 = prods.find(p => p.id !== Q.id && p.price === Q.price), Big = prods.find(p => p.price > Q.price * 2);
    const sInfo = { name: 'Đổi Đơn Thử', phone: '0911222333', address: '1 Đường Thử, Quận 1', pay: 'bank' };
    const o1 = ((await S.c.act('placeOrder', { items: [{ id: Q.id, qty: 2 }], info: sInfo })).result || {}).order || {};
    ok(o1.status === 'pending', 'Đổi đơn: đặt đơn chuyển khoản chờ duyệt');
    ok(/Không tìm thấy/.test((await A.c.act('orderEdit', { id: o1.id, info: { address: '9 Đường Khác, Quận 3' } })).error || ''), 'Đổi đơn: người khác không đổi được');
    ok(/chưa thay đổi/.test((await S.c.act('orderEdit', { id: o1.id, info: {} })).error || ''), 'Đổi đơn: không đổi gì thì báo');
    ok(/bằng hoặc cao hơn/.test((await S.c.act('orderEdit', { id: o1.id, items: [{ id: Q.id, qty: 1 }] })).error || ''), 'Đổi đơn: đổi sang tổng thấp hơn bị chặn');
    const e1 = (await S.c.act('orderEdit', { id: o1.id, info: { address: '9 Đường Khác, Quận 3' } })).result || {};
    ok(e1.order && e1.order.address === '9 Đường Khác, Quận 3' && e1.order.edits === 1 && e1.order.total === o1.total, 'Đổi đơn: sửa địa chỉ, giữ mã đơn và tổng');
    const b0 = await balOf(S.r.me.id), bigDiff = Big.price - Q.price * 2;
    const e2 = (await S.c.act('orderEdit', { id: o1.id, items: [{ id: Big.id, qty: 1 }], pay: 'wallet' })).result || {};
    ok(e2.diff === bigDiff && e2.order.shopPaid === bigDiff && (await balOf(S.r.me.id)).shop === b0.shop - bigDiff && e2.due === o1.total, `Đổi đơn chờ duyệt: đổi lên ${Big.name}, bù ${bigDiff} bằng ví mua hàng, phần cũ vẫn chuyển khoản`);
    // đơn đã thanh toán, chưa giao
    const n0 = s.log().length, o2 = ((await S.c.act('placeOrder', { items: [{ id: Q.id, qty: 1 }], info: sInfo })).result || {}).order || {};
    await confirm(s, guest, n0, 'Đổi đơn', S.c, o2.id, sInfo.phone);
    if (Q2) { const e0 = (await S.c.act('orderEdit', { id: o2.id, items: [{ id: Q2.id, qty: 1 }] })).result || {}; ok(e0.diff === 0 && e0.order.items[0].id === Q2.id && e0.order.status === 'paid', 'Đổi đơn đã thanh toán: đổi sang món bằng giá, không cần bù'); }
    ok(/chưa đủ/.test((await S.c.act('orderEdit', { id: o2.id, items: [{ id: (Q2 || Q).id, qty: 2 }], pay: 'wallet' })).error || ''), 'Đổi đơn: ví không đủ phần bù thì báo chọn chuyển khoản');
    const e4 = (await S.c.act('orderEdit', { id: o2.id, items: [{ id: (Q2 || Q).id, qty: 2 }], pay: 'bank' })).result || {};
    const o2c = (await dbNow()).orders.find(x => x.id === o2.id);
    ok(e4.diff === Q.price && o2c.exchange && o2c.exchange.due === Q.price && o2c.status === 'paid', 'Đổi đơn đã thanh toán: bù chuyển khoản thì chờ công ty xác nhận');
    ok(/chờ công ty xác nhận/.test((await S.c.act('orderEdit', { id: o2.id, info: { note: 'x' } })).error || ''), 'Đổi đơn: đang chờ tiền bù thì chưa đổi tiếp');
    const ob = await bo('?status=all', bk.key), bob = (ob.j.orders || []).find(x => x.id === o2.id);
    ok(bob && bob.edits === (Q2 ? 2 : 1) && bob.editedAt && bob.items[0].qty === 2, 'Đổi đơn: Trợ Lý thấy sản phẩm mới, số lần đổi và giờ đổi');
    const o3 = ((await S.c.act('placeOrder', { items: [{ id: Q.id, qty: 1 }], info: sInfo })).result || {}).order || {};
    for (const k of [1, 2, 3]) await S.c.act('orderEdit', { id: o3.id, info: { note: 'lần ' + k } });
    ok(/đổi 3 lần/.test((await S.c.act('orderEdit', { id: o3.id, info: { note: 'lần 4' } })).error || ''), 'Đổi đơn: tối đa 3 lần');
    ok(!ENG.ADB.fund(await dbNow()).diff, 'Đổi đơn: sổ quỹ cân đối');
    }
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
      const X = client(s.port), xr = await X.act('register', { name: 'Đăng Ký Nhầm', username: 'ktnham2', phone: ph(), email: 'ktnham2@kiem-tra.vn', pass: '123456a', ref: A.r.me.code, agree: true });
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
    // sản phẩm nhiều phân loại: giá, PS theo phân loại; tải ảnh lên thành tệp
    {
      const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600, 3)]).toString('base64');
      const up = await owner.req('POST', '/api/admin/media', { data: png });
      ok(up.status === 200 && /^\/api\/media\/[a-f0-9]{24}\.png$/.test(up.json.url) && (await guest.req('GET', up.json.url)).status === 200, 'tải ảnh sản phẩm lên thành tệp, mở được');
      ok((await guest.req('POST', '/api/admin/media', { data: png })).status === 403, 'khách không tải ảnh lên được');
      const cur = ((await owner.boot()).content || {}).psq_products_v1 || { edits: [], hidden: [] };
      const VP = { id: 'kt-phan-loai', cat: P.cat, name: 'Trà thử', price: 100000, image: up.json.url, badges: ['hot', 'love'], hot: true, variants: [{ id: 'v1', name: 'Túi nhỏ', price: 100000 }, { id: 'v2', name: 'Hộp lớn', price: 300000, ps: 200000 }] };
      await owner.req('POST', '/api/admin/content', { key: 'psq_products_v1', value: Object.assign({}, cur, { edits: [...(cur.edits || []), VP] }) });
      const gi = { name: 'Khách phân loại', phone: '0912000111', address: '3 Đường Thử, Quận 5', pay: 'bank' };
      ok(/phân loại/.test((await client(s.port).act('placeOrder', { items: [{ id: VP.id, qty: 1 }], info: gi })).error || ''), 'sản phẩm nhiều phân loại: chưa chọn phân loại thì không đặt được');
      const ov = await client(s.port).act('placeOrder', { items: [{ id: VP.id, v: 'v2', qty: 2 }, { id: VP.id, v: 'v1', qty: 1 }], info: gi });
      const its = ((ov.result || {}).order || {}).items || [];
      ok(its.length === 2 && its[0].price === 300000 && its[0].ps === 200000 && /Hộp lớn/.test(its[0].name) && its[1].price === 100000 && its[1].ps === undefined && ov.result.order.total === 700000 + (+((await guest.boot()).content.psq_site_v1 || {}).shipFee || 0), 'đặt theo phân loại: giá, PS, tên theo từng dòng' + (ov.error ? ': ' + ov.error : ''));
      const cc = await client(s.port).act('couponCheck', { code: 'KHONGCO', items: [{ id: VP.id, v: 'v2', qty: 1 }] });
      ok(!!cc.error, 'kiểm tra mã giảm giá vẫn chạy với phân loại');
      await owner.req('POST', '/api/admin/content', { key: 'psq_products_v1', value: cur });
    }
    // công cụ làm mới dữ liệu: dừng máy chủ, chạy, khởi động lại
    const maxOld = Math.max(...((await owner.boot()).db.orders || []).map(o => +String(o.id).replace(/\D/g, '') || 0));
    s.stop(); await new Promise(r => setTimeout(r, 500));
    const lm = require('child_process').spawnSync(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'tools', 'lam-moi.js'), dir, '--chay'], { encoding: 'utf8' });
    ok(lm.status === 0 && fs.readdirSync(path.join(dir, 'backups')).some(f => /^so-du-truoc-lam-moi-.*\.csv$/.test(f)), 'làm mới dữ liệu: chạy xong, có sao lưu và bảng số dư' + (lm.status ? ': ' + lm.stderr : ''));
    const s2 = await startServer(dir, false);
    try {
      const own2 = client(s2.port);
      ok(!(await own2.act('login', { login: 'chu@kiem-tra.vn', pass: 'KiemTra@2026' })).error, 'làm mới: chủ sở hữu vẫn đăng nhập được');
      const d2 = (await own2.boot()).db, mem = (d2.users || []).filter(u => u.role !== 'admin' && !u.deleted);
      ok(mem.length && mem.every(u => u.tier === 'daily'), 'làm mới: mọi thành viên lên Đại lý');
      ok(!(d2.orders || []).length && !(d2.commissions || []).length && !(d2.wallet || []).length && !(d2.fundbook || []).length && !(d2.coupons || []).length && !(d2.promos || []).length, 'làm mới: không còn đơn, hoa hồng, giao dịch ví, sổ quỹ, voucher, khuyến mãi');
      ok(mem.every(u => u.welcomeSpun), 'làm mới: tài khoản cũ không quay vòng chào mừng được nữa');
      const on = await client(s2.port).act('placeOrder', { items: [{ id: P.id, qty: 1 }], info: Object.assign({}, info, { name: 'Khách mới', phone: '0987650099' }) });
      ok(on.result && on.result.order && +String(on.result.order.id).replace(/\D/g, '') > maxOld, 'làm mới: số đơn mới tiếp nối số cũ, không cấp lại' + (on.result ? ' (' + on.result.order.id + ' / ' + maxOld + ')' : ': ' + JSON.stringify(on).slice(0, 200)));
      ok(!/TypeError|ReferenceError|SyntaxError|\[lỗi/.test(s2.log()), 'làm mới: nhật ký máy chủ không có lỗi');
    } finally { s2.stop(); }
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
  // ví dụ anh Tuân 30/10: A (CTV) ← B (đại lý) ← C (CTV) ← D (CTV), khách của D mua 10.000.000 PS
  {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10), mk = (id, tier, sponsor) => { d.users.push({ id, name: id, tier, sponsor, role: 'member' }); d.orders.push({ id: 'tu-' + id, userId: id, status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day }); };
    mk('A', 'ctv', null); mk('B', 'daily', 'A'); mk('C', 'ctv', 'B'); mk('D', 'ctv', 'C'); d.users.push({ id: 'K', name: 'Khách', tier: 'khach', sponsor: 'D', role: 'member' });
    const o = { id: 'vd10', userId: 'K', status: 'paid', total: 10000000, items: [{ id: 'vong', price: 10000000, qty: 1 }], date: day }; d.orders.push(o); X.settleOrder(d, o);
    const got = u => d.commissions.filter(c => c.user === u && c.order === 'vd10' && c.status === 'paid' && c.kind !== 'missed').reduce((s, c) => s + c.amount, 0);
    ok(got('D') === 1000000 && got('C') === 100000 && got('B') === 40000 && got('A') === 4000, `ví dụ 4 tầng: D 1.000.000, C 100.000, B 40.000, A 4.000 (thực tế ${['D', 'C', 'B', 'A'].map(got).join(', ')})`);
  }
  // anh Tuân 12/11: đơn trả bằng điểm thì mọi hoa hồng từ đơn đó (mọi tầng) vào ví điểm thưởng; trả một phần thì chia theo tỷ lệ
  for (const [pts, name] of [[10000000, '100% điểm'], [0, '100% chuyển khoản'], [5000000, '50% điểm']]) {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10), mk = (id, tier, sponsor) => { d.users.push({ id, name: id, tier, sponsor, role: 'member' }); d.orders.push({ id: 'tu-' + id, userId: id, status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day }); };
    mk('A', 'ctv', null); mk('B', 'daily', 'A'); mk('C', 'ctv', 'B'); mk('D', 'ctv', 'C'); d.users.push({ id: 'K', name: 'Khách', tier: 'khach', sponsor: 'D', role: 'member' });
    const o = { id: 'pt10', userId: 'K', status: 'paid', total: 10000000, shopPaid: pts, items: [{ id: 'vong', price: 10000000, qty: 1 }], date: day }; d.orders.push(o); X.settleOrder(d, o);
    const rows = d.wallet.filter(w => w.ref === 'pt10' && ['commission', 'override'].includes(w.type)), sum = k => rows.filter(w => w.wallet === k).reduce((x, w) => x + w.amount, 0), all = rows.reduce((x, w) => x + w.amount, 0);
    const want = Math.round(all * pts / 10000000);
    ok(all === 1144000 && Math.abs(sum('bonus') - (pts ? want : 0) - (pts < 10000000 ? sum('bonus') - (pts ? want : 0) : 0)) <= 4 && (pts === 10000000 ? sum('cash') === 0 && sum('shop') === 0 : pts === 0 ? sum('bonus') + sum('shop') <= 40000 : sum('bonus') >= want - 4), `hoa hồng đơn ${name}: tổng 1.144.000, ví điểm thưởng ${sum('bonus')}, tiền mặt ${sum('cash')}, mua hàng ${sum('shop')}`);
    ok(!X.fund(d).diff, `hoa hồng đơn ${name}: quỹ điểm cân đối`);
  }
  // anh Tuân 12/11: thanh toán bằng ví trừ lần lượt ví mua hàng, ví điểm khả dụng, ví tiền mặt; phần điểm khả dụng tính hoa hồng vào ví điểm thưởng; hủy đơn hoàn đúng từng ví
  {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10);
    d.users.push({ id: 'S', name: 'S', tier: 'ctv', sponsor: null, role: 'member' }, { id: 'K', name: 'K', tier: 'ctv', sponsor: 'S', role: 'member' });
    d.orders.push({ id: 'tu-S', userId: 'S', status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day });
    [['shop', 2000000], ['avail', 5000000], ['cash', 3500000]].forEach(([w, a]) => d.wallet.push({ id: 'seed-' + w, user: 'K', wallet: w, type: 'adjust', amount: a, note: 'nạp thử', date: day, status: 'done' }));
    const K = d.users[1], bal = () => X.balances(d, 'K'), diff0 = X.fund(d).diff;
    const o = { id: 'av10', userId: 'K', status: 'pending', pay: 'wallet', total: 10000000, items: [{ id: 'vong', price: 10000000, qty: 1 }], date: day }; d.orders.push(o);
    const a1 = X.spendShop(d, K, o, 10000000), a2 = X.spendAvailPart(d, K, o, 10000000 - a1), a3 = X.spendCash(d, K, o, 10000000 - a1 - a2);
    ok(a1 === 2000000 && a2 === 5000000 && a3 === 3000000 && o.availPaid === 5000000 && bal().avail === 0 && bal().cash === 500000, `đơn 10tr trả bằng ví: mua hàng 2tr, khả dụng 5tr, tiền mặt 3tr (thực tế ${a1}, ${a2}, ${a3})`);
    X.setStatus(d, o, 'paid'); X.settleOrder(d, o);
    const rows = d.wallet.filter(w => w.ref === 'av10' && w.user === 'S' && ['commission', 'override'].includes(w.type)), sum = k => rows.filter(w => w.wallet === k).reduce((x, w) => x + w.amount, 0);
    ok(sum('bonus') === 70000 && sum('cash') === 30000, `hoa hồng S (10% thu nhập của K) từ đơn trả 70% bằng điểm (mua hàng + khả dụng): 70.000 vào điểm thưởng, 30.000 tiền mặt (thực tế ${sum('bonus')}, ${sum('cash')})`);
    const cash0 = bal().cash; const o2 = { id: 'av2', userId: 'K', status: 'pending', pay: 'wallet', total: 400000, items: [{ id: 'vong', price: 400000, qty: 1 }], date: day }; d.orders.push(o2);
    X.spendAvailPart(d, K, o2, 400000); const c2 = X.spendCash(d, K, o2, 400000);
    ok(!o2.availPaid && c2 === 400000, 'ví khả dụng hết thì trừ ví tiền mặt');
    X.refundOrder(d, o2); ok(bal().cash === cash0, 'hủy đơn: hoàn lại ví tiền mặt');
    const o3 = { id: 'av3', userId: 'K', status: 'pending', pay: 'wallet', total: 300000, items: [], date: day }; d.orders.push(o3);
    d.wallet.push({ id: 'seed-a2', user: 'K', wallet: 'avail', type: 'adjust', amount: 1000000, note: 'nạp thử', date: day, status: 'done' });
    X.spendAvailPart(d, K, o3, 300000); ok(o3.availPaid === 300000 && bal().avail === 700000, 'đơn trả trọn bằng ví điểm khả dụng');
    X.refundOrder(d, o3); ok(bal().avail === 1000000, 'hủy đơn: hoàn lại đúng ví điểm khả dụng');
    ok(X.fund(d).diff === diff0, 'trả bằng ví điểm khả dụng: sổ quỹ không lệch thêm');
  }
  // anh Tuân 12/11: khách đổi đơn đã thanh toán lên cao hơn, bù bằng ví: trừ ngay, hoa hồng phần bù vào ví điểm thưởng
  {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10);
    d.users.push({ id: 'S', name: 'S', tier: 'ctv', sponsor: null, role: 'member' }, { id: 'K', name: 'K', tier: 'khach', sponsor: 'S', role: 'member' });
    d.orders.push({ id: 'tu-S', userId: 'S', status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day });
    d.wallet.push({ id: 'sd', user: 'K', wallet: 'avail', type: 'adjust', amount: 5000000, note: 'nạp thử', date: day, status: 'done' });
    const K = d.users[1], o = { id: 'ex1', userId: 'K', status: 'pending', pay: 'bank', total: 1000000, items: [{ id: 'x', name: 'x', price: 1000000, qty: 1 }], date: day }; d.orders.push(o);
    X.setStatus(d, o, 'paid'); const before = d.wallet.filter(w => w.user === 'S').length;
    ok(!!X.memberSwap(d, o, K, [{ id: 'x', name: 'x', price: 1000000, qty: 1 }, { id: 'y', name: 'y', price: 500000, qty: 1 }], 'wallet').used, 'đổi đơn đã thanh toán, bù 500.000 bằng ví');
    const rows = d.wallet.filter(w => w.user === 'S').slice(before), bon = rows.filter(w => w.wallet === 'bonus').reduce((x, w) => x + w.amount, 0), csh = rows.filter(w => w.wallet === 'cash').reduce((x, w) => x + w.amount, 0);
    ok(o.availPaid === 500000 && !o.exchange && bon === 50000 && csh === 0, `bù bằng điểm: hoa hồng 10% phần bù = 50.000 vào ví điểm thưởng (thực tế điểm thưởng ${bon}, tiền mặt ${csh})`);
    ok(!X.memberSwap(d, o, K, [{ id: 'x', name: 'x', price: 1000000, qty: 1 }], 'wallet').used && /bằng hoặc cao hơn/.test(X.memberSwap(d, o, K, [{ id: 'x', name: 'x', price: 1000000, qty: 1 }], 'wallet').error || ''), 'đổi đơn sang tổng thấp hơn bị chặn');
  }
  // phần bù đổi sản phẩm tính hoa hồng như đơn mới: đại lý B (người giới thiệu là đại lý A) mua 1tr bằng ví khả dụng, đổi lên 2tr bù 1tr bằng ví
  {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10);
    d.users.push({ id: 'A', name: 'A', tier: 'daily', sponsor: null, role: 'member' }, { id: 'B', name: 'B', tier: 'daily', sponsor: 'A', role: 'member' });
    ['A', 'B'].forEach(id => d.orders.push({ id: 'tu-' + id, userId: id, status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day }));
    d.wallet.push({ id: 'sd', user: 'B', wallet: 'avail', type: 'adjust', amount: 5000000, note: 'nạp thử', date: day, status: 'done' });
    const B = d.users[1], o = { id: 'exb', userId: 'B', status: 'pending', pay: 'wallet', total: 1000000, items: [{ id: 'x', name: 'x', price: 1000000, qty: 1 }], date: day }; d.orders.push(o);
    X.spendAvailPart(d, B, o, 1000000); X.setStatus(d, o, 'paid');
    const got = (u, w) => d.wallet.filter(x => x.user === u && x.ref === 'exb' && ['commission', 'override'].includes(x.type) && (!w || x.wallet === w)).reduce((s, x) => s + x.amount, 0);
    ok(got('B') === 250000 && got('A') === 100000, `đơn 1tr trả bằng ví khả dụng: B tự mua 250.000, A 100.000 (thực tế ${got('B')}, ${got('A')})`);
    X.memberSwap(d, o, B, [{ id: 'y', name: 'y', price: 2000000, qty: 1 }], 'wallet');
    ok(got('B') === 500000 && got('A') === 200000 && got('B', 'bonus') === 500000 && got('A', 'bonus') === 200000, `đổi lên 2tr bù 1tr bằng ví: B thêm 250.000, A thêm 100.000, đều vào điểm thưởng (thực tế B ${got('B')}, A ${got('A')})`);
  }
  // bù bằng chuyển khoản: hoa hồng khoản bù tính như đơn tiền (B tự mua vào tiền mặt, A 90% điểm thưởng + 10% ví mua hàng), dù đơn gốc trả bằng điểm
  {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10);
    d.users.push({ id: 'A', name: 'A', tier: 'daily', sponsor: null, role: 'member' }, { id: 'B', name: 'B', tier: 'daily', sponsor: 'A', role: 'member' });
    ['A', 'B'].forEach(id => d.orders.push({ id: 'tu-' + id, userId: id, status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day }));
    d.wallet.push({ id: 'sd', user: 'B', wallet: 'avail', type: 'adjust', amount: 5000000, note: 'nạp thử', date: day, status: 'done' });
    const B = d.users[1], o = { id: 'exc', userId: 'B', status: 'pending', pay: 'wallet', total: 1000000, items: [{ id: 'x', name: 'x', price: 1000000, qty: 1 }], date: day }; d.orders.push(o);
    X.spendAvailPart(d, B, o, 1000000); X.setStatus(d, o, 'paid');
    const n0 = d.wallet.length; X.memberSwap(d, o, B, [{ id: 'y', name: 'y', price: 2000000, qty: 1 }], 'bank');
    ok(d.wallet.length === n0 && o.exchange && o.exchange.due === 1000000, 'bù chuyển khoản: chưa tính hoa hồng khi công ty chưa nhận tiền');
    X.confirmTopup(d, o);
    const rows = d.wallet.slice(n0), got = (u, w) => rows.filter(x => x.user === u && x.wallet === w).reduce((s, x) => s + x.amount, 0);
    ok(got('B', 'cash') === 250000 && got('B', 'bonus') === 0 && got('A', 'bonus') === 90000 && got('A', 'shop') === 10000 && o.ptsNow == null, `bù chuyển khoản 1tr: B 250.000 tiền mặt, A 90.000 điểm thưởng + 10.000 ví mua hàng (thực tế B ${got('B', 'cash')}/${got('B', 'bonus')}, A ${got('A', 'bonus')}/${got('A', 'shop')})`);
  }
  // đại lý tự mua (anh Tuân 04/11): B đại lý mua 10tr nhận 25% = 2.500.000; A (đại lý, giới thiệu B) nhận 40% = 1.000.000; C (CTV, trên A) 10% = 100.000
  for (const self of [1, 0]) {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: { plan: { selfAgent: self } } }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10), mk = (id, tier, sponsor) => { d.users.push({ id, name: id, tier, sponsor, role: 'member' }); d.orders.push({ id: 'tu-' + id, userId: id, status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day }); };
    mk('C', 'ctv', null); mk('A', 'daily', 'C'); mk('B', 'daily', 'A');
    const o = { id: 'tm10', userId: 'B', status: 'paid', total: 10000000, items: [{ id: 'vong', price: 10000000, qty: 1 }], date: day }; d.orders.push(o); X.settleOrder(d, o);
    const got = u => d.commissions.filter(c => c.user === u && c.order === 'tm10' && c.status === 'paid' && c.kind !== 'missed').reduce((s, c) => s + c.amount, 0);
    const cash = u => d.wallet.filter(w => w.user === u && w.ref === 'tm10' && w.wallet === 'cash').reduce((s, w) => s + w.amount, 0);
    if (self) ok(got('B') === 2500000 && cash('B') === 2500000 && got('A') === 1000000 && got('C') === 100000, `đại lý tự mua 10tr: B 2.500.000 vào tiền mặt, A 1.000.000, C 100.000 (thực tế ${['B', 'A', 'C'].map(got).join(', ')})`);
    else ok(got('B') === 0 && got('A') === 2500000, `tắt đại lý tự mua: người giới thiệu A nhận 2.500.000 như cũ (thực tế B ${got('B')}, A ${got('A')})`);
  }
  // CTV tự mua (anh Tuân 04/11): B CTV mua 10tr nhận 10% = 1.000.000; A đại lý (giới thiệu B) 40% = 400.000; C CTV (trên A) 10% = 40.000
  {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: {} }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10), mk = (id, tier, sponsor) => { d.users.push({ id, name: id, tier, sponsor, role: 'member' }); d.orders.push({ id: 'tu-' + id, userId: id, status: 'done', settled: true, total: 100000, items: [{ id: 'x', price: 100000, qty: 1 }], date: day }); };
    mk('C', 'ctv', null); mk('A', 'daily', 'C'); mk('B', 'ctv', 'A');
    const o = { id: 'tc10', userId: 'B', status: 'paid', total: 10000000, items: [{ id: 'vong', price: 10000000, qty: 1 }], date: day }; d.orders.push(o); X.settleOrder(d, o);
    const got = u => d.commissions.filter(c => c.user === u && c.order === 'tc10' && c.status === 'paid' && c.kind !== 'missed').reduce((s, c) => s + c.amount, 0);
    ok(got('B') === 1000000 && got('A') === 400000 && got('C') === 40000, `CTV tự mua 10tr: B 1.000.000, A 400.000, C 40.000 (thực tế ${['B', 'A', 'C'].map(got).join(', ')})`);
  }
  // nút bật/tắt điều kiện (anh Tuân 31/10): tuyến trên không tự mua, không có đơn bán thì bật = không nhận, tắt = nhận đủ
  for (const on of [1, 0]) {
    const X = E.ADB, d = { users: [], orders: [], commissions: [], wallet: [], settings: { plan: { activeOn: on } } }; X.plan(d);
    const day = new Date().toISOString().slice(0, 10);
    [['A', 'ctv', null], ['B', 'daily', 'A'], ['C', 'ctv', 'B'], ['D', 'ctv', 'C'], ['K', 'khach', 'D']].forEach(([id, tier, sponsor]) => d.users.push({ id, name: id, tier, sponsor, role: 'member' }));
    const o = { id: 'dk', userId: 'K', status: 'paid', total: 10000000, items: [{ id: 'vong', price: 10000000, qty: 1 }], date: day }; d.orders.push(o); X.settleOrder(d, o);
    const got = u => d.commissions.filter(c => c.user === u && c.status === 'paid' && c.kind !== 'missed').reduce((s, c) => s + c.amount, 0);
    ok(on ? got('B') === 0 && got('A') === 0 && got('D') === 1000000 : got('B') === 40000 && got('A') === 4000 && got('C') === 100000, `điều kiện nhận thu nhập tuyến dưới ${on ? 'bật: B, A chưa đủ điều kiện nên không nhận' : 'tắt: B 40.000, A 4.000 dù không mua'} (thực tế ${['D', 'C', 'B', 'A'].map(got).join(', ')})`);
  }
  // đại lý uy tín rớt khỏi trang chủ khi không có doanh số trực tiếp tháng này và tháng trước (anh Tuân 06/11)
  {
    const X = E.ADB, d = { users: [{ id: 'A', code: 'PS9001', tier: 'daily' }, { id: 'B', code: 'PS9002', tier: 'ctv', sponsor: 'A' }, { id: 'C', code: 'PS9003', tier: 'daily' }], orders: [], settings: {} }; X.plan(d);
    d.orders.push({ id: 'o1', userId: 'B', status: 'paid', total: 1, items: [], date: '2026-12-05' });
    ok(X.dealerSales(d, 'PS9003', '2026-11-20').ok, 'đại lý: tháng đầu áp dụng (11/2026) chưa xét, ai cũng hiện');
    ok(X.dealerSales(d, 'PS9001', '2027-01-10').ok && !X.dealerSales(d, 'PS9001', '2027-02-01').ok, 'đại lý A có đơn của người mình giới thiệu tháng 12: hiện tới hết tháng 1, sang tháng 2 rớt');
    ok(!X.dealerSales(d, 'PS9003', '2026-12-02').ok, 'đại lý C không có đơn nào: sang tháng 12 rớt');
    d.settings.plan.dealerSales = 0; ok(X.dealerSales(d, 'PS9003', '2026-12-02').ok, 'tắt điều kiện doanh số: đại lý luôn hiện');
  }
  // sự kiện vòng quay (anh Tuân 05/11): trao hết giải thì tự kết thúc, không còn hiện "đang diễn ra"
  {
    const X = E.ADB, d = { users: [], orders: [], settings: {} }, W = X.wheel(d);
    const ev = { id: 'skt', name: 'Thử', live: true, participants: ['An', 'Bình', 'Chi', 'Dũng'], prizes: [{ name: 'Trà', qty: 2 }], winners: [] }; W.events.push(ev);
    X.wheelEventDraw(d, 'skt'); const open1 = X.wheelEventOpen(ev); const r = X.wheelEventDraw(d, 'skt');
    ok(open1 && r.done && ev.live === false && !!ev.endAt && !X.wheelEventOpen(ev), 'sự kiện trao đủ 2/2 giải thì tự kết thúc, không còn hiện bảng đang diễn ra');
    const old = { id: 'sko', live: true, date: '2020-01-01', prizes: [], winners: [] };
    ok(!X.wheelEventOpen(old), 'sự kiện đang bật nhưng đã qua ngày không còn hiện');
  }
  try { await flow(); await seed(); }
  catch (e) { ok(false, 'lỗi khi kiểm tra: ' + (e.stack || e.message)); }
  console.log(failed ? `\nCÓ ${failed} BƯỚC SAI, KHÔNG ĐƯA LÊN.` : '\nTẤT CẢ ĐỀU ĐÚNG.');
  process.exit(failed ? 1 : 0);
})();
