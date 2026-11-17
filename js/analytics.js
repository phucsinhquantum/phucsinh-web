/* Phúc Sinh QuanTum: đo lượt truy cập bằng PostHog (thêm 17/11/2026).
   Quyền riêng tư: không cookie (lưu trong bộ nhớ trang), không ghi màn hình, không gắn hồ sơ khách ẩn danh,
   không ghi nội dung khách gõ. Chỉ đếm lượt xem trang, các nút chính và liên hệ. */
(function () {
  'use strict';
  var KEY = 'phc_BExptYTZU8arScwJfUGAVaWownhTGaCe7BRkkZPQxyp6';
  var HOST = 'https://us.i.posthog.com';
  function cap(name, props) { try { if (window.posthog && window.posthog.capture) window.posthog.capture(name, props || {}); } catch (e) {} }
  function start() {
    try {
      window.posthog.init(KEY, {
        api_host: HOST,
        persistence: 'memory',
        person_profiles: 'identified_only',
        disable_session_recording: true,
        capture_pageview: true,
        capture_pageleave: false,
        autocapture: false,
        disable_surveys: true,
        capture_dead_clicks: false,
        capture_performance: false,
        disable_web_experiments: true,
        ip: false
      });
    } catch (e) {}
  }
  var s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://us-assets.i.posthog.com/static/array.js';
  s.onload = start;
  document.head.appendChild(s);

  // các nút chính (bắt bằng lắng nghe chung, không đụng mã cũ)
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('a,button') : null;
    if (!el) return;
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    var href = el.getAttribute('href') || '';
    if (/^tel:/i.test(href)) cap('lien_he_goi', { trang: location.pathname });
    else if (/zalo\.me/i.test(href)) cap('lien_he_zalo', { trang: location.pathname });
    else if (/m\.me|messenger/i.test(href)) cap('lien_he_messenger', { trang: location.pathname });
    else if (/^mua ngay$/i.test(txt)) cap('bam_mua_ngay', { trang: location.pathname });
    else if (/^th[eê]m$/i.test(txt)) cap('bam_them_gio', { trang: location.pathname });
    else if (/thanh-vien\.html/.test(href) && /đăng ký/i.test(txt)) cap('bam_dang_ky_thanh_vien', { trang: location.pathname });
  }, true);
})();
