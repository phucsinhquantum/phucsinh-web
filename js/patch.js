/* So sánh hai bản dữ liệu và áp phần thay đổi lên bản mới nhất trên máy chủ.
   Danh sách có mã (id hoặc code) được ghép theo từng phần tử, nên khi quản trị lưu
   không làm mất đơn hàng, giao dịch người khác vừa tạo. Dùng chung cho trình duyệt và máy chủ. */
(function (root) {
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const keyOf = (...lists) => {
    for (const k of ['id', 'code']) {
      if (lists.every(l => l.every(x => isObj(x) && x[k] != null) && new Set(l.map(x => String(x[k]))).size === l.length) && lists.some(l => l.length)) return k;
    }
    return null;
  };
  function diff(a, b) {
    if (same(a, b)) return undefined;
    if (isObj(a) && isObj(b)) {
      const o = {}; let n = 0;
      for (const k of Object.keys(b)) { const p = diff(a[k], b[k]); if (p !== undefined) { o[k] = p; n++; } }
      for (const k of Object.keys(a)) if (!(k in b)) { o[k] = { $del: 1 }; n++; }
      return n ? { $o: o } : undefined;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const k = keyOf(a, b);
      if (k) {
        const A = new Map(a.map(x => [String(x[k]), x])), B = new Set(b.map(x => String(x[k])));
        const del = [...A.keys()].filter(id => !B.has(id)), set = {}, add = [];
        const firstKept = b.findIndex(x => A.has(String(x[k])));
        b.forEach((x, i) => {
          const id = String(x[k]);
          if (A.has(id)) { const p = diff(A.get(id), x); if (p !== undefined) set[id] = p; }
          else add.push({ item: x, front: firstKept === -1 ? false : i < firstKept });
        });
        if (!del.length && !add.length && !Object.keys(set).length) {
          const order = b.map(x => String(x[k]));
          return order.join() === a.map(x => String(x[k])).join() ? undefined : { $a: k, del, set, add, order };
        }
        return { $a: k, del, set, add };
      }
    }
    return { $v: b };
  }
  function apply(cur, p) {
    if (p === undefined) return cur;
    if (p.$v !== undefined || ('$v' in p)) return p.$v;
    if (p.$o) {
      const out = isObj(cur) ? cur : {};
      for (const k of Object.keys(p.$o)) { const s = p.$o[k]; if (s && s.$del) delete out[k]; else out[k] = apply(out[k], s); }
      return out;
    }
    if (p.$a) {
      const k = p.$a; let arr = Array.isArray(cur) ? cur : [];
      const del = new Set((p.del || []).map(String));
      arr = arr.filter(x => !(isObj(x) && del.has(String(x[k]))));
      for (const id of Object.keys(p.set || {})) { const i = arr.findIndex(x => isObj(x) && String(x[k]) === id); if (i >= 0) arr[i] = apply(arr[i], p.set[id]); }
      const have = new Set(arr.filter(isObj).map(x => String(x[k])));
      const front = (p.add || []).filter(x => x.front && !have.has(String(x.item[k]))).map(x => x.item);
      const back = (p.add || []).filter(x => !x.front && !have.has(String(x.item[k]))).map(x => x.item);
      arr = front.concat(arr, back);
      if (p.order) { const pos = new Map(p.order.map((id, i) => [id, i])); arr.sort((x, y) => (pos.get(String(x[k])) ?? 1e9) - (pos.get(String(y[k])) ?? 1e9)); }
      return arr;
    }
    return cur;
  }
  const api = { diff, apply };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PSQPatch = api;
})(typeof window !== 'undefined' ? window : globalThis);
