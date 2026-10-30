/* Bộ soạn thảo dùng chung trong quản trị: bài viết, mô tả sản phẩm, khuyến mãi, giới thiệu...
   window.PSQED.mount(host, { html, placeholder, minHeight, onChange }) vẽ thanh công cụ + vùng soạn, trả { get(), set(html), focus() }.
   - Kiểu chữ: đoạn văn, tiêu đề lớn, tiêu đề nhỏ; phông (thường, trang trọng, có chân, đơn giản); cỡ chữ; màu chữ; tô nền chữ;
     đậm, nghiêng, gạch chân, gạch ngang; căn trái, giữa, phải, đều; danh sách; trích dẫn; liên kết; đường kẻ.
   - Chèn ảnh (tải từ máy, tự thu nhỏ, lưu thành tệp trên máy chủ), bấm vào ảnh để đổi cỡ Nhỏ, Vừa, Lớn hoặc xóa.
   - Chèn sản phẩm: thẻ sản phẩm sống (giá, ảnh lấy theo sản phẩm lúc khách xem), chèn video YouTube.
   - Mọi HTML đi qua clean(): chỉ giữ thẻ và kiểu đã cho phép. Trang công khai dùng PSQ.rich(el) để vẽ thẻ sản phẩm, video.
   PSQED.upload(file, { w, h, crop }) thu nhỏ ảnh rồi gửi /api/admin/media, trả đường dẫn /api/media/... */
