/* Quản trị: xóa thành viên chưa có tuyến dưới, chưa phát sinh tiền (chủ sở hữu, nhập lại mật khẩu), và khôi phục người đã xóa.
   Máy chủ kiểm tra lại mọi điều kiện (memberDelete, memberRestore). */
(function () {
  const { $, esc, icon, toast, modal, fdate } = PSQ;
  const PAID = ['paid', 'ship', 'done'];
  // lý do không xóa được (trống = xóa được); giống điều kiện trên máy chủ, thêm kiểm tra mục Đại lý uy tín
  function why(d, u) {
    if (d.users.some(x => x.sponsor === u.id || x.parent === u.id)) return 'Đã có tuyến dưới';
    if (d.orders.some(o => (o.userId === u.id || o.refBy === u.id) && (PAID.includes(o.status) || o.settled))) return 'Đã có đơn đã thanh toán';
    if ((d.commissions || []).some(x => x.user === u.id || x.from === u.id)) return 'Đã có hoa hồng';
    if ((d.wallet || []).some(w => w.user === u.id) || (d.topups || []).some(t => t.user === u.id)) return 'Đã có giao dịch ví';
    if (PSQ.dealers.all().some(x => (x.code || '').toUpperCase() === (u.code || '').toUpperCase())) return 'Đang ở mục Đại lý uy tín';
    return '';
  }
  window.memberDeleteOk = (d, u) => !why(d, u);

  window.memberDelete = function (preset, done) {
    const d = ADB.load(), mem = d.users.filter(u => u.role !== 'admin');
    const can = mem.filter(u => !why(d, u)), chosen = new Set(preset ? [preset] : []);
    let f = '', tab = 'del';
    const m = modal(`<div class="row"><h3>Xóa thành viên</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div class="row mt-2" style="gap:8px"><button class="chip on" type="button" data-tab="del">Có thể xóa <small>${can.length}</small></button><button class="chip" type="button" data-tab="arc">Đã xóa <small>${(d.deletedUsers || []).length}</small></button></div>
      <div id="xtBody" class="mt-2"></div>`);
    const body = () => $('#xtBody', m.el);
    const drawDel = () => {
      const L = can.filter(u => !f || PSQ.fold([u.name, u.email, u.phone, u.code, u.username].join(' ')).includes(f));
      const pend = u => d.orders.filter(o => o.userId === u.id && o.status === 'pending').length;
      body().innerHTML = `<p class="dim" style="font-size:13px">Chỉ hiện người chưa có tuyến dưới, chưa có đơn đã thanh toán, hoa hồng hay giao dịch ví. Người không có ở đây thì dùng nút Khóa. Đơn chưa thanh toán của người bị xóa sẽ được hủy cùng lúc.</p>
        <input class="input mt-2" id="xtQ" type="search" placeholder="Tìm tên, email, số điện thoại, mã" value="${esc(f)}" style="height:40px">
        <div class="mt-2" style="max-height:40vh;overflow:auto;border:1px solid var(--line);border-radius:12px">${L.length ? L.map(u => `<label class="check" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer">
          <input type="checkbox" data-x="${u.id}"${chosen.has(u.id) ? ' checked' : ''}><span style="flex:1"><b>${esc(u.name)}</b> <span class="cyan">${esc(u.code || '')}</span><br><small class="dim">${esc(u.email || '')}${u.phone ? ' · ' + esc(u.phone) : ''} · tham gia ${fdate(u.created)}${pend(u) ? ` · <span class="gold">${pend(u)} đơn chưa thanh toán sẽ bị hủy</span>` : ''}${u.verified === false ? ' · chưa kích hoạt' : ''}</small></span></label>`).join('') : `<div class="empty" style="padding:20px">Không có ai.</div>`}</div>
        <form class="row mt-3" id="xtGo" style="gap:8px;flex-wrap:wrap"><input class="input" id="xtP" type="password" autocomplete="current-password" placeholder="Nhập lại mật khẩu của anh chị" style="flex:1 1 220px;height:42px"><button class="btn btn-danger" id="xtDo" type="submit" ${chosen.size ? '' : 'disabled'} style="background:var(--red);color:#fff">${icon('trash')} Xóa ${chosen.size || ''} người</button></form>`;
      const q = $('#xtQ', m.el); q.addEventListener('input', e => { f = PSQ.fold(e.target.value.trim()); const p = q.selectionStart; drawDel(); const n = $('#xtQ', m.el); n.focus(); n.setSelectionRange(p, p); });
      const go = () => {
        const pass = $('#xtP', m.el).value; if (!pass) return toast('Anh chị nhập lại mật khẩu để xác nhận.', 'err');
        const names = can.filter(u => chosen.has(u.id)).map(u => u.name);
        if (!confirm(`Xóa ${names.length} thành viên?\n${names.join(', ')}\n\nHồ sơ được lưu ở mục Đã xóa, khôi phục được khi cần.`)) return;
        const r = API.act('memberDelete', { ids: [...chosen], pass }); if (r.error) return toast(r.error, 'err');
        API.load(); m.close(); toast(`Đã xóa ${r.count} thành viên` + (r.skipped && r.skipped.length ? `. Bỏ qua: ${r.skipped.join('; ')}` : '')); done && done();
      };
      $('#xtGo', m.el).addEventListener('submit', e => { e.preventDefault(); go(); });
    };
    const drawArc = () => {
      const L = (ADB.load().deletedUsers || []).slice().reverse();
      body().innerHTML = L.length ? `<div style="max-height:50vh;overflow:auto">${L.map(u => `<div class="row between" style="padding:10px 4px;border-bottom:1px solid var(--line);gap:10px"><span><b>${esc(u.name)}</b> <span class="cyan">${esc(u.code || '')}</span><br><small class="dim">${esc(u.email || '')} · xóa ${esc(u.deletedAt || '')} bởi ${esc(u.deletedBy || '')}</small></span><button class="btn btn-sm btn-outline-gold" type="button" data-rs="${u.id}">Khôi phục</button></div>`).join('')}</div>`
        : `<div class="empty" style="padding:20px">Chưa xóa ai.</div>`;
    };
    const draw = () => tab === 'del' ? drawDel() : drawArc();
    m.el.addEventListener('change', e => { const id = e.target.dataset && e.target.dataset.x; if (!id) return; e.target.checked ? chosen.add(id) : chosen.delete(id); const b = $('#xtDo', m.el); b.disabled = !chosen.size; b.innerHTML = `${icon('trash')} Xóa ${chosen.size || ''} người`; });
    m.el.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; m.el.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === t)); draw(); return; }
      const rs = e.target.closest('[data-rs]'); if (rs) { if (!confirm('Khôi phục thành viên này?')) return; const r = API.act('memberRestore', { id: rs.dataset.rs }); if (r.error) return toast(r.error, 'err'); API.load(); toast('Đã khôi phục'); drawArc(); done && done(); }
    });
    draw();
  };
})();
