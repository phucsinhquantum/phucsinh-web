/* Quản trị: Vòng quay chào mừng (khách đăng ký xong quay 1 lần, trúng mã giảm giá).
   Dữ liệu ở d.settings.welcome và d.coupons (js/psq-data.js). */
(function () {
  const { $, $$, esc, icon, toast, money, fdate } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const COLORS = ['#4fe6df', '#f3c76b', '#b98cff', '#ff8fb1', '#7ee08a', '#ffb36b', '#6bb8ff', '#e6e6e6'];
  const off = p => p.type === 'pct' ? `Giảm ${+p.value || 0}%${+p.maxOff ? ', tối đa ' + money(+p.maxOff) : ''}` : p.type === 'amt' ? `Giảm ${money(+p.value || 0)}` : 'Chúc may mắn (không có mã)';
  let rows = null;

  function render(el) {
    const d = ADB.load(), w = ADB.welcome(d), edit = ADMIN.can('content'), dis = edit ? '' : ' disabled';
    if (!rows) rows = w.prizes.map(p => Object.assign({}, p));
    const C = d.coupons || [], won = id => C.filter(c => c.prize === id).length, used = id => C.filter(c => c.prize === id && c.status === 'used').length;
    const on = rows.filter(p => p.active !== false && (p.qty == null || p.qty === '' || +p.qty > 0)), sum = on.reduce((s, p) => s + Math.max(0, +p.weight || 0), 0);
    const pct = p => on.includes(p) && sum ? ((Math.max(0, +p.weight || 0) / sum) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
    const spun = d.users.filter(u => u.welcomeSpun).length, usedAll = C.filter(c => c.from === 'welcome' && c.status === 'used'), disc = d.orders.filter(o => o.coupon).reduce((s, o) => s + (o.discount || 0), 0);
    el.innerHTML = `<form id="wmForm" novalidate>
      <div class="card glow-gold"><div class="card-head"><div><h3>Vòng quay chào mừng</h3><div class="sub">Khách đăng ký tài khoản xong được quay 1 lần, trúng ô nào nhận mã giảm giá ô đó</div></div></div>
        <div class="grid g-4 mt-1 wm-stat"><div><span>Đã quay</span><b>${spun}</b></div><div><span>Mã đã phát</span><b>${C.filter(c => c.from === 'welcome').length}</b></div><div><span>Mã đã dùng</span><b>${usedAll.length}</b></div><div><span>Tổng tiền đã giảm</span><b>${money(disc)}</b></div></div>
        <div class="form-grid mt-2">
          <label class="check full"><input type="checkbox" id="wmOn"${w.enabled !== false ? ' checked' : ''}${dis}> Bật vòng quay chào mừng cho thành viên mới</label>
          <div class="field"><label for="wmE">Hạn dùng mã (ngày, 0 là không hạn)</label><input class="input" id="wmE" type="number" min="0" max="365" value="${+w.expireDays || 0}"${dis}></div>
          <div class="field"><label for="wmM">Đơn tối thiểu để dùng mã (đồng)</label><input class="input" id="wmM" type="number" min="0" step="1000" value="${+w.minOrder || 0}"${dis}></div>
        </div></div>
      <div class="card glow-cyan mt-2"><div class="card-head"><div><h3>Các ô quà</h3><div class="sub">Số suất là số mã còn phát ra; để trống là không giới hạn. Hết suất hoặc tắt thì ô đó tự ẩn khỏi vòng quay.</div></div>${edit ? `<button class="btn btn-sm btn-gold" type="button" data-wm-add style="margin-left:auto">${icon('plus')} Thêm ô</button>` : ''}</div>
        <div class="table-wrap"><table class="tbl" style="min-width:980px"><thead><tr><th>Màu</th><th>Tên ô</th><th>Loại</th><th>Mức giảm</th><th>Giảm tối đa</th><th>Số suất còn</th><th>Trọng số</th><th>Tỉ lệ</th><th>Đã trúng / dùng</th><th>Bật</th><th></th></tr></thead><tbody>
        ${rows.map((p, i) => `<tr data-i="${i}">
          <td><input type="color" data-f="color" value="${esc(p.color || COLORS[i % COLORS.length])}"${dis} style="width:38px;height:30px;padding:0;border:0;background:none"></td>
          <td><input class="input" data-f="label" value="${esc(p.label || '')}" maxlength="24" style="min-width:130px"${dis}></td>
          <td><select class="input" data-f="type"${dis}><option value="pct"${p.type === 'pct' ? ' selected' : ''}>Giảm %</option><option value="amt"${p.type === 'amt' ? ' selected' : ''}>Giảm tiền</option><option value="none"${p.type === 'none' ? ' selected' : ''}>Chúc may mắn</option></select></td>
          <td><input class="input" data-f="value" type="number" min="0" value="${+p.value || 0}" style="width:100px"${dis}></td>
          <td><input class="input" data-f="maxOff" type="number" min="0" step="1000" value="${+p.maxOff || 0}" style="width:110px" title="0 là không giới hạn"${dis}></td>
          <td><input class="input" data-f="qty" type="number" min="0" value="${p.qty == null || p.qty === '' ? '' : +p.qty}" placeholder="Không giới hạn" style="width:120px"${dis}></td>
          <td><input class="input" data-f="weight" type="number" min="0" value="${+p.weight || 0}" style="width:80px"${dis}></td>
          <td class="nowrap"><b>${pct(p)}</b></td>
          <td class="nowrap">${won(p.id)} / ${used(p.id)}</td>
          <td><input type="checkbox" data-f="active"${p.active !== false ? ' checked' : ''}${dis}></td>
          <td>${edit ? `<button class="btn btn-sm btn-ghost" type="button" data-wm-del="${i}" aria-label="Xóa ô">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="dim mt-1" style="font-size:12.5px">Tỉ lệ trúng của mỗi ô = trọng số ô đó chia tổng trọng số các ô đang bật. Bấm Lưu để cập nhật tỉ lệ.</p>
        <p class="red mt-1" id="wmErr" style="font-size:13px;min-height:1em"></p>
        ${edit ? `<div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-wm-reset>Hoàn tác</button><button class="btn btn-gold" type="submit">${icon('check')} Lưu cài đặt</button></div>` : '<p class="dim" style="font-size:13px">Vai trò của anh chị chỉ được xem.</p>'}</div>
      </form>
      <div class="card mt-2"><div class="card-head"><div><h3>Mã giảm giá đã phát</h3><div class="sub">${C.length} mã · mới nhất trước</div></div></div>
        ${C.length ? `<div class="table-wrap"><table class="tbl" style="min-width:720px"><thead><tr><th>Mã</th><th>Thành viên</th><th>Quà</th><th>Ngày nhận</th><th>Hạn dùng</th><th>Trạng thái</th></tr></thead><tbody>
        ${C.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200).map(c => { const u = ADB.user(d, c.user); return `<tr><td><b class="gold">${esc(c.code)}</b></td><td>${u ? esc(u.name) + ' <span class="dim">' + esc(u.code || '') + '</span>' : '(đã xóa)'}</td><td>${esc(c.label)}<div class="dim" style="font-size:12px">${esc(off(c))}</div></td><td class="nowrap">${fdate(c.createdAt)}</td><td class="nowrap">${c.expires ? fdate(c.expires) : 'Không hạn'}</td><td>${c.status === 'used' ? `<span class="badge">Đã dùng · ${esc(c.order || '')}</span>` : c.expires && c.expires < PSQ.today() ? '<span class="badge failed">Hết hạn</span>' : '<span class="badge paid">Chưa dùng</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>` : `<div class="empty">${icon('gift')}Chưa phát mã nào.</div>`}</div>`;
    if (!edit) return;
    const f = $('#wmForm', el);
    const pull = () => $$('tr[data-i]', f).forEach(tr => { const p = rows[+tr.dataset.i]; $$('[data-f]', tr).forEach(x => { const k = x.dataset.f; p[k] = x.type === 'checkbox' ? x.checked : k === 'qty' ? (x.value === '' ? null : Math.max(0, Math.round(+x.value))) : ['value', 'maxOff', 'weight'].includes(k) ? Math.max(0, +x.value || 0) : x.value.trim(); }); });
    f.addEventListener('click', e => {
      if (e.target.closest('[data-wm-add]')) { pull(); const ids = new Set(rows.map(p => p.id)); let k = rows.length + 1; while (ids.has('cm' + k)) k++; rows.push({ id: 'cm' + k, label: 'Giảm 5%', type: 'pct', value: 5, maxOff: 0, qty: null, weight: 10, color: COLORS[rows.length % COLORS.length], active: true }); return render(el); }
      const del = e.target.closest('[data-wm-del]'); if (del) { pull(); const p = rows[+del.dataset.wmDel]; if (won(p.id) && !confirm(`Ô "${p.label}" đã có ${won(p.id)} người trúng. Xóa ô này (mã đã phát vẫn dùng được)?`)) return; rows.splice(+del.dataset.wmDel, 1); return render(el); }
      if (e.target.closest('[data-wm-reset]')) { rows = null; return render(el); }
    });
    f.addEventListener('submit', e => {
      e.preventDefault(); pull(); const err = $('#wmErr', el);
      const ex = Math.round(+$('#wmE', el).value), mo = Math.round(+$('#wmM', el).value);
      if (!(ex >= 0 && ex <= 365)) return err.textContent = 'Hạn dùng mã từ 0 đến 365 ngày.';
      if (!(mo >= 0)) return err.textContent = 'Đơn tối thiểu không hợp lệ.';
      for (const p of rows) {
        if (!p.label) return err.textContent = 'Ô quà nào cũng cần tên.';
        if (p.type === 'pct' && !(p.value > 0 && p.value <= 100)) return err.textContent = `Ô "${p.label}": mức giảm % từ 1 đến 100.`;
        if (p.type === 'amt' && !(p.value > 0)) return err.textContent = `Ô "${p.label}": nhập số tiền giảm.`;
      }
      if ($('#wmOn', el).checked && !rows.some(p => p.active !== false && (p.qty == null || p.qty > 0) && p.weight > 0)) return err.textContent = 'Cần ít nhất 1 ô đang bật, còn suất và có trọng số lớn hơn 0.';
      const dd = ADB.load(), W = ADB.welcome(dd);
      Object.assign(W, { enabled: $('#wmOn', el).checked, expireDays: ex, minOrder: mo, prizes: rows.map(p => Object.assign({}, p)) });
      ADB.log(dd, 'Cài đặt vòng quay chào mừng', `${W.enabled ? 'Bật' : 'Tắt'}; ${rows.map(p => `${p.label} (${p.qty == null ? 'không giới hạn' : p.qty + ' suất'}, trọng số ${p.weight})`).join('; ')}`);
      ADB.save(dd); rows = null; toast('Đã lưu vòng quay chào mừng'); render(el);
    });
  }
  ADMIN_MODULES.welcome = { render(el) { rows = null; render(el); } };
})();
