/* Lấy dữ liệu cho bản thử từ bản sao lưu của bản chính, che thông tin khách.
   Chạy: node --no-warnings server/tools/du-lieu-thu.js <bản sao lưu psq-....db> <thư mục dữ liệu bản thử>
   - Thành viên: tên, email, số điện thoại đổi theo mã (PS1001 -> "Thành viên PS1001", ps1001@thu.local).
     Mật khẩu mọi thành viên đặt chung là "thu123456" để đăng nhập thử bằng mã PS.
   - Tài khoản quản trị giữ nguyên (đăng nhập bản thử bằng mật khẩu như bản chính).
   - Đơn hàng, địa chỉ, tin nhắn, tài khoản ngân hàng rút tiền: thay tên, số điện thoại, địa chỉ.
   - Bỏ cài đặt thư, phiên đăng nhập, mã một lần, nhật ký thư và nhật ký thao tác.
   Ghi đè psq.db của bản thử (bản cũ đổi tên thành psq.db.cu-<thời gian>). Chạy khi máy chủ bản thử đã dừng. */
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { hashPass } = require('../actions');

const [src, destDir] = process.argv.slice(2);
if (!src || !destDir || !fs.existsSync(src)) { console.error('Cách dùng: du-lieu-thu.js <bản sao lưu .db> <thư mục dữ liệu bản thử>'); process.exit(1); }
const out = path.join(destDir, 'psq.db');
if (fs.existsSync(out)) { const st = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12); for (const x of ['', '-wal', '-shm']) if (fs.existsSync(out + x)) fs.renameSync(out + x, out + '.cu-' + st + x); }
fs.copyFileSync(src, out);

const db = new DatabaseSync(out);
const D = JSON.parse(db.prepare("SELECT v FROM kv WHERE k = 'db'").get().v);
const swap = new Map();   // chuỗi thật -> chuỗi đã che, dùng để quét nốt mọi chỗ còn sót
const fake = (real, masked) => { if (real && String(real).length >= 3) swap.set(String(real), masked); return masked; };
const phoneOf = code => '09' + String(code).replace(/\D/g, '').padStart(8, '0').slice(-8);
const testPass = hashPass('thu123456');

for (const u of D.users || []) {
  if (u.role === 'admin') continue;
  const c = u.code || u.id;
  u.name = fake(u.name, 'Thành viên ' + c);
  u.email = fake(u.email, c.toLowerCase() + '@thu.local');
  u.phone = fake(u.phone, phoneOf(c));
  if (u.address) u.address = fake(u.address, 'Địa chỉ thử ' + c);
  if (u.bank) u.bank = { name: 'Ngân hàng thử', account: '0000' + String(c).replace(/\D/g, ''), owner: 'THANH VIEN ' + c };
  delete u.avatar;
  u.pass = testPass; u.verified = true;
}
let k = 0;
for (const o of D.orders || []) {
  k++; const u = (D.users || []).find(x => x.id === o.userId);
  o.name = fake(o.name, u ? u.name : 'Khách lẻ ' + k);
  o.phone = fake(o.phone, u ? u.phone : phoneOf(900000 + k));
  if (o.email) o.email = fake(o.email, u ? u.email : 'khach' + k + '@thu.local');
  o.address = fake(o.address, 'Địa chỉ thử ' + k);
  delete o.bills;
}
for (const a of D.addresses || []) { a.name = fake(a.name, 'Người nhận thử'); a.phone = fake(a.phone, phoneOf(800000 + ++k)); a.line = fake(a.line, 'Địa chỉ thử ' + k); }
for (const m of D.messages || []) { m.name = fake(m.name, 'Khách liên hệ'); if (m.phone) m.phone = fake(m.phone, phoneOf(700000 + ++k)); if (m.email) m.email = fake(m.email, 'lienhe' + k + '@thu.local'); m.message = '(nội dung đã ẩn ở bản thử)'; }
for (const t of D.topups || []) { if (t.account) t.account = fake(t.account, '0000' + ++k); if (t.bill) delete t.bill; delete t.bills; }
D.mails = []; D.logs = [];

// quét nốt: chuỗi thật còn nằm trong ghi chú, mô tả... thì thay luôn
const real = [...swap.keys()].sort((a, b) => b.length - a.length);
const scrub = v => {
  if (typeof v === 'string') { let s = v; for (const r of real) if (s.includes(r)) s = s.split(r).join(swap.get(r)); return s; }
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') { for (const x of Object.keys(v)) v[x] = scrub(v[x]); return v; }
  return v;
};
const keepAdmins = (D.users || []).filter(u => u.role === 'admin').map(u => JSON.stringify(u));
scrub(D);
(D.users || []).filter(u => u.role === 'admin').forEach((u, i) => Object.assign(u, JSON.parse(keepAdmins[i])));

db.prepare("UPDATE kv SET v = ? WHERE k = 'db'").run(JSON.stringify(D));
db.prepare("DELETE FROM kv WHERE k = 'secret:mail'").run();
db.prepare('DELETE FROM sessions').run();
db.prepare('DELETE FROM tokens').run();
db.exec('VACUUM');
db.close();
console.log(`Đã tạo dữ liệu bản thử ${out}: ${(D.users || []).length} tài khoản, ${(D.orders || []).length} đơn. Mật khẩu thành viên thử: thu123456`);
