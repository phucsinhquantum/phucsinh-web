/* Quản trị: tài khoản phân phối điểm mua hàng (anh Tuân 12/11).
   Chủ sở hữu bật quyền cho tài khoản (ví dụ @phucsinh), đặt hạn mức mỗi lần, mỗi ngày, xem lịch sử và Hoàn lại.
   Quyền và hạn mức lưu ở máy chủ (cfg:give), không nằm trong dữ liệu chung. Máy chủ kiểm mọi lần chuyển. */
(function () {
  const { $, esc, icon, toast, modal } = PSQ;
  const ps = n => (Math.round(n) || 0).toLocaleString('vi-VN') + ' PS';
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const owner = () => ADB.isOwner(PSQ.auth.user());

  // hộp nhập mật khẩu dùng chung
  function askPass(title, sub, go) {
    const md = modal(`<form id="ppF" novalidate><div class="card-head"><div><h3>${title}</h3><div class="sub">${sub}</div></div><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div class="field mt-2"><label for="ppP">Nhập lại mật khẩu của anh để xác nhận</label><input class="input" id="ppP" type="password" autocomplete="current-password"></div>
      <p class="red mt-1" id="ppE" style="font-size:13px;min-height:18px"></p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">${icon('check')} Xác nhận</button></div></form>`);
    $('#ppF', md.el).addEventListener('submit', e => { e.preventDefault(); const r = go($('#ppP', md.el).value); if (r.error) return $('#ppE', md.el).textContent = r.error; md.close(); });
    setTimeout(() => $('#ppP', md.el).focus(), 60);
  }

  // bật / tắt quyền cho một thành viên (gọi từ ô Sửa thành viên)
  window.giveToggle = function (u, done) {
    const g = API.act('giveCfg'); if (g.error) return toast(g.error, 'err');
    const on = (g.users || []).some(x => x.id === u.id);
    askPass(on ? 'Tắt quyền chuyển điểm mua hàng' : 'Bật quyền chuyển điểm mua hàng',
      on ? `${esc(u.name)} sẽ không chuyển điểm mua hàng cho người khác được nữa.` : `${esc(u.name)} (@${esc(u.username || '')}) sẽ chuyển được điểm từ ví mua hàng của mình sang ví mua hàng của thành viên khác, tối đa ${ps(g.max)} mỗi lần, ${ps(g.day)} mỗi ngày.`,
      pass => { const r = API.act('giveSet', { id: u.id, on: !on, pass }); if (!r.error) { toast((on ? 'Đã tắt' : 'Đã bật') + ' quyền chuyển điểm mua hàng cho ' + u.name); if (done) done(); } return r; });
  };

  // chủ sở hữu: thu điểm của thành viên về công ty, hoặc chuyển ví điểm khả dụng / điểm thưởng sang ví mua hàng của chính họ
  const WN = { avail: 'Ví điểm khả dụng', bonus: 'Ví điểm thưởng', shop: 'Ví điểm mua hàng' };
  const OPN = { recall: 'Thu điểm về công ty', toshop: 'Chuyển sang ví mua hàng' };
  window.memberWallet = function (u, done) {
    if (!owner()) return toast('Chỉ chủ sở hữu dùng được mục này.', 'err');
    const txId = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const md = modal(`<form id="mwF" novalidate><div class="card-head"><div><h3>Điều chỉnh điểm: ${esc(u.name)}</h3><div class="sub">@${esc(u.username || '')} · ${esc(u.code || '')} · mỗi lần cần mật khẩu của anh, lưu lịch sử, thành viên thấy trong giao dịch của họ, bot báo Telegram</div></div><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div id="mwB" class="row" style="gap:8px;flex-wrap:wrap"></div>
      <div class="form-grid mt-2">
        <div class="field"><label for="mwO">Thao tác</label><select class="input" id="mwO"><option value="recall">${OPN.recall}</option><option value="toshop">${OPN.toshop}</option></select></div>
        <div class="field"><label for="mwW">Từ ví</label><select class="input" id="mwW"></select></div>
        <div class="field"><label for="mwA">Số điểm</label><input class="input" id="mwA" type="number" min="1" step="1000" inputmode="numeric"></div>
        <div class="field"><label for="mwN">Lý do (bắt buộc)</label><input class="input" id="mwN" maxlength="120" placeholder="Ví dụ: thu lại điểm cấp nhầm"></div>
        <div class="field full"><label for="mwP">Nhập lại mật khẩu của anh để xác nhận</label><input class="input" id="mwP" type="password" autocomplete="current-password"></div>
      </div>
      <p class="red mt-1" id="mwE" style="font-size:13px;min-height:18px"></p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Đóng</button><button class="btn btn-gold" type="submit">${icon('check')} Xác nhận</button></div>
      <h4 class="mt-2" style="font-size:14px">Lịch sử điều chỉnh của thành viên này</h4><div id="mwH"></div></form>`);
    const el = md.el, O = $('#mwO', el), Wsel = $('#mwW', el);
    let bal = {};
    const fillW = () => { const list = O.value === 'recall' ? ['avail', 'bonus', 'shop'] : ['avail', 'bonus']; const best = list.reduce((m, k) => (bal[k] || 0) > (bal[m] || 0) ? k : m, list[0]); Wsel.innerHTML = list.map(k => `<option value="${k}"${k === best ? ' selected' : ''}>${WN[k]} (${ps(bal[k] || 0)})</option>`).join(''); };
    const draw = () => {
      const r = API.act('memberWalletLog', { id: u.id }); if (r.error) return $('#mwE', el).textContent = r.error;
      bal = r.bal || {}; $('#mwB', el).innerHTML = Object.keys(WN).map(k => `<span class="badge">${WN[k]}: <b>${ps(bal[k] || 0)}</b></span>`).join(''); fillW();
      $('#mwH', el).innerHTML = (r.rows || []).length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Thao tác</th><th>Ví</th><th>Số điểm</th><th>Lý do</th><th>Người làm</th><th></th></tr></thead><tbody>${r.rows.map(h => `<tr${h.undone ? ' style="opacity:.55"' : ''}><td class="dim nowrap">${esc(PSQ.fdate(h.at))}</td><td class="nowrap">${OPN[h.op]}</td><td class="nowrap">${WN[h.wallet] || h.wallet}</td><td class="gold nowrap">${ps(h.amount)}</td><td style="min-width:160px;font-size:12.5px">${esc(String(h.note || '').replace(/^Công ty [^:]+: /, ''))}</td><td class="dim nowrap">${esc(h.by || '')}</td><td>${h.undone ? `<small class="dim">Đã hoàn lại ${esc(PSQ.fdate(h.undone))}</small>` : `<button class="btn btn-sm btn-ghost" type="button" data-undo="${esc(h.ref)}">Hoàn lại</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="dim" style="font-size:13px">Chưa có lần điều chỉnh nào.</p>';
      el.querySelectorAll('[data-undo]').forEach(b => b.addEventListener('click', () => {
        const pw = $('#mwP', el).value; if (!pw) { $('#mwE', el).textContent = 'Anh nhập mật khẩu ở ô trên rồi bấm Hoàn lại.'; return $('#mwP', el).focus(); }
        const x = API.act('memberWalletUndo', { ref: b.dataset.undo, pass: pw }); if (x.error) return $('#mwE', el).textContent = x.error;
        toast('Đã hoàn lại'); $('#mwE', el).textContent = ''; API.load(); draw(); if (done) done(true);
      }));
    };
    O.addEventListener('change', fillW); draw();
    $('#mwF', el).addEventListener('submit', e => {
      e.preventDefault(); const a = Math.round(+$('#mwA', el).value || 0);
      const r = API.act('memberWallet', { id: u.id, op: O.value, from: Wsel.value, amount: a, note: $('#mwN', el).value, pass: $('#mwP', el).value, tx: txId });
      if (r.error) return $('#mwE', el).textContent = r.error;
      toast(r.dup ? 'Lần này đã ghi rồi' : (O.value === 'recall' ? 'Đã thu ' : 'Đã chuyển ') + ps(a)); md.close(); API.load(); if (done) done(true);
    });
  };

  function adminLog() {
    const r = API.act('memberWalletLog', {}); if (r.error || !(r.rows || []).length) return '<p class="dim" style="font-size:13px">Chưa có lần điều chỉnh nào.</p>';
    return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Thành viên</th><th>Thao tác</th><th>Ví</th><th>Số điểm</th><th>Lý do</th><th>Người làm</th></tr></thead><tbody>${r.rows.map(h => `<tr${h.undone ? ' style="opacity:.55"' : ''}><td class="dim nowrap">${esc(PSQ.fdate(h.at))}</td><td><b>${esc(h.user.name || '')}</b><br><small class="dim">@${esc(h.user.username || '')} · ${esc(h.user.code || '')}</small></td><td class="nowrap">${OPN[h.op]}${h.undone ? '<br><small class="dim">đã hoàn lại</small>' : ''}</td><td class="nowrap">${WN[h.wallet] || h.wallet}</td><td class="gold nowrap">${ps(h.amount)}</td><td style="font-size:12.5px">${esc(String(h.note || '').replace(/^Công ty [^:]+: /, ''))}</td><td class="dim nowrap">${esc(h.by || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function render(el) {
    if (!owner()) { el.innerHTML = `<div class="card"><div class="empty">${icon('lock')}Chỉ chủ sở hữu xem và chỉnh mục này.</div></div>`; return; }
    const g = API.act('giveCfg'); if (g.error) { el.innerHTML = `<div class="card"><div class="empty">${esc(g.error)}</div></div>`; return; }
    el.innerHTML = `<div class="card glow-gold"><div class="card-head"><div><h3>Phân phối điểm mua hàng</h3><div class="sub">Tài khoản được bật quyền chuyển điểm từ ví mua hàng của mình sang thẳng ví mua hàng thành viên khác. Không tự sinh điểm: anh nạp điểm cho tài khoản này bằng Điều chỉnh ví (trừ Quỹ kế toán). Nhận điểm kiểu này không tính hoa hồng, không đổi cấp.</div></div></div>
        <form class="row" id="ppL" style="gap:10px;flex-wrap:wrap;align-items:end">
          <div class="field"><label for="ppM">Tối đa mỗi lần (PS)</label><input class="input" id="ppM" type="number" min="1" step="1000000" value="${g.max}"></div>
          <div class="field"><label for="ppD">Tối đa mỗi ngày (PS)</label><input class="input" id="ppD" type="number" min="1" step="1000000" value="${g.day}"></div>
          <button class="btn btn-sm btn-gold" type="submit">${icon('check')} Lưu hạn mức</button></form>
        <h4 class="mt-2" style="font-size:14px">Tài khoản phân phối</h4>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Tài khoản</th><th>Ví mua hàng</th><th>Hôm nay đã chuyển</th><th>Bật bởi</th><th></th></tr></thead><tbody>
        ${(g.users || []).length ? g.users.map(u => `<tr><td><b>${esc(u.name)}</b><br><small class="dim">@${esc(u.username)} · ${esc(u.code)}</small></td><td class="gold nowrap">${ps(u.bal)}</td><td class="nowrap">${ps(u.today)}</td><td class="dim" style="font-size:12.5px">${esc(u.by || '')}<br>${esc(u.at || '')}</td><td><button class="btn btn-sm btn-ghost" type="button" data-off="${esc(u.id)}">Tắt quyền</button></td></tr>`).join('') : `<tr><td colspan="5"><div class="empty">Chưa có tài khoản nào. Anh bấm nút dưới, hoặc vào Danh sách thành viên > Sửa > Quyền chuyển điểm mua hàng.</div></td></tr>`}
        </tbody></table></div>
        <form class="row mt-1" id="ppA" style="gap:8px;flex-wrap:wrap"><input class="input" id="ppU" placeholder="Tên truy cập hoặc mã PS, ví dụ phucsinh" style="max-width:280px"><button class="btn btn-sm" type="submit">${icon('plus')} Bật quyền cho tài khoản này</button></form>
      </div>
      <div class="card glow-cyan mt-2"><div class="card-head"><div><h3>Lịch sử chuyển</h3><div class="sub">500 lần gần nhất. Hoàn lại chỉ lấy được phần người nhận chưa dùng.</div></div></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Từ</th><th>Người nhận</th><th>Số điểm</th><th>Đã hoàn lại</th><th></th></tr></thead><tbody>
        ${(g.hist || []).length ? g.hist.map(h => `<tr><td class="dim nowrap">${esc(PSQ.fdate(h.at))}</td><td>@${esc(h.from.username || '')}</td><td><b>${esc(h.to.name || '')}</b><br><small class="dim">@${esc(h.to.username || '')} · ${esc(h.to.code || '')}</small></td><td class="gold nowrap">${ps(h.amount)}</td><td class="nowrap">${h.backed ? ps(h.backed) : '<span class="dim">-</span>'}</td><td>${h.backed < h.amount ? `<button class="btn btn-sm btn-ghost" type="button" data-back="${esc(h.ref)}">Hoàn lại</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="6"><div class="empty">Chưa có lần chuyển nào.</div></td></tr>`}
        </tbody></table></div></div>
      <div class="card glow-gold mt-2"><div class="card-head"><div><h3>Thu điểm, chuyển sang ví mua hàng</h3><div class="sub">Các lần anh điều chỉnh ví thành viên (mở Danh sách thành viên > Sửa > Điều chỉnh điểm). 300 lần gần nhất.</div></div></div>${adminLog()}</div>`;
    $('#ppL', el).addEventListener('submit', e => { e.preventDefault(); const r = API.act('giveCfg', { save: true, max: +$('#ppM', el).value, day: +$('#ppD', el).value }); if (r.error) return toast(r.error, 'err'); toast('Đã lưu hạn mức'); render(el); });
    $('#ppA', el).addEventListener('submit', e => { e.preventDefault(); const k = $('#ppU', el).value.trim().replace(/^@/, '').toUpperCase(); if (!k) return;
      const u = (ADB.load().users || []).find(x => x.role !== 'admin' && ((x.username || '').toUpperCase() === k || (x.code || '').toUpperCase() === k));
      if (!u) return toast('Không tìm thấy thành viên này.', 'err'); window.giveToggle(u, () => render(el)); });
    el.querySelectorAll('[data-off]').forEach(b => b.addEventListener('click', () => { const u = ADB.user(ADB.load(), b.dataset.off); if (u) window.giveToggle(u, () => render(el)); }));
    el.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => {
      const h = g.hist.find(x => x.ref === b.dataset.back);
      askPass('Hoàn lại điểm mua hàng', `Lấy lại tối đa ${ps(h.amount - h.backed)} từ ví mua hàng của ${esc(h.to.name || '')} về @${esc(h.from.username || '')}. Phần người nhận đã dùng thì không lấy lại được.`,
        pass => { const r = API.act('giveBack', { ref: h.ref, pass }); if (!r.error) { toast('Đã hoàn lại ' + ps(r.take) + (r.short ? ', còn ' + ps(r.short) + ' người nhận đã dùng' : '')); API.load(); render(el); } return r; });
    }));
  }
  ADMIN_MODULES.giveshop = { render };
})();
