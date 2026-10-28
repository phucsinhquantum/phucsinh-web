/* Phúc Sinh QuanTum: dữ liệu mở rộng cho quản trị và trang thành viên
   (phả hệ giới thiệu, ví, hoa hồng, nạp điểm, kho, chi phí, nhật ký, thư, địa chỉ, quỹ điểm, thiết lập).
   Dữ liệu gốc nằm trên máy chủ (server/). Máy chủ chạy chính tệp này để tính hoa hồng, ví;
   trình duyệt dùng nó để hiển thị. Cần nạp sau js/data.js và js/app.js. */
(function () {
  const { db, today } = PSQ;
  const VERSION = 7;

  const DEFAULT_SETTINGS = {
    shopName: SITE.brand, hotline: SITE.phone, email: SITE.email, address: SITE.address,
    fundRate: 1,                                 // % doanh thu đơn hoàn thành trích vào Quỹ tri ân (mẫu)
    minWithdraw: 200000,
    autoPlace: false,                            // tự xếp lên cây khi có người giới thiệu
    mailSender: 'Phúc Sinh QuanTum',
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

  /* ---------- dữ liệu trống ban đầu (máy chủ tạo một lần khi cài đặt) ---------- */
  function migrate(d) {
    if (d.v >= VERSION) return false;
    d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
    d.roles = d.roles || DEFAULT_ROLES.map(x => ({ ...x }));
    ['users', 'orders', 'messages', 'commissions', 'topups', 'wallet', 'fund', 'receipts', 'expenses', 'addresses', 'mails', 'logs', 'fundbook'].forEach(k => { d[k] = d[k] || []; });
    d.stock = d.stock || {}; d.stockMin = d.stockMin ?? 3;
    d.stores = d.stores || [{ id: 'st1', name: 'Showroom ' + SITE.brand, line: SITE.address, phone: SITE.phone, type: 'Cửa hàng' }];
    plan(d);
    d.v = VERSION; return true;
  }

  /* ---------- hàm dùng chung ---------- */
  const ADB = {
    PERMS, DEFAULT_SETTINGS, uid, daysAgo,
    load() { const d = db.load(); migrate(d); return d; },
    save(d) { return db.save(d); },
    migrate,
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
    pkgCountsAs: 0,                                // phần của gói tính vào doanh số mua hàng (mốc đại lý): gói không tính
    // điều kiện để đại lý nhận thu nhập từ đại lý tuyến dưới: trong activeDays ngày gần nhất có đơn tự mua và đơn bán
    activeDays: 30, activeMinBuy: 0, activeMinSell: 0, activeRule: 'any', // any: 1 trong 2 việc · all: cả hai
    holdDays: 30,                                  // khoản bị giữ chờ quá số ngày này mà chưa đủ điều kiện thì hủy
    // gói đại lý: mua một lần để lên đại lý ngay, nhận điểm vào ví mua hàng để lấy hàng dần (không tính hoa hồng trên gói,
    // hoa hồng tính khi dùng điểm đặt đơn hàng)
    agentPkgOn: 1, agentPkgPrice: 16800000, agentPkgPoints: 16800000,
    overrideMode: 'lose'                           // hold: giữ chờ · lose: mất ngay · up: chuyển cho đại lý đủ điều kiện ở tuyến trên
  };
  const PKG_ID = 'goi-ctv', AGENT_PKG_ID = 'goi-daily';
  const isPkgItem = x => x.id === PKG_ID || x.id === AGENT_PKG_ID;
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
      const dt = c.paidAt || c.date;
      credit(d, c.user, 'bonus', 'override', c.amount - shop, `${c.rate || P.overrideRate}% thu nhập của đại lý ${(ADB.user(d, c.from) || {}).name || ''} (đơn ${c.order})`, c.order, { date: dt });
      credit(d, c.user, 'shop', 'override', shop, `${P.overrideShop}% thu nhập đại lý tuyến dưới vào ví mua hàng`, c.order, { date: dt });
    } else {
      credit(d, c.user, 'sales', c.kind === 'ref' ? 'referral' : 'commission', c.amount, c.kind === 'ref' ? `Thưởng giới thiệu CTV ${(ADB.user(d, c.from) || {}).name || ''}` : `Hoa hồng ${c.rate}% đơn ${c.order}`, c.order, { date: c.date });
    }
    c.status = 'paid';
    // B (đại lý hoặc CTV) có thu nhập từ đơn mua hàng (kể cả thu nhập B nhận từ tầng dưới): đại lý A (người giới thiệu B) hưởng 40%, tính tiếp lên trên.
    // CTV do đại lý tuyển cũng tính (anh Tuân chốt 24/10). Thưởng giới thiệu CTV (200k) không tính là thu nhập để tuyến trên hưởng.
    if (c.kind !== 'ref') {
      const r = ADB.user(d, c.user), P = plan(d), depth = (c.depth || 0) + 1, amount = pct(c.amount, P.overrideRate), date = c.paidAt || c.date;
      let up = r && r.sponsor && ADB.user(d, r.sponsor), hops = 0;
      // chuyển lên trên: bỏ qua đại lý chưa đủ điều kiện
      if (P.overrideMode === 'up') while (up && up.tier === 'daily' && !ADB.activity(d, up.id, date).ok && hops++ < 30) up = up.sponsor && ADB.user(d, up.sponsor);
      if (r && (r.tier === 'daily' || r.tier === 'ctv') && up && up.tier === 'daily' && depth <= 30 && amount >= 1) {
        const ok = ADB.activity(d, up.id, date).ok, status = ok ? 'paid' : P.overrideMode === 'lose' ? 'missed' : 'hold';
        addCommission(d, { kind: 'override', order: c.order, user: up.id, from: r.id, level: depth + 1, depth, rate: P.overrideRate, base: c.amount, amount, date, status,
          note: ok ? (hops ? 'Chuyển lên từ đại lý chưa đủ điều kiện' : '') : status === 'hold' ? 'Đang giữ, chờ đủ điều kiện nhận' : 'Chưa đủ điều kiện nhận (' + (P.activeRule === 'all' ? 'tự mua và có đơn bán' : 'tự mua hoặc có đơn bán') + ' trong ' + P.activeDays + ' ngày)' });
      }
    }
  }
  function addCommission(d, c) {
    c = Object.assign({ id: uid('hh'), level: 1, status: 'paid' }, c);
    (d.commissions = d.commissions || []).push(c);
    if (c.status === 'paid') payCommission(d, c);
    return c;
  }
  // ghi nhận một đơn đã thanh toán: kích hoạt CTV, hoa hồng, lên đại lý (chạy 1 lần mỗi đơn).
  // Hoa hồng ghi ngay khi công ty đã nhận tiền (Đã thanh toán, Đang giao, Hoàn thành): đơn đã trả chỉ đổi lên, không trả hàng (anh Tuân chốt 24/10).
  function settleOrder(d, o) {
    if (!o || o.settled || !PAID(o)) return false;
    const buyer = ADB.user(d, o.userId); o.settled = true;
    // khách lẻ mua qua link giới thiệu (không có tài khoản): người giới thiệu nhận hoa hồng như đơn của người mình giới thiệu
    if (!buyer) { const sp = o.refBy && ADB.user(d, o.refBy); if (sp) directCommission(d, o, { id: null }, sp, Math.max(0, itemsTotal(o) - (o.discount || 0)), o.date || now(), 'Khách lẻ mua qua link giới thiệu'); return true; }
    const P = plan(d), sp = buyer.sponsor ? ADB.user(d, buyer.sponsor) : null, date = o.date || now();
    buyer.tier = buyer.tier || 'khach';
    const isPkg = (o.items || []).some(x => x.id === PKG_ID), isAgentPkg = (o.items || []).some(x => x.id === AGENT_PKG_ID);
    if (isAgentPkg) {
      if (buyer.tier === 'khach') buyer.activated = buyer.activated || date;
      if (buyer.tier !== 'daily') { buyer.tier = 'daily'; buyer.agentSince = date; }
      credit(d, buyer.id, 'shop', 'package', P.agentPkgPoints, 'Điểm mua hàng từ gói đại lý', o.id, { date });
      return true;
    }
    if (isPkg) {
      if (buyer.tier === 'khach') { buyer.tier = 'ctv'; buyer.activated = date; }
      credit(d, buyer.id, 'shop', 'package', P.pkgPoints, 'Điểm mua hàng từ gói kích hoạt cộng tác viên', o.id, { date });
      if (sp && (sp.tier === 'ctv' || sp.tier === 'daily')) addCommission(d, { kind: 'ref', order: o.id, user: sp.id, from: buyer.id, rate: 0, base: P.pkgPrice, amount: P.refBonus, date });
      else if (sp) addCommission(d, { kind: 'missed', order: o.id, user: sp.id, from: buyer.id, rate: 0, base: P.pkgPrice, amount: P.refBonus, date, status: 'missed', note: 'Chưa kích hoạt cộng tác viên' });
    } else if (sp) directCommission(d, o, buyer, sp, Math.max(0, itemsTotal(o) - (o.discount || 0)), date);   // hoa hồng tính trên tiền thực thu sau mã giảm giá
    // lên đại lý khi tổng mua cộng dồn đủ mốc
    if (buyer.tier !== 'daily' && ADB.spent(d, buyer.id) >= P.agentThreshold) { buyer.tier = 'daily'; buyer.agentSince = date; }
    return true;
  }

  // hoa hồng trực tiếp cho người giới thiệu trên mỗi đơn mua hàng của người mình giới thiệu (khách, CTV hay đại lý đều tính):
  // người giới thiệu là CTV hưởng ctvRate, đại lý hưởng agentRate; người giới thiệu chưa kích hoạt thì ghi bỏ lỡ
  function directCommission(d, o, buyer, sp, base, date, note) {
    const P = plan(d), rate = sp.tier === 'daily' ? P.agentRate : sp.tier === 'ctv' ? P.ctvRate : 0;
    if (!(base > 0)) return;
    if (rate) addCommission(d, { kind: 'direct', order: o.id, user: sp.id, from: buyer.id, rate, base, amount: pct(base, rate), date, note: note || '' });
    if (rate < P.agentRate) addCommission(d, { kind: 'missed', order: o.id, user: sp.id, from: buyer.id, rate: P.agentRate - rate, base, amount: pct(base, P.agentRate - rate), date, status: 'missed', note: rate ? 'Phần chênh lệch nếu là đại lý' : 'Chưa kích hoạt cộng tác viên' });
  }

  /* =====================================================================
     QUỸ ĐIỂM (1 PS = 1đ). Luồng: Chủ sở hữu tạo điểm vào Quỹ phát hành, chuyển cho Quỹ kế toán.
     Mọi khoản cộng vào ví thành viên (hoa hồng, thưởng, điểm gói, nạp tiền, quà vòng quay, điều chỉnh)
     đều trừ từ Quỹ kế toán. Tiền điểm rời ví thành viên đi về: thuế giữ lại, doanh thu đơn trả bằng ví,
     đã chi trả về ngân hàng. Sổ ghi thêm, không sửa, không xóa. Cân đối luôn phải bằng 0.
     ===================================================================== */
  const FUND_IN = ['commission', 'referral', 'override', 'package', 'topup', 'bonus', 'adjust', 'prize'];   // trừ quỹ kế toán
  const FUND_PAIR = ['tocash', 'convert', 'toshop', 'transfer', 'topoints'];                                // chuyển nội bộ, chỉ phần thuế rời ví
  const FUND_ACC = { ph: 'Quỹ phát hành', kt: 'Quỹ kế toán' };
  const isOwner = u => !!u && u.role === 'admin' && (u.adminRole || 'owner') === 'owner' && u.status !== 'locked';

  Object.assign(ADB, {
    FUND_ACC, FUND_IN, isOwner,
    // báo cáo quỹ: số dư các quỹ, sổ quỹ kế toán (có số dư sau), các kiểm tra cân đối
    fund(d) {
      const book = (d.fundbook || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))), name = id => (ADB.user(d, id) || {}).name || '';
      let issued = 0, ph = 0, kt = 0, thue = 0, dtv = 0, paid = 0, held = 0, commIn = 0;
      const rows = [], unknown = [], groups = {}, mem = new Set(d.users.filter(u => u.role !== 'admin').map(u => u.id));
      book.forEach(b => {
        if (!b.from && b.to === 'ph') issued += b.amount; if (b.from === 'ph' && !b.to) issued -= b.amount;
        if (b.to === 'ph') ph += b.amount; if (b.from === 'ph') ph -= b.amount;
        if (b.to === 'kt' || b.from === 'kt') rows.push({ date: b.date, kind: 'book', amount: b.to === 'kt' ? b.amount : -b.amount, note: b.note, who: b.actor, src: b });
        if (b.to === 'kt') kt += b.amount; if (b.from === 'kt') kt -= b.amount;
      });
      (d.wallet || []).forEach((w, i) => {
        if (!mem.has(w.user) || w.status === 'rejected' || (w.status === 'pending' && w.amount > 0)) return;
        const t = w.type, a = w.amount;
        if (FUND_IN.includes(t)) { kt -= a; rows.push({ date: w.date, kind: t, amount: -a, note: w.note, user: w.user, wallet: ADB.walletOf(w), src: w, i }); if (['commission', 'referral', 'override'].includes(t)) commIn += a; }
        else if (t === 'refund') dtv -= a;
        else if (t === 'spend') dtv -= a;
        else if (t === 'withdraw') { if (w.status === 'done') paid -= a; else held -= a; }
        else if (FUND_PAIR.includes(t)) { thue -= a; const g = groups[w.ref || w.id] = groups[w.ref || w.id] || { sum: 0, tax: 0, list: [] }; g.sum += a; g.tax = Math.max(g.tax, +w.tax || 0); g.list.push(w); }
        else unknown.push(w);
      });
      rows.sort((x, y) => String(x.date).localeCompare(String(y.date)) || (x.kind === 'book' ? -1 : 1) || (x.i || 0) - (y.i || 0));
      let run = 0; rows.forEach(r => { run += r.amount; r.bal = run; });
      let members = 0; mem.forEach(id => { members += ADB.balance(d, id); });
      const diff = issued - (ph + kt + members + thue + dtv + paid + held);
      const P = plan(d), warnAt = (d.settings || {}).fundWarn ?? 20000000, checks = [];
      const add = (lv, t, x) => checks.push({ lv, t, x: x || '' });
      if (ph < 0) add('red', 'Quỹ phát hành bị âm', PSQ.money(ph));
      if (kt < 0) add('red', 'Quỹ kế toán bị âm: đã cộng cho thành viên nhiều hơn số được cấp', 'Chủ sở hữu cần chuyển thêm ít nhất ' + PSQ.money(-kt));
      else if (kt < warnAt) add('gold', 'Quỹ kế toán sắp hết', 'Còn ' + PSQ.money(kt) + ', dưới mức cảnh báo ' + PSQ.money(warnAt));
      if (diff) add('red', 'Lệch cân đối điểm', 'Tổng phát hành khác tổng các quỹ và ví ' + PSQ.money(diff));
      if (unknown.length) add('red', unknown.length + ' giao dịch ví không rõ nguồn', unknown.slice(0, 3).map(w => `${name(w.user)} ${PSQ.money(w.amount)} (${w.type})`).join('; '));
      const bad = Object.values(groups).filter(g => g.sum + g.tax !== 0);
      if (bad.length) add('red', bad.length + ' lần chuyển điểm không khớp hai đầu', bad.slice(0, 3).map(g => g.list.map(w => `${name(w.user)} ${PSQ.money(w.amount)}`).join(' / ')).join('; '));
      const commPaid = (d.commissions || []).filter(c => c.status === 'paid' && c.kind !== 'missed').reduce((s, c) => s + c.amount, 0);
      if (Math.abs(commPaid - commIn) > 0) add('red', 'Hoa hồng đã duyệt khác số đã cộng vào ví', `Sổ hoa hồng ${PSQ.money(commPaid)}, ví nhận ${PSQ.money(commIn)}`);
      const neg = [...mem].map(id => ({ id, b: ADB.balances(d, id) })).filter(x => Object.values(x.b).some(v => v < 0));
      if (neg.length) add('gold', neg.length + ' thành viên có ví bị âm', neg.slice(0, 3).map(x => name(x.id)).join(', '));
      void P;
      return { issued, ph, kt, members, thue, dtv, paid, held, diff, rows, book, checks, warnAt, ok: !checks.some(c => c.lv === 'red') };
    },
    // chủ sở hữu tạo điểm vào quỹ phát hành, hoặc chuyển giữa các quỹ. Máy chủ kiểm tra lại mật khẩu trước (verified).
    fundAction(d, actor, kind, amount, note, verified) {
      const u = actor && ADB.user(d, actor.id); amount = Math.round(+amount);
      if (!isOwner(u)) return { error: 'Chỉ chủ sở hữu mới được tạo điểm và chuyển quỹ.' };
      if (verified !== true) return { error: 'Mật khẩu xác nhận chưa đúng.' };
      if (!(amount > 0)) return { error: 'Anh nhập số điểm lớn hơn 0.' };
      if (!String(note || '').trim()) return { error: 'Anh nhập lý do để lưu vào sổ.' };
      const r = ADB.fund(d), M = { mint: [null, 'ph'], give: ['ph', 'kt'], back: ['kt', 'ph'], burn: ['ph', null] }[kind];
      if (!M) return { error: 'Thao tác không hợp lệ.' };
      if (M[0] === 'ph' && amount > r.ph) return { error: 'Quỹ phát hành chỉ còn ' + PSQ.money(r.ph) + '.' };
      if (M[0] === 'kt' && amount > r.kt) return { error: 'Quỹ kế toán chỉ còn ' + PSQ.money(r.kt) + '.' };
      const t = new Date(), e = { id: uid('qd'), date: now(), time: t.toTimeString().slice(0, 5), from: M[0], to: M[1], amount, note: String(note).trim(), actor: u.name, actorId: u.id };
      (d.fundbook = d.fundbook || []).push(e); return { entry: e };
    },
    // số dư quỹ kế toán hiện tại (để chặn khoản cộng tay vượt quỹ)
    fundKT(d) { return ADB.fund(d).kt; },
    PLAN, PKG_ID, AGENT_PKG_ID, WALLETS, TIERS, plan, settleOrder, addCommission, payCommission, credit, legacyWallet,
    tierOf(u) { return TIERS[(u && u.tier) || 'khach'] || TIERS.khach; },
    // điều kiện nhận thu nhập từ đại lý tuyến dưới tính tại ngày asOf: có đơn tự mua và đơn bán (người mình giới thiệu mua) trong activeDays ngày
    activity(d, id, asOf) {
      const P = plan(d), at = new Date((asOf || now()) + 'T00:00:00'), dd = s => Math.floor((at - new Date(String(s).slice(0, 10) + 'T00:00:00')) / 864e5);
      const inWin = o => PAID(o) && o.date && dd(o.date) >= 0 && dd(o.date) < P.activeDays;
      const lastOf = list => list.map(o => String(o.date).slice(0, 10)).sort().pop() || '';
      const buys = d.orders.filter(o => o.userId === id && inWin(o) && o.total >= (P.activeMinBuy || 0));
      const sells = d.orders.filter(o => { const b = o.userId && ADB.user(d, o.userId); return (b ? b.sponsor === id : o.refBy === id) && inWin(o) && itemsTotal(o) >= (P.activeMinSell || 0); });
      const part = (list, label) => { const last = lastOf(list), left = last ? P.activeDays - dd(last) : 0; return { ok: list.length > 0, last, count: list.length, amount: list.reduce((s, o) => s + o.total, 0), left, label }; };
      const buy = part(buys, 'Tự mua hàng'), sell = part(sells, 'Có đơn bán từ người mình giới thiệu');
      const all = P.activeRule === 'all', ok = all ? buy.ok && sell.ok : buy.ok || sell.ok;
      const left = !ok ? 0 : all ? Math.min(buy.left, sell.left) : Math.max(buy.ok ? buy.left : 0, sell.ok ? sell.left : 0);
      return { ok, all, buy, sell, left, days: P.activeDays, minBuy: P.activeMinBuy || 0, minSell: P.activeMinSell || 0, missing: ok ? [] : [buy, sell].filter(x => !x.ok) };
    },
    // nhả các khoản đang giữ khi đại lý đủ điều kiện; quá hạn thì hủy. Trả về true nếu có thay đổi
    releaseHeld(d) {
      const P = plan(d), today = now(); let ch = false;
      (d.commissions || []).filter(c => c.status === 'hold').forEach(c => {
        if (ADB.activity(d, c.user, today).ok) { c.paidAt = today; c.note = 'Đã đủ điều kiện, nhận ngày ' + today; payCommission(d, c); ch = true; }
        else if (ADB.daysSince(c.date) > P.holdDays) { c.status = 'missed'; c.note = 'Quá ' + P.holdDays + ' ngày chưa đủ điều kiện nhận'; ch = true; }
      });
      return ch;
    },
    daysSince(s) { return Math.floor((new Date(now() + 'T00:00:00') - new Date(String(s).slice(0, 10) + 'T00:00:00')) / 864e5); },
    walletOf(w) { return w.wallet || legacyWallet(w.type); },
    // tổng mua đã thanh toán (gồm cả gói kích hoạt)
    // gói kích hoạt chỉ tính phần điểm mua hàng (346k) vào doanh số
    spent(d, id) { const P = plan(d); return d.orders.filter(o => o.userId === id && PAID(o)).reduce((s, o) => s + o.items.reduce((t, x) => t + (x.id === PKG_ID ? (P.pkgCountsAs ?? P.pkgPoints) * x.qty : x.id === AGENT_PKG_ID ? 0 : x.price * x.qty), 0), 0); },
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
      const C = (d.commissions || []).filter(c => c.user === id && c.kind !== 'missed' && !['hold', 'missed', 'cancel'].includes(c.status)), sum = k => C.filter(c => c.kind === k).reduce((s, c) => s + c.amount, 0);
      const A = (d.commissions || []).filter(c => c.user === id), held = A.filter(c => c.status === 'hold').reduce((s, c) => s + c.amount, 0);
      const e = { ref: sum('ref'), direct: sum('direct'), override: sum('override'), missed: A.filter(c => c.kind === 'missed' || c.status === 'missed').reduce((s, c) => s + c.amount, 0), held };
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
    // trả trọn đơn (gói CTV, gói đại lý) bằng ví điểm khả dụng, 1 PS = 1đ; không đủ điểm thì không trừ
    spendAvail(d, u, order) {
      const b = ADB.balances(d, u.id).avail, due = order.total - (order.shopPaid || 0) - (order.cashPaid || 0);
      if (b < due) return { error: `Ví điểm khả dụng còn ${(Math.round(b) || 0).toLocaleString('vi-VN')} PS, chưa đủ ${due.toLocaleString('vi-VN')} PS.` };
      credit(d, u.id, 'avail', 'spend', -due, 'Thanh toán đơn ' + order.id, order.id);
      order.availPaid = due; order.pay = 'points'; return { paid: due };
    },
    // đơn bị hủy: hoàn lại phần đã trả bằng ví (1 lần)
    refundOrder(d, o) {
      if (!o || o.refunded || !o.userId || !(o.shopPaid || o.cashPaid || o.availPaid)) return 0;
      credit(d, o.userId, 'avail', 'refund', o.availPaid || 0, 'Hoàn điểm đơn hủy ' + o.id, o.id);
      credit(d, o.userId, 'shop', 'refund', o.shopPaid || 0, 'Hoàn điểm đơn hủy ' + o.id, o.id);
      credit(d, o.userId, 'cash', 'refund', o.cashPaid || 0, 'Hoàn tiền đơn hủy ' + o.id, o.id);
      o.refunded = true; return (o.shopPaid || 0) + (o.cashPaid || 0) + (o.availPaid || 0);
    },
    // đơn đã nhận tiền (đã thanh toán, đã hoàn thành, hoặc đang giao mà không phải trả khi nhận hàng): không hủy được, chỉ đổi sản phẩm
    locked(o) { return !!o && (o.settled || ['paid', 'done'].includes(o.status) || (o.status === 'ship' && o.pay !== 'cod')); },
    // tồn kho: null là chưa quản lý (coi như còn hàng)
    stockOf(d, id) { const s = d.stock || {}; return id in s ? +s[id] || 0 : null; },
    // trừ kho khi đơn được thanh toán hoặc đi giao (1 lần), trả lại kho khi hủy
    stockOut(d, o) {
      if (!o || o.stockOut) return false; d.stock = d.stock || {};
      (o.items || []).forEach(x => { if (x.id !== PKG_ID && x.id in d.stock) d.stock[x.id] = Math.max(0, (+d.stock[x.id] || 0) - x.qty); });
      return (o.stockOut = true);
    },
    stockBack(d, o, items) {
      if (!o || !o.stockOut) return false; d.stock = d.stock || {};
      (items || o.items || []).forEach(x => { if (x.id !== PKG_ID && x.id in d.stock) d.stock[x.id] = (+d.stock[x.id] || 0) + x.qty; });
      if (!items) o.stockOut = false; return true;
    },
    // đổi trạng thái đơn theo luật: chặn hủy đơn đã nhận tiền, chặn giao hoặc hoàn thành khi còn thiếu tiền bù,
    // đơn gói kích hoạt tự Hoàn thành khi đã thanh toán, trừ hoặc trả kho, ghi nhận hoa hồng khi đã thanh toán
    setStatus(d, o, status) {
      if (status === o.status) return { ok: true };
      if (status === 'failed' && ADB.locked(o)) return { error: `Đơn #${o.id} đã thanh toán, hoa hồng và điểm đã ghi nhận nên không hủy được. Anh chị chỉ có thể đổi sang sản phẩm khác bằng hoặc cao hơn số tiền.` };
      if (o.exchange && o.exchange.due > 0 && ['ship', 'done'].includes(status)) return { error: `Đơn #${o.id} còn thiếu ${PSQ.money(o.exchange.due)} tiền bù đổi sản phẩm. Xác nhận đã nhận tiền bù trước.` };
      if (status === 'pending' && ADB.locked(o)) return { error: `Đơn #${o.id} đã thanh toán, không chuyển về chờ xác nhận được.` };
      o.status = status;
      const isPkg = (o.items || []).some(isPkgItem);
      if (isPkg && status === 'paid') o.status = 'done';
      const r = { ok: true, status: o.status };
      if (['paid', 'ship', 'done'].includes(o.status)) r.stock = ADB.stockOut(d, o);
      if (o.status === 'failed') { r.refunded = ADB.refundOrder(d, o); r.restocked = ADB.stockBack(d, o); r.coupon = ADB.couponBack(d, o); }
      r.settled = settleOrder(d, o);
      if (PAID(o)) r.agent = ADB.agentUp(d, o.userId);
      return r;
    },
    // lên đại lý ngay khi tổng đơn đã thanh toán (công ty đã nhận tiền) đủ mốc
    agentUp(d, id) {
      const u = ADB.user(d, id), P = plan(d);
      if (!u || u.role === 'admin' || u.tier === 'daily' || ADB.spent(d, id) < P.agentThreshold) return false;
      u.tier = 'daily'; u.agentSince = now(); return true;
    },
    // rà toàn bộ thành viên (máy chủ chạy sau mỗi lần lưu), sửa cả tài khoản đã đủ mốc từ trước
    // ghi nhận các đơn đã thanh toán mà chưa tính hoa hồng (đơn trước khi đổi luật, đơn quản trị lưu thẳng)
    settleSync(d) { let n = 0; d.orders.filter(o => PAID(o) && !o.settled).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id), 'en', { numeric: true })).forEach(o => { if (settleOrder(d, o)) n++; }); return n; },
    // đơn đặt không đăng nhập mà số điện thoại trùng đúng 1 tài khoản thành viên: ghi vào tài khoản đó (tính tổng mua, lên đại lý, hiện ở Đơn hàng của tôi)
    linkGuests(d) {
      const tel = p => String(p || '').replace(/[^\d]/g, '').replace(/^84/, '0'), by = {};
      d.users.forEach(u => { const t = tel(u.phone); if (u.role !== 'admin' && t.length >= 9) (by[t] = by[t] || []).push(u); });
      const em = {}; d.users.forEach(u => { const e = String(u.email || '').trim().toLowerCase(); if (u.role !== 'admin' && e) (em[e] = em[e] || []).push(u); });
      let n = 0; d.orders.forEach(o => {
        if (!o.userId) {
          const m = by[tel(o.phone)], e = em[String(o.email || '').trim().toLowerCase()], u = m && m.length === 1 ? m[0] : e && e.length === 1 ? e[0] : null; if (!u) return;
          o.userId = u.id; o.linked = m && m.length === 1 ? 'phone' : 'email'; n++;
        }
        // đơn vừa gắn (hoặc gắn từ bản trước, chạy 1 lần): lúc là khách lẻ chỉ ra hoa hồng bỏ lỡ hoặc không ra gì (người giới thiệu khi đó chưa đủ cấp)
        // thì bỏ các dòng bỏ lỡ đó và tính lại như đơn của thành viên; đơn đã trả hoa hồng thật thì giữ nguyên, không trả trùng
        if (!o.linked || o.relinked) return; o.relinked = true;
        const cs = (d.commissions || []).filter(c => c.order === o.id);
        if (o.settled && cs.every(c => c.status === 'missed')) { d.commissions = (d.commissions || []).filter(c => c.order !== o.id); o.settled = false; n++; }
      }); return n;
    },
    agentSync(d) { let n = 0; new Set(d.orders.filter(PAID).map(o => o.userId)).forEach(id => { if (ADB.agentUp(d, id)) n++; }); return n; },
    // sản phẩm có thể đổi cho đơn đã thanh toán: same: cùng giá với phần hàng đã trả; more: giá cao hơn (khách chuyển bù)
    exchangeOptions(d, o) {
      const paid = itemsTotal(o), ok = p => p.id !== PKG_ID && p.active !== false && ADB.stockOf(d, p.id) !== 0;
      const same = PRODUCTS.filter(p => ok(p) && p.price === paid);
      const more = PRODUCTS.filter(p => ok(p) && p.price > paid).sort((a, b) => a.price - b.price);
      return { paid, same, more };
    },
    // đổi đơn đã thanh toán sang sản phẩm khác (số tiền bằng hoặc cao hơn). Phần chênh lệch chờ khách chuyển bù.
    exchangeOrder(d, o, id, qty, actor) {
      const p = PRODUCTS.find(x => x.id === id); qty = Math.max(1, Math.round(+qty || 1));
      if (!p) return { error: 'Không tìm thấy sản phẩm.' };
      if (o.exchange && o.exchange.due > 0) return { error: 'Đơn đang chờ khách chuyển bù lần đổi trước.' };
      const st = ADB.stockOf(d, p.id); if (st !== null && st < qty) return { error: `${p.name} chỉ còn ${st} trong kho.` };
      const paid = itemsTotal(o), next = p.price * qty, diff = next - paid;
      if (diff < 0) return { error: 'Sản phẩm đổi phải bằng hoặc cao hơn số tiền đã thanh toán (' + PSQ.money(paid) + ').' };
      const old = o.items.map(x => Object.assign({}, x)), items = [{ id: p.id, name: p.name, price: p.price, qty }];
      if (o.stockOut) { ADB.stockBack(d, o, old); o.stockOut = false; o.items = items; ADB.stockOut(d, o); } else o.items = items;
      o.total += diff;
      (o.exchanges = o.exchanges || []).push({ date: now(), from: old, to: items, diff, by: actor || '' });
      o.exchange = { due: diff, diff, date: now() };
      if (!diff) delete o.exchange;
      return { diff };
    },
    // xác nhận đã nhận tiền bù đổi sản phẩm: đơn đặt thành công; đơn đã ghi nhận hoa hồng thì tính thêm hoa hồng trên phần bù
    confirmTopup(d, o) {
      if (!o.exchange || !(o.exchange.due > 0)) return { error: 'Đơn không có khoản bù.' };
      const diff = o.exchange.due; o.extraPaid = (o.extraPaid || 0) + diff; delete o.exchange;
      if (o.settled) {
        const buyer = ADB.user(d, o.userId), sp = buyer && buyer.sponsor ? ADB.user(d, buyer.sponsor) : null, P = plan(d);
        if (sp) directCommission(d, o, buyer, sp, diff, now(), 'Phần bù đổi sản phẩm');
        if (buyer && buyer.tier !== 'daily' && ADB.spent(d, buyer.id) >= P.agentThreshold) { buyer.tier = 'daily'; buyer.agentSince = now(); }
      }
      return { diff };
    },
    isPkgOrder(o) { return (o.items || []).some(isPkgItem); },
    isAgentPkgOrder(o) { return (o.items || []).some(x => x.id === AGENT_PKG_ID); },
    // tạo đơn mua gói đại lý
    buyAgentPackage(d, u, pay) {
      const P = plan(d), num = Math.max(1100, ...d.orders.map(o => +String(o.id).replace(/\D/g, '') || 0)) + 1;
      const o = { id: 'PSQ' + num, userId: u.id, name: u.name, phone: u.phone || '', email: u.email, address: '', pay: pay || 'bank', items: [{ id: AGENT_PKG_ID, name: 'Gói đại lý', price: P.agentPkgPrice, qty: 1 }], total: P.agentPkgPrice, status: 'pending', date: now() };
      d.orders.unshift(o); return o;
    },
    // số liệu kế hoạch để thay vào chữ {…} trong điều khoản, quyền lợi
    planVars(d) {
      const P = plan(d), m = PSQ.money, ps = n => (Math.round(n) || 0).toLocaleString('vi-VN') + ' PS';
      return { gia_goi: m(P.pkgPrice), diem_goi: ps(P.pkgPoints), phi_goi: m(P.pkgPrice - P.pkgPoints), moc_dai_ly: m(P.agentThreshold), hh_ctv: P.ctvRate + '%', hh_daily: P.agentRate + '%', thuong_gt: m(P.refBonus), thu_nhap_daily: P.overrideRate + '%', so_ngay: P.activeDays, thue: P.taxRate + '%', rut_toi_thieu: m(d.settings.minWithdraw || 0), gia_goi_dl: m(P.agentPkgPrice), diem_goi_dl: ps(P.agentPkgPoints), ten: SITE.brand, hotline: SITE.phone, email: SITE.email };
    },
    // thay {…} bằng số liệu, trả về HTML đã an toàn
    fill(text, V) { return PSQ.esc(String(text || '')).replace(/\{(\w+)\}/g, (m0, k) => k in V ? PSQ.esc(String(V[k])) : m0); },
    // tạo đơn mua gói kích hoạt cộng tác viên
    buyPackage(d, u, pay) {
      const P = plan(d), num = Math.max(1100, ...d.orders.map(o => +String(o.id).replace(/\D/g, '') || 0)) + 1;
      const o = { id: 'PSQ' + num, userId: u.id, name: u.name, phone: u.phone || '', email: u.email, address: '', pay: pay || 'bank', items: [{ id: PKG_ID, name: 'Gói kích hoạt cộng tác viên', price: P.pkgPrice, qty: 1 }], total: P.pkgPrice, status: 'pending', date: now() };
      d.orders.unshift(o); return o;
    }
  });
  ADB.walletType = Object.assign(ADB.walletType, { commission: 'Hoa hồng bán hàng', referral: 'Thưởng giới thiệu CTV', override: 'Thu nhập từ đại lý tuyến dưới', package: 'Gói kích hoạt CTV', convert: 'Chuyển điểm thưởng', tocash: 'Rút sang ví tiền mặt', toshop: 'Chuyển sang ví mua hàng', transfer: 'Chuyển điểm', topup: 'Nạp tiền', topoints: 'Đổi sang điểm PS', spend: 'Thanh toán đơn hàng', refund: 'Hoàn tiền đơn hủy', prize: 'Quà vòng quay' });
  ADB.commissionKind = { ref: 'Thưởng giới thiệu', direct: 'Hoa hồng bán hàng', override: 'Thu nhập từ đại lý', missed: 'Hoa hồng bỏ lỡ' };
  ADB.commissionStatus.missed = ['Bỏ lỡ', 'failed'];
  ADB.commissionStatus.hold = ['Đang giữ, chờ đủ điều kiện', 'pending'];

  /* =====================================================================
     VÒNG QUAY MAY MẮN
     - Vòng quay khách hàng: mỗi người đăng ký qua đường dẫn giới thiệu = 1 mã quay
       cho người giới thiệu, quay là trúng quà (100%).
     - Vòng quay sự kiện (Zoom online / offline): danh sách người tham dự, quay ngẫu nhiên
       hoặc theo danh sách người trúng do quản trị chỉ định.
     Dữ liệu nằm ở d.wheel, tạo mặc định khi chưa có (không cần nâng phiên bản dữ liệu).
     ===================================================================== */
  const WHEEL_PRIZES = [
    ['Vòng tay trầm hương', '#f3c76b', 8, 20],
    ['Nụ trầm', '#4fe6df', 22, null],
    ['Voucher 200.000đ', '#b98cff', 14, 50],
    ['Trà trầm', '#45e08f', 20, null],
    ['Móc khóa trầm', '#ffb547', 20, null],
    ['50.000 PS vào ví mua hàng', '#ff8fb1', 16, null]
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
  // cài đặt vòng quay khách hàng: chỉ cấp mã cho người giới thiệu thuộc các cấp bậc trong tiers (mặc định chỉ Khách hàng)
  const WHEEL_SET = { enabled: true, tiers: ['khach'], perRef: 1, expireDays: 0, rules: '' };
  const unSample = s => String(s || '').replace(/\s*\(mẫu\)/g, '').trim();
  function wheelFix(d, W) {
    W.settings = Object.assign({}, WHEEL_SET, W.settings || {});
    if (W.rv === 2) { W.prizes.forEach(p => { const m = /([\d.]+)\s*PS/i.exec(p.name || ''); if (m && p.points == null) { p.points = +m[1].replace(/\./g, ''); p.wallet = /khả dụng/i.test(p.name) ? 'avail' : 'shop'; } }); W.rv = 3; }
    if (W.rv >= 2) return;
    // v2: bỏ chữ (mẫu); CTV và đại lý không nhận mã quay nữa (hủy mã tự cấp chưa dùng)
    W.prizes.forEach(p => p.name = unSample(p.name));
    W.spins.forEach(x => x.prizeName = unSample(x.prizeName));
    W.events.forEach(e => { e.name = unSample(e.name); (e.prizes || []).forEach(p => p.name = unSample(p.name)); (e.winners || []).forEach(w => { if (w.prize) w.prize = unSample(w.prize); }); });
    W.codes = W.codes.filter(c => !(c.from && c.status === 'new' && !W.settings.tiers.includes((ADB.user(d, c.user) || {}).tier || 'khach')));
    W.rv = 2; wheelFix(d, W);
  }
  function wheelData(d) {
    if (d.wheel && Array.isArray(d.wheel.prizes)) {
      const W = d.wheel; W.codes = W.codes || []; W.forced = W.forced || {}; W.spins = W.spins || []; W.events = W.events || []; wheelFix(d, W); return W;
    }
    const W = d.wheel = { prizes: WHEEL_PRIZES.map(([name, color, weight, stock], i) => ({ id: 'qz' + (i + 1), name, color, weight, stock, active: true })), codes: [], forced: {}, spins: [], events: [], settings: Object.assign({}, WHEEL_SET), rv: 3 };
    W.prizes.forEach(p => { const m = /([\d.]+)\s*PS/i.exec(p.name); if (m) { p.points = +m[1].replace(/\./g, ''); p.wallet = 'shop'; } });
    syncCodes(d, W);
    return W;
  }
  // mỗi người đăng ký qua giới thiệu = perRef mã quay cho người giới thiệu, nếu người giới thiệu thuộc cấp bậc được nhận
  // (mặc định chỉ Khách hàng; CTV và đại lý đã hưởng hoa hồng). Người đã được xét thì ghi vào W.seen để không cấp lại.
  function syncCodes(d, W) {
    const S = W.settings || WHEEL_SET, seen = W.seen = W.seen || {}; let changed = false;
    W.codes.forEach(c => { if (c.from && !seen[c.from]) { seen[c.from] = 1; changed = true; } });
    d.users.forEach(u => {
      if (!u.sponsor || u.role === 'admin' || seen[u.id]) return;
      const sp = ADB.user(d, u.sponsor); if (!sp) return;
      seen[u.id] = 1; changed = true;
      if (S.enabled === false || !S.tiers.includes(sp.tier || 'khach')) return;
      const at = u.created || now(), exp = S.expireDays > 0 ? new Date(new Date(at.slice(0, 10) + 'T00:00:00').getTime() + S.expireDays * 864e5).toISOString().slice(0, 10) : null;
      for (let i = 0; i < Math.max(1, +S.perRef || 1); i++) W.codes.push({ code: newCode(W), user: sp.id, from: u.id, status: 'new', prize: null, usedAt: null, createdAt: at, expires: exp });
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
    WHEEL_SET,
    // cấp bậc này có được nhận mã quay khi giới thiệu không
    wheelEligible(d, u) { return !!u && wheelData(d).settings.tiers.includes(u.tier || 'khach'); },
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
      if (W.settings.enabled === false) return { error: 'Vòng quay khách hàng đang tạm dừng.' };
      if (c.expires && c.expires < now()) return { error: 'Mã này đã hết hạn ngày ' + c.expires.split('-').reverse().join('/') + '.' };
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
      // quà dạng điểm: cộng thẳng vào ví (trừ từ quỹ kế toán), tự đánh dấu đã trao
      if (+p.points > 0 && ADB.user(d, user.id)) { credit(d, user.id, p.wallet || 'shop', 'prize', +p.points, 'Quà vòng quay: ' + p.name + ' (mã ' + c.code + ')', spin.id); spin.points = +p.points; spin.given = true; spin.givenAt = at; spin.auto = true; }
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
  /* =====================================================================
     VÒNG QUAY CHÀO MỪNG VÀ MÃ GIẢM GIÁ
     Khách đăng ký xong được quay 1 lần (u.welcomeSpun). Trúng ô nào thì nhận mã giảm giá gắn với tài khoản,
     dùng 1 lần khi đặt hàng. Quản trị cài các ô quà: giảm % hoặc số tiền, số suất (hết suất thì ô đó không ra nữa),
     tỉ lệ trúng; hạn dùng mã, đơn tối thiểu. Đơn hủy thì mã được trả lại.
     ===================================================================== */
  const WELCOME = {
    enabled: true, expireDays: 30, minOrder: 0,
    prizes: [
      { id: 'cm1', label: 'Giảm 5%', type: 'pct', value: 5, maxOff: 0, qty: null, weight: 45, color: '#4fe6df', active: true },
      { id: 'cm2', label: 'Giảm 10%', type: 'pct', value: 10, maxOff: 0, qty: 100, weight: 30, color: '#f3c76b', active: true },
      { id: 'cm3', label: 'Giảm 50.000đ', type: 'amt', value: 50000, maxOff: 0, qty: 100, weight: 20, color: '#b98cff', active: true },
      { id: 'cm4', label: 'Giảm 15%', type: 'pct', value: 15, maxOff: 0, qty: 20, weight: 5, color: '#ff8fb1', active: true }
    ]
  };
  const welcomeSet = d => { d.settings = d.settings || {}; const w = d.settings.welcome = Object.assign({}, WELCOME, d.settings.welcome || {}); w.prizes = Array.isArray(w.prizes) ? w.prizes : WELCOME.prizes.map(p => Object.assign({}, p)); return w; };
  const offOf = (c, sub) => { const v = c.type === 'pct' ? Math.round(sub * (+c.value || 0) / 100) : +c.value || 0; return Math.max(0, Math.min(sub, c.maxOff > 0 ? Math.min(v, +c.maxOff) : v)); };
  Object.assign(ADB, {
    WELCOME,
    welcome: welcomeSet,
    // ô quà đang quay được: đang bật và còn suất (qty để trống là không giới hạn)
    welcomePrizes(d) { return welcomeSet(d).prizes.filter(p => p.active !== false && (p.qty == null || p.qty === '' || +p.qty > 0)); },
    welcomeCan(d, u) { const w = welcomeSet(d); return !!u && u.role !== 'admin' && !u.welcomeSpun && w.enabled !== false && ADB.welcomePrizes(d).length > 0; },
    welcomeSpin(d, u) {
      if (!u || u.role === 'admin') return { error: 'Anh chị đăng nhập tài khoản thành viên để quay.' };
      if (u.welcomeSpun) return { error: 'Anh chị đã quay vòng quay chào mừng rồi.' };
      const w = welcomeSet(d), list = ADB.welcomePrizes(d);
      if (w.enabled === false || !list.length) return { error: 'Vòng quay chào mừng đang tạm dừng.' };
      const p = pickWeighted(list), index = list.indexOf(p), at = stampNow();
      if (p.qty != null && p.qty !== '') p.qty = Math.max(0, +p.qty - 1);
      u.welcomeSpun = at;
      let coupon = null;
      if (p.type === 'pct' || p.type === 'amt') {
        d.coupons = d.coupons || [];
        const taken = new Set(d.coupons.map(c => c.code)); let code;
        do { code = 'GG-'; for (let i = 0; i < 6; i++) code += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; } while (taken.has(code));
        const exp = +w.expireDays > 0 ? new Date(Date.now() + w.expireDays * 864e5).toISOString().slice(0, 10) : null;
        coupon = { code, user: u.id, label: p.label, type: p.type, value: +p.value, maxOff: +p.maxOff || 0, minOrder: +w.minOrder || 0, expires: exp, status: 'new', order: null, prize: p.id, from: 'welcome', createdAt: at };
        d.coupons.push(coupon);
      }
      return { prize: p, index, segments: list, coupon };
    },
    couponsOf(d, userId) { return (d.coupons || []).filter(c => c.user === userId).sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || String(b.createdAt).localeCompare(String(a.createdAt))); },
    // kiểm tra mã trên tiền hàng (chưa tính phí giao): trả số tiền giảm
    couponCheck(d, code, u, sub) {
      const k = String(code || '').trim().toUpperCase(); if (!k) return { error: 'Anh chị nhập mã giảm giá.' };
      const c = (d.coupons || []).find(x => x.code === k);
      if (!c) return { error: 'Mã giảm giá không đúng.' };
      if (!u || c.user !== u.id) return { error: 'Mã này thuộc tài khoản khác. Anh chị đăng nhập đúng tài khoản nhận mã.' };
      if (c.status !== 'new') return { error: 'Mã này đã dùng cho đơn ' + (c.order || '') + '.' };
      if (c.expires && c.expires < now()) return { error: 'Mã này đã hết hạn ngày ' + c.expires.split('-').reverse().join('/') + '.' };
      if (c.minOrder > 0 && sub < c.minOrder) return { error: 'Mã này dùng cho đơn từ ' + PSQ.money(c.minOrder) + '.' };
      return { coupon: c, discount: offOf(c, sub) };
    },
    couponUse(d, c, o, discount) { c.status = 'used'; c.order = o.id; c.usedAt = stampNow(); o.coupon = c.code; o.discount = discount; o.total = Math.max(0, o.total - discount); },
    // đơn hủy: trả mã lại cho khách dùng đơn khác (mã cá nhân, hoặc 1 lượt của mã chương trình khuyến mãi)
    couponBack(d, o) {
      if (o && o.promo) { const p = (d.promos || []).find(x => x.id === o.promo), u = p && (p.uses || []).findIndex(x => x.order === o.id); if (!p || u < 0) return false; p.uses.splice(u, 1); p.used = Math.max(0, (+p.used || 0) - 1); return true; }
      const c = o && o.coupon && (d.coupons || []).find(x => x.code === o.coupon && x.order === o.id); if (!c) return false; c.status = 'new'; c.order = null; c.usedAt = null; return true;
    },

    /* ---------- chương trình khuyến mãi (quản trị đăng, hiện ở trang Khuyến mãi; có thể kèm mã dùng chung) ----------
       Mỗi đơn chỉ dùng 1 mã: mã cá nhân (vòng quay) hoặc mã chương trình, không cộng dồn. Mã chương trình mỗi người
       (theo tài khoản hoặc số điện thoại) dùng 1 lần, có giới hạn tổng số lượt nếu quản trị đặt. */
    promoLive(p, day) { day = day || now(); return !!p && p.active !== false && (!p.start || p.start <= day) && (!p.end || p.end >= day); },
    promosLive(d) { return (d.promos || []).filter(p => ADB.promoLive(p)).sort((a, b) => String(a.end || '9999').localeCompare(String(b.end || '9999'))); },
    codeCheck(d, code, u, sub, phone) {
      const k = String(code || '').trim().toUpperCase(); if (!k) return { error: 'Anh chị nhập mã giảm giá.' };
      if ((d.coupons || []).some(x => x.code === k)) return ADB.couponCheck(d, k, u, sub);
      const p = (d.promos || []).find(x => x.code && String(x.code).toUpperCase() === k);
      if (!p) return { error: 'Mã giảm giá không đúng.' };
      if (!ADB.promoLive(p)) return { error: p.start && p.start > now() ? 'Chương trình này chưa bắt đầu.' : 'Chương trình này đã kết thúc.' };
      if (+p.limit > 0 && (+p.used || 0) >= +p.limit) return { error: 'Mã này đã hết lượt dùng.' };
      if (+p.minOrder > 0 && sub < +p.minOrder) return { error: 'Mã này dùng cho đơn từ ' + PSQ.money(+p.minOrder) + '.' };
      const ph = String(phone || '').replace(/\D/g, '');
      if ((p.uses || []).some(x => (u && x.user === u.id) || (ph && x.phone === ph))) return { error: 'Anh chị đã dùng mã này cho đơn trước rồi.' };
      return { promo: p, discount: offOf(p, sub), label: p.title };
    },
    codeUse(d, r, o) {
      if (r.coupon) return ADB.couponUse(d, r.coupon, o, r.discount);
      const p = r.promo; p.used = (+p.used || 0) + 1; (p.uses = p.uses || []).push({ order: o.id, user: o.userId || null, phone: String(o.phone || '').replace(/\D/g, ''), at: stampNow() });
      o.coupon = String(p.code).toUpperCase(); o.promo = p.id; o.discount = r.discount; o.total = Math.max(0, o.total - r.discount);
    }
  });

  {
    const baseLoad = ADB.load;
    ADB.load = function () { const d = baseLoad(); wheelData(d); return d; };
  }
})();
