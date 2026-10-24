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
      .ht-unit { position: relative; } .ht-unit .input { padding-right: 34px; } .ht-unit span { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); font-size: 13px; pointer-events: none; }
      .ht-help { display: block; font-size: 11.5px; margin-top: 4px; line-height: 1.45; }
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
  const mailStatus = { sent: ['Đã gửi', 'ok'], failed: ['Lỗi gửi', 'failed'], queued: ['Đang chờ', 'pending'], sending: ['Đang gửi', 'pending'] };
  function mailBody(d, m) {
    if (m.html) return `<div class="ht-mail" style="background:#fff;color:#222;padding:16px;border-radius:10px">${m.html}</div>`;
    const S = d.settings || {}, u = d.users.find(x => x.email === m.to), name = u ? u.name : 'anh chị';
    const oid = (m.subject.match(/PSQ\d+/) || [])[0], o = oid && d.orders.find(x => x.id === oid);
    let main;
    if (o) main = `<p>Phúc Sinh QuanTum đã nhận đơn hàng <b>#${esc(o.id)}</b> của anh chị ngày ${fdate(o.date)}.</p>
      <table>${o.items.map(x => `<tr><td>${esc(x.name)} x${x.qty}</td><td>${money(x.price * x.qty)}</td></tr>`).join('')}<tr><td><b>Tổng cộng</b></td><td><b>${money(o.total)}</b></td></tr></table>
      <p>Giao đến: ${esc(o.address || '')}. Thanh toán: ${o.pay === 'bank' ? 'chuyển khoản' : o.pay === 'wallet' ? 'bằng ví điểm' : 'khi nhận hàng'}.</p><p>Nhân viên sẽ gọi xác nhận trong thời gian sớm nhất.</p>
      <p><span class="ht-btn">Xem đơn hàng</span></p>`;
    else if (m.type === 'Đăng ký') main = `<p>Cảm ơn anh chị đã đăng ký thành viên ${esc(S.shopName || SITE.brand)}.</p>${u && u.code ? `<p>Mã giới thiệu của anh chị: <b>${esc(u.code)}</b>. Chia sẻ mã này để người thân nhận ưu đãi khi đăng ký.</p>` : ''}
      <p>Kích hoạt gói cộng tác viên để nhận hoa hồng bán hàng, trở thành đại lý hưởng thu nhập không giới hạn.</p><p><span class="ht-btn">Vào trang thành viên</span></p>`;
    else main = `<p>${esc(m.subject)}.</p><p>Nội dung chi tiết theo mẫu thư "${esc(m.type)}" của hệ thống. (mẫu)</p>`;
    return `<div class="ht-mail"><div class="ht-mail-h">${esc(S.shopName || SITE.brand)}</div>
      <div class="ht-mail-b"><p>Kính gửi ${esc(name)},</p>${main}<p>Trân trọng,<br>Đội ngũ ${esc(S.shopName || SITE.brand)}</p></div>
      <div class="ht-mail-f">Hotline ${esc(S.hotline || SITE.phone)} · ${esc(S.email || SITE.email)}<br>${esc(S.address || SITE.address)}</div></div>`;
  }
  function resend(id, done) {
    const r = API.act('mailResend', { id });
    if (r.error) return toast(r.error, 'err');
    toast('Đã gửi lại thư'); done();
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
  // [khóa trong d.settings.plan, nhãn, kiểu, ghi chú]
  const PLAN_FIELDS = [
    ['pkgPrice', 'Giá gói kích hoạt CTV', 'money', 'Khách mua gói này để trở thành cộng tác viên.'],
    ['pkgPoints', 'Điểm nhận khi kích hoạt', 'money', 'Cộng vào ví điểm mua hàng. Phần còn lại của giá gói là phí nền tảng.'],
    ['refBonus', 'Thưởng giới thiệu CTV', 'money', 'Người giới thiệu (CTV hoặc đại lý) nhận khi người mới kích hoạt gói. Khoản này không tính là thu nhập để tuyến trên hưởng.'],
    ['ctvRate', 'Hoa hồng của CTV', 'pct', 'Trên mọi đơn mua hàng của người mình giới thiệu trực tiếp (khách hàng, CTV hay đại lý), trả khi đơn Hoàn thành.'],
    ['agentRate', 'Hoa hồng của đại lý', 'pct', 'Trên đơn của người mình giới thiệu trực tiếp.'],
    ['overrideRate', 'Thu nhập từ đại lý tuyến dưới', 'pct', 'Đại lý nhận % thu nhập từ đơn mua hàng của đại lý mình giới thiệu, tính dồn lên các đại lý tuyến trên. Thưởng giới thiệu CTV không tính.'],
    ['overrideShop', 'Phần vào ví mua hàng', 'pct', 'Tỉ lệ của khoản thu nhập trên vào ví mua hàng, còn lại vào ví điểm thưởng.'],
    ['taxRate', 'Thuế thu nhập', 'pct', 'Trừ khi rút ví hoa hồng và khi chuyển điểm thưởng sang khả dụng.'],
    ['agentThreshold', 'Mốc lên đại lý', 'money', 'Tổng tiền mua đã thanh toán cộng dồn để tự lên đại lý.'],
    ['pkgCountsAs', 'Phần của gói tính vào doanh số mua hàng', 'money', 'Khi tính mốc lên đại lý, mỗi gói kích hoạt được tính số tiền này. Để 0 là gói không tính vào doanh số.'],
    ['activeDays', 'Chu kỳ xét điều kiện đại lý', 'days', 'Trong số ngày này, đại lý phải có đơn tự mua hoặc đơn bán (theo quy tắc bên dưới) mới nhận thu nhập từ đại lý tuyến dưới.'],
    ['activeMinBuy', 'Đơn tự mua tối thiểu', 'money', 'Giá trị tối thiểu của đơn tự mua để tính là đủ điều kiện. 0 là đơn nào cũng tính.'],
    ['activeMinSell', 'Đơn bán tối thiểu', 'money', 'Giá trị tối thiểu của đơn do người mình giới thiệu trực tiếp mua. 0 là đơn nào cũng tính.'],
    ['holdDays', 'Thời gian giữ chờ', 'days', 'Áp dụng khi chọn giữ chờ: quá số ngày này mà chưa đủ điều kiện thì khoản đó bị hủy.'],
    ['agentPkgPrice', 'Giá gói đại lý', 'money', 'Khách mua gói này là lên Đại lý ngay khi công ty xác nhận thanh toán. Gói không tính hoa hồng.'],
    ['agentPkgPoints', 'Điểm nhận khi mua gói đại lý', 'money', 'Cộng vào ví mua hàng để lấy hàng dần. Hoa hồng tính khi dùng điểm này đặt đơn.']
  ];
  const MODES = [['hold', 'Giữ chờ, đủ điều kiện thì nhận'], ['lose', 'Không nhận (ghi bỏ lỡ)'], ['up', 'Chuyển cho đại lý đủ điều kiện ở tuyến trên']];
  ADMIN_MODULES.settings = {
    render(el) {
      const d = ADB.load(), S = Object.assign({}, ADB.DEFAULT_SETTINGS, d.settings || {}), edit = ADMIN.can('system');
      const P = ADB.plan(d);
      const dis = edit ? '' : ' disabled';
      const pf = (k, label, val, kind, help) => `<div class="field"><label for="hs-p_${k}">${label}</label><div class="ht-unit"><input class="input" id="hs-p_${k}" name="p_${k}" type="number" min="0"${kind === 'pct' ? ' max="100" step="0.5"' : kind === 'days' ? ' max="365" step="1"' : ' step="1000"'} value="${esc(val)}"${dis}><span>${kind === 'pct' ? '%' : kind === 'days' ? 'ngày' : 'đ'}</span></div><small class="dim ht-help">${help}</small></div>`;
      const f = (name, label, val, type = 'text', extra = '') => `<div class="field"><label for="hs-${name}">${label}</label><input class="input" id="hs-${name}" name="${name}" type="${type}" value="${esc(val)}"${extra}${dis}></div>`;
      el.innerHTML = `<form class="card glow-gold" data-set novalidate>
        <div class="card-head"><div><h3>Thiết lập hệ thống</h3><div class="sub">Áp dụng cho đơn hàng, hoa hồng, ví và thư gửi khách</div></div></div>
        <div class="form-grid">
          <div class="ht-sec full">Thông tin cửa hàng</div>
          <p class="dim full" style="font-size:12.5px;margin:0">Lưu xong, thông tin dưới đây đổi ở mọi nơi trên web: chân trang, trang Liên hệ, nút gọi và Zalo, thông tin chuyển khoản ở trang đặt hàng và ví.</p>
          ${f('shopName', 'Tên cửa hàng', S.shopName || SITE.brand)}${f('hotline', 'Hotline', S.hotline || SITE.phone, 'tel')}
          ${f('zalo', 'Số Zalo', SITE.zalo, 'tel')}${f('email', 'Email liên hệ', S.email || SITE.email, 'email')}
          ${f('hours', 'Giờ mở cửa', SITE.hours)}${f('mailSender', 'Người gửi thư tự động', S.mailSender)}
          <div class="field full"><label for="hs-address">Địa chỉ</label><input class="input" id="hs-address" name="address" value="${esc(S.address || SITE.address)}"${dis}></div>
          <div class="field full"><label for="hs-mapEmbed">Link nhúng Google Maps (không bắt buộc)</label><input class="input" id="hs-mapEmbed" name="mapEmbed" value="${esc(SITE.mapEmbed || '')}" placeholder="https://www.google.com/maps/embed?..."${dis}></div>
          <div class="ht-sec full mt-2">Tài khoản nhận chuyển khoản</div>
          ${f('bankName', 'Ngân hàng', SITE.bank.name)}${f('bankAccount', 'Số tài khoản', SITE.bank.account)}
          ${f('bankOwner', 'Chủ tài khoản', SITE.bank.owner)}
          <div class="ht-sec full mt-2">Link mạng xã hội</div>
          <p class="dim full" style="font-size:12.5px;margin:0">Để trống mục nào thì mục đó hiện "sắp ra mắt" ở trang Liên hệ và ẩn ở chân trang.</p>
          ${f('facebook', 'Facebook', SITE.social.facebook, 'url', ' placeholder="https://facebook.com/..."')}${f('messenger', 'Messenger (tên trang hoặc link m.me)', SITE.messenger)}
          ${f('zaloOA', 'Zalo OA', SITE.social.zalo, 'url', ' placeholder="https://zalo.me/..."')}${f('youtube', 'YouTube', SITE.social.youtube, 'url', ' placeholder="https://youtube.com/@..."')}
          ${f('tiktok', 'TikTok', SITE.social.tiktok, 'url', ' placeholder="https://tiktok.com/@..."')}
          <div class="ht-sec full mt-2">Kế hoạch trả thưởng</div>
          <p class="dim full" style="font-size:12.5px;margin:0">1 điểm PS = 1 đồng. Thay đổi chỉ áp dụng cho đơn hàng ghi nhận sau khi lưu, không tính lại các khoản đã trả.</p>
          ${PLAN_FIELDS.map(([k, label, kind, help]) => pf(k, label, P[k], kind, help)).join('')}
          <div class="field"><label for="hs-p_activeRule">Quy tắc điều kiện đại lý</label><select class="input" id="hs-p_activeRule" name="p_activeRule"${dis}>${[['any', 'Chỉ cần 1 trong 2: tự mua hoặc có đơn bán'], ['all', 'Phải có cả tự mua và đơn bán']].map(([k, l]) => `<option value="${k}"${(P.activeRule || 'any') === k ? ' selected' : ''}>${l}</option>`).join('')}</select><small class="dim ht-help">Xét trong chu kỳ ở trên.</small></div>
          <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="p_agentPkgOn"${P.agentPkgOn ? ' checked' : ''}${dis}> Cho phép đăng ký đại lý ngay bằng gói đại lý</label>
          <div class="field"><label for="hs-p_overrideMode">Đại lý chưa đủ điều kiện</label><select class="input" id="hs-p_overrideMode" name="p_overrideMode"${dis}>${MODES.map(([k, l]) => `<option value="${k}"${P.overrideMode === k ? ' selected' : ''}>${l}</option>`).join('')}</select><small class="dim ht-help">Cách xử lý khoản thu nhập từ đại lý tuyến dưới khi đại lý chưa đủ điều kiện.</small></div>
          <div class="ht-sec full mt-2">Ví và điểm</div>
          ${f('minWithdraw', 'Rút tiền tối thiểu (đồng)', S.minWithdraw, 'number', ' min="0" step="10000"')}
          <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="autoPlace"${S.autoPlace ? ' checked' : ''}${dis}> Tự xếp thành viên mới lên cây theo người giới thiệu</label>
        </div>
        <p class="red mt-2" data-err style="font-size:13px;min-height:1em"></p>
        ${edit ? `<div class="row" style="justify-content:flex-end"><button class="btn btn-gold" type="submit">${icon('check')} Lưu thiết lập</button></div>` : '<p class="dim" style="font-size:13px">Vai trò của anh chị chỉ được xem thiết lập.</p>'}
      </form>
      ${ADB.isOwner(PSQ.auth.user()) ? `<div class="card glow-cyan mt-2" id="mailCfg"><div class="card-head"><div><h3>Email gửi thư tự động</h3><div class="sub">thư chào mừng, quên mật khẩu, xác nhận đơn hàng</div></div></div>
        <div id="mcBody"></div></div>` : ''}`;
      const form = $('[data-set]', el);
      form.addEventListener('submit', e => {
        e.preventDefault(); if (!edit) return;
        const err = $('[data-err]', el), v = n => form[n].value.trim(), fail = (msg, n) => { err.textContent = msg; if (n) form[n].focus(); };
        if (!v('shopName')) return fail('Anh chị nhập tên cửa hàng.', 'shopName');
        if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return fail('Email liên hệ chưa đúng.', 'email');
        if (v('hotline') && !/^[0-9 +.]{8,15}$/.test(v('hotline'))) return fail('Số hotline chưa đúng.', 'hotline');
        if (!v('mailSender')) return fail('Anh chị nhập người gửi thư tự động.', 'mailSender');
        if (v('zalo') && !/^[0-9 +.]{8,15}$/.test(v('zalo'))) return fail('Số Zalo chưa đúng.', 'zalo');
        for (const k of ['facebook', 'zaloOA', 'youtube', 'tiktok']) if (v(k) && !/^https?:\/\/\S+$/i.test(v(k))) return fail('Link phải bắt đầu bằng https://', k);
        if (v('mapEmbed') && !/^https:\/\/www\.google\.com\/maps\/embed\S*$/i.test(v('mapEmbed'))) return fail('Link nhúng bản đồ phải bắt đầu bằng https://www.google.com/maps/embed', 'mapEmbed');
        const mw = +v('minWithdraw');
        if (v('minWithdraw') === '' || !(mw >= 0)) return fail('Mức rút tối thiểu không hợp lệ.', 'minWithdraw');
        const plan = {};
        for (const [k, label, kind] of PLAN_FIELDS) {
          const n = +v('p_' + k);
          if (v('p_' + k) === '' || !isFinite(n)) return fail(`Anh chị nhập ${label.toLowerCase()}.`, 'p_' + k);
          if (kind === 'pct' && !(n >= 0 && n <= 100)) return fail(`${label} phải từ 0 đến 100%.`, 'p_' + k);
          if (kind === 'money' && !(n >= 0)) return fail(`${label} không được âm.`, 'p_' + k);
          if (kind === 'days' && !(n >= 1 && n <= 365)) return fail(`${label} phải từ 1 đến 365 ngày.`, 'p_' + k);
          plan[k] = kind === 'pct' ? Math.round(n * 100) / 100 : Math.round(n);
        }
        if (plan.pkgCountsAs > plan.pkgPrice) return fail('Phần của gói tính vào doanh số không được lớn hơn giá gói.', 'p_pkgCountsAs');
        if (plan.pkgPoints > plan.pkgPrice) return fail('Điểm nhận khi kích hoạt không được lớn hơn giá gói.', 'p_pkgPoints');
        if (plan.ctvRate > plan.agentRate) return fail('Hoa hồng của cộng tác viên đang cao hơn của đại lý. Anh chị kiểm tra lại.', 'p_ctvRate');
        if (plan.agentPkgPoints > plan.agentPkgPrice) return fail('Điểm nhận của gói đại lý không được lớn hơn giá gói.', 'p_agentPkgPoints');
        plan.overrideMode = form.p_overrideMode.value; plan.activeRule = form.p_activeRule.value; plan.agentPkgOn = form.p_agentPkgOn.checked ? 1 : 0;
        err.textContent = '';
        const d2 = ADB.load();
        d2.settings = Object.assign({}, ADB.DEFAULT_SETTINGS, d2.settings || {}, {
          shopName: v('shopName'), hotline: v('hotline'), email: v('email'), address: v('address'), mailSender: v('mailSender'),
          minWithdraw: Math.round(mw), autoPlace: form.autoPlace.checked,
          plan: Object.assign({}, ADB.PLAN, (d2.settings || {}).plan || {}, plan)
        });
        const site = { brand: v('shopName'), phone: v('hotline'), zalo: v('zalo'), email: v('email'), address: v('address'), hours: v('hours'), mapEmbed: v('mapEmbed'), messenger: v('messenger'),
          bank: { name: v('bankName'), account: v('bankAccount'), owner: v('bankOwner') }, social: { facebook: v('facebook'), zalo: v('zaloOA'), youtube: v('youtube'), tiktok: v('tiktok') } };
        try { localStorage.setItem('psq_site_v1', JSON.stringify(site)); } catch (er) {}
        ADB.log(d2, 'Thiết lập hệ thống', `Gói ${money(plan.pkgPrice)} (${money(plan.pkgPoints)} PS); giới thiệu ${money(plan.refBonus)}; CTV ${plan.ctvRate}%, đại lý ${plan.agentRate}%, thu nhập đại lý ${plan.overrideRate}% (${plan.overrideShop}% vào ví mua hàng); thuế ${plan.taxRate}%; lên đại lý ${money(plan.agentThreshold)}; gói tính vào doanh số ${money(plan.pkgCountsAs)}; rút tối thiểu ${money(mw)}`); ADB.save(d2);
        toast('Đã lưu thiết lập hệ thống');
      });
      // email gửi thư: mật khẩu ứng dụng chỉ lưu trên máy chủ, không hiện lại
      const mc = $('#mcBody', el);
      if (mc) {
        const draw = () => {
          const g = API.act('mailGet');
          mc.innerHTML = `<p class="${g.configured ? 'green' : 'gold'}" style="font-size:13.5px">${g.configured ? 'Đang gửi bằng ' + esc(g.user) : 'Chưa kết nối email. Thư chưa được gửi đi.'}</p>
            <ol class="dim" style="font-size:13px;padding-left:18px;line-height:1.6;margin:8px 0">
              <li>Đăng nhập Gmail dùng để gửi thư, bật <b>Xác minh 2 bước</b> (myaccount.google.com, mục Bảo mật).</li>
              <li>Mở <b>myaccount.google.com/apppasswords</b>, đặt tên "Web PSQ", bấm Tạo. Google hiện mật khẩu ứng dụng 16 ký tự.</li>
              <li>Dán vào ô bên dưới, bấm Lưu, rồi bấm Gửi thư thử.</li></ol>
            <form class="form-grid" id="mcF" autocomplete="off">
              <div class="field"><label>Gmail gửi thư</label><input class="input" name="user" type="email" value="${esc(g.user || SITE.email)}"></div>
              <div class="field"><label>Tên người gửi</label><input class="input" name="fromName" value="${esc(g.fromName || SITE.brand)}"></div>
              <div class="field full"><label>Mật khẩu ứng dụng 16 ký tự${g.configured ? ' (để trống nếu không đổi)' : ''}</label><input class="input" name="pass" type="password" autocomplete="new-password" spellcheck="false"></div>
              <p class="red full" id="mcE" style="font-size:13px;min-height:18px;margin:0"></p>
              <div class="row full" style="gap:8px"><button class="btn btn-gold btn-sm" type="submit">${icon('check')} Lưu</button>${g.configured ? `<button class="btn btn-sm" type="button" id="mcT">${icon('mail')} Gửi thư thử tới ${esc(PSQ.auth.user().email)}</button>` : ''}</div></form>`;
          $('#mcF', mc).addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), r = API.act('mailSet', f); if (r.error) return $('#mcE', mc).textContent = r.error; toast('Đã lưu email gửi thư'); draw(); });
          const t = $('#mcT', mc); if (t) t.addEventListener('click', () => { t.disabled = true; t.textContent = 'Đang gửi...'; const r = API.act('mailTest'); if (r.error) { $('#mcE', mc).textContent = r.error; t.disabled = false; t.textContent = 'Gửi lại thư thử'; } else { toast('Đã gửi thư thử tới ' + r.to + ', anh mở hộp thư kiểm tra'); draw(); } });
        };
        draw();
      }
    }
  };
})();
