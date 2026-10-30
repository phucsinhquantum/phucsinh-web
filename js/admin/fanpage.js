/* Quản trị > Trang web > Quản trị fanpage: danh sách fanpage (An An gửi lên, thành viên tự gửi, quản trị thêm tay),
   duyệt, ẩn hiện, luôn hiện, sắp thứ tự, gắn thành viên, và điều kiện hiện trên trang chủ (fanRule). */
(function () {
  const { $, esc, icon, toast, modal } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const SRC = { anan: 'An An quản lý', member: 'Thành viên gửi', admin: 'Quản trị thêm' };
  let tab = 'all', q = '';
  function render(el) {
    const r = API.act('fanAdmin', { op: 'list' }); if (r.error) { el.innerHTML = `<div class="card noperm">${esc(r.error)}</div>`; return; }
    const R = r.rule, P = r.pages, show = P.filter(f => !f.why).length, pend = P.filter(f => f.status === 'pending').length;
    const L = P.filter(f => (tab === 'all' || (tab === 'on' ? !f.why : tab === 'pending' ? f.status === 'pending' : f.why && f.status !== 'pending')) && (!q || PSQ.fold([f.url, f.title, f.owner && f.owner.name, f.owner && f.owner.code].join(' ')).includes(q)))
      .sort((a, b) => (!!a.why - !!b.why) || (a.pos ?? 9999) - (b.pos ?? 9999) || ((b.stats || {}).d7 || 0) - ((a.stats || {}).d7 || 0));
    el.innerHTML = `<div class="card glow-gold">
      <div class="row wrap" style="gap:10px;align-items:center"><h3 style="margin-right:auto">Điều kiện hiện trên trang chủ</h3><span class="dim" style="font-size:13px">Đang hiện <b class="gold">${show}</b> / ${P.length} trang</span></div>
      <form id="frR" class="row wrap mt-2" style="gap:12px;align-items:center">
        <label class="check"><input type="checkbox" id="frM"${R.managed ? ' checked' : ''}> Chỉ hiện fanpage An An đang quản lý</label>
        <span>Ít nhất <input class="input" id="frP" type="number" min="0" max="99" value="${R.posts}" style="width:70px;height:36px;display:inline-block"> bài trong
          <select class="input" id="frD" style="width:auto;height:36px;display:inline-block"><option value="7"${R.days === 7 ? ' selected' : ''}>7 ngày gần nhất</option><option value="1"${R.days === 1 ? ' selected' : ''}>hôm nay</option></select></span>
        <button class="btn btn-sm btn-gold" type="submit">Lưu điều kiện</button></form>
      <p class="dim mt-1" style="font-size:12.5px">Ghi 0 bài nếu không cần điều kiện đăng bài. Số bài do An An đọc từ Facebook và gửi lên mỗi ngày${r.botOn ? '' : ' (cổng An An đang tắt, bật ở Thiết lập hệ thống)'}. Trang bật "Luôn hiện" thì bỏ qua điều kiện. Trang đăng nhiều xếp trước, số thứ tự anh đặt được ưu tiên hơn.</p></div>
    <div class="card glow-mix mt-3">
      <div class="toolbar"><input class="input" id="frQ" placeholder="Tìm tên trang, thành viên, mã" value="${esc(q)}">
        ${[['all', 'Tất cả', P.length], ['on', 'Đang hiện', show], ['pending', 'Chờ duyệt', pend], ['off', 'Chưa hiện', P.length - show - pend]].map(([k, n, c]) => `<button class="chip${tab === k ? ' on' : ''}" type="button" data-ftab="${k}">${n} <small>${c}</small></button>`).join('')}
        <button class="btn btn-sm btn-gold" type="button" id="frAdd" style="margin-left:auto">${icon('plus')} Thêm fanpage</button></div>
      <div class="mt-2">${L.length ? L.map(f => `<div class="row" style="gap:12px;padding:12px 4px;border-bottom:1px solid var(--line);align-items:center;flex-wrap:wrap">
        <span class="fan-ph" style="width:46px;height:46px;font-size:15px">${f.owner && f.owner.avatar ? `<img src="${esc(f.owner.avatar)}" alt="">` : esc(PSQ.initials(f.owner ? f.owner.name : (f.title || 'FP')))}<span class="fan-dot fan-${esc(f.kind)}">${PSQ.fans.ico(f.kind)}</span></span>
        <div style="flex:1 1 260px;min-width:0"><b>${esc(f.title || (f.owner && f.owner.name) || 'Fanpage')}</b> ${f.owner ? `<span class="dim">· ${esc(f.owner.name)}</span> <span class="cyan">${esc(f.owner.code)}</span>` : (f.always ? '<span class="badge">Trang công ty</span>' : '<span class="badge gold">Chưa gắn thành viên</span>')}
          <br><a href="${esc(f.url)}" target="_blank" rel="nofollow noopener noreferrer" style="font-size:12.5px;word-break:break-all">${esc(f.url)}</a>
          <br><small class="dim">${SRC[f.source] || ''}${f.managed && f.source !== 'anan' ? ' · An An quản lý' : ''}${!f.managed && f.source === 'anan' ? ' · An An không còn gửi' : ''}${f.stats && f.stats.at ? ` · ${f.stats.d7 || 0} bài 7 ngày, hôm nay ${f.stats.today || 0}` : ''}</small></div>
        <div style="flex:0 0 auto;text-align:right">${f.why ? `<span class="badge gold">${esc(f.why)}</span>` : '<span class="badge green">Đang hiện</span>'}
          <div class="row mt-1" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">
            ${f.status !== 'ok' ? `<button class="btn btn-sm btn-gold" type="button" data-fs="ok" data-id="${f.id}">Duyệt hiện</button>` : `<button class="btn btn-sm btn-ghost" type="button" data-fs="off" data-id="${f.id}">Ẩn</button>`}
            <button class="btn btn-sm btn-outline-gold" type="button" data-fe="${f.id}">${icon('edit')} Sửa</button></div></div></div>`).join('') : `<div class="empty">${icon('users')}Chưa có fanpage nào.</div>`}</div></div>`;
    const re = () => render(el);
    $('#frR', el).addEventListener('submit', e => { e.preventDefault(); const x = API.act('fanAdmin', { op: 'rule', managed: $('#frM', el).checked, posts: $('#frP', el).value, days: $('#frD', el).value }); if (x.error) return toast(x.error, 'err'); toast('Đã lưu điều kiện'); re(); });
    $('#frQ', el).addEventListener('input', e => { q = PSQ.fold(e.target.value.trim()); const p = e.target.selectionStart; re(); const n = $('#frQ', el); n.focus(); n.setSelectionRange(p, p); });
    $('#frAdd', el).addEventListener('click', () => edit(null, re));
    el.querySelectorAll('[data-ftab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.ftab; re(); }));
    el.querySelectorAll('[data-fs]').forEach(b => b.addEventListener('click', () => { const x = API.act('fanAdmin', { id: b.dataset.id, status: b.dataset.fs }); if (x.error) return toast(x.error, 'err'); toast(b.dataset.fs === 'ok' ? 'Đã duyệt' : 'Đã ẩn'); re(); }));
    el.querySelectorAll('[data-fe]').forEach(b => b.addEventListener('click', () => edit(P.find(f => f.id === b.dataset.fe), re)));
  }
  function edit(f, done) {
    const m = modal(`<div class="row"><h3>${f ? 'Sửa fanpage' : 'Thêm fanpage'}</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <form id="feF" class="form-grid mt-2">
        <div class="field full"><label>Link fanpage</label><input class="input" id="feU" type="url" required value="${esc(f ? f.url : '')}" placeholder="https://www.facebook.com/..."></div>
        <div class="field"><label>Mã thành viên chủ trang</label><input class="input" id="feC" value="${esc(f && f.owner ? f.owner.code : '')}" placeholder="PS1001" style="text-transform:uppercase"><small class="dim" id="feN" style="display:block;min-height:16px"></small></div>
        <div class="field"><label>Tên trang</label><input class="input" id="feT" maxlength="60" value="${esc(f ? f.title || '' : '')}"></div>
        <div class="field"><label>Thứ tự (nhỏ hiện trước, để trống = theo số bài)</label><input class="input" id="feP" type="number" min="0" max="9999" value="${f && f.pos != null ? f.pos : ''}"></div>
        <div class="field"><label>Trạng thái</label><select class="input" id="feS"><option value="ok">Duyệt hiện</option><option value="off">Ẩn</option><option value="pending">Chờ duyệt</option></select></div>
        <div class="field full"><label class="check"><input type="checkbox" id="feA"${f && f.always ? ' checked' : ''}> Luôn hiện, bỏ qua điều kiện đăng bài (ví dụ fanpage công ty)</label></div>
        <p class="red full" id="feE" style="font-size:13px;min-height:18px;margin:0"></p>
        <div class="field full row" style="gap:8px">${f ? `<button class="btn btn-ghost" type="button" id="feX">${icon('trash')} Xóa khỏi danh sách</button>` : ''}<button class="btn btn-gold" type="submit" style="margin-left:auto">${icon('check')} Lưu</button></div></form>`);
    $('#feS', m.el).value = f ? f.status : 'ok';
    const who = () => { const k = $('#feC', m.el).value.trim().toUpperCase(), u = k && ADB.load().users.find(x => (x.code || '').toUpperCase() === k || (x.oldCodes || []).some(o => o.toUpperCase() === k)); $('#feN', m.el).textContent = !k ? '' : u ? u.name : 'Chưa có thành viên mã này'; };
    $('#feC', m.el).addEventListener('input', who); who();
    $('#feF', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const x = API.act('fanAdmin', { id: f ? f.id : undefined, url: $('#feU', m.el).value.trim(), code: $('#feC', m.el).value.trim(), title: $('#feT', m.el).value.trim(), pos: $('#feP', m.el).value, status: $('#feS', m.el).value, always: $('#feA', m.el).checked });
      if (x.error) return $('#feE', m.el).textContent = x.error;
      m.close(); toast('Đã lưu fanpage'); done();
    });
    const del = $('#feX', m.el); if (del) del.addEventListener('click', () => { if (!confirm('Xóa fanpage này khỏi danh sách? An An gửi lại thì trang sẽ tự có lại.')) return; const x = API.act('fanAdmin', { op: 'del', id: f.id }); if (x.error) return toast(x.error, 'err'); m.close(); toast('Đã xóa'); done(); });
  }
  ADMIN_MODULES.fanpages = { render };
})();
