/* Quản trị: Quỹ điểm kế toán.
   Chủ sở hữu tạo điểm vào Quỹ phát hành rồi chuyển cho Quỹ kế toán. Mọi khoản cộng vào ví thành viên
   trừ từ Quỹ kế toán. Sổ chỉ ghi thêm, không sửa, không xóa. Số liệu tính ở ADB.fund (js/psq-data.js). */
(function () {
  const { $, esc, money, icon, toast, modal, fdate, short } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  if (!document.getElementById('adm-css-quy-diem')) document.head.insertAdjacentHTML('beforeend', `<style id="adm-css-quy-diem">
    .qd-checks { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .qd-checks li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(0,0,0,.18); font-size: 13.5px; }
    .qd-checks li > i { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 12px; }
    .qd-checks li.red > i { background: rgba(255,107,107,.16); color: #ff6b6b; } .qd-checks li.gold > i { background: rgba(243,199,107,.16); color: var(--gold); } .qd-checks li.ok > i { background: rgba(69,224,143,.16); color: #45e08f; }
    .qd-checks small { display: block; color: var(--text-3); font-size: 12.5px; margin-top: 2px; }
    .qd-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: stretch; }
    .qd-node { padding: 14px; border-radius: 14px; border: 1px solid var(--line-2); background: rgba(0,0,0,.2); display: grid; gap: 4px; min-width: 0; }
    .qd-node b { font-size: clamp(16px, 1.5vw, 21px); overflow-wrap: anywhere; } .qd-node span { font-size: 13px; } .qd-node small { color: var(--text-3); font-size: 12px; line-height: 1.45; }
    .qd-arrow { display: grid; place-items: center; color: var(--gold); } .qd-arrow svg { width: 20px; height: 20px; }
    .qd-out { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .qd-eq { font-size: 12.5px; color: var(--text-3); margin-top: 10px; line-height: 1.6; }
    .qd-acts { display: flex; flex-wrap: wrap; gap: 8px; }
    @media (max-width: 760px) { .qd-flow { grid-template-columns: 1fr; } .qd-arrow { transform: rotate(90deg); } .qd-out { grid-template-columns: 1fr 1fr; } }
  </style>`);
  const can = () => window.ADMIN ? ADMIN.can('finance') : false;
  const me = d => { const u = PSQ.auth.user(); return u ? ADB.user(d, u.id) : null; };
  const uname = (d, id) => (ADB.user(d, id) || {}).name || '';
  const sg = n => `<b class="nowrap ${n < 0 ? 'red' : 'green'}">${n > 0 ? '+' : ''}${money(n)}</b>`;
  const ACT = {
    mint: ['Tạo điểm mới', 'Điểm mới vào Quỹ phát hành. Chỉ chủ sở hữu làm được.'],
    give: ['Chuyển cho quỹ kế toán', 'Từ Quỹ phát hành sang Quỹ kế toán để trả thưởng, hoa hồng, nạp tiền, quà.'],
    back: ['Thu hồi về quỹ phát hành', 'Từ Quỹ kế toán trả lại Quỹ phát hành.'],
    burn: ['Hủy điểm', 'Hủy bớt điểm chưa dùng trong Quỹ phát hành.']
  };
  const KIND = { book: 'Cấp, thu hồi quỹ', commission: 'Hoa hồng bán hàng', referral: 'Thưởng giới thiệu CTV', override: 'Thu nhập từ đại lý tuyến dưới', package: 'Điểm gói kích hoạt', topup: 'Nạp tiền', bonus: 'Thưởng', adjust: 'Điều chỉnh tay', prize: 'Quà vòng quay' };
  let flt = { k: '', q: '' }, lim = 100;

  function render(el) {
    const d = ADB.load(), r = ADB.fund(d), owner = ADB.isOwner(me(d)), W = ADB.WALLETS;
    const node = (t, v, sub, c) => `<div class="qd-node"><span>${t}</span><b style="color:${c}">${money(v)}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const arrow = `<div class="qd-arrow">${icon('arrow')}</div>`;
    el.innerHTML = `
      <div class="card ${r.ok ? 'glow-cyan' : 'glow-gold'}"><div class="card-head"><div><h3>Kiểm tra cân đối</h3><div class="sub">Tự kiểm mỗi lần mở trang</div></div></div>
        <ul class="qd-checks">${r.checks.length ? r.checks.map(c => `<li class="${c.lv}"><i>${c.lv === 'red' ? '!' : '!'}</i><div><b>${esc(c.t)}</b>${c.x ? `<small>${esc(c.x)}</small>` : ''}</div></li>`).join('')
          : `<li class="ok"><i>✓</i><div><b>Cân đối đúng, không có cảnh báo</b><small>Tổng điểm phát hành bằng tổng các quỹ, ví thành viên và phần đã rời ví. Mọi khoản cộng vào ví đều có nguồn từ quỹ kế toán.</small></div></li>`}</ul></div>

      <div class="card glow-gold mt-2"><div class="card-head" style="flex-wrap:wrap"><div><h3>Luồng điểm</h3><div class="sub">1 PS = 1đ · tiền và điểm trong ví thành viên đều đi qua quỹ kế toán</div></div>
        <div class="qd-acts" style="margin-left:auto">${owner ? Object.keys(ACT).map(k => `<button class="btn btn-sm ${k === 'mint' || k === 'give' ? 'btn-gold' : 'btn-ghost'}" type="button" data-qa="${k}">${ACT[k][0]}</button>`).join('') : `<span class="dim" style="font-size:12.5px">${icon('lock')} Chỉ chủ sở hữu được tạo điểm và chuyển quỹ</span>`}</div></div>
        <div class="qd-flow">${node('Quỹ phát hành', r.ph, `Đã phát hành tổng ${money(r.issued)}. Chủ sở hữu giữ.`, '#b98cff')}${arrow}${node('Quỹ kế toán', r.kt, `Trả hoa hồng, thưởng, điểm gói, nạp tiền, quà. Mức cảnh báo ${money(r.warnAt)}.`, r.kt < 0 ? '#ff6b6b' : r.kt < r.warnAt ? '#f3c76b' : '#4fe6df')}${arrow}${node('Ví thành viên', r.members, `Tổng 5 ví của mọi thành viên`, '#f3c76b')}</div>
        <div class="qd-out mt-2">${node('Thuế thu nhập giữ lại', r.thue, 'Khi rút hoa hồng, chuyển điểm thưởng', '#ff9f6b')}${node('Doanh thu đơn trả bằng ví', r.dtv, 'Đã trừ hoàn tiền đơn hủy', '#45e08f')}${node('Đã chi về ngân hàng', r.paid, 'Lệnh rút đã duyệt', '#9aa7ab')}${node('Đang chờ rút', r.held, 'Đã giữ trong ví, chờ duyệt', '#9aa7ab')}</div>
        <p class="qd-eq">Cân đối: Đã phát hành ${money(r.issued)} = Quỹ phát hành ${money(r.ph)} + Quỹ kế toán ${money(r.kt)} + Ví thành viên ${money(r.members)} + Thuế ${money(r.thue)} + Doanh thu ví ${money(r.dtv)} + Đã chi ${money(r.paid)} + Chờ rút ${money(r.held)}. Chênh lệch: <b class="${r.diff ? 'red' : 'green'}">${money(r.diff)}</b>.</p>
        ${owner ? `<form class="row wrap mt-1" id="qdWarn" style="gap:8px;align-items:center"><label for="qdW" class="dim" style="font-size:12.5px">Cảnh báo khi quỹ kế toán dưới</label><input class="input" id="qdW" type="number" min="0" step="1000000" value="${r.warnAt}" style="max-width:170px;height:38px"><button class="btn btn-sm" type="submit">Lưu</button></form>` : ''}
      </div>

      <div class="card glow-cyan mt-2"><div class="card-head" style="flex-wrap:wrap"><div><h3>Sổ quỹ kế toán</h3><div class="sub" id="qdN"></div></div><div class="row wrap" style="margin-left:auto;gap:8px"><button class="btn btn-sm btn-outline-gold" type="button" id="qdCsv">${icon('download')} Tải Excel (CSV)</button></div></div>
        <div class="toolbar"><input class="input" id="qdQ" placeholder="Tìm thành viên, nội dung" aria-label="Tìm" value="${esc(flt.q)}"><select class="input" id="qdK" aria-label="Loại">${[['', 'Mọi loại'], ...Object.entries(KIND)].map(([k, l]) => `<option value="${k}"${flt.k === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="table-wrap"><table class="tbl" style="min-width:860px"><thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Thành viên / người làm</th><th>Ví nhận</th><th>Thu, chi quỹ</th><th>Số dư quỹ sau</th></tr></thead><tbody id="qdL"></tbody></table></div>
        <div class="row mt-1" style="justify-content:center"><button class="btn btn-sm btn-ghost" type="button" id="qdMore" hidden>Xem thêm</button></div></div>

      <div class="card glow-gold mt-2"><div class="card-head"><div><h3>Sổ phát hành và chuyển quỹ</h3><div class="sub">${r.book.length} lần ghi · chỉ ghi thêm, không sửa, không xóa</div></div></div>
        <div class="table-wrap"><table class="tbl" style="min-width:720px"><thead><tr><th>Ngày</th><th>Thao tác</th><th>Số điểm</th><th>Lý do</th><th>Người làm</th></tr></thead><tbody>
        ${r.book.slice().reverse().map(b => `<tr><td class="dim nowrap">${fdate(b.date)}${b.time ? `<br><small>${esc(b.time)}</small>` : ''}</td><td class="nowrap">${!b.from ? 'Tạo điểm vào Quỹ phát hành' : !b.to ? 'Hủy điểm ở Quỹ phát hành' : `${ADB.FUND_ACC[b.from]} sang ${ADB.FUND_ACC[b.to]}`}</td><td class="nowrap gold"><b>${money(b.amount)}</b></td><td class="dim" style="min-width:220px">${esc(b.note || '')}</td><td class="nowrap">${esc(b.actor || '')}</td></tr>`).join('')}
        </tbody></table></div></div>`;

    const rows = () => { const q = flt.q.trim().toLowerCase(); return r.rows.filter(x => (!flt.k || x.kind === flt.k) && (!q || [x.note, x.who, uname(d, x.user)].join(' ').toLowerCase().includes(q))).slice().reverse(); };
    const list = () => {
      const L = rows(); $('#qdN', el).textContent = `${L.length} dòng · quỹ hiện còn ${money(r.kt)}`;
      $('#qdL', el).innerHTML = L.length ? L.slice(0, lim).map(x => `<tr><td class="dim nowrap">${fdate(x.date)}</td><td class="nowrap">${esc(KIND[x.kind] || x.kind)}</td><td class="dim" style="min-width:220px">${esc(x.note || '')}</td><td class="nowrap">${x.user ? `<b>${esc(uname(d, x.user))}</b>` : esc(x.who || '')}</td><td class="nowrap">${x.wallet && W[x.wallet] ? `<span style="color:${W[x.wallet].color}">${esc(W[x.wallet].short)}</span>` : '<span class="dim">-</span>'}</td><td>${sg(x.amount)}</td><td class="nowrap ${x.bal < 0 ? 'red' : ''}">${money(x.bal)}</td></tr>`).join('')
        : `<tr><td colspan="7"><div class="empty">Không có dòng nào.</div></td></tr>`;
      $('#qdMore', el).hidden = L.length <= lim;
    };
    list();
    $('#qdQ', el).addEventListener('input', e => { flt.q = e.target.value; lim = 100; list(); });
    $('#qdK', el).addEventListener('change', e => { flt.k = e.target.value; lim = 100; list(); });
    $('#qdMore', el).addEventListener('click', () => { lim += 200; list(); });
    $('#qdCsv', el).addEventListener('click', () => ADB.csv('so-quy-ke-toan', [['Ngày', 'Loại', 'Nội dung', 'Thành viên / người làm', 'Ví nhận', 'Thu, chi quỹ', 'Số dư quỹ sau'], ...rows().map(x => [x.date, KIND[x.kind] || x.kind, x.note || '', x.user ? uname(d, x.user) : x.who || '', x.wallet && W[x.wallet] ? W[x.wallet].name : '', x.amount, x.bal])]));
    el.querySelectorAll('[data-qa]').forEach(b => b.addEventListener('click', () => action(el, b.dataset.qa)));
    const wf = $('#qdWarn', el);
    if (wf) wf.addEventListener('submit', e => { e.preventDefault(); const v = Math.max(0, Math.round(+$('#qdW', el).value || 0)), dd = ADB.load(); dd.settings.fundWarn = v; ADB.log(dd, 'Đổi mức cảnh báo quỹ kế toán', money(v)); ADB.save(dd); toast('Đã lưu mức cảnh báo ' + money(v)); render(el); });
  }

  function action(el, kind) {
    const d = ADB.load(), r = ADB.fund(d), [t, sub] = ACT[kind];
    const md = modal(`<form id="qaF" novalidate><div class="card-head"><div><h3>${t}</h3><div class="sub">${sub}</div></div><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div class="row between" style="gap:10px;font-size:13.5px"><span class="dim">Quỹ phát hành</span><b>${money(r.ph)}</b></div><div class="row between mt-1" style="gap:10px;font-size:13.5px"><span class="dim">Quỹ kế toán</span><b>${money(r.kt)}</b></div>
      <div class="field mt-2"><label for="qaA">Số điểm</label><input class="input" id="qaA" type="number" min="1" step="1000000" inputmode="numeric"><small class="dim" id="qaS"></small></div>
      <div class="field mt-2"><label for="qaN">Lý do (ghi vào sổ)</label><input class="input" id="qaN" maxlength="120" placeholder="Ví dụ: Cấp quỹ trả thưởng tháng 11"></div>
      <div class="field mt-2"><label for="qaP">Nhập lại mật khẩu của anh để xác nhận</label><input class="input" id="qaP" type="password" autocomplete="current-password"></div>
      <p class="red mt-1" id="qaE" style="font-size:13px;min-height:18px"></p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">${icon('check')} Xác nhận</button></div></form>`);
    const A = $('#qaA', md.el);
    A.addEventListener('input', () => { const a = Math.round(+A.value || 0); $('#qaS', md.el).textContent = a ? 'Bằng chữ số: ' + money(a) + (a >= 1e9 ? ' (khoản rất lớn, anh kiểm tra lại)' : '') : ''; });
    $('#qaF', md.el).addEventListener('submit', e => {
      e.preventDefault(); const dd = ADB.load(), a = Math.round(+A.value || 0), note = $('#qaN', md.el).value;
      const res = ADB.fundAction(dd, PSQ.auth.user(), kind, a, note, $('#qaP', md.el).value);
      if (res.error) return $('#qaE', md.el).textContent = res.error;
      ADB.log(dd, t, `${money(a)}: ${note.trim()}`); ADB.save(dd); toast(t + ': ' + money(a)); md.close(); render(el);
    });
    setTimeout(() => A.focus(), 60);
  }

  ADMIN_MODULES.fund = { render };
  void short; void can;
})();
