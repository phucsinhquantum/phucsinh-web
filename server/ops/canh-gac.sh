#!/bin/bash
# Canh gác, chạy mỗi 5 phút (cron). Kiểm tra bản chính và bản thử: trang còn trả dữ liệu, mỗi tên gọi
# trên mạng của Caddy chỉ đúng 1 container (lỗi 25/10), ổ đĩa còn chỗ. Có sự cố thì báo Telegram;
# sự cố còn kéo dài thì nhắc lại mỗi giờ; hết sự cố thì báo đã ổn.
set -u
. "$(dirname "$0")/chung.sh"
STATE=${STATE:-$OPS_DIR/canh-gac.trang-thai}; touch "$STATE"
loi=()
for m in chinh thu; do
  ban "$m"
  docker inspect "$NAME" >/dev/null 2>&1 || { [ "$m" = thu ] && continue; }   # chưa dựng bản thử thì bỏ qua
  song "$URL" || loi+=("$LABEL ($URL) không trả dữ liệu")
  n=$(ten_goi "$NAME"); [ "$n" = 1 ] || loi+=("tên gọi $NAME có $n container trên mạng $PROXY_NET (phải là 1), khách có thể bị chuyển nhầm")
done
dung=$(df -P /opt 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')
[ -n "$dung" ] && [ "$dung" -ge 90 ] && loi+=("ổ đĩa VPS đã dùng $dung%")

now=$(date +%s); cu=$(head -1 "$STATE"); lan=$(sed -n 2p "$STATE"); lan=${lan:-0}
if [ ${#loi[@]} -gt 0 ]; then
  msg=$(printf '• %s\n' "${loi[@]}"); key=$(printf '%s|' "${loi[@]}")
  if [ "$cu" != "$key" ] || [ $((now - lan)) -ge 3600 ]; then   # sự cố mới, hoặc đã 1 giờ chưa hết thì nhắc lại
    bao "🔴 Canh gác PSQ phát hiện sự cố:
$msg"
    printf '%s\n%s\n' "$key" "$now" > "$STATE"
  fi
elif [ -n "$cu" ]; then
  bao "✅ Canh gác PSQ: hệ thống đã chạy bình thường trở lại."
  : > "$STATE"
fi
