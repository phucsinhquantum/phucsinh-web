/* Báo cho chủ cửa hàng khi có đơn mới, yêu cầu nạp tiền, rút tiền.
   - Telegram (Trợ Lý Phúc Sinh): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (một hoặc nhiều mã, cách nhau dấu phẩy). Tin có nút mở trang xác nhận.
   - Webhook chung (ví dụ cầu nối Zalo): NOTIFY_WEBHOOK nhận JSON { text, url, kind }.
   Không cấu hình gì thì chỉ ghi ra nhật ký máy chủ. */
'use strict';

async function notify(env, { text, url, button, kind }) {
  const jobs = [];
  // TELEGRAM_CHAT_ID có thể ghi nhiều mã, cách nhau dấu phẩy (gửi cho tất cả)
  const chats = String(env.TELEGRAM_CHAT_ID || '').split(/[,\s]+/).filter(Boolean);
  if (env.TELEGRAM_BOT_TOKEN) for (const chat of chats) {
    const body = { chat_id: chat, text, disable_web_page_preview: true };
    if (url) body.reply_markup = { inline_keyboard: [[{ text: button || 'Mở trang xác nhận', url }]] };
    jobs.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.ok || r.text().then(t => { throw new Error('Telegram ' + r.status + ' ' + t.slice(0, 200)); })));
  }
  if (env.NOTIFY_WEBHOOK) {
    jobs.push(fetch(env.NOTIFY_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json', ...(env.NOTIFY_TOKEN ? { authorization: 'Bearer ' + env.NOTIFY_TOKEN } : {}) }, body: JSON.stringify({ text: url ? `${text}\n${button || 'Xác nhận'}: ${url}` : text, url, kind }) })
      .then(r => r.ok || Promise.reject(new Error('Webhook ' + r.status))));
  }
  if (!jobs.length) { console.log('[báo tin]', text, url || ''); return { ok: false, error: 'Chưa cấu hình Telegram (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).' }; }
  const res = await Promise.allSettled(jobs);
  const errors = res.filter(r => r.status === 'rejected').map(r => (r.reason && r.reason.message) || String(r.reason));
  errors.forEach(e => console.error('[báo tin lỗi]', e));
  return { ok: res.some(r => r.status === 'fulfilled'), error: errors.join('; ') };
}

module.exports = { notify };
