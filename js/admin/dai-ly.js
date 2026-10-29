/* Quản trị: Đại lý uy tín (hiện ở trang chủ và dai-ly.html).
   Lưu trên trình duyệt (psq_dealers_v1) qua PSQ.dealers; mặc định là window.DEALERS trong js/data.js. */
(function () {
  const { $, esc, icon, toast, modal } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const D = PSQ.dealers;

  if (!document.getElementById('adm-css-dai-ly')) {
    const st = document.createElement('style'); st.id = 'adm-css-dai-ly';
    st.textContent = `
      [data-pane="dealers"] .tbl { min-width: 820px; } [data-pane="dealers"] .who > div { min-width: 200px; }
      .dla-ph { width: 46px; height: 46px; border-radius: 12px; flex: none; overflow: hidden; display: grid; place-items: center; font-family: var(--display); color: var(--gold); background: rgba(243,199,107,.1); border: 1px solid rgba(243,199,107,.3); }
      .dla-ph img { width: 100%; height: 100%; object-fit: cover; }
      .dla-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: nowrap; }
      .dla-acts .btn[disabled] { opacity: .35; pointer-events: none; }
      .dla-up svg { transform: rotate(-90deg); } .dla-down svg { transform: rotate(90deg); }
      .dla-photo { display: flex; gap: 14px; align-items: center; }
      .dla-photo .dla-ph { width: 84px; height: 84px; border-radius: 18px; font-size: 26px; }
      .dla-off { opacity: .55; }
      .dla-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .dla-tools .input { height: 40px; flex: 1 1 220px; width: auto; }`;
    document.head.appendChild(st);
  }

  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const ini = n => PSQ.initials(String(n || '').replace(/\(.*?\)/g, '').replace(/^Đại lý\s+/i, '')) || 'ĐL';
  const audit = (action, detail) => { const d = ADB.load(); ADB.log(d, action, detail); ADB.save(d); };
  const uid = () => 'dl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function persist(list) {
    try { localStorage.setItem('psq_dealers_v1', JSON.stringify(list)); return true; }
    catch (e) { toast('Bộ nhớ trình duyệt đã đầy, hãy dùng ảnh nhỏ hơn'); return false; }
  }
  let q = '';
  const members = () => ADB.load().users.filter(u => u.role !== 'admin' && u.code && u.status !== 'locked').sort((a, b) => (b.tier === 'daily') - (a.tier === 'daily'));
  const findCode = c => ADB.load().users.find(u => (u.code || '').toUpperCase() === c && u.role !== 'admin');

  function render(el) {
    const edit = ADMIN.can('content'), list = D.all(), shown = list.filter(x => !x.hidden).length;
    const f = PSQ.fold(q), rows = list.map((x, i) => ({ x, i })).filter(({ x }) => !f || PSQ.fold([x.name, x.code, x.area, x.address, x.phone].join(' ')).includes(f));
    el.innerHTML = `
      <div class="card glow-gold">
        <div class="card-head"><div><h3>Đại lý uy tín</h3><div class="sub">${list.length} đại lý · ${shown} đang hiện trên web. Thứ tự ở đây là thứ tự hiện ở trang chủ.</div></div>
          <a class="card-link" href="dai-ly.html" target="_blank" rel="noopener">Xem trang đại lý ${icon('arrow')}</a></div>
        <div class="dla-tools">
          <input class="input" id="dlaQ" type="search" placeholder="Tìm tên, khu vực, số điện thoại" value="${esc(q)}">
          ${edit ? `<button class="btn btn-gold btn-sm" type="button" id="dlaPickM">${icon('users')} Chọn từ thành viên</button><button class="btn btn-outline-gold btn-sm" type="button" id="dlaAdd">${icon('plus')} Thêm tay</button>` : ''}
        </div>
        <div class="table-wrap mt-2"><table class="tbl"><thead><tr><th>#</th><th>Đại lý</th><th>Mã số đại lý</th><th>Điện thoại</th><th>Hiển thị</th><th></th></tr></thead><tbody>
          ${rows.length ? rows.map(({ x, i }) => `<tr class="${x.hidden ? 'dla-off' : ''}">
            <td class="dim">${i + 1}</td>
            <td><div class="who"><span class="dla-ph">${x.photo ? `<img src="${esc(x.photo)}" alt="">` : esc(ini(x.name))}</span><div><b>${esc(x.name)}</b><small>${esc(x.address || '')}</small></div></div></td>
            <td>${x.code ? `<b class="cyan">${esc(x.code)}</b>` : '<span class="dim">Chưa có</span>'}${x.area ? `<br><small class="dim">${esc(x.area)}</small>` : ''}</td>
            <td>${esc(x.phone || '')}</td>
            <td>${x.hidden ? '<span class="badge">Đang ẩn</span>' : '<span class="badge ship">Đang hiện</span>'}</td>
            <td>${edit ? `<div class="dla-acts">
              <button class="btn btn-ghost btn-sm dla-up" type="button" data-dla="up" data-i="${i}" ${i && !q ? '' : 'disabled'} aria-label="Lên">${icon('arrow')}</button>
              <button class="btn btn-ghost btn-sm dla-down" type="button" data-dla="down" data-i="${i}" ${i < list.length - 1 && !q ? '' : 'disabled'} aria-label="Xuống">${icon('arrow')}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-dla="toggle" data-i="${i}">${x.hidden ? 'Hiện' : 'Ẩn'}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-dla="edit" data-i="${i}" aria-label="Sửa">${icon('edit')}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-dla="del" data-i="${i}" aria-label="Xóa">${icon('trash')}</button></div>` : ''}</td>
          </tr>`).join('') : `<tr><td colspan="6"><div class="empty">${icon('users')}${list.length ? 'Không có đại lý khớp từ khóa.' : 'Chưa có đại lý. Bấm Thêm đại lý để bắt đầu.'}</div></td></tr>`}
        </tbody></table></div>
      </div>`;
    $('#dlaQ').addEventListener('input', e => { q = e.target.value; const pos = e.target.selectionStart; render(el); const n = $('#dlaQ'); n.focus(); n.setSelectionRange(pos, pos); });
    if (!edit) return;
    $('#dlaAdd').addEventListener('click', () => form(el));
    $('#dlaPickM').addEventListener('click', () => pick(el));
    el.querySelector('.tbl').addEventListener('click', e => {
      const b = e.target.closest('[data-dla]'); if (!b) return;
      const L = D.all(), i = +b.dataset.i, x = L[i], act = b.dataset.dla;
      if (act === 'edit') return form(el, i);
      if (act === 'up' || act === 'down') { const j = i + (act === 'up' ? -1 : 1); [L[i], L[j]] = [L[j], L[i]]; if (persist(L)) render(el); return; }
      if (act === 'toggle') { x.hidden = !x.hidden; if (persist(L)) { audit(x.hidden ? 'Ẩn đại lý uy tín' : 'Hiện đại lý uy tín', x.name); render(el); } return; }
      if (act === 'del') { if (!confirm(`Xóa ${x.name} khỏi danh sách đại lý uy tín?`)) return; L.splice(i, 1); if (persist(L)) { audit('Xóa đại lý uy tín', x.name); render(el); toast('Đã xóa đại lý'); } }
    });
  }

  // chọn nhanh: tick các thành viên đại lý (hoặc CTV) chưa có trong danh sách, bấm Thêm là xong; thông tin lấy từ tài khoản
  function pick(el) {
    const have = new Set(D.all().map(d => (d.code || '').toUpperCase()).filter(Boolean));
    const all = members().filter(u => !have.has(u.code.toUpperCase()));
    let showCtv = false, f = '';
    const m = modal(`<div class="row"><h3>Chọn đại lý từ thành viên</h3>${closeBtn}</div>
      <p class="dim mt-1" style="font-size:13px">Tick những người muốn đưa lên mục Đại lý uy tín rồi bấm Thêm. Tên, mã, số điện thoại, khu vực lấy từ tài khoản, anh chị sửa lại sau được.</p>
      <div class="row wrap mt-2" style="gap:10px"><input class="input" id="dlpQ" type="search" placeholder="Tìm tên, mã, số điện thoại" style="flex:1 1 200px;height:40px">
        <label class="check"><input type="checkbox" id="dlpCtv"> Hiện cả CTV</label></div>
      <div class="row between mt-2"><label class="check"><input type="checkbox" id="dlpAll"> Chọn tất cả</label><span class="dim" id="dlpN" style="font-size:13px"></span></div>
      <div id="dlpL" class="mt-1" style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:12px"></div>
      <div class="row mt-3" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="button" id="dlpGo" disabled>${icon('plus')} Thêm</button></div>`);
    const chosen = new Set();
    // đang tìm thì tìm cả CTV, gõ không dấu vẫn ra
    const vis = () => all.filter(u => (showCtv || f ? u.tier === 'daily' || u.tier === 'ctv' : u.tier === 'daily') && (!f || PSQ.fold([u.name, u.code, u.phone, ...(u.oldCodes || [])].join(' ')).includes(f)));
    const draw = () => {
      const L = vis();
      $('#dlpL', m.el).innerHTML = L.length ? L.map(u => `<label class="check" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer">
        <input type="checkbox" data-c="${esc(u.code)}"${chosen.has(u.code) ? ' checked' : ''}><span style="flex:1"><b>${esc(u.name)}</b> <span class="cyan">${esc(u.code)}</span><br><small class="dim">${u.tier === 'daily' ? 'Đại lý' : 'CTV'}${u.phone ? ' · ' + esc(u.phone) : ''}${u.city ? ' · ' + esc(u.city) : ''}</small></span></label>`).join('')
        : `<div class="empty" style="padding:24px">${icon('users')}${all.length ? 'Không có ai khớp.' : 'Tất cả đại lý đã có trong danh sách.'}</div>`;
      $('#dlpAll', m.el).checked = L.length > 0 && L.every(u => chosen.has(u.code));
      $('#dlpN', m.el).textContent = chosen.size ? `Đã chọn ${chosen.size}` : `${L.length} người`;
      $('#dlpGo', m.el).disabled = !chosen.size; $('#dlpGo', m.el).innerHTML = `${icon('plus')} Thêm${chosen.size ? ' ' + chosen.size + ' đại lý' : ''}`;
    };
    $('#dlpL', m.el).addEventListener('change', e => { const c = e.target.dataset.c; if (!c) return; e.target.checked ? chosen.add(c) : chosen.delete(c); draw(); });
    $('#dlpAll', m.el).addEventListener('change', e => { vis().forEach(u => e.target.checked ? chosen.add(u.code) : chosen.delete(u.code)); draw(); });
    $('#dlpQ', m.el).addEventListener('input', e => { f = PSQ.fold(e.target.value.trim()); draw(); });
    $('#dlpCtv', m.el).addEventListener('change', e => { showCtv = e.target.checked; draw(); });
    $('#dlpGo', m.el).addEventListener('click', () => {
      const cur = D.all(), add = all.filter(u => chosen.has(u.code));
      const orders = ADB.load().orders || [];
      add.forEach(u => {   // địa chỉ, khu vực lấy từ đơn gần nhất có địa chỉ của người đó
        const o = orders.filter(x => x.userId === u.id && x.address).pop(), addr = (o && o.address) || '', area = addr.split(',').map(t => t.trim()).filter(Boolean).pop() || '';
        cur.push({ id: uid(), code: u.code, name: u.name, area, phone: u.phone || '', address: addr, map: '', note: '', photo: u.avatar || '', hidden: false });
      });
      if (!persist(cur)) return;
      audit('Thêm đại lý uy tín', add.map(u => u.name + ' (' + u.code + ')').join(', '));
      m.close(); render(el); toast(`Đã thêm ${add.length} đại lý`);
    });
    draw();
  }

  function form(el, idx) {
    const L = D.all(), x = idx != null ? L[idx] : { name: '', area: '', address: '', phone: '', map: '', note: '', photo: '' };
    let photo = x.photo || '', own = !!x.photoOwn;
    const m = modal(`<div class="row"><h3>${idx != null ? 'Sửa đại lý' : 'Thêm đại lý'}</h3>${closeBtn}</div>
      <form class="form-grid mt-2" id="dlaF" novalidate>
        <div class="field full"><label>Ảnh / logo đại lý</label><div class="dla-photo"><span class="dla-ph" id="dlaPh"></span>
          <div class="row wrap" style="gap:8px"><button class="btn btn-sm" type="button" id="dlaPick">Tải ảnh</button><button class="btn btn-ghost btn-sm" type="button" id="dlaNo">Bỏ ảnh</button></div></div>
          <span class="dim" style="font-size:12px">Ảnh được cắt vuông ở giữa. Nên dùng ảnh cửa hàng hoặc logo.</span></div>
        <div class="field full"><label for="dlaN">Tên đại lý</label><input class="input" id="dlaN" maxlength="80" required value="${esc(x.name)}" placeholder="Ví dụ: Đại lý Phúc An"></div>
        <div class="field full"><label for="dlaC">Mã số đại lý (mã giới thiệu của thành viên đại lý)</label><input class="input" id="dlaC" maxlength="20" list="dlaCodes" value="${esc(x.code || '')}" placeholder="Ví dụ: PS1012" style="text-transform:uppercase" autocomplete="off">
          <small class="dim" id="dlaCH" style="font-size:12px;min-height:16px;display:block"></small></div>
        <div class="field"><label for="dlaA">Khu vực (tỉnh, thành)</label><input class="input" id="dlaA" maxlength="60" value="${esc(x.area || '')}" placeholder="Ví dụ: Nghệ An" list="dlaAreas"></div>
        <div class="field"><label for="dlaP">Số điện thoại / Zalo</label><input class="input" id="dlaP" maxlength="20" inputmode="tel" value="${esc(x.phone || '')}" placeholder="Ví dụ: 0931 133 199"></div>
        <div class="field full"><label for="dlaD">Địa chỉ</label><input class="input" id="dlaD" maxlength="160" value="${esc(x.address || '')}" placeholder="Số nhà, đường, phường, tỉnh"></div>
        <div class="field full"><label for="dlaM">Link Google Maps (không bắt buộc)</label><input class="input" id="dlaM" maxlength="400" value="${esc(x.map || '')}" placeholder="Để trống thì nút Bản đồ tự tìm theo địa chỉ"></div>
        <div class="field full"><label for="dlaT">Giới thiệu ngắn</label><textarea class="input" id="dlaT" rows="2" maxlength="200" style="min-height:70px">${esc(x.note || '')}</textarea></div>
        <div class="field full"><label class="check"><input type="checkbox" id="dlaH" ${x.hidden ? '' : 'checked'}> Hiện trên trang web</label></div>
        <p class="err full" id="dlaE" style="color:var(--red);font-size:13px;min-height:1em;margin:0"></p>
        <div class="field full"><button class="btn btn-gold" type="submit">${icon('check')} Lưu đại lý</button></div>
      </form>
      <datalist id="dlaCodes">${members().map(u => `<option value="${esc(u.code)}">${esc(u.name)}${u.tier === 'daily' ? ' · Đại lý' : u.tier === 'ctv' ? ' · CTV' : ''}</option>`).join('')}</datalist>
      <datalist id="dlaAreas">${[...new Set(L.map(d => d.area).filter(Boolean))].map(a => `<option value="${esc(a)}">`).join('')}</datalist>`);
    const drawPh = () => { $('#dlaPh', m.el).innerHTML = photo ? `<img src="${esc(photo)}" alt="">` : esc(ini($('#dlaN', m.el).value)); $('#dlaNo', m.el).hidden = !photo; };
    const codeHint = () => {
      const c = $('#dlaC', m.el).value.trim().toUpperCase(), u = c && findCode(c), h = $('#dlaCH', m.el);
      h.style.color = ''; h.textContent = !c ? 'Khách xem trang sẽ thấy mã này và dùng để đăng ký thành viên.' : u ? `Thành viên: ${u.name}${u.tier === 'daily' ? ' (đại lý)' : u.tier === 'ctv' ? ' (CTV)' : ' (khách hàng)'}` : 'Chưa có thành viên nào dùng mã này.';
      if (c && !u) h.style.color = 'var(--red)';
      if (u && !$('#dlaP', m.el).value.trim() && u.phone) $('#dlaP', m.el).value = u.phone;
      if (u && !$('#dlaA', m.el).value.trim() && u.city) $('#dlaA', m.el).value = u.city;
    };
    codeHint(); $('#dlaC', m.el).addEventListener('input', codeHint);
    drawPh(); $('#dlaN', m.el).addEventListener('input', () => { if (!photo) drawPh(); });
    $('#dlaNo', m.el).addEventListener('click', () => { photo = ''; own = false; drawPh(); });
    $('#dlaPick', m.el).addEventListener('click', () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = () => { const file = f.files && f.files[0]; if (!file) return; if (!/^image\//.test(file.type)) return toast('Hãy chọn một file ảnh');
        squareImg(file, 320).then(src => { photo = src; own = true; drawPh(); }).catch(() => toast('Không đọc được ảnh này, thử ảnh khác (JPG hoặc PNG)')); };
      f.click();
    });
    $('#dlaF', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const v = id => $('#' + id, m.el).value.trim();
      const code = v('dlaC').toUpperCase();
      if (code && !findCode(code)) { $('#dlaE', m.el).textContent = 'Mã số đại lý chưa đúng: chưa có thành viên nào dùng mã này.'; return; }
      if (code && D.all().some((d2, j) => j !== idx && (d2.code || '').toUpperCase() === code)) { $('#dlaE', m.el).textContent = 'Mã này đã gắn với một đại lý khác trong danh sách.'; return; }
      const it = { id: x.id || uid(), code, name: v('dlaN'), area: v('dlaA'), phone: v('dlaP'), address: v('dlaD'), map: v('dlaM'), note: v('dlaT'), photo, photoOwn: own, hidden: !$('#dlaH', m.el).checked };
      if (!it.name) { $('#dlaE', m.el).textContent = 'Anh chị nhập tên đại lý.'; return; }
      if (it.phone && !/^[0-9 +.]{8,15}$/.test(it.phone)) { $('#dlaE', m.el).textContent = 'Số điện thoại chưa đúng.'; return; }
      const cur = D.all(); if (idx != null) cur[idx] = it; else cur.push(it);
      if (!persist(cur)) return;
      audit(idx != null ? 'Sửa đại lý uy tín' : 'Thêm đại lý uy tín', `${it.name}${it.area ? ' · ' + it.area : ''}`);
      m.close(); render(el); toast('Đã lưu đại lý');
    });
  }

  // cắt vuông ở giữa, thu về size px, JPEG 0,85
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

  ADMIN_MODULES.dealers = { render };
})();
