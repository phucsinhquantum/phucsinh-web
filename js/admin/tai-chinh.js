/* Phúc Sinh QuanTum · quản trị: tài chính (báo cáo, đối soát ví, chi phí, giao dịch, hoa hồng, nạp điểm). Chạy thử trên trình duyệt. */
(function () {
  const { $, $$, esc, money, short, initials, fdate, today, icon, toast, modal, area, donut } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const M = window.ADMIN_MODULES;

  if (!document.getElementById('adm-css-tai-chinh')) document.head.insertAdjacentHTML('beforeend', `<style id="adm-css-tai-chinh">
    .tc-note { font-size: 12px; color: var(--text-3); }
    .tc-chips { margin-bottom: 14px; }
    .tc-chips .chip { cursor: pointer; }
    .tc-chips .chip small { opacity: .7; margin-left: 4px; }
    .tc-act { display: flex; gap: 6px; flex-wrap: nowrap; }
    .tc-sum { font-size: 13px; color: var(--text-2); }
    .tc-date { min-width: 0 !important; flex: none !important; width: 150px !important; }
    :is([data-pane="wallet"], [data-pane="transactions"], [data-pane="commissions"], [data-pane="topups"]) .tbl .who b { white-space: nowrap; }
    .tc-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
    .tc-strip > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; } .tc-strip b { font-size: 17px; } .tc-strip small { font-size: 12px; }
    .tc-pos { color: var(--green); } .tc-neg { color: var(--red); }
    @media (max-width: 699px) { .tc-date { width: calc(50% - 5px) !important; } }
  </style>`);

  const AV = ['', 'v', 'g'];
  const PAL = ['#f3c76b', '#4fe6df', '#b98cff', '#45e08f', '#ff9f6b', '#ff6b9a', '#9aa7ab'];
  const can = () => window.ADMIN ? ADMIN.can('finance') : false;
  const user = (d, id) => d.users.find(u => u.id === id);
  const uname = (d, id) => (user(d, id) || {}).name || 'Không rõ';
  const who = (d, id, i = 0) => { const u = user(d, id) || { name: 'Không rõ' }; return `<div class="who"><span class="avatar ${AV[i % 3]}">${esc(initials(u.name))}</span><div><b>${esc(u.name)}</b><small>${esc(u.code || u.email || '')}</small></div></div>`; };
  const match = (d, id, q) => !q || [(user(d, id) || {}).name, (user(d, id) || {}).email, (user(d, id) || {}).code, (user(d, id) || {}).phone].join(' ').toLowerCase().includes(q);
  const commit = (d, action, detail, msg) => { ADB.log(d, action, detail); ADB.save(d); toast(msg || action); };
  const WST = { done: ['Hoàn tất', 'ok'], pending: ['Chờ duyệt', 'pending'], rejected: ['Từ chối', 'failed'] };
  const wBadge = s => `<span class="badge ${(WST[s] || [])[1] || ''}">${(WST[s] || [s])[0]}</span>`;
  const cBadge = s => `<span class="badge ${(ADB.commissionStatus[s] || [])[1] || ''}">${(ADB.commissionStatus[s] || [s])[0]}</span>`;
  const amt = n => `<b class="nowrap ${n < 0 ? 'tc-neg' : 'tc-pos'}">${n > 0 ? '+' : ''}${money(n)}</b>`;
  const stat = (label, val, ico, c, g, foot) => `<div class="card ${g} stat"><div class="stat-top"><span class="stat-ico ${c}">${icon(ico)}</span>${label}</div><div class="stat-val">${val}</div>${foot ? `<div class="tc-note mt-1">${foot}</div>` : ''}</div>`;
  const head = (title, sub, right = '') => `<div class="card-head" style="flex-wrap:wrap"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="row wrap" style="margin-left:auto;gap:8px">${right}</div></div>`;
  const csvBtn = id => `<button class="btn btn-sm btn-outline-gold" type="button" id="${id}">${icon('download')} Tải Excel (CSV)</button>`;
  const viewOnly = () => can() ? '' : `<p class="tc-note mb-1" style="margin-bottom:10px">${icon('lock')} Vai trò của anh chị chỉ được xem mục này.</p>`;
  const empty = (cols, t) => `<tr><td colspan="${cols}"><div class="empty">${t}</div></td></tr>`;
  const sh = n => (n < 0 ? '-' : '') + short(Math.abs(n));
  const mkey = s => String(s).slice(0, 7);
  const mlabel = k => 'Tháng ' + k.slice(5, 7) + '/' + k.slice(0, 4);

  /* ---------- Báo cáo tài chính ---------- */
  let period = '30';
  M.finance = { render(el) {
    const d = ADB.load(), now = new Date();
    const from = period === 'year' ? now.getFullYear() + '-01-01' : ADB.daysAgo(+period), to = today();
    const inR = x => x.date && x.date.slice(0, 10) >= from && x.date.slice(0, 10) <= to;
    const orders = d.orders.filter(o => o.status !== 'failed' && inR(o)), rec = (d.receipts || []).filter(inR), exp = (d.expenses || []).filter(inR);
    const com = (d.commissions || []).filter(c => c.status === 'paid' && ['ref', 'direct', 'override'].includes(c.kind || 'direct') && inR(c));
    const P = ADB.plan(d), pkgs = d.orders.filter(o => ['paid', 'ship', 'done'].includes(o.status) && inR(o) && (o.items || []).some(x => x.id === ADB.PKG_ID));
    const fee = pkgs.length * (P.pkgPrice - P.pkgPoints), ck = k => com.filter(c => (c.kind || 'direct') === k).reduce((s, c) => s + c.amount, 0);
    const sum = (a, f = x => x.total) => a.reduce((s, x) => s + (f(x) || 0), 0);
    const rev = sum(orders), cogs = sum(rec), ex = sum(exp, x => x.amount), cm = sum(com, x => x.amount), profit = rev - cogs - ex - cm;
    el.innerHTML = `<div class="row between wrap" style="gap:10px;margin-bottom:14px"><div class="chips" id="tcPer">${[['30', '30 ngày'], ['90', '90 ngày'], ['year', 'Năm nay']].map(([k, l]) => `<button class="chip${k === period ? ' on' : ''}" type="button" data-p="${k}">${l}</button>`).join('')}</div><span class="tc-note">Từ ${fdate(from)} đến ${fdate(to)} (số liệu ước tính, chạy thử)</span></div>
      <div class="grid g-5">
        ${stat('Doanh thu', sh(rev), 'wallet', 'gold', 'glow-gold', orders.length + ' đơn không hủy')}
        ${stat('Giá vốn nhập kho', sh(cogs), 'truck', 'cyan', 'glow-cyan', rec.length + ' phiếu nhập')}
        ${stat('Chi phí', sh(ex), 'card', 'red', 'glow-gold', exp.length + ' khoản chi')}
        ${stat('Hoa hồng', sh(cm), 'award', 'violet', 'glow-cyan', 'đã trả vào ví thành viên')}
        ${stat('Lợi nhuận ước tính', `<span class="${profit < 0 ? 'red' : 'green'}">${sh(profit)}</span>`, 'trend', 'green', 'glow-gold', rev ? 'Biên ' + Math.round(profit / rev * 100) + '%' : '')}
      </div>
      <div class="card glow-mix mt-2 tc-strip"><div><span class="tc-note">Phí nền tảng thu được</span><b class="gold">${money(fee)}</b><small class="dim">${pkgs.length} gói CTV đã thanh toán × ${money(P.pkgPrice - P.pkgPoints)}</small></div>
        <div><span class="tc-note">Điểm gói đã cấp</span><b class="green">${money(pkgs.length * P.pkgPoints).replace('đ', ' PS')}</b><small class="dim">vào ví mua hàng</small></div>
        <div><span class="tc-note">Thưởng giới thiệu</span><b>${money(ck('ref'))}</b></div><div><span class="tc-note">Hoa hồng bán hàng</span><b>${money(ck('direct'))}</b></div><div><span class="tc-note">Thu nhập từ đại lý</span><b>${money(ck('override'))}</b></div></div>
      <div class="grid g-main-r mt-2">
        <div class="card glow-cyan">${head('Doanh thu và chi phí', 'chi phí gồm giá vốn, chi phí, hoa hồng', `<span class="row" style="gap:12px;font-size:12px"><span class="row" style="gap:6px"><span class="dot" style="color:#f3c76b"></span>Doanh thu</span><span class="row" style="gap:6px"><span class="dot" style="color:#4fe6df"></span>Tổng chi</span></span>`)}<div id="tcArea"></div></div>
        <div class="card glow-gold">${head('Cơ cấu chi phí', 'theo nhóm')}<div id="tcDonut"></div><div class="legend mt-2" id="tcLeg"></div></div>
      </div>
      <div class="card glow-mix mt-2">${head('Theo tháng', 'đơn vị: đồng', csvBtn('tcFinCsv'))}
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Tháng</th><th>Doanh thu</th><th>Giá vốn</th><th>Chi phí</th><th>Hoa hồng</th><th>Lợi nhuận</th></tr></thead><tbody id="tcMon"></tbody></table></div></div>`;
    $('#tcPer', el).addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { period = b.dataset.p; M.finance.render(el); } });
    // biểu đồ: chia khoảng thời gian thành các cột
    const days = Math.round((new Date(to) - new Date(from)) / 864e5) + 1, n = period === 'year' ? Math.max(2, now.getMonth() + 1) : period === '90' ? 13 : 10;
    const bucket = s => period === 'year' ? +s.slice(5, 7) - 1 : Math.min(n - 1, Math.floor((new Date(s.slice(0, 10)) - new Date(from)) / 864e5 / (days / n)));
    const R = Array(n).fill(0), C = Array(n).fill(0);
    orders.forEach(o => R[bucket(o.date)] += o.total); rec.forEach(x => C[bucket(x.date)] += x.total); exp.forEach(x => C[bucket(x.date)] += x.amount); com.forEach(x => C[bucket(x.date)] += x.amount);
    const labels = R.map((_, i) => { if (period === 'year') return 'T' + (i + 1); const t = new Date(from); t.setDate(t.getDate() + Math.round(i * days / n)); return String(t.getDate()).padStart(2, '0') + '/' + String(t.getMonth() + 1).padStart(2, '0'); });
    const box = $('#tcArea', el);
    if (Math.max(...R, ...C) > 0) requestAnimationFrame(() => box.isConnected && area(box, { labels, height: 250, series: [{ name: 'Thu', color: '#f3c76b', dots: true, values: R }, { name: 'Chi', color: '#4fe6df', values: C }] }));
    else $('#tcArea', el).innerHTML = `<div class="empty">${icon('chart')}Chưa có số liệu trong khoảng này.</div>`;
    const cats = {}; exp.forEach(x => cats[x.cat] = (cats[x.cat] || 0) + x.amount);
    const seg = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: PAL[i % PAL.length] }));
    donut($('#tcDonut', el), { segments: seg.length ? seg : [{ value: 1, color: '#333' }], center: sh(ex), sub: 'tổng chi phí' });
    $('#tcLeg', el).innerHTML = seg.map(s => `<div class="legend-row"><span class="dot" style="color:${s.color}"></span><span>${esc(s.name)}</span><span>${money(s.value)}</span></div>`).join('') || '<p class="dim">Chưa có khoản chi.</p>';
    const months = {}; const add = (k, f, v) => { (months[k] = months[k] || { r: 0, g: 0, e: 0, c: 0 })[f] += v; };
    orders.forEach(o => add(mkey(o.date), 'r', o.total)); rec.forEach(x => add(mkey(x.date), 'g', x.total)); exp.forEach(x => add(mkey(x.date), 'e', x.amount)); com.forEach(x => add(mkey(x.date), 'c', x.amount));
    const rows = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
    $('#tcMon', el).innerHTML = rows.length ? rows.map(([k, v]) => { const p = v.r - v.g - v.e - v.c; return `<tr><td class="nowrap"><b>${mlabel(k)}</b></td><td class="gold nowrap">${money(v.r)}</td><td class="nowrap">${money(v.g)}</td><td class="nowrap">${money(v.e)}</td><td class="nowrap">${money(v.c)}</td><td class="nowrap ${p < 0 ? 'red' : 'green'}"><b>${money(p)}</b></td></tr>`; }).join('') : empty(6, 'Chưa có số liệu.');
    $('#tcFinCsv', el).addEventListener('click', () => ADB.csv('bao-cao-tai-chinh', [['Tháng', 'Doanh thu', 'Giá vốn', 'Chi phí', 'Hoa hồng', 'Lợi nhuận ước tính'], ...rows.map(([k, v]) => [k, v.r, v.g, v.e, v.c, v.r - v.g - v.e - v.c])]));
  } };

  /* ---------- Đối soát ví & dòng tiền ---------- */
  const WK = Object.keys(ADB.WALLETS);
  const wTag = k => { const w = ADB.WALLETS[k] || { short: k, color: '#9aa7ab' }; return `<span class="badge nowrap" style="color:${w.color};border-color:${w.color}55;background:${w.color}14">${esc(w.short)}</span>`; };
  // rút từ ví tiền mặt: thuế đã trừ lúc chuyển từ ví hoa hồng nên thuế 0; rút ví hoa hồng kiểu cũ: trừ thuế khi rút
  const taxOf = (d, w) => { const a = -w.amount, t = w.tax != null ? w.tax : ADB.walletOf(w) === 'cash' ? 0 : Math.round(a * ADB.plan(d).taxRate / 100); return { a, t, net: w.net != null ? w.net : a - t }; };
  const WCOL = ['gold', 'cyan', 'violet', 'green', 'red'];
  M.wallet = { render(el) {
    const d = ADB.load(), W = d.wallet || [], mem = d.users.filter(u => u.role !== 'admin'), P = ADB.plan(d);
    const pend = W.filter(w => w.type === 'withdraw' && w.status === 'pending');
    const bal = {}; mem.forEach(u => bal[u.id] = ADB.balances(d, u.id));
    const tot = k => mem.reduce((s, u) => s + bal[u.id][k], 0);
    const pendSum = pend.reduce((s, w) => s + taxOf(d, w).a, 0);
    const taxYear = W.filter(w => w.type === 'tocash' && w.amount < 0 && w.status === 'done' && String(w.date).slice(0, 4) === today().slice(0, 4)).reduce((s, w) => s + (w.tax || 0), 0);
    el.innerHTML = `${viewOnly()}<div class="grid g-3 keep-2">
        ${WK.map((k, i) => stat(ADB.WALLETS[k].name, `<span style="color:${ADB.WALLETS[k].color}">${sh(tot(k))}</span>`, ADB.WALLETS[k].icon, WCOL[i % WCOL.length], i % 2 ? 'glow-cyan' : 'glow-gold', esc(ADB.WALLETS[k].note))).join('')}
        ${stat('Đang chờ rút', sh(pendSum), 'clock', 'gold', 'glow-cyan', `${pend.length} yêu cầu, đã tạm giữ trong ví · thuế TNCN đã khấu trừ năm nay ${sh(taxYear)}`)}
      </div>
      <div class="card glow-gold mt-2">${head('Yêu cầu rút tiền chờ duyệt', `${pend.length} yêu cầu · thuế thu nhập ${P.taxRate}% đã trừ khi thành viên rút từ ví hoa hồng bán hàng sang ví tiền mặt, công ty chuyển khoản đủ số tiền rút từ ví tiền mặt`, can() ? `<button class="btn btn-sm btn-gold" type="button" id="tcAdj">${icon('plus')} Điều chỉnh ví</button>` : '')}
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thành viên</th><th>Từ ví</th><th>Số tiền rút</th><th>Thuế</th><th>Chuyển khoản</th><th>Ngân hàng</th><th>Còn lại trong ví</th><th>Ngày</th><th></th></tr></thead><tbody id="tcWp">
        ${pend.length ? pend.map((w, i) => { const x = taxOf(d, w), wk = ADB.walletOf(w), b = (bal[w.user] || ADB.balances(d, w.user))[wk], bk = w.bank || {}; return `<tr><td>${who(d, w.user, i)}</td><td>${wTag(wk)}</td><td class="nowrap"><b>${money(x.a)}</b></td><td class="nowrap ${x.t ? 'red' : 'dim'}">${x.t ? '-' + money(x.t) : wk === 'cash' ? 'Đã trừ trước' : '0đ'}</td><td class="nowrap green"><b>${money(x.net)}</b></td><td class="nowrap">${bk.bank ? `${esc(bk.bank)}<br><small class="dim">${esc(bk.account || '')}${bk.holder ? ' · ' + esc(bk.holder) : ''}</small>` : '<span class="dim">Chưa có</span>'}</td><td class="nowrap ${b < 0 ? 'red' : ''}">${money(b)}</td><td class="dim nowrap">${fdate(w.date)}</td><td>${can() ? `<div class="tc-act"><button class="btn btn-sm btn-gold" type="button" data-ok="${w.id}">Duyệt</button><button class="btn btn-sm btn-ghost" type="button" data-no="${w.id}">Từ chối</button></div>` : wBadge(w.status)}</td></tr>`; }).join('') : empty(9, 'Không có yêu cầu rút tiền đang chờ.')}
        </tbody></table></div>
        <p class="tc-note mt-1">Yêu cầu rút từ ví hoa hồng bán hàng (dữ liệu cũ) vẫn duyệt được như trước: thuế ${P.taxRate}% trừ khi duyệt.</p></div>
      <div class="card glow-cyan mt-2">${head('Số dư ' + WK.length + ' ví theo thành viên', 'khoản rút đang chờ đã được trừ tạm', csvBtn('tcWCsv'))}
        <div class="toolbar"><input class="input" id="tcWq" placeholder="Tìm tên, email, mã thành viên" aria-label="Tìm thành viên"></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thành viên</th>${WK.map(k => `<th class="nowrap">${esc(ADB.WALLETS[k].short)}</th>`).join('')}<th>Chờ rút</th><th>Giao dịch</th></tr></thead><tbody id="tcWl"></tbody></table></div></div>`;
    const rowsOf = q => mem.filter(u => match(d, u.id, q)).map(u => { const mine = W.filter(w => w.user === u.id), b = bal[u.id];
      return { u, b, sum: WK.reduce((s, k) => s + b[k], 0), pw: -mine.filter(w => w.type === 'withdraw' && w.status === 'pending').reduce((s, w) => s + w.amount, 0), n: mine.length }; })
      .filter(r => r.n).sort((a, b) => b.sum - a.sum);
    const list = () => { const rs = rowsOf($('#tcWq', el).value.trim().toLowerCase());
      $('#tcWl', el).innerHTML = rs.length ? rs.map((r, i) => `<tr><td>${who(d, r.u.id, i)}</td>${WK.map(k => `<td class="nowrap" style="${r.b[k] ? 'color:' + ADB.WALLETS[k].color : ''}">${r.b[k] ? '<b>' + money(r.b[k]) + '</b>' : '<span class="dim">0đ</span>'}</td>`).join('')}<td class="nowrap">${r.pw ? `<span class="badge pending">${money(r.pw)}</span>` : '<span class="dim">0đ</span>'}</td><td>${r.n}</td></tr>`).join('') : empty(WK.length + 3, 'Không có thành viên phù hợp.'); };
    list(); $('#tcWq', el).addEventListener('input', list);
    $('#tcWCsv', el).addEventListener('click', () => ADB.csv('doi-soat-vi', [['Mã', 'Thành viên', 'Tên truy cập', 'Email', ...WK.map(k => ADB.WALLETS[k].name), 'Chờ rút', 'Số giao dịch'], ...rowsOf('').map(r => [r.u.code, r.u.name, r.u.username, r.u.email, ...WK.map(k => r.b[k]), r.pw, r.n])]));
    $('#tcWp', el).addEventListener('click', e => {
      const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'); if (!ok && !no || !can()) return;
      const dd = ADB.load(), w = dd.wallet.find(x => x.id === (ok || no).dataset[ok ? 'ok' : 'no']); if (!w || w.status !== 'pending') return;
      const wn = (ADB.WALLETS[ADB.walletOf(w)] || { name: 'ví' }).name.toLowerCase();
      if (ok && ADB.balances(dd, w.user)[ADB.walletOf(w)] < 0 && !confirm(`${wn.charAt(0).toUpperCase() + wn.slice(1)} không đủ cho yêu cầu này. Vẫn duyệt?`)) return;
      if (no && !confirm(`Từ chối yêu cầu rút tiền này? Số tiền sẽ trả lại ${wn}.`)) return;
      const x = taxOf(dd, w); if (w.tax == null) w.tax = x.t; if (w.net == null) w.net = x.net;
      w.status = ok ? 'done' : 'rejected'; w.done = today();
      commit(dd, ok ? 'Duyệt rút tiền' : 'Từ chối rút tiền', `${uname(dd, w.user)}: ${money(x.a)} từ ${wn}${ok ? `, thuế ${money(x.t)}, chuyển khoản ${money(x.net)}` : ''}`, ok ? `Đã duyệt. Chuyển khoản ${money(x.net)} cho ${uname(dd, w.user)}` : 'Đã từ chối, tiền đã trả lại ' + wn); M.wallet.render(el);
    });
    if (can()) $('#tcAdj', el).addEventListener('click', () => {
      const md = modal(`<form id="tcAf"><div class="card-head"><h3>Điều chỉnh ví thành viên</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
        <div class="form-grid"><div class="field full"><label>Thành viên</label><select class="input" name="user" required>${mem.map(u => `<option value="${u.id}">${esc(u.name)} (@${esc(u.username || u.code || '')})</option>`).join('')}</select></div>
        <div class="field"><label>Ví</label><select class="input" name="wallet">${WK.map(k => `<option value="${k}">${esc(ADB.WALLETS[k].name)}</option>`).join('')}</select></div>
        <div class="field"><label>Loại</label><select class="input" name="type"><option value="adjust">Điều chỉnh</option><option value="bonus">Thưởng</option></select></div>
        <div class="field full"><label>Số tiền hoặc điểm (âm để trừ)</label><input class="input" name="amount" type="number" step="1000" required placeholder="vd 200000 hoặc -50000"><small class="tc-note" id="tcAb"></small><small class="tc-note">Cộng thì trừ từ quỹ kế toán (còn ${money(ADB.fundKT(d))}), trừ thì trả về quỹ kế toán. Ghi vào sổ quỹ.</small></div>
        <div class="field full"><label>Ghi chú</label><input class="input" name="note" required placeholder="Lý do điều chỉnh"></div></div>
        <p class="red mt-1" id="tcAe" style="font-size:13px;min-height:18px"></p>
        <div class="row mt-2" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu</button></div></form>`);
      const f0 = $('#tcAf', md.el), showBal = () => { const b = ADB.balances(d, f0.user.value); $('#tcAb', md.el).textContent = 'Số dư hiện tại: ' + money(b[f0.wallet.value]); };
      f0.user.addEventListener('change', showBal); f0.wallet.addEventListener('change', showBal); showBal();
      f0.addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), a = Math.round(+f.amount);
        if (!a) return $('#tcAe', md.el).textContent = 'Anh chị nhập số tiền khác 0.';
        const dd = ADB.load();
        if (ADB.balances(dd, f.user)[f.wallet] + a < 0) return $('#tcAe', md.el).textContent = 'Số dư ví không đủ để trừ khoản này.';
        const kt = ADB.fundKT(dd); if (a > 0 && a > kt) return $('#tcAe', md.el).textContent = 'Quỹ kế toán chỉ còn ' + money(kt) + '. Chủ sở hữu cần chuyển thêm điểm cho quỹ kế toán trước.';
        ADB.credit(dd, f.user, f.wallet, f.type, a, f.note.trim(), '');
        commit(dd, 'Điều chỉnh ví', `${uname(dd, f.user)} · ${ADB.WALLETS[f.wallet].name}: ${a > 0 ? '+' : ''}${money(a)} (${f.note.trim()})`, 'Đã điều chỉnh ví ' + uname(dd, f.user)); md.close(); M.wallet.render(el); });
    });
  } };

  /* ---------- Quản lý chi phí ---------- */
  let expCat = '';
  const BASE_CATS = ['Mặt bằng', 'Nhân sự', 'Quảng cáo', 'Vận chuyển', 'Bao bì', 'Khác'];
  M.expenses = { render(el) {
    const d = ADB.load(), E = d.expenses = d.expenses || [];
    const cats = [...new Set([...BASE_CATS, ...E.map(x => x.cat)])];
    const tot = c => E.filter(x => x.cat === c).reduce((s, x) => s + x.amount, 0);
    const list = E.filter(x => !expCat || x.cat === expCat).sort((a, b) => b.date.localeCompare(a.date));
    const total = list.reduce((s, x) => s + x.amount, 0), thisM = list.filter(x => mkey(x.date) === mkey(today())).reduce((s, x) => s + x.amount, 0);
    const months = {}; list.forEach(x => months[mkey(x.date)] = (months[mkey(x.date)] || 0) + x.amount);
    el.innerHTML = `${viewOnly()}<div class="chips tc-chips" id="tcEc"><button class="chip${expCat ? '' : ' on'}" type="button" data-c="">Tất cả<small>${sh(E.reduce((s, x) => s + x.amount, 0))}</small></button>${cats.map(c => `<button class="chip${c === expCat ? ' on' : ''}" type="button" data-c="${esc(c)}">${esc(c)}<small>${sh(tot(c))}</small></button>`).join('')}</div>
      <div class="grid g-4 keep-2">${stat(expCat || 'Tất cả nhóm', sh(total), 'card', 'gold', 'glow-gold', list.length + ' khoản')}${stat('Tháng này', sh(thisM), 'clock', 'cyan', 'glow-cyan')}${stat('Trung bình tháng', sh(Object.keys(months).length ? total / Object.keys(months).length : 0), 'chart', 'violet', 'glow-gold')}${stat('Số tháng có chi', Object.keys(months).length, 'activity', 'green', 'glow-cyan')}</div>
      <div class="grid g-main-r mt-2">
        <div class="card glow-cyan">${head('Danh sách khoản chi', expCat ? esc(expCat) : 'tất cả nhóm', (can() ? `<button class="btn btn-sm btn-gold" type="button" id="tcEadd">${icon('plus')} Thêm khoản chi</button>` : '') + csvBtn('tcECsv'))}
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Nhóm</th><th>Nội dung</th><th>Số tiền</th>${can() ? '<th></th>' : ''}</tr></thead><tbody id="tcEl">
          ${list.length ? list.map(x => `<tr><td class="dim nowrap">${fdate(x.date)}</td><td><span class="badge gold">${esc(x.cat)}</span></td><td style="min-width:170px"><b>${esc(x.name)}</b>${x.note ? `<br><small class="dim">${esc(x.note)}</small>` : ''}</td><td class="nowrap red">${money(x.amount)}</td>${can() ? `<td><div class="tc-act"><button class="btn btn-sm" type="button" data-e="${x.id}">Sửa</button><button class="btn btn-sm btn-ghost" type="button" data-x="${x.id}" aria-label="Xóa">${icon('trash')}</button></div></td>` : ''}</tr>`).join('') : empty(5, 'Chưa có khoản chi trong nhóm này.')}
          </tbody></table></div></div>
        <div class="card glow-gold">${head('Tổng theo tháng', expCat || 'tất cả nhóm')}
          <div class="legend">${Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).map(([k, v], i) => `<div class="legend-row"><span class="dot" style="color:${PAL[i % PAL.length]}"></span><span>${mlabel(k)}</span><span>${money(v)}</span></div>`).join('') || '<p class="dim">Chưa có số liệu.</p>'}</div>
          ${expCat ? '' : `<div class="divider"></div><h3 style="font-size:15px">Theo nhóm</h3><div class="legend mt-1">${cats.map((c, i) => `<div class="legend-row"><span class="dot" style="color:${PAL[i % PAL.length]}"></span><span>${esc(c)}</span><span>${money(tot(c))}</span></div>`).join('')}</div>`}</div>
      </div>`;
    $('#tcEc', el).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { expCat = b.dataset.c; M.expenses.render(el); } });
    $('#tcECsv', el).addEventListener('click', () => ADB.csv('chi-phi' + (expCat ? '-' + expCat : ''), [['Ngày', 'Nhóm', 'Nội dung', 'Số tiền', 'Ghi chú'], ...list.map(x => [x.date, x.cat, x.name, x.amount, x.note])]));
    if (!can()) return;
    const edit = x => {
      const isNew = !x; x = x || { cat: expCat || cats[0], name: '', amount: '', date: today(), note: '' };
      const md = modal(`<form id="tcEf"><div class="card-head"><h3>${isNew ? 'Thêm khoản chi' : 'Sửa khoản chi'}</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
        <div class="form-grid"><div class="field"><label>Nhóm chi phí</label><input class="input" name="cat" list="tcCats" value="${esc(x.cat)}" required><datalist id="tcCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="field"><label>Ngày</label><input class="input" name="date" type="date" value="${esc(x.date)}" required></div>
        <div class="field full"><label>Nội dung</label><input class="input" name="name" value="${esc(x.name)}" required></div>
        <div class="field"><label>Số tiền (đồng)</label><input class="input" name="amount" type="number" min="1000" step="1000" value="${x.amount}" required></div>
        <div class="field"><label>Ghi chú</label><input class="input" name="note" value="${esc(x.note || '')}"></div></div>
        <div class="row mt-3" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu</button></div></form>`);
      $('#tcEf', md.el).addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), dd = ADB.load();
        const v = { cat: f.cat.trim(), name: f.name.trim(), amount: Math.round(+f.amount), date: f.date, note: f.note.trim() };
        if (isNew) dd.expenses.push({ id: ADB.uid('cp'), ...v }); else Object.assign(dd.expenses.find(y => y.id === x.id), v);
        commit(dd, isNew ? 'Thêm chi phí' : 'Sửa chi phí', `${v.cat}: ${v.name} ${money(v.amount)}`, isNew ? 'Đã thêm khoản chi' : 'Đã lưu khoản chi'); md.close(); M.expenses.render(el); });
    };
    $('#tcEadd', el).addEventListener('click', () => edit(null));
    $('#tcEl', el).addEventListener('click', e => { const ed = e.target.closest('[data-e]'), dl = e.target.closest('[data-x]');
      if (ed) edit(E.find(x => x.id === ed.dataset.e));
      if (dl && confirm('Xóa khoản chi này?')) { const dd = ADB.load(), i = dd.expenses.findIndex(x => x.id === dl.dataset.x), x = dd.expenses[i]; dd.expenses.splice(i, 1); commit(dd, 'Xóa chi phí', `${x.cat}: ${x.name} ${money(x.amount)}`, 'Đã xóa khoản chi'); M.expenses.render(el); } });
  } };

  /* ---------- Lịch sử giao dịch ---------- */
  M.transactions = { render(el) {
    const d = ADB.load(), W = (d.wallet || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    el.innerHTML = `<div class="card glow-cyan">${head('Lịch sử giao dịch ví', '<span id="tcTn"></span>', csvBtn('tcTCsv'))}
      <div class="toolbar"><input class="input" id="tcTq" placeholder="Tìm thành viên" aria-label="Tìm thành viên">
        <select class="input" id="tcTw" aria-label="Ví"><option value="">Tất cả ví</option>${WK.map(k => `<option value="${k}">${esc(ADB.WALLETS[k].name)}</option>`).join('')}</select>
        <select class="input" id="tcTt" aria-label="Loại giao dịch"><option value="">Tất cả loại</option>${Object.entries(ADB.walletType).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        <select class="input" id="tcTs" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(WST).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
        <input class="input tc-date" id="tcTf" type="date" aria-label="Từ ngày"><input class="input tc-date" id="tcTe" type="date" aria-label="Đến ngày"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Thành viên</th><th>Ví</th><th>Loại</th><th>Nội dung</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody id="tcTl"></tbody></table></div></div>`;
    const filt = () => { const q = $('#tcTq', el).value.trim().toLowerCase(), wl = $('#tcTw', el).value, t = $('#tcTt', el).value, s = $('#tcTs', el).value, f = $('#tcTf', el).value, e = $('#tcTe', el).value;
      return W.filter(w => (!wl || ADB.walletOf(w) === wl) && (!t || w.type === t) && (!s || w.status === s) && (!f || w.date >= f) && (!e || w.date.slice(0, 10) <= e) && match(d, w.user, q)); };
    const list = () => { const L = filt(); $('#tcTn', el).textContent = `${L.length} giao dịch · tổng ${money(L.filter(w => w.status === 'done').reduce((s, w) => s + w.amount, 0))} (đã hoàn tất)`;
      $('#tcTl', el).innerHTML = L.length ? L.slice(0, 300).map((w, i) => `<tr><td class="dim nowrap">${fdate(w.date)}</td><td>${who(d, w.user, i)}</td><td>${wTag(ADB.walletOf(w))}</td><td><span class="badge ${w.amount < 0 ? 'violet' : 'ship'} nowrap">${esc(ADB.walletType[w.type] || w.type)}</span></td><td class="dim" style="min-width:180px">${esc(w.note || '')}</td><td>${amt(w.amount)}</td><td>${wBadge(w.status)}</td></tr>`).join('') : empty(7, 'Không có giao dịch phù hợp.'); };
    list(); $$('.toolbar .input', el).forEach(i => i.addEventListener(i.tagName === 'SELECT' || i.type === 'date' ? 'change' : 'input', list));
    $('#tcTCsv', el).addEventListener('click', () => ADB.csv('lich-su-giao-dich', [['Ngày', 'Mã TV', 'Thành viên', 'Ví', 'Loại', 'Nội dung', 'Số tiền', 'Trạng thái'], ...filt().map(w => [w.date, (user(d, w.user) || {}).code, uname(d, w.user), (ADB.WALLETS[ADB.walletOf(w)] || {}).name, ADB.walletType[w.type] || w.type, w.note, w.amount, (WST[w.status] || [w.status])[0]])]));
  } };

  /* ---------- Lịch sử hoa hồng ---------- */
  const kindOf = c => c.kind || (c.status === 'missed' ? 'missed' : 'direct');
  const kindName = c => ADB.commissionKind[kindOf(c)] || ('F' + (c.level || 1));
  const KC = { ref: 'gold', direct: 'ship', override: 'violet', missed: 'failed' };
  // đại lý chưa đủ điều kiện nhận thu nhập từ đại lý tuyến dưới (tự mua và có đơn bán trong N ngày)
  function agentAct(d) {
    const P = ADB.plan(d), A = d.users.filter(u => u.role !== 'admin' && u.tier === 'daily').map(u => ({ u, a: ADB.activity(d, u.id), held: (d.commissions || []).filter(c => c.user === u.id && c.status === 'hold').reduce((s, c) => s + c.amount, 0) }));
    const bad = A.filter(x => !x.a.ok || x.a.left <= 7).sort((x, y) => (x.a.ok - y.a.ok) || (x.a.left - y.a.left));
    const cell = p => p.ok ? `<span class="green nowrap">${fdate(p.last)}</span><br><small class="dim">còn ${p.left} ngày</small>` : '<span class="badge failed">Thiếu</span>';
    const MODE = { hold: `giữ chờ tối đa ${P.holdDays} ngày`, lose: 'không nhận', up: 'chuyển lên đại lý tuyến trên' };
    return `<div class="card glow-gold mt-2">${head('Điều kiện nhận thu nhập từ đại lý tuyến dưới', `${A.length - A.filter(x => !x.a.ok).length}/${A.length} đại lý đủ điều kiện · trong ${P.activeDays} ngày phải có ${P.activeRule === 'all' ? 'đơn tự mua và đơn bán' : 'đơn tự mua hoặc đơn bán'} · chưa đủ thì ${MODE[P.overrideMode] || ''}`)}
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Đại lý</th><th>Tự mua gần nhất</th><th>Đơn bán gần nhất</th>${P.overrideMode === 'hold' ? '<th>Đang giữ chờ</th>' : ''}<th>Tình trạng</th></tr></thead><tbody>
      ${bad.length ? bad.map((x, i) => `<tr><td>${who(d, x.u.id, i)}</td><td>${cell(x.a.buy)}</td><td>${cell(x.a.sell)}</td>${P.overrideMode === 'hold' ? `<td class="nowrap ${x.held ? 'gold' : 'dim'}">${x.held ? money(x.held).replace('đ', ' PS') : '0 PS'}</td>` : ''}<td>${x.a.ok ? `<span class="badge pending">Sắp hết hạn</span>` : '<span class="badge failed">Chưa đủ</span>'}</td></tr>`).join('') : empty(P.overrideMode === 'hold' ? 5 : 4, 'Mọi đại lý đều đang đủ điều kiện.')}
      </tbody></table></div><p class="tc-note mt-1">Danh sách gồm đại lý chưa đủ điều kiện và đại lý còn dưới 7 ngày. Đổi điều kiện ở Thiết lập hệ thống.</p></div>`;
  }
  M.commissions = { render(el) {
    const d = ADB.load(), C = (d.commissions || []).slice().sort((a, b) => b.date.localeCompare(a.date)), CS = ADB.commissionStatus;
    const by = s => C.filter(c => c.status === s), sm = a => a.reduce((s, c) => s + c.amount, 0);
    const paid = C.filter(c => c.status === 'paid' && kindOf(c) !== 'missed');
    const pk = k => sm(paid.filter(c => kindOf(c) === k));
    el.innerHTML = `${viewOnly()}<div class="grid g-5">
        ${stat('Đã trả', sh(sm(paid)), 'wallet', 'green', 'glow-gold', `${paid.length} khoản`)}
        ${stat('Thưởng giới thiệu', sh(pk('ref')), 'gift', 'gold', 'glow-cyan', 'vào ví hoa hồng bán hàng')}
        ${stat('Hoa hồng bán hàng', sh(pk('direct')), 'award', 'cyan', 'glow-gold', 'vào ví hoa hồng bán hàng')}
        ${stat('Thu nhập từ đại lý', sh(pk('override')), 'users', 'violet', 'glow-cyan', 'vào ví điểm thưởng và ví mua hàng')}
        ${stat('Bỏ lỡ', `<span class="dim">${sh(sm(by('missed')))}</span>`, 'close', 'red', 'glow-gold', 'không cộng vào ví, không tính chi')}
      </div>
      ${agentAct(d)}
      <div class="card glow-mix mt-2">${head('Lịch sử hoa hồng', '<span id="tcCn"></span>', (can() && by('pending').length ? `<button class="btn btn-sm btn-gold" type="button" id="tcCall">${icon('check')} Duyệt tất cả đang chờ</button>` : '') + csvBtn('tcCCsv'))}
        <div class="toolbar"><input class="input" id="tcCq" placeholder="Tìm người nhận, mã đơn" aria-label="Tìm">
          <select class="input" id="tcCk" aria-label="Loại hoa hồng"><option value="">Mọi loại</option>${Object.entries(ADB.commissionKind).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
          <select class="input" id="tcCs" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(CS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Người nhận</th><th>Từ đơn</th><th>Loại</th><th>Tính trên</th><th>Số tiền</th><th>Trạng thái</th>${can() ? '<th></th>' : ''}</tr></thead><tbody id="tcCt"></tbody></table></div>
        <p class="tc-note mt-1">Hoa hồng bỏ lỡ là phần người giới thiệu chưa nhận được vì chưa kích hoạt cộng tác viên hoặc chưa lên đại lý. Chỉ để tham khảo, không cộng vào ví.</p></div>`;
    const filt = () => { const q = $('#tcCq', el).value.trim().toLowerCase(), s = $('#tcCs', el).value, k = $('#tcCk', el).value;
      return C.filter(c => (!s || c.status === s) && (!k || kindOf(c) === k) && (!q || match(d, c.user, q) || String(c.order).toLowerCase().includes(q))); };
    const list = () => { const L = filt(), real = L.filter(c => kindOf(c) !== 'missed' && c.status !== 'missed'), miss = L.filter(c => kindOf(c) === 'missed' || c.status === 'missed');
      $('#tcCn', el).textContent = `${L.length} khoản · đã trả ${money(sm(real.filter(c => c.status === 'paid')))}${miss.length ? ' · bỏ lỡ ' + money(sm(miss)) : ''}`;
      $('#tcCt', el).innerHTML = L.length ? L.slice(0, 300).map((c, i) => { const m = kindOf(c) === 'missed' || c.status === 'missed', k = kindOf(c);
        return `<tr${m ? ' style="opacity:.62"' : ''}><td class="dim nowrap">${fdate(c.date)}</td><td>${who(d, c.user, i)}</td><td><b>#${esc(c.order)}</b><br><small class="dim">${esc(uname(d, c.from))}</small></td>
        <td><span class="badge ${KC[k] || 'violet'} nowrap">${esc(kindName(c))}${c.rate ? ' · ' + c.rate + '%' : ''}</span>${m && c.note ? `<br><small class="dim">${esc(c.note)}</small>` : ''}</td>
        <td class="nowrap dim">${c.base ? money(c.base) : ''}</td>
        <td class="nowrap">${m ? `<s class="dim">${money(c.amount)}</s>` : `<b class="gold">${money(c.amount)}</b>`}</td><td>${m ? '<span class="badge failed">Bỏ lỡ</span>' : cBadge(c.status)}</td>
        ${can() ? `<td><div class="tc-act">${c.status === 'pending' ? `<button class="btn btn-sm" type="button" data-a="approve" data-id="${c.id}">Duyệt</button>` : ''}${!m && (c.status === 'pending' || c.status === 'approved') ? `<button class="btn btn-sm btn-gold" type="button" data-a="pay" data-id="${c.id}">Trả</button><button class="btn btn-sm btn-ghost" type="button" data-a="cancel" data-id="${c.id}">Hủy</button>` : ''}</div></td>` : ''}</tr>`; }).join('') : empty(8, 'Không có hoa hồng phù hợp.'); };
    list(); $$('.toolbar .input', el).forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', list));
    $('#tcCCsv', el).addEventListener('click', () => ADB.csv('lich-su-hoa-hong', [['Ngày', 'Mã TV', 'Người nhận', 'Đơn', 'Nguồn', 'Loại', 'Tỉ lệ %', 'Tính trên', 'Số tiền', 'Trạng thái'], ...filt().map(c => [c.date, (user(d, c.user) || {}).code, uname(d, c.user), c.order, uname(d, c.from), kindName(c), c.rate, c.base || '', c.amount, (CS[c.status] || [c.status])[0]])]));
    if (!can()) return;
    $('#tcCt', el).addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return;
      const dd = ADB.load(), c = dd.commissions.find(x => x.id === b.dataset.id), a = b.dataset.a; if (!c || c.status === 'paid' || c.status === 'missed') return;
      if (a === 'cancel' && !confirm('Hủy khoản hoa hồng này?')) return;
      if (a === 'approve') c.status = 'approved';
      if (a === 'pay') ADB.payCommission(dd, c);
      if (a === 'cancel') c.status = 'cancel';
      const label = { approve: 'Duyệt hoa hồng', pay: 'Trả hoa hồng', cancel: 'Hủy hoa hồng' }[a];
      commit(dd, label, `${uname(dd, c.user)}: ${money(c.amount)} ${kindName(c).toLowerCase()} (đơn ${c.order})`, a === 'pay' ? 'Đã trả hoa hồng vào ví ' + uname(dd, c.user) : label + ': ' + money(c.amount)); M.commissions.render(el); });
    const all = $('#tcCall', el); if (all) all.addEventListener('click', () => { const dd = ADB.load(), P = dd.commissions.filter(c => c.status === 'pending');
      if (!confirm(`Duyệt ${P.length} khoản hoa hồng đang chờ (${money(sm(P))})?`)) return;
      P.forEach(c => c.status = 'approved'); commit(dd, 'Duyệt hoa hồng hàng loạt', `${P.length} khoản, ${money(sm(P))}`, `Đã duyệt ${P.length} khoản hoa hồng`); M.commissions.render(el); });
  } };

  /* ---------- Lịch sử nạp tiền ---------- */
  M.topups = { render(el) {
    const d = ADB.load(), T = (d.topups || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const by = s => T.filter(t => t.status === s), sm = a => a.reduce((s, t) => s + t.amount, 0);
    el.innerHTML = `${viewOnly()}<div class="grid g-3 keep-2">${stat('Chờ duyệt', sh(sm(by('pending'))), 'clock', 'gold', 'glow-gold', by('pending').length + ' yêu cầu')}${stat('Đã nạp', sh(sm(by('done'))), 'check', 'green', 'glow-cyan', by('done').length + ' lần')}${stat('Từ chối', sh(sm(by('rejected'))), 'close', 'red', 'glow-gold', by('rejected').length + ' lần')}</div>
      <div class="card glow-cyan mt-2">${head('Lịch sử nạp tiền', '<span id="tcNn"></span>', csvBtn('tcNCsv'))}
        <div class="toolbar"><input class="input" id="tcNq" placeholder="Tìm thành viên" aria-label="Tìm thành viên"><select class="input" id="tcNs" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(WST).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Thành viên</th><th>Số tiền</th><th>Vào ví</th><th>Hình thức</th><th>Trạng thái</th>${can() ? '<th></th>' : ''}</tr></thead><tbody id="tcNl"></tbody></table></div></div>`;
    const filt = () => { const q = $('#tcNq', el).value.trim().toLowerCase(), s = $('#tcNs', el).value; return T.filter(t => (!s || t.status === s) && match(d, t.user, q)); };
    const list = () => { const L = filt(); $('#tcNn', el).textContent = `${L.length} yêu cầu · ${money(sm(L))}`;
      $('#tcNl', el).innerHTML = L.length ? L.map((t, i) => `<tr><td class="dim nowrap">${fdate(t.date)}</td><td>${who(d, t.user, i)}</td><td class="gold nowrap"><b>${money(t.amount)}</b></td><td class="nowrap">${wTag(t.wallet || 'shop')}</td><td>${esc(t.method || '')}${t.auto ? '<br><small class="green">Tự động xác nhận</small>' : ''}${t.note ? `<br><small class="dim">${esc(t.note)}</small>` : ''}</td><td>${wBadge(t.status)}</td>${can() ? `<td>${t.status === 'pending' ? `<div class="tc-act"><button class="btn btn-sm btn-gold" type="button" data-ok="${t.id}">Duyệt</button><button class="btn btn-sm btn-ghost" type="button" data-no="${t.id}">Từ chối</button></div>` : ''}</td>` : ''}</tr>`).join('') : empty(7, 'Không có yêu cầu phù hợp.'); };
    list(); $('#tcNq', el).addEventListener('input', list); $('#tcNs', el).addEventListener('change', list);
    $('#tcNCsv', el).addEventListener('click', () => ADB.csv('lich-su-nap-tien', [['Ngày', 'Mã TV', 'Thành viên', 'Số tiền', 'Vào ví', 'Hình thức', 'Trạng thái', 'Ghi chú'], ...filt().map(t => [t.date, (user(d, t.user) || {}).code, uname(d, t.user), t.amount, (ADB.WALLETS[t.wallet || 'shop'] || {}).name, t.method, (WST[t.status] || [t.status])[0], t.note])]));
    if (!can()) return;
    $('#tcNl', el).addEventListener('click', e => { const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'); if (!ok && !no) return;
      const dd = ADB.load(), t = dd.topups.find(x => x.id === (ok || no).dataset[ok ? 'ok' : 'no']); if (!t || t.status !== 'pending') return;
      if (no && !confirm('Từ chối yêu cầu nạp tiền này?')) return;
      t.status = ok ? 'done' : 'rejected';
      const tw = t.wallet || 'cash'; if (ok) ADB.credit(dd, t.user, tw, 'topup', t.amount, 'Nạp tiền qua ' + (t.method || ''), t.id);
      commit(dd, ok ? 'Duyệt nạp tiền' : 'Từ chối nạp tiền', `${uname(dd, t.user)}: ${money(t.amount)}`, ok ? `Đã cộng ${money(t.amount)} vào ${ADB.WALLETS[tw].name.toLowerCase()} của ${uname(dd, t.user)}` : 'Đã từ chối yêu cầu nạp tiền'); M.topups.render(el); });
  } };
})();
