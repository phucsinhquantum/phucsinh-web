/* Quản trị: sửa nội dung trang Giới thiệu (gioi-thieu.html).
   Lưu trên trình duyệt (psq_about_v1). js/data.js đọc lại khóa này để trang công khai hiện nội dung đã sửa.
   Số liệu thương hiệu dùng chung cho trang chủ và trang giới thiệu. */
(function () {
  const { $, esc, icon, toast, store } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const KEY = 'psq_about_v1';

  if (!document.getElementById('adm-css-gioi-thieu')) {
    const st = document.createElement('style'); st.id = 'adm-css-gioi-thieu';
    st.textContent = `
      .gt-sec { margin-top: 18px; }
      .gt-sec > h4 { font-size: 14px; color: var(--gold); margin: 0 0 10px; letter-spacing: .02em; }
      .gt-hint { font-size: 12px; color: var(--text-3); }
      .gt-pair { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
      .gt-pair + .gt-pair { margin-top: 8px; }
      .gt-pair textarea.input { min-height: 64px; }
      .gt-team { display: grid; gap: 10px; }
      .gt-mem { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.02); }
      .gt-ph { position: relative; width: 72px; height: 72px; border-radius: 50%; flex: none; display: grid; place-items: center; overflow: hidden; border: 1px solid rgba(243,199,107,.35); background: rgba(243,199,107,.08); color: var(--gold); font-family: var(--display); font-size: 22px; }
      .gt-ph img { width: 100%; height: 100%; object-fit: cover; }
      .gt-phb { display: grid; gap: 6px; justify-items: center; }
      .gt-phb .btn { padding: 4px 10px; font-size: 12px; min-height: 0; height: 28px; }
      .gt-mem .nd-acts { display: flex; gap: 6px; }
      .gt-up svg { transform: rotate(-90deg); } .gt-down svg { transform: rotate(90deg); }
      .gt-mem .btn[disabled] { opacity: .35; pointer-events: none; }
      @media (max-width: 699px) { .gt-mem { grid-template-columns: auto minmax(0, 1fr); } .gt-mem .gt-phb { grid-row: span 2; } .gt-mem .nd-acts { grid-column: 1 / -1; justify-content: flex-end; } }
      .gt-bar { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; padding: 12px 0 4px; background: linear-gradient(transparent, var(--bg) 40%); }
      @media (max-width: 699px) { .gt-pair { grid-template-columns: 1fr; } .gt-bar .btn { flex: 1 1 100%; } }`;
    document.head.appendChild(st);
  }

  const DEF = () => JSON.parse(JSON.stringify(window.ABOUT_DEFAULT));
  const cur = () => ({ about: JSON.parse(JSON.stringify(window.ABOUT)), team: TEAM.map(x => ({ ...x })), timeline: TIMELINE.map(x => ({ ...x })), stats: STATS.map(x => ({ ...x })) });
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const paras = s => String(s || '').split(/\n\s*\n/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const cols = (s, n) => lines(s).map(l => { const p = l.split('|').map(x => x.trim()); while (p.length < n) p.push(''); return p; });
  const initials = n => String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase() || 'PS';
  const inp = (id, label, v, full = true, max = 200) => `<div class="field${full ? ' full' : ''}"><label for="${id}">${label}</label><input class="input" id="${id}" maxlength="${max}" value="${esc(v || '')}"></div>`;
  const area = (id, label, v, rows = 5, hint = '') => `<div class="field full"><label for="${id}">${label}</label><textarea class="input" id="${id}" rows="${rows}">${esc(v || '')}</textarea>${hint ? `<span class="gt-hint">${hint}</span>` : ''}</div>`;
  const pairs = (key, list, n) => Array.from({ length: n }, (_, i) => { const v = list[i] || { t: '', d: '' }; return `<div class="gt-pair"><input class="input" data-${key}-t="${i}" maxlength="60" placeholder="Tiêu đề ${i + 1}" value="${esc(v.t)}"><textarea class="input" data-${key}-d="${i}" rows="2" placeholder="Mô tả">${esc(v.d)}</textarea></div>`; }).join('');

  function render(el) {
    const edit = ADMIN.can('content'), D = cur(), A = D.about;
    team = D.team.map(m => ({ ...m }));
    el.innerHTML = `
      <div class="card glow-gold">
        <div class="card-head"><div><h3>Trang giới thiệu</h3><div class="sub">Sửa chữ trên trang Giới thiệu. Bấm Lưu rồi mở trang để xem.</div></div><a class="card-link" href="gioi-thieu.html" target="_blank" rel="noopener">Xem trang ${icon('arrow')}</a></div>
        <form id="gtForm" novalidate>
          <fieldset ${edit ? '' : 'disabled'} style="border:0;padding:0;margin:0;min-width:0">
          <div class="gt-sec"><h4>1. Đầu trang</h4><div class="form-grid">
            ${inp('gtHE', 'Dòng nhỏ phía trên', A.heroEyebrow, false, 80)}
            ${inp('gtHI', 'Ảnh nền (đường dẫn ảnh)', A.heroImg, false, 300)}
            ${inp('gtHT', 'Tiêu đề lớn', A.heroTitle, false, 120)}
            ${inp('gtHM', 'Phần tiêu đề in nghiêng (màu vàng)', A.heroEm, false, 120)}
            ${area('gtHL', 'Đoạn mô tả', A.heroLead, 3)}
          </div></div>
          <div class="gt-sec"><h4>2. Câu chuyện thương hiệu</h4><div class="form-grid">
            ${inp('gtSE', 'Dòng nhỏ phía trên', A.storyEyebrow, false, 80)}
            ${inp('gtST', 'Tiêu đề', A.storyTitle, false, 160)}
            ${area('gtSB', 'Nội dung', (A.story || []).join('\n\n'), 10, 'Mỗi đoạn cách nhau một dòng trống.')}
          </div></div>
          <div class="gt-sec"><h4>3. Cam kết</h4><div class="form-grid">
            ${inp('gtPT', 'Tiêu đề khung cam kết', A.promiseTitle, true, 80)}
            ${area('gtPL', 'Các dòng cam kết', (A.promises || []).join('\n'), 5, 'Mỗi dòng là một cam kết.')}
          </div></div>
          <div class="gt-sec"><h4>4. Sứ mệnh và giá trị (4 ô)</h4>${pairs('v', A.values || [], 4)}</div>
          <div class="gt-sec"><h4>5. Số liệu thương hiệu (4 ô, hiện cả ở trang chủ)</h4>
            ${area('gtNS', 'Tên số liệu | Giá trị', D.stats.map(s => `${s.label} | ${s.value}`).join('\n'), 4, 'Ví dụ: Khách hàng tin dùng | 12.000+')}</div>
          <div class="gt-sec"><h4>6. Các cột mốc phát triển</h4>
            ${area('gtTL', 'Năm | Nội dung', D.timeline.map(t => `${t.year} | ${t.text}`).join('\n'), 5, 'Mỗi dòng một cột mốc, ví dụ: 2026 | Ra mắt web app thành viên.')}</div>
          <div class="gt-sec"><h4>7. Đội ngũ</h4><div class="form-grid">
            <div class="field full"><div class="gt-team" id="gtTeam"></div>
              <span class="gt-hint">Bấm "Tải ảnh" để đưa ảnh từng người lên. Ảnh được cắt vuông ở giữa và thu nhỏ, nên chọn ảnh chân dung rõ mặt. Chưa có ảnh thì hiện chữ viết tắt của tên.</span>
              ${edit ? `<div><button class="btn btn-outline-gold btn-sm" type="button" id="gtAdd">${icon('plus')} Thêm người</button></div>` : ''}</div>
            ${inp('gtTN', 'Ghi chú dưới đội ngũ (để trống nếu không cần)', A.teamNote, true, 160)}
          </div></div>
          <div class="gt-sec"><h4>8. Quy trình tuyển chọn (5 bước)</h4>${pairs('s', A.steps || [], 5)}</div>
          <div class="gt-sec"><h4>9. Khung cuối trang</h4><div class="form-grid">
            ${inp('gtCT', 'Tiêu đề', A.ctaTitle, true, 120)}
            ${area('gtCX', 'Mô tả', A.ctaText, 3)}
          </div></div>
          </fieldset>
          ${edit ? `<div class="gt-bar"><button class="btn btn-ghost" type="button" id="gtReset">Khôi phục mặc định</button><button class="btn btn-gold" type="submit">${icon('check')} Lưu trang giới thiệu</button></div>` : '<p class="gt-hint mt-2">Tài khoản của anh/chị chỉ được xem, không được sửa mục này.</p>'}
        </form>
      </div>`;
    drawTeam(edit);
    if (!edit) return;
    const T = $('#gtTeam');
    $('#gtAdd').addEventListener('click', () => { syncTeam(); team.push({ name: '', role: '', initials: '' }); drawTeam(true); const ins = T.querySelectorAll('[data-mn]'); ins[ins.length - 1].focus(); });
    T.addEventListener('click', e => {
      const b = e.target.closest('[data-tact]'); if (!b) return;
      syncTeam(); const i = +b.dataset.i, act = b.dataset.tact;
      if (act === 'photo') { pickFor(i); return; }
      if (act === 'nophoto') delete team[i].photo;
      if (act === 'up' || act === 'down') { const j = i + (act === 'up' ? -1 : 1); [team[i], team[j]] = [team[j], team[i]]; }
      if (act === 'del') { if (!confirm(`Xóa ${team[i].name || 'người này'} khỏi đội ngũ?`)) return; team.splice(i, 1); }
      drawTeam(true);
    });
    $('#gtForm').addEventListener('submit', e => { e.preventDefault(); save(el); });
    $('#gtReset').addEventListener('click', () => {
      if (!confirm('Khôi phục toàn bộ nội dung trang giới thiệu về mặc định ban đầu?')) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      apply(DEF()); audit('Khôi phục trang giới thiệu', 'Về nội dung mặc định'); render(el); toast('Đã khôi phục mặc định');
    });
  }

  function save(el) {
    const v = id => $('#' + id).value.trim();
    const grab = (k, n) => Array.from({ length: n }, (_, i) => ({ t: el.querySelector(`[data-${k}-t="${i}"]`).value.trim(), d: el.querySelector(`[data-${k}-d="${i}"]`).value.trim() })).filter(x => x.t || x.d);
    const old = cur();
    const icons = old.stats.map(s => s.icon), dIcons = ['users', 'award', 'map', 'star'];
    const data = {
      about: {
        heroEyebrow: v('gtHE'), heroImg: v('gtHI') || window.ABOUT_DEFAULT.about.heroImg, heroTitle: v('gtHT'), heroEm: v('gtHM'), heroLead: v('gtHL'),
        storyEyebrow: v('gtSE'), storyTitle: v('gtST'), story: paras($('#gtSB').value),
        promiseTitle: v('gtPT'), promises: lines($('#gtPL').value),
        values: grab('v', 4), teamNote: v('gtTN'), steps: grab('s', 5),
        ctaTitle: v('gtCT'), ctaText: v('gtCX')
      },
      stats: cols($('#gtNS').value, 2).slice(0, 4).map(([label, value], i) => ({ label, value, icon: icons[i] || dIcons[i % 4] })),
      timeline: cols($('#gtTL').value, 2).map(([year, text]) => ({ year, text })),
      team: (syncTeam(), team).filter(m => m.name || m.role || m.photo).map(m => ({ name: m.name, role: m.role, initials: initials(m.name), ...(m.photo ? { photo: m.photo } : {}) }))
    };
    if (!data.about.heroTitle) { toast('Tiêu đề lớn ở đầu trang không được để trống'); $('#gtHT').focus(); return; }
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('Bộ nhớ trình duyệt đã đầy, hãy dùng ảnh nhỏ hơn hoặc bớt ảnh'); return; }
    apply(data);
    audit('Sửa trang giới thiệu', `${data.about.story.length} đoạn câu chuyện, ${data.timeline.length} cột mốc, ${data.team.length} người trong đội ngũ`);
    render(el); toast('Đã lưu trang giới thiệu');
  }

  /* ---------- đội ngũ: danh sách có ảnh ---------- */
  let team = [];
  function drawTeam(edit) {
    const T = $('#gtTeam'); if (!T) return;
    T.innerHTML = team.length ? team.map((m, i) => `<div class="gt-mem">
      <div class="gt-phb"><span class="gt-ph">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc(initials(m.name))}</span>
        ${edit ? `<button class="btn btn-ghost" type="button" data-tact="photo" data-i="${i}">${m.photo ? 'Đổi ảnh' : 'Tải ảnh'}</button>${m.photo ? `<button class="btn btn-ghost" type="button" data-tact="nophoto" data-i="${i}">Bỏ ảnh</button>` : ''}` : ''}</div>
      <div class="field"><label>Họ tên</label><input class="input" data-mn="${i}" maxlength="60" value="${esc(m.name)}" placeholder="Ví dụ: Nguyễn Văn A"></div>
      <div class="field"><label>Vai trò</label><input class="input" data-mr="${i}" maxlength="60" value="${esc(m.role)}" placeholder="Ví dụ: Nhà sáng lập"></div>
      ${edit ? `<div class="nd-acts">
        <button class="btn btn-ghost btn-sm gt-up" type="button" data-tact="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Lên">${icon('arrow')}</button>
        <button class="btn btn-ghost btn-sm gt-down" type="button" data-tact="down" data-i="${i}" ${i < team.length - 1 ? '' : 'disabled'} aria-label="Xuống">${icon('arrow')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-tact="del" data-i="${i}" aria-label="Xóa">${icon('trash')}</button></div>` : ''}
    </div>`).join('') : '<p class="gt-hint">Chưa có ai trong đội ngũ.</p>';
  }
  function syncTeam() {
    const T = $('#gtTeam'); if (!T) return;
    team.forEach((m, i) => { const n = T.querySelector(`[data-mn="${i}"]`), r = T.querySelector(`[data-mr="${i}"]`); if (n) m.name = n.value.trim(); if (r) m.role = r.value.trim(); });
  }
  function pickFor(i) {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
    f.onchange = () => {
      const file = f.files && f.files[0]; if (!file) return;
      if (!/^image\//.test(file.type)) return toast('Hãy chọn một file ảnh');
      squareImg(file, 360).then(src => { syncTeam(); team[i].photo = src; drawTeam(true); toast('Đã gắn ảnh, bấm Lưu để cập nhật trang'); })
        .catch(() => toast('Không đọc được ảnh này, thử ảnh khác (JPG hoặc PNG)'));
    };
    f.click();
  }
  // cắt vuông ở giữa, thu về size px, JPEG 0,85 (giống ảnh đại diện thành viên)
  function squareImg(file, size) {
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

  // cập nhật dữ liệu đang chạy để trang chủ / giới thiệu mở trong tab này thấy ngay
  function apply(data) {
    Object.assign(window.ABOUT, data.about);
    [['team', TEAM], ['timeline', TIMELINE], ['stats', STATS]].forEach(([k, arr]) => { if (Array.isArray(data[k]) && data[k].length) arr.splice(0, arr.length, ...data[k]); });
  }
  const audit = (action, detail) => { const d = ADB.load(); ADB.log(d, action, detail); ADB.save(d); };

  ADMIN_MODULES.about = { render };
})();
