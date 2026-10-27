/* Lưu trữ: một tệp SQLite (DATA_DIR/psq.db).
   - kv: dữ liệu chính (db), nội dung trang (psq_*_v1), cấu hình bí mật (secret:*)
   - sessions: phiên đăng nhập; tokens: đường dẫn đặt lại mật khẩu, xác nhận đơn
   Sao lưu mỗi ngày vào DATA_DIR/backups, giữ 30 bản. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function openStore(dir) {
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  const file = path.join(dir, 'psq.db');
  const sql = new DatabaseSync(file);
  sql.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user TEXT NOT NULL, exp INTEGER NOT NULL, ua TEXT, ip TEXT, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, kind TEXT NOT NULL, ref TEXT NOT NULL, exp INTEGER NOT NULL, used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT, kind TEXT, detail TEXT);`);
  const get = sql.prepare('SELECT v FROM kv WHERE k = ?');
  const put = sql.prepare('INSERT INTO kv (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at');
  const del = sql.prepare('DELETE FROM kv WHERE k = ?');
  const keys = sql.prepare("SELECT k FROM kv WHERE k LIKE 'psq\\_%' ESCAPE '\\'");
  const now = () => Date.now();
  const rnd = () => crypto.randomBytes(32).toString('base64url');
  const hashTok = t => crypto.createHash('sha256').update(t).digest('hex');

  const S = {
    file,
    getJSON(k) { const r = get.get(k); return r ? JSON.parse(r.v) : null; },
    setJSON(k, v) { if (v == null) del.run(k); else put.run(k, JSON.stringify(v), now()); },
    contentKeys() { return keys.all().map(r => r.k); },
    history(who, kind, detail) { sql.prepare('INSERT INTO history (at, who, kind, detail) VALUES (?, ?, ?, ?)').run(now(), who || '', kind, String(detail || '').slice(0, 2000)); },
    // phiên đăng nhập: lưu dạng băm, cookie giữ bản gốc
    newSession(user, ua, ip, days = 30) {
      const t = rnd(); sql.prepare('INSERT INTO sessions (token, user, exp, ua, ip, at) VALUES (?, ?, ?, ?, ?, ?)').run(hashTok(t), user, now() + days * 864e5, String(ua || '').slice(0, 200), ip || '', now()); return t;
    },
    session(t) { if (!t) return null; const r = sql.prepare('SELECT user, exp FROM sessions WHERE token = ?').get(hashTok(t)); return r && r.exp > now() ? r.user : null; },
    // phiên kèm ghi chú (ua): phiên quản trị xem tài khoản thành viên ghi 'imp:<mã quản trị>'
    sessionInfo(t) { if (!t) return null; const r = sql.prepare('SELECT user, exp, ua FROM sessions WHERE token = ?').get(hashTok(t)); return r && r.exp > now() ? { user: r.user, ua: r.ua || '' } : null; },
    endSession(t) { if (t) sql.prepare('DELETE FROM sessions WHERE token = ?').run(hashTok(t)); },
    endSessionsOf(user, except) { sql.prepare('DELETE FROM sessions WHERE user = ? AND token != ?').run(user, except ? hashTok(except) : ''); },
    // mã một lần: đặt lại mật khẩu (reset), xác nhận đơn hoặc nạp tiền từ tin nhắn (confirm)
    newToken(kind, ref, hours) { const t = rnd(); sql.prepare('INSERT INTO tokens (token, kind, ref, exp) VALUES (?, ?, ?, ?)').run(hashTok(t), kind, ref, now() + hours * 36e5); return t; },
    token(kind, t) { if (!t) return null; const r = sql.prepare('SELECT ref, exp, used FROM tokens WHERE token = ? AND kind = ?').get(hashTok(String(t)), kind); return r && !r.used && r.exp > now() ? r.ref : null; },
    useToken(t) { sql.prepare('UPDATE tokens SET used = 1 WHERE token = ?').run(hashTok(String(t))); },
    cleanup() { sql.prepare('DELETE FROM sessions WHERE exp < ?').run(now()); sql.prepare('DELETE FROM tokens WHERE exp < ?').run(now() - 7 * 864e5); },
    backup() {
      const day = new Date().toISOString().slice(0, 10), out = path.join(dir, 'backups', `psq-${day}.db`);
      if (fs.existsSync(out)) return null;
      sql.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
      const old = fs.readdirSync(path.join(dir, 'backups')).filter(f => /^psq-\d{4}-\d\d-\d\d\.db$/.test(f)).sort();
      old.slice(0, Math.max(0, old.length - 30)).forEach(f => fs.unlinkSync(path.join(dir, 'backups', f)));
      return out;
    }
  };
  return S;
}

module.exports = { openStore };
