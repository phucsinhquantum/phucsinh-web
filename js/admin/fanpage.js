/* Quản trị > Thành viên > Fanpage thành viên: duyệt link thành viên gửi, ẩn/hiện, sắp thứ tự hiển thị trên trang chủ. */
(function () {
  const { $, esc, icon, toast, modal } = PSQ;
  const ST = { pending: '<span class="badge gold">Chờ duyệt</span>', ok: '<span class="badge green">Đang hiện</span>', off: '<span class="badge">Đang ẩn</span>' };
  window.fanReview = function (done) {
    let tab = 'pending';
    const m = modal(`<div class="row"><h3>Fanpage thành viên</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <p class="dim mt-1" style="font-size:13px">Thành viên gửi link ở Tài khoản > Hồ sơ. Anh chị mở link kiểm tra rồi bấm Hiện. Số thứ tự nhỏ hiện trước trên trang chủ.</p>
      <div class="row mt-2" style="gap:8px" id="fnTabs"></div><div id="fnL" class="mt-2" style="max-height:55vh;overflow:auto"></div>`);
    const draw = () => {
      const all = ADB.load().users.filter(u => u.fan && (u.fan.links || []).length), cnt = k => all.filter(u => (u.fan.status || 'pending') === k).length;
      $('#fnTabs', m.el).innerHTML = [['pending', 'Chờ duyệt'], ['ok', 'Đang hiện'], ['off', 'Đang ẩn']].map(([k, n]) => `<button class="chip${tab === k ? ' on' : ''}" type="button" data-tab="${k}">${n} <small>${cnt(k)}</small></button>`).join('');
      const L = all.filter(u => (u.fan.status || 'pending') === tab).sort((a, b) => (a.fan.pos ?? 9999) - (b.fan.pos ?? 9999) || String(a.fan.at).localeCompare(String(b.fan.at)));
      $('#fnL', m.el).innerHTML = L.length ? L.map(u => `<div class="row" style="gap:12px;padding:12px 4px;border-bottom:1px solid var(--line);align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1 1 260px;min-width:0"><b>${esc(u.name)}</b> <span class="cyan">${esc(u.code || '')}</span> ${ST[u.fan.status || 'pending']}${u.fan.title ? `<br><small>${esc(u.fan.title)}</small>` : ''}
          ${u.fan.links.map(l => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="fan-ico fan-${esc(l.kind)}" style="width:24px;height:24px;border-radius:7px">${PSQ.fans.ico(l.kind)}</span><a href="${esc(l.url)}" target="_blank" rel="nofollow noopener noreferrer" style="word-break:break-all;font-size:13px">${esc(l.url)}</a></div>`).join('')}
          <small class="dim">Gửi ${esc(u.fan.at || '')}</small></div>
        <div class="row" style="gap:6px;align-items:center"><label class="dim" style="font-size:12px">Thứ tự <input class="input" type="number" min="0" max="9999" data-pos="${u.id}" value="${u.fan.pos ?? ''}" style="width:72px;height:34px;display:inline-block"></label>
          ${u.fan.status !== 'ok' ? `<button class="btn btn-sm btn-gold" type="button" data-st="ok" data-id="${u.id}">Hiện</button>` : ''}${u.fan.status !== 'off' ? `<button class="btn btn-sm btn-ghost" type="button" data-st="off" data-id="${u.id}">Ẩn</button>` : ''}</div></div>`).join('')
        : `<div class="empty" style="padding:20px">Không có trang nào.</div>`;
    };
    const run = (args, msg) => { const r = API.act('fanReview', args); if (r.error) return toast(r.error, 'err'); API.load(); toast(msg); draw(); done && done(); };
    m.el.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
      const b = e.target.closest('[data-st]'); if (b) run({ id: b.dataset.id, status: b.dataset.st }, b.dataset.st === 'ok' ? 'Đã duyệt, trang hiện trên trang chủ' : 'Đã ẩn trang');
    });
    m.el.addEventListener('change', e => { const p = e.target.dataset && e.target.dataset.pos; if (p) run({ id: p, pos: e.target.value === '' ? 9999 : e.target.value }, 'Đã lưu thứ tự'); });
    draw();
  };
})();
