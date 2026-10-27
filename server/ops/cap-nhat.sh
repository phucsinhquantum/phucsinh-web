#!/bin/bash
# Cập nhật bản thử hoặc bản chính từ GitHub, an toàn:
#   1. giữ lại mọi sửa trực tiếp trên VPS (nếu có) vào tệp bundle, 2. sao lưu dữ liệu,
#   3. tự kiểm tra code mới trên bản sao dữ liệu (server/tools/kiem-tra.js), sai là dừng, không đụng gì,
#   4. đổi code, khởi động lại, kiểm tra trang và tên gọi trên mạng, hỏng thì tự quay về code cũ, 5. báo Telegram.
# Cách dùng: bash /opt/psq-ops/cap-nhat.sh thu|chinh        (FORCE=1 để bỏ qua sửa trực tiếp trên VPS, đã giữ trong bundle)
set -uo pipefail
. "$(dirname "$0")/chung.sh"
MODE=${1:-}
ban "$MODE" || { echo "Cách dùng: cap-nhat.sh thu|chinh"; exit 2; }
exec 9>/tmp/psq-cap-nhat.lock; flock -n 9 || { echo "Đang có một lần cập nhật khác chạy."; exit 1; }
TS=$(date +%Y%m%d-%H%M%S); TAG=$([ "$MODE" = thu ] && echo '[THỬ] ' || echo '')
cd "$DIR" || exit 1
mkdir -p "$DATA/backups"

OLD=$(git rev-parse HEAD)
echo "== Lấy code $BRANCH từ GitHub"
git fetch -q "$REPO" "$BRANCH" || { bao "${TAG}Cập nhật $LABEL dừng: không lấy được code từ GitHub."; exit 1; }
NEW=$(git rev-parse FETCH_HEAD)
if [ "$OLD" = "$NEW" ] && [ -z "$(git status --porcelain --untracked-files=no)" ]; then echo "Code đã mới nhất ($NEW), không có gì cập nhật."; exit 0; fi

# sửa trực tiếp trên VPS (chưa có trên GitHub): giữ lại trước khi thay
LOCAL=$(git rev-list --count "$NEW..HEAD" 2>/dev/null || echo 0)
if [ -n "$(git status --porcelain --untracked-files=no)" ] || [ "$LOCAL" != 0 ]; then
  git bundle create "$DATA/backups/code-vps-$TS.bundle" HEAD >/dev/null 2>&1   # các commit chỉ có trên VPS
  { git diff "$(git merge-base "$NEW" HEAD)" HEAD; git diff HEAD; } > "$DATA/backups/code-vps-$TS.patch"   # cộng phần sửa chưa commit
  echo "Có $LOCAL bản sửa trực tiếp trên VPS chưa có trên GitHub. Đã giữ ở $DATA/backups/code-vps-$TS.bundle và .patch"
  [ "${FORCE:-0}" = 1 ] || { bao "${TAG}Cập nhật $LABEL dừng: có sửa trực tiếp trên VPS chưa đưa lên GitHub (đã giữ ở $DATA/backups/code-vps-$TS.patch). Đưa lên GitHub trước, hoặc chạy lại với FORCE=1."; exit 1; }
fi

echo "== Sao lưu dữ liệu"
SEED="truoc-cap-nhat-$TS.db"
sao_luu "$NAME" "$SEED" || { bao "${TAG}Cập nhật $LABEL dừng: không sao lưu được dữ liệu."; exit 1; }
echo "Đã sao lưu $DATA/backups/$SEED"
ls -1t "$DATA"/backups/truoc-cap-nhat-*.db 2>/dev/null | tail -n +21 | xargs -r rm -f   # giữ 20 bản gần nhất

echo "== Tự kiểm tra code mới trên bản sao dữ liệu"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git archive "$NEW" | tar -x -C "$TMP"
if ! docker run --rm -v "$TMP:/web:ro" -v "$DATA/backups/$SEED:/seed.db:ro" node:22-alpine node --no-warnings /web/server/tools/kiem-tra.js /seed.db | tee "$TMP/kq.txt"; then
  bao "${TAG}Cập nhật $LABEL DỪNG, code mới chưa đưa lên vì tự kiểm tra có bước sai:
$(grep 'SAI' "$TMP/kq.txt" | head -8)"
  exit 1
fi

echo "== Đổi code và khởi động lại"
git checkout -q -f -B "$BRANCH" "$NEW"
chay() {
  local svc proj
  svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$NAME" 2>/dev/null)
  proj=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$NAME" 2>/dev/null)
  # container tạo theo cấu hình cũ (dịch vụ tên psq-api) phải xóa để tạo lại, không thì vẫn mang tên gọi trùng
  if docker inspect "$NAME" >/dev/null 2>&1 && { [ "$svc" != app ] || [ "$proj" != "$PROJECT" ]; }; then docker rm -f "$NAME" >/dev/null; fi
  NAME=$NAME WEB_DIR=$DIR DATA_DIR_HOST=$DATA PROXY_NET=$PROXY_NET docker compose -p "$PROJECT" -f "$DIR/server/docker-compose.yml" up -d --remove-orphans >/dev/null 2>&1 \
    && docker restart "$NAME" >/dev/null
}
kiem() { local i; for i in $(seq 1 20); do song "$URL" && [ "$(ten_goi "$NAME")" = 1 ] && return 0; sleep 3; done; return 1; }

if chay && kiem; then
  bao "${TAG}✅ Đã cập nhật $LABEL ($URL): ${OLD:0:7} → ${NEW:0:7}
$(git log --format='• %s' "$OLD..$NEW" 2>/dev/null | head -8)"
  exit 0
fi

echo "== Lỗi sau khi cập nhật, quay về code cũ $OLD"
git checkout -q -f -B "$BRANCH" "$OLD"
if chay && kiem; then
  bao "${TAG}⚠️ Cập nhật $LABEL lỗi nên đã tự quay về bản cũ ${OLD:0:7}. Trang vẫn chạy bình thường. Dữ liệu trước cập nhật: $DATA/backups/$SEED"
else
  bao "${TAG}🔴 $LABEL ($URL) KHÔNG CHẠY sau khi cập nhật và quay lại. Cần xử lý ngay. Dữ liệu trước cập nhật: $DATA/backups/$SEED"
fi
exit 1
