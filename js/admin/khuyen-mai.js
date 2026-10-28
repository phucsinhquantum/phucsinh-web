/* Quản trị: Chương trình khuyến mãi (d.promos). Chương trình đang chạy hiện ở trang khuyen-mai.html
   và làm mục "Khuyến mãi" trên menu sáng lên; có thể kèm mã dùng chung (mỗi người 1 lần, mỗi đơn 1 mã). */
(function () {
  const { $, esc, icon, toast, modal, money, fdate } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const COLORS = ['#ff9a3d', '#f3c76b', '#4fe6df', '#b98cff', '#ff8fb1', '#45e08f'];
  const off = p => p.code ? (p.type === 'pct' ? `Giảm ${+p.value || 0}%${+p.maxOff ? ', tối đa ' + money(+p.maxOff) : ''}` : `Giảm ${money(+p.value || 0)}`) : 'Không kèm mã';
  const state = p => { const day = PSQ.today(); if (p.active === false) return ['Đã tắt', 'failed']; if (p.start && p.start > day) return ['Sắp diễn ra', 'pending']; if (p.end && p.end < day) return ['Đã kết thúc', '']; return ['Đang diễn ra', 'paid']; };
  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;

  function render(el) {
    const d = ADB.load(), L = d.promos || [], edit = ADMIN.can('content'), live = ADB.promosLive(d).length;
    el.innerHTML = `<div class="card ${live ? 'glow-gold' : 'glow-cyan'}"><div class="card-head"><div><h3>Chương trình khuyến mãi</h3><div class="sub">${live ? `${live} chương trình đang diễn ra, mục Khuyến mãi trên menu đang sáng` : 'Chưa có chương trình nào đang diễn ra, mục Khuyến mãi trên menu đang mờ'}</div></div>
      ${edit ? `<button class="btn btn-sm btn-gold" type="button" data-pm-add style="margin-left:auto">${icon('plus')} Thêm chương trình</button>` : ''}</div>
      ${L.length ? `<div class="table-wrap"><table class="tbl" style="min-width:820px"><thead><tr><th>Chương trình</th><th>Thời gian</th><th>Mã</th><th>Ưu đãi</th><th>Đã dùng</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${L.map(p => { const [t, c] = state(p); return `<tr><td><div class="who"><span class="wh-sw" style="background:${esc(p.color || '#ff9a3d')};width:12px;height:12px;border-radius:4px;display:inline-block"></span><div><b>${esc(p.title)}</b>${p.desc ? `<small class="dim" style="display:block;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.desc)}</small>` : ''}</div></div></td>
        <td class="nowrap">${p.start ? fdate(p.start) : 'Ngay'} → ${p.end ? fdate(p.end) : 'Không hạn'}</td><td>${p.code ? `<b class="gold">${esc(String(p.code).toUpperCase())}</b>` : '<span class="dim">-</span>'}</td>
        <td>${esc(off(p))}${+p.minOrder ? `<small class="dim" style="display:block">Đơn từ ${money(+p.minOrder)}</small>` : ''}</td><td>${+p.used || 0}${+p.limit ? ' / ' + p.limit : ''}</td>
        <td><span class="badge ${c}">${t}</span></td>
        <td>${edit ? `<div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-sm btn-ghost" type="button" data-pm-edit="${p.id}" aria-label="Sửa">${icon('edit')}</button><button class="btn btn-sm btn-ghost" type="button" data-pm-del="${p.id}" aria-label="Xóa">${icon('trash')}</button></div>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="empty">${icon('gift')}Chưa có chương trình nào. Bấm "Thêm chương trình" để thông báo ưu đãi.</div>`}
      <p class="dim mt-2" style="font-size:12.5px">Chương trình bật và đang trong thời gian diễn ra sẽ hiện ở trang <a class="cyan" href="khuyen-mai.html" target="_blank" rel="noopener">Khuyến mãi</a>, mục Khuyến mãi trên menu sáng lên. Mã khuyến mãi: mỗi khách (theo tài khoản hoặc số điện thoại) dùng 1 lần; mỗi đơn chỉ 1 mã, không cộng dồn với mã khác.</p></div>`;
    if (!edit) return;
    el.onclick = e => {
      if (e.target.closest('[data-pm-add]')) return form(el, null);
      const ed = e.target.closest('[data-pm-edit]'); if (ed) return form(el, ed.dataset.pmEdit);
      const del = e.target.closest('[data-pm-del]'); if (del) {
        const dd = ADB.load(), p = (dd.promos || []).find(x => x.id === del.dataset.pmDel); if (!p) return;
        if (!confirm(`Xóa chương trình "${p.title}"?${+p.used ? ' Đơn đã dùng mã vẫn giữ nguyên.' : ''}`)) return;
        dd.promos = dd.promos.filter(x => x !== p); ADB.log(dd, 'Xóa chương trình khuyến mãi', p.title); ADB.save(dd); toast('Đã xóa chương trình'); render(el);
      }
    };
  }

  function form(el, id) {
    const d = ADB.load(), p = (d.promos || []).find(x => x.id === id) || { active: true, type: 'pct', value: 10, color: COLORS[(d.promos || []).length % COLORS.length] };
    const md = modal(`<form id="pmF" novalidate><div class="card-head"><h3>${id ? 'Sửa chương trình' : 'Thêm chương trình khuyến mãi'}</h3>${closeBtn}</div>
      <div class="form-grid mt-1">
        <div class="field full"><label for="pmT">Tên chương trình</label><input class="input" id="pmT" maxlength="80" value="${esc(p.title || '')}" placeholder="Ví dụ: Mừng khai trương giảm 10%"></div>
        <div class="field full"><label for="pmD">Nội dung</label><textarea class="input" id="pmD" rows="4" maxlength="1500" placeholder="Ưu đãi gì, áp dụng cho sản phẩm nào, cách nhận">${esc(p.desc || '')}</textarea></div>
        <div class="field"><label for="pmS">Bắt đầu</label><input class="input" id="pmS" type="date" value="${esc(p.start || PSQ.today())}"></div>
        <div class="field"><label for="pmE">Kết thúc (để trống là không hạn)</label><input class="input" id="pmE" type="date" value="${esc(p.end || '')}"></div>
        <div class="field"><label for="pmC">Mã khuyến mãi (để trống nếu không kèm mã)</label><input class="input" id="pmC" maxlength="20" value="${esc(p.code || '')}" placeholder="Ví dụ KHAITRUONG" style="text-transform:uppercase"></div>
        <div class="field"><label for="pmTy">Loại giảm</label><select class="input" id="pmTy"><option value="pct"${p.type === 'pct' ? ' selected' : ''}>Giảm %</option><option value="amt"${p.type === 'amt' ? ' selected' : ''}>Giảm số tiền</option></select></div>
        <div class="field"><label for="pmV">Mức giảm (% hoặc đồng)</label><input class="input" id="pmV" type="number" min="0" value="${+p.value || 0}"></div>
        <div class="field"><label for="pmX">Giảm tối đa (đồng, 0 là không giới hạn)</label><input class="input" id="pmX" type="number" min="0" step="1000" value="${+p.maxOff || 0}"></div>
        <div class="field"><label for="pmM">Đơn tối thiểu (đồng)</label><input class="input" id="pmM" type="number" min="0" step="1000" value="${+p.minOrder || 0}"></div>
        <div class="field"><label for="pmL">Tổng số lượt (0 là không giới hạn)</label><input class="input" id="pmL" type="number" min="0" value="${+p.limit || 0}"></div>
        <div class="field"><label for="pmK">Nút Mua ngay dẫn tới</label><input class="input" id="pmK" maxlength="200" value="${esc(p.link || '')}" placeholder="Để trống là trang Sản phẩm"></div>
        <div class="field"><label for="pmCo">Màu thẻ</label><input id="pmCo" type="color" value="${esc(p.color || '#ff9a3d')}" style="width:52px;height:38px;padding:0;border:0;background:none"></div>
        <label class="check full"><input type="checkbox" id="pmA"${p.active !== false ? ' checked' : ''}> Bật chương trình (tắt thì ẩn khỏi trang và mã không dùng được)</label>
      </div>
      <p class="red mt-1" id="pmErr" style="font-size:13px;min-height:1em"></p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">${icon('check')} Lưu</button></div></form>`);
    const q = s => md.el.querySelector(s), errEl = q('#pmErr');
    q('#pmF').addEventListener('submit', e => {
      e.preventDefault();
      const v = { title: q('#pmT').value.trim(), desc: q('#pmD').value.trim(), start: q('#pmS').value, end: q('#pmE').value, code: q('#pmC').value.trim().toUpperCase().replace(/\s+/g, ''), type: q('#pmTy').value, value: Math.max(0, +q('#pmV').value || 0), maxOff: Math.max(0, +q('#pmX').value || 0), minOrder: Math.max(0, +q('#pmM').value || 0), limit: Math.max(0, Math.round(+q('#pmL').value || 0)), link: q('#pmK').value.trim(), color: q('#pmCo').value, active: q('#pmA').checked };
      if (v.title.length < 3) return errEl.textContent = 'Nhập tên chương trình.';
      if (v.end && v.start && v.end < v.start) return errEl.textContent = 'Ngày kết thúc phải sau ngày bắt đầu.';
      if (v.code && !/^[A-Z0-9_-]{3,20}$/.test(v.code)) return errEl.textContent = 'Mã từ 3 đến 20 ký tự, chỉ gồm chữ không dấu, số, gạch ngang.';
      if (v.code && v.type === 'pct' && !(v.value > 0 && v.value <= 100)) return errEl.textContent = 'Mức giảm % từ 1 đến 100.';
      if (v.code && v.type === 'amt' && !(v.value > 0)) return errEl.textContent = 'Nhập số tiền giảm.';
      if (v.link && !/^(https?:\/\/|[a-z0-9-]+\.html)/i.test(v.link)) return errEl.textContent = 'Đường dẫn bắt đầu bằng https:// hoặc tên trang, ví dụ san-pham.html.';
      const dd = ADB.load(); dd.promos = dd.promos || [];
      if (v.code && (dd.promos.some(x => x.id !== id && String(x.code || '').toUpperCase() === v.code) || (dd.coupons || []).some(x => x.code === v.code))) return errEl.textContent = 'Mã này đã có, anh chị đặt mã khác.';
      let p2 = dd.promos.find(x => x.id === id);
      if (p2) Object.assign(p2, v); else { p2 = Object.assign({ id: ADB.uid('km'), used: 0, uses: [], created: PSQ.today() }, v); dd.promos.unshift(p2); }
      ADB.log(dd, id ? 'Sửa chương trình khuyến mãi' : 'Thêm chương trình khuyến mãi', `${v.title}${v.code ? ', mã ' + v.code : ''}, ${v.start || 'ngay'} đến ${v.end || 'không hạn'}${v.active ? '' : ' (tắt)'}`);
      ADB.save(dd); md.close(); toast('Đã lưu chương trình'); render(el);
    });
  }
  ADMIN_MODULES.promos = { render };
})();
