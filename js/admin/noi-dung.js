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
    try { localStorage.setItem(KEY.posts, JSON.stringify(list)); }
    catch (e) { toast('Bộ nhớ trình duyệt đã đầy. Hãy bớt ảnh trong bài hoặc xóa bài cũ rồi lưu lại.'); return false; }
    POSTS.splice(0, POSTS.length, ...list.filter(p => !p.hidden));
    return true;
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


  /* ---------- trang soạn bài viết ---------- */
  // Kích thước ảnh khớp bố cục web:
  //  - Ảnh bìa: 1600 × 900 px (tỉ lệ 16:9). Thẻ bài ở trang chủ / Kiến thức hiện đúng 16:9; đầu trang bài viết cắt bớt trên dưới.
  //  - Ảnh trong bài: ngang 1200 px, cao tùy ý (khuyên 1200 × 800 px, tỉ lệ 3:2). Ảnh lớn hơn được tự thu nhỏ.
  const COVER_W = 1600, COVER_H = 900, BODY_W = 1200;
  const DRAFT = 'psq_post_draft_v1';
  function loadImg(file) {
    return new Promise((ok, fail) => { const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); img.naturalWidth ? ok(img) : fail(new Error('empty')); };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('decode')); }; img.src = url; });
  }
  // ảnh bìa: cắt giữa về đúng 16:9 rồi thu về 1600 × 900
  async function coverFrom(file) {
    const img = await loadImg(file), W = img.naturalWidth, H = img.naturalHeight, r = COVER_W / COVER_H;
    let sw = W, sh = W / r; if (sh > H) { sh = H; sw = H * r; }
    const c = document.createElement('canvas'); c.width = Math.min(COVER_W, Math.round(sw)); c.height = Math.round(c.width / r);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.82), w: W, h: H, small: W < COVER_W * 0.6 };
  }
  // ảnh trong bài: giữ tỉ lệ, ngang tối đa 1200
  async function bodyFrom(file) {
    const img = await loadImg(file), W = img.naturalWidth, H = img.naturalHeight, k = Math.min(1, BODY_W / W);
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext('2d'); g.fillStyle = '#0e1417'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.82), w: W, h: H };
  }
  const pick = () => new Promise(ok => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = () => ok(f.files && f.files[0]); f.click(); });
  // làm sạch HTML: chỉ giữ thẻ trình bày bài viết, bỏ script / style / thuộc tính lạ
  const ALLOW = { P: [], H2: [], H3: [], STRONG: [], B: [], EM: [], I: [], U: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [], A: ['href'], BR: [], FIGURE: [], FIGCAPTION: [], IMG: ['src', 'alt'], HR: [] };
  function clean(html) {
    const box = document.createElement('div'); box.innerHTML = html;
    (function walk(n) {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1) { c.remove(); return; }
        let tag = c.tagName;
        if (tag === 'DIV') { const p = document.createElement('p'); while (c.firstChild) p.appendChild(c.firstChild); c.replaceWith(p); c = p; tag = 'P'; }
        if (tag === 'H1') { const h = document.createElement('h2'); while (c.firstChild) h.appendChild(c.firstChild); c.replaceWith(h); c = h; tag = 'H2'; }
        if (/^(H4|H5|H6)$/.test(tag)) { const h = document.createElement('h3'); while (c.firstChild) h.appendChild(c.firstChild); c.replaceWith(h); c = h; tag = 'H3'; }
        if (!ALLOW[tag]) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|SVG|MATH)$/.test(tag)) c.remove(); else { walk(c); c.replaceWith(...c.childNodes); } return; }
        [...c.attributes].forEach(a => { if (!ALLOW[tag].includes(a.name)) c.removeAttribute(a.name); });
        if (tag === 'A') { const h = c.getAttribute('href') || ''; if (!/^(https?:|mailto:|tel:|[a-z0-9-]+\.html|#)/i.test(h)) c.removeAttribute('href'); else if (/^https?:/i.test(h)) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); } }
        if (tag === 'IMG') { const s = c.getAttribute('src') || ''; if (!/^(data:image\/(jpeg|png|webp|gif);base64,|https:\/\/|img\/)/i.test(s)) { c.remove(); return; } c.setAttribute('loading', 'lazy'); }
        walk(c);
      });
    })(box);
    box.querySelectorAll('p').forEach(x => { if (x.querySelector('ul,ol,figure,h2,h3,blockquote,p,hr')) x.replaceWith(...x.childNodes); });
    box.querySelectorAll('figcaption').forEach(x => { if (!x.closest('figure')) { const pr = x.previousElementSibling; if (pr && pr.tagName === 'FIGURE' && !pr.querySelector('figcaption')) pr.appendChild(x); else x.remove(); } });
    box.querySelectorAll('figure').forEach(x => { if (!x.querySelector('img')) x.remove(); });
    box.querySelectorAll('p,h2,h3,li,blockquote').forEach(x => { if (!x.textContent.trim() && !x.querySelector('img,br')) x.remove(); });
    return box.innerHTML.trim();
  }
  const kb = s => Math.round((s || '').length * 0.75 / 1024);
  const usedMB = () => { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {} return n * 2 / 1048576; };

  if (!document.getElementById('adm-css-soan-bai')) {
    const st2 = document.createElement('style'); st2.id = 'adm-css-soan-bai';
    st2.textContent = `
      .ed-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
      .ed-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
      .ed-head h3 { margin-right: auto; }
      .ed-title { width: 100%; font-family: var(--display); font-size: clamp(24px, 2.6vw, 34px); font-weight: 600; line-height: 1.2; background: transparent; border: 0; border-bottom: 1px solid var(--line-2); padding: 6px 0 12px; color: var(--text); outline: none; }
      .ed-title:focus { border-color: var(--gold); }
      .ed-bar { position: sticky; top: 8px; z-index: 6; display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; margin-top: 14px; border: 1px solid var(--line-2); border-radius: 12px 12px 0 0; background: rgba(10, 14, 16, .96); }
      .ed-bar button, .ed-bar select { height: 34px; min-width: 34px; padding: 0 9px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
      .ed-bar select { border-color: var(--line-2); background: rgba(255,255,255,.03); }
      .ed-bar button:hover, .ed-bar button.on { color: var(--gold); border-color: rgba(243,199,107,.4); background: rgba(243,199,107,.08); }
      .ed-bar button svg { width: 15px; height: 15px; }
      .ed-bar .sep { width: 1px; background: var(--line-2); margin: 4px 4px; }
      .ed-area { min-height: 460px; padding: 22px 24px; border: 1px solid var(--line-2); border-top: 0; border-radius: 0 0 12px 12px; background: rgba(0,0,0,.18); outline: none; max-width: none !important; overflow-wrap: anywhere; }
      .ed-area:focus { border-color: rgba(243,199,107,.45); }
      .ed-area:empty::before { content: attr(data-ph); color: var(--text-3); }
      .ed-area img { max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto; }
      .ed-area figure { margin: 18px 0; } .ed-area figcaption { font-size: 13px; color: var(--text-3); text-align: center; margin-top: 6px; }
      .ed-area a { color: var(--cyan); text-decoration: underline; }
      .ed-html { width: 100%; min-height: 460px; font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; border-radius: 0 0 12px 12px; }
      .ed-side { display: grid; gap: 14px; position: sticky; top: 8px; }
      .ed-side .card { padding: 16px; }
      .ed-side h4 { font-size: 14px; margin: 0 0 10px; color: var(--gold); }
      .ed-cover { position: relative; aspect-ratio: 16/9; border-radius: 12px; border: 1px dashed rgba(243,199,107,.45); background: #0c1114 center/cover no-repeat; display: grid; place-items: center; text-align: center; cursor: pointer; overflow: hidden; color: var(--text-3); font-size: 13px; }
      .ed-cover.has { border-style: solid; }
      .ed-cover.has > span { display: none; }
      .ed-size { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(79,230,223,.06); border: 1px solid rgba(79,230,223,.25); font-size: 12.5px; color: var(--text-2); line-height: 1.55; }
      .ed-size b { color: var(--cyan); }
      .ed-warn { color: var(--amber, #f3c76b); font-size: 12.5px; margin-top: 6px; }
      .ed-stats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--text-3); margin-top: 10px; }
      .ed-side .field + .field { margin-top: 10px; }
      .ed-pv .post-cover { border-radius: 12px 12px 0 0; }
      .ed-pv .post-card { pointer-events: none; }
      @media (max-width: 1180px) { .ed-wrap { grid-template-columns: 1fr; } .ed-side { position: static; } }
      @media (max-width: 699px) { .ed-area { padding: 16px; min-height: 340px; } .ed-head .btn { flex: 1 1 auto; } }`;
    document.head.appendChild(st2);
  }

  function editor(el, p0, back) {
    const isNew = !p0, list = allPosts();
    let p = p0 ? list.find(x => x.id === p0.id) : null;
    let draft = null; try { draft = JSON.parse(localStorage.getItem(DRAFT)); } catch (e) {}
    const base = p ? { ...p } : { id: '', cat: (POST_CATS[0] || {}).id || '', title: '', excerpt: '', body: '', cover: '', date: toVn(PSQ.today()), read: 0 };
    const useDraft = draft && draft.for === (p ? p.id : '') && draft.at && (draft.title || draft.body) && confirm('Có bản nháp chưa lưu của bài này (' + new Date(draft.at).toLocaleString('vi-VN') + '). Mở lại bản nháp?');
    const v = useDraft ? { ...base, ...draft } : base;
    let cover = v.cover || '', htmlMode = false, dirty = false;
    const B = (cmd, ic, label, arg) => `<button type="button" data-cmd="${cmd}"${arg ? ` data-arg="${arg}"` : ''} title="${label}" aria-label="${label}">${ic}</button>`;
    el.innerHTML = `<div class="card glow-cyan">
      <div class="ed-head"><h3>${isNew ? 'Viết bài mới' : 'Sửa bài viết'}</h3>
        <button class="btn btn-sm btn-ghost" type="button" data-back>${icon('back')} Danh sách bài</button>
        <button class="btn btn-sm" type="button" data-pv>${icon('eye')} Xem trước</button>
        <button class="btn btn-sm btn-outline-gold" type="button" data-save="hide">Lưu nháp (ẩn)</button>
        <button class="btn btn-sm btn-gold" type="button" data-save="show">${icon('check')} ${isNew ? 'Đăng bài' : 'Lưu và hiện'}</button></div>
      <div class="ed-wrap">
        <div>
          <input class="ed-title" id="edT" maxlength="140" placeholder="Nhập tiêu đề bài viết" value="${esc(v.title)}">
          <div class="field mt-2"><label for="edX">Tóm tắt (hiện dưới tiêu đề và trên thẻ bài, 1 đến 2 câu)</label><textarea class="input" id="edX" maxlength="300" style="min-height:70px">${esc(v.excerpt)}</textarea><span class="nd-hint" id="edXc"></span></div>
          <div id="edRx" class="mt-2"></div>
          <div class="ed-stats"><span id="edW"></span><span id="edS"></span><span id="edAuto"></span></div>
          <p class="nd-hint mt-1">Viết về văn hóa, cách chọn và bảo quản trầm. Không nêu công dụng chữa bệnh. Dán chữ từ Word hay web khác sẽ tự bỏ định dạng lạ.</p>
        </div>
        <aside class="ed-side">
          <div class="card"><h4>Ảnh bìa</h4>
            <div class="ed-cover${cover ? ' has' : ''}" id="edC" role="button" tabindex="0" style="${cover ? `background-image:url(${esc(cleanUrl(cover))})` : ''}"><span>${icon('plus')}<br>Bấm để tải ảnh bìa</span></div>
            <div class="row mt-1" style="gap:8px;flex-wrap:wrap"><button class="btn btn-sm" type="button" data-cpick>${cover ? 'Đổi ảnh' : 'Tải ảnh'}</button><button class="btn btn-sm btn-ghost" type="button" data-cnone ${cover ? '' : 'hidden'}>Bỏ ảnh</button>
              <select class="input" data-clib style="height:32px;font-size:12px;flex:1 1 140px;width:auto"><option value="">Hoặc chọn ảnh có sẵn</option>${COVERS.map((c, i) => `<option value="${esc(c)}">Ảnh có sẵn ${i + 1}</option>`).join('')}</select></div>
            <div class="ed-warn" id="edCw"></div>
            <div class="ed-size"><b>Kích thước ảnh bìa: 1600 × 900 px</b> (ngang 16 : cao 9), file JPG dưới 1 MB. Ảnh khác tỉ lệ sẽ được tự cắt ở giữa, nên đặt nội dung chính vào giữa ảnh.<br><b>Ảnh trong bài: ngang 1200 px</b>, cao tùy ý (đẹp nhất 1200 × 800 px). Ảnh lớn hơn được tự thu nhỏ.</div>
          </div>
          <div class="card"><h4>Thông tin đăng</h4>
            <div class="field"><label for="edCat">Danh mục</label><select class="input" id="edCat">${POST_CATS.map(c => `<option value="${c.id}"${c.id === v.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="edD">Ngày đăng</label><input class="input" type="date" id="edD" value="${toIso(v.date)}"></div>
            <div class="field"><label for="edR">Thời gian đọc (phút, để 0 sẽ tự tính)</label><input class="input" type="number" min="0" max="60" id="edR" value="${+v.read || 0}"></div>
            <label class="check mt-2"><input type="checkbox" id="edF"${v.featured ? ' checked' : ''}> Đặt làm bài nổi bật (hiện lớn đầu trang Kiến thức)</label>
            <div class="ed-stats"><span>Trạng thái: ${p ? (p.hidden ? '<b class="red">Đang ẩn</b>' : '<b class="green">Đang hiện</b>') : 'Bài mới'}</span><span id="edMem"></span></div>
          </div>
          <div class="card ed-pv"><h4>Thẻ bài sẽ hiện như sau</h4><div id="edPv"></div></div>
          <p class="red" id="edE" style="font-size:13px;min-height:1em;margin:0"></p>
        </aside>
      </div></div>`;
    const T = $('#edT', el), X = $('#edX', el);
    const rx = PSQED.mount($('#edRx', el), { html: v.body || '', placeholder: 'Bắt đầu viết nội dung tại đây. Dùng thanh công cụ phía trên để đổi kiểu chữ, màu, chèn ảnh, chèn sản phẩm, video...', minHeight: 460, onChange: () => autosave() });
    const ed = rx.area, body = () => rx.get();
    const stats = () => {
      const b = body(), words = b.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, imgs = (b.match(/<img/g) || []).length, prods = (b.match(/data-prod=/g) || []).length;
      $('#edW', el).textContent = `${words.toLocaleString('vi-VN')} chữ · khoảng ${Math.max(1, Math.round(words / 220))} phút đọc`;
      $('#edS', el).textContent = `${imgs} ảnh${prods ? ` · ${prods} sản phẩm` : ''} trong bài`;
      $('#edMem', el).textContent = '';
      $('#edXc', el).textContent = `${X.value.length} / 300 ký tự`;
      const c = POST_CATS.find(x => x.id === $('#edCat', el).value);
      $('#edPv', el).innerHTML = `<div class="card post-card" style="box-shadow:none"><div class="post-cover" style="background-image:url(${esc(cleanUrl(cover || COVERS[0]))})"></div><div class="post-body"><div class="post-meta"><span class="badge gold">${esc(c ? c.name : '')}</span></div><h3>${esc(T.value || 'Tiêu đề bài viết')}</h3><small class="dim">${esc(toVn($('#edD', el).value || PSQ.today()))} · ${+$('#edR', el).value || Math.max(1, Math.round(words / 220))} phút đọc</small></div></div>`;
    };
    // tự lưu nháp mỗi khi gõ (chỉ trên máy này)
    let at; const autosave = () => { dirty = true; clearTimeout(at); at = setTimeout(() => {
      if (!document.body.contains(T)) return;   // đã rời trang soạn
      try { localStorage.setItem(DRAFT, JSON.stringify({ for: p ? p.id : '', at: Date.now(), title: T.value, excerpt: X.value, body: body(), cover, cat: $('#edCat', el).value, date: toVn($('#edD', el).value), read: +$('#edR', el).value || 0, featured: $('#edF', el).checked })); $('#edAuto', el).textContent = 'Đã tự lưu nháp lúc ' + new Date().toLocaleTimeString('vi-VN'); }
      catch (e) { $('#edAuto', el).textContent = 'Không tự lưu được nháp (bộ nhớ đầy)'; }
      stats(); }, 700); };
    [T, X].forEach(n => n.addEventListener('input', autosave));
    ['edCat', 'edD', 'edR', 'edF'].forEach(id => $('#' + id, el).addEventListener('change', autosave));
    stats();

    // ảnh bìa
    const setCover = src => { cover = src; const c = $('#edC', el); c.classList.toggle('has', !!src); c.style.backgroundImage = src ? `url(${cleanUrl(src)})` : ''; $('[data-cpick]', el).textContent = src ? 'Đổi ảnh' : 'Tải ảnh'; $('[data-cnone]', el).hidden = !src; autosave(); stats(); };
    const upCover = async () => {
      const file = await pick(); if (!file) return; if (!/^image\//.test(file.type)) return toast('Hãy chọn một file ảnh');
      try { $('#edC', el).classList.add('rx-busy'); const r = await PSQED.upload(file, { w: COVER_W, crop: COVER_W / COVER_H }); r.small = r.w < COVER_W * 0.6; setCover(r.url);
        $('#edCw', el).textContent = r.small ? `Ảnh gốc ${r.w} × ${r.h} px hơi nhỏ, có thể bị mờ. Nên dùng ảnh 1600 × 900 px.` : Math.abs(r.w / r.h - 16 / 9) > 0.05 ? `Ảnh gốc ${r.w} × ${r.h} px khác tỉ lệ 16:9 nên đã được cắt ở giữa. Xem khung trên để kiểm tra.` : `Ảnh gốc ${r.w} × ${r.h} px, đúng tỉ lệ.`;
      } catch (x) { toast(x.message || 'Không đọc được ảnh này, thử ảnh JPG hoặc PNG khác', 'err'); }
      $('#edC', el).classList.remove('rx-busy');
    };
    $('#edC', el).addEventListener('click', upCover); $('#edC', el).addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); upCover(); } });
    $('[data-cpick]', el).addEventListener('click', upCover);
    $('[data-cnone]', el).addEventListener('click', () => { setCover(''); $('#edCw', el).textContent = ''; });
    $('[data-clib]', el).addEventListener('change', e => { if (e.target.value) { setCover(e.target.value); $('#edCw', el).textContent = ''; e.target.value = ''; } });

    // xem trước bài đầy đủ
    $('[data-pv]', el).addEventListener('click', () => {
      const c = POST_CATS.find(x => x.id === $('#edCat', el).value);
      const m = modal(`<div class="card-head"><div><span class="badge gold">${esc(c ? c.name : '')}</span><h3 class="mt-1">${esc(T.value || 'Tiêu đề bài viết')}</h3></div>${closeBtn}</div>
        <div class="nd-prev" style="background-image:url(${esc(cleanUrl(cover || COVERS[0]))})"></div>
        ${X.value ? `<p class="lead mt-2" style="color:var(--text-2)">${esc(X.value)}</p>` : ''}
        <div class="prose mt-2" style="max-width:none">${body() || '<p class="dim">Chưa có nội dung.</p>'}</div>`);
      $('.modal', m.el).classList.add('nd-wide');
      PSQ.rich($('.prose', m.el));
    });
    const leave = () => { if (dirty && !confirm('Rời trang soạn bài? Bản nháp vẫn được giữ trên máy này, lần sau mở lại được.')) return; back(); };
    $('[data-back]', el).addEventListener('click', leave);

    // lưu
    $$('[data-save]', el).forEach(b => b.addEventListener('click', () => {
      const err = $('#edE', el), title = T.value.trim(), b2 = body(), show = b.dataset.save === 'show';
      err.textContent = '';
      if (!title) { err.textContent = 'Anh chị nhập tiêu đề bài viết.'; T.focus(); return; }
      if (!$('#edCat', el).value) { err.textContent = 'Cần tạo danh mục kiến thức trước.'; return; }
      if (!b2) { err.textContent = 'Nội dung bài viết đang trống.'; rx.focus(); return; }
      if (show && !cover) { if (!confirm('Bài chưa có ảnh bìa. Dùng ảnh có sẵn của web và đăng luôn?')) return; }
      const words = b2.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, L = allPosts();
      const cur = p ? L.find(x => x.id === p.id) : null;
      const np = Object.assign(cur || {}, {
        title, cat: $('#edCat', el).value, date: toVn($('#edD', el).value || PSQ.today()), cover: cover || COVERS[0],
        excerpt: X.value.trim(), body: b2, read: +$('#edR', el).value || Math.max(1, Math.round(words / 220)), featured: $('#edF', el).checked
      });
      if (show) delete np.hidden; else np.hidden = true;
      if (!show && L.filter(x => !x.hidden && x !== np).length < 1) { err.textContent = 'Cần giữ ít nhất một bài đang hiện, hãy bấm Đăng bài.'; return; }
      if (np.featured) L.forEach(x => { if (x !== np) delete x.featured; }); else delete np.featured;
      if (!cur) { np.id = uniq(slug(title), L.map(x => x.id)); L.unshift(np); }
      if (!savePosts(L)) { err.textContent = 'Chưa lưu được vì bộ nhớ trình duyệt đã đầy. Hãy bớt ảnh hoặc dùng ảnh nhỏ hơn.'; return; }
      try { localStorage.removeItem(DRAFT); } catch (e) {}
      audit(cur ? 'Sửa bài viết' : 'Thêm bài viết', title + (show ? '' : ' (nháp, đang ẩn)'));
      toast(show ? (cur ? 'Đã lưu và hiện bài viết' : 'Đã đăng bài viết') : 'Đã lưu nháp, bài đang ẩn');
      dirty = false; p = np; back();
    }));
    T.focus();
  }

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
        p.hidden = !p.hidden; if (!savePosts(list)) { p.hidden = !p.hidden; return; } audit(p.hidden ? 'Ẩn bài viết' : 'Hiện bài viết', p.title);
        toast(p.hidden ? 'Đã ẩn bài viết' : 'Bài viết đã hiện lại'); this.render(el);
      }));
      $$('[data-del]', el).forEach(b => b.addEventListener('click', () => {
        const i = list.findIndex(x => x.id === b.dataset.del), p = list[i];
        if (!p.hidden && list.filter(x => !x.hidden).length <= 1) { toast('Cần giữ ít nhất một bài đang hiện'); return; }
        if (!confirm(`Xóa hẳn bài "${p.title}"? Có thể chọn Ẩn nếu chỉ muốn tạm gỡ.`)) return;
        list.splice(i, 1); if (!savePosts(list)) return; audit('Xóa bài viết', p.title); toast('Đã xóa bài viết'); this.render(el);
      }));
    },
    // trang soạn bài: mở ngay trong khung quản trị (không dùng hộp thoại nhỏ)
    edit(el, p) { editor(el, p, () => this.render(el)); }
  };
})();
