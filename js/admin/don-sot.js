/* Quản trị > Đơn hàng: kiểm tra đơn sót (đơn chờ thanh toán đặt quá 10 phút chưa duyệt), bot gửi Telegram để duyệt.
   Duyệt ở đây dùng lại ô trạng thái của danh sách đơn (cùng kiểm tra, ghi sổ như duyệt tay). */
(function () {
  const { $, esc, icon, toast, modal, money } = PSQ;
  window.staleOrders = function () {
    let r = API.act('staleOrders', {}); if (r.error) return toast(r.error, 'err');
    const m = modal(`<div class="row"><h3>Đơn sót chờ duyệt</h3><button class="icon-btn" type="button" data-close style="margin-left:auto" aria-label="Đóng">${icon('close')}</button></div>
      <p class="dim mt-1" style="font-size:13px">Đơn chờ thanh toán đặt quá 10 phút mà chưa duyệt. Đơn đã gửi bill xếp trên. Anh chị đối chiếu tài khoản ngân hàng rồi bấm Duyệt.</p>
      <div class="row wrap mt-2" style="gap:10px"><button class="btn btn-gold" type="button" id="dsSend">${icon('bell')} Bot gửi lên Telegram để duyệt</button>
        <label class="check" style="margin-left:auto"><input type="checkbox" id="dsAuto"> Tự quét và nhắc lúc 9h, 14h, 20h</label></div>
      <div id="dsL" class="mt-2" style="max-height:55vh;overflow:auto"></div>`);
    const draw = () => {
      const L = r.list || []; $('#dsAuto', m.el).checked = r.auto;
      $('#dsL', m.el).innerHTML = L.length ? L.map(x => `<div class="row" style="gap:10px 14px;padding:12px 4px;border-bottom:1px solid var(--line);flex-wrap:wrap;align-items:center">
        <div style="flex:1 1 200px;min-width:0"><b class="cyan">${esc(x.id)}</b> · <b>${money(x.due)}</b><br>${esc(x.name)} <small class="dim">${esc(x.phone)}</small><br><small class="dim">Đặt lúc ${esc(x.since)}${x.sentAt ? ' · đã gửi bot ' + new Date(x.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}</small></div>
        <div style="flex:0 0 auto;font-size:13px">${x.bills.length ? x.bills.map((f, i) => `<a href="/api/bill?f=${encodeURIComponent(f)}" target="_blank" rel="noopener" class="gold">${icon('eye')} Xem bill${x.bills.length > 1 ? ' ' + (i + 1) : ''}</a>`).join('<br>') : '<span class="dim">Chưa gửi bill</span>'}</div>
        <button class="btn btn-sm btn-gold" type="button" data-ok="${esc(x.id)}" style="flex:0 0 auto">Duyệt</button></div>`).join('')
        : `<div class="empty">${icon('check')}Không có đơn sót. Mọi đơn đã được duyệt.</div>`;
    };
    $('#dsSend', m.el).addEventListener('click', () => {
      const x = API.act('staleOrders', { send: true }); if (x.error) return toast(x.error, 'err'); r = x; draw();
      toast(x.sent.sent ? `Bot đã gửi ${x.sent.sent} đơn lên Telegram` + (x.sent.recent ? `, ${x.sent.recent} đơn vừa gửi trong 1 giờ qua nên không gửi lại` : '') : 'Các đơn này vừa gửi trong 1 giờ qua, bot không gửi lại.');
    });
    $('#dsAuto', m.el).addEventListener('change', e => { const x = API.act('staleOrders', { auto: e.target.checked }); if (x.error) return toast(x.error, 'err'); r = x; toast(x.auto ? 'Đã bật tự quét đơn sót' : 'Đã tắt tự quét đơn sót'); });
    $('#dsL', m.el).addEventListener('click', e => {
      const b = e.target.closest('[data-ok]'); if (!b) return;
      const x = r.list.find(y => y.id === b.dataset.ok);
      if (!confirm(`Duyệt đơn ${x.id} của ${x.name}: đã nhận ${money(x.due)}?\nChỉ duyệt khi tiền đã vào tài khoản.`)) return;
      API.load(); m.close();
      const q = $('#oq'), st = $('#os'); q.value = x.id; if (st) st.value = ''; q.dispatchEvent(new Event('input'));
      const s = document.querySelector(`[data-status="${CSS.escape(x.id)}"]`);
      if (!s) return toast('Không thấy đơn trong danh sách, anh chị đổi trạng thái tay giúp em.', 'err');
      s.value = 'paid'; s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    draw();
  };
})();
