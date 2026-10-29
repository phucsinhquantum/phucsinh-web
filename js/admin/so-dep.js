/* Quản trị: kho số đẹp (mã PS giữ lại, không cấp tự động) và đổi mã PS cho thành viên.
   Mã cũ của người đổi vẫn dùng được cho link giới thiệu, đăng nhập (máy chủ giữ trong u.oldCodes). */
(function () {
  const { $, esc, icon, toast, modal, money } = PSQ;
  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const norm = v => String(v || '').toUpperCase().replace(/\s/g, '').replace(/^(\d)/, 'PS$1');
  const list = () => ((ADB.load().settings || {}).codeReserve || []).map(x => typeof x === 'string' ? { code: x } : x);
  const ownerOf = (d, k) => d.users.find(u => (u.code || '').toUpperCase() === k || (u.oldCodes || []).some(x => x.toUpperCase() === k) || (u.username || '').toUpperCase() === k);

  // kho số đẹp: thêm số giữ lại kèm giá, bỏ số; nếu mở từ 1 thành viên thì bấm số để cấp cho người đó
  function store(forUser, done) {
    const m = modal(`<div class="row"><h3>${forUser ? 'Đổi mã PS cho ' + esc(forUser.name) : 'Kho số đẹp'}</h3>${closeBtn}</div>
      ${forUser ? `<p class="mt-1">Mã hiện tại <b class="cyan">${esc(forUser.code || '')}</b>${(forUser.oldCodes || []).length ? ` <span class="dim">(mã cũ: ${forUser.oldCodes.map(esc).join(', ')})</span>` : ''}. Gõ số mới hoặc bấm một số trong kho. Mã cũ vẫn dùng được cho link giới thiệu đã gửi.</p>
      <form class="row mt-2" id="sdSet" style="gap:8px"><input class="input" id="sdNew" placeholder="Ví dụ PS8888" style="flex:1;text-transform:uppercase" autocomplete="off"><button class="btn btn-gold" type="submit">Đổi mã</button></form>
      <small class="dim" id="sdHint" style="display:block;min-height:18px;margin-top:4px"></small>`
      : `<p class="dim mt-1" style="font-size:13px">Số trong kho được giữ lại: người đăng ký mới không bị cấp các số này. Anh chị đổi mã cho thành viên ở nút sửa trong danh sách thành viên.</p>
      <form class="form-grid mt-2" id="sdAdd"><div class="field full"><label>Các số muốn giữ (cách nhau dấu phẩy)</label><input class="input" id="sdCodes" placeholder="PS8888, PS6868, PS168168" style="text-transform:uppercase"></div>
        <div class="field"><label>Giá bán (để trống nếu chưa bán)</label><input class="input" id="sdPrice" type="number" min="0" step="100000"></div>
        <div class="field"><label>Ghi chú</label><input class="input" id="sdNote" maxlength="100" placeholder="Ví dụ: giữ cho anh Hà"></div>
        <div class="field full"><button class="btn btn-gold" type="submit">${icon('plus')} Thêm vào kho</button></div></form>`}
      <div class="mt-3" id="sdList" style="max-height:46vh;overflow:auto"></div>`);
    const draw = () => {
      const L = list();
      $('#sdList', m.el).innerHTML = L.length ? `<table class="tbl" style="min-width:0;width:100%"><thead><tr><th>Số</th><th>Giá</th><th>Ghi chú</th><th></th></tr></thead><tbody>${L.map(x => `<tr><td><b class="cyan">${esc(x.code)}</b></td><td>${x.price ? money(x.price) : '<span class="dim">-</span>'}</td><td class="dim">${esc(x.note || '')}</td>
        <td class="nowrap" style="text-align:right">${forUser ? `<button class="btn btn-sm btn-gold" type="button" data-use="${esc(x.code)}">Cấp số này</button>` : `<button class="btn btn-sm btn-ghost" type="button" data-rm="${esc(x.code)}" aria-label="Bỏ ${esc(x.code)}">${icon('trash')}</button>`}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">${icon('gem')}Kho số đẹp đang trống.</div>`;
    };
    const assign = k => {
      if (!confirm(`Đổi mã của ${forUser.name} từ ${forUser.code} sang ${k}? Mã ${forUser.code} vẫn giữ làm mã phụ, link cũ vẫn đúng người.`)) return;
      const r = API.act('memberCode', { id: forUser.id, code: k }); if (r.error) return toast(r.error, 'err');
      API.load(); m.close(); toast(`Đã đổi mã ${forUser.name} sang ${k}`);
      // đại lý uy tín đang gắn mã cũ thì chuyển sang mã mới
      try { const D = PSQ.dealers.all(), hit = D.filter(x => (x.code || '').toUpperCase() === (r.old || '').toUpperCase()); if (hit.length) { hit.forEach(x => { x.code = k; }); localStorage.setItem('psq_dealers_v1', JSON.stringify(D)); } } catch (e) {}
      done && done();
    };
    if (forUser) {
      const inp = $('#sdNew', m.el), hint = $('#sdHint', m.el);
      inp.addEventListener('input', () => { const k = norm(inp.value), d = ADB.load(), o = k.length > 4 && ownerOf(d, k);
        hint.style.color = o ? 'var(--red)' : ''; hint.textContent = !k ? '' : !/^PS\d{3,9}$/.test(k) ? 'Mã gồm PS và 3 đến 9 chữ số.' : o ? `${k} đã thuộc ${o.name}` : list().some(x => x.code === k) ? 'Số này đang trong kho số đẹp.' : 'Số này còn trống.'; });
      $('#sdSet', m.el).addEventListener('submit', e => { e.preventDefault(); assign(norm(inp.value)); });
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-use]'); if (b) assign(b.dataset.use); });
    } else {
      $('#sdAdd', m.el).addEventListener('submit', e => {
        e.preventDefault(); const codes = $('#sdCodes', m.el).value.split(/[,;\s]+/).map(norm).filter(Boolean);
        if (!codes.length) return toast('Anh chị nhập ít nhất một số.', 'err');
        const r = API.act('codeReserve', { codes, price: $('#sdPrice', m.el).value, note: $('#sdNote', m.el).value.trim() }); if (r.error) return toast(r.error, 'err');
        API.load(); $('#sdCodes', m.el).value = ''; draw();
        toast((r.added.length ? `Đã giữ ${r.added.join(', ')}` : 'Không thêm số nào') + (r.used.length ? `. Đã có người dùng: ${r.used.join(', ')}` : ''), r.added.length ? undefined : 'err');
      });
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b || !confirm(`Bỏ ${b.dataset.rm} khỏi kho? Số này có thể được cấp cho người đăng ký mới.`)) return;
        const r = API.act('codeReserve', { codes: [b.dataset.rm], remove: true }); if (r.error) return toast(r.error, 'err'); API.load(); draw(); });
    }
    draw();
  }
  window.codeStore = store;
})();

