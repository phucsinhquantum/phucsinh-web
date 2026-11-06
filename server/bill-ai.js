'use strict';
/* AI đọc ảnh bill chuyển khoản (Claude, gọi thẳng API bằng fetch để máy chủ không cần cài thêm gói nào).
   read(cfg, buf, type) → { receipt, success, amount, time, content, account, name }
   compare(exp, got) → { ok, issues: [chữ cho khách], notes: [chữ chỉ quản trị thấy] }
   Khóa API lưu ở secret:ai (chủ sở hữu nhập trong Quản trị > Thiết lập) hoặc biến ANTHROPIC_API_KEY trong .env. */

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['receipt', 'success', 'amount', 'time', 'content', 'account', 'name'],
  properties: {
    receipt: { type: 'boolean', description: 'Ảnh có phải bill / biên lai chuyển khoản ngân hàng hoặc ví điện tử không' },
    success: { type: 'boolean', description: 'Giao dịch ghi là thành công' },
    amount: { type: 'integer', description: 'Số tiền chuyển, đơn vị đồng, chỉ số nguyên. 0 nếu không đọc được' },
    time: { type: 'string', description: 'Ngày giờ giao dịch dạng YYYY-MM-DD HH:MM (giờ Việt Nam). Chỉ có ngày thì YYYY-MM-DD. Rỗng nếu không có' },
    content: { type: 'string', description: 'Nội dung / lời nhắn chuyển khoản, chép nguyên văn. Rỗng nếu không có' },
    account: { type: 'string', description: 'Số tài khoản người nhận, chỉ chữ số. Rỗng nếu không có' },
    name: { type: 'string', description: 'Tên người hoặc đơn vị nhận tiền. Rỗng nếu không có' }
  }
};
const PROMPT = 'Đây là ảnh khách hàng gửi làm bằng chứng đã chuyển khoản (thường là ảnh chụp màn hình ứng dụng ngân hàng Việt Nam). ' +
  'Đọc đúng những gì in trên ảnh, không đoán. Số tiền viết kiểu 1.250.000 VND nghĩa là 1250000 đồng. ' +
  'Nếu ảnh không phải bill chuyển khoản thì receipt = false.';

async function read(cfg, buf, type) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 40e3);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({
        model: cfg.model || 'claude-opus-5-5', max_tokens: 4000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        fallbacks: 'default',
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: type, data: buf.toString('base64') } }, { type: 'text', text: PROMPT }] }]
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
    if (j.stop_reason === 'refusal') throw new Error('AI từ chối đọc ảnh');
    const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(txt);
  } finally { clearTimeout(t); }
}

const digits = s => String(s || '').replace(/\D/g, '');
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const money = n => (Math.round(+n || 0)).toLocaleString('vi-VN') + 'đ';
const ms = s => { const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s || '')); return m ? { t: Date.parse(m[1] + 'T' + (m[2] ? m[2] + ':' + m[3] : '00:00') + ':00+07:00'), day: !m[2], d: m[1] } : null; };

// exp: { amount, code, account, since ('YYYY-MM-DD HH:MM' giờ VN, lúc tạo đơn/yêu cầu), now (ms) }
function compare(exp, got) {
  const issues = [], notes = [];
  if (!got || !got.receipt) return { ok: false, issues: ['Ảnh này không giống bill chuyển khoản. Anh chị chụp lại màn hình giao dịch thành công trong ứng dụng ngân hàng.'], notes };
  if (got.success === false) issues.push('Bill không ghi giao dịch thành công.');
  if (!(+got.amount > 0)) issues.push('Không đọc được số tiền trên bill.');
  else if (Math.round(+got.amount) !== Math.round(+exp.amount)) issues.push(`Số tiền trên bill là ${money(got.amount)}, cần chuyển ${money(exp.amount)}.`);
  const bt = ms(got.time), since = ms(exp.since), now = exp.now || Date.now();
  if (!bt) issues.push('Không đọc được ngày giờ chuyển khoản trên bill.');
  else {
    const shown = bt.day ? bt.d.split('-').reverse().join('/') : String(got.time).slice(11, 16) + ' ngày ' + bt.d.split('-').reverse().join('/');
    if (since && (bt.day ? bt.d < since.d : bt.t < since.t - 15 * 6e4)) issues.push(`Bill chuyển lúc ${shown}, trước khi tạo ${exp.what || 'đơn'} này.`);
    else if (bt.t > now + (bt.day ? 864e5 : 15 * 6e4)) issues.push(`Ngày giờ trên bill (${shown}) chưa tới, anh chị kiểm tra lại.`);
  }
  const acc = digits(got.account), want = digits(exp.account);
  if (acc.length >= 4 && want && !(acc === want || want.endsWith(acc) || acc.endsWith(want))) issues.push('Số tài khoản nhận trên bill không phải tài khoản công ty.');
  if (exp.code && !norm(got.content).includes(norm(exp.code))) notes.push(`Nội dung chuyển khoản không có mã ${exp.code}${got.content ? ' (bill ghi: ' + String(got.content).slice(0, 80) + ')' : ''}.`);
  return { ok: !issues.length, issues, notes };
}

module.exports = { read, compare, SCHEMA };
