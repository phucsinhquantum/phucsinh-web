/* Quản trị: quyền lợi Khách hàng, Cộng tác viên, Đại lý và gói đại lý.
   Lưu trên trình duyệt (psq_perks_v1); mặc định là window.PERKS_DEFAULT trong js/data.js. */
(function () {
  const { esc, icon, toast } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const KEY = 'psq_perks_v1';
  const GROUPS = [
    ['khach', 'Khách hàng', 'Hiện ở form đăng ký.'],
    ['ctv', 'Cộng tác viên', 'Hiện ở form đăng ký và lộ trình cấp bậc trong trang Thành viên.'],
    ['ctvFee', 'Phí nền tảng của gói CTV gồm', 'Hiện dưới ô "Phí nền tảng" ở trang Kích hoạt cộng tác viên.'],
    ['daily', 'Đại lý', 'Hiện ở form đăng ký, lộ trình cấp bậc và trang Đăng ký đại lý.'],
    ['dailyPkg', 'Gói đại lý', 'Hiện ở trang Đăng ký đại lý (khi bật gói đại lý trong Thiết lập).']
  ];
  const TOK = [['{diem_goi}', 'Điểm gói CTV'], ['{gia_goi}', 'Giá gói CTV'], ['{phi_goi}', 'Phí nền tảng'], ['{thuong_gt}', 'Thưởng giới thiệu'], ['{hh_ctv}', '% CTV'], ['{hh_daily}', '% đại lý'], ['{thu_nhap_daily}', '% từ đại lý tuyến dưới'], ['{moc_dai_ly}', 'Mốc lên đại lý'], ['{gia_goi_dl}', 'Giá gói đại lý'], ['{diem_goi_dl}', 'Điểm gói đại lý']];
  let last = null;

  ADMIN_MODULES.perks = {
    render(el) {
      const edit = ADMIN.can('content'), dis = edit ? '' : ' disabled', P = window.PERKS, V = ADB.planVars(ADB.load());
      el.innerHTML = `<div class="card glow-gold">
        <div class="card-head"><div><h3>Quyền lợi Cộng tác viên, Đại lý</h3><div class="sub">Mỗi dòng là một quyền lợi. Giá gói, % hoa hồng sửa ở Thiết lập hệ thống và tự cập nhật qua các chữ {…}.</div></div>
          <a class="card-link" href="thanh-vien.html?dang-ky=1" target="_blank" rel="noopener">Xem form đăng ký ${icon('arrow')}</a></div>
        <div class="dk-tok">${TOK.map(([k, l]) => `<button type="button" data-tok="${k}" title="${esc(l)}: ${esc(String(V[k.slice(1, -1)]))}"><b>${k}</b> ${esc(l)}</button>`).join('')}</div>
        <div class="grid g-2 mt-2" style="gap:14px">${GROUPS.map(([k, l, h]) => `<div class="dk-item"><b>${esc(l)}</b><small class="dim" style="font-size:12px">${esc(h)}</small>
          <textarea class="input" data-k="${k}" rows="8"${dis}>${esc((P[k] || []).join('\n'))}</textarea>
          <small class="dim" style="font-size:12px">Xem trước: ${(P[k] || []).map(x => ADB.fill(x, V)).join(' · ') || 'chưa có'}</small></div>`).join('')}</div>
        ${edit ? `<div class="row mt-2" style="gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-pk="reset">Khôi phục mặc định</button><button class="btn btn-gold" type="button" data-pk="save" style="margin-left:auto">${icon('check')} Lưu quyền lợi</button></div>` : ''}
        <p class="dim mt-2" style="font-size:12px">Chỉ ghi quyền lợi công ty thực sự cung cấp. Không hứa hẹn mức thu nhập cố định, không nói công dụng chữa bệnh.</p></div>`;
      el.querySelectorAll('textarea').forEach(n => n.addEventListener('focus', () => { last = n; }));
      if (el.dataset.pkBound) return; el.dataset.pkBound = '1';
      el.addEventListener('click', e => {
        const tk = e.target.closest('[data-tok]');
        if (tk) { const n = last && el.contains(last) ? last : el.querySelector('textarea'); if (!n || n.disabled) return; const a = n.selectionStart ?? n.value.length, b = n.selectionEnd ?? a; n.value = n.value.slice(0, a) + tk.dataset.tok + n.value.slice(b); n.focus(); n.selectionStart = n.selectionEnd = a + tk.dataset.tok.length; return; }
        const b = e.target.closest('[data-pk]'); if (!b || !ADMIN.can('content')) return;
        if (b.dataset.pk === 'reset') {
          if (!confirm('Khôi phục quyền lợi về nội dung mặc định?')) return;
          try { localStorage.removeItem(KEY); } catch (er) {}
          Object.keys(PERKS_DEFAULT).forEach(k => { PERKS[k] = PERKS_DEFAULT[k].slice(); });
          const d = ADB.load(); ADB.log(d, 'Sửa quyền lợi', 'Khôi phục mặc định'); ADB.save(d); this.render(el); toast('Đã khôi phục quyền lợi mặc định'); return;
        }
        const v = {}; el.querySelectorAll('textarea[data-k]').forEach(n => { v[n.dataset.k] = n.value.split('\n').map(x => x.trim()).filter(Boolean); });
        try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (er) { toast('Bộ nhớ trình duyệt đã đầy', 'err'); return; }
        Object.assign(PERKS, v);
        const d = ADB.load(); ADB.log(d, 'Sửa quyền lợi', GROUPS.map(([k, l]) => `${l}: ${v[k].length}`).join(', ')); ADB.save(d);
        this.render(el); toast('Đã lưu quyền lợi');
      });
    }
  };
})();
