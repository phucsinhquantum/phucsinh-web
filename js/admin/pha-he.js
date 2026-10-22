/* Quản trị: phả hệ giới thiệu (sơ đồ cây, chờ lên cây, cấp bậc lãnh đạo) */
(function () {
  const { $, $$, esc, money, short, initials, fdate, today, icon, toast, modal } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const can = p => !window.ADMIN || ADMIN.can(p);

  if (!document.getElementById('adm-css-pha-he')) {
    const st = document.createElement('style'); st.id = 'adm-css-pha-he';
    st.textContent = `
    .ph-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 6px; }
    .ph-tree, .ph-tree ul { list-style: none; margin: 0; padding: 0; }
    .ph-tree { min-width: max-content; }
    .ph-tree ul { margin-left: 22px; padding-left: 16px; border-left: 1px dashed var(--line-2); }
    .ph-tree li { position: relative; padding: 5px 0; }
    .ph-tree ul > li::before { content: ''; position: absolute; left: -16px; top: 28px; width: 14px; border-top: 1px dashed var(--line-2); }
    .ph-node { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: 14px; background: var(--panel-2); border: 1px solid var(--line-2); border-left: 3px solid var(--rk, var(--line-2)); cursor: pointer; transition: border-color .2s, box-shadow .2s; }
    .ph-node:hover { box-shadow: 0 0 18px -6px var(--rk); }
    .ph-node.hit { box-shadow: 0 0 0 2px var(--gold), 0 0 22px -4px var(--gold-glow); }
    .ph-node .avatar { width: 34px; height: 34px; font-size: 12px; }
    .ph-node b { display: block; font-size: 13.5px; white-space: nowrap; }
    .ph-node small { display: block; font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
    .ph-node .ph-rk { color: var(--rk); }
    .ph-tg { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--panel); color: var(--text-2); display: inline-grid; place-items: center; font-size: 15px; line-height: 1; cursor: pointer; margin-right: 6px; vertical-align: middle; }
    .ph-tg[disabled] { opacity: .3; cursor: default; }
    .ph-crumb { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; }
    .ph-crumb button { background: none; border: 0; color: var(--cyan); cursor: pointer; padding: 2px 4px; font: inherit; }
    .ph-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .ph-kv > div { padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.03); border: 1px solid var(--line); }
    .ph-kv small { display: block; font-size: 12px; color: var(--text-3); } .ph-kv b { font-size: 14px; }
    .ph-lv { display: flex; flex-wrap: wrap; gap: 6px; }
    @media (max-width: 699px) { .ph-tree ul { margin-left: 12px; padding-left: 10px; } .ph-tree ul > li::before { left: -10px; width: 8px; } .ph-tg { margin-right: 4px; } }
    .ph-tier.sm { height: 18px; padding: 0 6px; font-size: 10.5px; vertical-align: 1px; }
    .ph-rank-in { height: 34px !important; font-size: 13px; min-width: 90px; }
    .ph-rank-in[name=name] { min-width: 160px; } .ph-rank-in[name=minSales] { min-width: 140px; }
    .ph-rank-in[type=color] { padding: 2px; width: 44px; min-width: 44px; }
    `;
    document.head.appendChild(st);
  }

  const AV = ['', 'v', 'g'];
  const members = d => d.users.filter(u => u.role !== 'admin');
  const placedList = d => members(d).filter(u => u.placed);
  const nameOf = (d, id) => { const u = id && ADB.user(d, id); return u ? `${u.name} (${u.code || ''})` : 'Không có'; };
  const who = (u, i) => `<div class="who"><span class="avatar ${AV[i % 3]}">${esc(initials(u.name))}</span><div><b>${esc(u.name)}</b><small>${esc(u.code || '')} · ${esc(u.phone || u.email || '')}</small></div></div>`;
  const tierBadge = (u, sm) => { const k = ADB.tierOf(u); return `<span class="badge ph-tier${sm ? ' sm' : ''}" style="color:${k.color};border:1px solid ${k.color}55;background:${k.color}14">${esc(k.name)}</span>`; };
  const rankBadge = r => `<span class="badge" style="color:${esc(r.color)};border:1px solid ${esc(r.color)}55;background:${esc(r.color)}1a">${esc(r.name)}</span>`;

  /* ---------- chi tiết một thành viên ---------- */
  function detail(id, onFocus) {
    const d = ADB.load(), u = ADB.user(d, id); if (!u) return;
    const L = ADB.leader(d, id), dl = ADB.downline(d, id), by = {};
    dl.forEach(x => by[x.level] = (by[x.level] || 0) + 1);
    const m = modal(`<div class="card-head"><div class="who"><span class="avatar lg g">${esc(initials(u.name))}</span><div><h3>${esc(u.name)}</h3><small class="dim">${esc(u.code || '')} · tham gia ${fdate(u.created)}</small></div></div><button class="icon-btn" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div class="row wrap mt-1">${tierBadge(u)}${rankBadge(L.rank)}${u.status === 'locked' ? '<span class="badge failed">Đã khóa</span>' : ''}</div>
      <div class="ph-kv mt-2">
        <div><small>Người giới thiệu</small><b>${esc(nameOf(d, u.sponsor))}</b></div>
        <div><small>Tuyến trên trên cây</small><b>${esc(nameOf(d, u.parent))}</b></div>
        <div><small>Doanh số cá nhân</small><b class="gold">${money(ADB.sales(d, id))}</b></div>
        <div><small>Doanh số nhóm</small><b class="cyan">${money(L.sales)}</b></div>
        <div><small>Điện thoại</small><b>${esc(u.phone || '')}</b></div>
        <div><small>Email</small><b style="word-break:break-all">${esc(u.email || '')}</b></div>
      </div>
      <h4 class="mt-2" style="font-size:14px">Tuyến dưới theo tầng: ${dl.length} người</h4>
      <div class="ph-lv mt-1">${Object.keys(by).length ? Object.keys(by).map(k => `<span class="badge ${k == 1 ? 'gold' : k == 2 ? 'ship' : 'violet'}">F${k}: ${by[k]}</span>`).join('') : '<span class="dim">Chưa có tuyến dưới.</span>'}</div>
      <div class="row mt-3" style="justify-content:flex-end"><button class="btn" data-close type="button">Đóng</button>${onFocus ? `<button class="btn btn-outline-gold" type="button" id="phFocus">${icon('users')} Xem nhánh này</button>` : ''}</div>`);
    const f = $('#phFocus', m.el); if (f) f.addEventListener('click', () => { m.close(); onFocus(id); });
  }

  /* ---------- SƠ ĐỒ PHẢ HỆ ---------- */
  const T = { open: null, focus: null, hit: null };
  ADMIN_MODULES.tree = {
    render(el) {
      const d = ADB.load(), all = placedList(d);
      if (!T.open) { T.open = new Set(); ADB.roots(d).forEach(r => { T.open.add(r.id); ADB.children(d, r.id).forEach(c => T.open.add(c.id)); }); }
      const ranks = d.settings.leaderRanks;
      const node = t => {
        const u = t.user, L = ADB.leader(d, u.id), kids = t.kids, on = T.open.has(u.id);
        return `<li><button class="ph-tg" type="button" data-tg="${u.id}" ${kids.length ? '' : 'disabled'} aria-label="${on ? 'Thu gọn' : 'Mở rộng'}">${kids.length ? (on ? '−' : '+') : '·'}</button><span class="ph-node${T.hit === u.id ? ' hit' : ''}" style="--rk:${esc(L.rank.color)}" data-node="${u.id}" tabindex="0">
          <span class="avatar" style="color:${esc(L.rank.color)};border-color:${esc(L.rank.color)}66">${esc(initials(u.name))}</span>
          <span><b>${esc(u.name)}</b><small>${esc(u.code || '')} · <span class="ph-rk">${esc(L.rank.name)}</span> ${tierBadge(u, 1)}</small><small>F1: ${kids.length} · Nhóm: ${L.team} · DS nhóm ${short(L.sales)}</small></span></span>
          ${kids.length && on ? `<ul>${kids.map(node).join('')}</ul>` : ''}</li>`;
      };
      const roots = T.focus ? [ADB.tree(d, T.focus)].filter(Boolean) : ADB.roots(d).map(r => ADB.tree(d, r.id));
      let crumb = '';
      if (T.focus) { const path = []; let p = ADB.user(d, T.focus); while (p) { path.unshift(p); p = p.parent ? ADB.user(d, p.parent) : null; } crumb = `<div class="ph-crumb" style="margin-bottom:10px"><button type="button" data-crumb="">Toàn bộ cây</button>${path.map(x => `<span class="dim">/</span><button type="button" data-crumb="${x.id}">${esc(x.name)}</button>`).join('')}</div>`; }
      el.innerHTML = `<div class="grid g-4 keep-2">
          <div class="card glow-gold stat"><div class="stat-top"><span class="stat-ico gold">${icon('users')}</span>Đã lên cây</div><div class="stat-val">${all.length}</div></div>
          <div class="card glow-cyan stat"><div class="stat-top"><span class="stat-ico">${icon('clock')}</span>Chờ lên cây</div><div class="stat-val">${ADB.pending(d).length}</div></div>
          <div class="card glow-gold stat"><div class="stat-top"><span class="stat-ico violet">${icon('grid')}</span>Nhánh gốc</div><div class="stat-val">${ADB.roots(d).length}</div></div>
          <div class="card glow-cyan stat"><div class="stat-top"><span class="stat-ico green">${icon('star')}</span>Lãnh đạo</div><div class="stat-val">${all.filter(u => ADB.leader(d, u.id).rank.id !== ranks[0].id).length}</div></div>
        </div>
        <div class="card glow-mix mt-2">
          <div class="card-head"><h3>Sơ đồ phả hệ giới thiệu</h3><span class="sub">Bấm vào một người để xem chi tiết</span></div>
          <div class="toolbar">
            <input class="input" id="phQ" list="phList" placeholder="Tìm tên hoặc mã thành viên để xem nhánh">
            <datalist id="phList">${all.map(u => `<option value="${esc(u.code)} · ${esc(u.name)}">`).join('')}</datalist>
            <button class="btn btn-sm" type="button" id="phOpen">${icon('plus')} Mở hết</button>
            <button class="btn btn-sm" type="button" id="phClose">${icon('minus')} Thu gọn</button>
          </div>
          <div class="row wrap" style="gap:12px;font-size:12px;margin-bottom:12px">${ranks.map(r => `<span class="row" style="gap:6px"><span class="dot" style="color:${esc(r.color)}"></span>${esc(r.name)}</span>`).join('')}</div>
          ${crumb}
          <div class="ph-scroll">${roots.length ? `<ul class="ph-tree">${roots.map(node).join('')}</ul>` : `<div class="empty">${icon('users')}Chưa có thành viên nào trên cây.</div>`}</div>
        </div>`;
      const again = () => this.render(el);
      const focus = id => { T.focus = id || null; T.hit = id || null; if (id) T.open.add(id); again(); };
      el.onclick = e => {
        const tg = e.target.closest('[data-tg]'), nd = e.target.closest('[data-node]'), cr = e.target.closest('[data-crumb]');
        if (tg && !tg.disabled) { const id = tg.dataset.tg; T.open.has(id) ? T.open.delete(id) : T.open.add(id); again(); }
        else if (nd) detail(nd.dataset.node, focus);
        else if (cr) focus(cr.dataset.crumb);
      };
      el.onkeydown = e => { const nd = e.target.closest('[data-node]'); if (nd && e.key === 'Enter') detail(nd.dataset.node, focus); };
      $('#phOpen', el).onclick = () => { all.forEach(u => T.open.add(u.id)); again(); };
      $('#phClose', el).onclick = () => { T.open.clear(); ADB.roots(d).forEach(r => T.open.add(r.id)); again(); };
      $('#phQ', el).addEventListener('change', e => {
        const q = e.target.value.trim().toLowerCase(); if (!q) return focus(null);
        const code = q.split('·')[0].trim();
        const u = all.find(x => (x.code || '').toLowerCase() === code) || all.find(x => x.name.toLowerCase().includes(q) || (x.code || '').toLowerCase().includes(q));
        if (u) focus(u.id); else toast('Không tìm thấy thành viên trên cây');
      });
    }
  };

  /* ---------- CHỜ LÊN CÂY ---------- */
  function place(d, u, parentId) { u.placed = true; u.parent = parentId || null; }
  function autoAll(d) {
    let n = 0, moved = true;
    while (moved) {
      moved = false;
      ADB.pending(d).forEach(u => { const sp = u.sponsor && ADB.user(d, u.sponsor); if (!sp || sp.role === 'admin' || sp.placed) { place(d, u, sp && sp.role !== 'admin' ? sp.id : null); n++; moved = true; } });
    }
    return n;
  }
  ADMIN_MODULES.pending = {
    render(el) {
      const d = ADB.load();
      if (d.settings.autoPlace && ADB.pending(d).length) { const n = autoAll(d); if (n) { ADB.log(d, 'Xếp lên cây', `Tự động xếp ${n} thành viên dưới người giới thiệu`); ADB.save(d); toast(`Đã tự động xếp ${n} thành viên lên cây`); } }
      const list = ADB.pending(d).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
      el.innerHTML = `<div class="card glow-cyan">
        <div class="card-head"><h3>Thành viên chờ xếp lên cây</h3><span class="sub">${list.length} người</span></div>
        <div class="toolbar">
          <label class="check"><input type="checkbox" id="pdAuto"${d.settings.autoPlace ? ' checked' : ''}> Tự động xếp dưới người giới thiệu</label>
          <button class="btn btn-sm btn-gold" type="button" id="pdAll" style="margin-left:auto"${list.length ? '' : ' disabled'}>${icon('check')} Xếp tự động tất cả</button>
          <button class="btn btn-sm btn-outline-gold" type="button" id="pdCsv">${icon('download')} Tải Excel (CSV)</button>
        </div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thành viên</th><th>Người giới thiệu</th><th>Tỉnh thành</th><th>Đăng ký</th><th></th></tr></thead><tbody>
        ${list.length ? list.map((u, i) => { const sp = u.sponsor && ADB.user(d, u.sponsor); return `<tr><td>${who(u, i)}</td>
          <td>${sp ? `<b>${esc(sp.name)}</b><br><small class="dim">${esc(sp.code || '')}${sp.placed ? '' : ' · chưa lên cây'}</small>` : '<span class="dim">Không có</span>'}</td>
          <td>${esc(u.city || '')}</td><td class="dim nowrap">${fdate(u.created)}</td>
          <td><button class="btn btn-sm btn-outline-gold nowrap" type="button" data-place="${u.id}">Xếp lên cây</button></td></tr>`; }).join('')
          : `<tr><td colspan="5"><div class="empty">${icon('check')}Không còn ai chờ xếp lên cây.</div></td></tr>`}
        </tbody></table></div>
        <p class="dim mt-2" style="font-size:12px">Khi bật tự động, thành viên mới đăng ký qua mã giới thiệu sẽ được xếp ngay dưới người giới thiệu mỗi lần mở mục này.</p>
      </div>`;
      const again = () => this.render(el);
      $('#pdAuto', el).onchange = e => { const x = ADB.load(); x.settings.autoPlace = e.target.checked; ADB.log(x, 'Thiết lập phả hệ', 'Tự động xếp lên cây: ' + (e.target.checked ? 'bật' : 'tắt')); ADB.save(x); toast(e.target.checked ? 'Đã bật tự động xếp lên cây' : 'Đã tắt tự động xếp lên cây'); again(); };
      $('#pdAll', el).onclick = () => { if (!confirm('Xếp tất cả thành viên đang chờ vào ngay dưới người giới thiệu?')) return; const x = ADB.load(), n = autoAll(x); ADB.log(x, 'Xếp lên cây', `Xếp tự động ${n} thành viên`); ADB.save(x); toast(`Đã xếp ${n} thành viên lên cây`); again(); };
      $('#pdCsv', el).onclick = () => ADB.csv('cho-len-cay', [['Mã', 'Họ tên', 'Điện thoại', 'Email', 'Người giới thiệu', 'Ngày đăng ký'], ...list.map(u => [u.code, u.name, u.phone, u.email, nameOf(d, u.sponsor), u.created])]);
      $$('[data-place]', el).forEach(b => b.onclick = () => placeModal(b.dataset.place, again));
    }
  };
  function placeModal(id, done) {
    const d = ADB.load(), u = ADB.user(d, id), sp = u.sponsor && ADB.user(d, u.sponsor);
    const placed = placedList(d), branch = sp && sp.placed ? [sp, ...ADB.downline(d, sp.id).map(x => x.user)] : [];
    const ids = new Set(branch.map(x => x.id)), others = placed.filter(x => !ids.has(x.id));
    const opt = (x, lv) => `<option value="${x.id}"${sp && x.id === sp.id ? ' selected' : ''}>${esc(x.name)} (${esc(x.code || '')})${lv ? ' · F' + lv : ''}</option>`;
    const m = modal(`<form id="pdF"><div class="card-head"><h3>Xếp ${esc(u.name)} lên cây</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <p class="muted" style="font-size:14px">Người giới thiệu: <b>${esc(sp ? sp.name + ' (' + (sp.code || '') + ')' : 'Không có')}</b>${sp && !sp.placed ? ' <span class="badge pending">chưa lên cây</span>' : ''}</p>
      <div class="field mt-2"><label>Chọn tuyến trên trực tiếp</label><select class="input" name="parent">
        <option value="">Làm gốc mới (không có tuyến trên)</option>
        ${branch.length ? `<optgroup label="Nhánh của người giới thiệu">${branch.map((x, i) => opt(x, i ? ADB.downline(d, sp.id).find(y => y.user.id === x.id).level : 0)).join('')}</optgroup>` : ''}
        ${others.length ? `<optgroup label="Thành viên khác đã lên cây">${others.map(x => opt(x)).join('')}</optgroup>` : ''}
      </select></div>
      <p class="dim mt-1" style="font-size:12px">Mặc định xếp ngay dưới người giới thiệu. Hoa hồng vẫn tính theo người giới thiệu.</p>
      <div class="row mt-3" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Xếp lên cây</button></div></form>`);
    $('#pdF', m.el).addEventListener('submit', e => {
      e.preventDefault(); const pid = new FormData(e.target).get('parent');
      const x = ADB.load(), t = ADB.user(x, id); place(x, t, pid);
      ADB.log(x, 'Xếp lên cây', `${t.name} (${t.code}) dưới ${pid ? nameOf(x, pid) : 'gốc mới'}`); ADB.save(x);
      m.close(); toast('Đã xếp ' + t.name + ' lên cây'); done();
    });
  }

  /* ---------- CẤP BẬC LÃNH ĐẠO ---------- */
  const LV = { rank: '', q: '' };
  ADMIN_MODULES.leaders = {
    render(el) {
      const d = ADB.load(), ranks = d.settings.leaderRanks, edit = can('tree');
      const rows = placedList(d).map(u => ({ u, L: ADB.leader(d, u.id), own: ADB.sales(d, u.id) })).sort((a, b) => b.L.sales - a.L.sales);
      const cnt = id => rows.filter(r => r.L.rank.id === id).length;
      const q = LV.q.toLowerCase(), list = rows.filter(r => (!LV.rank || r.L.rank.id === LV.rank) && (!q || (r.u.name + ' ' + r.u.code + ' ' + (r.u.phone || '')).toLowerCase().includes(q)));
      el.innerHTML = `<div class="grid g-4 keep-2">${ranks.map((r, i) => `<div class="card ${i % 2 ? 'glow-cyan' : 'glow-gold'} stat"><div class="stat-top"><span class="dot" style="color:${esc(r.color)}"></span>${esc(r.name)}</div><div class="stat-val">${cnt(r.id)}</div><div class="stat-foot">Thưởng ${r.bonus}% doanh số nhóm</div></div>`).join('')}</div>
        <div class="card glow-gold mt-2"><div class="card-head"><h3>Điều kiện cấp bậc</h3><span class="sub">Đạt cả số người trong nhóm và doanh số nhóm (mẫu)</span></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Tên cấp bậc</th><th>Số người nhóm tối thiểu</th><th>Doanh số nhóm tối thiểu (đồng)</th><th>Thưởng %</th><th>Màu</th><th></th></tr></thead><tbody id="lvRanks">
          ${ranks.map((r, i) => `<tr data-rid="${esc(r.id)}"><td><input class="input ph-rank-in" name="name" value="${esc(r.name)}"${edit ? '' : ' disabled'}></td><td><input class="input ph-rank-in" name="minTeam" type="number" min="0" value="${r.minTeam}"${edit && i ? '' : ' disabled'}></td><td><input class="input ph-rank-in" name="minSales" type="number" min="0" step="1000000" value="${r.minSales}"${edit && i ? '' : ' disabled'}></td><td><input class="input ph-rank-in" name="bonus" type="number" min="0" max="100" step="0.5" value="${r.bonus}"${edit ? '' : ' disabled'}></td><td><input class="input ph-rank-in" name="color" type="color" value="${esc(r.color)}"${edit ? '' : ' disabled'}></td><td>${edit && i ? `<button class="icon-btn" type="button" data-rdel="${esc(r.id)}" aria-label="Xóa cấp bậc">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div>
          ${edit ? `<div class="row wrap mt-2" style="justify-content:flex-end"><button class="btn btn-sm" type="button" id="lvAdd">${icon('plus')} Thêm cấp bậc</button><button class="btn btn-sm btn-gold" type="button" id="lvSave">${icon('check')} Lưu cấp bậc</button></div>` : ''}
          <p class="dim mt-1" style="font-size:12px">Cấp đầu tiên là mức mặc định cho mọi thành viên. Khi lưu, các cấp được sắp xếp từ thấp đến cao theo doanh số.</p>
        </div>
        <div class="card glow-cyan mt-2"><div class="card-head"><h3>Thành viên theo cấp bậc</h3><span class="sub">${list.length} người</span></div>
          <div class="toolbar"><input class="input" id="lvQ" placeholder="Tìm tên, mã, số điện thoại" value="${esc(LV.q)}">
            <select class="input" id="lvR"><option value="">Mọi cấp bậc</option>${ranks.map(r => `<option value="${esc(r.id)}"${LV.rank === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
            <button class="btn btn-sm btn-outline-gold" type="button" id="lvCsv" style="margin-left:auto">${icon('download')} Tải Excel (CSV)</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Thành viên</th><th>Cấp bậc</th><th>Người trong nhóm</th><th>Doanh số nhóm</th><th>Doanh số cá nhân</th><th>Thưởng</th></tr></thead><tbody>
          ${list.length ? list.map(({ u, L, own }, i) => `<tr><td>${who(u, i)}</td><td>${rankBadge(L.rank)}</td><td>${L.team}</td><td class="cyan nowrap">${money(L.sales)}</td><td class="nowrap">${money(own)}</td><td class="gold nowrap">${L.rank.bonus}%</td></tr>`).join('') : `<tr><td colspan="6"><div class="empty">${icon('users')}Không có thành viên phù hợp.</div></td></tr>`}
          </tbody></table></div></div>`;
      const again = () => this.render(el);
      const qi = $('#lvQ', el); qi.oninput = () => { LV.q = qi.value; again(); const n = $('#lvQ', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      $('#lvR', el).onchange = e => { LV.rank = e.target.value; again(); };
      $('#lvCsv', el).onclick = () => ADB.csv('cap-bac-lanh-dao', [['Mã', 'Họ tên', 'Cấp bậc', 'Người trong nhóm', 'Doanh số nhóm', 'Doanh số cá nhân', 'Thưởng %'], ...list.map(({ u, L, own }) => [u.code, u.name, L.rank.name, L.team, L.sales, own, L.rank.bonus])]);
      if (!edit) return;
      const read = () => $$('#lvRanks tr', el).map(tr => { const v = n => $(`[name=${n}]`, tr).value; return { id: tr.dataset.rid, name: v('name').trim() || 'Cấp mới', minTeam: Math.max(0, +v('minTeam') || 0), minSales: Math.max(0, +v('minSales') || 0), bonus: Math.max(0, +v('bonus') || 0), color: v('color') }; });
      const store = (rs, msg, detailTxt) => { const x = ADB.load(); const [first, ...rest] = rs; first.minTeam = 0; first.minSales = 0; rest.sort((a, b) => a.minSales - b.minSales || a.minTeam - b.minTeam); x.settings.leaderRanks = [first, ...rest]; ADB.log(x, 'Cấp bậc lãnh đạo', detailTxt); ADB.save(x); toast(msg); again(); };
      $('#lvAdd', el).onclick = () => { const rs = read(), last = rs[rs.length - 1]; rs.push({ id: ADB.uid('rk'), name: 'Cấp mới', minTeam: last.minTeam + 10, minSales: last.minSales + 100000000, bonus: last.bonus + 1, color: '#45e08f' }); store(rs, 'Đã thêm cấp bậc mới', 'Thêm cấp bậc'); };
      $('#lvSave', el).onclick = () => store(read(), 'Đã lưu cấp bậc lãnh đạo', 'Cập nhật điều kiện cấp bậc');
      $$('[data-rdel]', el).forEach(b => b.onclick = () => { const rs = read(), r = rs.find(x => x.id === b.dataset.rdel); if (!confirm(`Xóa cấp bậc "${r.name}"?`)) return; store(rs.filter(x => x !== r), 'Đã xóa cấp bậc', 'Xóa cấp bậc ' + r.name); });
    }
  };

})();
