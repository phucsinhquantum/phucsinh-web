#!/bin/bash
# Cài lệnh vận hành PSQ lên VPS (chạy 1 lần, chạy lại để cập nhật): chép vào /opt/psq-ops và đặt lịch cron.
#   mỗi 5 phút: canh-gac.sh   ·   02:30 hằng ngày: sao-luu-ngoai.sh   ·   03:30 thứ Hai: du-lieu-thu.sh
# Cách dùng: bash /opt/web/phucsinhquantum/server/ops/cai-dat.sh
set -eu
SRC=$(cd "$(dirname "$0")" && pwd); OPS=/opt/psq-ops
mkdir -p "$OPS"
cp "$SRC"/chung.sh "$SRC"/cap-nhat.sh "$SRC"/canh-gac.sh "$SRC"/sao-luu-ngoai.sh "$SRC"/du-lieu-thu.sh "$OPS"/
chmod +x "$OPS"/*.sh
CU=$(crontab -l 2>/dev/null | grep -v '# psq-ops' || true)   # giữ nguyên lịch khác đang có trên VPS
printf '%s\n' "$CU" \
  "*/5 * * * * bash $OPS/canh-gac.sh >> $OPS/canh-gac.log 2>&1 # psq-ops" \
  "30 2 * * * bash $OPS/sao-luu-ngoai.sh >> $OPS/sao-luu-ngoai.log 2>&1 # psq-ops" \
  "30 3 * * 1 bash $OPS/du-lieu-thu.sh >> $OPS/du-lieu-thu.log 2>&1 # psq-ops" | sed '/^$/d' | crontab -
echo "Đã cài vào $OPS. Lịch:"; crontab -l | grep psq-ops
