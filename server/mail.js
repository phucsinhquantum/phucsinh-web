/* Gửi thư qua SMTP có mã hóa (mặc định Gmail: smtp.gmail.com cổng 465, đăng nhập bằng "mật khẩu ứng dụng").
   Cấu hình do chủ sở hữu nhập trong Quản trị > Thiết lập > Email, lưu trên máy chủ, không trả về trình duyệt. */
'use strict';
const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
const encHead = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;

function sendMail(cfg, { to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    if (!cfg || !cfg.user || !cfg.pass) return reject(new Error('Chưa cấu hình email gửi thư.'));
    const host = cfg.host || 'smtp.gmail.com', port = +cfg.port || 465, from = cfg.user;
    const fromName = cfg.fromName || 'Phúc Sinh QuanTum';
    const boundary = 'psq' + crypto.randomBytes(8).toString('hex');
    const plain = text || String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const body = [
      `From: ${encHead(fromName)} <${from}>`, `To: <${to}>`, `Subject: ${encHead(subject)}`,
      `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@${from.split('@')[1] || 'psq'}>`,
      'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
      `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(plain).replace(/.{76}/g, '$&\r\n'),
      `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html || plain).replace(/.{76}/g, '$&\r\n'),
      `--${boundary}--`, ''
    ].join('\r\n').replace(/\r\n\./g, '\r\n..');
    const steps = [
      [null, 220], ['EHLO psq', 250], ['AUTH LOGIN', 334], [b64(cfg.user), 334], [cfg.pass ? b64(cfg.pass) : '', 235],
      [`MAIL FROM:<${from}>`, 250], [`RCPT TO:<${to}>`, 250], ['DATA', 354], [body + '\r\n.', 250], ['QUIT', 221]
    ];
    let i = 0, buf = '', done = false;
    const sock = port === 465 ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const fail = e => { if (done) return; done = true; try { sock.destroy(); } catch (x) {} reject(e); };
    sock.setTimeout(20000, () => fail(new Error('Máy chủ thư không trả lời.')));
    sock.on('error', fail);
    sock.on('data', chunk => {
      buf += chunk.toString('utf8');
      // chờ dòng trả lời cuối (mã + dấu cách)
      const lines = buf.split('\r\n'); if (lines.length < 2) return;
      const last = lines[lines.length - 2]; if (!/^\d{3} /.test(last)) return;
      buf = '';
      const code = +last.slice(0, 3), want = steps[i][1];
      if (code !== want) return fail(new Error(code === 535 ? 'Email hoặc mật khẩu ứng dụng chưa đúng.' : 'Máy chủ thư báo lỗi: ' + last));
      i++;
      if (i >= steps.length) { done = true; sock.end(); return resolve(true); }
      sock.write(steps[i][0] + '\r\n');
      if (steps[i][1] === 221) { done = true; resolve(true); }
    });
  });
}

module.exports = { sendMail };