(function () {
  const { $, $$, esc, icon, toast, modal, money } = PSQ;

  /* ---------- ảnh ---------- */
  function loadImg(file) {
    return new Promise((ok, fail) => { const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); img.naturalWidth ? ok(img) : fail(new Error('empty')); };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('decode')); }; img.src = url; });
  }
  // w: ngang tối đa; crop: tỉ lệ ngang/cao muốn cắt (vd 1 cho ảnh vuông, 16/9 cho ảnh bìa); png giữ nền trong suốt
  async function shrink(file, o = {}) {
    const img = await loadImg(file), W = img.naturalWidth, H = img.naturalHeight, maxW = o.w || 1200;
    let sx = 0, sy = 0, sw = W, sh = H;
    if (o.crop) { if (W / H > o.crop) { sw = H * o.crop; sx = (W - sw) / 2; } else { sh = W / o.crop; sy = (H - sh) / 2; } }
    const k = Math.min(1, maxW / sw), c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const png = /png|webp|gif/.test(file.type) && !o.crop && o.keepAlpha, g = c.getContext('2d');
    if (!png) { g.fillStyle = '#0e1417'; g.fillRect(0, 0, c.width, c.height); }
    g.imageSmoothingQuality = 'high'; g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w: W, h: H };
  }
  async function upload(file, o = {}) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Hãy chọn một file ảnh (JPG, PNG).');
    const im = await shrink(file, o);
    const r = await fetch('/api/admin/media', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-psq': '1' }, body: JSON.stringify({ data: im.src }) })
      .then(x => x.json()).catch(() => ({ error: 'Không gửi được ảnh, anh chị kiểm tra mạng rồi thử lại.' }));
    if (!r || !r.url) throw new Error((r && r.error) || 'Không tải được ảnh lên.');
    return { url: r.url, w: im.w, h: im.h };
  }
  const pickFile = (multi) => new Promise(ok => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = !!multi; f.onchange = () => ok(multi ? [...(f.files || [])] : f.files && f.files[0]); f.click(); });

  /* ---------- làm sạch HTML ---------- */
  const FONTS = { '': 'Chữ thường', display: 'Chữ trang trọng', serif: 'Chữ có chân', plain: 'Chữ đơn giản' };
  const SIZES = { s: 'Nhỏ', '': 'Vừa', l: 'Lớn', xl: 'Rất lớn', xxl: 'Cực lớn' };
  // execCommand fontSize 1..7 sinh ra các cỡ này
  const SIZE_OF = { 'x-small': 's', small: 's', medium: '', large: 'l', 'x-large': 'xl', 'xx-large': 'xxl', 'xxx-large': 'xxl', 1: 's', 2: 's', 3: '', 4: 'l', 5: 'xl', 6: 'xxl', 7: 'xxl' };
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i;
  const ALIGN = ['left', 'center', 'right', 'justify'];
  const BLOCK = ['P', 'H2', 'H3', 'LI', 'BLOCKQUOTE'];
  const ALLOW = { P: [], H2: [], H3: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [], A: ['href'], BR: [], FIGURE: [], FIGCAPTION: [], IMG: ['src', 'alt'], HR: [], SPAN: [] };
  const ytId = u => { const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(String(u || '')); return m ? m[1] : ''; };
  const prodHref = id => 'san-pham-chi-tiet.html?id=' + encodeURIComponent(id);
  function clean(html) {
    const box = document.createElement('div'); box.innerHTML = html;
    const rename = (c, tag) => { const n = document.createElement(tag); while (c.firstChild) n.appendChild(c.firstChild); [...c.attributes].forEach(a => n.setAttribute(a.name, a.value)); c.replaceWith(n); return n; };
    (function walk(n) {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1) { c.remove(); return; }
        // thẻ sản phẩm, video: chỉ giữ mã, nội dung dựng lại
        if (c.dataset && (c.dataset.prod || c.dataset.yt)) {
          const f = document.createElement('figure');
          if (c.dataset.prod) { const p = PSQ.product(c.dataset.prod); if (!p) { c.remove(); return; } f.className = 'rich-prod'; f.dataset.prod = p.id; f.innerHTML = `<a href="${prodHref(p.id)}">${esc(p.name)}</a>`; }
          else { const id = ytId('youtu.be/' + c.dataset.yt); if (!id) { c.remove(); return; } f.className = 'rich-yt'; f.dataset.yt = id; f.innerHTML = `<a href="https://youtu.be/${id}">Xem video</a>`; }
          c.replaceWith(f); return;
        }
        let tag = c.tagName;
        if (tag === 'DIV') { c = rename(c, 'P'); tag = 'P'; }
        if (tag === 'H1') { c = rename(c, 'H2'); tag = 'H2'; }
        if (/^(H4|H5|H6)$/.test(tag)) { c = rename(c, 'H3'); tag = 'H3'; }
        if (/^(STRIKE|DEL)$/.test(tag)) { c = rename(c, 'S'); tag = 'S'; }
        if (tag === 'FONT') {
          const sp = document.createElement('span'); while (c.firstChild) sp.appendChild(c.firstChild);
          const face = (c.getAttribute('face') || '').replace(/['"]/g, ''), col = c.getAttribute('color'), sz = c.getAttribute('size');
          if (/^psqf-/.test(face)) sp.style.fontFamily = face; if (col) sp.style.color = col; if (sz) sp.dataset.sz = sz;
          c.replaceWith(sp); c = sp; tag = 'SPAN';
        }
        if (!ALLOW[tag]) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|SVG|MATH|SELECT|TEXTAREA|NOSCRIPT|TEMPLATE)$/.test(tag)) c.remove(); else { walk(c); c.replaceWith(...c.childNodes); } return; }
        // giữ lại: màu chữ, nền chữ, phông, cỡ (thành lớp f-*, fs-*), căn lề của khối, cỡ ảnh
        const st = c.style || {}, keep = {}, cls = [];
        if (tag === 'SPAN') {
          const col = (st.color || '').trim(), bg = (st.backgroundColor || '').trim();
          if (COLOR.test(col)) keep.color = col; if (COLOR.test(bg) && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg)) keep['background-color'] = bg;
          const ff = (st.fontFamily || '').replace(/['"]/g, ''), fk = /psqf-(\w+)/.exec(ff) || /\bf-(display|serif|plain)\b/.exec(c.className); if (fk && FONTS[fk[1]]) cls.push('f-' + fk[1]);
          const szk = SIZE_OF[(st.fontSize || '').trim()] ?? SIZE_OF[c.dataset.sz] ?? ((/\bfs-(s|l|xl|xxl)\b/.exec(c.className) || [])[1]); if (szk) cls.push('fs-' + szk);
        }
        if (BLOCK.includes(tag)) { const al = (st.textAlign || c.getAttribute('align') || '').trim(); if (ALIGN.includes(al) && al !== 'left') keep['text-align'] = al; }
        if (tag === 'FIGURE') { const k = /\bfig-(s|m)\b/.exec(c.className); if (k) cls.push('fig-' + k[1]); }
        [...c.attributes].forEach(a => { if (!ALLOW[tag].includes(a.name)) c.removeAttribute(a.name); });
        const css = Object.entries(keep).map(([k, v]) => k + ':' + v).join(';'); if (css) c.setAttribute('style', css);
        if (cls.length) c.className = cls.join(' ');
        if (tag === 'SPAN' && !c.attributes.length) { walk(c); c.replaceWith(...c.childNodes); return; }
        if (tag === 'A') { const h = c.getAttribute('href') || ''; if (!/^(https?:|mailto:|tel:|[a-z0-9-]+\.html|#)/i.test(h)) c.removeAttribute('href'); else if (/^https?:/i.test(h)) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); } }
        if (tag === 'IMG') { const s = c.getAttribute('src') || ''; if (!/^(data:image\/(jpeg|png|webp|gif);base64,|https:\/\/|\/api\/media\/|img\/)/i.test(s)) { c.remove(); return; } c.setAttribute('loading', 'lazy'); }
        walk(c);
      });
    })(box);
    box.querySelectorAll('p').forEach(x => { if (x.querySelector('ul,ol,figure,h2,h3,blockquote,p,hr')) x.replaceWith(...x.childNodes); });
    // chữ gõ thẳng vào vùng soạn (chưa nằm trong đoạn nào): gom vào thẻ p
    let run = null;
    [...box.childNodes].forEach(c => {
      const inline = c.nodeType === 3 || (c.nodeType === 1 && /^(STRONG|B|EM|I|U|S|A|SPAN|BR)$/.test(c.tagName));
      if (!inline) { run = null; return; }
      if (c.nodeType === 3 && !c.textContent.trim() && !run) { c.remove(); return; }
      if (!run) { run = document.createElement('p'); c.before(run); }
      run.appendChild(c);
    });
    box.querySelectorAll('figcaption').forEach(x => { if (!x.closest('figure')) { const pr = x.previousElementSibling; if (pr && pr.tagName === 'FIGURE' && !pr.querySelector('figcaption') && pr.querySelector('img')) pr.appendChild(x); else x.remove(); } });
    box.querySelectorAll('figure').forEach(x => { if (!x.querySelector('img') && !x.dataset.prod && !x.dataset.yt) x.remove(); });
    box.querySelectorAll('p,h2,h3,li,blockquote').forEach(x => { if (!x.textContent.trim() && !x.querySelector('img,br')) x.remove(); });
    // bỏ đoạn trống ở cuối (con trỏ sau ảnh, thẻ sản phẩm để lại)
    for (let x = box.lastElementChild; x && x.tagName === 'P' && !x.textContent.trim() && !x.querySelector('img'); x = box.lastElementChild) x.remove();
    return box.innerHTML.trim();
  }

  /* ---------- giao diện ---------- */
  if (!document.getElementById('adm-css-soan-thao')) {
    const st = document.createElement('style'); st.id = 'adm-css-soan-thao';
    st.textContent = `
      .rx { border: 1px solid var(--line-2); border-radius: 12px; background: rgba(0,0,0,.18); }
      .rx:focus-within { border-color: rgba(243,199,107,.45); }
      .rx-bar { position: sticky; top: 8px; z-index: 6; display: flex; flex-wrap: wrap; gap: 3px; padding: 7px; border-bottom: 1px solid var(--line-2); border-radius: 12px 12px 0 0; background: rgba(10, 14, 16, .97); }
      .rx-bar button, .rx-bar select { height: 32px; min-width: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
      .rx-bar select { border-color: var(--line-2); background: rgba(255,255,255,.03); max-width: 140px; }
      .rx-bar button:hover, .rx-bar button.on { color: var(--gold); border-color: rgba(243,199,107,.4); background: rgba(243,199,107,.08); }
      .rx-bar button svg { width: 15px; height: 15px; }
      .rx-bar .sep { width: 1px; background: var(--line-2); margin: 4px 3px; }
      .rx-bar .rx-col { position: relative; }
      .rx-bar .rx-col i { position: absolute; left: 7px; right: 7px; bottom: 4px; height: 3px; border-radius: 2px; }
      .rx-pal { position: absolute; z-index: 30; padding: 10px; border-radius: 12px; border: 1px solid var(--line-2); background: #0d1215; box-shadow: 0 18px 40px -10px #000; display: grid; grid-template-columns: repeat(8, 24px); gap: 6px; }
      .rx-pal button { width: 24px; height: 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,.15); cursor: pointer; padding: 0; }
      .rx-pal .rx-pal-row { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--text-3); }
      .rx-pal input[type=color] { width: 34px; height: 26px; border: 0; background: none; padding: 0; cursor: pointer; }
      .rx-pal .rx-none { width: auto; padding: 0 8px; background: transparent; color: var(--text-2); font-size: 12px; }
      .rx-area { min-height: var(--rx-h, 300px); padding: 20px 22px; outline: none; max-width: none !important; overflow-wrap: anywhere; border-radius: 0 0 12px 12px; }
      .rx-area:empty::before { content: attr(data-ph); color: var(--text-3); }
      .rx-area figure { position: relative; }
      .rx-area img { cursor: pointer; }
      .rx-area img.sel { outline: 3px solid var(--gold); outline-offset: 2px; }
      .rx-area .rich-prod, .rx-area .rich-yt { user-select: none; cursor: default; }
      .rx-html { width: 100%; min-height: var(--rx-h, 300px); font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; border: 0; border-radius: 0 0 12px 12px; }
      .rx-img { position: absolute; z-index: 20; display: flex; gap: 4px; padding: 5px; border-radius: 10px; background: #0d1215; border: 1px solid var(--line-2); box-shadow: 0 12px 30px -8px #000; }
      .rx-img button { height: 30px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: 12.5px; cursor: pointer; }
      .rx-img button.on, .rx-img button:hover { color: var(--gold); border-color: rgba(243,199,107,.5); }
      .rx-pick { display: grid; gap: 8px; max-height: 52vh; overflow: auto; margin-top: 12px; }
      .rx-pick button { display: flex; align-items: center; gap: 12px; text-align: left; padding: 8px; border-radius: 12px; border: 1px solid var(--line-2); background: rgba(255,255,255,.02); color: var(--text); cursor: pointer; font: inherit; }
      .rx-pick button:hover { border-color: rgba(243,199,107,.5); }
      .rx-pick .thumb { width: 52px; height: 52px; border-radius: 10px; overflow: hidden; flex: none; background: #0c1114; }
      .rx-pick .thumb img, .rx-pick .thumb svg { width: 100%; height: 100%; object-fit: cover; }
      .rx-pick small { display: block; color: var(--gold); }
      .rx-busy { opacity: .6; pointer-events: none; }
      @media (max-width: 699px) { .rx-area { padding: 14px; } .rx-bar select { max-width: 112px; } }`;
    document.head.appendChild(st);
  }

  const PALETTE = ['#ffffff', '#e8e2d4', '#b9c4c2', '#7d8a88', '#f3c76b', '#e8a838', '#c9862b', '#8a5a1f', '#4fe6df', '#2bb5c9', '#5aa9ff', '#a78bfa', '#ff7a7a', '#ef4444', '#4ade80', '#16a34a'];
  const HILITE = ['#f3c76b55', '#4fe6df44', '#ef444455', '#4ade8044', '#a78bfa55', '#ffffff22'];
  let n = 0;

  function mount(host, o = {}) {
    const id = 'rx' + (++n);
    const B = (cmd, ic, label, arg) => `<button type="button" data-cmd="${cmd}"${arg ? ` data-arg="${arg}"` : ''} title="${label}" aria-label="${label}">${ic}</button>`;
    const alignIc = a => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${{ left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>' }[a]}</svg>`;
    host.innerHTML = `<div class="rx" id="${id}" style="--rx-h:${o.minHeight || 300}px">
      <div class="rx-bar">
        <select data-block aria-label="Kiểu đoạn"><option value="p">Đoạn văn</option><option value="h2">Tiêu đề lớn</option><option value="h3">Tiêu đề nhỏ</option></select>
        <select data-font aria-label="Phông chữ">${Object.entries(FONTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select data-size aria-label="Cỡ chữ">${Object.entries(SIZES).map(([k, v]) => `<option value="${k}"${k ? '' : ' selected'}>Cỡ ${v.toLowerCase()}</option>`).join('')}</select>
        <span class="sep"></span>
        ${B('bold', '<b>B</b>', 'In đậm (Ctrl+B)')}${B('italic', '<i>I</i>', 'In nghiêng (Ctrl+I)')}${B('underline', '<u>U</u>', 'Gạch chân (Ctrl+U)')}${B('strikeThrough', '<s>S</s>', 'Gạch ngang')}
        <button type="button" class="rx-col" data-pal="foreColor" title="Màu chữ" aria-label="Màu chữ"><b>A</b><i style="background:#f3c76b"></i></button>
        <button type="button" class="rx-col" data-pal="hiliteColor" title="Tô nền chữ" aria-label="Tô nền chữ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg><i style="background:#4fe6df88"></i></button>
        <span class="sep"></span>
        ${['left', 'center', 'right', 'justify'].map(a => B('justify' + a[0].toUpperCase() + a.slice(1), alignIc(a), { left: 'Căn trái', center: 'Căn giữa', right: 'Căn phải', justify: 'Căn đều hai bên' }[a])).join('')}
        <span class="sep"></span>
        ${B('insertUnorderedList', '•&nbsp;DS', 'Danh sách chấm')}${B('insertOrderedList', '1.&nbsp;DS', 'Danh sách số')}${B('quote', '❝', 'Khung trích dẫn')}${B('insertHorizontalRule', '―', 'Đường kẻ ngang')}
        <span class="sep"></span>
        ${B('link', icon('globe'), 'Chèn liên kết')}${B('image', icon('upload') + ' Ảnh', 'Chèn ảnh từ máy')}${o.products === false ? '' : B('product', icon('bag') + ' Sản phẩm', 'Chèn thẻ sản phẩm')}${B('video', '▶ Video', 'Chèn video YouTube')}
        <span class="sep"></span>
        ${B('removeFormat', '⌫', 'Xóa định dạng chữ đang chọn')}${B('undo', '↶', 'Hoàn tác (Ctrl+Z)')}${B('redo', '↷', 'Làm lại')}
        <button type="button" data-html style="margin-left:auto" title="Xem và sửa mã HTML">&lt;/&gt;</button>
      </div>
      <div class="prose rx-area" contenteditable="true" data-ph="${esc(o.placeholder || 'Nhập nội dung...')}"></div>
      <textarea class="input rx-html" hidden spellcheck="false" aria-label="Mã HTML"></textarea>
    </div>`;
    const root = $('#' + id, host), ed = $('.rx-area', root), code = $('.rx-html', root), bar = $('.rx-bar', root);
    let htmlMode = false, saved = null, selImg = null;
    const changed = () => { if (o.onChange) o.onChange(); };
    // khối sản phẩm, video trong vùng soạn: hiện thẻ xem trước, không cho gõ vào
    const decorate = () => {
      $$('[data-prod],[data-yt]', ed).forEach(f => {
        f.contentEditable = 'false';
        if (f.dataset.prod) { const p = PSQ.product(f.dataset.prod); f.innerHTML = p ? PSQ.richProd(p) : '<p class="dim">Sản phẩm đã gỡ</p>'; }
        else f.innerHTML = PSQ.richYt(f.dataset.yt);
      });
    };
    const set = h => { ed.innerHTML = clean(h || ''); decorate(); if (htmlMode) code.value = pretty(clean(h || '')); };
    const get = () => clean(htmlMode ? code.value : ed.innerHTML);
    const pretty = h => h.replace(/(<\/(p|h2|h3|ul|ol|blockquote|figure)>|<hr>)/g, '$1\n');
    set(o.html);
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

    const keep = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
    const restore = () => { ed.focus(); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } };
    ['keyup', 'mouseup', 'blur'].forEach(ev => ed.addEventListener(ev, keep));
    const exec = (c, a = null, css = true) => { restore(); try { document.execCommand('styleWithCSS', false, css); } catch (e) {} document.execCommand(c, false, a); keep(); changed(); sync(); };
    // chèn khối (ảnh, thẻ sản phẩm) sau đoạn đang đứng, con trỏ xuống đoạn mới bên dưới
    const insertBlock = h => {
      restore(); const sel = getSelection(); let nd = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
      while (nd && nd.parentNode !== ed) nd = nd.parentNode;
      const tmp = document.createElement('div'); tmp.innerHTML = h; const blk = tmp.firstElementChild, after = document.createElement('p'); after.innerHTML = '<br>';
      if (nd && nd.parentNode === ed) { const empty = nd.nodeType === 1 && !nd.textContent.trim() && !nd.querySelector('img') && !nd.dataset.prod; nd.after(blk); blk.after(after); if (empty && nd.tagName === 'P') nd.remove(); }
      else { ed.appendChild(blk); ed.appendChild(after); }
      decorate();
      const r = document.createRange(); r.setStart(after, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); keep(); changed();
    };
    const sync = () => {
      if (htmlMode) return;
      ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyCenter', 'justifyRight', 'justifyFull'].forEach(c => { const b = $(`[data-cmd="${c}"]`, bar); if (b) try { b.classList.toggle('on', document.queryCommandState(c)); } catch (e) {} });
      let blk = ''; try { blk = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch (e) {}
      $('[data-block]', bar).value = ['h2', 'h3'].includes(blk) ? blk : 'p';
      $('[data-cmd="quote"]', bar).classList.toggle('on', blk === 'blockquote');
      const s = getSelection(); let el = s.anchorNode; if (el && el.nodeType === 3) el = el.parentNode;
      let f = '', z = '';
      for (let x = el; x && x !== ed; x = x.parentNode) { if (x.nodeType !== 1) continue; const cs = x.style || {}; if (!f) { const m = /psqf-(\w+)/.exec(cs.fontFamily || '') || /\bf-(\w+)/.exec(x.className || ''); if (m) f = m[1]; } if (!z) { const k = SIZE_OF[(cs.fontSize || '').trim()] ?? (/\bfs-(\w+)/.exec(x.className || '') || [])[1]; if (k) z = k; } }
      $('[data-font]', bar).value = f; $('[data-size]', bar).value = z;
    };
    document.addEventListener('selectionchange', () => { if (document.activeElement === ed) sync(); });
    bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    $('[data-block]', bar).addEventListener('change', e => exec('formatBlock', e.target.value));
    $('[data-font]', bar).addEventListener('change', e => { const v = e.target.value; exec('fontName', v ? 'psqf-' + v : 'psqf-x'); if (!v) unwrapFonts(); });
    $('[data-size]', bar).addEventListener('change', e => exec('fontSize', { s: 2, '': 3, l: 4, xl: 5, xxl: 6 }[e.target.value]));
    // phông "thường": bỏ dấu phông giả psqf-x
    const unwrapFonts = () => { $$('span,font', ed).forEach(x => { if (/psqf-x/.test(x.style.fontFamily || x.getAttribute('face') || '')) { x.style.fontFamily = ''; x.removeAttribute('face'); } }); };

    // bảng màu
    let pal = null;
    const closePal = () => { if (pal) { pal.remove(); pal = null; } };
    bar.addEventListener('click', e => {
      const pb = e.target.closest('[data-pal]'); if (!pb) return;
      if (pal) { const same = pal.dataset.for === pb.dataset.pal; closePal(); if (same) return; }
      keep(); const fore = pb.dataset.pal === 'foreColor', list = fore ? PALETTE : HILITE;
      pal = document.createElement('div'); pal.className = 'rx-pal'; pal.dataset.for = pb.dataset.pal;
      pal.innerHTML = list.map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('') + `<div class="rx-pal-row">Màu khác <input type="color" value="#f3c76b" aria-label="Chọn màu khác"><button type="button" class="rx-none" data-c="">${fore ? 'Màu mặc định' : 'Bỏ tô nền'}</button></div>`;
      root.appendChild(pal); const r = pb.getBoundingClientRect(), rr = root.getBoundingClientRect();
      pal.style.left = Math.max(0, Math.min(r.left - rr.left, rr.width - 260)) + 'px'; pal.style.top = (r.bottom - rr.top + 6) + 'px';
      const apply = c => { closePal(); if (fore) exec('foreColor', c || 'inherit'); else exec('hiliteColor', c || 'transparent'); if (!c) $$('span', ed).forEach(x => { if (fore && x.style.color === 'inherit') x.style.color = ''; if (!fore && /transparent/.test(x.style.backgroundColor)) x.style.backgroundColor = ''; }); if (c) $('i', pb).style.background = c; };
      pal.addEventListener('mousedown', ev => { if (ev.target.tagName === 'BUTTON') ev.preventDefault(); });
      pal.addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (b) apply(b.dataset.c); });
      $('input', pal).addEventListener('change', ev => apply(ev.target.value));
    });
    document.addEventListener('mousedown', e => { if (pal && !pal.contains(e.target) && !e.target.closest('[data-pal]')) closePal(); });

    bar.addEventListener('click', async e => {
      const b = e.target.closest('[data-cmd]'); if (!b || htmlMode) return;
      const c = b.dataset.cmd;
      if (c === 'quote') { let blk = ''; try { blk = String(document.queryCommandValue('formatBlock')).toLowerCase(); } catch (x) {} return exec('formatBlock', blk.includes('blockquote') ? 'p' : 'blockquote'); }
      if (c === 'link') {
        keep(); const txt = String(getSelection()), url = prompt('Dán đường dẫn (https://... hoặc tên trang như san-pham.html):', 'https://'); if (!url || url === 'https://') return;
        restore(); if (!txt) document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url)}</a>`); else document.execCommand('createLink', false, url); changed(); return;
      }
      if (c === 'image') {
        keep(); const files = await pickFile(true); if (!files || !files.length) return;
        root.classList.add('rx-busy');
        for (const file of files) {
          try { const im = await upload(file, { w: 1400 }); insertBlock(`<figure><img src="${esc(im.url)}" alt=""></figure>`); if (im.w < 700) toast(`Ảnh chỉ rộng ${im.w} px, có thể bị mờ. Nên dùng ảnh ngang từ 1200 px.`); }
          catch (x) { toast(x.message || 'Không đọc được ảnh này', 'err'); }
        }
        root.classList.remove('rx-busy'); if (files.length > 1) toast(`Đã chèn ${files.length} ảnh. Bấm vào ảnh để đổi cỡ hoặc thêm chú thích.`); else toast('Đã chèn ảnh. Bấm vào ảnh để đổi cỡ hoặc thêm chú thích.');
        return;
      }
      if (c === 'product') { keep(); return pickProduct(p => insertBlock(`<figure class="rich-prod" data-prod="${esc(p.id)}"></figure>`)); }
      if (c === 'video') {
        keep(); const u = prompt('Dán đường dẫn video YouTube (youtube.com/watch?v=..., youtu.be/..., shorts):', ''); if (!u) return;
        const v = ytId(u); if (!v) return toast('Đường dẫn chưa đúng video YouTube', 'err');
        insertBlock(`<figure class="rich-yt" data-yt="${v}"></figure>`); return;
      }
      exec(c);
    });
    // bấm vào ảnh: chọn cỡ, chú thích, xóa
    let tool = null;
    const closeTool = () => { if (tool) tool.remove(); tool = null; if (selImg) selImg.classList.remove('sel'); selImg = null; };
    ed.addEventListener('click', e => {
      const img = e.target.closest('img'); if (!img || img.closest('[data-prod]')) return closeTool();
      closeTool(); selImg = img; img.classList.add('sel');
      const fig = img.closest('figure') || (() => { const f = document.createElement('figure'); img.replaceWith(f); f.appendChild(img); return f; })();
      const cur = (/\bfig-(s|m)\b/.exec(fig.className) || [])[1] || '';
      tool = document.createElement('div'); tool.className = 'rx-img';
      tool.innerHTML = `<button type="button" data-sz="s"${cur === 's' ? ' class="on"' : ''}>Nhỏ</button><button type="button" data-sz="m"${cur === 'm' ? ' class="on"' : ''}>Vừa</button><button type="button" data-sz=""${cur ? '' : ' class="on"'}>Lớn</button><button type="button" data-cap>Chú thích</button><button type="button" data-del>Xóa ảnh</button>`;
      root.appendChild(tool); const r = img.getBoundingClientRect(), rr = root.getBoundingClientRect();
      tool.style.left = Math.max(4, r.left - rr.left + 8) + 'px'; tool.style.top = Math.max(50, r.top - rr.top + 8) + 'px';
      tool.addEventListener('mousedown', ev => ev.preventDefault());
      tool.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-del')) { fig.remove(); closeTool(); changed(); return; }
        if (b.hasAttribute('data-cap')) { const fc = $('figcaption', fig), t = prompt('Chú thích dưới ảnh (để trống để bỏ):', fc ? fc.textContent : ''); if (t === null) return; if (fc) fc.remove(); if (t.trim()) fig.insertAdjacentHTML('beforeend', `<figcaption>${esc(t.trim())}</figcaption>`); img.alt = t.trim(); closeTool(); changed(); return; }
        fig.classList.remove('fig-s', 'fig-m'); if (b.dataset.sz) fig.classList.add('fig-' + b.dataset.sz); closeTool(); changed();
      });
    });
    ed.addEventListener('keydown', e => { if (selImg && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); (selImg.closest('figure') || selImg).remove(); closeTool(); changed(); } else if (tool) closeTool(); });
    ed.addEventListener('input', changed);
    // dán chữ: bỏ định dạng lạ từ Word / web, giữ đậm, nghiêng, danh sách
    ed.addEventListener('paste', e => {
      const h = e.clipboardData && e.clipboardData.getData('text/html'), t = e.clipboardData && e.clipboardData.getData('text/plain');
      if (!h && !t) return; e.preventDefault();
      const safe = h ? clean(h.replace(/<img[^>]*>/gi, '').replace(/ style="[^"]*"/gi, '')) : t.split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
      document.execCommand('insertHTML', false, safe); changed();
    });
    $('[data-html]', bar).addEventListener('click', e => {
      htmlMode = !htmlMode; e.currentTarget.classList.toggle('on', htmlMode); closeTool(); closePal();
      if (htmlMode) code.value = pretty(clean(ed.innerHTML)); else set(code.value);
      ed.hidden = htmlMode; code.hidden = !htmlMode; $$('[data-cmd],[data-block],[data-font],[data-size],[data-pal]', bar).forEach(b => b.disabled = htmlMode);
    });
    code.addEventListener('input', changed);
    return { get, set, focus: () => ed.focus(), el: root, area: ed };
  }

  // chọn sản phẩm để chèn vào bài
  function pickProduct(done) {
    const list = PRODUCTS.filter(p => !p.pkg);
    const m = modal(`<div class="card-head"><h3>Chèn sản phẩm vào bài</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <input class="input" id="rxq" placeholder="Tìm tên sản phẩm..." autocomplete="off">
      <div class="rx-pick" id="rxl"></div>
      <p class="dim mt-2" style="font-size:12.5px">Thẻ sản phẩm trong bài luôn hiện giá, ảnh mới nhất và nút Thêm vào giỏ.</p>`);
    const draw = () => { const q = PSQ.fold($('#rxq', m.el).value);
      $('#rxl', m.el).innerHTML = list.filter(p => !q || PSQ.fold(p.name).includes(q)).slice(0, 60).map(p => `<button type="button" data-id="${esc(p.id)}"><span class="thumb">${PSQ.art(p)}</span><span><b>${esc(p.name)}</b><small>${PSQ.priceLabel(p)}</small></span></button>`).join('') || '<p class="dim">Không có sản phẩm phù hợp.</p>'; };
    draw(); $('#rxq', m.el).addEventListener('input', draw); setTimeout(() => $('#rxq', m.el).focus(), 50);
    $('#rxl', m.el).addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; m.close(); done(PSQ.product(b.dataset.id)); });
  }

  window.PSQED = { mount, clean, upload, shrink, pickFile, ytId };
})();
