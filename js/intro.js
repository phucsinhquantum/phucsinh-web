/* =========================================================
   Màn hình mở đầu Phúc Sinh QuanTum (PSQ)
   Cảnh 1 (0–5,4s)   Biển mây trên núi: tia nắng, mây bay bồng bềnh.
   Cảnh 2 (4,2s→)    Mặt trời trong núi ló dần, tia sáng chiếu tới logo PSQ,
                     logo sáng lên, nút "Khám phá" nhấp nháy.
                     Khách bấm "Khám phá" mới vào trang web.
   Nhạc nền: audio/intro-full.mp3, nguyên bài, hết bài thì phát lại. Trình duyệt chặn tự phát tiếng
   nên nhạc bắt đầu ngay khi được phép, hoặc ở lần chạm/bấm đầu tiên.
   (Code cảnh lửa khói và cổng sáng vẫn giữ, đang tắt: o2, o3 trong frame().)

   Cách dùng:
   - Mỗi phiên trình duyệt khách thấy 1 lần. Xem lại: index.html?intro=1
   - Tắt hẳn: INTRO.enabled = false. Đổi chữ: sửa INTRO bên dưới.
   - Đổi ảnh: thay file trong img/intro/ (giữ khổ 1672 × 941, bản -m.jpg là bản nhỏ cho điện thoại).
   ========================================================= */
