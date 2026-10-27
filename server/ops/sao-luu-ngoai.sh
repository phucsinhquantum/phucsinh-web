#!/bin/bash
# Sao lưu ra ngoài VPS, chạy mỗi ngày (cron). Lấy bản dữ liệu mới nhất của bản chính, nén lại,
# gửi vào Telegram riêng của chủ (ALERT_CHAT_ID hoặc mã đầu tiên của TELEGRAM_CHAT_ID) bằng bot Trợ Lý.
# VPS hỏng vẫn tải lại được từ Telegram. Tệp có thông tin khách, chỉ gửi vào chat riêng của chủ.
set -uo pipefail
. "$(dirname "$0")/chung.sh"
ban chinh
TS=$(date +%Y%m%d-%H%M); F="ngoai-$TS.db"
sao_luu "$NAME" "$F" || { bao "🔴 Sao lưu ra ngoài VPS lỗi: không tạo được bản sao dữ liệu."; exit 1; }
gzip -9 -f "$DATA/backups/$F"
tok=$(envget TELEGRAM_BOT_TOKEN); chat=$(envget ALERT_CHAT_ID); [ -n "$chat" ] || chat=$(envget TELEGRAM_CHAT_ID | cut -d, -f1 | tr -d ' ')
size=$(du -k "$DATA/backups/$F.gz" | cut -f1)
if [ -z "$tok" ] || [ -z "$chat" ]; then echo "Chưa cài Telegram, bản sao để ở $DATA/backups/$F.gz"; exit 1; fi
if [ "$size" -gt 49000 ]; then bao "⚠️ Bản sao lưu ${size}KB vượt giới hạn 50MB của Telegram, cần chuyển sang Google Drive. Bản sao vẫn ở VPS: $DATA/backups/$F.gz"; exit 1; fi
if curl -fsS -m 120 -o /dev/null "https://api.telegram.org/bot$tok/sendDocument" -F "chat_id=$chat" \
  -F "caption=Sao lưu dữ liệu phucsinhquantum.com $(date '+%d/%m/%Y %H:%M'). Giữ kín, có thông tin khách." -F "document=@$DATA/backups/$F.gz"; then
  echo "Đã gửi $F.gz (${size}KB) vào Telegram"
else
  bao "🔴 Sao lưu ra ngoài VPS lỗi: không gửi được tệp lên Telegram. Bản sao vẫn ở VPS: $DATA/backups/$F.gz"; exit 1
fi
ls -1t "$DATA"/backups/ngoai-*.db.gz 2>/dev/null | tail -n +8 | xargs -r rm -f   # trên VPS giữ 7 bản
