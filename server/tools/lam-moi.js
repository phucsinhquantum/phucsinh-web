/* Làm mới dữ liệu kinh doanh (anh Tuân chốt 30/10/2026):
   1. Mọi thành viên (Khách hàng, CTV) lên Đại lý từ hôm nay. Không cộng điểm, không hoa hồng.
   2. Xóa toàn bộ đơn hàng (kể cả đơn khách chưa có tài khoản), hoa hồng, giao dịch 5 ví, lệnh nạp/rút,
      sổ quỹ điểm, voucher và mã giảm giá đã cấp, mã quay và lượt quay, quà đã trúng, mọi chương trình khuyến mãi
      (kể cả mã), khách nhớ link giới thiệu.
   Giữ nguyên: tài khoản, mã PS, tuyến giới thiệu, sản phẩm, kho, bài viết, thiết lập (cả danh sách quà của vòng quay),
   fanpage, tin nhắn, nhật ký. Tài khoản đang có không được quay vòng chào mừng nữa, chỉ người đăng ký sau đợt này mới được quay.
   Số đơn mới tiếp nối số cũ (không cấp lại mã PSQ đã dùng). Mã xác nhận đơn cũ trong Telegram bị hủy.

   Chạy KHI MÁY CHỦ ĐÃ DỪNG (máy chủ đang chạy sẽ ghi đè lại dữ liệu cũ):
     node --no-warnings server/tools/lam-moi.js <thư mục dữ liệu>           xem trước, không đổi gì
     node --no-warnings server/tools/lam-moi.js <thư mục dữ liệu> --chay    sao lưu rồi làm
   Trước khi làm: sao lưu psq.db vào backups/truoc-lam-moi-<thời gian>.db và xuất số dư từng người
   ra backups/so-du-truoc-lam-moi-<thời gian>.csv (mở bằng Excel). */
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createEngine } = require('../engine');

const [dir, flag] = process.argv.slice(2), run = flag === '--chay';
const file = dir && path.join(dir, 'psq.db');
if (!file || !fs.existsSync(file)) { console.error('Cách dùng: lam-moi.js <thư mục dữ liệu> [--chay]'); process.exit(1); }

const sql = new DatabaseSync(file);
const getKV = k => { const r = sql.prepare('SELECT v FROM kv WHERE k = ?').get(k); return r ? JSON.parse(r.v) : null; };
const D = getKV('db');
if (!D || !Array.isArray(D.users)) { console.error('Không đọc được dữ liệu chính.'); process.exit(1); }
const E = createEngine({ webRoot: path.join(__dirname, '..', '..'), content: k => getKV(k), state: () => D, actor: () => null }), A = E.ADB;

const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const members = D.users.filter(u => u.role !== 'admin' && !u.deleted);
const up = members.filter(u => u.tier !== 'daily');
const WK = ['cash', 'sales', 'avail', 'bonus', 'shop'];
const bal = D.users.map(u => ({ u, b: A.balances(D, u.id) })).filter(x => WK.some(k => x.b[k]));
const sum = k => bal.reduce((s, x) => s + x.b[k], 0);
const guestOrders = (D.orders || []).filter(o => !o.userId);
const n = k => (D[k] || []).length;

console.log(`Lên Đại lý: ${up.length} người (${up.filter(u => (u.tier || 'khach') === 'khach').length} Khách hàng, ${up.filter(u => u.tier === 'ctv').length} CTV)`);
console.log(`Xóa: ${n('orders')} đơn hàng (${guestOrders.length} đơn khách chưa có tài khoản), ${n('commissions')} dòng hoa hồng, ${n('wallet')} giao dịch ví, ${n('topups')} lệnh nạp, ${n('fundbook')} dòng sổ quỹ, ${n('coupons')} mã giảm giá, ${((D.wheel || {}).spins || []).length} lượt quay, ${((D.wheel || {}).codes || []).length} mã quay, ${n('promos')} chương trình khuyến mãi`);
console.log('Số dư đang có: ' + WK.map(k => `${A.WALLETS[k].short} ${sum(k).toLocaleString('vi-VN')}`).join(', ') + ` · tổng ${WK.reduce((s, k) => s + sum(k), 0).toLocaleString('vi-VN')}`);
if (!run) { console.log('\nChưa đổi gì. Thêm --chay để làm (dừng máy chủ trước).'); process.exit(0); }

// 1. sao lưu + số dư từng người
const st = new Date(Date.now() + 7 * 36e5).toISOString().replace(/[-:T]/g, '').slice(0, 12);
fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
const bak = path.join(dir, 'backups', `truoc-lam-moi-${st}.db`), csv = path.join(dir, 'backups', `so-du-truoc-lam-moi-${st}.csv`);
sql.exec(`VACUUM INTO '${bak.replace(/'/g, "''")}'`);
const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
fs.writeFileSync(csv, '﻿' + [['Mã', 'Họ tên', 'Tên truy cập', 'Cấp', ...WK.map(k => A.WALLETS[k].name)].map(q).join(','),
  ...bal.map(({ u, b }) => [u.code, u.name, u.username, (A.TIERS[u.tier] || {}).name || u.role, ...WK.map(k => b[k])].map(q).join(','))].join('\n'));

// 2. lên đại lý
for (const u of up) { if ((u.tier || 'khach') === 'khach') u.activated = u.activated || today; u.tier = 'daily'; u.agentSince = today; }
for (const u of D.users) { delete u.ctvPending; delete u.agentPending; delete u.pkgLeft; }

// 3. xóa dữ liệu kinh doanh, số đơn mới tiếp nối số cũ
D.orderSeq = Math.max(+D.orderSeq || 0, ...(D.orders || []).map(o => +String(o.id).replace(/\D/g, '') || 0));
for (const k of ['orders', 'commissions', 'wallet', 'topups', 'fund', 'fundbook', 'coupons']) D[k] = [];
D.guestRefs = {};
if (D.wheel) { D.wheel.spins = []; D.wheel.codes = []; D.wheel.forced = {}; D.wheel.events = []; }
// anh chốt: tài khoản đang có không quay vòng chào mừng nữa, chỉ người đăng ký sau đợt này mới được quay
for (const u of D.users) if (u.role !== 'admin' && !u.welcomeSpun) u.welcomeSpun = today + 'T00:00:00';
D.promos = [];
(D.logs = D.logs || []).unshift({ id: 'nk' + Date.now().toString(36), date: today, actor: 'Hệ thống', action: 'Làm mới dữ liệu', detail: `${up.length} thành viên lên Đại lý; xóa đơn hàng, hoa hồng, ví, quỹ điểm, voucher, mã quay, khuyến mãi. Sao lưu ${path.basename(bak)}` });

sql.prepare("UPDATE kv SET v = ?, at = ? WHERE k = 'db'").run(JSON.stringify(D), Date.now());
sql.prepare("DELETE FROM tokens WHERE kind IN ('confirm', 'ship')").run();
console.log(`\nĐã làm xong. Sao lưu: ${bak}\nSố dư từng người trước khi xóa: ${csv}\nKhởi động lại máy chủ.`);
