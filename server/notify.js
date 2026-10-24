/* Báo cho chủ cửa hàng khi có đơn mới, yêu cầu nạp tiền, rút tiền.
   - Telegram (Trợ Lý Phúc Sinh): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (một hoặc nhiều mã, cách nhau dấu phẩy). Tin có nút mở trang xác nhận.
   - Webhook chung (ví dụ cầu nối Zalo): NOTIFY_WEBHOOK nhận JSON { text, url, kind }.
   Có ảnh (photo: { buf, type }) thì gửi ảnh kèm chú thích, ví dụ ảnh bill chuyển khoản.
   Không cấu hình gì thì chỉ ghi ra nhật ký máy chủ. */
'use strict';

async function notify(env, { text, url, button, kind, photo }) {
  const jobs = [];
  // TELEGRAM_CHAT_ID có thể ghi nhiều mã, cách nhau dấu phẩy (gửi cho tất cả)
  const chats = String(env.TELEGRAM_CHAT_ID || '').split(/[,\s]+/).filter(Boolean);
  if (env.TELEGRAM_BOT_TOKEN) for (const chat of chats) {
    const markup = url ? { inline_keyboard: [[{ text: button || 'Mở trang xác nhận', url }]] } : null;
    let req;
    if (photo) {
      const f = new FormData();
      f.append('chat_id', chat); f.append('caption', text.slice(0, 1024));
      if (markup) f.append('reply_markup', JSON.stringify(markup));
      f.append('photo', new Blob([photo.buf], { type: photo.type }), 'bill.' + (photo.type.split('/')[1] || 'jpg'));
      req = fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: f });
    } else {
      const body = { chat_id: chat, text, disable_web_page_preview: true };
      if (markup) body.reply_markup = markup;
      req = fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
    jobs.push(req.then(r => r.ok || r.text().then(t => { throw new Error('Telegram ' + r.status + ' ' + t.slice(0, 200)); })));
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

// gửi riêng cho một người (mỗi người một nút riêng, ví dụ nhắc giao hàng). buttons: [[{ text, url }]]
async function sendTo(env, chat, { text, photo, buttons }) {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'Chưa cấu hình Telegram.' };
  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/`, markup = buttons ? JSON.stringify({ inline_keyboard: buttons }) : null;
  let r;
  if (photo) {
    const f = new FormData();
    f.append('chat_id', chat); f.append('caption', text.slice(0, 1024));
    if (markup) f.append('reply_markup', markup);
    f.append('photo', new Blob([photo.buf], { type: photo.type }), 'anh.' + (photo.type.split('/')[1] || 'jpg'));
    r = await fetch(base + 'sendPhoto', { method: 'POST', body: f });
  } else {
    r = await fetch(base + 'sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true, ...(markup ? { reply_markup: JSON.parse(markup) } : {}) }) });
  }
  if (r.ok) return { ok: true };
  const t = await r.text(); return { ok: false, error: 'Telegram ' + r.status + ' ' + t.slice(0, 200) };
}
// tên hiển thị của một người trên Telegram (để ghi ai đã bấm xác nhận); không đọc tin nhắn của bot
const names = new Map();
async function chatName(env, chat) {
  if (names.has(chat)) return names.get(chat);
  let n = 'Telegram ' + chat;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(chat)}`).then(x => x.json());
    const c = r && r.result; if (c) n = [c.first_name, c.last_name].filter(Boolean).join(' ') + (c.username ? ' (@' + c.username + ')' : '') || n;
  } catch (e) {}
  names.set(chat, n); return n;
}
const chatsOf = v => String(v || '').split(/[,\s]+/).filter(Boolean);

module.exports = { notify, sendTo, chatName, chatsOf };
