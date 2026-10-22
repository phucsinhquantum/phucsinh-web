/* Quản trị: thống kê tồn kho và phiếu nhập kho. Dữ liệu trong ADB (d.stock, d.stockMin, d.receipts). */
(function () {
  const { $, $$, esc, money, short, icon, toast, modal, art, fdate, today } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};

  if (!document.getElementById('adm-css-kho')) {
    const st = document.createElement('style'); st.id = 'adm-css-kho';
    st.textContent = `
      .kh-qty { width: 84px !important; height: 34px !important; text-align: center; padding: 0 6px !important; }
      .kh-min { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--text-2); }
      .kh-min .input { width: 80px; height: 36px; }
      .kh-line { display: grid; grid-template-columns: minmax(0, 1fr) 80px 130px 34px; gap: 8px; align-items: center; margin-bottom: 8px; }
      .kh-line .input { height: 40px; }
      .kh-line .icon-btn { width: 34px; height: 34px; }
      [data-pane="stock"] .tbl { min-width: 900px; } [data-pane="stock"] .who > div { min-width: 200px; } [data-pane="receipts"] .tbl { min-width: 820px; } [data-pane="receipts"] td:nth-child(4) { min-width: 200px; }
      .modal.kh-wide { width: min(760px, 100%); }
      .kh-sum { font-size: 18px; }
      @media (max-width: 599px) { .kh-line { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 34px; padding-bottom: 8px; border-bottom: 1px solid var(--line); } .kh-line select { grid-column: 1 / -1; } }`;
    document.head.appendChild(st);
  }

  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || id;
  const qtyOf = (d, id) => +(d.stock || {})[id] || 0;
  const level = (q, min) => q <= 0 ? ['Hết hàng', 'failed'] : q <= min ? ['Sắp hết', 'pending'] : ['Còn hàng', 'ok'];
  const REASONS = ['Kiểm kê định kỳ', 'Hàng hỏng, vỡ', 'Xuất mẫu trưng bày', 'Xuất bán ngoài hệ thống', 'Điều chỉnh sai lệch', 'Khác'];
  const st = { q: '', cat: '', lvl: '' };

  /* ---------- thống kê tồn kho ---------- */
  ADMIN_MODULES.stock = {
    render(el) {
      const d = ADB.load(), min = d.stockMin ?? 3, edit = ADMIN.can('stock');
      d.stock = d.stock || {};
      const all = PRODUCTS.map(p => ({ p, q: qtyOf(d, p.id) }));
      const units = all.reduce((s, x) => s + x.q, 0), value = all.reduce((s, x) => s + x.q * x.p.price, 0);
      const low = all.filter(x => x.q > 0 && x.q <= min).length, out = all.filter(x => x.q <= 0).length;
      const rows = all.filter(({ p, q }) => (!st.cat || p.cat === st.cat) && (!st.q || p.name.toLowerCase().includes(st.q.toLowerCase()))
        && (!st.lvl || (st.lvl === 'low' ? q > 0 && q <= min : st.lvl === 'out' ? q <= 0 : st.lvl === 'warn' ? q <= min : q > min)));
      const K = [['Tổng mặt hàng', all.length, 'grid', 'cyan', 'glow-cyan'], ['Tổng số lượng', units.toLocaleString('vi-VN'), 'bag', 'violet', 'glow-cyan'], ['Giá trị tồn (giá bán)', short(value), 'wallet', 'gold', 'glow-gold'], ['Sắp hết (≤ ' + min + ')', low, 'bell', 'gold', 'glow-gold'], ['Hết hàng', out, 'close', 'red', 'glow-cyan']];
      const recent = (d.logs || []).filter(l => l.action === 'Cập nhật tồn kho' || l.action === 'Nhập kho').slice(0, 6);
      el.innerHTML = `
        <div class="grid g-5">${K.map(([l, v, ic, c, g]) => `<div class="card ${g} stat"><div class="stat-top"><span class="stat-ico ${c}">${icon(ic)}</span>${l}</div><div class="stat-val">${v}</div></div>`).join('')}</div>
        <div class="card glow-mix mt-2">
          <div class="toolbar">
            <input class="input" data-f="q" placeholder="Tìm sản phẩm" value="${esc(st.q)}">
            <select class="input" data-f="cat"><option value="">Mọi danh mục</option>${CATEGORIES.map(c => `<option value="${c.id}"${c.id === st.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            <select class="input" data-f="lvl">${[['', 'Mọi mức tồn'], ['warn', 'Sắp hết và hết hàng'], ['low', 'Sắp hết'], ['out', 'Hết hàng'], ['ok', 'Còn hàng']].map(([v, t]) => `<option value="${v}"${v === st.lvl ? ' selected' : ''}>${t}</option>`).join('')}</select>
            <span class="dim" style="font-size:13px">${rows.length} mã</span>
            <button class="btn btn-sm btn-outline-gold" type="button" data-csv style="margin-left:auto">${icon('download')} Tải Excel (CSV)</button>
          </div>
          ${edit ? `<form class="kh-min mt-1" data-min style="margin-bottom:14px"><span>Cảnh báo sắp hết khi tồn kho từ</span><input class="input" type="number" min="0" max="999" name="min" value="${min}"><span>trở xuống</span><button class="btn btn-sm" type="submit">Lưu ngưỡng</button></form>` : ''}
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th><th>Giá trị tồn</th><th>Tình trạng</th>${edit ? '<th>Kiểm kê</th>' : ''}</tr></thead><tbody>
          ${rows.map(({ p, q }) => { const [ln, lc] = level(q, min); return `<tr>
            <td><div class="who"><span class="thumb">${art(p)}</span><div><b>${esc(p.name)}</b><small>${esc(p.id)}</small></div></div></td>
            <td class="dim">${esc(catName(p.cat))}</td><td class="nowrap">${money(p.price)}</td>
            <td><b class="${q <= 0 ? 'red' : q <= min ? 'gold' : ''}">${q}</b></td><td class="nowrap">${money(q * p.price)}</td>
            <td><span class="badge ${lc}">${ln}</span></td>
            ${edit ? `<td class="nowrap"><input class="input kh-qty" type="number" min="0" value="${q}" data-khqty="${esc(p.id)}" aria-label="Số lượng thực tế"> <button class="btn btn-sm" type="button" data-adj="${esc(p.id)}">Lưu</button></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="7"><div class="empty">Không có mặt hàng phù hợp.</div></td></tr>`}
          </tbody></table></div>
        </div>
        <div class="card glow-gold mt-2"><div class="card-head"><h3>Biến động kho gần đây</h3><a class="card-link" href="#receipts" data-go="receipts">Phiếu nhập kho</a></div>
          <div class="feed">${recent.map(l => `<div class="feed-item"><span class="feed-ico stat-ico ${l.action === 'Nhập kho' ? 'green' : 'gold'}">${icon(l.action === 'Nhập kho' ? 'download' : 'edit')}</span><div><b>${esc(l.detail)}</b><small>${esc(l.actor)} · ${esc(l.date)}</small></div></div>`).join('') || '<div class="empty">Chưa có biến động.</div>'}</div></div>`;

      $$('[data-f]', el).forEach(i => i.addEventListener(i.tagName === 'INPUT' ? 'input' : 'change', () => {
        st[i.dataset.f] = i.value; this.render(el); const n = $(`[data-f="${i.dataset.f}"]`, el); n.focus(); if (n.type === 'text' || !n.type) try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) {}
      }));
      $('[data-csv]', el).addEventListener('click', () => ADB.csv('ton-kho-psq-' + today(), [['Mã', 'Sản phẩm', 'Danh mục', 'Giá bán', 'Tồn kho', 'Giá trị tồn', 'Tình trạng'], ...rows.map(({ p, q }) => [p.id, p.name, catName(p.cat), p.price, q, q * p.price, level(q, min)[0]])]));
      const fm = $('[data-min]', el);
      if (fm) fm.addEventListener('submit', e => {
        e.preventDefault(); const v = Math.floor(+fm.min.value);
        if (!(v >= 0)) { toast('Ngưỡng cảnh báo chưa hợp lệ'); return; }
        const d2 = ADB.load(), old = d2.stockMin; d2.stockMin = v; ADB.log(d2, 'Cập nhật tồn kho', `Đổi ngưỡng cảnh báo sắp hết: ${old} → ${v}`); ADB.save(d2);
        toast('Đã lưu ngưỡng cảnh báo'); this.render(el);
      });
      $$('[data-adj]', el).forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.adj, p = PSQ.product(id), inp = $(`[data-khqty="${CSS.escape(id)}"]`, el), nv = Math.floor(+inp.value), ov = qtyOf(ADB.load(), id);
        if (!(nv >= 0)) { toast('Số lượng chưa hợp lệ'); return; }
        if (nv === ov) { toast('Số lượng không thay đổi'); return; }
        const m = modal(`<form><div class="card-head"><h3>Kiểm kê tồn kho</h3>${closeBtn}</div>
          <p><b>${esc(p.name)}</b></p><p class="muted mt-1">Hệ thống: <b>${ov}</b> → Thực tế: <b class="gold">${nv}</b> (${nv > ov ? '+' : ''}${nv - ov})</p>
          <div class="form-grid mt-2"><div class="field"><label>Lý do</label><select class="input" name="r">${REASONS.map(r => `<option>${r}</option>`).join('')}</select></div>
          <div class="field"><label>Ghi chú</label><input class="input" name="n" maxlength="120" placeholder="Không bắt buộc"></div></div>
          <div class="row mt-3" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Xác nhận</button></div></form>`);
        $('form', m.el).addEventListener('submit', e => {
          e.preventDefault(); const f = e.target, d2 = ADB.load(); d2.stock = d2.stock || {}; d2.stock[id] = nv;
          ADB.log(d2, 'Cập nhật tồn kho', `${p.name}: ${ov} → ${nv} (${f.r.value}${f.n.value.trim() ? ', ' + f.n.value.trim() : ''})`); ADB.save(d2);
          m.close(); toast('Đã cập nhật tồn kho'); this.render(el);
        });
      }));
    }
  };

  /* ---------- phiếu nhập kho ---------- */
  const rs = { q: '' };
  const pnNum = id => +String(id).replace(/\D/g, '') || 0;
  function viewReceipt(r) {
    modal(`<div class="card-head"><h3>Phiếu nhập ${esc(r.id)}</h3><span class="badge ok">Đã nhập kho</span>${closeBtn}</div>
      <dl class="kv"><dt>Ngày nhập</dt><dd>${fdate(r.date)}</dd><dt>Nhà cung cấp</dt><dd>${esc(r.supplier)}</dd><dt>Người lập</dt><dd>${esc(r.by)}</dd>${r.note ? `<dt>Ghi chú</dt><dd>${esc(r.note)}</dd>` : ''}</dl>
      <div class="divider"></div>
      <div class="table-wrap" style="margin:0"><table class="tbl" style="min-width:0"><thead><tr><th>Sản phẩm</th><th>SL</th><th>Giá nhập</th><th>Thành tiền</th></tr></thead><tbody>
      ${r.items.map(x => `<tr><td>${esc(x.name)}</td><td>${x.qty}</td><td class="nowrap">${money(x.cost)}</td><td class="nowrap">${money(x.qty * x.cost)}</td></tr>`).join('')}</tbody></table></div>
      <div class="divider"></div><div class="row between"><span class="muted">Tổng tiền hàng</span><b class="gold kh-sum">${money(r.total)}</b></div>`);
  }
  function newReceipt(done) {
    const d = ADB.load(), sups = [...new Set((d.receipts || []).map(r => r.supplier))];
    const opts = sel => PRODUCTS.map(p => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const defCost = id => { const p = PSQ.product(id); return p ? Math.round(p.price * .55 / 1000) * 1000 : 0; };
    const line = id => `<div class="kh-line"><select class="input" name="pid" aria-label="Sản phẩm">${opts(id)}</select><input class="input" name="qty" type="number" min="1" value="1" aria-label="Số lượng"><input class="input kh-cost" name="cost" type="number" min="0" step="1000" value="${defCost(id)}" aria-label="Giá nhập"><button class="icon-btn" type="button" data-rm aria-label="Bỏ dòng">${icon('trash')}</button></div>`;
    const m = modal(`<form novalidate><div class="card-head"><h3>Tạo phiếu nhập kho</h3>${closeBtn}</div>
      <div class="form-grid">
        <div class="field"><label>Nhà cung cấp</label><input class="input" name="sup" list="khSup" required placeholder="Tên nhà cung cấp"><datalist id="khSup">${sups.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
        <div class="field"><label>Ngày nhập</label><input class="input" type="date" name="date" value="${today()}"></div>
        <div class="field full"><label>Mặt hàng (sản phẩm, số lượng, giá nhập mỗi đơn vị)</label><div data-lines>${line(PRODUCTS[0].id)}</div>
          <button class="btn btn-sm btn-ghost" type="button" data-addline>${icon('plus')} Thêm dòng</button></div>
        <div class="field full"><label>Ghi chú</label><input class="input" name="note" maxlength="160"></div>
      </div>
      <div class="divider"></div><div class="row between"><span class="muted">Tổng tiền hàng</span><b class="gold kh-sum" data-total>0đ</b></div>
      <p class="red mt-1" data-err style="font-size:13px;min-height:1em"></p>
      <div class="row mt-1" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu và cộng vào kho</button></div></form>`);
    $('.modal', m.el).classList.add('kh-wide');
    const f = $('form', m.el), box = $('[data-lines]', m.el);
    const read = () => $$('.kh-line', box).map(l => ({ id: $('[name=pid]', l).value, qty: Math.floor(+$('[name=qty]', l).value), cost: Math.round(+$('[name=cost]', l).value) }));
    const sum = () => { $('[data-total]', m.el).textContent = money(read().reduce((s, x) => s + (x.qty > 0 ? x.qty * (x.cost || 0) : 0), 0)); };
    sum();
    $('[data-addline]', m.el).addEventListener('click', () => { const used = read().map(x => x.id), p = PRODUCTS.find(x => !used.includes(x.id)) || PRODUCTS[0]; box.insertAdjacentHTML('beforeend', line(p.id)); sum(); });
    box.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b && $$('.kh-line', box).length > 1) { b.parentElement.remove(); sum(); } });
    box.addEventListener('change', e => { if (e.target.name === 'pid') e.target.parentElement.querySelector('[name=cost]').value = defCost(e.target.value); sum(); });
    box.addEventListener('input', sum);
    f.addEventListener('submit', e => {
      e.preventDefault(); const err = $('[data-err]', m.el), sup = f.sup.value.trim();
      if (!sup) { err.textContent = 'Anh chị nhập tên nhà cung cấp.'; f.sup.focus(); return; }
      const raw = read();
      if (raw.some(x => !(x.qty > 0) || !(x.cost >= 0))) { err.textContent = 'Số lượng phải lớn hơn 0 và giá nhập không âm.'; return; }
      const items = [];
      raw.forEach(x => { const ex = items.find(y => y.id === x.id && y.cost === x.cost); if (ex) ex.qty += x.qty; else items.push({ id: x.id, name: PSQ.product(x.id).name, qty: x.qty, cost: x.cost }); });
      const d2 = ADB.load(); d2.receipts = d2.receipts || []; d2.stock = d2.stock || {};
      const id = 'PN' + (Math.max(200, ...d2.receipts.map(r => pnNum(r.id))) + 1);
      const me = PSQ.auth.user();
      const r = { id, date: f.date.value || today(), supplier: sup, items, total: items.reduce((s, x) => s + x.qty * x.cost, 0), by: me ? me.name : 'Quản trị viên', note: f.note.value.trim() };
      d2.receipts.unshift(r); items.forEach(x => { d2.stock[x.id] = (+d2.stock[x.id] || 0) + x.qty; });
      ADB.log(d2, 'Nhập kho', `Tạo phiếu nhập ${id}: ${items.reduce((s, x) => s + x.qty, 0)} sản phẩm, ${money(r.total)} từ ${sup}`); ADB.save(d2);
      m.close(); toast(`Đã tạo phiếu ${id} và cộng vào kho`); done();
    });
  }

  ADMIN_MODULES.receipts = {
    render(el) {
      const d = ADB.load(), all = (d.receipts || []).slice().sort((a, b) => b.date.localeCompare(a.date) || pnNum(b.id) - pnNum(a.id)), edit = ADMIN.can('stock');
      const q = rs.q.toLowerCase(), rows = all.filter(r => !q || [r.id, r.supplier, r.by, ...r.items.map(x => x.name)].join(' ').toLowerCase().includes(q));
      const m30 = ADB.daysAgo(30), last = all.filter(r => r.date >= m30);
      const K = [['Số phiếu', all.length, 'download', 'cyan', 'glow-cyan'], ['Phiếu 30 ngày', last.length, 'clock', 'violet', 'glow-cyan'], ['Tiền hàng 30 ngày', short(last.reduce((s, r) => s + r.total, 0)), 'wallet', 'gold', 'glow-gold'], ['Số lượng 30 ngày', last.reduce((s, r) => s + r.items.reduce((a, x) => a + x.qty, 0), 0), 'bag', 'green', 'glow-gold']];
      el.innerHTML = `<div class="grid g-4 keep-2">${K.map(([l, v, ic, c, g]) => `<div class="card ${g} stat"><div class="stat-top"><span class="stat-ico ${c}">${icon(ic)}</span>${l}</div><div class="stat-val">${v}</div></div>`).join('')}</div>
        <div class="card glow-mix mt-2">
          <div class="toolbar">
            <input class="input" data-q placeholder="Tìm mã phiếu, nhà cung cấp, sản phẩm" value="${esc(rs.q)}">
            <span class="dim" style="font-size:13px">${rows.length} phiếu</span>
            <span class="row" style="gap:8px;margin-left:auto"><button class="btn btn-sm btn-outline-gold" type="button" data-csv>${icon('download')} Tải Excel (CSV)</button>${edit ? `<button class="btn btn-sm btn-gold" type="button" data-new>${icon('plus')} Tạo phiếu nhập</button>` : ''}</span>
          </div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Mã phiếu</th><th>Ngày</th><th>Nhà cung cấp</th><th>Mặt hàng</th><th>Tổng tiền</th><th>Người lập</th><th></th></tr></thead><tbody>
          ${rows.map(r => `<tr><td><b>${esc(r.id)}</b></td><td class="dim nowrap">${fdate(r.date)}</td><td>${esc(r.supplier)}</td>
            <td class="dim" style="max-width:240px">${r.items.map(x => esc(x.name) + ' x' + x.qty).join('<br>')}</td><td class="gold nowrap">${money(r.total)}</td><td class="nowrap">${esc(r.by)}</td>
            <td><button class="btn btn-sm" type="button" data-view="${esc(r.id)}">Xem</button></td></tr>`).join('') || `<tr><td colspan="7"><div class="empty">${icon('download')}Chưa có phiếu nhập phù hợp.</div></td></tr>`}
          </tbody></table></div>
        </div>`;
      const qi = $('[data-q]', el);
      qi.addEventListener('input', () => { rs.q = qi.value; this.render(el); const n = $('[data-q]', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
      $('[data-csv]', el).addEventListener('click', () => {
        const out = [['Mã phiếu', 'Ngày', 'Nhà cung cấp', 'Sản phẩm', 'Số lượng', 'Giá nhập', 'Thành tiền', 'Người lập', 'Ghi chú']];
        rows.forEach(r => r.items.forEach(x => out.push([r.id, r.date, r.supplier, x.name, x.qty, x.cost, x.qty * x.cost, r.by, r.note])));
        ADB.csv('phieu-nhap-kho-psq', out);
      });
      $$('[data-view]', el).forEach(b => b.addEventListener('click', () => viewReceipt(all.find(r => r.id === b.dataset.view))));
      const nb = $('[data-new]', el); if (nb) nb.addEventListener('click', () => newReceipt(() => this.render(el)));
    }
  };
})();
