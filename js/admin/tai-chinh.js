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
    const com = (d.commissions || []).filter(c => (c.status === 'approved' || c.status === 'paid') && inR(c));
    const sum = (a, f = x => x.total) => a.reduce((s, x) => s + (f(x) || 0), 0);
    const rev = sum(orders), cogs = sum(rec), ex = sum(exp, x => x.amount), cm = sum(com, x => x.amount), profit = rev - cogs - ex - cm;
    el.innerHTML = `<div class="row between wrap" style="gap:10px;margin-bottom:14px"><div class="chips" id="tcPer">${[['30', '30 ngày'], ['90', '90 ngày'], ['year', 'Năm nay']].map(([k, l]) => `<button class="chip${k === period ? ' on' : ''}" type="button" data-p="${k}">${l}</button>`).join('')}</div><span class="tc-note">Từ ${fdate(from)} đến ${fdate(to)} (số liệu ước tính, chạy thử)</span></div>
      <div class="grid g-5">
        ${stat('Doanh thu', sh(rev), 'wallet', 'gold', 'glow-gold', orders.length + ' đơn không hủy')}
        ${stat('Giá vốn nhập kho', sh(cogs), 'truck', 'cyan', 'glow-cyan', rec.length + ' phiếu nhập')}
        ${stat('Chi phí', sh(ex), 'card', 'red', 'glow-gold', exp.length + ' khoản chi')}
        ${stat('Hoa hồng', sh(cm), 'award', 'violet', 'glow-cyan', 'đã duyệt và đã trả')}
        ${stat('Lợi nhuận ước tính', `<span class="${profit < 0 ? 'red' : 'green'}">${sh(profit)}</span>`, 'trend', 'green', 'glow-gold', rev ? 'Biên ' + Math.round(profit / rev * 100) + '%' : '')}
      </div>
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
  M.wallet = { render(el) {
    const d = ADB.load(), W = d.wallet || [], mem = d.users.filter(u => u.role !== 'admin');
    const done = W.filter(w => w.status === 'done'), tsum = t => done.filter(w => w.type === t).reduce((s, w) => s + w.amount, 0);
    const pend = W.filter(w => w.type === 'withdraw' && w.status === 'pending');
    const totalBal = mem.reduce((s, u) => s + ADB.balance(d, u.id), 0);
    el.innerHTML = `${viewOnly()}<div class="grid g-5">
        ${stat('Tổng số dư ví', sh(totalBal), 'wallet', 'gold', 'glow-gold', 'của ' + mem.length + ' thành viên')}
        ${stat('Nạp điểm vào', sh(tsum('topup')), 'plus', 'cyan', 'glow-cyan')}
        ${stat('Hoa hồng vào ví', sh(tsum('commission') + tsum('bonus')), 'award', 'violet', 'glow-gold', 'gồm thưởng')}
        ${stat('Đã rút và dùng điểm', sh(-(tsum('withdraw') + tsum('spend'))), 'arrow', 'red', 'glow-cyan')}
        ${stat('Đang chờ rút', sh(-pend.reduce((s, w) => s + w.amount, 0)), 'clock', 'gold', 'glow-gold', pend.length + ' yêu cầu')}
      </div>
      <div class="card glow-gold mt-2">${head('Yêu cầu rút tiền chờ duyệt', pend.length + ' yêu cầu', can() ? `<button class="btn btn-sm btn-gold" type="button" id="tcAdj">${icon('plus')} Điều chỉnh ví</button>` : '')}
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thành viên</th><th>Số tiền</th><th>Số dư hiện có</th><th>Ghi chú</th><th>Ngày</th><th></th></tr></thead><tbody>
        ${pend.length ? pend.map((w, i) => { const b = ADB.balance(d, w.user); return `<tr><td>${who(d, w.user, i)}</td><td>${amt(w.amount)}</td><td class="nowrap ${b + w.amount < 0 ? 'red' : ''}">${money(b)}</td><td class="dim">${esc(w.note || '')}</td><td class="dim nowrap">${fdate(w.date)}</td><td>${can() ? `<div class="tc-act"><button class="btn btn-sm btn-gold" type="button" data-ok="${w.id}">Duyệt</button><button class="btn btn-sm btn-ghost" type="button" data-no="${w.id}">Từ chối</button></div>` : wBadge(w.status)}</td></tr>`; }).join('') : empty(6, 'Không có yêu cầu rút tiền đang chờ.')}
        </tbody></table></div></div>
      <div class="card glow-cyan mt-2">${head('Số dư theo thành viên', 'chỉ tính giao dịch đã hoàn tất', csvBtn('tcWCsv'))}
        <div class="toolbar"><input class="input" id="tcWq" placeholder="Tìm tên, email, mã thành viên" aria-label="Tìm thành viên"></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thành viên</th><th>Số dư</th><th>Tổng vào</th><th>Tổng ra</th><th>Chờ rút</th><th>Giao dịch</th></tr></thead><tbody id="tcWl"></tbody></table></div></div>`;
    const rowsOf = q => mem.filter(u => match(d, u.id, q)).map(u => { const mine = W.filter(w => w.user === u.id), dn = mine.filter(w => w.status === 'done');
      return { u, bal: ADB.balance(d, u.id), inn: dn.filter(w => w.amount > 0).reduce((s, w) => s + w.amount, 0), out: -dn.filter(w => w.amount < 0).reduce((s, w) => s + w.amount, 0), pw: -mine.filter(w => w.type === 'withdraw' && w.status === 'pending').reduce((s, w) => s + w.amount, 0), n: mine.length }; })
      .filter(r => r.n).sort((a, b) => b.bal - a.bal);
    const list = () => { const rs = rowsOf($('#tcWq', el).value.trim().toLowerCase());
      $('#tcWl', el).innerHTML = rs.length ? rs.map((r, i) => `<tr><td>${who(d, r.u.id, i)}</td><td class="gold nowrap"><b>${money(r.bal)}</b></td><td class="nowrap tc-pos">${money(r.inn)}</td><td class="nowrap tc-neg">${money(r.out)}</td><td class="nowrap">${r.pw ? `<span class="badge pending">${money(r.pw)}</span>` : '<span class="dim">0đ</span>'}</td><td>${r.n}</td></tr>`).join('') : empty(6, 'Không có thành viên phù hợp.'); };
    list(); $('#tcWq', el).addEventListener('input', list);
    $('#tcWCsv', el).addEventListener('click', () => ADB.csv('doi-soat-vi', [['Mã', 'Thành viên', 'Email', 'Số dư', 'Tổng vào', 'Tổng ra', 'Chờ rút', 'Số giao dịch'], ...rowsOf('').map(r => [r.u.code, r.u.name, r.u.email, r.bal, r.inn, r.out, r.pw, r.n])]));
    el.querySelector('tbody').addEventListener('click', e => {
      const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'); if (!ok && !no || !can()) return;
      const dd = ADB.load(), w = dd.wallet.find(x => x.id === (ok || no).dataset[ok ? 'ok' : 'no']); if (!w) return;
      if (ok && ADB.balance(dd, w.user) + w.amount < 0 && !confirm('Số dư hiện có không đủ cho yêu cầu này. Vẫn duyệt?')) return;
      w.status = ok ? 'done' : 'rejected'; w.done = today();
      commit(dd, ok ? 'Duyệt rút tiền' : 'Từ chối rút tiền', `${uname(dd, w.user)}: ${money(-w.amount)}`, ok ? 'Đã duyệt yêu cầu rút ' + money(-w.amount) : 'Đã từ chối yêu cầu rút tiền'); M.wallet.render(el);
    });
    if (can()) $('#tcAdj', el).addEventListener('click', () => {
      const md = modal(`<form id="tcAf"><div class="card-head"><h3>Điều chỉnh ví thành viên</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
        <div class="form-grid"><div class="field full"><label>Thành viên</label><select class="input" name="user" required>${mem.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.code || '')}) · ${money(ADB.balance(d, u.id))}</option>`).join('')}</select></div>
        <div class="field"><label>Loại</label><select class="input" name="type"><option value="adjust">Điều chỉnh</option><option value="bonus">Thưởng</option></select></div>
        <div class="field"><label>Số tiền (âm để trừ)</label><input class="input" name="amount" type="number" step="1000" required placeholder="vd 200000 hoặc -50000"></div>
        <div class="field full"><label>Ghi chú</label><input class="input" name="note" required placeholder="Lý do điều chỉnh"></div></div>
        <p class="red mt-1" id="tcAe" style="font-size:13px;min-height:18px"></p>
        <div class="row mt-2" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu</button></div></form>`);
      $('#tcAf', md.el).addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), a = Math.round(+f.amount);
        if (!a) return $('#tcAe', md.el).textContent = 'Anh chị nhập số tiền khác 0.';
        const dd = ADB.load(); dd.wallet.push({ id: ADB.uid('gd'), user: f.user, type: f.type, amount: a, ref: '', date: today(), note: f.note.trim(), status: 'done' });
        commit(dd, 'Điều chỉnh ví', `${uname(dd, f.user)}: ${a > 0 ? '+' : ''}${money(a)} (${f.note.trim()})`, 'Đã điều chỉnh ví ' + uname(dd, f.user)); md.close(); M.wallet.render(el); });
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
        <select class="input" id="tcTt" aria-label="Loại giao dịch"><option value="">Tất cả loại</option>${Object.entries(ADB.walletType).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select class="input" id="tcTs" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(WST).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
        <input class="input tc-date" id="tcTf" type="date" aria-label="Từ ngày"><input class="input tc-date" id="tcTe" type="date" aria-label="Đến ngày"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Thành viên</th><th>Loại</th><th>Nội dung</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody id="tcTl"></tbody></table></div></div>`;
    const filt = () => { const q = $('#tcTq', el).value.trim().toLowerCase(), t = $('#tcTt', el).value, s = $('#tcTs', el).value, f = $('#tcTf', el).value, e = $('#tcTe', el).value;
      return W.filter(w => (!t || w.type === t) && (!s || w.status === s) && (!f || w.date >= f) && (!e || w.date.slice(0, 10) <= e) && match(d, w.user, q)); };
    const list = () => { const L = filt(); $('#tcTn', el).textContent = `${L.length} giao dịch · tổng ${money(L.filter(w => w.status === 'done').reduce((s, w) => s + w.amount, 0))} (đã hoàn tất)`;
      $('#tcTl', el).innerHTML = L.length ? L.slice(0, 300).map((w, i) => `<tr><td class="dim nowrap">${fdate(w.date)}</td><td>${who(d, w.user, i)}</td><td><span class="badge ${w.amount < 0 ? 'violet' : 'ship'}">${ADB.walletType[w.type] || w.type}</span></td><td class="dim" style="min-width:180px">${esc(w.note || '')}</td><td>${amt(w.amount)}</td><td>${wBadge(w.status)}</td></tr>`).join('') : empty(6, 'Không có giao dịch phù hợp.'); };
    list(); $$('.toolbar .input', el).forEach(i => i.addEventListener(i.tagName === 'SELECT' || i.type === 'date' ? 'change' : 'input', list));
    $('#tcTCsv', el).addEventListener('click', () => ADB.csv('lich-su-giao-dich', [['Ngày', 'Mã TV', 'Thành viên', 'Loại', 'Nội dung', 'Số tiền', 'Trạng thái'], ...filt().map(w => [w.date, (user(d, w.user) || {}).code, uname(d, w.user), ADB.walletType[w.type] || w.type, w.note, w.amount, (WST[w.status] || [w.status])[0]])]));
  } };

  /* ---------- Lịch sử hoa hồng ---------- */
  M.commissions = { render(el) {
    const d = ADB.load(), C = (d.commissions || []).slice().sort((a, b) => b.date.localeCompare(a.date)), CS = ADB.commissionStatus;
    const by = s => C.filter(c => c.status === s), sm = a => a.reduce((s, c) => s + c.amount, 0);
    const levels = [...new Set(C.map(c => c.level))].sort();
    el.innerHTML = `${viewOnly()}<div class="grid g-4 keep-2">${Object.entries(CS).map(([k, v], i) => stat(v[0], sh(sm(by(k))), ['clock', 'check', 'wallet', 'close'][i], ['gold', 'cyan', 'green', 'red'][i], i % 2 ? 'glow-cyan' : 'glow-gold', by(k).length + ' khoản')).join('')}</div>
      <div class="card glow-mix mt-2">${head('Lịch sử hoa hồng', '<span id="tcCn"></span>', (can() && by('pending').length ? `<button class="btn btn-sm btn-gold" type="button" id="tcCall">${icon('check')} Duyệt tất cả đang chờ</button>` : '') + csvBtn('tcCCsv'))}
        <div class="toolbar"><input class="input" id="tcCq" placeholder="Tìm người nhận, mã đơn" aria-label="Tìm">
          <select class="input" id="tcCs" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(CS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
          <select class="input" id="tcCl" aria-label="Tầng"><option value="">Mọi tầng</option>${levels.map(l => `<option value="${l}">F${l}</option>`).join('')}</select></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Người nhận</th><th>Từ đơn</th><th>Tầng</th><th>Số tiền</th><th>Trạng thái</th>${can() ? '<th></th>' : ''}</tr></thead><tbody id="tcCt"></tbody></table></div></div>`;
    const filt = () => { const q = $('#tcCq', el).value.trim().toLowerCase(), s = $('#tcCs', el).value, l = $('#tcCl', el).value;
      return C.filter(c => (!s || c.status === s) && (!l || String(c.level) === l) && (!q || match(d, c.user, q) || String(c.order).toLowerCase().includes(q))); };
    const list = () => { const L = filt(); $('#tcCn', el).textContent = `${L.length} khoản · ${money(sm(L))}`;
      $('#tcCt', el).innerHTML = L.length ? L.slice(0, 300).map((c, i) => `<tr><td class="dim nowrap">${fdate(c.date)}</td><td>${who(d, c.user, i)}</td><td><b>#${esc(c.order)}</b><br><small class="dim">${esc(uname(d, c.from))}</small></td><td><span class="badge violet">F${c.level} · ${c.rate}%</span></td><td class="gold nowrap"><b>${money(c.amount)}</b></td><td>${cBadge(c.status)}</td>${can() ? `<td><div class="tc-act">${c.status === 'pending' ? `<button class="btn btn-sm btn-gold" type="button" data-a="approve" data-id="${c.id}">Duyệt</button>` : ''}${c.status === 'approved' ? `<button class="btn btn-sm btn-gold" type="button" data-a="pay" data-id="${c.id}">Trả</button>` : ''}${c.status === 'pending' || c.status === 'approved' ? `<button class="btn btn-sm btn-ghost" type="button" data-a="cancel" data-id="${c.id}">Hủy</button>` : ''}</div></td>` : ''}</tr>`).join('') : empty(7, 'Không có hoa hồng phù hợp.'); };
    list(); $$('.toolbar .input', el).forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', list));
    $('#tcCCsv', el).addEventListener('click', () => ADB.csv('lich-su-hoa-hong', [['Ngày', 'Mã TV', 'Người nhận', 'Đơn', 'Người mua', 'Tầng', 'Tỉ lệ %', 'Số tiền', 'Trạng thái'], ...filt().map(c => [c.date, (user(d, c.user) || {}).code, uname(d, c.user), c.order, uname(d, c.from), 'F' + c.level, c.rate, c.amount, CS[c.status][0]])]));
    if (!can()) return;
    $('#tcCt', el).addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return;
      const dd = ADB.load(), c = dd.commissions.find(x => x.id === b.dataset.id), a = b.dataset.a; if (!c) return;
      if (a === 'cancel' && !confirm('Hủy khoản hoa hồng này?')) return;
      if (a === 'approve') c.status = 'approved';
      if (a === 'pay') { c.status = 'paid'; dd.wallet.push({ id: ADB.uid('gd'), user: c.user, type: 'commission', amount: c.amount, ref: c.order, date: today(), note: `Hoa hồng F${c.level} từ đơn ${c.order}`, status: 'done' }); }
      if (a === 'cancel') c.status = 'cancel';
      const label = { approve: 'Duyệt hoa hồng', pay: 'Trả hoa hồng', cancel: 'Hủy hoa hồng' }[a];
      commit(dd, label, `${uname(dd, c.user)}: ${money(c.amount)} (đơn ${c.order})`, a === 'pay' ? 'Đã trả hoa hồng vào ví ' + uname(dd, c.user) : label + ': ' + money(c.amount)); M.commissions.render(el); });
    const all = $('#tcCall', el); if (all) all.addEventListener('click', () => { const dd = ADB.load(), P = dd.commissions.filter(c => c.status === 'pending');
      if (!confirm(`Duyệt ${P.length} khoản hoa hồng đang chờ (${money(sm(P))})?`)) return;
      P.forEach(c => c.status = 'approved'); commit(dd, 'Duyệt hoa hồng hàng loạt', `${P.length} khoản, ${money(sm(P))}`, `Đã duyệt ${P.length} khoản hoa hồng`); M.commissions.render(el); });
  } };

  /* ---------- Lịch sử nạp điểm ---------- */
  M.topups = { render(el) {
    const d = ADB.load(), T = (d.topups || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const by = s => T.filter(t => t.status === s), sm = a => a.reduce((s, t) => s + t.amount, 0);
    el.innerHTML = `${viewOnly()}<div class="grid g-3 keep-2">${stat('Chờ duyệt', sh(sm(by('pending'))), 'clock', 'gold', 'glow-gold', by('pending').length + ' yêu cầu')}${stat('Đã nạp', sh(sm(by('done'))), 'check', 'green', 'glow-cyan', by('done').length + ' lần')}${stat('Từ chối', sh(sm(by('rejected'))), 'close', 'red', 'glow-gold', by('rejected').length + ' lần')}</div>
      <div class="card glow-cyan mt-2">${head('Lịch sử nạp điểm', '<span id="tcNn"></span>', csvBtn('tcNCsv'))}
        <div class="toolbar"><input class="input" id="tcNq" placeholder="Tìm thành viên" aria-label="Tìm thành viên"><select class="input" id="tcNs" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(WST).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Thành viên</th><th>Số tiền</th><th>Điểm</th><th>Hình thức</th><th>Trạng thái</th>${can() ? '<th></th>' : ''}</tr></thead><tbody id="tcNl"></tbody></table></div></div>`;
    const filt = () => { const q = $('#tcNq', el).value.trim().toLowerCase(), s = $('#tcNs', el).value; return T.filter(t => (!s || t.status === s) && match(d, t.user, q)); };
    const list = () => { const L = filt(); $('#tcNn', el).textContent = `${L.length} yêu cầu · ${money(sm(L))}`;
      $('#tcNl', el).innerHTML = L.length ? L.map((t, i) => `<tr><td class="dim nowrap">${fdate(t.date)}</td><td>${who(d, t.user, i)}</td><td class="gold nowrap"><b>${money(t.amount)}</b></td><td class="cyan nowrap">${(t.points || t.amount).toLocaleString('vi-VN')}</td><td>${esc(t.method || '')}${t.note ? `<br><small class="dim">${esc(t.note)}</small>` : ''}</td><td>${wBadge(t.status)}</td>${can() ? `<td>${t.status === 'pending' ? `<div class="tc-act"><button class="btn btn-sm btn-gold" type="button" data-ok="${t.id}">Duyệt</button><button class="btn btn-sm btn-ghost" type="button" data-no="${t.id}">Từ chối</button></div>` : ''}</td>` : ''}</tr>`).join('') : empty(7, 'Không có yêu cầu phù hợp.'); };
    list(); $('#tcNq', el).addEventListener('input', list); $('#tcNs', el).addEventListener('change', list);
    $('#tcNCsv', el).addEventListener('click', () => ADB.csv('lich-su-nap-diem', [['Ngày', 'Mã TV', 'Thành viên', 'Số tiền', 'Điểm', 'Hình thức', 'Trạng thái', 'Ghi chú'], ...filt().map(t => [t.date, (user(d, t.user) || {}).code, uname(d, t.user), t.amount, t.points || t.amount, t.method, (WST[t.status] || [t.status])[0], t.note])]));
    if (!can()) return;
    $('#tcNl', el).addEventListener('click', e => { const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'); if (!ok && !no) return;
      const dd = ADB.load(), t = dd.topups.find(x => x.id === (ok || no).dataset[ok ? 'ok' : 'no']); if (!t || t.status !== 'pending') return;
      if (no && !confirm('Từ chối yêu cầu nạp điểm này?')) return;
      t.status = ok ? 'done' : 'rejected';
      if (ok) (dd.wallet = dd.wallet || []).push({ id: ADB.uid('gd'), user: t.user, type: 'topup', amount: t.amount, ref: t.id, date: today(), note: 'Nạp điểm qua ' + (t.method || ''), status: 'done' });
      commit(dd, ok ? 'Duyệt nạp điểm' : 'Từ chối nạp điểm', `${uname(dd, t.user)}: ${money(t.amount)}`, ok ? `Đã duyệt nạp ${money(t.amount)} cho ${uname(dd, t.user)}` : 'Đã từ chối yêu cầu nạp điểm'); M.topups.render(el); });
  } };
})();