/* Đổi người giới thiệu (tuyến trên) của thành viên: chọn từ đại lý đang có (hoặc CTV, hoặc công ty).
   Hoa hồng đã ghi giữ nguyên; đơn sau tính cho người giới thiệu mới. */
(function () {
  const { $, esc, icon, toast, modal } = PSQ;
  window.sponsorPick = function (u, done) {
    const d = ADB.load(), cur = u.sponsor && d.users.find(x => x.id === u.sponsor);
    const down = new Set([u.id]); let grew = true; while (grew) { grew = false; d.users.forEach(x => { if (x.sponsor && down.has(x.sponsor) && !down.has(x.id)) { down.add(x.id); grew = true; } }); }
    const all = d.users.filter(x => x.role !== 'admin' && x.code && x.status !== 'locked' && x.verified !== false && !down.has(x.id) && x.id !== u.sponsor);
    let ctv = false, f = '';
    const m = modal(`<div class="row"><h3>Đổi người giới thiệu cho ${esc(u.name)}</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <p class="mt-1">Hiện tại: <b>${cur ? esc(cur.name) + ' <span class="cyan">' + esc(cur.code) + '</span>' : 'Công ty'}</b>. Bấm chọn người mới. Hoa hồng đã ghi giữ nguyên, các đơn sau tính cho người mới.</p>
      <div class="row wrap mt-2" style="gap:10px"><input class="input" id="spQ" type="search" placeholder="Tìm tên, mã, số điện thoại" style="flex:1 1 200px;height:40px"><label class="check"><input type="checkbox" id="spCtv"> Hiện cả CTV</label></div>
      <div id="spL" class="mt-2" style="max-height:50vh;overflow:auto;border:1px solid var(--line);border-radius:12px"></div>`);
    const draw = () => {
      const L = all.filter(x => (ctv || f ? x.tier === 'daily' || x.tier === 'ctv' : x.tier === 'daily') && (!f || PSQ.fold([x.name, x.code, x.phone, ...(x.oldCodes || [])].join(' ')).includes(f)));
      $('#spL', m.el).innerHTML = (u.sponsor ? `<button class="btn btn-ghost btn-block" type="button" data-sp="" style="justify-content:flex-start;border-radius:0;border-bottom:1px solid var(--line)">${icon('home')} Chuyển về Công ty (không có tuyến trên)</button>` : '')
        + (L.length ? L.map(x => `<button class="btn btn-ghost btn-block" type="button" data-sp="${esc(x.code)}" style="justify-content:flex-start;text-align:left;border-radius:0;border-bottom:1px solid var(--line);height:auto;padding:10px 12px"><span><b>${esc(x.name)}</b> <span class="cyan">${esc(x.code)}</span><br><small class="dim">${x.tier === 'daily' ? 'Đại lý' : 'CTV'}${x.phone ? ' · ' + esc(x.phone) : ''}</small></span></button>`).join('')
        : `<div class="empty" style="padding:20px">Không có ai khớp.</div>`);
    };
    $('#spQ', m.el).addEventListener('input', e => { f = PSQ.fold(e.target.value.trim()); draw(); });
    $('#spCtv', m.el).addEventListener('change', e => { ctv = e.target.checked; draw(); });
    $('#spL', m.el).addEventListener('click', e => {
      const b = e.target.closest('[data-sp]'); if (!b) return;
      const to = b.dataset.sp ? all.find(x => x.code === b.dataset.sp) : null;
      if (!confirm(`Chuyển ${u.name} sang ${to ? to.name + ' (' + to.code + ')' : 'Công ty'}? Hoa hồng đã ghi giữ nguyên, các đơn sau tính cho người mới.`)) return;
      const r = API.act('memberSponsor', { id: u.id, code: b.dataset.sp }); if (r.error) return toast(r.error, 'err');
      API.load(); m.close(); toast(`Đã chuyển ${u.name} sang ${to ? to.name : 'Công ty'}`); done && done();
    });
    draw();
  };
})();
