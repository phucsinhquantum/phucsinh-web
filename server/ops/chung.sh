# Phần dùng chung cho các lệnh vận hành PSQ trên VPS (cap-nhat.sh, canh-gac.sh, sao-luu-ngoai.sh).
# Ghi đè giá trị mặc định trong /opt/psq-ops/ops.conf nếu VPS khác (ví dụ PROXY_NET=...).
[ -f "${OPS_DIR:-/opt/psq-ops}/ops.conf" ] && . "${OPS_DIR:-/opt/psq-ops}/ops.conf"
REPO=${REPO:-https://github.com/phucsinhquantum/phucsinh-web.git}
PROXY_NET=${PROXY_NET:-web}
OPS_DIR=${OPS_DIR:-/opt/psq-ops}

# cấu hình từng bản: thu = bản thử (nhánh may-chu), chinh = bản chính (nhánh main)
ban() {
  case "$1" in
    thu)   DIR=${THU_DIR:-/opt/web/phucsinhquantum-thu}; DATA=${THU_DATA:-/opt/psq-data-thu}; NAME=${THU_NAME:-psq-api-thu}; URL=${THU_URL:-https://thu.phucsinhquantum.com}; BRANCH=${THU_BRANCH:-may-chu}; PROJECT=psq-thu; LABEL='bản thử' ;;
    chinh) DIR=${CHINH_DIR:-/opt/web/phucsinhquantum}; DATA=${CHINH_DATA:-/opt/psq-data}; NAME=${CHINH_NAME:-psq-api}; URL=${CHINH_URL:-https://phucsinhquantum.com}; BRANCH=${CHINH_BRANCH:-main}; PROJECT=psq; LABEL='bản chính' ;;
    *) return 1 ;;
  esac
}

# báo Telegram cho chủ: dùng bot và mã chat trong .env của bản chính (ALERT_CHAT_ID nếu có, không thì mã đầu tiên của TELEGRAM_CHAT_ID)
envget() { grep -E "^$1=" "${2:-/opt/psq-data/.env}" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r"'"'"; }
bao() {
  local tok chat; tok=$(envget TELEGRAM_BOT_TOKEN); chat=$(envget ALERT_CHAT_ID); [ -n "$chat" ] || chat=$(envget TELEGRAM_CHAT_ID | cut -d, -f1 | tr -d ' ')
  echo "[báo] $1"
  [ -n "$tok" ] && [ -n "$chat" ] && curl -fsS -m 15 -o /dev/null "https://api.telegram.org/bot$tok/sendMessage" --data-urlencode "chat_id=$chat" --data-urlencode "text=$1" --data-urlencode "disable_web_page_preview=true" || true
}

# trang còn chạy không: /api/boot phải trả dữ liệu
song() { curl -fsS -m 10 "$1/api/boot" 2>/dev/null | grep -q '"content"'; }

# số container trên mạng của Caddy mang tên gọi $1 (phải đúng 1, nhiều hơn là bị chia nhầm như lỗi 25/10)
ten_goi() {
  local n=0 c
  for c in $(docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' "$PROXY_NET" 2>/dev/null); do
    docker inspect -f "{{json (index .NetworkSettings.Networks \"$PROXY_NET\")}}" "$c" 2>/dev/null | grep -q "\"$1\"" && n=$((n + 1))
  done
  echo $n
}

# sao lưu dữ liệu đang chạy ra một tệp .db hoàn chỉnh (dùng node trong container, không cần dừng máy chủ)
sao_luu() { # $1 tên container, $2 tên tệp trong /data/backups
  docker exec "$1" node --no-warnings -e "new (require('node:sqlite').DatabaseSync)('/data/psq.db').exec(\"VACUUM INTO '/data/backups/$2'\")"
}

# cấu hình riêng của VPS (đặt sau cùng để ghi đè được cả biến lẫn hàm ở trên)
[ -f "$OPS_DIR/ops.conf" ] && . "$OPS_DIR/ops.conf"
