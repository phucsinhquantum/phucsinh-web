/* Quản trị: Khách hàng nói gì (đánh giá ở trang chủ).
   Lưu trên trình duyệt (psq_reviews_v1); mặc định là window.REVIEWS trong js/data.js. */
(function () {
  const { $, esc, icon, toast, modal } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const KEY = 'psq_reviews_v1';
  const DEF = (window.REVIEWS || []).map(r => ({ ...r }));   // bản gốc trước khi data.js lọc bài ẩn

  if (!document.getElementById('adm-css-danh-gia')) {
    const st = document.createElement('style'); st.id = 'adm-css-danh-gia';
    st.textContent = `
      [data-pane="reviews"] .tbl { min-width: 820px; } [data-pane="reviews"] td:nth-child(3) { min-width: 280px; }
      .dg-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: nowrap; }
      .dg-acts .btn[disabled] { opacity: .35; pointer-events: none; }
      .dg-up svg { transform: rotate(-90deg); } .dg-down svg { transform: rotate(90deg); }
      .dg-off { opacity: .55; }
      .dg-stars { display: flex; gap: 4px; }
      .dg-stars button { font-size: 26px; line-height: 1; background: none; border: 0; cursor: pointer; color: rgba(243,199,107,.25); padding: 0 2px; }
      .dg-stars button.on { color: var(--gold); text-shadow: 0 0 10px var(--gold-glow); }
      .dg-photo { display: flex; gap: 12px; align-items: center; }
      .dg-photo .avatar { width: 64px; height: 64px; font-size: 20px; }`;
    document.head.appendChild(st);
  }

  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const all = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch (e) {} return DEF.map(r => ({ ...r })); };
  const audit = (action, detail) => { const d = ADB.load(); ADB.log(d, action, detail); ADB.save(d); };
  const stars = n => { n = Math.min(5, Math.max(1, +n || 5)); return `<span class="gold">${'★'.repeat(n)}</span><span class="gold" style="opacity:.25">${'★'.repeat(5 - n)}</span>`; };
  const av = r => `<span class="avatar">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : esc(PSQ.initials(r.name || '?'))}</span>`;
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); }
    catch (e) { toast('Bộ nhớ trình duyệt đã đầy, hãy dùng ảnh nhỏ hơn'); return false; }
    window.REVIEWS.splice(0, window.REVIEWS.length, ...list.filter(r => !r.hidden));
    return true;
  }

  function render(el) {
    const edit = ADMIN.can('content'), list = all(), shown = list.filter(r => !r.hidden).length;
    el.innerHTML = `
      <div class="card glow-gold">
        <div class="card-head"><div><h3>Khách hàng nói gì</h3><div class="sub">${list.length} đánh giá · ${shown} đang hiện. Trang chủ hiện 3 đánh giá đầu, còn lại nằm trong nút "Xem tất cả".</div></div>
          <a class="card-link" href="index.html#reviews" target="_blank" rel="noopener">Xem trang chủ ${icon('arrow')}</a></div>
        ${edit ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-gold btn-sm" type="button" id="dgAdd">${icon('plus')} Thêm đánh giá</button></div>` : ''}
        <div class="table-wrap mt-2"><table class="tbl"><thead><tr><th>#</th><th>Khách hàng</th><th>Nội dung</th><th>Hiển thị</th><th></th></tr></thead><tbody>
          ${list.length ? list.map((r, i) => `<tr class="${r.hidden ? 'dg-off' : ''}">
            <td class="dim">${i + 1}</td>
            <td><div class="who">${av(r)}<div><b>${esc(r.name)}</b><small>${esc(r.place || '')}</small><small>${stars(r.stars)}</small></div></div></td>
            <td style="font-size:13.5px">${esc(r.text)}</td>
            <td>${r.hidden ? '<span class="badge">Đang ẩn</span>' : '<span class="badge ship">Đang hiện</span>'}</td>
            <td>${edit ? `<div class="dg-acts">
              <button class="btn btn-ghost btn-sm dg-up" type="button" data-dg="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Lên">${icon('arrow')}</button>
              <button class="btn btn-ghost btn-sm dg-down" type="button" data-dg="down" data-i="${i}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Xuống">${icon('arrow')}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-dg="toggle" data-i="${i}">${r.hidden ? 'Hiện' : 'Ẩn'}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-dg="edit" data-i="${i}" aria-label="Sửa">${icon('edit')}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-dg="del" data-i="${i}" aria-label="Xóa">${icon('trash')}</button></div>` : ''}</td>
          </tr>`).join('') : `<tr><td colspan="5"><div class="empty">${icon('chat')}Chưa có đánh giá. Bấm Thêm đánh giá để bắt đầu.</div></td></tr>`}
        </tbody></table></div>
        <p class="dim mt-2" style="font-size:12px">Chỉ đăng đánh giá thật của khách, có sự đồng ý của họ. Không đăng lời khen về công dụng chữa bệnh.</p>
      </div>`;
    if (!edit) return;
    $('#dgAdd').addEventListener('click', () => form(el));
    el.querySelector('.tbl').addEventListener('click', e => {
      const b = e.target.closest('[data-dg]'); if (!b) return;
      const L = all(), i = +b.dataset.i, r = L[i], act = b.dataset.dg;
      if (act === 'edit') return form(el, i);
      if (act === 'up' || act === 'down') { const j = i + (act === 'up' ? -1 : 1); [L[i], L[j]] = [L[j], L[i]]; if (persist(L)) render(el); return; }
      if (act === 'toggle') { r.hidden = !r.hidden; if (persist(L)) { audit(r.hidden ? 'Ẩn đánh giá' : 'Hiện đánh giá', r.name); render(el); } return; }
      if (act === 'del') { if (!confirm(`Xóa đánh giá của ${r.name}?`)) return; L.splice(i, 1); if (persist(L)) { audit('Xóa đánh giá', r.name); render(el); toast('Đã xóa đánh giá'); } }
    });
  }

  function form(el, idx) {
    const L = all(), r = idx != null ? L[idx] : { name: '', place: '', text: '', stars: 5, photo: '' };
    let photo = r.photo || '', n = Math.min(5, Math.max(1, +r.stars || 5));
    const m = modal(`<div class="row"><h3>${idx != null ? 'Sửa đánh giá' : 'Thêm đánh giá'}</h3>${closeBtn}</div>
      <form class="form-grid mt-2" id="dgF" novalidate>
        <div class="field full"><label>Ảnh khách hàng (không bắt buộc)</label><div class="dg-photo"><span id="dgPh"></span>
          <div class="row wrap" style="gap:8px"><button class="btn btn-sm" type="button" id="dgPick">Tải ảnh</button><button class="btn btn-ghost btn-sm" type="button" id="dgNo">Bỏ ảnh</button></div></div>
          <span class="dim" style="font-size:12px">Ảnh vuông, khoảng 300 × 300 px. Ảnh khác tỉ lệ được tự cắt ở giữa. Không có ảnh thì hiện chữ viết tắt của tên.</span></div>
        <div class="field"><label for="dgN">Tên khách hàng</label><input class="input" id="dgN" maxlength="60" required value="${esc(r.name)}" placeholder="Ví dụ: Chị Minh Anh"></div>
        <div class="field"><label for="dgP">Nơi ở</label><input class="input" id="dgP" maxlength="60" value="${esc(r.place || '')}" placeholder="Ví dụ: Hà Nội"></div>
        <div class="field full"><label>Số sao</label><div class="dg-stars" id="dgS">${[1, 2, 3, 4, 5].map(k => `<button type="button" data-s="${k}" aria-label="${k} sao">★</button>`).join('')}</div></div>
        <div class="field full"><label for="dgT">Nội dung đánh giá</label><textarea class="input" id="dgT" rows="4" maxlength="400" style="min-height:100px" placeholder="Khách hàng chia sẻ gì về sản phẩm, dịch vụ">${esc(r.text)}</textarea><span class="dim" id="dgC" style="font-size:12px"></span></div>
        <div class="field full"><label class="check"><input type="checkbox" id="dgH" ${r.hidden ? '' : 'checked'}> Hiện trên trang chủ</label></div>
        <p class="err full" id="dgE" style="color:var(--red);font-size:13px;min-height:1em;margin:0"></p>
        <div class="field full"><button class="btn btn-gold" type="submit">${icon('check')} Lưu đánh giá</button></div>
      </form>`);
    const drawPh = () => { $('#dgPh', m.el).innerHTML = av({ name: $('#dgN', m.el).value || '?', photo }); $('#dgNo', m.el).hidden = !photo; };
    const drawS = () => $$s('#dgS button').forEach(b => b.classList.toggle('on', +b.dataset.s <= n));
    const $$s = q => [...m.el.querySelectorAll(q)];
    const cnt = () => { $('#dgC', m.el).textContent = `${$('#dgT', m.el).value.length} / 400 ký tự`; };
    drawPh(); drawS(); cnt();
    $('#dgN', m.el).addEventListener('input', () => { if (!photo) drawPh(); });
    $('#dgT', m.el).addEventListener('input', cnt);
    $('#dgS', m.el).addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { n = +b.dataset.s; drawS(); } });
    $('#dgNo', m.el).addEventListener('click', () => { photo = ''; drawPh(); });
    $('#dgPick', m.el).addEventListener('click', () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = () => { const file = f.files && f.files[0]; if (!file) return; if (!/^image\//.test(file.type)) return toast('Hãy chọn một file ảnh');
        square(file, 300).then(src => { photo = src; drawPh(); }).catch(() => toast('Không đọc được ảnh này, thử ảnh khác (JPG hoặc PNG)')); };
      f.click();
    });
    $('#dgF', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const it = { name: $('#dgN', m.el).value.trim(), place: $('#dgP', m.el).value.trim(), text: $('#dgT', m.el).value.trim(), stars: n, hidden: !$('#dgH', m.el).checked };
      if (photo) it.photo = photo;
      if (!it.name) { $('#dgE', m.el).textContent = 'Anh chị nhập tên khách hàng.'; return; }
      if (!it.text) { $('#dgE', m.el).textContent = 'Anh chị nhập nội dung đánh giá.'; return; }
      const cur = all(); if (idx != null) cur[idx] = it; else cur.unshift(it);
      if (!persist(cur)) return;
      audit(idx != null ? 'Sửa đánh giá' : 'Thêm đánh giá', `${it.name}: ${it.stars} sao`);
      m.close(); render(el); toast('Đã lưu đánh giá');
    });
  }

  // cắt vuông ở giữa, thu về size px, JPEG 0,85
  function square(file, size) {
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight); if (!s) { URL.revokeObjectURL(url); return fail(new Error('empty')); }
        const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
        g.fillStyle = '#0e1417'; g.fillRect(0, 0, size, size); g.imageSmoothingQuality = 'high';
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('decode')); };
      img.src = url;
    });
  }

  ADMIN_MODULES.reviews = { render };
})();
