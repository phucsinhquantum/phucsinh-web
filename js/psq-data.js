/* Phúc Sinh QuanTum: dữ liệu mở rộng cho quản trị và trang thành viên
   (phả hệ giới thiệu, ví, hoa hồng, nạp điểm, kho, chi phí, nhật ký, thư, địa chỉ, quỹ tri ân, thiết lập).
   Tất cả lưu chung trong psq_db_v1 trên trình duyệt để chạy thử. Bản chính thức cần máy chủ và cơ sở dữ liệu.
   Cần nạp sau js/data.js và js/app.js. */
(function () {
  const { db, today } = PSQ;
  const VERSION = 2;

  const DEFAULT_SETTINGS = {
    shopName: SITE.brand, hotline: SITE.phone, email: SITE.email, address: SITE.address,
    pointRate: SITE.pointRate || 0.1,            // điểm PS = tỉ lệ x giá trị đơn
    commission: [10, 5, 3],                      // % hoa hồng theo tầng F1, F2, F3 (mẫu)
    fundRate: 1,                                 // % doanh thu đơn hoàn thành trích vào Quỹ tri ân (mẫu)
    minWithdraw: 500000,
    autoPlace: false,                            // tự xếp lên cây khi có người giới thiệu
    mailSender: 'Phúc Sinh QuanTum <no-reply@phucsinh.vn>',
    leaderRanks: [                               // cấp bậc lãnh đạo (mẫu)
      { id: 'tv', name: 'Thành viên', minTeam: 0, minSales: 0, bonus: 0, color: '#9aa7ab' },
      { id: 'tn', name: 'Trưởng nhóm', minTeam: 3, minSales: 50000000, bonus: 1, color: '#4fe6df' },
      { id: 'gd', name: 'Giám đốc kinh doanh', minTeam: 8, minSales: 200000000, bonus: 2, color: '#b98cff' },
      { id: 'gdv', name: 'Giám đốc vùng', minTeam: 20, minSales: 600000000, bonus: 3, color: '#f3c76b' }
    ]
  };
  const DEFAULT_ROLES = [
    { id: 'owner', name: 'Chủ sở hữu', note: 'Toàn quyền', perms: ['*'] },
    { id: 'manager', name: 'Quản lý', note: 'Quản lý vận hành, không đổi thiết lập hệ thống', perms: ['dashboard', 'orders', 'products', 'content', 'members', 'tree', 'stock', 'finance.view', 'messages'] },
    { id: 'sale', name: 'Kinh doanh', note: 'Đơn hàng, thành viên, tin nhắn', perms: ['dashboard', 'orders', 'members', 'messages'] },
    { id: 'kho', name: 'Thủ kho', note: 'Tồn kho, phiếu nhập, đơn hàng', perms: ['orders', 'stock', 'products'] },
    { id: 'ketoan', name: 'Kế toán', note: 'Tài chính, đối soát, chi phí', perms: ['dashboard', 'finance', 'orders'] },
    { id: 'content', name: 'Biên tập', note: 'Bài viết, video, danh mục', perms: ['content', 'products'] }
  ];
  const PERMS = [
    ['dashboard', 'Xem tổng quan'], ['orders', 'Đơn hàng'], ['products', 'Sản phẩm và danh mục'], ['content', 'Bài viết, video'],
    ['members', 'Thành viên'], ['tree', 'Phả hệ'], ['stock', 'Kho'], ['finance', 'Tài chính (sửa)'], ['finance.view', 'Tài chính (xem)'],
    ['messages', 'Tin nhắn'], ['system', 'Thiết lập hệ thống'], ['admins', 'Tài khoản quản trị']
  ];

  let n = 0; const uid = p => p + Date.now().toString(36) + (n++).toString(36);
  const daysAgo = k => { const d = new Date(); d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
  const stamp = (k, h) => daysAgo(k) + ' ' + String(8 + (h % 11)).padStart(2, '0') + ':' + String((h * 17) % 60).padStart(2, '0');

  /* ---------- nâng cấp dữ liệu cũ + dữ liệu mẫu (chạy 1 lần) ---------- */
  function migrate(d) {
    if (d.v >= VERSION) return false;
    let r = 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
    d.roles = d.roles || DEFAULT_ROLES.map(x => ({ ...x }));

    // tài khoản quản trị mẫu thêm (đăng nhập bằng mật khẩu 123456)
    const adm = d.users.find(u => u.id === 'u-admin'); if (adm) { adm.adminRole = adm.adminRole || 'owner'; adm.code = adm.code || 'PS1000'; adm.placed = true; }
    const h123 = (d.users.find(u => u.id === 'u1') || {}).pass;
    if (h123 && !d.users.some(u => u.id === 'u-staff1')) {
      d.users.push({ id: 'u-staff1', name: 'Nguyễn Thu Trang', email: 'kinhdoanh@psq.vn', phone: '0901000111', pass: h123, role: 'admin', adminRole: 'sale', created: daysAgo(120), status: 'active' });
      d.users.push({ id: 'u-staff2', name: 'Lê Văn Khoa', email: 'kho@psq.vn', phone: '0901000222', pass: h123, role: 'admin', adminRole: 'kho', created: daysAgo(90), status: 'active' });
      d.users.push({ id: 'u-staff3', name: 'Trần Minh Châu', email: 'ketoan@psq.vn', phone: '0901000333', pass: h123, role: 'admin', adminRole: 'ketoan', created: daysAgo(60), status: 'locked' });
    }

    // phả hệ: mỗi thành viên có người giới thiệu là một người tham gia trước
    const mem = d.users.filter(u => u.role !== 'admin').sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    mem.forEach((u, i) => {
      u.code = u.code || 'PS' + (1001 + i);
      u.status = u.status || 'active';
      if (u.sponsor === undefined) u.sponsor = i === 0 ? null : mem[Math.floor(rnd() * i)].id;
      if (u.placed === undefined) u.placed = true;
      if (u.sponsor === null) u.placed = true;
      u.parent = u.parent || (u.placed ? u.sponsor : null);
    });
    // 2 người mới đăng ký qua mã giới thiệu, đang chờ xếp lên cây
    if (h123 && !d.users.some(u => u.id === 'u-new1') && mem.length > 3) {
      d.users.push({ id: 'u-new1', name: 'Phan Thị Hồng', email: 'hong.phan@email.com', phone: '0912345601', pass: h123, role: 'member', created: daysAgo(1), status: 'active', code: 'PS' + (1001 + mem.length), sponsor: mem[1].id, placed: false, parent: null, city: 'Huế' });
      d.users.push({ id: 'u-new2', name: 'Vũ Đình Long', email: 'long.vu@email.com', phone: '0912345602', pass: h123, role: 'member', created: daysAgo(0), status: 'active', code: 'PS' + (1002 + mem.length), sponsor: mem[3].id, placed: false, parent: null, city: 'Hà Nội' });
    }

    const S = d.settings, byId = id => d.users.find(u => u.id === id);
    const done = o => o.status === 'done' || o.status === 'paid' || o.status === 'ship';

    // hoa hồng theo tầng từ đơn hàng
    d.commissions = [];
    d.orders.filter(o => o.status !== 'failed').forEach(o => {
      let up = byId(o.userId); let lvl = 0;
      while (up && up.sponsor && lvl < S.commission.length) {
        const rec = byId(up.sponsor); if (!rec) break;
        const rate = S.commission[lvl];
        d.commissions.push({ id: uid('hh'), order: o.id, user: rec.id, from: o.userId, level: lvl + 1, rate, amount: Math.round(o.total * rate / 100), date: o.date, status: o.status === 'done' ? 'paid' : o.status === 'pending' ? 'pending' : 'approved' });
        up = rec; lvl++;
      }
    });

    // nạp điểm
    d.topups = [];
    const methods = ['Chuyển khoản', 'Ví MoMo', 'Tiền mặt tại cửa hàng'];
    mem.slice(0, 9).forEach((u, i) => {
      const amount = [500000, 1000000, 2000000, 5000000][i % 4];
      d.topups.push({ id: uid('nd'), user: u.id, amount, points: amount, method: methods[i % 3], status: i === 2 ? 'pending' : i === 6 ? 'rejected' : 'done', date: daysAgo(i * 4 + 1), note: '' });
    });

    // ví: sổ cái giao dịch (hoa hồng đã duyệt, nạp điểm, rút tiền, dùng điểm)
    d.wallet = [];
    d.commissions.filter(c => c.status === 'paid').forEach(c => d.wallet.push({ id: uid('gd'), user: c.user, type: 'commission', amount: c.amount, ref: c.order, date: c.date, note: `Hoa hồng F${c.level} từ đơn ${c.order}`, status: 'done' }));
    d.topups.filter(t => t.status === 'done').forEach(t => d.wallet.push({ id: uid('gd'), user: t.user, type: 'topup', amount: t.amount, ref: t.id, date: t.date, note: 'Nạp điểm qua ' + t.method, status: 'done' }));
    mem.slice(0, 4).forEach((u, i) => d.wallet.push({ id: uid('gd'), user: u.id, type: 'withdraw', amount: -[800000, 1200000, 600000, 2000000][i], ref: '', date: daysAgo(i * 6 + 3), note: 'Rút về tài khoản ngân hàng', status: i === 1 ? 'pending' : 'done' }));
    mem.slice(4, 8).forEach((u, i) => d.wallet.push({ id: uid('gd'), user: u.id, type: 'spend', amount: -[300000, 450000, 900000, 250000][i], ref: '', date: daysAgo(i * 5 + 2), note: 'Dùng điểm thanh toán đơn hàng', status: 'done' }));

    // quỹ tri ân
    d.fund = [];
    for (let m = 0; m < 4; m++) {
      const rev = d.orders.filter(o => done(o)).reduce((s, o) => s + o.total, 0) / 4;
      d.fund.push({ id: uid('qt'), type: 'in', amount: Math.round(rev * S.fundRate / 100), date: daysAgo(m * 30 + 1), note: `Trích ${S.fundRate}% doanh thu tháng`, who: '' });
    }
    d.fund.push({ id: uid('qt'), type: 'out', amount: 1500000, date: daysAgo(20), note: 'Quà tri ân khách hàng thân thiết', who: (mem[2] || {}).name || '' });
    d.fund.push({ id: uid('qt'), type: 'out', amount: 3000000, date: daysAgo(45), note: 'Hỗ trợ hoàn cảnh khó khăn (thiện nguyện)', who: 'Mái ấm (mẫu)' });

    // kho
    d.stock = {}; PRODUCTS.forEach((p, i) => { d.stock[p.id] = Math.floor(rnd() * 28) + (i % 6 === 0 ? 0 : 2); });
    d.stockMin = 3;
    d.receipts = [];
    const sup = ['Xưởng trầm Quảng Nam (mẫu)', 'Hợp tác xã trầm Khánh Hòa (mẫu)', 'Nhà cung cấp trà (mẫu)'];
    for (let k = 0; k < 5; k++) {
      const items = []; for (let j = 0; j < 3; j++) { const p = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)]; if (!items.find(x => x.id === p.id)) items.push({ id: p.id, name: p.name, qty: 2 + Math.floor(rnd() * 8), cost: Math.round(p.price * .55 / 1000) * 1000 }); }
      d.receipts.push({ id: 'PN' + (205 - k), date: daysAgo(k * 9 + 2), supplier: sup[k % 3], items, total: items.reduce((s, x) => s + x.qty * x.cost, 0), by: k % 2 ? 'Lê Văn Khoa' : 'Quản trị viên', note: '' });
    }

    // chi phí
    d.expenses = [];
    const ex = [['Mặt bằng', 'Thuê cửa hàng', 18000000], ['Nhân sự', 'Lương nhân viên', 42000000], ['Quảng cáo', 'Quảng cáo Facebook', 8500000], ['Vận chuyển', 'Phí giao hàng', 3200000], ['Bao bì', 'Hộp quà, túi vải', 4600000], ['Khác', 'Điện nước, internet', 2100000]];
    for (let m = 0; m < 3; m++) ex.forEach(([cat, name, amt], i) => d.expenses.push({ id: uid('cp'), cat, name, amount: Math.round(amt * (0.85 + rnd() * .3) / 1000) * 1000, date: daysAgo(m * 30 + i * 2 + 1), note: '' }));

    // sổ địa chỉ
    d.addresses = [];
    mem.forEach((u, i) => d.addresses.push({ id: uid('dc'), user: u.id, name: u.name, phone: u.phone, line: (12 + i * 7) + ' đường số ' + (i + 3) + ' (mẫu)', province: u.city || 'Hà Nội', isDefault: true }));
    d.stores = [
      { id: 'st1', name: 'Showroom Phúc Sinh QuanTum', line: SITE.address, phone: SITE.phone, type: 'Cửa hàng' },
      { id: 'st2', name: 'Kho tổng', line: 'Khu công nghiệp (mẫu)', phone: SITE.phone, type: 'Kho' }
    ];

    // thư đã gửi
    d.mails = [];
    d.orders.slice(0, 14).forEach((o, i) => d.mails.push({ id: uid('ml'), date: stamp(Math.floor(i * 1.15), i), to: o.email, subject: `Xác nhận đơn hàng ${o.id}`, type: 'Đơn hàng', status: i === 5 ? 'failed' : 'sent' }));
    mem.slice(-4).forEach((u, i) => d.mails.push({ id: uid('ml'), date: stamp(i * 9 + 2, i + 3), to: u.email, subject: 'Chào mừng anh chị đến với Phúc Sinh QuanTum', type: 'Đăng ký', status: 'sent' }));
    d.mails.sort((a, b) => b.date.localeCompare(a.date));

    // nhật ký thao tác
    d.logs = [];
    const acts = [['Quản trị viên', 'Đăng nhập', 'Đăng nhập trang quản trị'], ['Nguyễn Thu Trang', 'Cập nhật đơn hàng', 'PSQ1098: Đang giao → Hoàn thành'], ['Lê Văn Khoa', 'Nhập kho', 'Tạo phiếu nhập PN205'], ['Quản trị viên', 'Sửa sản phẩm', 'Cập nhật giá Vòng trầm 14 li'], ['Nguyễn Thu Trang', 'Duyệt nạp điểm', 'Duyệt 1.000.000đ cho khách'], ['Quản trị viên', 'Xếp lên cây', 'Xếp thành viên vào nhánh'], ['Lê Văn Khoa', 'Cập nhật tồn kho', 'Kiểm kê cuối tuần'], ['Quản trị viên', 'Thêm video', 'Thêm video trải nghiệm khách hàng']];
    for (let k = 0; k < 18; k++) { const a = acts[k % acts.length]; d.logs.push({ id: uid('nk'), date: stamp(Math.floor(k * .8), k), actor: a[0], action: a[1], detail: a[2] }); }

    d.v = VERSION;
    return true;
  }

  /* ---------- hàm dùng chung ---------- */
  const ADB = {
    PERMS, DEFAULT_SETTINGS, uid, daysAgo,
    load() { const d = db.load(); if (migrate(d)) db.save(d); return d; },
    save(d) { db.save(d); },
    reset() { const d = db.reset(); migrate(d); db.save(d); return d; },
    user(d, id) { return d.users.find(u => u.id === id) || null; },
    me() { const u = PSQ.auth.user(); return u ? ADB.user(ADB.load(), u.id) : null; },
    // ghi nhật ký thao tác (chưa lưu, gọi ADB.save sau)
    log(d, action, detail) {
      const u = PSQ.auth.user(); const now = new Date();
      (d.logs = d.logs || []).unshift({ id: uid('nk'), date: now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5), actor: u ? u.name : 'Hệ thống', action, detail: detail || '' });
    },
    // thành viên tuyến dưới trực tiếp trên cây
    children(d, id) { return d.users.filter(u => u.role !== 'admin' && u.placed && u.parent === id); },
    // toàn bộ tuyến dưới (theo cây), kèm tầng
    downline(d, id, max = 99) {
      const out = []; const walk = (pid, lvl) => { if (lvl > max) return; ADB.children(d, pid).forEach(c => { out.push({ user: c, level: lvl }); walk(c.id, lvl + 1); }); };
      walk(id, 1); return out;
    },
    // cây lồng nhau để vẽ sơ đồ
    tree(d, id) { const u = ADB.user(d, id); return u ? { user: u, kids: ADB.children(d, id).map(c => ADB.tree(d, c.id)) } : null; },
    roots(d) { return d.users.filter(u => u.role !== 'admin' && u.placed && !u.parent); },
    pending(d) { return d.users.filter(u => u.role !== 'admin' && !u.placed); },
    // doanh số cá nhân và nhóm (đơn không hủy)
    sales(d, id) { return d.orders.filter(o => o.userId === id && o.status !== 'failed').reduce((s, o) => s + o.total, 0); },
    teamSales(d, id) { return ADB.downline(d, id).reduce((s, x) => s + ADB.sales(d, x.user.id), ADB.sales(d, id)); },
    // cấp bậc lãnh đạo đạt được theo số người trong nhóm và doanh số nhóm
    leader(d, id) {
      const team = ADB.downline(d, id).length, sales = ADB.teamSales(d, id); let r = d.settings.leaderRanks[0];
      d.settings.leaderRanks.forEach(k => { if (team >= k.minTeam && sales >= k.minSales) r = k; });
      return { rank: r, team, sales };
    },
    // số dư ví (giao dịch đã hoàn tất)
    balance(d, id) { return (d.wallet || []).filter(w => w.user === id && w.status === 'done').reduce((s, w) => s + w.amount, 0); },
    // tạo hoa hồng cho một đơn mới theo thiết lập
    commissionsFor(d, order) {
      const out = []; let up = ADB.user(d, order.userId), lvl = 0;
      while (up && up.sponsor && lvl < d.settings.commission.length) {
        const rec = ADB.user(d, up.sponsor); if (!rec) break;
        const rate = d.settings.commission[lvl];
        out.push({ id: uid('hh'), order: order.id, user: rec.id, from: order.userId, level: lvl + 1, rate, amount: Math.round(order.total * rate / 100), date: order.date || today(), status: 'pending' });
        up = rec; lvl++;
      }
      return out;
    },
    // tải bảng ra CSV (mở bằng Excel)
    csv(name, rows) {
      const s = '﻿' + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv' })); a.download = name + '.csv'; a.click();
    },
    commissionStatus: { pending: ['Chờ duyệt', 'pending'], approved: ['Đã duyệt', 'ship'], paid: ['Đã trả', 'paid'], cancel: ['Đã hủy', 'failed'] },
    walletType: { commission: 'Hoa hồng', topup: 'Nạp điểm', withdraw: 'Rút tiền', spend: 'Dùng điểm', bonus: 'Thưởng', adjust: 'Điều chỉnh' }
  };
  window.ADB = ADB;
  ADB.load(); // nâng cấp dữ liệu ngay khi nạp trang (để tài khoản nhân viên mẫu đăng nhập được)
})();
