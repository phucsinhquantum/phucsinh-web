/* Quản trị: nhật ký thao tác, lịch sử gửi mail, quản lý địa chỉ, thiết lập hệ thống. Dữ liệu trong ADB. */
(function () {
  const { $, $$, esc, money, icon, toast, modal, fdate, initials, store } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};

  if (!document.getElementById('adm-css-he-thong')) {
    const st = document.createElement('style'); st.id = 'adm-css-he-thong';
    st.textContent = `
      .ht-mail { background: #f7f3ea; color: #2a2118; border-radius: 12px; overflow: hidden; font-size: 14px; line-height: 1.6; }
      .ht-mail-h { background: linear-gradient(135deg, #1a120a, #3a2614); color: #f3c76b; padding: 18px 20px; font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; }
      .ht-mail-b { padding: 18px 20px; } .ht-mail-b p { margin: 0 0 10px; }
      .ht-mail-b table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 13px; }
      .ht-mail-b td { padding: 6px 0; border-bottom: 1px solid #e4dccb; } .ht-mail-b td:last-child { text-align: right; white-space: nowrap; }
      .ht-mail-f { padding: 12px 20px; background: #efe8d9; font-size: 12px; color: #6d5f4b; }
      .ht-btn { display: inline-block; background: #c99a3f; color: #fff; padding: 9px 18px; border-radius: 8px; font-weight: 600; }
      .ht-levels { display: grid; gap: 8px; }
      .ht-level { display: grid; grid-template-columns: 44px minmax(0, 1fr) 36px; gap: 8px; align-items: center; }
      .ht-level b { color: var(--gold); }
      .ht-danger { border: 1px solid rgba(255, 107, 107, .35) !important; }
      .ht-sec { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-3); margin: 6px 0 -4px; }
      [data-pane="logs"] .tbl { min-width: 720px; } [data-pane="logs"] td:last-child { min-width: 240px; } [data-pane="mails"] .tbl { min-width: 860px; } [data-pane="mails"] td:nth-child(3) { min-width: 220px; } [data-pane="addresses"] .tbl { min-width: 820px; } [data-pane="addresses"] .who > div { min-width: 140px; } [data-pane="addresses"] td:nth-child(3) { min-width: 180px; }
      .modal.ht-wide { width: min(680px, 100%); }`;
    document.head.appendChild(st);
  }
  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const opt = (v, t, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  // ô tìm kiếm: vẽ lại và giữ con trỏ
  const keepFocus = (el, sel) => { const n = $(sel, el); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };

  /* ---------- nhật ký thao tác ---------- */
  const ls = { q: '', actor: '', action: '', n: 100 };
  ADMIN_MODULES.logs = {
    render(el) {
      const logs = ADB.load().logs || [];
      const actors = [...new Set(logs.map(l => l.actor))].sort(), actions = [...new Set(logs.map(l => l.action))].sort();
      const q = norm(ls.q), rows = logs.filter(l => (!ls.actor || l.actor === ls.actor) && (!ls.action || l.action === ls.action) && (!q || norm(l.action + ' ' + l.detail + ' ' + l.actor).includes(q)));
      el.innerHTML = `<div class="card glow-cyan">
        <div class="card-head"><div><h3>Nhật ký thao tác</h3><div class="sub">Ghi lại mọi thao tác của quản trị viên, mới nhất ở trên</div></div></div>
        <div class="toolbar">
          <input class="input" data-q placeholder="Tìm nội dung thao tác" value="${esc(ls.q)}">
          <select class="input" data-f="actor"><option value="">Mọi người thực hiện</option>${actors.map(a => opt(a, a, ls.actor)).join('')}</select>
          <select class="input" data-f="action"><option value="">Mọi thao tác</option>${actions.map(a => opt(a, a, ls.action)).join('')}</select>
          <span class="dim" style="font-size:13px">${rows.length} dòng</span>
          <button class="btn btn-sm btn-outline-gold" type="button" data-csv style="margin-left:auto">${icon('download')} Tải Excel (CSV)</button>
        </div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Chi tiết</th></tr></thead><tbody>
        ${rows.slice(0, ls.n).map((l, i) => `<tr><td class="dim nowrap">${esc(l.date)}</td><td><div class="who"><span class="avatar ${['', 'v', 'g'][i % 3]}">${initials(l.actor)}</span><div><b>${esc(l.actor)}</b></div></div></td><td class="nowrap"><span class="badge ship">${esc(l.action)}</span></td><td class="muted">${esc(l.detail)}</td></tr>`).join('') || `<tr><td colspan="4"><div class="empty">${icon('eye')}Không có thao tác phù hợp.</div></td></tr>`}
        </tbody></table></div>
        ${rows.length > ls.n ? `<div class="row mt-3" style="justify-content:center"><button class="btn btn-sm" type="button" data-more>Xem thêm (${rows.length - ls.n} dòng)</button></div>` : ''}
      </div>`;
      $('[data-q]', el).addEventListener('input', e => { ls.q = e.target.value; this.render(el); keepFocus(el, '[data-q]'); });
      $$('[data-f]', el).forEach(s => s.addEventListener('change', () => { ls[s.dataset.f] = s.value; this.render(el); }));
      const mb = $('[data-more]', el); if (mb) mb.addEventListener('click', () => { ls.n += 100; this.render(el); });
      $('[data-csv]', el).addEventListener('click', () => ADB.csv('nhat-ky-thao-tac', [['Thời gian', 'Người thực hiện', 'Thao tác', 'Chi tiết'], ...rows.map(l => [l.date, l.actor, l.action, l.detail])]));
    }
  };

  /* ---------- lịch sử gửi mail ---------- */
  const ms = { q: '', type: '', status: '' };
  const mailStatus = { sent: ['Đã gửi', 'ok'], failed: ['Lỗi gửi', 'failed'], queued: ['Đang chờ', 'pending'] };
  function mailBody(d, m) {
    const S = d.settings || {}, u = d.users.find(x => x.email === m.to), name = u ? u.name : 'anh chị';
    const oid = (m.subject.match(/PSQ\d+/) || [])[0], o = oid && d.orders.find(x => x.id === oid);
    let main;
    if (o) main = `<p>Phúc Sinh QuanTum đã nhận đơn hàng <b>#${esc(o.id)}</b> của anh chị ngày ${fdate(o.date)}.</p>
      <table>${o.items.map(x => `<tr><td>${esc(x.name)} x${x.qty}</td><td>${money(x.price * x.qty)}</td></tr>`).join('')}<tr><td><b>Tổng cộng</b></td><td><b>${money(o.total)}</b></td></tr></table>
      <p>Giao đến: ${esc(o.address || '')}. Thanh toán: ${o.pay === 'bank' ? 'chuyển khoản' : 'khi nhận hàng'}.</p><p>Nhân viên sẽ gọi xác nhận trong thời gian sớm nhất.</p>
      <p><span class="ht-btn">Xem đơn hàng</span></p>`;
    else if (m.type === 'Đăng ký') main = `<p>Cảm ơn anh chị đã đăng ký thành viên ${esc(S.shopName || SITE.brand)}.</p>${u && u.code ? `<p>Mã giới thiệu của anh chị: <b>${esc(u.code)}</b>. Chia sẻ mã này để người thân nhận ưu đãi khi đăng ký.</p>` : ''}
      <p>Mỗi đơn hàng được tích ${Math.round((S.pointRate || .1) * 100)}% giá trị thành điểm PS, dùng để đổi ưu đãi ở các đơn sau.</p><p><span class="ht-btn">Vào trang thành viên</span></p>`;
    else main = `<p>${esc(m.subject)}.</p><p>Nội dung chi tiết theo mẫu thư "${esc(m.type)}" của hệ thống. (mẫu)</p>`;
    return `<div class="ht-mail"><div class="ht-mail-h">${esc(S.shopName || SITE.brand)}</div>
      <div class="ht-mail-b"><p>Kính gửi ${esc(name)},</p>${main}<p>Trân trọng,<br>Đội ngũ ${esc(S.shopName || SITE.brand)}</p></div>
      <div class="ht-mail-f">Hotline ${esc(S.hotline || SITE.phone)} · ${esc(S.email || SITE.email)}<br>${esc(S.address || SITE.address)}</div></div>`;
  }
  function resend(id, done) {
    const d = ADB.load(), m = (d.mails || []).find(x => x.id === id); if (!m) return;
    const now = new Date(); m.status = 'sent'; m.resent = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
    ADB.log(d, 'Gửi lại thư', `${m.subject} → ${m.to}`); ADB.save(d);
    toast('Đã đánh dấu gửi lại. Gửi thư thật cần nối máy chủ thư (SMTP).'); done();
  }
  ADMIN_MODULES.mails = {
    render(el) {
      const d = ADB.load(), mails = d.mails || [], types = [...new Set(mails.map(m => m.type))], edit = ADMIN.can('system');
      const q = norm(ms.q), rows = mails.filter(m => (!ms.type || m.type === ms.type) && (!ms.status || m.status === ms.status) && (!q || norm(m.to + ' ' + m.subject).includes(q)));
      const failed = mails.filter(m => m.status === 'failed').length;
      el.innerHTML = `<div class="card glow-gold">
        <div class="card-head"><div><h3>Lịch sử gửi mail</h3><div class="sub">${mails.length} thư · ${failed} thư lỗi · người gửi: ${esc((d.settings || {}).mailSender || '')}</div></div></div>
        <div class="toolbar">
          <input class="input" data-q placeholder="Tìm người nhận, tiêu đề" value="${esc(ms.q)}">
          <select class="input" data-f="type"><option value="">Mọi loại thư</option>${types.map(t => opt(t, t, ms.type)).join('')}</select>
          <select class="input" data-f="status"><option value="">Mọi trạng thái</option>${Object.entries(mailStatus).map(([k, v]) => opt(k, v[0], ms.status)).join('')}</select>
          <span class="dim" style="font-size:13px">${rows.length} thư</span>
          <button class="btn btn-sm btn-outline-gold" type="button" data-csv style="margin-left:auto">${icon('download')} Tải Excel (CSV)</button>
        </div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Thời gian</th><th>Người nhận</th><th>Tiêu đề</th><th>Loại</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${rows.map(m => { const [sn, sc] = mailStatus[m.status] || [m.status, 'ship']; return `<tr><td class="dim nowrap">${esc(m.date)}</td><td>${esc(m.to)}</td><td>${esc(m.subject)}${m.resent ? `<br><small class="dim">Gửi lại ${esc(m.resent)}</small>` : ''}</td><td class="nowrap"><span class="badge violet">${esc(m.type)}</span></td><td class="nowrap"><span class="badge ${sc}">${sn}</span></td>
          <td class="nowrap"><button class="btn btn-sm" type="button" data-view="${m.id}">${icon('eye')} Xem</button>${m.status === 'failed' && edit ? ` <button class="btn btn-sm btn-outline-gold" type="button" data-resend="${m.id}">Gửi lại</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="6"><div class="empty">${icon('mail')}Không có thư phù hợp.</div></td></tr>`}
        </tbody></table></div>
        <p class="dim mt-2" style="font-size:12px">Bản chạy thử chỉ ghi lại lịch sử. Để gửi thư thật cần nối máy chủ thư (SMTP) hoặc dịch vụ gửi mail.</p>
      </div>`;
      const again = () => this.render(el);
      $('[data-q]', el).addEventListener('input', e => { ms.q = e.target.value; again(); keepFocus(el, '[data-q]'); });
      $$('[data-f]', el).forEach(s => s.addEventListener('change', () => { ms[s.dataset.f] = s.value; again(); }));
      $('[data-csv]', el).addEventListener('click', () => ADB.csv('lich-su-gui-mail', [['Thời gian', 'Người nhận', 'Tiêu đề', 'Loại', 'Trạng thái'], ...rows.map(m => [m.date, m.to, m.subject, m.type, (mailStatus[m.status] || [m.status])[0]])]));
      $$('[data-resend]', el).forEach(b => b.addEventListener('click', () => resend(b.dataset.resend, again)));
      $$('[data-view]', el).forEach(b => b.addEventListener('click', () => {
        const m = mails.find(x => x.id === b.dataset.view), [sn, sc] = mailStatus[m.status] || [m.status, 'ship'];
        const md = modal(`<div class="card-head"><h3>Xem thư</h3><span class="badge ${sc}">${sn}</span>${closeBtn}</div>
          <dl class="kv"><dt>Từ</dt><dd>${esc((d.settings || {}).mailSender || '')}</dd><dt>Đến</dt><dd>${esc(m.to)}</dd><dt>Tiêu đề</dt><dd><b>${esc(m.subject)}</b></dd><dt>Thời gian</dt><dd>${esc(m.date)}</dd></dl>
          <div class="divider"></div>${mailBody(d, m)}
          <div class="row mt-3" style="justify-content:flex-end"><button class="btn" type="button" data-close>Đóng</button>${m.status === 'failed' && edit ? '<button class="btn btn-gold" type="button" data-re>Gửi lại</button>' : ''}</div>`);
        $('.modal', md.el).classList.add('ht-wide');
        const r = $('[data-re]', md.el); if (r) r.addEventListener('click', () => { md.close(); resend(m.id, again); });
      }));
    }
  };

  /* ---------- quản lý địa chỉ ---------- */
  const as = { q: '' };
  function addrForm(d, a, done) {
    const isNew = !a, mem = d.users.filter(u => u.role !== 'admin');
    a = a || { user: (mem[0] || {}).id, name: '', phone: '', line: '', province: '', isDefault: false };
    const m = modal(`<form novalidate><div class="card-head"><h3>${isNew ? 'Thêm địa chỉ khách' : 'Sửa địa chỉ'}</h3>${closeBtn}</div>
      <div class="form-grid">
        <div class="field full"><label>Tài khoản khách</label><select class="input" name="user"${isNew ? '' : ' disabled'}>${mem.map(u => opt(u.id, u.name + ' (' + (u.code || u.email) + ')', a.user)).join('')}</select></div>
        <div class="field"><label>Người nhận</label><input class="input" name="name" value="${esc(a.name)}" required></div>
        <div class="field"><label>Điện thoại</label><input class="input" name="phone" value="${esc(a.phone)}" inputmode="tel"></div>
        <div class="field full"><label>Địa chỉ (số nhà, đường, phường)</label><input class="input" name="line" value="${esc(a.line)}" required></div>
        <div class="field"><label>Tỉnh, thành phố</label><input class="input" name="province" value="${esc(a.province)}"></div>
        <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="def"${a.isDefault ? ' checked' : ''}> Địa chỉ mặc định</label>
      </div><p class="red mt-1" data-err style="font-size:13px;min-height:1em"></p>
      <div class="row mt-1" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu</button></div></form>`);
    $('form', m.el).addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      if (!f.name.value.trim() || !f.line.value.trim()) { $('[data-err]', m.el).textContent = 'Anh chị nhập tên người nhận và địa chỉ.'; return; }
      if (f.phone.value.trim() && !/^[0-9 +.]{8,15}$/.test(f.phone.value.trim())) { $('[data-err]', m.el).textContent = 'Số điện thoại chưa đúng.'; return; }
      const d2 = ADB.load(); d2.addresses = d2.addresses || [];
      let x = isNew ? { id: ADB.uid('dc'), user: f.user.value } : d2.addresses.find(y => y.id === a.id);
      Object.assign(x, { name: f.name.value.trim(), phone: f.phone.value.trim(), line: f.line.value.trim(), province: f.province.value.trim(), isDefault: f.def.checked });
      if (isNew) d2.addresses.push(x);
      const mine = d2.addresses.filter(y => y.user === x.user);
      if (x.isDefault) mine.forEach(y => { if (y !== x) y.isDefault = false; }); else if (!mine.some(y => y.isDefault)) x.isDefault = true;
      ADB.log(d2, isNew ? 'Thêm địa chỉ' : 'Sửa địa chỉ', `${x.name}: ${x.line}, ${x.province}`); ADB.save(d2);
      m.close(); toast('Đã lưu địa chỉ'); done();
    });
  }
  function storeForm(s, done) {
    const isNew = !s; s = s || { name: '', line: '', phone: '', type: 'Cửa hàng' };
    const m = modal(`<form novalidate><div class="card-head"><h3>${isNew ? 'Thêm cửa hàng, kho' : 'Sửa cửa hàng, kho'}</h3>${closeBtn}</div>
      <div class="form-grid">
        <div class="field full"><label>Tên</label><input class="input" name="name" value="${esc(s.name)}" required></div>
        <div class="field"><label>Loại</label><select class="input" name="type">${['Cửa hàng', 'Kho', 'Đại lý', 'Văn phòng'].map(t => opt(t, t, s.type)).join('')}</select></div>
        <div class="field"><label>Điện thoại</label><input class="input" name="phone" value="${esc(s.phone)}"></div>
        <div class="field full"><label>Địa chỉ</label><input class="input" name="line" value="${esc(s.line)}" required></div>
      </div><p class="red mt-1" data-err style="font-size:13px;min-height:1em"></p>
      <div class="row mt-1" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu</button></div></form>`);
    $('form', m.el).addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      if (!f.name.value.trim() || !f.line.value.trim()) { $('[data-err]', m.el).textContent = 'Anh chị nhập tên và địa chỉ.'; return; }
      const d2 = ADB.load(); d2.stores = d2.stores || [];
      const x = isNew ? { id: ADB.uid('st') } : d2.stores.find(y => y.id === s.id);
      Object.assign(x, { name: f.name.value.trim(), type: f.type.value, phone: f.phone.value.trim(), line: f.line.value.trim() });
      if (isNew) d2.stores.push(x);
      ADB.log(d2, isNew ? 'Thêm cửa hàng, kho' : 'Sửa cửa hàng, kho', x.name); ADB.save(d2);
      m.close(); toast('Đã lưu ' + x.type.toLowerCase()); done();
    });
  }
  ADMIN_MODULES.addresses = {
    render(el) {
      const d = ADB.load(), edit = ADMIN.can('members'), addr = d.addresses || [], stores = d.stores || [];
      const uname = id => (d.users.find(u => u.id === id) || {}).name || 'Tài khoản đã xóa';
      const q = norm(as.q), rows = addr.filter(a => !q || norm([uname(a.user), a.name, a.phone, a.line, a.province].join(' ')).includes(q));
      el.innerHTML = `<div class="card glow-cyan">
        <div class="card-head"><div><h3>Sổ địa chỉ khách hàng</h3><div class="sub">${addr.length} địa chỉ của ${new Set(addr.map(a => a.user)).size} khách</div></div></div>
        <div class="toolbar">
          <input class="input" data-q placeholder="Tìm tên khách, người nhận, địa chỉ, tỉnh" value="${esc(as.q)}">
          <span class="dim" style="font-size:13px">${rows.length} địa chỉ</span>
          <span class="row" style="gap:8px;margin-left:auto"><button class="btn btn-sm btn-outline-gold" type="button" data-csv>${icon('download')} Tải Excel (CSV)</button>${edit ? `<button class="btn btn-sm btn-gold" type="button" data-addaddr>${icon('plus')} Thêm địa chỉ</button>` : ''}</span>
        </div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Khách hàng</th><th>Người nhận</th><th>Địa chỉ</th><th>Tỉnh, thành</th><th></th></tr></thead><tbody>
        ${rows.map((a, i) => `<tr><td><div class="who"><span class="avatar ${['', 'v', 'g'][i % 3]}">${initials(uname(a.user))}</span><div><b>${esc(uname(a.user))}</b>${a.isDefault ? '<small><span class="gold">Mặc định</span></small>' : ''}</div></div></td>
          <td>${esc(a.name)}<br><small class="dim">${esc(a.phone)}</small></td><td>${esc(a.line)}</td><td class="nowrap">${esc(a.province)}</td>
          <td><div class="row" style="gap:6px;flex-wrap:nowrap;justify-content:flex-end">${edit ? `${a.isDefault ? '' : `<button class="btn btn-sm btn-ghost" type="button" data-def="${a.id}">Đặt mặc định</button>`}<button class="btn btn-sm" type="button" data-edit="${a.id}">${icon('edit')} Sửa</button><button class="btn btn-sm btn-ghost" type="button" data-del="${a.id}" aria-label="Xóa">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="5"><div class="empty">${icon('pin')}Không có địa chỉ phù hợp.</div></td></tr>`}
        </tbody></table></div>
      </div>
      <div class="card glow-gold mt-2">
        <div class="card-head"><div><h3>Cửa hàng và kho</h3><div class="sub">Địa điểm của ${esc(SITE.brand)} dùng cho nhận hàng, nhập kho</div></div>${edit ? `<button class="btn btn-sm btn-gold" type="button" data-addstore style="margin-left:auto">${icon('plus')} Thêm địa điểm</button>` : ''}</div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Tên</th><th>Loại</th><th>Địa chỉ</th><th>Điện thoại</th><th></th></tr></thead><tbody>
        ${stores.map(s => `<tr><td><div class="who"><span class="stat-ico ${s.type === 'Kho' ? 'violet' : 'gold'}" style="width:36px;height:36px">${icon(s.type === 'Kho' ? 'grid' : 'home')}</span><div><b>${esc(s.name)}</b></div></div></td><td><span class="badge ${s.type === 'Kho' ? 'violet' : 'gold'}">${esc(s.type)}</span></td><td>${esc(s.line)}</td><td class="nowrap">${esc(s.phone)}</td>
          <td><div class="row" style="gap:6px;flex-wrap:nowrap;justify-content:flex-end">${edit ? `<button class="btn btn-sm" type="button" data-sedit="${s.id}">${icon('edit')} Sửa</button><button class="btn btn-sm btn-ghost" type="button" data-sdel="${s.id}" aria-label="Xóa">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="5"><div class="empty">Chưa có địa điểm.</div></td></tr>`}
        </tbody></table></div>
      </div>`;
      const again = () => this.render(el);
      $('[data-q]', el).addEventListener('input', e => { as.q = e.target.value; again(); keepFocus(el, '[data-q]'); });
      $('[data-csv]', el).addEventListener('click', () => ADB.csv('so-dia-chi-khach', [['Khách hàng', 'Người nhận', 'Điện thoại', 'Địa chỉ', 'Tỉnh, thành', 'Mặc định'], ...rows.map(a => [uname(a.user), a.name, a.phone, a.line, a.province, a.isDefault ? 'Có' : ''])]));
      const on = (sel, fn) => $$(sel, el).forEach(b => b.addEventListener('click', () => fn(b)));
      on('[data-addaddr]', () => addrForm(d, null, again));
      on('[data-edit]', b => addrForm(d, addr.find(a => a.id === b.dataset.edit), again));
      on('[data-def]', b => {
        const d2 = ADB.load(), a = d2.addresses.find(x => x.id === b.dataset.def);
        d2.addresses.forEach(x => { if (x.user === a.user) x.isDefault = x === a; });
        ADB.log(d2, 'Sửa địa chỉ', `Đặt mặc định cho ${uname(a.user)}: ${a.line}`); ADB.save(d2); toast('Đã đặt địa chỉ mặc định'); again();
      });
      on('[data-del]', b => {
        const d2 = ADB.load(), i = d2.addresses.findIndex(x => x.id === b.dataset.del), a = d2.addresses[i];
        if (!confirm(`Xóa địa chỉ "${a.line}" của ${uname(a.user)}?`)) return;
        d2.addresses.splice(i, 1);
        const rest = d2.addresses.filter(x => x.user === a.user); if (a.isDefault && rest.length) rest[0].isDefault = true;
        ADB.log(d2, 'Xóa địa chỉ', `${uname(a.user)}: ${a.line}`); ADB.save(d2); toast('Đã xóa địa chỉ'); again();
      });
      on('[data-addstore]', () => storeForm(null, again));
      on('[data-sedit]', b => storeForm(stores.find(s => s.id === b.dataset.sedit), again));
      on('[data-sdel]', b => {
        const d2 = ADB.load(), i = d2.stores.findIndex(x => x.id === b.dataset.sdel), s = d2.stores[i];
        if (!confirm(`Xóa "${s.name}"?`)) return;
        d2.stores.splice(i, 1); ADB.log(d2, 'Xóa cửa hàng, kho', s.name); ADB.save(d2); toast('Đã xóa địa điểm'); again();
      });
    }
  };

  /* ---------- thiết lập hệ thống ---------- */
  ADMIN_MODULES.settings = {
    render(el) {
      const d = ADB.load(), S = Object.assign({}, ADB.DEFAULT_SETTINGS, d.settings || {}), edit = ADMIN.can('system');
      let levels = (S.commission || []).slice();
      const dis = edit ? '' : ' disabled';
      const f = (name, label, val, type = 'text', extra = '') => `<div class="field"><label for="hs-${name}">${label}</label><input class="input" id="hs-${name}" name="${name}" type="${type}" value="${esc(val)}"${extra}${dis}></div>`;
      el.innerHTML = `<form class="card glow-gold" data-set novalidate>
        <div class="card-head"><div><h3>Thiết lập hệ thống</h3><div class="sub">Áp dụng cho đơn hàng, hoa hồng, ví và thư gửi khách</div></div></div>
        <div class="form-grid">
          <div class="ht-sec full">Thông tin cửa hàng</div>
          ${f('shopName', 'Tên cửa hàng', S.shopName)}${f('hotline', 'Hotline', S.hotline, 'tel')}
          ${f('email', 'Email liên hệ', S.email, 'email')}${f('mailSender', 'Người gửi thư tự động', S.mailSender)}
          <div class="field full"><label for="hs-address">Địa chỉ</label><input class="input" id="hs-address" name="address" value="${esc(S.address)}"${dis}></div>
          <div class="ht-sec full mt-2">Điểm, hoa hồng và ví</div>
          ${f('pointRate', 'Tích điểm PS (% giá trị đơn)', +(S.pointRate * 100).toFixed(2), 'number', ' min="0" max="100" step="0.5"')}
          ${f('fundRate', 'Trích Quỹ tri ân (% doanh thu đơn hoàn thành)', S.fundRate, 'number', ' min="0" max="100" step="0.1"')}
          ${f('minWithdraw', 'Rút tiền tối thiểu (đồng)', S.minWithdraw, 'number', ' min="0" step="10000"')}
          <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="autoPlace"${S.autoPlace ? ' checked' : ''}${dis}> Tự xếp thành viên mới lên cây theo người giới thiệu</label>
          <div class="field full"><label>Hoa hồng theo tầng (% giá trị đơn)</label><div class="ht-levels" data-levels></div>
            ${edit ? `<div class="row mt-1" style="gap:10px;flex-wrap:wrap"><button class="btn btn-sm btn-ghost" type="button" data-addlvl>${icon('plus')} Thêm tầng</button><span class="dim" data-lvlsum style="font-size:12px"></span></div>` : ''}</div>
        </div>
        <p class="red mt-2" data-err style="font-size:13px;min-height:1em"></p>
        ${edit ? `<div class="row" style="justify-content:flex-end"><button class="btn btn-gold" type="submit">${icon('check')} Lưu thiết lập</button></div>` : '<p class="dim" style="font-size:13px">Vai trò của anh chị chỉ được xem thiết lập.</p>'}
      </form>
      ${edit ? `<div class="card ht-danger mt-2"><div class="card-head"><div><h3 class="red">Vùng nguy hiểm</h3><div class="sub">Khôi phục dữ liệu mẫu sẽ xóa đơn hàng, thành viên, ví, kho, nhật ký đang lưu trên trình duyệt này và tạo lại dữ liệu mẫu ban đầu.</div></div></div>
        <label class="check"><input type="checkbox" data-alsocontent> Khôi phục cả danh mục và bài viết kiến thức về mặc định</label>
        <div class="row mt-2"><button class="btn btn-outline-gold" type="button" data-reset style="border-color:rgba(255,107,107,.5);color:var(--red)">${icon('trash')} Khôi phục dữ liệu mẫu</button></div></div>` : ''}`;
      const form = $('[data-set]', el), box = $('[data-levels]', el);
      const drawLevels = () => {
        box.innerHTML = levels.map((v, i) => `<div class="ht-level"><b>F${i + 1}</b><input class="input" type="number" min="0" max="100" step="0.5" value="${v}" data-lvl="${i}" aria-label="Hoa hồng F${i + 1}"${dis}>${edit && levels.length > 1 ? `<button class="icon-btn" type="button" data-rmlvl="${i}" aria-label="Bỏ tầng F${i + 1}">${icon('close')}</button>` : '<span></span>'}</div>`).join('');
        const sum = $('[data-lvlsum]', el); if (sum) sum.textContent = `${levels.length} tầng, tổng ${+levels.reduce((s, v) => s + (+v || 0), 0).toFixed(2)}% mỗi đơn`;
      };
      drawLevels();
      box.addEventListener('input', e => { const i = e.target.dataset.lvl; if (i != null) { levels[+i] = e.target.value; const sum = $('[data-lvlsum]', el); if (sum) sum.textContent = `${levels.length} tầng, tổng ${+levels.reduce((s, v) => s + (+v || 0), 0).toFixed(2)}% mỗi đơn`; } });
      box.addEventListener('click', e => { const b = e.target.closest('[data-rmlvl]'); if (b) { levels.splice(+b.dataset.rmlvl, 1); drawLevels(); } });
      const al = $('[data-addlvl]', el); if (al) al.addEventListener('click', () => { if (levels.length >= 10) { toast('Tối đa 10 tầng'); return; } levels.push(Math.max(0, (+levels[levels.length - 1] || 1) - 1)); drawLevels(); });
      form.addEventListener('submit', e => {
        e.preventDefault(); if (!edit) return;
        const err = $('[data-err]', el), v = n => form[n].value.trim(), fail = (msg, n) => { err.textContent = msg; if (n) form[n].focus(); };
        if (!v('shopName')) return fail('Anh chị nhập tên cửa hàng.', 'shopName');
        if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return fail('Email liên hệ chưa đúng.', 'email');
        if (v('hotline') && !/^[0-9 +.]{8,15}$/.test(v('hotline'))) return fail('Số hotline chưa đúng.', 'hotline');
        if (!v('mailSender')) return fail('Anh chị nhập người gửi thư tự động.', 'mailSender');
        const pr = +v('pointRate'), fr = +v('fundRate'), mw = +v('minWithdraw');
        if (v('pointRate') === '' || !(pr >= 0 && pr <= 100)) return fail('Tỉ lệ tích điểm phải từ 0 đến 100%.', 'pointRate');
        if (v('fundRate') === '' || !(fr >= 0 && fr <= 100)) return fail('Tỉ lệ trích quỹ phải từ 0 đến 100%.', 'fundRate');
        if (v('minWithdraw') === '' || !(mw >= 0)) return fail('Mức rút tối thiểu không hợp lệ.', 'minWithdraw');
        const com = levels.map(Number);
        if (!com.length || com.some(x => !(x >= 0 && x <= 100) || levels.some(s => String(s).trim() === ''))) return fail('Mỗi tầng hoa hồng phải là số từ 0 đến 100%.');
        if (com.reduce((s, x) => s + x, 0) > 50) return fail('Tổng hoa hồng các tầng đang vượt 50% giá trị đơn. Anh chị kiểm tra lại.');
        err.textContent = '';
        const d2 = ADB.load();
        d2.settings = Object.assign({}, ADB.DEFAULT_SETTINGS, d2.settings || {}, {
          shopName: v('shopName'), hotline: v('hotline'), email: v('email'), address: v('address'), mailSender: v('mailSender'),
          pointRate: Math.round(pr * 100) / 10000, fundRate: fr, minWithdraw: Math.round(mw), autoPlace: form.autoPlace.checked, commission: com
        });
        ADB.log(d2, 'Thiết lập hệ thống', `Hoa hồng ${com.map((x, i) => 'F' + (i + 1) + ' ' + x + '%').join(', ')}; tích điểm ${pr}%; quỹ ${fr}%; rút tối thiểu ${money(mw)}`); ADB.save(d2);
        toast('Đã lưu thiết lập hệ thống');
      });
      const rb = $('[data-reset]', el);
      if (rb) rb.addEventListener('click', () => {
        const also = $('[data-alsocontent]', el).checked;
        if (!confirm('Khôi phục toàn bộ dữ liệu mẫu? Đơn hàng, thành viên, ví, kho và nhật ký hiện tại trên trình duyệt này sẽ bị xóa.')) return;
        if (also) ['psq_cats_v1', 'psq_postcats_v1', 'psq_posts_v1'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
        ADB.reset(); toast('Đã khôi phục dữ liệu mẫu'); setTimeout(() => location.reload(), 500);
      });
    }
  };
})();
