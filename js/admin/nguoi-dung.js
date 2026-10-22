/* Quản trị: tài khoản quản trị viên, vai trò và phân quyền */
(function () {
  const { $, $$, esc, initials, fdate, today, icon, toast, modal } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};

  // cùng thuật toán băm mật khẩu với js/app.js (hàm hash nội bộ, không xuất ra ngoài)
  const hash = s => { let h = 5381; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return 'h' + h.toString(36); };

  if (!document.getElementById('adm-css-nguoi-dung')) {
    const st = document.createElement('style'); st.id = 'adm-css-nguoi-dung';
    st.textContent = `
    .nd-mx th, .nd-mx td { text-align: center; padding: 10px 8px; }
    .nd-mx th:first-child, .nd-mx td:first-child { text-align: left; position: sticky; left: 0; z-index: 1; background: #0f1619; min-width: 170px; padding-left: 16px; }
    .nd-mx th.nd-p { font-size: 11px; line-height: 1.25; min-width: 78px; vertical-align: bottom; }
    .nd-mx input[type=checkbox] { accent-color: var(--gold); width: 17px; height: 17px; cursor: pointer; }
    .nd-mx input[disabled] { cursor: not-allowed; opacity: .55; }
    .nd-mx td b { display: block; font-size: 14px; } .nd-mx td small { display: block; font-size: 11.5px; color: var(--text-3); font-weight: 400; }
    .nd-note { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; font-size: 13px; color: var(--text-2); background: rgba(79, 230, 223, .06); border: 1px solid rgba(79, 230, 223, .25); }
    .nd-note svg { width: 18px; height: 18px; color: var(--cyan); flex: none; margin-top: 1px; }
    `;
    document.head.appendChild(st);
  }

  const AV = ['', 'v', 'g'];
  const admins = d => d.users.filter(u => u.role === 'admin');
  const roleOf = u => u.adminRole || 'owner';
  const roleName = (d, id) => ((d.roles || []).find(r => r.id === id) || {}).name || id;
  const meId = () => (PSQ.auth.user() || {}).id;
  const activeOwners = d => admins(d).filter(u => roleOf(u) === 'owner' && u.status !== 'locked');
  // trả về lý do không được khóa / hạ quyền tài khoản này, hoặc rỗng
  const guard = (d, u) => u.id === meId() ? 'Không thể khóa hoặc đổi vai trò của chính mình.'
    : roleOf(u) === 'owner' && u.status !== 'locked' && activeOwners(d).length <= 1 ? 'Đây là chủ sở hữu cuối cùng, không thể khóa hoặc hạ quyền.' : '';

  /* ---------- DANH SÁCH QUẢN TRỊ ---------- */
  const AF = { q: '', role: '' };
  ADMIN_MODULES.admins = {
    render(el) {
      const d = ADB.load(), roles = d.roles || [], all = admins(d), q = AF.q.toLowerCase();
      const list = all.filter(u => (!AF.role || roleOf(u) === AF.role) && (!q || (u.name + ' ' + u.email + ' ' + (u.phone || '')).toLowerCase().includes(q)));
      el.innerHTML = `<div class="grid g-4 keep-2">
          <div class="card glow-gold stat"><div class="stat-top"><span class="stat-ico gold">${icon('shield')}</span>Quản trị viên</div><div class="stat-val">${all.length}</div></div>
          <div class="card glow-cyan stat"><div class="stat-top"><span class="stat-ico green">${icon('check')}</span>Đang hoạt động</div><div class="stat-val">${all.filter(u => u.status !== 'locked').length}</div></div>
          <div class="card glow-gold stat"><div class="stat-top"><span class="stat-ico red">${icon('lock')}</span>Đã khóa</div><div class="stat-val">${all.filter(u => u.status === 'locked').length}</div></div>
          <div class="card glow-cyan stat"><div class="stat-top"><span class="stat-ico violet">${icon('users')}</span>Vai trò</div><div class="stat-val">${roles.length}</div></div>
        </div>
        <div class="card glow-mix mt-2"><div class="card-head"><h3>Tài khoản quản trị</h3><span class="sub">${list.length} tài khoản</span></div>
          <div class="toolbar"><input class="input" id="adQ" placeholder="Tìm tên, email, số điện thoại" value="${esc(AF.q)}">
            <select class="input" id="adR"><option value="">Mọi vai trò</option>${roles.map(r => `<option value="${esc(r.id)}"${AF.role === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
            <span class="row wrap" style="margin-left:auto"><button class="btn btn-sm btn-gold" type="button" id="adAdd">${icon('plus')} Thêm quản trị viên</button><button class="btn btn-sm btn-outline-gold" type="button" id="adCsv">${icon('download')} Tải Excel (CSV)</button></span></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Quản trị viên</th><th>Điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead><tbody>
          ${list.length ? list.map((u, i) => { const g = guard(d, u), lock = u.status === 'locked'; return `<tr><td><div class="who"><span class="avatar ${AV[i % 3]}">${esc(initials(u.name))}</span><div><b>${esc(u.name)}${u.id === meId() ? ' <span class="badge gold">Bạn</span>' : ''}</b><small>${esc(u.email)}</small></div></div></td>
            <td class="nowrap">${esc(u.phone || '')}</td>
            <td><select class="input" data-role="${u.id}"${g ? ` disabled title="${esc(g)}"` : ''}>${roles.map(r => `<option value="${esc(r.id)}"${r.id === roleOf(u) ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></td>
            <td>${lock ? '<span class="badge failed">Đã khóa</span>' : '<span class="badge ok">Hoạt động</span>'}</td>
            <td class="dim nowrap">${fdate(u.created)}</td>
            <td>${g && !lock ? `<span class="dim" title="${esc(g)}">${icon('lock')}</span>` : `<button class="btn btn-sm ${lock ? 'btn-outline-gold' : ''} nowrap" type="button" data-lock="${u.id}">${lock ? 'Mở khóa' : 'Khóa'}</button>`}</td></tr>`; }).join('')
            : `<tr><td colspan="6"><div class="empty">${icon('shield')}Không có tài khoản phù hợp.</div></td></tr>`}
          </tbody></table></div>
          <p class="dim mt-2" style="font-size:12px">Không thể khóa hoặc đổi vai trò của chính mình và của chủ sở hữu cuối cùng. Tài khoản bị khóa không đăng nhập được trang quản trị.</p>
        </div>`;
      const again = () => this.render(el);
      const qi = $('#adQ', el); qi.oninput = () => { AF.q = qi.value; again(); const n = $('#adQ', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      $('#adR', el).onchange = e => { AF.role = e.target.value; again(); };
      $('#adCsv', el).onclick = () => ADB.csv('quan-tri-vien', [['Họ tên', 'Email', 'Điện thoại', 'Vai trò', 'Trạng thái', 'Ngày tạo'], ...list.map(u => [u.name, u.email, u.phone, roleName(d, roleOf(u)), u.status === 'locked' ? 'Đã khóa' : 'Hoạt động', u.created])]);
      $('#adAdd', el).onclick = () => addAdmin(again);
      $$('[data-role]', el).forEach(s => s.onchange = () => {
        const x = ADB.load(), u = ADB.user(x, s.dataset.role), g = guard(x, u);
        if (g) { toast(g); return again(); }
        const from = roleName(x, roleOf(u)); u.adminRole = s.value;
        ADB.log(x, 'Đổi vai trò quản trị', `${u.name}: ${from} → ${roleName(x, s.value)}`); ADB.save(x);
        toast(`Đã đổi vai trò của ${u.name} thành ${roleName(x, s.value)}`); again();
      });
      $$('[data-lock]', el).forEach(b => b.onclick = () => {
        const x = ADB.load(), u = ADB.user(x, b.dataset.lock), lock = u.status !== 'locked';
        if (lock) { const g = guard(x, u); if (g) return toast(g); if (!confirm(`Khóa tài khoản ${u.name}? Người này sẽ không đăng nhập được trang quản trị.`)) return; }
        u.status = lock ? 'locked' : 'active';
        ADB.log(x, lock ? 'Khóa tài khoản quản trị' : 'Mở khóa tài khoản quản trị', `${u.name} (${u.email})`); ADB.save(x);
        toast(lock ? 'Đã khóa tài khoản ' + u.name : 'Đã mở khóa tài khoản ' + u.name); again();
      });
    }
  };

  function addAdmin(done) {
    const d = ADB.load(), roles = d.roles || [];
    const tmp = 'PSQ' + Math.random().toString(36).slice(2, 8);
    const m = modal(`<form id="adF"><div class="card-head"><h3>Thêm quản trị viên</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div class="form-grid">
        <div class="field full"><label>Họ tên</label><input class="input" name="name" required></div>
        <div class="field"><label>Email đăng nhập</label><input class="input" name="email" type="email" required></div>
        <div class="field"><label>Số điện thoại</label><input class="input" name="phone" type="tel"></div>
        <div class="field"><label>Vai trò</label><select class="input" name="role">${roles.map(r => `<option value="${esc(r.id)}"${r.id === 'sale' ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Mật khẩu tạm</label><input class="input" name="pass" value="${tmp}" minlength="6" required></div>
      </div>
      <p class="dim mt-1" style="font-size:12px">Gửi mật khẩu tạm cho người được cấp quyền và nhắc đổi sau lần đăng nhập đầu tiên.</p>
      <p class="red mt-1" id="adErr" style="font-size:13px"></p>
      <div class="row mt-2" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Tạo tài khoản</button></div></form>`);
    $('#adF', m.el).addEventListener('submit', e => {
      e.preventDefault(); const f = new FormData(e.target), x = ADB.load();
      const email = f.get('email').trim(), pass = f.get('pass').trim();
      if (x.users.some(u => (u.email || '').toLowerCase() === email.toLowerCase())) { $('#adErr', m.el).textContent = 'Email này đã có tài khoản.'; return; }
      if (pass.length < 6) { $('#adErr', m.el).textContent = 'Mật khẩu tạm cần ít nhất 6 ký tự.'; return; }
      const u = { id: ADB.uid('u-adm'), name: f.get('name').trim(), email, phone: f.get('phone').trim(), pass: hash(pass), role: 'admin', adminRole: f.get('role'), created: today(), status: 'active' };
      x.users.push(u);
      ADB.log(x, 'Thêm quản trị viên', `${u.name} (${u.email}), vai trò ${roleName(x, u.adminRole)}`); ADB.save(x);
      m.close(); toast('Đã tạo tài khoản quản trị cho ' + u.name); done();
    });
  }

  /* ---------- VAI TRÒ & PHÂN QUYỀN ---------- */
  let draft = null; // bản nháp quyền: { roleId: Set }
  ADMIN_MODULES.roles = {
    render(el) {
      const d = ADB.load(), roles = d.roles || [], P = ADB.PERMS;
      if (!draft) { draft = {}; roles.forEach(r => draft[r.id] = new Set(r.perms)); }
      roles.forEach(r => { if (!draft[r.id]) draft[r.id] = new Set(r.perms); });
      const used = id => admins(d).filter(u => roleOf(u) === id).length;
      const dirty = roles.some(r => { const a = [...draft[r.id]].sort().join(), b = [...r.perms].sort().join(); return a !== b; });
      el.innerHTML = `<div class="card glow-gold"><div class="card-head"><h3>Ma trận phân quyền</h3><span class="sub">${roles.length} vai trò · ${P.length} quyền</span></div>
          <div class="toolbar"><button class="btn btn-sm" type="button" id="rlAdd">${icon('plus')} Thêm vai trò</button>
            <span class="row wrap" style="margin-left:auto">${dirty ? '<span class="badge pending">Có thay đổi chưa lưu</span>' : ''}<button class="btn btn-sm" type="button" id="rlUndo"${dirty ? '' : ' disabled'}>Hoàn tác</button><button class="btn btn-sm btn-gold" type="button" id="rlSave"${dirty ? '' : ' disabled'}>${icon('check')} Lưu phân quyền</button></span></div>
          <div class="table-wrap"><table class="tbl nd-mx"><thead><tr><th>Vai trò</th><th class="nd-p">Toàn quyền</th>${P.map(([k, n]) => `<th class="nd-p" title="${esc(k)}">${esc(n)}</th>`).join('')}<th></th></tr></thead><tbody>
          ${roles.map(r => { const s = draft[r.id], all = s.has('*'), ro = r.id === 'owner', n = used(r.id); return `<tr><td><b>${esc(r.name)}</b><small>${esc(r.note || '')}</small><small>${n} tài khoản</small></td>
            <td><input type="checkbox" data-rp="${esc(r.id)}|*"${all ? ' checked' : ''}${ro ? ' disabled' : ''} aria-label="${esc(r.name)}: toàn quyền"></td>
            ${P.map(([k, nm]) => `<td><input type="checkbox" data-rp="${esc(r.id)}|${esc(k)}"${all || s.has(k) ? ' checked' : ''}${ro || all ? ' disabled' : ''} aria-label="${esc(r.name)}: ${esc(nm)}"></td>`).join('')}
            <td>${ro ? `<span class="dim" title="Vai trò chủ sở hữu luôn có toàn quyền">${icon('lock')}</span>` : `<button class="icon-btn" type="button" data-rdel="${esc(r.id)}" aria-label="Xóa vai trò ${esc(r.name)}"${n ? ` title="Đang có ${n} tài khoản dùng vai trò này"` : ''}>${icon('trash')}</button>`}</td></tr>`; }).join('')}
          </tbody></table></div>
          <div class="nd-note mt-2">${icon('info')}<span>Vai trò Chủ sở hữu luôn có toàn quyền và không sửa được. Sau khi lưu, danh mục bên trái của mỗi quản trị viên cập nhật theo quyền mới khi tải lại trang. <button class="link-btn cyan" type="button" id="rlReload" style="background:none;border:0;padding:0;cursor:pointer;font:inherit">Tải lại ngay</button></span></div>
        </div>`;
      const again = () => this.render(el);
      $$('[data-rp]', el).forEach(c => c.onchange = () => { const [rid, k] = c.dataset.rp.split('|'); c.checked ? draft[rid].add(k) : draft[rid].delete(k); again(); });
      $('#rlUndo', el).onclick = () => { draft = null; again(); };
      $('#rlReload', el).onclick = () => location.reload();
      $('#rlSave', el).onclick = () => {
        const x = ADB.load(), me = PSQ.auth.user(), myRole = me && roleOf(ADB.user(x, me.id) || me);
        const mine = draft[myRole];
        if (mine && myRole !== 'owner' && !mine.has('*') && !mine.has('admins') && !confirm('Vai trò của anh chị sẽ mất quyền "Tài khoản quản trị" và không vào lại được mục này. Vẫn lưu?')) return;
        const changed = [];
        (x.roles || []).forEach(r => { if (r.id === 'owner' || !draft[r.id]) return; const nv = draft[r.id].has('*') ? ['*'] : ADB.PERMS.map(p => p[0]).filter(k => draft[r.id].has(k)); if ([...nv].sort().join() !== [...r.perms].sort().join()) { r.perms = nv; changed.push(r.name); } });
        ADB.log(x, 'Cập nhật phân quyền', changed.length ? 'Vai trò: ' + changed.join(', ') : 'Không thay đổi'); ADB.save(x);
        draft = null; toast(changed.length ? 'Đã lưu phân quyền. Tải lại trang để cập nhật danh mục.' : 'Không có thay đổi'); again();
      };
      $('#rlAdd', el).onclick = () => addRole(again);
      $$('[data-rdel]', el).forEach(b => b.onclick = () => {
        const x = ADB.load(), r = x.roles.find(y => y.id === b.dataset.rdel), n = admins(x).filter(u => roleOf(u) === r.id).length;
        if (n) return toast(`Vai trò ${r.name} đang được ${n} tài khoản dùng, hãy đổi vai trò của họ trước`);
        if (!confirm(`Xóa vai trò "${r.name}"?`)) return;
        x.roles = x.roles.filter(y => y !== r); delete draft[r.id];
        ADB.log(x, 'Xóa vai trò', r.name); ADB.save(x); toast('Đã xóa vai trò ' + r.name); again();
      });
    }
  };

  function addRole(done) {
    const d = ADB.load(), roles = d.roles || [];
    const m = modal(`<form id="rlF"><div class="card-head"><h3>Thêm vai trò</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <div class="form-grid">
        <div class="field full"><label>Tên vai trò</label><input class="input" name="name" required placeholder="Ví dụ: Chăm sóc khách hàng"></div>
        <div class="field full"><label>Mô tả ngắn</label><input class="input" name="note" placeholder="Phạm vi công việc"></div>
        <div class="field full"><label>Sao chép quyền từ</label><select class="input" name="copy"><option value="">Không có quyền nào (tự chọn sau)</option>${roles.filter(r => r.id !== 'owner').map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></div>
      </div>
      <div class="row mt-3" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Thêm vai trò</button></div></form>`);
    $('#rlF', m.el).addEventListener('submit', e => {
      e.preventDefault(); const f = new FormData(e.target), x = ADB.load(), name = f.get('name').trim();
      if (x.roles.some(r => r.name.toLowerCase() === name.toLowerCase())) return toast('Đã có vai trò cùng tên');
      const src = x.roles.find(r => r.id === f.get('copy'));
      const r = { id: ADB.uid('role'), name, note: f.get('note').trim(), perms: src ? [...src.perms] : [] };
      x.roles.push(r); if (draft) draft[r.id] = new Set(r.perms);
      ADB.log(x, 'Thêm vai trò', name); ADB.save(x);
      m.close(); toast('Đã thêm vai trò ' + name); done();
    });
  }
})();
