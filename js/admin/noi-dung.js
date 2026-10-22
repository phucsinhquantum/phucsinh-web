/* Quản trị: danh mục sản phẩm, danh mục kiến thức, bài viết kiến thức.
   Lưu trên trình duyệt (psq_cats_v1, psq_postcats_v1, psq_posts_v1). js/data.js đọc lại các khóa này để trang công khai hiện nội dung đã sửa. */
(function () {
  const { $, $$, esc, icon, toast, modal, store, art, fdate } = PSQ;
  window.ADMIN_MODULES = window.ADMIN_MODULES || {};
  const KEY = { cats: 'psq_cats_v1', postcats: 'psq_postcats_v1', posts: 'psq_posts_v1' };

  if (!document.getElementById('adm-css-noi-dung')) {
    const st = document.createElement('style'); st.id = 'adm-css-noi-dung';
    st.textContent = `
      .nd-ico { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; flex: none; background: rgba(243,199,107,.1); color: var(--gold); border: 1px solid rgba(243,199,107,.25); }
      .nd-ico svg { width: 18px; height: 18px; }
      .nd-up svg { transform: rotate(-90deg); } .nd-down svg { transform: rotate(90deg); }
      .nd-acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: nowrap; }
      .nd-acts .btn[disabled] { opacity: .35; pointer-events: none; }
      .nd-add { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .nd-add .input { flex: 1 1 200px; height: 40px; width: auto; }
      .nd-add select.input { flex: 0 1 180px; }
      .nd-cover { width: 64px; height: 44px; border-radius: 8px; background: #0c1114 center/cover no-repeat; border: 1px solid var(--line); flex: none; }
      [data-pane="categories"] .tbl, [data-pane="postcats"] .tbl { min-width: 600px; } [data-pane="posts"] .tbl { min-width: 860px; } [data-pane="categories"] .who > div, [data-pane="postcats"] .who > div { min-width: 150px; } [data-pane="posts"] .who > div { min-width: 220px; }
      .modal.nd-wide { width: min(820px, 100%); }
      .nd-prev { width: 100%; aspect-ratio: 16/7; border-radius: 10px; background: #0c1114 center/cover no-repeat; border: 1px solid var(--line); }
      .nd-body { min-height: 220px !important; font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; }
      .nd-hint { font-size: 12px; color: var(--text-3); }
      @media (max-width: 699px) { .nd-add .input, .nd-add select.input { flex: 1 1 100%; } }`;
    document.head.appendChild(st);
  }

  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const uniq = (base, taken) => { let id = base || 'muc', k = 2; while (taken.includes(id)) id = base + '-' + k++; return id; };
  const audit = (action, detail) => { const d = ADB.load(); ADB.log(d, action, detail); ADB.save(d); };
  const closeBtn = `<button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button>`;
  const ICONS = ['ring', 'gem', 'beads', 'award', 'leaf', 'gift', 'star', 'flame', 'sparkle', 'bag', 'book', 'grid', 'shield', 'home'];

  /* ---------- bài viết: danh sách đầy đủ (kể cả bài ẩn) ---------- */
  const allPosts = () => store.get(KEY.posts, null) || POSTS.map(p => ({ ...p }));
  function savePosts(list) {
    store.set(KEY.posts, list);
    POSTS.splice(0, POSTS.length, ...list.filter(p => !p.hidden));
  }

  /* ---------- danh mục dùng chung cho sản phẩm và kiến thức ---------- */
  function catPane(cfg) {
    return {
      render(el) {
        const arr = cfg.arr(), edit = ADMIN.can(cfg.perm);
        const total = arr.reduce((s, c) => s + cfg.count(c.id), 0);
        el.innerHTML = `
          <div class="card glow-gold">
            <div class="card-head"><div><h3>${cfg.title}</h3><div class="sub">${arr.length} danh mục · ${total} ${cfg.unit}. Thứ tự ở đây là thứ tự hiện trên web.</div></div><a class="card-link" href="${cfg.page}" target="_blank" rel="noopener">Xem trên web</a></div>
            ${edit ? `<form class="nd-add" data-ndadd>
              <input class="input" name="name" placeholder="Tên danh mục mới" required maxlength="60">
              ${cfg.icons ? `<select class="input" name="icon" aria-label="Biểu tượng">${ICONS.map(i => `<option value="${i}">Biểu tượng: ${i}</option>`).join('')}</select>` : ''}
              <button class="btn btn-gold btn-sm" type="submit">${icon('plus')} Thêm danh mục</button></form>` : ''}
            <div class="table-wrap mt-2"><table class="tbl"><thead><tr><th>#</th><th>Danh mục</th><th>${cfg.unit[0].toUpperCase() + cfg.unit.slice(1)}</th><th></th></tr></thead><tbody>
            ${arr.map((c, i) => { const n = cfg.count(c.id); return `<tr>
              <td class="dim">${i + 1}</td>
              <td><div class="who">${cfg.icons ? `<span class="nd-ico">${icon(c.icon || 'grid')}</span>` : cfg.thumb ? `<span class="nd-ico">${icon('book')}</span>` : ''}<div><b>${esc(c.name)}</b><small>${esc(c.id)}</small></div></div></td>
              <td><a class="cyan" href="${cfg.page}?cat=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">${n} ${cfg.unit}</a></td>
              <td>${edit ? `<div class="nd-acts">
                <button class="btn btn-sm nd-up" type="button" data-move="${i}|-1" ${i ? '' : 'disabled'} aria-label="Đưa lên">${icon('arrow')}</button>
                <button class="btn btn-sm nd-down" type="button" data-move="${i}|1" ${i < arr.length - 1 ? '' : 'disabled'} aria-label="Đưa xuống">${icon('arrow')}</button>
                <button class="btn btn-sm" type="button" data-edit="${i}">${icon('edit')} Sửa</button>
                <button class="btn btn-sm btn-ghost" type="button" data-del="${i}" ${n ? `disabled title="Còn ${n} ${cfg.unit}, chuyển sang danh mục khác trước khi xóa"` : ''} aria-label="Xóa">${icon('trash')}</button></div>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="4"><div class="empty">Chưa có danh mục.</div></td></tr>`}
            </tbody></table></div>
            <p class="dim mt-2" style="font-size:12px">Chỉ xóa được danh mục không còn ${cfg.unit}. Thay đổi lưu trên trình duyệt này để xem thử; khi có máy chủ sẽ áp dụng cho mọi khách.</p>
          </div>`;
        const save = (msg, detail) => { store.set(cfg.key, arr.map(c => ({ ...c }))); audit(cfg.logAction, detail); toast(msg); this.render(el); };
        const form = $('[data-ndadd]', el);
        if (form) form.addEventListener('submit', e => {
          e.preventDefault(); const f = new FormData(form), name = f.get('name').trim();
          if (!name) return;
          if (arr.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('Danh mục này đã có'); return; }
          const c = { id: uniq(slug(name), arr.map(x => x.id)), name };
          if (cfg.icons) c.icon = f.get('icon');
          arr.push(c); save('Đã thêm danh mục ' + name, 'Thêm danh mục ' + name);
        });
        $$('[data-move]', el).forEach(b => b.addEventListener('click', () => {
          const [i, k] = b.dataset.move.split('|').map(Number), j = i + k;
          [arr[i], arr[j]] = [arr[j], arr[i]]; save('Đã đổi thứ tự', 'Đổi thứ tự danh mục ' + arr[j].name);
        }));
        $$('[data-del]', el).forEach(b => b.addEventListener('click', () => {
          const c = arr[+b.dataset.del];
          if (cfg.count(c.id)) { toast('Danh mục còn ' + cfg.unit + ', không xóa được'); return; }
          if (!confirm(`Xóa danh mục "${c.name}"?`)) return;
          arr.splice(+b.dataset.del, 1); save('Đã xóa danh mục', 'Xóa danh mục ' + c.name);
        }));
        $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => {
          const c = arr[+b.dataset.edit];
          const m = modal(`<form><div class="card-head"><h3>Sửa danh mục</h3>${closeBtn}</div>
            <div class="form-grid">
              <div class="field full"><label>Tên danh mục</label><input class="input" name="name" value="${esc(c.name)}" required maxlength="60"></div>
              ${cfg.icons ? `<div class="field"><label>Biểu tượng</label><select class="input" name="icon">${ICONS.map(i => `<option${i === c.icon ? ' selected' : ''}>${i}</option>`).join('')}</select></div>
              <div class="field"><label>Xem trước</label><div class="row" style="gap:10px"><span class="nd-ico" data-ip>${icon(c.icon || 'grid')}</span><span class="dim" style="font-size:12px">Ảnh đại diện trên trang chủ lấy từ sản phẩm đầu tiên của danh mục.</span></div></div>` : ''}
              <div class="field full"><label>Mã (đường dẫn)</label><input class="input" value="${esc(c.id)}" disabled><span class="nd-hint">Mã giữ nguyên để không làm hỏng liên kết cũ.</span></div>
            </div>
            <div class="row mt-3" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">Lưu</button></div></form>`);
          const sel = $('[name=icon]', m.el); if (sel) sel.addEventListener('change', () => { $('[data-ip]', m.el).innerHTML = icon(sel.value); });
          $('form', m.el).addEventListener('submit', e => {
            e.preventDefault(); const f = new FormData(e.target), name = f.get('name').trim(); if (!name) return;
            const old = c.name; c.name = name; if (cfg.icons) c.icon = f.get('icon');
            m.close(); save('Đã lưu danh mục', old === name ? 'Sửa danh mục ' + name : `Đổi tên danh mục: ${old} → ${name}`);
          });
        }));
      }
    };
  }

  ADMIN_MODULES.categories = catPane({
    key: KEY.cats, arr: () => CATEGORIES, title: 'Danh mục sản phẩm', unit: 'sản phẩm', icons: true, perm: 'products', page: 'san-pham.html',
    count: id => PRODUCTS.filter(p => p.cat === id).length, logAction: 'Sửa danh mục sản phẩm'
  });
  ADMIN_MODULES.postcats = catPane({
    key: KEY.postcats, arr: () => POST_CATS, title: 'Danh mục kiến thức', unit: 'bài viết', thumb: true, perm: 'content', page: 'kien-thuc.html',
    count: id => allPosts().filter(p => p.cat === id).length, logAction: 'Sửa danh mục kiến thức'
  });

  /* ---------- bài viết ---------- */
  const toIso = s => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : PSQ.today(); };
  const toVn = iso => { const [y, mo, d] = String(iso).split('-'); return d && mo && y ? `${d}/${mo}/${y}` : iso; };
  const COVERS = ['img/intro/phuc-sinh-canh-nen-ngay-m.jpg', 'img/intro/phuc-sinh-canh-nen-m.jpg', 'img/intro/canh-1-may-nui-ngay-m.jpg', 'img/intro/canh-1-may-nui-m.jpg', 'img/intro/canh-3-cong-sang-m.jpg', ...PRODUCTS.filter(p => p.image).map(p => p.image)];
  const catName = id => (POST_CATS.find(c => c.id === id) || {}).name || id;
  const cleanUrl = s => String(s || '').trim().replace(/["'()\s]/g, '');
  const st = { q: '', cat: '', vis: '' };

  ADMIN_MODULES.posts = {
    render(el) {
      const list = allPosts(), edit = ADMIN.can('content');
      const norm = s => slug(s).replace(/-/g, ' ');
      const rows = list.filter(p => (!st.cat || p.cat === st.cat) && (!st.vis || (st.vis === 'hidden') === !!p.hidden) && (!st.q || norm(p.title + ' ' + p.excerpt).includes(norm(st.q))));
      el.innerHTML = `<div class="card glow-cyan">
        <div class="toolbar">
          <input class="input" data-f="q" placeholder="Tìm tiêu đề, tóm tắt" value="${esc(st.q)}">
          <select class="input" data-f="cat"><option value="">Mọi danh mục</option>${POST_CATS.map(c => `<option value="${c.id}"${c.id === st.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <select class="input" data-f="vis"><option value="">Mọi trạng thái</option><option value="shown"${st.vis === 'shown' ? ' selected' : ''}>Đang hiện</option><option value="hidden"${st.vis === 'hidden' ? ' selected' : ''}>Đã ẩn</option></select>
          <span class="dim" style="font-size:13px">${rows.length} / ${list.length} bài</span>
          <span class="row" style="gap:8px;margin-left:auto"><button class="btn btn-sm btn-outline-gold" type="button" data-csv>${icon('download')} Tải Excel (CSV)</button>${edit ? `<button class="btn btn-sm btn-gold" type="button" data-new>${icon('plus')} Viết bài mới</button>` : ''}</span>
        </div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Bài viết</th><th>Danh mục</th><th>Ngày</th><th>Đọc</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${rows.map(p => `<tr>
          <td><div class="who"><span class="nd-cover" style="background-image:url(${esc(cleanUrl(p.cover))})"></span><div><b>${esc(p.title)}</b><small>${esc(p.id)}</small></div></div></td>
          <td><span class="badge ship">${esc(catName(p.cat))}</span></td>
          <td class="nowrap dim">${esc(p.date)}</td><td class="nowrap">${p.read || 1} phút</td>
          <td class="nowrap">${p.hidden ? '<span class="badge failed">Đã ẩn</span>' : '<span class="badge ok">Đang hiện</span>'}${p.featured ? ' <span class="badge gold">Nổi bật</span>' : ''}</td>
          <td><div class="nd-acts">
            <a class="btn btn-sm btn-ghost" href="bai-viet.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" aria-label="Xem trên web">${icon('eye')}</a>
            ${edit ? `<button class="btn btn-sm" type="button" data-edit="${esc(p.id)}">${icon('edit')} Sửa</button>
            <button class="btn btn-sm" type="button" data-hide="${esc(p.id)}">${p.hidden ? 'Hiện' : 'Ẩn'}</button>
            <button class="btn btn-sm btn-ghost" type="button" data-del="${esc(p.id)}" aria-label="Xóa">${icon('trash')}</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="6"><div class="empty">${icon('book')}Không có bài viết phù hợp.</div></td></tr>`}
        </tbody></table></div>
        <p class="dim mt-2" style="font-size:12px">Bài ẩn không hiện ở trang Kiến thức, trang chủ và không mở được bằng đường dẫn. Bài nổi bật hiện lớn đầu trang Kiến thức.</p>
      </div>`;
      $$('[data-f]', el).forEach(i => i.addEventListener(i.tagName === 'INPUT' ? 'input' : 'change', () => {
        st[i.dataset.f] = i.value; const pos = i.selectionStart; this.render(el);
        const n = $(`[data-f="${i.dataset.f}"]`, el); n.focus(); if (n.setSelectionRange && pos != null) n.setSelectionRange(pos, pos);
      }));
      $('[data-csv]', el).addEventListener('click', () => ADB.csv('bai-viet-kien-thuc', [['Mã', 'Tiêu đề', 'Danh mục', 'Ngày', 'Phút đọc', 'Trạng thái', 'Tóm tắt'], ...rows.map(p => [p.id, p.title, catName(p.cat), p.date, p.read, p.hidden ? 'Đã ẩn' : 'Đang hiện', p.excerpt])]));
      const nb = $('[data-new]', el); if (nb) nb.addEventListener('click', () => this.edit(el, null));
      $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => this.edit(el, list.find(p => p.id === b.dataset.edit))));
      $$('[data-hide]', el).forEach(b => b.addEventListener('click', () => {
        const p = list.find(x => x.id === b.dataset.hide);
        if (!p.hidden && list.filter(x => !x.hidden).length <= 1) { toast('Cần giữ ít nhất một bài đang hiện'); return; }
        p.hidden = !p.hidden; savePosts(list); audit(p.hidden ? 'Ẩn bài viết' : 'Hiện bài viết', p.title);
        toast(p.hidden ? 'Đã ẩn bài viết' : 'Bài viết đã hiện lại'); this.render(el);
      }));
      $$('[data-del]', el).forEach(b => b.addEventListener('click', () => {
        const i = list.findIndex(x => x.id === b.dataset.del), p = list[i];
        if (!p.hidden && list.filter(x => !x.hidden).length <= 1) { toast('Cần giữ ít nhất một bài đang hiện'); return; }
        if (!confirm(`Xóa hẳn bài "${p.title}"? Có thể chọn Ẩn nếu chỉ muốn tạm gỡ.`)) return;
        list.splice(i, 1); savePosts(list); audit('Xóa bài viết', p.title); toast('Đã xóa bài viết'); this.render(el);
      }));
    },
    edit(el, p) {
      const isNew = !p, list = allPosts();
      p = p ? list.find(x => x.id === p.id) : { id: '', cat: (POST_CATS[0] || {}).id || '', title: '', excerpt: '', body: '', cover: COVERS[0], date: toVn(PSQ.today()), read: 0 };
      const m = modal(`<form novalidate><div class="card-head"><h3>${isNew ? 'Viết bài mới' : 'Sửa bài viết'}</h3>${closeBtn}</div>
        <div class="form-grid">
          <div class="field full"><label>Tiêu đề</label><input class="input" name="title" value="${esc(p.title)}" required maxlength="140"></div>
          <div class="field"><label>Danh mục</label><select class="input" name="cat">${POST_CATS.map(c => `<option value="${c.id}"${c.id === p.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Ngày đăng</label><input class="input" type="date" name="date" value="${toIso(p.date)}"></div>
          <div class="field full"><label>Ảnh bìa (đường dẫn trong img/ hoặc https://...)</label><input class="input" name="cover" list="ndCovers" value="${esc(p.cover || '')}"><datalist id="ndCovers">${COVERS.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
          <div class="field full"><div class="nd-prev" data-prev style="background-image:url(${esc(cleanUrl(p.cover))})"></div></div>
          <div class="field full"><label>Tóm tắt (hiện dưới tiêu đề và ở thẻ bài)</label><textarea class="input" name="excerpt" style="min-height:80px" maxlength="300">${esc(p.excerpt)}</textarea></div>
          <div class="field full"><label>Nội dung (HTML)</label><textarea class="input nd-body" name="body">${esc(p.body)}</textarea>
            <span class="nd-hint">Dùng thẻ &lt;p&gt; cho đoạn văn, &lt;h2&gt; &lt;h3&gt; cho tiêu đề mục, &lt;ul&gt;&lt;li&gt; cho danh sách, &lt;blockquote&gt; cho trích dẫn. Không nêu công dụng chữa bệnh.</span></div>
          <div class="field"><label>Thời gian đọc (phút, để 0 sẽ tự tính)</label><input class="input" type="number" min="0" max="60" name="read" value="${p.read || 0}"></div>
          <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="featured"${p.featured ? ' checked' : ''}> Đặt làm bài nổi bật</label>
        </div>
        <p class="red mt-1" data-err style="font-size:13px;min-height:1em"></p>
        <div class="row mt-2" style="justify-content:flex-end"><button class="btn" type="button" data-close>Hủy</button><button class="btn btn-gold" type="submit">${isNew ? 'Đăng bài' : 'Lưu thay đổi'}</button></div></form>`);
      $('.modal', m.el).classList.add('nd-wide');
      const f = $('form', m.el);
      f.cover.addEventListener('input', () => { $('[data-prev]', m.el).style.backgroundImage = `url(${cleanUrl(f.cover.value)})`; });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const title = f.title.value.trim(), body = f.body.value.trim(), err = $('[data-err]', m.el);
        if (!title) { err.textContent = 'Anh chị nhập tiêu đề bài viết.'; f.title.focus(); return; }
        if (!f.cat.value) { err.textContent = 'Cần tạo danh mục kiến thức trước.'; return; }
        if (!body) { err.textContent = 'Nội dung bài viết đang trống.'; f.body.focus(); return; }
        const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
        const np = Object.assign(p, {
          title, cat: f.cat.value, date: toVn(f.date.value || PSQ.today()), cover: cleanUrl(f.cover.value) || COVERS[0],
          excerpt: f.excerpt.value.trim(), body: /^</.test(body) ? body : body.split(/\n{2,}/).map(t => `<p>${esc(t)}</p>`).join('\n'),
          read: +f.read.value || Math.max(1, Math.round(words / 220)), featured: f.featured.checked
        });
        if (np.featured) list.forEach(x => { if (x !== np) delete x.featured; }); else delete np.featured;
        if (isNew) { np.id = uniq(slug(title), list.map(x => x.id)); list.unshift(np); }
        savePosts(list); audit(isNew ? 'Thêm bài viết' : 'Sửa bài viết', title);
        m.close(); toast(isNew ? 'Đã đăng bài viết' : 'Đã lưu bài viết'); this.render(el);
      });
    }
  };
})();
