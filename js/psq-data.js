/* Phúc Sinh QuanTum: dữ liệu mở rộng cho quản trị và trang thành viên
   (phả hệ giới thiệu, ví, hoa hồng, nạp điểm, kho, chi phí, nhật ký, thư, địa chỉ, quỹ tri ân, thiết lập).
   Tất cả lưu chung trong psq_db_v1 trên trình duyệt để chạy thử. Bản chính thức cần máy chủ và cơ sở dữ liệu.
   Cần nạp sau js/data.js và js/app.js. */
(function () {
  const { db, today } = PSQ;
  const VERSION = 4;

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
  function migrateV2(d) {
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

    d.v = 2;
  }
  function migrate(d) {
    if (d.v >= VERSION) return false;
    if (!(d.v >= 2)) migrateV2(d);
    if (d.v < 3) migrateV3(d);
    if (d.v < 4) migrateV4(d);
    d.v = VERSION; return true;
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

  /* =====================================================================
     KẾ HOẠCH TRẢ THƯỞNG (v3): cấp bậc Khách / Cộng tác viên / Đại lý và 4 ví
     Tỉ lệ nằm trong d.settings.plan, quản trị đổi được ở Thiết lập hệ thống.
     1 điểm PS = 1 đồng.
     ===================================================================== */
  const PLAN = {
    pkgPrice: 686000, pkgPoints: 346000,          // gói kích hoạt CTV: 346k PS vào ví mua hàng, 340k phí nền tảng
    refBonus: 200000,                              // giới thiệu được 1 CTV kích hoạt gói
    ctvRate: 10, agentRate: 25,                    // % hoa hồng trên đơn của người mình giới thiệu trực tiếp
    overrideRate: 40, overrideShop: 10,            // đại lý hưởng 40% thu nhập của đại lý mình giới thiệu; 10% phần này vào ví mua hàng
    taxRate: 10,                                   // thuế khi rút ví hoa hồng và khi chuyển điểm thưởng sang khả dụng
    agentThreshold: 16800000,                      // tổng mua cộng dồn để lên đại lý
    pkgCountsAs: 346000                            // phần của gói tính vào doanh số mua hàng (mốc đại lý)
  };
  const PKG_ID = 'goi-ctv';
  // thứ tự hiển thị: hàng trên tiền mặt, điểm khả dụng; hàng dưới hoa hồng bán hàng, điểm thưởng, điểm mua hàng
  // tiền (VNĐ): cash, sales · điểm (PS): avail, bonus, shop
  const WALLETS = {
    cash: { name: 'Ví tiền mặt', short: 'Tiền mặt', color: '#ff9f6b', icon: 'card', unit: 'vnd', note: 'Nạp từ ngân hàng, mua hàng, đổi sang điểm PS hoặc rút về ngân hàng' },
    avail: { name: 'Ví điểm khả dụng', short: 'Điểm khả dụng', color: '#4fe6df', icon: 'gem', unit: 'ps', note: 'Điểm đã trừ thuế, chuyển cho thành viên khác hoặc sang ví mua hàng' },
    sales: { name: 'Ví hoa hồng bán hàng', short: 'Hoa hồng bán hàng', color: '#f3c76b', icon: 'wallet', unit: 'vnd', note: 'Hoa hồng bằng tiền, rút sang ví tiền mặt trừ thuế thu nhập 10%' },
    bonus: { name: 'Ví điểm thưởng', short: 'Điểm thưởng', color: '#b98cff', icon: 'gift', unit: 'ps', note: 'Thu nhập từ đại lý tuyến dưới, chuyển sang ví khả dụng trừ thuế 10%' },
    shop: { name: 'Ví điểm mua hàng', short: 'Điểm mua hàng', color: '#45e08f', icon: 'bag', unit: 'ps', note: 'Chỉ dùng để thanh toán đơn hàng, không chuyển sang ví khác' }
  };
  const TIERS = {
    khach: { name: 'Khách hàng', color: '#9aa7ab' },
    ctv: { name: 'Cộng tác viên', color: '#4fe6df' },
    daily: { name: 'Đại lý', color: '#f3c76b' }
  };
  // ví mặc định cho giao dịch cũ chưa ghi ví
  const legacyWallet = t => ({ commission: 'sales', referral: 'sales', withdraw: 'sales', topup: 'cash', spend: 'shop', package: 'shop' }[t] || 'avail');
  const PAID = o => ['paid', 'ship', 'done'].includes(o.status);
  const plan = d => (d.settings.plan = Object.assign({}, PLAN, d.settings.plan || {}));
  const pct = (v, r) => Math.round(v * r / 100);
  const itemsTotal = o => (o.items || []).reduce((s, x) => s + x.price * x.qty, 0);
  const now = () => { const t = new Date(); return t.toISOString().slice(0, 10); };

  function credit(d, user, wallet, type, amount, note, ref, extra) {
    if (!amount) return null;
    const w = Object.assign({ id: uid('gd'), user, wallet, type, amount, ref: ref || '', date: now(), note: note || '', status: 'done' }, extra || {});
    (d.wallet = d.wallet || []).push(w); return w;
  }
  // trả một khoản hoa hồng vào ví
  function payCommission(d, c) {
    const P = plan(d);
    if (c.kind === 'override') {
      const shop = pct(c.amount, P.overrideShop);
      credit(d, c.user, 'bonus', 'override', c.amount - shop, `40% thu nhập của đại lý ${(ADB.user(d, c.from) || {}).name || ''} (đơn ${c.order})`, c.order, { date: c.date });
      credit(d, c.user, 'shop', 'override', shop, `${P.overrideShop}% thu nhập đại lý tuyến dưới vào ví mua hàng`, c.order, { date: c.date });
    } else {
      credit(d, c.user, 'sales', c.kind === 'ref' ? 'referral' : 'commission', c.amount, c.kind === 'ref' ? `Thưởng giới thiệu CTV ${(ADB.user(d, c.from) || {}).name || ''}` : `Hoa hồng ${c.rate}% đơn ${c.order}`, c.order, { date: c.date });
    }
    c.status = 'paid';
    // đại lý B có thu nhập (kể cả thu nhập B nhận từ tầng dưới): đại lý A (người giới thiệu B) hưởng 40%, tính tiếp lên trên
    {
      const r = ADB.user(d, c.user), up = r && r.sponsor && ADB.user(d, r.sponsor), P = plan(d), depth = (c.depth || 0) + 1, amount = pct(c.amount, P.overrideRate);
      if (r && r.tier === 'daily' && up && up.tier === 'daily' && depth <= 30 && amount >= 1)
        addCommission(d, { kind: 'override', order: c.order, user: up.id, from: r.id, level: depth + 1, depth, rate: P.overrideRate, base: c.amount, amount, date: c.date });
    }
  }
  function addCommission(d, c) {
    c = Object.assign({ id: uid('hh'), level: 1, status: 'paid' }, c);
    (d.commissions = d.commissions || []).push(c);
    if (c.status === 'paid') payCommission(d, c);
    return c;
  }
  // ghi nhận một đơn đã thanh toán: kích hoạt CTV, hoa hồng, lên đại lý (chạy 1 lần mỗi đơn)
  function settleOrder(d, o) {
    if (!o || o.settled || !PAID(o)) return false;
    const buyer = ADB.user(d, o.userId); o.settled = true;
    if (!buyer) return true;
    const P = plan(d), sp = buyer.sponsor ? ADB.user(d, buyer.sponsor) : null, date = o.date || now();
    buyer.tier = buyer.tier || 'khach';
    const isPkg = (o.items || []).some(x => x.id === PKG_ID);
    if (isPkg) {
      if (buyer.tier === 'khach') { buyer.tier = 'ctv'; buyer.activated = date; }
      credit(d, buyer.id, 'shop', 'package', P.pkgPoints, 'Điểm mua hàng từ gói kích hoạt cộng tác viên', o.id, { date });
      if (sp && (sp.tier === 'ctv' || sp.tier === 'daily')) addCommission(d, { kind: 'ref', order: o.id, user: sp.id, from: buyer.id, rate: 0, base: P.pkgPrice, amount: P.refBonus, date });
      else if (sp) addCommission(d, { kind: 'missed', order: o.id, user: sp.id, from: buyer.id, rate: 0, base: P.pkgPrice, amount: P.refBonus, date, status: 'missed', note: 'Chưa kích hoạt cộng tác viên' });
    } else if (buyer.tier === 'ctv' || buyer.tier === 'daily') {
      const first = buyer.tier === 'ctv' && !buyer.firstOrderDone;
      if (buyer.tier === 'ctv') buyer.firstOrderDone = true;
      if (sp && !first) {
        const base = itemsTotal(o), rate = sp.tier === 'daily' ? P.agentRate : sp.tier === 'ctv' ? P.ctvRate : 0;
        if (rate) addCommission(d, { kind: 'direct', order: o.id, user: sp.id, from: buyer.id, rate, base, amount: pct(base, rate), date });
        if (rate < P.agentRate) addCommission(d, { kind: 'missed', order: o.id, user: sp.id, from: buyer.id, rate: P.agentRate - rate, base, amount: pct(base, P.agentRate - rate), date, status: 'missed', note: rate ? 'Phần chênh lệch nếu là đại lý' : 'Chưa kích hoạt cộng tác viên' });
      }
    }
    // lên đại lý khi tổng mua cộng dồn đủ mốc
    if (buyer.tier !== 'daily' && ADB.spent(d, buyer.id) >= P.agentThreshold) { buyer.tier = 'daily'; buyer.agentSince = date; }
    return true;
  }

  function migrateV3(d) {
    let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    plan(d);
    const mem = d.users.filter(u => u.role !== 'admin').sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    const taken = new Set(d.users.map(u => u.username).filter(Boolean));
    d.users.forEach(u => {
      if (!u.username) { let b = (u.email || u.code || 'tv').split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '') || 'tv', n = b, k = 1; while (taken.has(n)) n = b + (++k); u.username = n; taken.add(n); }
      if (u.role !== 'admin') { u.tier = 'khach'; delete u.firstOrderDone; delete u.activated; delete u.agentSince; }
    });
    // tài khoản mẫu khach1 có đội nhóm riêng để xem trang thành viên
    const demo = ADB.user(d, 'u1');
    if (demo) ['u2', 'u4', 'u10'].forEach(id => { const x = ADB.user(d, id); if (x && x.sponsor !== 'u1' && demo.sponsor !== id) { if (x.parent === x.sponsor) x.parent = 'u1'; x.sponsor = 'u1'; } });
    // dựng lại sổ hoa hồng và ví theo kế hoạch mới
    d.commissions = []; d.wallet = [];
    d.orders.forEach(o => { delete o.settled; });
    // thành viên đã từng mua: tạo đơn gói kích hoạt CTV vào ngày đăng ký (dữ liệu mẫu)
    const P = d.settings.plan;
    mem.forEach((u, i) => {
      if (!d.orders.some(o => o.userId === u.id) && i % 3) return;
      d.orders.push({ id: 'KH' + (5001 + i), userId: u.id, name: u.name, phone: u.phone, email: u.email, address: '', pay: 'bank', items: [{ id: PKG_ID, name: 'Gói kích hoạt cộng tác viên', price: P.pkgPrice, qty: 1 }], total: P.pkgPrice, status: 'done', date: [u.created || daysAgo(200), ...d.orders.filter(o => o.userId === u.id).map(o => o.date)].sort()[0], sample: true });
    });
    // chạy lại theo thứ tự thời gian
    d.orders.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id.startsWith('KH') ? -1 : 1)).forEach(o => settleOrder(d, o));
    d.orders.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    // nạp điểm đã duyệt vào ví mua hàng
    (d.topups || []).forEach(t => { if (t.status === 'done') credit(d, t.user, 'shop', 'topup', t.amount, 'Nạp điểm qua ' + t.method, t.id, { date: t.date }); });
    // vài giao dịch mẫu: rút tiền, chuyển điểm
    const rich = mem.map(u => ({ u, b: ADB.balances(d, u.id) })).sort((a, b) => b.b.sales - a.b.sales);
    rich.slice(0, 3).forEach(({ u, b }, i) => { const a = Math.floor(b.sales * (i ? .4 : .3) / 100000) * 100000; if (a >= 500000) { ADB.toCash(d, u, a, { date: daysAgo(i * 5 + 3) }); ADB.withdraw(d, u, Math.floor(a * .9 / 100000) * 100000, { bank: 'Vietcombank (mẫu)', account: '0011' + (1000 + i) }, { status: i === 0 ? 'pending' : 'done', date: daysAgo(i * 5 + 2) }); } });
    const bon = mem.map(u => ({ u, b: ADB.balances(d, u.id) })).filter(x => x.b.bonus > 100000);
    bon.slice(0, 2).forEach(({ u, b }) => ADB.convert(d, u, Math.floor(b.bonus / 2 / 1000) * 1000, { date: daysAgo(3) }));
    void rnd;
  }

  // v4: tiền nạp vào ví tiền mặt (trước đây vào ví mua hàng)
  function migrateV4(d) {
    (d.topups || []).forEach(t => { if (!t.wallet) t.wallet = 'cash'; });
    const moved = {};
    (d.wallet || []).forEach(w => { if (w.type === 'topup' && w.wallet === 'shop') { w.wallet = 'cash'; w.note = String(w.note || '').replace('Nạp điểm', 'Nạp tiền'); moved[w.user] = 1; } });
    // nếu điểm mua hàng đã được tiêu vượt số còn lại thì trả khoản nạp về ví cũ để không âm
    Object.keys(moved).forEach(id => { if (ADB.balances(d, id).shop < 0) d.wallet.forEach(w => { if (w.user === id && w.type === 'topup' && w.wallet === 'cash') w.wallet = 'shop'; }); });
  }

  Object.assign(ADB, {
    PLAN, PKG_ID, WALLETS, TIERS, plan, settleOrder, addCommission, payCommission, credit, legacyWallet,
    tierOf(u) { return TIERS[(u && u.tier) || 'khach'] || TIERS.khach; },
    walletOf(w) { return w.wallet || legacyWallet(w.type); },
    // tổng mua đã thanh toán (gồm cả gói kích hoạt)
    // gói kích hoạt chỉ tính phần điểm mua hàng (346k) vào doanh số
    spent(d, id) { const P = plan(d); return d.orders.filter(o => o.userId === id && PAID(o)).reduce((s, o) => s + o.items.reduce((t, x) => t + (x.id === PKG_ID ? (P.pkgCountsAs ?? P.pkgPoints) * x.qty : x.price * x.qty), 0), 0); },
    // số dư 4 ví; khoản rút đang chờ duyệt đã bị giữ lại
    balances(d, id) {
      const b = { sales: 0, avail: 0, bonus: 0, shop: 0, cash: 0 };
      (d.wallet || []).forEach(w => { if (w.user !== id) return; if (w.status === 'done' || (w.status === 'pending' && w.amount < 0)) b[ADB.walletOf(w)] += w.amount; });
      return b;
    },
    balance(d, id, wallet) { const b = ADB.balances(d, id); return wallet ? b[wallet] : b.sales + b.avail + b.bonus + b.shop + b.cash; },
    byUsername(d, name) { const n = String(name || '').trim().toLowerCase().replace(/^@/, ''); return d.users.find(u => (u.username || '').toLowerCase() === n || (u.code || '').toLowerCase() === n) || null; },
    // tóm tắt thu nhập cho trang thành viên
    earnings(d, id) {
      const C = (d.commissions || []).filter(c => c.user === id), sum = k => C.filter(c => c.kind === k).reduce((s, c) => s + c.amount, 0);
      const e = { ref: sum('ref'), direct: sum('direct'), override: sum('override'), missed: sum('missed') };
      e.total = e.ref + e.direct + e.override; return e;
    },
    // chuyển ví hoa hồng bán hàng sang ví tiền mặt: trừ thuế thu nhập, ví tiền mặt nhận số thực rút
    toCash(d, u, amount, opt = {}) {
      const P = plan(d), b = ADB.balances(d, u.id).sales; amount = Math.round(+amount);
      if (!(amount > 0)) return { error: 'Anh chị nhập số tiền cần rút.' };
      if (amount > b) return { error: 'Số dư ví hoa hồng bán hàng không đủ (còn ' + PSQ.money(b) + ').' };
      const tax = pct(amount, P.taxRate), ref = uid('rt'), date = opt.date || now();
      credit(d, u.id, 'sales', 'tocash', -amount, `Rút sang ví tiền mặt (thuế thu nhập ${P.taxRate}%: ${PSQ.money(tax)})`, ref, { tax, net: amount - tax, date });
      credit(d, u.id, 'cash', 'tocash', amount - tax, `Nhận từ ví hoa hồng bán hàng (đã trừ thuế ${P.taxRate}%)`, ref, { tax, date });
      return { net: amount - tax, tax };
    },
    // rút ví tiền mặt về tài khoản ngân hàng (đã trừ thuế ở bước trên), công ty duyệt và chuyển khoản
    withdraw(d, u, amount, bank, opt = {}) {
      const b = ADB.balances(d, u.id).cash; amount = Math.round(+amount);
      if (!(amount > 0)) return { error: 'Anh chị nhập số tiền cần rút.' };
      if (amount < (d.settings.minWithdraw || 0)) return { error: 'Số tiền rút tối thiểu là ' + PSQ.money(d.settings.minWithdraw) + '.' };
      if (amount > b) return { error: 'Số dư ví tiền mặt không đủ (còn ' + PSQ.money(b) + ').' };
      return { entry: credit(d, u.id, 'cash', 'withdraw', -amount, `Rút về ${bank && bank.bank ? bank.bank + ' ' + (bank.account || '') : 'tài khoản ngân hàng'}`, '', { status: opt.status || 'pending', tax: 0, net: amount, bank: bank || null, date: opt.date || now() }) };
    },
    // chuyển ví điểm thưởng sang ví khả dụng (trừ thuế)
    convert(d, u, amount, opt = {}) {
      const P = plan(d), b = ADB.balances(d, u.id).bonus; amount = Math.round(+amount);
      if (!(amount > 0)) return { error: 'Anh chị nhập số điểm cần chuyển.' };
      if (amount > b) return { error: 'Ví điểm thưởng không đủ (còn ' + PSQ.money(b).replace('đ', ' PS') + ').' };
      const tax = pct(amount, P.taxRate), ref = uid('cd'), date = opt.date || now();
      credit(d, u.id, 'bonus', 'convert', -amount, 'Chuyển sang ví điểm khả dụng', ref, { date });
      credit(d, u.id, 'avail', 'convert', amount - tax, `Nhận từ ví điểm thưởng (đã trừ thuế ${P.taxRate}%: ${PSQ.money(tax).replace('đ', ' PS')})`, ref, { tax, date });
      return { net: amount - tax, tax };
    },
    // ví khả dụng sang ví mua hàng của chính mình
    toShop(d, u, amount) {
      const b = ADB.balances(d, u.id).avail; amount = Math.round(+amount);
      if (!(amount > 0)) return { error: 'Anh chị nhập số điểm cần chuyển.' };
      if (amount > b) return { error: 'Ví điểm khả dụng không đủ.' };
      const ref = uid('cd');
      credit(d, u.id, 'avail', 'toshop', -amount, 'Chuyển sang ví điểm mua hàng', ref);
      credit(d, u.id, 'shop', 'toshop', amount, 'Nhận từ ví điểm khả dụng', ref);
      return { ok: true };
    },
    // ví khả dụng chuyển cho thành viên khác theo tên truy cập
    transfer(d, u, username, amount, note) {
      const b = ADB.balances(d, u.id).avail, to = ADB.byUsername(d, username); amount = Math.round(+amount);
      if (!to || to.role === 'admin') return { error: 'Không tìm thấy thành viên có tên truy cập này.' };
      if (to.id === u.id) return { error: 'Không thể chuyển cho chính mình.' };
      if (!(amount > 0)) return { error: 'Anh chị nhập số điểm cần chuyển.' };
      if (amount > b) return { error: 'Ví điểm khả dụng không đủ.' };
      const ref = uid('cd');
      credit(d, u.id, 'avail', 'transfer', -amount, `Chuyển cho @${to.username} (${to.name})${note ? ': ' + note : ''}`, ref);
      credit(d, to.id, 'avail', 'transfer', amount, `Nhận từ @${u.username} (${u.name})${note ? ': ' + note : ''}`, ref);
      return { to };
    },
    // dùng ví mua hàng để thanh toán đơn
    spendShop(d, u, order, amount) {
      const b = ADB.balances(d, u.id).shop; amount = Math.min(Math.round(+amount), b, order.total);
      if (!(amount > 0)) return 0;
      credit(d, u.id, 'shop', 'spend', -amount, 'Thanh toán đơn ' + order.id, order.id);
      order.shopPaid = amount; return amount;
    },
    // nạp tiền từ ngân hàng vào ví tiền mặt. Chuyển khoản: hệ thống thật sẽ tự xác nhận khi ngân hàng báo có
    // (bản chạy thử ghi nhận ngay); hình thức khác chờ kế toán duyệt
    deposit(d, u, amount, method, opt = {}) {
      amount = Math.round(+amount);
      if (!(amount > 0)) return { error: 'Anh chị nhập số tiền cần nạp.' };
      const t = { id: uid('nd'), user: u.id, wallet: 'cash', amount, points: amount, method: method || 'Chuyển khoản', status: opt.status || 'pending', date: opt.date || now(), note: opt.note || '', code: opt.code || '' };
      if (t.status === 'done') { t.auto = !!opt.auto; credit(d, u.id, 'cash', 'topup', amount, 'Nạp tiền qua ' + t.method + (opt.auto ? ' (tự động xác nhận)' : ''), t.id, { date: t.date }); }
      (d.topups = d.topups || []).push(t); return { topup: t };
    },
    // đổi tiền mặt sang điểm PS (1đ = 1 PS), vào ví điểm khả dụng, không trừ thuế
    cashToPoints(d, u, amount) {
      const b = ADB.balances(d, u.id).cash; amount = Math.round(+amount);
      if (!(amount > 0)) return { error: 'Anh chị nhập số tiền cần đổi.' };
      if (amount > b) return { error: 'Số dư ví tiền mặt không đủ (còn ' + PSQ.money(b) + ').' };
      const ref = uid('cd');
      credit(d, u.id, 'cash', 'topoints', -amount, 'Đổi sang điểm PS (1đ = 1 PS)', ref);
      credit(d, u.id, 'avail', 'topoints', amount, 'Nhận từ ví tiền mặt (1đ = 1 PS)', ref);
      return { ok: true };
    },
    // dùng ví tiền mặt để thanh toán đơn (sau phần điểm mua hàng)
    spendCash(d, u, order, amount) {
      const b = ADB.balances(d, u.id).cash; amount = Math.min(Math.round(+amount), b, order.total - (order.shopPaid || 0));
      if (!(amount > 0)) return 0;
      credit(d, u.id, 'cash', 'spend', -amount, 'Thanh toán đơn ' + order.id, order.id);
      order.cashPaid = amount; return amount;
    },
    // đơn bị hủy: hoàn lại phần đã trả bằng ví (1 lần)
    refundOrder(d, o) {
      if (!o || o.refunded || !o.userId || !(o.shopPaid || o.cashPaid)) return 0;
      credit(d, o.userId, 'shop', 'refund', o.shopPaid || 0, 'Hoàn điểm đơn hủy ' + o.id, o.id);
      credit(d, o.userId, 'cash', 'refund', o.cashPaid || 0, 'Hoàn tiền đơn hủy ' + o.id, o.id);
      o.refunded = true; return (o.shopPaid || 0) + (o.cashPaid || 0);
    },
    // tạo đơn mua gói kích hoạt cộng tác viên
    buyPackage(d, u, pay) {
      const P = plan(d), num = Math.max(1100, ...d.orders.map(o => +String(o.id).replace(/\D/g, '') || 0)) + 1;
      const o = { id: 'PSQ' + num, userId: u.id, name: u.name, phone: u.phone || '', email: u.email, address: '', pay: pay || 'bank', items: [{ id: PKG_ID, name: 'Gói kích hoạt cộng tác viên', price: P.pkgPrice, qty: 1 }], total: P.pkgPrice, status: 'pending', date: now() };
      d.orders.unshift(o); return o;
    }
  });
  ADB.walletType = Object.assign(ADB.walletType, { commission: 'Hoa hồng bán hàng', referral: 'Thưởng giới thiệu CTV', override: 'Thu nhập từ đại lý tuyến dưới', package: 'Gói kích hoạt CTV', convert: 'Chuyển điểm thưởng', tocash: 'Rút sang ví tiền mặt', toshop: 'Chuyển sang ví mua hàng', transfer: 'Chuyển điểm', topup: 'Nạp tiền', topoints: 'Đổi sang điểm PS', spend: 'Thanh toán đơn hàng', refund: 'Hoàn tiền đơn hủy' });
  ADB.commissionKind = { ref: 'Thưởng giới thiệu', direct: 'Hoa hồng bán hàng', override: 'Thu nhập từ đại lý', missed: 'Hoa hồng bỏ lỡ' };
  ADB.commissionStatus.missed = ['Bỏ lỡ', 'failed'];

  /* =====================================================================
     VÒNG QUAY MAY MẮN
     - Vòng quay khách hàng: mỗi người đăng ký qua đường dẫn giới thiệu = 1 mã quay
       cho người giới thiệu, quay là trúng quà (100%).
     - Vòng quay sự kiện (Zoom online / offline): danh sách người tham dự, quay ngẫu nhiên
       hoặc theo danh sách người trúng do quản trị chỉ định.
     Dữ liệu nằm ở d.wheel, tạo mặc định khi chưa có (không cần nâng phiên bản dữ liệu).
     ===================================================================== */
  const WHEEL_PRIZES = [
    ['Vòng tay trầm hương (mẫu)', '#f3c76b', 8, 20],
    ['Nụ trầm (mẫu)', '#4fe6df', 22, null],
    ['Voucher 200.000đ (mẫu)', '#b98cff', 14, 50],
    ['Trà trầm (mẫu)', '#45e08f', 20, null],
    ['Móc khóa trầm (mẫu)', '#ffb547', 20, null],
    ['50.000 PS vào ví mua hàng (mẫu)', '#ff8fb1', 16, null]
  ];
  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode(W) {
    const taken = new Set(W.codes.map(c => c.code)); let c;
    do { c = 'PSQ-'; for (let i = 0; i < 6; i++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; } while (taken.has(c));
    return c;
  }
  const stampNow = () => { const t = new Date(); return t.toISOString().slice(0, 10) + ' ' + t.toTimeString().slice(0, 5); };
  const inStock = p => p.active !== false && (p.stock == null || p.stock > 0);
  const normName = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function wheelData(d) {
    if (d.wheel && Array.isArray(d.wheel.prizes)) {
      const W = d.wheel; W.codes = W.codes || []; W.forced = W.forced || {}; W.spins = W.spins || []; W.events = W.events || []; return W;
    }
    const W = d.wheel = { prizes: WHEEL_PRIZES.map(([name, color, weight, stock], i) => ({ id: 'qz' + (i + 1), name, color, weight, stock, active: true })), codes: [], forced: {}, spins: [], events: [] };
    syncCodes(d, W);
    // vài lượt quay mẫu của thành viên khác để trang có danh sách người trúng
    const sample = W.codes.filter(c => c.user !== 'u1').slice(0, 5);
    sample.forEach((c, i) => {
      const p = W.prizes[[1, 3, 4, 2, 5][i] % W.prizes.length], at = daysAgo(i * 3 + 1) + ' ' + String(9 + i * 2).padStart(2, '0') + ':' + String(i * 13 % 60).padStart(2, '0');
      c.status = 'used'; c.prize = p.id; c.usedAt = at;
      W.spins.push({ id: uid('vq'), code: c.code, user: c.user, prize: p.id, prizeName: p.name, date: at, sample: true });
    });
    W.events.push({ id: 'sk1', name: 'Giao lưu Zoom tri ân khách hàng (mẫu)', kind: 'online', date: daysAgo(-7), participants: ['Nguyễn Minh Anh', 'Trần Quốc Huy', 'Lê Thu Hà', 'Phạm Gia Bảo', 'Võ Ngọc Lan', 'Đặng Hải Nam', 'Bùi Khánh Linh', 'Hoàng Đức Tín', 'Đỗ Mai Phương', 'Ngô Thành Đạt', 'Lý Bảo Châu', 'Dương Tuấn Kiệt'], prizes: [{ name: 'Nụ trầm (mẫu)', qty: 3 }, { name: 'Vòng tay trầm hương (mẫu)', qty: 1 }], mode: 'random', fixedWinners: [], winners: [], removeWinners: true });
    W.events.push({ id: 'sk2', name: 'Khai trương showroom (mẫu)', kind: 'offline', date: daysAgo(-20), participants: Array.from({ length: 60 }, (_, i) => String(i + 1)), prizes: [{ name: 'Trà trầm (mẫu)', qty: 5 }, { name: 'Voucher 200.000đ (mẫu)', qty: 2 }], mode: 'random', fixedWinners: [], winners: [], removeWinners: true });
    return W;
  }
  // mỗi người đăng ký qua giới thiệu = đúng 1 mã quay cho người giới thiệu
  function syncCodes(d, W) {
    const have = new Set(W.codes.filter(c => c.from).map(c => c.user + '|' + c.from)); let changed = false;
    d.users.forEach(u => {
      if (!u.sponsor || u.role === 'admin' || have.has(u.sponsor + '|' + u.id)) return;
      if (!d.users.some(x => x.id === u.sponsor)) return;
      W.codes.push({ code: newCode(W), user: u.sponsor, from: u.id, status: 'new', prize: null, usedAt: null, createdAt: u.created || now() });
      have.add(u.sponsor + '|' + u.id); changed = true;
    });
    return changed;
  }
  function pickWeighted(list) {
    const sum = list.reduce((s, p) => s + Math.max(0, +p.weight || 0), 0);
    if (!(sum > 0)) return list[Math.floor(Math.random() * list.length)];
    let r = Math.random() * sum;
    for (const p of list) { r -= Math.max(0, +p.weight || 0); if (r < 0) return p; }
    return list[list.length - 1];
  }
  // người còn trong vòng của một sự kiện (bỏ người đã trúng nếu bật loại người đã trúng)
  function eventPool(ev) {
    const won = new Set((ev.winners || []).map(w => normName(w.name)));
    return (ev.participants || []).map(n => String(n).trim()).filter(Boolean).filter(n => !ev.removeWinners || !won.has(normName(n)));
  }
  function eventSlots(ev) { const out = []; (ev.prizes || []).forEach(p => { for (let i = 0; i < (+p.qty || 0); i++) out.push(p.name); }); return out; }

  Object.assign(ADB, {
    wheel: wheelData,
    // quà đang hiện trên vòng quay khách hàng (đang bật và còn quà)
    wheelPrizes(d) { return wheelData(d).prizes.filter(inStock); },
    wheelChance(d) { const L = ADB.wheelPrizes(d), sum = L.reduce((s, p) => s + Math.max(0, +p.weight || 0), 0); return L.map(p => ({ prize: p, pct: sum > 0 ? Math.max(0, +p.weight || 0) / sum * 100 : 100 / L.length })); },
    wheelSync(d) { return syncCodes(d, wheelData(d)); },
    wheelNewCode(d, userId, note) { const W = wheelData(d), c = { code: newCode(W), user: userId, from: null, status: 'new', prize: null, usedAt: null, createdAt: now(), note: note || 'Cấp thủ công' }; W.codes.push(c); return c; },
    wheelCodesOf(d, userId) { return wheelData(d).codes.filter(c => c.user === userId).sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || String(b.createdAt).localeCompare(String(a.createdAt))); },
    // kiểm tra mã trước khi quay
    wheelCheck(d, code, user) {
      const W = wheelData(d), k = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!k) return { error: 'Anh chị nhập mã quay.' };
      const c = W.codes.find(x => x.code === k || x.code.replace('-', '') === k.replace('-', ''));
      if (!c) return { error: 'Mã quay không đúng. Anh chị kiểm tra lại giúp.' };
      if (!user) return { error: 'Anh chị đăng nhập tài khoản nhận mã để quay.' };
      if (c.user !== user.id) return { error: 'Mã này thuộc tài khoản khác.' };
      if (c.status !== 'new') return { error: 'Mã này đã được dùng ngày ' + String(c.usedAt || '').slice(0, 10) + '.' };
      if (!ADB.wheelPrizes(d).length) return { error: 'Vòng quay đang tạm dừng, chưa có quà.' };
      return { code: c };
    },
    // quay bằng mã: chọn quà (chỉ định trước, nếu không thì ngẫu nhiên theo tỉ lệ), trừ số lượng, đánh dấu mã đã dùng
    wheelSpin(d, code, user) {
      const r = ADB.wheelCheck(d, code, user); if (r.error) return r;
      const W = wheelData(d), c = r.code, list = ADB.wheelPrizes(d);
      let p = null, forced = false;
      for (const key of [c.code, user.id]) {
        const id = W.forced[key]; if (!id) continue;
        const f = list.find(x => x.id === id); if (f) { p = f; forced = true; delete W.forced[key]; break; }
      }
      if (!p) p = pickWeighted(list);
      const index = list.indexOf(p);
      if (p.stock != null) p.stock = Math.max(0, p.stock - 1);
      const at = stampNow();
      c.status = 'used'; c.prize = p.id; c.usedAt = at;
      const spin = { id: uid('vq'), code: c.code, user: user.id, prize: p.id, prizeName: p.name, date: at, forced };
      W.spins.unshift(spin);
      return { prize: p, index, spin, segments: list };
    },
    wheelEventPool: eventPool,
    wheelEventSlots: eventSlots,
    // quay một lượt sự kiện: trả về tên người trúng
    wheelEventDraw(d, eventId) {
      const ev = wheelData(d).events.find(e => e.id === eventId); if (!ev) return { error: 'Không tìm thấy sự kiện.' };
      const pool = eventPool(ev); if (!pool.length) return { error: 'Không còn người tham dự trong vòng quay.' };
      const slots = eventSlots(ev); ev.winners = ev.winners || [];
      if (slots.length && ev.winners.length >= slots.length) return { error: 'Đã trao hết giải của sự kiện này.' };
      let name = null;
      if (ev.mode === 'fixed') {
        const won = new Set(ev.winners.map(w => normName(w.name)));
        const next = (ev.fixedWinners || []).map(n => String(n).trim()).filter(Boolean).find(n => !won.has(normName(n)) && pool.some(p => normName(p) === normName(n)));
        if (next) name = pool.find(p => normName(p) === normName(next));
      }
      if (name == null) name = pool[Math.floor(Math.random() * pool.length)];
      const w = { name, prize: slots[ev.winners.length] || '', at: stampNow() };
      ev.winners.push(w);
      return { name, winner: w, index: pool.indexOf(name), pool, event: ev };
    },
    wheelMask(name) {
      const w = String(name || '').trim().split(/\s+/); if (!w[0]) return 'Khách hàng';
      const f = w[0], head = f.length > 2 ? f.slice(0, 2) + '***' + f.slice(-1) : f[0] + '***';
      return head + (w.length > 1 ? ' ' + w[w.length - 1][0].toUpperCase() + '.' : '');
    }
  });
  {
    const baseLoad = ADB.load;
    ADB.load = function () { const d = baseLoad(); const had = !!d.wheel; wheelData(d); if (syncCodes(d, d.wheel) || !had) db.save(d); return d; };
  }

  ADB.load(); // nâng cấp dữ liệu ngay khi nạp trang (để tài khoản nhân viên mẫu đăng nhập được)
})();
