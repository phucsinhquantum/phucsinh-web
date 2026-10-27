#!/bin/bash
# Làm mới dữ liệu bản thử từ bản chính, đã che tên, số điện thoại, email khách (server/tools/du-lieu-thu.js).
# Chạy tay khi cần, hoặc mỗi tuần (cron). Mật khẩu mọi thành viên ở bản thử: thu123456. Quản trị giữ mật khẩu như bản chính.
set -uo pipefail
. "$(dirname "$0")/chung.sh"
ban chinh; SRC_NAME=$NAME; SRC_DATA=$DATA
TS=$(date +%Y%m%d-%H%M%S); F="cho-ban-thu-$TS.db"
sao_luu "$SRC_NAME" "$F" || { echo "Không sao lưu được bản chính"; exit 1; }
ban thu
docker stop "$NAME" >/dev/null
docker run --rm -v "$DIR:/web:ro" -v "$SRC_DATA/backups/$F:/src.db:ro" -v "$DATA:/data" node:22-alpine \
  node --no-warnings /web/server/tools/du-lieu-thu.js /src.db /data
r=$?
rm -f "$SRC_DATA/backups/$F"
docker start "$NAME" >/dev/null
ls -1t "$DATA"/psq.db.cu-* 2>/dev/null | grep -v -- "-wal$\|-shm$" | tail -n +4 | while read -r f; do rm -f "$f" "$f-wal" "$f-shm"; done   # giữ 3 bản dữ liệu thử cũ
[ $r = 0 ] && bao "[THỬ] Đã làm mới dữ liệu bản thử từ bản chính (đã che thông tin khách). Mật khẩu thành viên thử: thu123456" || bao "[THỬ] Làm mới dữ liệu bản thử lỗi, bản thử vẫn giữ dữ liệu cũ."
exit $r
