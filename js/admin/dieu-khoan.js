/* Quản trị: Điều khoản sử dụng hiện ở form đăng ký thành viên.
   Lưu trên trình duyệt (psq_terms_v1); mặc định là window.TERMS_DEFAULT trong js/data.js. */
(function () {
  const { $, esc, icon, toast } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const KEY = 'psq_terms_v1';
  const TOKENS = [['{gia_goi}', 'Giá gói CTV'], ['{diem_goi}', 'Điểm nhận khi kích hoạt'], ['{moc_dai_ly}', 'Mốc lên đại lý'], ['{hh_ctv}', '% hoa hồng CTV'], ['{hh_daily}', '% hoa hồng đại lý'], ['{thu_nhap_ctv}', '% CTV từ tuyến dưới'], ['{thu_nhap_daily}', '% thu nhập từ đại lý tuyến dưới'], ['{so_ngay}', 'Số ngày xét điều kiện'], ['{thue}', '% thuế'], ['{rut_toi_thieu}', 'Rút tối thiểu'], ['{ten}', 'Tên cửa hàng'], ['{hotline}', 'Hotline'], ['{email}', 'Email'], ['{gia_goi_dl}', 'Giá gói đại lý'], ['{diem_goi_dl}', 'Điểm gói đại lý']];

  if (!document.getElementById('adm-css-dieu-khoan')) {
    const st = document.createElement('style'); st.id = 'adm-css-dieu-khoan';
    st.textContent = `
      .dk-list { display: grid; gap: 12px; }
      .dk-item { padding: 14px; border-radius: 14px; border: 1px solid var(--line); background: rgba(0,0,0,.2); display: grid; gap: 8px; }
      .dk-top { display: flex; gap: 8px; align-items: center; }
      .dk-top .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 700; font-size: 13px; color: var(--gold); background: rgba(243,199,107,.1); flex: none; }
      .dk-top input { flex: 1; min-width: 0; }
      .dk-item textarea { min-height: 110px; font-size: 13.5px; line-height: 1.55; }
      .dk-acts { display: flex; gap: 4px; flex: none; }
      .dk-acts .btn[disabled] { opacity: .35; pointer-events: none; }
      .dk-up svg { transform: rotate(-90deg); } .dk-down svg { transform: rotate(90deg); }
      .dk-tok { display: flex; flex-wrap: wrap; gap: 6px; }
      .dk-tok button { font-size: 12px; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--line-2); background: rgba(0,0,0,.25); color: var(--text-2); cursor: pointer; }
      .dk-tok button b { color: var(--gold); font-weight: 600; }
      @media (max-width: 640px) { .dk-top { flex-wrap: wrap; } .dk-top input { flex-basis: calc(100% - 40px); } .dk-acts { margin-left: auto; } }`;
    document.head.appendChild(st);
  }

  const load = () => (window.TERMS || window.TERMS_DEFAULT || []).map(x => ({ t: x.t || '', b: x.b || '' }));
  let list = null, lastTA = null;

  function save(L, msg) {
    try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { toast('Bộ nhớ trình duyệt đã đầy', 'err'); return false; }
    window.TERMS = L.map(x => ({ ...x }));
    const d = ADB.load(); ADB.log(d, 'Sửa điều khoản', msg); ADB.save(d); return true;
  }
  // đọc lại các ô đang gõ vào list trước khi thêm, xóa, đổi thứ tự
  function sync(el) { el.querySelectorAll('.dk-item').forEach((it, i) => { list[i] = { t: it.querySelector('[data-t]').value, b: it.querySelector('[data-b]').value }; }); }

  function render(el) {
    const edit = ADMIN.can('content'), dis = edit ? '' : ' disabled';
    el.innerHTML = `<div class="card glow-gold">
      <div class="card-head"><div><h3>Điều khoản sử dụng</h3><div class="sub">Hiện trong khung cuộn ở form đăng ký thành viên. Khách phải cuộn đọc hết mới tích được ô đồng ý.</div></div>
        <a class="card-link" href="thanh-vien.html?dang-ky=1" target="_blank" rel="noopener">Xem form đăng ký ${icon('arrow')}</a></div>
      <p class="dim" style="font-size:12.5px;margin:0 0 8px">Mỗi dòng xuống hàng là một đoạn. Bấm vào chữ dưới đây để chèn số liệu tự cập nhật theo Thiết lập vào chỗ đang gõ:</p>
      <div class="dk-tok">${TOKENS.map(([k, l]) => `<button type="button" data-tok="${k}" title="${esc(l)}"><b>${k}</b> ${esc(l)}</button>`).join('')}</div>
      <div class="dk-list mt-2">${list.map((x, i) => `<div class="dk-item">
        <div class="dk-top"><span class="n">${i + 1}</span><input class="input" data-t value="${esc(x.t)}" placeholder="Tiêu đề mục" maxlength="120"${dis}>
          ${edit ? `<div class="dk-acts"><button class="btn btn-ghost btn-sm dk-up" type="button" data-dk="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Lên">${icon('arrow')}</button><button class="btn btn-ghost btn-sm dk-down" type="button" data-dk="down" data-i="${i}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Xuống">${icon('arrow')}</button><button class="btn btn-ghost btn-sm" type="button" data-dk="del" data-i="${i}" aria-label="Xóa mục">${icon('trash')}</button></div>` : ''}</div>
        <textarea class="input" data-b rows="5" placeholder="Nội dung"${dis}>${esc(x.b)}</textarea></div>`).join('')}</div>
      ${edit ? `<div class="row mt-2" style="gap:8px;flex-wrap:wrap"><button class="btn btn-sm" type="button" data-dk="add">${icon('plus')} Thêm mục</button><button class="btn btn-ghost btn-sm" type="button" data-dk="reset">Khôi phục bản mặc định</button>
        <button class="btn btn-gold" type="button" data-dk="save" style="margin-left:auto">${icon('check')} Lưu điều khoản</button></div>` : '<p class="dim mt-2" style="font-size:13px">Vai trò của anh chị chỉ được xem.</p>'}
      <p class="dim mt-2" style="font-size:12px">Bản mặc định do hệ thống soạn sẵn để chạy thử. Nên nhờ luật sư xem lại trước khi chạy chính thức.</p></div>`;
    el.querySelectorAll('textarea, [data-t]').forEach(n => n.addEventListener('focus', () => { lastTA = n; }));
  }

  ADMIN_MODULES.terms = {
    render(el) {
      list = load(); render(el);
      if (el.dataset.dkBound) return; el.dataset.dkBound = '1';
      el.addEventListener('click', e => {
        const tk = e.target.closest('[data-tok]');
        if (tk) { const n = lastTA && el.contains(lastTA) ? lastTA : el.querySelector('textarea'); if (!n || n.disabled) return; const a = n.selectionStart ?? n.value.length, b = n.selectionEnd ?? a; n.value = n.value.slice(0, a) + tk.dataset.tok + n.value.slice(b); n.focus(); n.selectionStart = n.selectionEnd = a + tk.dataset.tok.length; return; }
        const b = e.target.closest('[data-dk]'); if (!b || !ADMIN.can('content')) return;
        const act = b.dataset.dk, i = +b.dataset.i; sync(el);
        if (act === 'add') { list.push({ t: '', b: '' }); render(el); const its = el.querySelectorAll('.dk-item'); its[its.length - 1].querySelector('[data-t]').focus(); return; }
        if (act === 'up' || act === 'down') { const j = i + (act === 'up' ? -1 : 1); [list[i], list[j]] = [list[j], list[i]]; render(el); return; }
        if (act === 'del') { if (!confirm(`Xóa mục "${list[i].t || i + 1}"?`)) return; list.splice(i, 1); render(el); return; }
        if (act === 'reset') { if (!confirm('Khôi phục điều khoản về bản mặc định? Nội dung đang sửa sẽ mất.')) return; list = window.TERMS_DEFAULT.map(x => ({ ...x })); try { localStorage.removeItem(KEY); } catch (er) {} window.TERMS = list.map(x => ({ ...x })); const d = ADB.load(); ADB.log(d, 'Sửa điều khoản', 'Khôi phục bản mặc định'); ADB.save(d); render(el); toast('Đã khôi phục điều khoản mặc định'); return; }
        if (act === 'save') {
          const L = list.map(x => ({ t: x.t.trim(), b: x.b.trim() })).filter(x => x.t || x.b);
          if (!L.length) return toast('Điều khoản cần ít nhất một mục.', 'err');
          if (L.some(x => !x.b)) return toast('Có mục chưa có nội dung.', 'err');
          if (save(L, `${L.length} mục`)) { list = L; render(el); toast('Đã lưu điều khoản'); }
        }
      });
    }
  };
})();
