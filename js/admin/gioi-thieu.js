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
            ${area('gtTM', 'Họ tên | Vai trò', D.team.map(m => `${m.name} | ${m.role}`).join('\n'), 5, 'Mỗi dòng một người. Chữ viết tắt trong vòng tròn lấy tự động từ tên.')}
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
    if (!edit) return;
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
      team: cols($('#gtTM').value, 2).map(([name, role]) => ({ name, role, initials: initials(name) }))
    };
    if (!data.about.heroTitle) { toast('Tiêu đề lớn ở đầu trang không được để trống'); $('#gtHT').focus(); return; }
    store.set(KEY, data); apply(data);
    audit('Sửa trang giới thiệu', `${data.about.story.length} đoạn câu chuyện, ${data.timeline.length} cột mốc, ${data.team.length} người trong đội ngũ`);
    render(el); toast('Đã lưu trang giới thiệu');
  }

  // cập nhật dữ liệu đang chạy để trang chủ / giới thiệu mở trong tab này thấy ngay
  function apply(data) {
    Object.assign(window.ABOUT, data.about);
    [['team', TEAM], ['timeline', TIMELINE], ['stats', STATS]].forEach(([k, arr]) => { if (Array.isArray(data[k]) && data[k].length) arr.splice(0, arr.length, ...data[k]); });
  }
  const audit = (action, detail) => { const d = ADB.load(); ADB.log(d, action, detail); ADB.save(d); };

  ADMIN_MODULES.about = { render };
})();