(function () {
  const INTRO = {
    enabled: true,
    logo: 'img/intro/logo-psq.png',
    brand: 'Phúc Sinh QuanTum',
    headline: 'Có những giá trị chỉ mở ra<br>khi ta chậm lại.',
    text: 'Bước vào hành trình khám phá tinh hoa trầm hương Việt Nam.',
    button: 'Khám phá',
    footer: 'Hít thở chậm • Cảm nhận • Khám phá',
    // 'ngay' = bản ban ngày, 'binh-minh' = bản bình minh. Xem thử bản khác: index.html?intro=1&canh=binh-minh
    theme: 'ngay',
    music: 'audio/intro-full.mp3',   // nguyên bài (13 phút 37 giây); để '' nếu không muốn nhạc
    volume: 0.7,
    oncePerSession: true,
    respectReducedMotion: false,
    // Trình duyệt chỉ cho phát nhạc sau khi khách chạm. Bật màn hình "Chạm để bắt đầu" để intro luôn chạy kèm nhạc từ giây đầu.
    tapToStart: true,
    tapText: 'Chạm để bắt đầu'
  };

  // Ảnh từng cảnh và các điểm quan trọng trên ảnh gốc (toạ độ theo khổ 1672 × 941)
  const THEME = new URLSearchParams(location.search).get('canh') || INTRO.theme;
  const DAY = THEME === 'ngay';
  const tag = DAY ? '-ngay' : '';
  const IMG = {
    clouds: { src: 'img/intro/canh-1-may-nui' + tag, w: 1672, h: 941, sun: [1505, 206] },
    land:   { src: 'img/intro/phuc-sinh-canh-nen' + tag, w: 1672, h: 940, sun: [1412, 238], burner: [252, 800], wood: [330, 690], ring: [835, 419, 431] },
    portal: { src: 'img/intro/canh-3-cong-sang', w: 1672, h: 941, ring: [1040, 335, 180, 196], water: 540 }
  };

  // Thời gian (giây)
  const T = {
    s1in: [0, 1.2], s1out: [4.2, 5.4],
    fin: [4.2, 5.4], sunrise: [4.8, 6.6], beam: [6.0, 7.2], logoLit: 6.9, ring: [6.4, 7.8]
  };

  const KEY = 'psq_intro_seen';
  const params = new URLSearchParams(location.search);
  const force = params.get('intro') === '1';
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
  if (!INTRO.enabled || (INTRO.oncePerSession && seen && !force)) return;

  // Nhiều máy Windows tắt "hiệu ứng hoạt ảnh" nên trình duyệt báo giảm chuyển động; mặc định intro vẫn chạy đủ.
  // Muốn tôn trọng cài đặt đó (chỉ hiện cảnh cuối) thì đặt respectReducedMotion: true trong INTRO.
  const reduce = !!INTRO.respectReducedMotion && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cấu hình riêng cho điện thoại / iPad / máy tính (tự đổi khi xoay màn hình)
  const PROFILES = {
    phone:   { dpr: 1.5,  dust: 30, mist: 12, smoke: 10, zoom: 0.55, ringW: 0.46, ringH: 0.3,  small: true },
    tablet:  { dpr: 1,    dust: 50, mist: 16, smoke: 13, zoom: 0.8,  ringW: 0.45, ringH: 0.37, small: innerWidth * devicePixelRatio < 1500 },
    desktop: { dpr: 1,    dust: 70, mist: 20, smoke: 15, zoom: 1,    ringW: 0.5,  ringH: 0.46, small: false }
  };
  const device = () => innerWidth < 600 ? 'phone' : innerWidth < 1100 ? 'tablet' : 'desktop';
  let P = PROFILES[device()];
  const suffix = P.small ? '-m.jpg' : '.jpg';

  /* ---------- DOM ---------- */
  const el = document.createElement('div');
  el.className = 'intro' + (DAY ? ' intro-day' : '') + (reduce ? ' reduce' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Chào mừng đến với ' + INTRO.brand);
  el.innerHTML = `
    <div class="intro-stage" aria-hidden="true">
      <img class="intro-shot" data-shot="clouds" alt="">
      <img class="intro-shot" data-shot="final" alt="">
      <div class="intro-dim"></div>
    </div>
    <canvas aria-hidden="true"></canvas>
    <button class="intro-skip" type="button" data-at="1">Bỏ qua</button>
    ${INTRO.tapToStart ? `<div class="intro-gate" role="button" tabindex="-1"><img src="${INTRO.logo}" alt=""><div class="intro-gate-row"><button class="intro-tap" type="button">${INTRO.tapText}</button>${window.PSQLang ? `<button class="intro-lang" type="button" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg><span>${PSQLang.current === 'vi' ? 'Chọn ngôn ngữ' : PSQLang.info.name}</span></button>` : ''}</div></div>` : ''}
    <button class="intro-sound" type="button" data-at="1" aria-label="Bật/tắt nhạc" hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="x" d="M16 9l6 6M22 9l-6 6"/></svg>
    </button>
    <div class="intro-ui">
      <div class="intro-logo" data-at="5.8" role="img" aria-label="${INTRO.brand}">
        <img src="${INTRO.logo}" alt="">
      </div>
      <div class="intro-center">
        <h1 data-at="7.4">${INTRO.headline}</h1>
        <p data-at="7.8">${INTRO.text}</p>
        <button class="intro-btn" type="button" id="introEnter" data-at="8.2">${INTRO.button}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12h15M13 6l6 6-6 6"/></svg>
        </button>
      </div>
      <div class="intro-foot" data-at="8.6">${INTRO.footer}</div>
    </div>`;
  document.documentElement.classList.add('intro-lock', 'intro-cover');
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  const mount = () => document.body.prepend(el);
  document.body ? mount() : document.addEventListener('DOMContentLoaded', mount);

  const shot = n => el.querySelector(`[data-shot="${n}"]`);
  const S = { clouds: shot('clouds'), final: shot('final') };
  S.clouds.src = IMG.clouds.src + suffix;
  S.final.src = IMG.land.src + suffix;
  const logoBox = el.querySelector('.intro-logo');
  const dim = el.querySelector('.intro-dim');
  let logoRect = null;
  const cv = el.querySelector('canvas');
  const ctx = cv.getContext('2d');

  /* ---------- tiện ích ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ease = t => 1 - Math.pow(1 - clamp(t), 3);
  const ramp = (t, [a, b]) => smooth((t - a) / (b - a));
  const off = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  function radialSprite(size, stops) {
    const c = off(size, size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- máy quay: [giây, x, y, zoom] trên ảnh gốc ---------- */
  const CAM = {
    clouds: [[0, 860, 470, 1.12], [3.8, 960, 430, 1.32]],
    fire:   [[3.0, 250, 748, 2.6], [7.2, 262, 732, 2.85]],
    portal: [[0, 1040, 400, 1.05], [2.0, 1040, 360, 1.5], [3.3, 1040, 335, 3.4]],
    final:  [[4.2, 835, 460, 1.18], [7.4, 835, 470, 1]]
  };
  let W = 0, H = 0, DPR = 1;
  function camAt(track, t) {
    let k = 0;
    while (k < track.length - 1 && t > track[k + 1][0]) k++;
    const a = track[k], b = track[Math.min(k + 1, track.length - 1)];
    const u = b[0] === a[0] ? 1 : smooth((t - a[0]) / (b[0] - a[0]));
    const z = a[3] + (b[3] - a[3]) * u;
    return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u, z: 1 + (z - 1) * P.zoom };
  }
  function place(cam, iw, ih) {
    const s = Math.max(W / iw, H / ih) * cam.z;
    let tx = W / 2 - cam.x * s, ty = H / 2 - cam.y * s;
    tx = Math.min(0, Math.max(W - iw * s, tx));
    ty = Math.min(0, Math.max(H - ih * s, ty));
    return { s, tx, ty, map: (x, y) => [tx + x * s, ty + y * s] };
  }
  const setShot = (img, v, op, filter) => {
    img.style.transform = `translate3d(${v.tx}px,${v.ty}px,0) scale(${v.s})`;
    img.style.opacity = op;
    img.style.visibility = op > 0.003 ? 'visible' : 'hidden';
    if (filter !== undefined) img.style.filter = filter;
  };

  /* ---------- sprite và hạt ---------- */
  const sp = {};
  let dust = [], mist = [], smoke = [], embers = [], sparks = [];
  function build() {
    W = innerWidth; H = innerHeight; logoRect = null; ringCache = null;
    P = PROFILES[device()]; el.dataset.device = device();
    DPR = lite ? 0.6 : Math.min(devicePixelRatio || 1, P.dpr);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // màn hình dọc (điện thoại, iPad dọc): dời máy quay để luôn thấy mặt trời và tia sáng
    const vis = W / Math.max(W / 1672, H / 941);
    const fx = Math.max(835, Math.min(1672 - vis / 2, 1440 - vis / 2));
    const cx1 = Math.max(860, 1560 - vis * 0.45);
    CAM.clouds = [[0, cx1, 470, 1.12], [5.4, cx1 + 110, 425, 1.36]];
    CAM.final = [[4.2, fx, 460, 1.18], [7.4, fx, 470, 1]];
    sp.smoke = sp.smoke || radialSprite(128, [[0, 'rgba(236,230,222,.5)'], [.45, 'rgba(220,214,206,.2)'], [1, 'rgba(220,214,206,0)']]);
    sp.gold = sp.gold || radialSprite(64, [[0, 'rgba(255,240,196,1)'], [.22, 'rgba(244,196,96,.7)'], [1, 'rgba(244,196,96,0)']]);
    sp.mist = sp.mist || radialSprite(256, [[0, 'rgba(255,236,214,.6)'], [.55, 'rgba(240,220,200,.2)'], [1, 'rgba(240,220,200,0)']]);
    sp.glow = sp.glow || radialSprite(256, [[0, 'rgba(255,224,160,.95)'], [.3, 'rgba(255,170,80,.35)'], [1, 'rgba(255,150,60,0)']]);
    sp.sun = sp.sun || radialSprite(256, [[0, 'rgba(255,255,240,1)'], [.1, 'rgba(255,240,190,.95)'], [.35, 'rgba(255,190,100,.35)'], [1, 'rgba(255,150,60,0)']]);
    sp.fire = sp.fire || radialSprite(64, [[0, 'rgba(255,170,60,.9)'], [.4, 'rgba(255,110,30,.45)'], [1, 'rgba(255,80,20,0)']]);
    sp.fireCore = sp.fireCore || radialSprite(64, [[0, 'rgba(255,250,220,1)'], [.35, 'rgba(255,210,110,.7)'], [1, 'rgba(255,140,40,0)']]);
    sp.rays = off(Math.ceil(W / 4), Math.ceil(H / 4));
    dust = Array.from({ length: Math.round(P.dust * (lite ? .5 : 1)) }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.5, 5), vy: rnd(5, 15), vx: rnd(-4, 4), ph: rnd(0, 6.28), sp: rnd(.6, 1.8) }));
    // mây: vị trí theo tỉ lệ màn hình, trôi ngang, nhấp nhô nhẹ
    mist = Array.from({ length: Math.round(P.mist * (lite ? .6 : 1)) }, (_, i) => ({ x: rnd(-0.3, 1.3), y: rnd(0.42, 1.02), w: rnd(0.45, 1), h: rnd(0.1, 0.22), v: rnd(0.012, 0.035) * (i % 3 ? 1 : -0.6), a: rnd(.45, 1), ph: rnd(0, 6.28) }));
  }

  /* ---------- tia sáng mềm (vẽ trên lớp nhỏ rồi phóng to cho mịn) ---------- */
  // lớp mềm độ phân giải 1/4: tia nắng, mặt trời, chùm sáng vẽ chung vào đây rồi phóng ra màn hình 1 lần mỗi khung hình
  const Q = 0.25;
  let softUsed = false;
  function soft() {
    const rc = sp.rays, rg = rc.getContext('2d');
    if (!softUsed) { softUsed = true; rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, rc.width, rc.height); rg.setTransform(Q, 0, 0, Q, 0, 0); rg.globalCompositeOperation = 'lighter'; }
    return rg;
  }
  function softFlush() {
    if (!softUsed) return; softUsed = false;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    ctx.drawImage(sp.rays, 0, 0, W, H);
  }
  function rays(sx, sy, strength, t, spread = [0.5, 1.0], count = 10) {
    if (strength < 0.01) return;
    const rg = soft();
    rg.globalAlpha = Math.min(1, strength);
    const len = Math.max(W, H) * 1.3;
    for (let k = 0; k < count; k++) {
      const a = Math.PI * (spread[0] + (spread[1] - spread[0]) * (k + .5) / count) + Math.sin(t * 0.22 + k * 1.7) * 0.02;
      const wdt = 0.018 + (k % 3) * 0.01;
      const pulse = .5 + .5 * Math.sin(t * 0.8 + k * 2.1);
      const gr = rg.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      gr.addColorStop(0, `rgba(255,216,150,${0.26 * pulse})`); gr.addColorStop(.5, `rgba(255,216,150,${0.06 * pulse})`); gr.addColorStop(1, 'rgba(255,216,150,0)');
      rg.fillStyle = gr;
      rg.beginPath(); rg.moveTo(sx, sy);
      rg.lineTo(sx + Math.cos(a - wdt) * len, sy + Math.sin(a - wdt) * len);
      rg.lineTo(sx + Math.cos(a + wdt) * len, sy + Math.sin(a + wdt) * len); rg.fill();
    }
  }
  function softGlow(img, x, y, w, h, alpha) { const rg = soft(); rg.globalAlpha = Math.min(1, alpha); rg.drawImage(img, x, y, w, h); }

  /* ---------- ngọn lửa: hạt lửa nhỏ bốc lên, cháy nhẹ ---------- */
  let fire = [];
  function flame(v, t, dt, a) {
    const [bx, by] = IMG.land.burner;
    if (a > 0.01) for (let k = 0; k < Math.round(dt * 90); k++)
      fire.push({ x: bx + rnd(-10, 10), y: by - rnd(0, 4), vx: rnd(-5, 5), vy: rnd(-95, -55), age: 0, life: rnd(.3, .7), s: rnd(8, 13) });
    ctx.globalCompositeOperation = 'lighter';
    // quầng sáng chân lửa, lay động
    const fl = .75 + .15 * Math.sin(t * 9.1) + .1 * Math.sin(t * 17.3);
    const [gx, gy] = v.map(bx, by - 8), gs = 70 * v.s;
    ctx.globalAlpha = a * .5 * fl; ctx.drawImage(sp.glow, gx - gs, gy - gs * .8, gs * 2, gs * 1.6);
    for (let k = fire.length - 1; k >= 0; k--) {
      const f = fire[k]; f.age += dt;
      if (f.age > f.life) { fire.splice(k, 1); continue; }
      const u = f.age / f.life;
      f.x += (f.vx + Math.sin(t * 6 + f.y * .1) * 8) * dt; f.y += f.vy * dt; f.vx *= .96;
      const [qx, qy] = v.map(f.x, f.y), r = f.s * (1 - u * .7) * v.s;
      ctx.globalAlpha = a * (1 - u) * .55;
      ctx.drawImage(u < .35 ? sp.fireCore : sp.fire, qx - r, qy - r * 1.3, r * 2, r * 2.6);
    }
  }

  /* ---------- vòng sáng cảnh cuối ---------- */
  function ringGeom(view) {
    const [rx, ry, rr] = IMG.land.ring;
    let [cx, cy] = view.map(rx, ry), R = rr * view.s;
    const max = Math.min(W * P.ringW, H * P.ringH);
    if (R > max) { R = max; cx = W / 2; cy = H * 0.5; }
    return { cx, cy, R };
  }
  // vòng sáng vẽ sẵn 1 lần lên lớp riêng rồi chỉ phóng to, thay vì vẽ lại 256 nét mỗi khung hình
  let ringCache = null;
  function ringSprite(R) {
    const pad = 30, size = Math.ceil((R + pad) * 2), c = off(Math.ceil(size * DPR), Math.ceil(size * DPR)), g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'lighter';
    const cx = size / 2, cy = size / 2, SEG = 64, step = Math.PI * 2 / SEG;
    for (let k = 0; k < SEG; k++) {
      const a = -Math.PI / 2 + k * step, side = Math.pow(Math.abs(Math.cos(a + step / 2)), 2.2), wv = 0.06 + 0.94 * side;
      g.strokeStyle = '#f2b955';
      [[38, .07], [18, .16], [7, .36]].forEach(([w, al]) => {
        g.globalAlpha = al * wv; g.lineWidth = w * (0.6 + side * 0.6);
        g.beginPath(); g.arc(cx, cy, R, a, a + step * 1.02); g.stroke();
      });
      g.globalAlpha = 0.12 + 0.88 * wv; g.strokeStyle = '#ffe9b8'; g.lineWidth = 1.2 + side * 1.2;
      g.beginPath(); g.arc(cx, cy, R, a, a + step * 1.02); g.stroke();
    }
    g.globalAlpha = .2; g.fillStyle = '#ffe6b0';
    g.fillRect(cx - .5, cy - R * 0.2, 1, R * 0.12);
    g.fillRect(cx - .5, cy + R * 0.42, 1, R * 0.75);
    return { c, R, size };
  }
  function drawRing(g, t, alpha, ex) {
    const { cx, cy } = g, R = g.R * (1 + ex * 1.8) * (1 + Math.sin(t * 0.8) * 0.004), fade = alpha * (1 - ex);
    if (fade < 0.01) return;
    if (!ringCache || Math.abs(ringCache.R - g.R) > g.R * 0.12) ringCache = ringSprite(g.R);
    const k = R / ringCache.R, sz = ringCache.size * k;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    ctx.drawImage(ringCache.c, cx - sz / 2, cy - sz / 2, sz, sz);
    for (let k = 0; k < 6; k++) {
      const a = t * (0.18 + k * 0.03) + k * 1.05, tw = .5 + .5 * Math.sin(t * 2 + k);
      ctx.globalAlpha = (.35 + tw * .5) * fade;
      ctx.drawImage(sp.gold, cx + Math.cos(a) * R - 9, cy + Math.sin(a) * R - 9, 18, 18);
    }
  }

  /* ---------- vòng lặp ---------- */
  let t0 = 0, last = 0, clock = 0, lite = false, frames = [], exitAt = 0, raf = 0, done = false, started = false, litDone = false;

  function frame() {
    const now = performance.now();
    const real = now - last;
    const dt = Math.min(0.05, real / 1000); last = now;
    // đồng hồ intro chỉ tiến tối đa 0,1 giây mỗi khung hình: máy bận hay giật thì intro chậm lại chứ không nhảy cóc mất cảnh đầu
    clock += Math.min(0.1, real / 1000);
    const t = reduce ? 16 : clock;
    // máy yếu (dưới khoảng 30 khung hình/giây): tự giảm độ nét lớp hiệu ứng và số hạt để chạy mượt
    if (!lite && !exitAt && frames.length < 16) {
      frames.push(real);
      if (frames.length === 16) { const m = frames.slice(4).sort((a, b) => a - b)[6]; if (m > 34) { lite = true; el.classList.add('lite'); build(); } }
    }
    const ex = exitAt ? ease((now - exitAt) / 1300) : 0;

    // độ hiện của từng cảnh
    const o1 = ramp(t, T.s1in) * (1 - ramp(t, T.s1out));
    const o2 = 0; // cảnh lửa khói đã bỏ theo yêu cầu, giữ code để bật lại nếu cần
    const o3 = 0; // cổng sáng đã bỏ theo yêu cầu
    const o4 = reduce ? 1 : ramp(t, T.fin);
    const sun = reduce ? 1 : ramp(t, T.sunrise);           // mặt trời ló dần

    const v1 = place(camAt(CAM.clouds, t), IMG.clouds.w, IMG.clouds.h);
    const v2 = place(camAt(CAM.fire, 0), IMG.land.w, IMG.land.h);
    const v3 = place(camAt(CAM.portal, 0), IMG.portal.w, IMG.portal.h);
    const v4 = place(camAt(CAM.final, t), IMG.land.w, IMG.land.h);
    setShot(S.clouds, v1, o1);
    // cảnh cuối: bắt đầu tối như trước bình minh, sáng dần khi mặt trời lên
    const b0 = DAY ? 0.5 : 0.3;   // ban ngày không tối quá lúc đầu
    setShot(S.final, v4, o4);
    // làm tối bằng lớp phủ thay cho filter, nhẹ máy hơn nhiều
    const dk = (o4 * (1 - b0) * (1 - sun)).toFixed(3);
    if (dim.style.opacity !== dk) dim.style.opacity = dk;
    if (ex) S.final.style.transform += ` scale(${1 + ex * 0.06})`;

    ctx.clearRect(0, 0, W, H);

    /* Cảnh 1: tia nắng + mây bồng bềnh */
    if (o1 > 0.01) {
      const [sx, sy] = v1.map(...IMG.clouds.sun);
      rays(sx, sy, o1 * (.55 + .2 * Math.sin(t * .9)), t, [0.55, 1.05], 11);
      const gs = Math.min(W, H) * 0.35;
      softGlow(sp.sun, sx - gs, sy - gs, gs * 2, gs * 2, o1 * (.55 + .1 * Math.sin(t * 1.3)));
    }
    const cloudA = o1 * 0.85 + o4 * 0.25;
    if (cloudA > 0.01) {
      ctx.globalCompositeOperation = 'screen';
      for (const m of mist) {
        m.x += m.v * dt;
        if (m.x > 1.5) m.x = -0.5; if (m.x < -0.5) m.x = 1.5;
        const w = m.w * W * 1.3, h = m.h * H * (1 + .06 * Math.sin(t * .6 + m.ph));
        const yy = m.y * H + Math.sin(t * .35 + m.ph) * H * 0.01;
        ctx.globalAlpha = clamp(cloudA * m.a * 0.6);
        ctx.drawImage(sp.mist, m.x * W - w / 2, yy - h / 2, w, h);
      }
    }

    /* Cảnh 2: lửa + khói */
    const smokeOn = o2 + o4 * .6;
    if (!reduce && Math.random() < dt * P.smoke) {
      const [x, y] = IMG.land.burner;
      smoke.push({ x: x + rnd(-3, 3), y: y - 30, age: 0, life: rnd(5, 8), s: rnd(7, 12), ph: rnd(0, 6.28), sway: rnd(24, 55), f: rnd(.5, 1), lean: rnd(-50, -15) });
    }
    if (o2 > 0.01 && Math.random() < dt * 14) {
      const [x, y] = IMG.land.burner;
      embers.push({ x: x + rnd(-8, 8), y: y - 10, vx: rnd(-8, 8), vy: rnd(-40, -20), age: 0, life: rnd(1.2, 2.6) });
    }
    if (o2 > 0.01) {
      const [wx, wy] = v2.map(...IMG.land.wood);
      const fl = .6 + .25 * Math.sin(t * 7.3) + .15 * Math.sin(t * 13.1 + 1);
      const gs = 260 * v2.s;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o2 * .2 * fl;
      ctx.drawImage(sp.glow, wx - gs, wy - gs, gs * 2, gs * 2);
    }
    flame(v2, t, dt, o2);
    ctx.globalCompositeOperation = 'screen';
    for (let k = smoke.length - 1; k >= 0; k--) {
      const p = smoke[k]; p.age += dt;
      if (p.age > p.life) { smoke.splice(k, 1); continue; }
      const a = p.age / p.life;
      p.y -= dt * (26 + a * 18);   // khói bay lên chậm
      const x = p.x + Math.sin(p.ph + p.age * p.f * 1.4) * p.sway * a * a + p.lean * a * a * 1.6;
      const s = p.s * (1 + a * 4.5);
      const al = Math.sin(Math.PI * Math.sqrt(a)) * 0.28;
      for (const [v, op] of [[v2, o2], [v4, o4 * .55]]) {
        if (op < 0.02) continue;
        const [qx, qy] = v.map(x, p.y), ss = s * v.s;
        ctx.globalAlpha = al * op;
        ctx.drawImage(sp.smoke, qx - ss / 2, qy - ss, ss, ss * 2.2);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let k = embers.length - 1; k >= 0; k--) {
      const e = embers[k]; e.age += dt;
      if (e.age > e.life) { embers.splice(k, 1); continue; }
      e.x += e.vx * dt + Math.sin(e.age * 6) * .3; e.y += e.vy * dt;
      const [qx, qy] = v2.map(e.x, e.y), r = 4 * v2.s * (1 - e.age / e.life);
      ctx.globalAlpha = o2 * (1 - e.age / e.life);
      ctx.drawImage(sp.gold, qx - r, qy - r, r * 2, r * 2);
    }

    /* Chuyển cảnh: cổng sáng trên mặt nước */
    if (o3 > 0.01) {
      const [px, py, prx, pry] = IMG.portal.ring;
      const [cx, cy] = v3.map(px, py), rx = prx * v3.s, ry = pry * v3.s;
      const pulse = .6 + .4 * Math.sin(t * 2.2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#f5c46a';
      [[26, .06], [12, .12], [4, .3]].forEach(([w, a]) => {
        ctx.globalAlpha = a * o3 * pulse; ctx.lineWidth = w * v3.s;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      });
      // bóng phản chiếu lăn tăn dưới nước
      const wy = v3.map(0, IMG.portal.water)[1];
      ctx.globalAlpha = .12 * o3 * pulse; ctx.lineWidth = 6 * v3.s;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(cx + Math.sin(t * 3 + k) * 4 * v3.s, wy + (wy - cy), rx * (1 + k * .01), ry * .96, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // hạt vàng bốc lên dọc bờ nước
      if (Math.random() < dt * 40) sparks.push({ x: rnd(0, IMG.portal.w), y: IMG.portal.water - rnd(0, 30), vy: rnd(-90, -30), age: 0, life: rnd(1, 2.4), len: rnd(10, 40) });
      // máy quay xuyên qua vòng: lóe sáng ở tâm
      const fly = ramp(t, [5.2, 6.2]);
      if (fly > 0) {
        const gs = Math.max(W, H) * (0.3 + fly);
        ctx.globalAlpha = fly * .9 * o3; ctx.drawImage(sp.sun, cx - gs, cy - gs, gs * 2, gs * 2);
      }
    }
    for (let k = sparks.length - 1; k >= 0; k--) {
      const s = sparks[k]; s.age += dt;
      if (s.age > s.life) { sparks.splice(k, 1); continue; }
      s.y += s.vy * dt;
      const [qx, qy] = v3.map(s.x, s.y), L = s.len * v3.s;
      const g = ctx.createLinearGradient(qx, qy, qx, qy + L);
      g.addColorStop(0, 'rgba(255,220,140,.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.globalAlpha = o3 * (1 - s.age / s.life); ctx.fillStyle = g; ctx.fillRect(qx - .7, qy, 1.4, L);
    }

    /* Cảnh 3: mặt trời ló dần, tia sáng chiếu tới logo */
    if (o4 > 0.01) {
      const [bsx, bsy] = v4.map(...IMG.land.sun);
      const rise = 1 - sun;
      const sx = bsx, sy = bsy + rise * 60 * v4.s;
      const gs = Math.min(W, H) * (0.18 + 0.32 * sun);
      softGlow(sp.sun, sx - gs, sy - gs, gs * 2, gs * 2, o4 * (0.15 + 0.85 * sun) * (.9 + .1 * Math.sin(t * 1.4)));
      rays(sx, sy, o4 * sun * .55, t, [0.6, 1.1], 9);

      // chùm sáng từ mặt trời tới logo
      const lb = (t > 7.3 && logoRect) || (logoRect = logoBox.getBoundingClientRect());
      const lx = lb.left + lb.width / 2, ly = lb.top + lb.height / 2;
      const beam = reduce ? .2 : ramp(t, T.beam) * (1 - ramp(t, [7.4, 8.8]) * .8);
      if (beam > 0.01 && lb.width) {
        const prog = reduce ? 1 : ease((t - T.beam[0]) / 1.0);
        const ex2 = sx + (lx - sx) * prog, ey2 = sy + (ly - sy) * prog;
        // vẽ chùm sáng trên lớp nhỏ rồi phóng to để mép mềm như tia nắng thật
        const rg = soft(); rg.globalAlpha = beam;
        const ang = Math.atan2(ey2 - sy, ex2 - sx), nx = -Math.sin(ang), ny = Math.cos(ang);
        for (const [w0, w1, al] of [[10, lb.width * .42, .16], [4, lb.width * .2, .3], [2, lb.width * .07, .55]]) {
          const g = rg.createLinearGradient(sx, sy, ex2, ey2);
          g.addColorStop(0, `rgba(255,232,175,${al})`); g.addColorStop(.7, `rgba(255,220,150,${al * .8})`); g.addColorStop(1, `rgba(255,214,140,${al * .35})`);
          rg.fillStyle = g; rg.beginPath();
          rg.moveTo(sx + nx * w0, sy + ny * w0); rg.lineTo(ex2 + nx * w1, ey2 + ny * w1);
          rg.lineTo(ex2 - nx * w1, ey2 - ny * w1); rg.lineTo(sx - nx * w0, sy - ny * w0); rg.fill();
        }
        // điểm chạm phát sáng
        const hs = lb.width * (0.4 + 0.3 * beam);
        softGlow(sp.glow, ex2 - hs, ey2 - hs, hs * 2, hs * 2, beam * .7);
      }
      if (!litDone && (reduce || t >= T.logoLit)) { litDone = true; logoBox.classList.add('lit'); }

      softFlush();
      drawRing(ringGeom(v4), t, reduce ? 1 : ramp(t, T.ring), ex);
    }

    softFlush();
    /* bụi vàng lơ lửng */
    ctx.globalCompositeOperation = 'lighter';
    const dustOn = reduce ? .8 : (o2 * .9 + o4 * ramp(t, [5.2, 7.2]) + o1 * .35) * (1 - ex);
    if (dustOn > 0.01) for (const d of dust) {
      d.y -= d.vy * dt; d.x += (d.vx + Math.sin(t * .5 + d.ph) * 6) * dt;
      if (d.y < -10) { d.y = H + 10; d.x = rnd(0, W); }
      const tw = .5 + .5 * Math.sin(t * d.sp + d.ph);
      ctx.globalAlpha = dustOn * (.2 + tw * .6);
      const r = d.r * (.7 + tw * .5);
      ctx.drawImage(sp.gold, d.x - r, d.y - r, r * 2, r * 2);
    }

    /* lóe sáng khi bấm Khám phá */
    if (ex > 0) {
      const g = ringGeom(v4), gs = Math.max(W, H);
      ctx.globalAlpha = Math.sin(Math.PI * ex) * .55;
      ctx.drawImage(sp.glow, g.cx - gs, g.cy - gs, gs * 2, gs * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    el.querySelectorAll('[data-at]:not(.on)').forEach(n => { if (t >= +n.dataset.at) n.classList.add('on'); });

    if (!done && !(reduce && !exitAt)) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (started) return; started = true;
    build();
    el.classList.add('ready');
    t0 = last = performance.now();
    raf = requestAnimationFrame(frame);
    playMusic();
  }
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) requestAnimationFrame(frame); }, 150); });

  /* ---------- nhạc nền ---------- */
  const sndBtn = el.querySelector('.intro-sound');
  const audio = INTRO.music ? new Audio(INTRO.music) : null;
  let muted = false, vol = 0, volTo = 0, volRaf = 0;
  const fadeTo = (v, sec) => {
    if (!audio) return;
    cancelAnimationFrame(volRaf);
    const from = vol, t1 = performance.now();
    const step = now => {
      const k = clamp((now - t1) / (sec * 1000));
      vol = from + (v - from) * k; audio.volume = clamp(vol);
      if (k < 1) volRaf = requestAnimationFrame(step); else if (v === 0) audio.pause();
    };
    volRaf = requestAnimationFrame(step);
  };
  const playMusic = () => {
    if (!audio || muted || exitAt) return;
    audio.volume = vol;
    const pr = audio.play();
    if (pr && pr.then) pr.then(() => { sndBtn.classList.remove('off'); fadeTo(INTRO.volume, 2.5); unhook(); }).catch(() => sndBtn.classList.add('off'));
  };
  const unlock = e => { if (!e.target.closest || !e.target.closest('.intro-sound, #introEnter, .intro-skip')) playMusic(); };
  const unhook = () => ['pointerdown', 'touchend', 'keydown'].forEach(n => removeEventListener(n, unlock, true));
  if (audio) {
    audio.loop = true; audio.preload = 'metadata'; // phát dần khi tải, không tải hết trước
    sndBtn.hidden = false; sndBtn.classList.add('off');
    ['pointerdown', 'touchend', 'keydown'].forEach(n => addEventListener(n, unlock, true));
    sndBtn.addEventListener('click', () => {
      if (audio.paused) { muted = false; playMusic(); }
      else { muted = true; sndBtn.classList.add('off'); fadeTo(0, .4); }
    });
  }

  function enter() {
    if (exitAt) return;
    exitAt = performance.now();
    if (audio) { unhook(); fadeTo(0, 1.3); }
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // hiện trang chủ bên dưới trước (intro vẫn che kín), đợi trình duyệt vẽ xong rồi mới cho intro tan, để lúc tan không bị khựng
    document.documentElement.classList.remove('intro-cover');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('leaving');
      document.dispatchEvent(new CustomEvent('psq:intro-leave'));
      setTimeout(() => {
        done = true; cancelAnimationFrame(raf); el.remove();
        document.documentElement.classList.remove('intro-lock');
        if (force) history.replaceState(null, '', location.pathname);
      }, reduce ? 400 : 1400);
    }));
    if (reduce) raf = requestAnimationFrame(frame);

  }
  el.addEventListener('click', e => { if (e.target.closest('#introEnter, .intro-skip')) enter(); });
  addEventListener('keydown', e => { if (document.querySelector('.intro-gate:not(.gone)') || document.querySelector('.lang-pop')) return; if (!exitAt && (e.key === 'Enter' || e.key === 'Escape')) enter(); });

  // chờ cả 2 ảnh và phông chữ sẵn sàng rồi mới chạy, để cảnh không bị trống hay giật lúc đầu
  const decode = img => (img.decode ? img.decode() : new Promise(r => { img.complete ? r() : (img.onload = img.onerror = r); })).catch(() => {});
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  const loaded = new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }));
  // màn hình "Chạm để bắt đầu": cú chạm cho phép phát nhạc, intro chạy khi đã chạm và ảnh đã tải xong
  const gate = el.querySelector('.intro-gate');
  let tapped = !gate, isReady = false;
  const begin = () => { if (tapped && isReady) start(); };
  const langBtn = el.querySelector('.intro-lang');
  if (langBtn) langBtn.addEventListener('click', e => { e.stopPropagation(); if (document.querySelector('.lang-pop')) return PSQLang.close(); PSQLang.menu(langBtn, { center: true, parent: el }); });
  if (gate) setTimeout(() => { const t = gate.querySelector('.intro-tap'); t && t.focus({ preventScroll: true }); }, 50);
  if (gate) gate.addEventListener('click', e => {
    if (tapped || e.target.closest('.intro-lang, .lang-pop')) return; tapped = true; playMusic();
    gate.classList.add('gone'); setTimeout(() => gate.remove(), 900);
    begin();
  });
  const markReady = () => { isReady = true; el.classList.add('loaded'); begin(); };
  const go = () => Promise.all([decode(S.clouds), decode(S.final), fonts, loaded]).then(() => requestAnimationFrame(() => requestAnimationFrame(markReady)));
  const ready = () => { go(); setTimeout(markReady, 6000); };
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', ready) : ready();
  window.PSQIntro = { enter };
})();
