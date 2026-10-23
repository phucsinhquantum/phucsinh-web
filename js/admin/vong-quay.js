/* Quản trị: Vòng quay may mắn (quà tặng, mã quay, chỉ định quà, lịch sử quay, sự kiện).
   Dữ liệu ở d.wheel (js/psq-data.js). Trang công khai: vong-quay.html */
(function () {
  const { $, $$, esc, icon, toast, modal, fdate } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const TABS = [['prizes', 'Quà tặng', 'gift'], ['codes', 'Mã quay', 'card'], ['forced', 'Chỉ định quà', 'star'], ['spins', 'Lịch sử quay', 'activity'], ['events', 'Sự kiện', 'users'], ['settings', 'Cài đặt', 'settings']];
  const KIND = { online: 'Zoom online', offline: 'Offline' };
  const LAW = `<div class="wh-law">${icon('info')}<span>Chương trình khuyến mại có quay số trúng thưởng phải minh bạch theo quy định (Nghị định 81/2018/NĐ-CP); chế độ chỉ định người trúng chỉ nên dùng cho trao quà nội bộ hoặc đã công bố trước.</span></div>`;
  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const uname = (d, id) => { const u = ADB.user(d, id); return u ? u.name : '(đã xóa)'; };
  const commit = (d, action, detail, msg) => { ADB.log(d, action, detail); ADB.save(d); if (msg) toast(msg); };
  let cur = 'prizes';

  function mini(prizes) {
    const L = prizes.filter(p => p.active !== false && (p.stock == null || p.stock > 0)); const n = L.length;
    if (!n) return `<div class="empty">${icon('gift')}Chưa có quà nào đang bật.</div>`;
    const a = 360 / n, P = (deg, r) => { const t = deg * Math.PI / 180; return [(100 + r * Math.sin(t)).toFixed(1), (100 - r * Math.cos(t)).toFixed(1)]; };
    let s = '';
    L.forEach((p, i) => { const [x0, y0] = P(i * a, 88), [x1, y1] = P((i + 1) * a, 88); s += n === 1 ? `<circle cx="100" cy="100" r="88" fill="${esc(p.color)}" fill-opacity=".55"/>` : `<path d="M100 100L${x0} ${y0}A88 88 0 ${a > 180 ? 1 : 0} 1 ${x1} ${y1}Z" fill="${esc(p.color)}" fill-opacity="${i % 2 ? .45 : .6}" stroke="#f3c76b" stroke-opacity=".6" stroke-width="1"/>`; });
    return `<svg class="wh-mini" viewBox="0 0 200 200" role="img" aria-label="Xem trước vòng quay"><circle cx="100" cy="100" r="97" fill="none" stroke="#e0a94a" stroke-width="8"/>${s}<circle cx="100" cy="100" r="20" fill="#0a0f11" stroke="#f3c76b" stroke-width="3"/><path d="M92 0h16l-8 16z" fill="#f3c76b"/></svg>`;
  }

  /* ---------- quà tặng ---------- */
  function prizes(box, d) {
    const W = ADB.wheel(d), ch = ADB.wheelChance(d);
    const pct = id => { const c = ch.find(x => x.prize.id === id); return c ? c.pct : 0; };
    box.innerHTML = `<div class="grid wh-pgrid">
      <div class="card glow-gold"><div class="card-head"><div><h3>Quà trên vòng quay khách hàng</h3><div class="sub">${W.prizes.length} quà · tỉ lệ trúng tính theo trọng số của các quà đang bật và còn hàng</div></div>
        <button class="btn btn-sm btn-gold" type="button" data-wq-add style="margin-left:auto">${icon('plus')} Thêm quà</button></div>
        <div class="table-wrap"><table class="tbl wh-ptbl" style="min-width:720px"><thead><tr><th>Quà</th><th>Trọng số</th><th>Tỉ lệ trúng</th><th>Còn lại</th><th>Đã trúng</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${W.prizes.map(p => { const won = W.spins.filter(s => s.prize === p.id).length, on = p.active !== false && (p.stock == null || p.stock > 0); return `<tr>
          <td><div class="who"><span class="wh-sw" style="background:${esc(p.color)}"></span><div><b>${esc(p.name)}</b></div></div></td>
          <td>${+p.weight || 0}</td>
          <td><div class="row" style="gap:8px"><div class="wh-bar"><i style="width:${pct(p.id).toFixed(1)}%;background:${esc(p.color)}"></i></div><b class="nowrap">${pct(p.id).toFixed(1).replace('.', ',')}%</b></div></td>
          <td class="nowrap">${p.stock == null ? '<span class="dim">Không giới hạn</span>' : p.stock}</td><td>${won}</td>
          <td>${p.active === false ? '<span class="badge failed">Tắt</span>' : on ? '<span class="badge ok">Đang quay</span>' : '<span class="badge pending">Hết quà</span>'}</td>
          <td><div class="wh-acts"><button class="btn btn-sm btn-ghost" type="button" data-wq-edit="${p.id}" aria-label="Sửa">${icon('edit')}</button><button class="btn btn-sm btn-ghost" type="button" data-wq-del="${p.id}" aria-label="Xóa">${icon('trash')}</button></div></td></tr>`; }).join('')}
        </tbody></table></div></div>
      <div class="card glow-cyan"><div class="card-head"><div><h3>Xem trước</h3><div class="sub">Vòng quay hiện trên web</div></div><a class="card-link" href="vong-quay.html" target="_blank" rel="noopener">Mở trang</a></div>${mini(W.prizes)}
        <p class="dim mt-2" style="font-size:12.5px">Mỗi ô trên vòng là một quà nên khách luôn trúng quà. Quà hết số lượng hoặc bị tắt sẽ tự ẩn khỏi vòng quay.</p></div></div>`;
    box.onclick = e => {
      const ed = e.target.closest('[data-wq-edit],[data-wq-add]'), del = e.target.closest('[data-wq-del]');
      if (ed) prizeForm(W.prizes.find(p => p.id === ed.dataset.wqEdit));
      if (del) { const d2 = ADB.load(), W2 = ADB.wheel(d2), p = W2.prizes.find(x => x.id === del.dataset.wqDel); if (!p || !confirm('Xóa quà "' + p.name + '"?')) return; W2.prizes = W2.prizes.filter(x => x !== p); Object.keys(W2.forced).forEach(k => { if (W2.forced[k] === p.id) delete W2.forced[k]; }); commit(d2, 'Xóa quà vòng quay', p.name, 'Đã xóa quà'); draw(); }
    };
  }
  function prizeForm(p) {
    const m = modal(`<div class="row"><h3>${p ? 'Sửa quà' : 'Thêm quà'}</h3>${closeBtn}</div>
      <form class="form-grid mt-2" id="wqForm">
        <div class="field full"><label for="wqN">Tên quà</label><input class="input" id="wqN" maxlength="60" required value="${esc(p ? p.name : '')}"></div>
        <div class="field"><label for="wqC">Màu ô trên vòng</label><div class="row" style="gap:8px"><input type="color" class="wh-color" id="wqC" value="${esc(p ? p.color : '#f3c76b')}"><span class="dim" style="font-size:12px">Nên chọn vàng, xanh ngọc, tím để hợp tông web</span></div></div>
        <div class="field"><label for="wqW">Trọng số (tỉ lệ trúng)</label><input class="input" id="wqW" type="number" min="0" max="10000" step="1" value="${p ? +p.weight || 0 : 10}"></div>
        <div class="field"><label for="wqS">Số lượng còn (để trống = không giới hạn)</label><input class="input" id="wqS" type="number" min="0" step="1" value="${p && p.stock != null ? p.stock : ''}"></div>
        <div class="field"><label for="wqP">Điểm tự cộng vào ví khi trúng (0 = quà hiện vật)</label><input class="input" id="wqP" type="number" min="0" step="1000" value="${p && +p.points > 0 ? +p.points : 0}"></div>
        <div class="field"><label for="wqV">Ví nhận điểm</label><select class="input" id="wqV">${[['shop', 'Ví điểm mua hàng'], ['avail', 'Ví điểm khả dụng']].map(([k, l]) => `<option value="${k}"${(p && p.wallet || 'shop') === k ? ' selected' : ''}>${l}</option>`).join('')}</select><small class="dim">Điểm trừ từ quỹ kế toán và ghi vào sổ quỹ.</small></div>
        <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="wqA" ${!p || p.active !== false ? 'checked' : ''}> Đang bật trên vòng quay</label></div>
        <div class="field full"><button class="btn btn-gold" type="submit">${icon('check')} Lưu quà</button></div>
      </form>`);
    $('#wqForm', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const d = ADB.load(), W = ADB.wheel(d), s = $('#wqS', m.el).value.trim();
      const v = { name: $('#wqN', m.el).value.trim(), color: $('#wqC', m.el).value, weight: Math.max(0, +$('#wqW', m.el).value || 0), stock: s === '' ? null : Math.max(0, Math.round(+s)), active: $('#wqA', m.el).checked, points: Math.max(0, Math.round(+$('#wqP', m.el).value || 0)), wallet: $('#wqV', m.el).value };
      if (!v.name) return toast('Anh chị nhập tên quà.');
      if (p) Object.assign(W.prizes.find(x => x.id === p.id) || {}, v); else W.prizes.push({ id: ADB.uid('qz'), ...v });
      commit(d, p ? 'Sửa quà vòng quay' : 'Thêm quà vòng quay', `${v.name}: trọng số ${v.weight}, số lượng ${v.stock == null ? 'không giới hạn' : v.stock}${v.points ? `, tự cộng ${v.points.toLocaleString('vi-VN')} PS` : ''}`, 'Đã lưu quà');
      m.close(); draw();
    });
  }

  /* ---------- mã quay ---------- */
  let cf = { q: '', st: '' };
  function codes(box, d) {
    const W = ADB.wheel(d), q = cf.q.toLowerCase();
    const rows = W.codes.filter(c => (!cf.st || c.status === cf.st) && (!q || [c.code, uname(d, c.user), c.from ? uname(d, c.from) : ''].join(' ').toLowerCase().includes(q))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const pz = id => (W.prizes.find(p => p.id === id) || {}).name || '';
    box.innerHTML = `<div class="grid g-3">${[['Tổng mã', W.codes.length, 'gold'], ['Chưa dùng', W.codes.filter(c => c.status === 'new').length, 'cyan'], ['Đã quay', W.codes.filter(c => c.status === 'used').length, 'green']].map(([l, v, c]) => `<div class="card stat"><div class="stat-top"><span class="stat-ico ${c}">${icon('card')}</span><span class="dim">${l}</span></div><div class="stat-val">${v}</div></div>`).join('')}</div>
      <div class="card glow-gold mt-2"><div class="card-head"><div><h3>Mã quay</h3><div class="sub">Tự cấp mã cho khách hàng mỗi khi có người đăng ký qua đường dẫn giới thiệu của họ (xem tab Cài đặt)</div></div></div>
        <div class="toolbar row wrap" style="gap:10px;margin-bottom:12px">
          <input class="input" id="wcQ" placeholder="Tìm mã, tên thành viên" value="${esc(cf.q)}" style="flex:1 1 200px;width:auto">
          <select class="input" id="wcS" style="flex:0 1 170px;width:auto"><option value="">Tất cả trạng thái</option><option value="new"${cf.st === 'new' ? ' selected' : ''}>Chưa dùng</option><option value="used"${cf.st === 'used' ? ' selected' : ''}>Đã quay</option></select>
          <button class="btn btn-sm btn-gold" type="button" id="wcNew">${icon('plus')} Cấp mã</button>
          <button class="btn btn-sm" type="button" id="wcCsv">${icon('download')} Tải Excel (CSV)</button></div>
        ${rows.length ? `<div class="table-wrap"><table class="tbl" style="min-width:760px"><thead><tr><th>Mã</th><th>Chủ mã</th><th>Nguồn</th><th>Ngày cấp</th><th>Trạng thái</th><th>Quà</th><th></th></tr></thead><tbody>
          ${rows.slice(0, 300).map(c => `<tr><td class="nowrap"><b class="wh-mono gold">${esc(c.code)}</b></td><td class="nowrap">${esc(uname(d, c.user))}</td><td class="dim">${c.from ? 'Giới thiệu ' + esc(uname(d, c.from)) : esc(c.note || 'Cấp thủ công')}</td><td class="dim nowrap">${esc(fdate(String(c.createdAt).slice(0, 10)))}</td>
            <td>${c.status === 'new' ? '<span class="badge ship">Chưa dùng</span>' : '<span class="badge ok">Đã quay</span>'}</td><td>${esc(pz(c.prize))}${c.usedAt ? `<br><small class="dim">${esc(c.usedAt)}</small>` : ''}</td>
            <td>${c.status === 'new' && !c.from ? `<button class="btn btn-sm btn-ghost" type="button" data-wc-del="${esc(c.code)}" aria-label="Hủy mã">${icon('trash')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${icon('card')}Không có mã phù hợp.</div>`}</div>`;
    $('#wcQ').addEventListener('input', e => { cf.q = e.target.value; clearTimeout(box._t); box._t = setTimeout(() => { draw(); const i = $('#wcQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
    $('#wcS').onchange = e => { cf.st = e.target.value; draw(); };
    $('#wcCsv').onclick = () => ADB.csv('ma-vong-quay', [['Mã', 'Chủ mã', 'Nguồn', 'Ngày cấp', 'Trạng thái', 'Quà', 'Ngày quay'], ...rows.map(c => [c.code, uname(d, c.user), c.from ? 'Giới thiệu ' + uname(d, c.from) : c.note || '', c.createdAt, c.status === 'new' ? 'Chưa dùng' : 'Đã quay', pz(c.prize), c.usedAt || ''])]);
    $('#wcNew').onclick = () => {
      const mem = d.users.filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      const m = modal(`<div class="row"><h3>Cấp mã quay thủ công</h3>${closeBtn}</div><form class="form-grid mt-2" id="wcForm">
        <div class="field full"><label for="wcU">Thành viên</label><select class="input" id="wcU">${mem.map(u => `<option value="${u.id}">${esc(u.name)} (@${esc(u.username || u.code || '')})</option>`).join('')}</select></div>
        <div class="field"><label for="wcN">Số mã</label><input class="input" id="wcN" type="number" min="1" max="20" value="1"></div>
        <div class="field"><label for="wcR">Lý do</label><input class="input" id="wcR" maxlength="60" placeholder="Ví dụ: Tri ân khách hàng" value="Cấp thủ công"></div>
        <div class="field full"><button class="btn btn-gold" type="submit">${icon('check')} Cấp mã</button></div></form>`);
      $('#wcForm', m.el).addEventListener('submit', e => {
        e.preventDefault(); const d2 = ADB.load(), uid = $('#wcU', m.el).value, n = Math.min(20, Math.max(1, Math.round(+$('#wcN', m.el).value || 1))), note = $('#wcR', m.el).value.trim() || 'Cấp thủ công';
        const out = []; for (let i = 0; i < n; i++) out.push(ADB.wheelNewCode(d2, uid, note).code);
        commit(d2, 'Cấp mã quay', `${uname(d2, uid)}: ${out.join(', ')} (${note})`, `Đã cấp ${n} mã cho ${uname(d2, uid)}`); m.close(); draw();
      });
    };
    box.onclick = e => { const b = e.target.closest('[data-wc-del]'); if (!b || !confirm('Hủy mã ' + b.dataset.wcDel + '?')) return; const d2 = ADB.load(), W2 = ADB.wheel(d2); W2.codes = W2.codes.filter(c => c.code !== b.dataset.wcDel); delete W2.forced[b.dataset.wcDel]; commit(d2, 'Hủy mã quay', b.dataset.wcDel, 'Đã hủy mã'); draw(); };
  }

  /* ---------- chỉ định quà ---------- */
  function forced(box, d) {
    const W = ADB.wheel(d), list = Object.entries(W.forced), act = W.prizes.filter(p => p.active !== false);
    const mem = d.users.filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const target = k => { const c = W.codes.find(x => x.code === k); if (c) return `Mã <b class="wh-mono gold">${esc(k)}</b> <small class="dim">(${esc(uname(d, c.user))})</small>`; const u = ADB.user(d, k); return u ? `Thành viên <b>${esc(u.name)}</b> <small class="dim">(lượt quay kế tiếp)</small>` : esc(k); };
    box.innerHTML = `<div class="card glow-gold">${LAW}
      <div class="card-head"><div><h3>Chỉ định quà cho lượt quay kế tiếp</h3><div class="sub">Khi mã hoặc thành viên này quay, vòng quay dừng đúng ô quà đã chọn (nếu quà còn hàng). Dùng xong tự xóa.</div></div></div>
      <form class="form-grid" id="wfForm">
        <div class="field"><label for="wfT">Chỉ định theo</label><select class="input" id="wfT"><option value="code">Mã quay</option><option value="user">Thành viên</option></select></div>
        <div class="field" id="wfBox"></div>
        <div class="field"><label for="wfP">Quà</label><select class="input" id="wfP">${act.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>&nbsp;</label><button class="btn btn-gold" type="submit">${icon('check')} Chỉ định</button></div></form></div>
      <div class="card mt-2"><div class="card-head"><div><h3>Đang chỉ định</h3><div class="sub">${list.length} chỉ định</div></div></div>
        ${list.length ? `<div class="table-wrap"><table class="tbl" style="min-width:520px"><thead><tr><th>Áp dụng cho</th><th>Quà</th><th></th></tr></thead><tbody>${list.map(([k, pid]) => { const p = W.prizes.find(x => x.id === pid); return `<tr><td>${target(k)}</td><td>${p ? `<span class="wh-sw" style="background:${esc(p.color)};width:14px;height:14px"></span> ${esc(p.name)}` : '<span class="red">Quà đã xóa</span>'}</td><td><button class="btn btn-sm btn-ghost" type="button" data-wf-del="${esc(k)}">${icon('trash')} Bỏ</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">${icon('star')}Chưa có chỉ định nào. Vòng quay đang chọn quà ngẫu nhiên theo tỉ lệ.</div>`}</div>`;
    const fill = () => { const t = $('#wfT').value; $('#wfBox').innerHTML = t === 'code' ? `<label for="wfK">Mã quay (chưa dùng)</label><input class="input" id="wfK" list="wfCodes" placeholder="PSQ-XXXXXX" autocomplete="off"><datalist id="wfCodes">${W.codes.filter(c => c.status === 'new').map(c => `<option value="${esc(c.code)}">${esc(uname(d, c.user))}</option>`).join('')}</datalist>` : `<label for="wfK">Thành viên</label><select class="input" id="wfK">${mem.map(u => `<option value="${u.id}">${esc(u.name)} (@${esc(u.username || '')})</option>`).join('')}</select>`; };
    $('#wfT').onchange = fill; fill();
    $('#wfForm').addEventListener('submit', e => {
      e.preventDefault(); const d2 = ADB.load(), W2 = ADB.wheel(d2); let k = $('#wfK').value.trim(); const pid = $('#wfP').value;
      if (!pid) return toast('Chưa có quà để chỉ định.');
      if ($('#wfT').value === 'code') { k = k.toUpperCase(); const c = W2.codes.find(x => x.code === k); if (!c) return toast('Không tìm thấy mã quay này.'); if (c.status !== 'new') return toast('Mã này đã được dùng.'); }
      W2.forced[k] = pid; const p = W2.prizes.find(x => x.id === pid);
      commit(d2, 'Chỉ định quà vòng quay', `${ADB.user(d2, k) ? uname(d2, k) : k}: ${p.name}`, 'Đã chỉ định quà'); draw();
    });
    box.onclick = e => { const b = e.target.closest('[data-wf-del]'); if (!b) return; const d2 = ADB.load(), W2 = ADB.wheel(d2); delete W2.forced[b.dataset.wfDel]; commit(d2, 'Bỏ chỉ định quà', b.dataset.wfDel, 'Đã bỏ chỉ định'); draw(); };
  }

  /* ---------- lịch sử quay ---------- */
  function spins(box, d) {
    const W = ADB.wheel(d), S = W.spins;
    box.innerHTML = `<div class="card glow-gold"><div class="card-head"><div><h3>Lịch sử quay</h3><div class="sub">${S.length} lượt · ${S.filter(s => !s.given).length} quà chưa trao</div></div><button class="btn btn-sm" type="button" id="wsCsv" style="margin-left:auto">${icon('download')} Tải Excel (CSV)</button></div>
      ${S.length ? `<div class="table-wrap"><table class="tbl" style="min-width:760px"><thead><tr><th>Thời gian</th><th>Thành viên</th><th>Mã</th><th>Quà trúng</th><th>Cách chọn</th><th>Trao quà</th></tr></thead><tbody>
      ${S.map(s => { const u = ADB.user(d, s.user) || {}; return `<tr><td class="dim nowrap">${esc(s.date)}</td><td><b>${esc(u.name || '')}</b><br><small class="dim">${esc(u.phone || '')}</small></td><td class="wh-mono nowrap">${esc(s.code)}</td><td class="gold">${esc(s.prizeName || '')}</td><td>${s.forced ? '<span class="badge violet">Chỉ định</span>' : '<span class="badge ship">Ngẫu nhiên</span>'}</td>
        <td>${s.auto ? `<span class="badge paid nowrap">Đã tự cộng ${(+s.points).toLocaleString('vi-VN')} PS</span>` : `<button class="btn btn-sm ${s.given ? 'btn-ghost' : 'btn-outline-gold'}" type="button" data-ws="${s.id}">${s.given ? icon('check') + ' Đã trao' : 'Đánh dấu đã trao'}</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">${icon('activity')}Chưa có lượt quay nào.</div>`}</div>`;
    $('#wsCsv').onclick = () => ADB.csv('lich-su-vong-quay', [['Thời gian', 'Thành viên', 'Điện thoại', 'Mã', 'Quà', 'Cách chọn', 'Đã trao'], ...S.map(s => { const u = ADB.user(d, s.user) || {}; return [s.date, u.name, u.phone, s.code, s.prizeName, s.forced ? 'Chỉ định' : 'Ngẫu nhiên', s.given ? 'Có' : 'Chưa']; })]);
    box.onclick = e => { const b = e.target.closest('[data-ws]'); if (!b) return; const d2 = ADB.load(), s = ADB.wheel(d2).spins.find(x => x.id === b.dataset.ws); if (!s || s.auto) return; s.given = !s.given; commit(d2, 'Trao quà vòng quay', `${uname(d2, s.user)}: ${s.prizeName} (${s.given ? 'đã trao' : 'chưa trao'})`, s.given ? 'Đã đánh dấu trao quà' : 'Đã bỏ đánh dấu'); draw(); };
  }

  /* ---------- sự kiện ---------- */
  function events(box, d) {
    const E = ADB.wheel(d).events;
    box.innerHTML = `<div class="card glow-gold">${LAW}<div class="card-head"><div><h3>Vòng quay sự kiện</h3><div class="sub">Buổi giao lưu Zoom online hoặc sự kiện offline. Mở trang vòng quay để quay trực tiếp khi đang đăng nhập quản trị.</div></div><button class="btn btn-sm btn-gold" type="button" data-we-add style="margin-left:auto">${icon('plus')} Tạo sự kiện</button></div>
      ${E.length ? `<div class="grid g-2">${E.map(ev => { const slots = ADB.wheelEventSlots(ev), pool = ADB.wheelEventPool(ev); return `<div class="card wh-evcard">
        <div class="row between wrap" style="gap:8px"><b style="font-size:15px">${esc(ev.name)}</b><span class="badge ${ev.kind === 'online' ? 'ship' : 'gold'}">${KIND[ev.kind] || ''}</span></div>
        <div class="dim" style="font-size:13px">${ev.date ? fdate(ev.date) + ' · ' : ''}${(ev.participants || []).length} người tham dự · ${pool.length} còn trong vòng · ${slots.length || 'không giới hạn'} giải</div>
        <div class="row wrap" style="gap:6px">${ev.mode === 'fixed' ? `<span class="badge violet">Chỉ định người trúng (${(ev.fixedWinners || []).length})</span>` : '<span class="badge ok">Ngẫu nhiên</span>'}${ev.removeWinners ? '<span class="badge">Loại người đã trúng</span>' : ''}</div>
        ${(ev.winners || []).length ? `<div style="font-size:13px"><span class="dim">Đã trúng:</span> ${ev.winners.map(w => `<b>${esc(w.name)}</b>${w.prize ? ' <span class="gold">(' + esc(w.prize) + ')</span>' : ''}`).join(', ')}</div>` : '<div class="dim" style="font-size:13px">Chưa quay</div>'}
        <div class="row wrap" style="gap:8px"><a class="btn btn-sm btn-gold" href="vong-quay.html?ev=${encodeURIComponent(ev.id)}#su-kien" target="_blank" rel="noopener">${icon('sparkle')} Mở vòng quay</a><button class="btn btn-sm" type="button" data-we-edit="${ev.id}">${icon('edit')} Sửa</button><button class="btn btn-sm btn-ghost" type="button" data-we-reset="${ev.id}">Quay lại từ đầu</button><button class="btn btn-sm btn-ghost" type="button" data-we-del="${ev.id}" aria-label="Xóa">${icon('trash')}</button></div></div>`; }).join('')}</div>` : `<div class="empty">${icon('users')}Chưa có sự kiện nào.</div>`}</div>`;
    box.onclick = e => {
      const ed = e.target.closest('[data-we-edit],[data-we-add]'), rs = e.target.closest('[data-we-reset]'), del = e.target.closest('[data-we-del]');
      if (ed) return eventForm(E.find(x => x.id === ed.dataset.weEdit));
      const d2 = ADB.load(), W2 = ADB.wheel(d2);
      if (rs) { const ev = W2.events.find(x => x.id === rs.dataset.weReset); if (!ev || !confirm('Xóa kết quả đã quay của "' + ev.name + '"?')) return; ev.winners = []; commit(d2, 'Đặt lại vòng quay sự kiện', ev.name, 'Đã xóa kết quả, có thể quay lại'); draw(); }
      if (del) { const ev = W2.events.find(x => x.id === del.dataset.weDel); if (!ev || !confirm('Xóa sự kiện "' + ev.name + '"?')) return; W2.events = W2.events.filter(x => x !== ev); commit(d2, 'Xóa sự kiện vòng quay', ev.name, 'Đã xóa sự kiện'); draw(); }
    };
  }
  function eventForm(ev) {
    const allNum = ev && (ev.participants || []).length && ev.participants.every(n => /^\d+$/.test(n)) && ev.participants.every((n, i) => +n === i + 1);
    const m = modal(`<div class="row"><h3>${ev ? 'Sửa sự kiện' : 'Tạo sự kiện'}</h3>${closeBtn}</div>${LAW}
      <form class="form-grid" id="weForm">
        <div class="field full"><label for="weN">Tên sự kiện</label><input class="input" id="weN" maxlength="80" required value="${esc(ev ? ev.name : '')}"></div>
        <div class="field"><label for="weK">Hình thức</label><select class="input" id="weK"><option value="online"${ev && ev.kind === 'online' ? ' selected' : ''}>Zoom online</option><option value="offline"${ev && ev.kind === 'offline' ? ' selected' : ''}>Offline</option></select></div>
        <div class="field"><label for="weD">Ngày</label><input class="input" id="weD" type="date" value="${esc(ev ? ev.date || '' : PSQ.today())}"></div>
        <div class="field full"><label for="weP">Danh sách người tham dự (mỗi dòng một tên)</label><textarea class="input" id="weP" rows="5" placeholder="Nguyễn Văn A&#10;Trần Thị B">${allNum ? '' : esc((ev ? ev.participants : []).join('\n'))}</textarea></div>
        <div class="field"><label for="weC">Hoặc số khách (đánh số 1 đến N)</label><input class="input" id="weC" type="number" min="2" max="1000" value="${allNum ? ev.participants.length : ''}" placeholder="Ví dụ: 100"></div>
        <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="weR" ${!ev || ev.removeWinners ? 'checked' : ''}> Loại người đã trúng khỏi vòng</label></div>
        <div class="field full"><label for="weZ">Giải thưởng theo thứ tự quay (mỗi dòng: Tên giải | số lượng)</label><textarea class="input" id="weZ" rows="3" placeholder="Nụ trầm | 3&#10;Vòng tay trầm hương | 1">${esc((ev ? ev.prizes : []).map(p => p.name + ' | ' + p.qty).join('\n'))}</textarea></div>
        <div class="field full"><label>Cách chọn người trúng</label><div class="choice"><label><input type="radio" name="weM" value="random" ${!ev || ev.mode !== 'fixed' ? 'checked' : ''}> <span><b>Ngẫu nhiên</b><br><small class="dim">Vòng quay chọn ngẫu nhiên trong danh sách còn lại</small></span></label><label><input type="radio" name="weM" value="fixed" ${ev && ev.mode === 'fixed' ? 'checked' : ''}> <span><b>Chỉ định người trúng</b><br><small class="dim">Vòng quay dừng lần lượt đúng người trong danh sách bên dưới, hết danh sách thì quay ngẫu nhiên</small></span></label></div></div>
        <div class="field full" id="weFBox"><label for="weF">Người trúng chỉ định theo thứ tự (mỗi dòng một tên, đúng như trong danh sách tham dự)</label><textarea class="input" id="weF" rows="3">${esc((ev ? ev.fixedWinners || [] : []).join('\n'))}</textarea></div>
        <div class="field full"><button class="btn btn-gold" type="submit">${icon('check')} Lưu sự kiện</button></div></form>`);
    m.el.querySelector('.modal').classList.add('wh-wide');
    const sync = () => { $('#weFBox', m.el).hidden = m.el.querySelector('[name=weM]:checked').value !== 'fixed'; };
    $$('[name=weM]', m.el).forEach(r => r.onchange = sync); sync();
    $('#weForm', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const seen = new Set(), names = $('#weP', m.el).value.split('\n').map(s => s.trim().replace(/\s+/g, ' ')).filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
      const cnt = Math.round(+$('#weC', m.el).value || 0);
      const participants = names.length ? names : cnt >= 2 ? Array.from({ length: Math.min(1000, cnt) }, (_, i) => String(i + 1)) : [];
      if (participants.length < 2) return toast('Anh chị nhập danh sách tên hoặc số khách (ít nhất 2).');
      const prizes = $('#weZ', m.el).value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [n, q] = l.split('|'); return { name: n.trim(), qty: Math.max(1, Math.round(+(q || 1)) || 1) }; });
      const mode = m.el.querySelector('[name=weM]:checked').value;
      const fixedWinners = $('#weF', m.el).value.split('\n').map(s => s.trim()).filter(Boolean);
      const low = new Set(participants.map(p => p.toLowerCase())), miss = fixedWinners.filter(n => !low.has(n.toLowerCase()));
      if (mode === 'fixed' && miss.length) return toast('Không có trong danh sách tham dự: ' + miss.slice(0, 3).join(', '));
      const v = { name: $('#weN', m.el).value.trim(), kind: $('#weK', m.el).value, date: $('#weD', m.el).value, participants, prizes, mode, fixedWinners, removeWinners: $('#weR', m.el).checked };
      const d = ADB.load(), W = ADB.wheel(d);
      if (ev) Object.assign(W.events.find(x => x.id === ev.id) || {}, v); else W.events.unshift({ id: ADB.uid('sk'), winners: [], ...v });
      commit(d, ev ? 'Sửa sự kiện vòng quay' : 'Tạo sự kiện vòng quay', `${v.name}: ${participants.length} người, ${mode === 'fixed' ? 'chỉ định ' + fixedWinners.length + ' người trúng' : 'ngẫu nhiên'}`, 'Đã lưu sự kiện');
      m.close(); draw();
    });
  }

  let root = null;
  /* ---------- cài đặt vòng quay khách hàng ---------- */
  function settings(box, d) {
    const S = ADB.wheel(d).settings, edit = ADMIN.can('content'), dis = edit ? '' : ' disabled';
    const TI = [['khach', 'Khách hàng'], ['ctv', 'Cộng tác viên'], ['daily', 'Đại lý']];
    box.innerHTML = `<form class="card glow-gold" id="wsForm" novalidate><div class="card-head"><div><h3>Cài đặt vòng quay khách hàng</h3><div class="sub">Ai được nhận mã, số mã, hạn dùng và thể lệ hiện trên trang vòng quay</div></div></div>
      <div class="form-grid">
        <label class="check field full"><input type="checkbox" id="wsOn"${S.enabled !== false ? ' checked' : ''}${dis}> Bật vòng quay khách hàng (tắt thì không cấp mã mới và không quay được)</label>
        <div class="field full"><label>Cấp bậc được nhận mã khi giới thiệu</label><div class="row wrap" style="gap:16px">${TI.map(([k, l]) => `<label class="check"><input type="checkbox" name="wsT" value="${k}"${S.tiers.includes(k) ? ' checked' : ''}${dis}> ${l}</label>`).join('')}</div>
          <small class="dim">Mặc định chỉ khách hàng. Cộng tác viên và đại lý đã hưởng hoa hồng nên không nhận mã. Chỉ áp dụng cho người đăng ký từ lúc lưu trở đi.</small></div>
        <div class="field"><label for="wsN">Số mã cho mỗi người đăng ký thành công</label><input class="input" id="wsN" type="number" min="1" max="10" step="1" value="${+S.perRef || 1}"${dis}></div>
        <div class="field"><label for="wsE">Hạn dùng mã (ngày, 0 là không hạn)</label><input class="input" id="wsE" type="number" min="0" max="365" step="1" value="${+S.expireDays || 0}"${dis}></div>
        <div class="field full"><label for="wsR">Thể lệ chương trình (hiện trên trang vòng quay)</label><textarea class="input" id="wsR" rows="5" maxlength="2000" placeholder="Thời gian chương trình, cơ cấu giải, cách nhận quà, liên hệ khi có thắc mắc">${esc(S.rules || '')}</textarea></div>
      </div>
      <p class="red mt-1" id="wsErr" style="font-size:13px;min-height:1em"></p>
      ${edit ? `<div class="row" style="justify-content:flex-end"><button class="btn btn-gold" type="submit">${icon('check')} Lưu cài đặt</button></div>` : '<p class="dim" style="font-size:13px">Vai trò của anh chị chỉ được xem.</p>'}</form>`;
    if (!edit) return;
    $('#wsForm', box).addEventListener('submit', e => {
      e.preventDefault();
      const tiers = $$('[name=wsT]:checked', box).map(x => x.value), n = Math.round(+$('#wsN', box).value), ex = Math.round(+$('#wsE', box).value);
      if (!(n >= 1 && n <= 10)) return $('#wsErr', box).textContent = 'Số mã mỗi người từ 1 đến 10.';
      if (!(ex >= 0 && ex <= 365)) return $('#wsErr', box).textContent = 'Hạn dùng từ 0 đến 365 ngày.';
      const dd = ADB.load(), W = ADB.wheel(dd);
      W.settings = Object.assign({}, W.settings, { enabled: $('#wsOn', box).checked, tiers, perRef: n, expireDays: ex, rules: $('#wsR', box).value.trim() });
      commit(dd, 'Cài đặt vòng quay', `${W.settings.enabled ? 'Bật' : 'Tắt'}; nhận mã: ${tiers.map(k => (TI.find(t => t[0] === k) || [])[1]).join(', ') || 'không ai'}; ${n} mã/người; hạn ${ex || 'không giới hạn'}${ex ? ' ngày' : ''}`, 'Đã lưu cài đặt vòng quay');
    });
  }

  function draw() {
    if (!root) return; const d = ADB.load(), box = $('#whAdmBody', root);
    $$('[data-wt]', root).forEach(b => b.classList.toggle('on', b.dataset.wt === cur));
    ({ prizes, codes, forced, spins, events, settings })[cur](box, d);
  }
  ADMIN_MODULES.wheel = {
    render(el) {
      root = el;
      el.innerHTML = `<div class="tabs wh-adm-tabs">${TABS.map(([id, l, ic]) => `<button type="button" data-wt="${id}">${icon(ic)} ${l}</button>`).join('')}</div><div id="whAdmBody"></div>`;
      $$('[data-wt]', el).forEach(b => b.addEventListener('click', () => { cur = b.dataset.wt; draw(); }));
      draw();
    }
  };
})();
