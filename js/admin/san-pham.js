/* Quản trị > Quản lý sản phẩm: khung đăng sản phẩm đầy đủ.
   - Bộ ảnh: tải nhiều ảnh một lần (hoặc kéo thả), ảnh đầu là ảnh đại diện, đổi thứ tự, xóa. Ảnh lưu thành tệp trên máy chủ.
   - Phân loại (dòng sản phẩm): mỗi dòng có tên, giá bán, giá cũ, giá tính thưởng PS, ảnh riêng. Khách chọn phân loại ở trang chi tiết.
   - Nhãn: Bán chạy, Yêu thích, Mới, Số lượng có hạn, Có quà tặng, Giảm giá + nhãn tự đặt. Thứ tự hiện trên trang chủ.
   - Mô tả chi tiết soạn bằng PSQED (kiểu chữ, màu, ảnh, chèn sản phẩm khác, video).
   PSQProductEditor.open(host, p | null, { onDone(saved) }) vẽ khung vào host. */
(function () {
  const { $, $$, esc, icon, toast, money, art, productCard } = PSQ;

  if (!document.getElementById('adm-css-san-pham')) {
    const st = document.createElement('style'); st.id = 'adm-css-san-pham';
    st.textContent = `
      .pe-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
      .pe-head h3 { margin-right: auto; }
      .pe-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 18px; align-items: start; }
      .pe-main { display: grid; gap: 16px; min-width: 0; }
      .pe-sec { padding: 16px; border-radius: 14px; border: 1px solid var(--line-2); background: rgba(255,255,255,.015); }
      .pe-sec > h4 { margin: 0 0 4px; font-size: 15px; color: var(--gold); display: flex; align-items: center; gap: 8px; }
      .pe-sec > p.nd-hint { margin: 0 0 12px; }
      .pe-name { width: 100%; font-family: var(--display); font-size: clamp(22px, 2.4vw, 30px); font-weight: 600; background: transparent; border: 0; border-bottom: 1px solid var(--line-2); padding: 4px 0 10px; color: var(--text); outline: none; }
      .pe-name:focus { border-color: var(--gold); }
      .pe-imgs { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .pe-img { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid var(--line-2); background: #0c1114; }
      .pe-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .pe-img.main { border: 2px solid var(--gold); }
      .pe-img .pe-main-tag { position: absolute; left: 6px; top: 6px; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--gold); color: #1a1205; font-weight: 700; }
      .pe-img .pe-acts { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; gap: 4px; padding: 6px; background: linear-gradient(transparent, rgba(0,0,0,.85)); opacity: 0; transition: opacity .2s; }
      .pe-img:hover .pe-acts, .pe-img:focus-within .pe-acts { opacity: 1; }
      @media (hover: none) { .pe-img .pe-acts { opacity: 1; } }
      .pe-acts button { width: 28px; height: 28px; border-radius: 7px; border: 1px solid rgba(255,255,255,.2); background: rgba(10,14,16,.85); color: #fff; cursor: pointer; display: grid; place-items: center; font-size: 13px; padding: 0; }
      .pe-acts button:hover { border-color: var(--gold); color: var(--gold); }
      .pe-acts svg { width: 14px; height: 14px; }
      .pe-add { aspect-ratio: 1; border-radius: 12px; border: 1px dashed rgba(243,199,107,.5); background: rgba(243,199,107,.04); color: var(--text-2); display: grid; place-items: center; text-align: center; cursor: pointer; font: inherit; font-size: 12.5px; padding: 8px; }
      .pe-add:hover, .pe-drop .pe-add { border-color: var(--gold); color: var(--gold); background: rgba(243,199,107,.1); }
      .pe-add svg { width: 22px; height: 22px; display: block; margin: 0 auto 6px; }
      .pe-switch { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
      .pe-switch button { height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: 13px; cursor: pointer; }
      .pe-switch button.on { color: #1a1205; background: var(--gold); border-color: var(--gold); font-weight: 600; }
      .pe-vars { display: grid; gap: 10px; }
      .pe-var { display: grid; grid-template-columns: 64px minmax(140px, 1.4fr) repeat(3, minmax(100px, 1fr)) auto; gap: 8px; align-items: end; padding: 10px; border-radius: 12px; border: 1px solid var(--line-2); background: rgba(0,0,0,.15); }
      .pe-var .field { margin: 0; } .pe-var label { font-size: 11.5px; }
      .pe-var .input { height: 38px; }
      .pe-vimg { width: 64px; height: 64px; border-radius: 10px; border: 1px dashed rgba(243,199,107,.45); background: #0c1114 center/cover no-repeat; cursor: pointer; display: grid; place-items: center; color: var(--text-3); font-size: 10.5px; text-align: center; line-height: 1.2; padding: 0; }
      .pe-vimg.has { border-style: solid; font-size: 0; }
      .pe-vbtn { display: flex; gap: 4px; }
      .pe-vbtn button { width: 34px; height: 38px; border-radius: 9px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; display: grid; place-items: center; padding: 0; }
      .pe-vbtn button:hover { color: var(--gold); border-color: rgba(243,199,107,.5); }
      .pe-vbtn svg { width: 15px; height: 15px; }
      .pe-up svg { transform: rotate(-90deg); } .pe-down svg { transform: rotate(90deg); }
      .pe-side { display: grid; gap: 14px; position: sticky; top: 8px; }
      .pe-side .card { padding: 16px; }
      .pe-side h4 { font-size: 14px; margin: 0 0 10px; color: var(--gold); }
      .pe-side .field + .field, .pe-side .field + .check, .pe-side .check + .field { margin-top: 10px; }
      .pe-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .pe-tags label { cursor: pointer; }
      .pe-tags input { position: absolute; opacity: 0; pointer-events: none; }
      .pe-tags .badge { height: 30px; padding: 0 12px; opacity: .45; filter: grayscale(.6); transition: opacity .15s; }
      .pe-tags input:checked + .badge { opacity: 1; filter: none; box-shadow: 0 0 0 1px currentColor; }
      .pe-tags input:focus-visible + .badge { outline: 2px solid var(--gold); outline-offset: 2px; }
      .pe-pv .p-card { pointer-events: none; box-shadow: none; }
      .pe-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .pe-dirty { font-size: 12.5px; color: var(--text-3); }
      [data-pane="products"] .pl-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      [data-pane="products"] .pl-tags .badge { height: 20px; font-size: 11px; padding: 0 7px; }
      @media (max-width: 1180px) { .pe-wrap { grid-template-columns: 1fr; } .pe-side { position: static; } }
      @media (max-width: 760px) { .pe-var { grid-template-columns: 64px 1fr 1fr; } .pe-var .pe-vname { grid-column: 2 / -1; } .pe-vbtn { grid-column: 1 / -1; justify-content: flex-end; } .pe-grid2 { grid-template-columns: 1fr; } }`;
    document.head.appendChild(st);
  }

  const uid = () => 'v' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
  const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const num = v => { const n = Math.round(+String(v ?? '').replace(/[^\d]/g, '')); return Number.isFinite(n) ? n : 0; };
  const fmt = v => v === '' || v == null ? '' : (+v).toLocaleString('vi-VN');

  function open(host, p0, o = {}) {
    const isNew = !p0;
    const p = p0 ? JSON.parse(JSON.stringify(p0)) : { id: '', cat: (CATEGORIES[0] || {}).id, name: '', price: 0, art: 'bracelet', desc: '', tone: 0 };
    let imgs = PSQ.imagesOf(p), vars = (p.variants || []).map(v => ({ ...v })), multi = vars.length > 0, dirty = false, busy = 0;
    const badges = new Set(p.badges || (p.hot ? ['hot'] : []));
    const money0 = (name, val, ph) => `<input class="input" name="${name}" inputmode="numeric" value="${fmt(val)}" placeholder="${ph || ''}" data-money>`;
    host.innerHTML = `<div class="card glow-cyan">
      <div class="pe-head"><h3>${isNew ? 'Đăng sản phẩm mới' : 'Sửa sản phẩm'}</h3><span class="pe-dirty" id="peD"></span>
        <button class="btn btn-sm btn-ghost" type="button" data-back>${icon('back')} Danh sách sản phẩm</button>
        <button class="btn btn-sm btn-gold" type="button" data-save>${icon('check')} ${isNew ? 'Đăng sản phẩm' : 'Lưu thay đổi'}</button></div>
      <div class="pe-wrap"><div class="pe-main">
        <div><input class="pe-name" id="peN" maxlength="140" placeholder="Tên sản phẩm, ví dụ: Trà lá trầm túi 150 gram" value="${esc(p.name)}">
          <div class="field mt-2"><label for="peS">Mô tả ngắn (hiện dưới tên ở trang chi tiết và thẻ sản phẩm trong bài viết, 1 đến 2 câu)</label><textarea class="input" id="peS" maxlength="240" style="min-height:64px">${esc(p.short || '')}</textarea></div></div>

        <div class="pe-sec"><h4>${icon('upload')} Ảnh sản phẩm</h4><p class="nd-hint">Tải nhiều ảnh một lần hoặc kéo thả ảnh vào đây. Ảnh có viền vàng là <b>ảnh đại diện</b> (hiện ở danh sách, trang chủ). Đẹp nhất ảnh vuông 1200 × 1200 px, ảnh lớn hơn tự thu nhỏ.</p>
          <div class="pe-imgs" id="peI"></div></div>

        <div class="pe-sec"><h4>${icon('gem')} Giá và phân loại</h4><p class="nd-hint">Một sản phẩm có nhiều dòng (size, loại trầm, khối lượng...) thì chọn <b>Nhiều phân loại</b>, mỗi dòng có giá và ảnh riêng. Khách chọn dòng trước khi thêm vào giỏ.</p>
          <div class="pe-switch" role="group" aria-label="Kiểu giá"><button type="button" data-multi="0">Một giá</button><button type="button" data-multi="1">Nhiều phân loại</button></div>
          <div id="peOne" class="pe-grid2" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
            <div class="field"><label>Giá bán (đồng)</label>${money0('price', p.price || '', 'ví dụ 368.000')}</div>
            <div class="field"><label>Giá cũ (để trống nếu không giảm)</label>${money0('old', p.old || '')}</div>
            <div class="field"><label>Giá tính thưởng (PS)</label>${money0('ps', p.ps ?? '', 'trống = bằng giá bán')}</div>
          </div>
          <div id="peMany"><div class="pe-vars" id="peV"></div><button class="btn btn-sm btn-outline-gold mt-2" type="button" data-vadd>${icon('plus')} Thêm phân loại</button>
            <p class="nd-hint mt-1">Giá tính thưởng để trống = bằng giá bán; nhập 0 nếu dòng đó không trả hoa hồng.</p></div>
        </div>

        <div class="pe-sec"><h4>${icon('edit')} Mô tả chi tiết</h4><p class="nd-hint">Soạn như bài viết: tiêu đề mục, phông chữ, màu, ảnh, video, chèn sản phẩm khác. Không nêu công dụng chữa bệnh.</p><div id="peE"></div></div>

        <div class="pe-sec"><h4>${icon('grid')} Thông số</h4>
          <div class="pe-grid2"><div class="field"><label>Chất liệu</label><input class="input" id="peMat" value="${esc(p.material || '')}" placeholder="ví dụ: Trầm hương tự nhiên"></div>
          <div class="field"><label>Quy cách, kích thước</label><input class="input" id="peSpec" value="${esc(p.spec || '')}" placeholder="ví dụ: Túi 150 gram"></div>
          <div class="field"><label>Bảo hành (trống = theo chính sách chung)</label><input class="input" id="peW" value="${esc(p.warranty || '')}" placeholder="ví dụ: Bảo hành 12 tháng"></div>
          <div class="field"><label>Mã sản phẩm</label><input class="input" value="${esc(p.id ? p.id.toUpperCase() : 'tự tạo khi đăng')}" disabled></div></div>
        </div>
      </div>
      <aside class="pe-side">
        <div class="card"><h4>Danh mục và hiển thị</h4>
          <div class="field"><label for="peC">Danh mục</label><select class="input" id="peC">${CATEGORIES.map(c => `<option value="${c.id}"${c.id === p.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="peP">Thứ tự trên trang chủ (số nhỏ hiện trước, trống = tự xếp)</label><input class="input" id="peP" type="number" min="1" max="999" value="${p.pos || ''}"></div>
        </div>
        <div class="card"><h4>Nhãn trên ảnh sản phẩm</h4>
          <div class="pe-tags" id="peT">${Object.entries(PSQ.BADGES).map(([k, [t, c]]) => `<label><input type="checkbox" value="${k}"${badges.has(k) ? ' checked' : ''}><span class="badge ${c}">${t}</span></label>`).join('')}</div>
          <div class="field mt-2"><label for="peBt">Nhãn tự đặt (tối đa 18 ký tự)</label><input class="input" id="peBt" maxlength="18" value="${esc(p.badgeText || '')}" placeholder="ví dụ: Hàng tuyển"></div>
          <p class="nd-hint mt-1">Có giá cũ thì tự hiện nhãn % giảm. Thẻ sản phẩm hiện tối đa 3 nhãn.</p>
        </div>
        <div class="card"><h4>Hàng đối tác</h4>
          <label class="check"><input type="checkbox" id="pePa"${p.partner ? ' checked' : ''}> Sản phẩm đối tác (hiện ở mục Sản phẩm đối tác)</label>
          <div class="field"><label for="pePn">Tên đối tác</label><input class="input" id="pePn" value="${esc(p.partnerName || '')}" placeholder="ví dụ: Công ty ABC"></div>
        </div>
        <div class="card pe-pv"><h4>Thẻ sản phẩm sẽ hiện như sau</h4><div id="pePv"></div>
          <div class="field mt-2" id="peArtF"><label for="peA">Khi chưa có ảnh, dùng hình vẽ</label><select class="input" id="peA">${['bracelet', 'mala', 'necklace', 'statue', 'car', 'cone', 'box'].map(a => `<option value="${a}"${a === p.art ? ' selected' : ''}>${{ bracelet: 'Vòng tay', mala: 'Chuỗi 108 hạt', necklace: 'Dây chuyền', statue: 'Tượng', car: 'Treo xe', cone: 'Nụ trầm', box: 'Hộp quà' }[a]}</option>`).join('')}</select></div>
        </div>
        <p class="red" id="peErr" style="font-size:13px;min-height:1em;margin:0"></p>
      </aside></div></div>`;

    const R = s => $(s, host);
    const ed = PSQED.mount(R('#peE'), { html: PSQ.richText(p.desc || ''), placeholder: 'Giới thiệu sản phẩm: nguồn gốc, chất liệu, cách dùng, cách bảo quản...', minHeight: 280, onChange: () => mark() });
    const mark = () => { dirty = true; R('#peD').textContent = 'Có thay đổi chưa lưu'; preview(); };

    // ---- ảnh ----
    const drawImgs = () => {
      R('#peI').innerHTML = imgs.map((u, i) => `<div class="pe-img${i ? '' : ' main'}">${i ? '' : '<span class="pe-main-tag">Ảnh đại diện</span>'}<img src="${esc(u)}" alt="Ảnh ${i + 1}" loading="lazy"><div class="pe-acts">${i ? `<button type="button" data-imain="${i}" title="Đặt làm ảnh đại diện" aria-label="Đặt làm ảnh đại diện">★</button><button type="button" class="pe-up" data-ileft="${i}" title="Lên trước" aria-label="Lên trước">${icon('arrow')}</button>` : ''}${i < imgs.length - 1 ? `<button type="button" class="pe-down" data-iright="${i}" title="Ra sau" aria-label="Ra sau">${icon('arrow')}</button>` : ''}<button type="button" data-idel="${i}" title="Xóa ảnh" aria-label="Xóa ảnh">${icon('trash')}</button></div></div>`).join('')
        + `<button class="pe-add" type="button" data-iadd>${icon('plus')}${busy ? 'Đang tải ảnh...' : imgs.length ? 'Thêm ảnh' : 'Tải ảnh sản phẩm'}</button>`;
      R('#peArtF').hidden = imgs.length > 0;
    };
    const addFiles = async files => {
      files = [...files].filter(f => /^image\//.test(f.type)); if (!files.length) return;
      busy++; drawImgs();
      for (const f of files.slice(0, 20)) { try { const r = await PSQED.upload(f, { w: 1400 }); imgs.push(r.url); if (r.w < 600) toast(`Ảnh ${f.name} chỉ rộng ${r.w} px, có thể bị mờ.`); } catch (e) { toast(e.message, 'err'); } }
      busy--; drawImgs(); mark();
    };
    R('#peI').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-iadd')) { if (busy) return; const fs = await PSQED.pickFile(true); if (fs) addFiles(fs); return; }
      const i = +(b.dataset.imain ?? b.dataset.ileft ?? b.dataset.iright ?? b.dataset.idel);
      if (b.dataset.imain) imgs.unshift(imgs.splice(i, 1)[0]);
      else if (b.dataset.ileft) [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]];
      else if (b.dataset.iright) [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]];
      else if (b.dataset.idel) imgs.splice(i, 1);
      drawImgs(); mark();
    });
    const sec = R('#peI').closest('.pe-sec');
    sec.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); sec.classList.add('pe-drop'); } });
    sec.addEventListener('dragleave', () => sec.classList.remove('pe-drop'));
    sec.addEventListener('drop', e => { e.preventDefault(); sec.classList.remove('pe-drop'); addFiles(e.dataTransfer.files || []); });

    // ---- giá, phân loại ----
    const vRow = (v, i) => `<div class="pe-var" data-i="${i}">
      <button class="pe-vimg${v.image ? ' has' : ''}" type="button" data-vimg="${i}" style="${v.image ? `background-image:url('${esc(v.image)}')` : ''}" title="Ảnh riêng của phân loại (bấm để chọn)">${v.image ? '' : '+ Ảnh'}</button>
      <div class="field pe-vname"><label>Tên phân loại</label><input class="input" data-vf="name" value="${esc(v.name || '')}" maxlength="60" placeholder="ví dụ: Size 10 li"></div>
      <div class="field"><label>Giá bán</label><input class="input" data-vf="price" data-money inputmode="numeric" value="${fmt(v.price)}"></div>
      <div class="field"><label>Giá cũ</label><input class="input" data-vf="old" data-money inputmode="numeric" value="${fmt(v.old)}"></div>
      <div class="field"><label>Tính thưởng PS</label><input class="input" data-vf="ps" data-money inputmode="numeric" value="${fmt(v.ps)}" placeholder="= giá bán"></div>
      <div class="pe-vbtn"><button type="button" class="pe-up" data-vup="${i}" title="Lên trên" aria-label="Lên trên"${i ? '' : ' disabled'}>${icon('arrow')}</button><button type="button" data-vdel="${i}" title="Xóa phân loại" aria-label="Xóa phân loại">${icon('trash')}</button></div></div>`;
    const drawVars = () => { R('#peV').innerHTML = vars.length ? vars.map(vRow).join('') : '<p class="dim" style="font-size:13px;margin:0">Chưa có phân loại nào.</p>'; };
    const setMulti = m => { multi = m; $$('[data-multi]', host).forEach(b => b.classList.toggle('on', +b.dataset.multi === +m)); R('#peOne').hidden = m; R('#peMany').hidden = !m; if (m && !vars.length) { vars.push({ id: uid(), name: '', price: num(R('[name=price]').value) || '', old: '', ps: '' }); drawVars(); } };
    $$('[data-multi]', host).forEach(b => b.addEventListener('click', () => { setMulti(b.dataset.multi === '1'); mark(); }));
    R('#peV').addEventListener('input', e => { const f = e.target.dataset.vf; if (!f) return; const i = +e.target.closest('[data-i]').dataset.i; vars[i][f] = f === 'name' ? e.target.value : e.target.value.trim() === '' ? '' : num(e.target.value); mark(); });
    R('#peV').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.vdel != null) { vars.splice(+b.dataset.vdel, 1); drawVars(); mark(); return; }
      if (b.dataset.vup != null) { const i = +b.dataset.vup; [vars[i - 1], vars[i]] = [vars[i], vars[i - 1]]; drawVars(); mark(); return; }
      if (b.dataset.vimg != null) {
        const i = +b.dataset.vimg;
        const choice = imgs.length ? prompt(`Ảnh cho phân loại này:\n- Gõ số 1 đến ${imgs.length} để dùng ảnh trong bộ ảnh\n- Gõ T để tải ảnh mới từ máy\n- Gõ X để bỏ ảnh`, 'T') : 'T';
        if (!choice) return; const c = choice.trim().toUpperCase();
        if (c === 'X') vars[i].image = '';
        else if (/^\d+$/.test(c) && imgs[+c - 1]) vars[i].image = imgs[+c - 1];
        else if (c === 'T') { const f = await PSQED.pickFile(); if (!f) return; b.textContent = '...'; try { const r = await PSQED.upload(f, { w: 1400 }); vars[i].image = r.url; if (!imgs.includes(r.url)) { imgs.push(r.url); drawImgs(); } } catch (x) { toast(x.message, 'err'); } }
        drawVars(); mark();
      }
    });
    R('[data-vadd]').addEventListener('click', () => { const last = vars[vars.length - 1] || {}; vars.push({ id: uid(), name: '', price: last.price || '', old: '', ps: '' }); drawVars(); mark(); const ins = $$('[data-vf="name"]', host); if (ins.length) ins[ins.length - 1].focus(); });
    // ô tiền: tự thêm dấu chấm hàng nghìn khi rời ô
    host.addEventListener('focusout', e => { if (e.target.matches('[data-money]') && e.target.value.trim() !== '') e.target.value = fmt(num(e.target.value)); });

    // ---- thu thập + xem trước ----
    const collect = () => {
      const np = { ...p, name: R('#peN').value.trim(), short: R('#peS').value.trim() || undefined, cat: R('#peC').value, art: R('#peA').value,
        desc: ed.get(), material: R('#peMat').value.trim() || undefined, spec: R('#peSpec').value.trim() || undefined, warranty: R('#peW').value.trim() || undefined,
        pos: num(R('#peP').value) || undefined, badgeText: R('#peBt').value.trim() || undefined,
        partner: R('#pePa').checked || undefined, partnerName: R('#pePa').checked ? R('#pePn').value.trim() || undefined : undefined };
      np.badges = $$('#peT input:checked', host).map(x => x.value); np.hot = np.badges.includes('hot');
      np.image = imgs[0] || ''; np.images = imgs.length > 1 ? imgs.slice() : undefined;
      if (multi) {
        np.variants = vars.map(v => ({ id: v.id || uid(), name: String(v.name || '').trim(), price: +v.price || 0, old: +v.old || undefined, ps: v.ps === '' || v.ps == null ? undefined : +v.ps, image: v.image || undefined }));
        np.price = np.variants.length ? Math.min(...np.variants.map(v => v.price)) : 0; delete np.old; delete np.ps;
      } else {
        delete np.variants; np.price = num(R('[name=price]').value); np.old = num(R('[name=old]').value) || undefined;
        const psv = R('[name=ps]').value.trim(); if (psv === '') delete np.ps; else np.ps = num(psv);
      }
      Object.keys(np).forEach(k => np[k] === undefined && delete np[k]);
      return np;
    };
    const preview = () => { try { R('#pePv').innerHTML = productCard(Object.assign(collect(), { id: p.id || 'xem-truoc' })); } catch (e) {} };
    ['#peN', '#peS', '#peC', '#peP', '#peBt', '#pePa', '#pePn', '#peA', '#peMat', '#peSpec', '#peW', '[name=price]', '[name=old]', '[name=ps]'].forEach(s => { R(s).addEventListener('input', mark); R(s).addEventListener('change', mark); });
    R('#peT').addEventListener('change', mark);

    const leave = () => !dirty || confirm('Sản phẩm có thay đổi chưa lưu. Bỏ thay đổi và quay lại danh sách?');
    R('[data-back]').addEventListener('click', () => { if (leave()) o.onDone && o.onDone(null); });
    R('[data-save]').addEventListener('click', () => {
      const err = R('#peErr'), np = collect(); err.textContent = '';
      if (busy) return err.textContent = 'Ảnh đang tải lên, anh chị chờ một chút.';
      if (np.name.length < 3) { R('#peN').focus(); return err.textContent = 'Anh chị nhập tên sản phẩm.'; }
      if (multi) {
        if (!np.variants.length) return err.textContent = 'Thêm ít nhất một phân loại, hoặc chọn Một giá.';
        const bad = np.variants.findIndex(v => !v.name || !(v.price > 0)); if (bad >= 0) return err.textContent = `Phân loại thứ ${bad + 1} cần có tên và giá bán.`;
        const names = np.variants.map(v => v.name.toLowerCase()); if (new Set(names).size !== names.length) return err.textContent = 'Có hai phân loại trùng tên.';
      } else if (!(np.price > 0)) { R('[name=price]').focus(); return err.textContent = 'Anh chị nhập giá bán.'; }
      if (np.old && np.old <= np.price) return err.textContent = 'Giá cũ phải cao hơn giá bán (để trống nếu không giảm).';
      if (isNew) np.id = (slug(np.name) || 'san-pham') + '-' + Date.now().toString(36).slice(-4);
      PSQ.products.save(np);
      const i = PRODUCTS.findIndex(x => x.id === np.id); i >= 0 ? PRODUCTS[i] = np : PRODUCTS.push(np);
      dirty = false; toast(isNew ? 'Đã đăng sản phẩm' : 'Đã lưu sản phẩm');
      o.onDone && o.onDone(np);
    });
    drawImgs(); drawVars(); setMulti(multi); preview();
    R('#peN').focus();
    return { dirty: () => dirty };
  }

  window.PSQProductEditor = { open };
})();
