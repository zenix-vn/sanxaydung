#!/usr/bin/env bash
#
# Nhập dữ liệu đối tác từ Google Sheet / CSV vào DATABASE PRODUCTION (zenix-server).
#   ./deploy/import-prod.sh "https://docs.google.com/spreadsheets/d/<ID>/edit?gid=<GID>"   # sheet chia sẻ "bất kỳ ai có link"
#   ./deploy/import-prod.sh responses.csv
#   ./deploy/import-prod.sh <nguồn> --dry-run     # chỉ đọc/kiểm tra, KHÔNG ghi DB
#
# Idempotent: upsert theo SĐT; công ty đã có chủ (claim) không bị ghi đè. Tự sao lưu schema public trước khi ghi.
# Chạy script scripts/import-registrations.mjs trong container node:22 ngay trên server, nối thẳng Kong nội bộ
# → khóa service_role không bao giờ rời server.
set -euo pipefail
SRC="${1:?Dùng: $0 <csv|link Google Sheet> [--dry-run]}"; FLAG="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

if [[ "$SRC" == http* ]]; then
  ID=$(echo "$SRC" | sed -E 's#.*/d/([^/]+).*#\1#'); GID=$(echo "$SRC" | sed -nE 's#.*gid=([0-9]+).*#\1#p')
  echo "==> Tải CSV từ Google Sheet ${ID} (gid=${GID:-0})"
  curl -fsSL -m 60 "https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=${GID:-0}" -o "$TMP/responses.csv"
else
  cp "$SRC" "$TMP/responses.csv"
fi
echo "    $(($(wc -l < "$TMP/responses.csv") - 1)) dòng (ước lượng)"

SSH="ssh -o BatchMode=yes zenix-server"
$SSH 'rm -rf /tmp/sxd-import && mkdir -p /tmp/sxd-import'
scp -q "$ROOT/scripts/import-registrations.mjs" "$ROOT/scripts/package.json" "$TMP/responses.csv" zenix-server:/tmp/sxd-import/

if [[ "$FLAG" != "--dry-run" ]]; then
  echo "==> Sao lưu schema public"
  $SSH 'cd /opt/sxd-supabase && mkdir -p backups && docker exec sxd-db pg_dump -U postgres -n public -Fc postgres > backups/pre-import-$(date +%Y%m%d-%H%M%S).dump'
fi

echo "==> Chạy importer trên server ${FLAG}"
$SSH "cd /tmp/sxd-import && (umask 077; { echo 'SUPABASE_URL=http://sxd-kong:8000'; grep ^SERVICE_ROLE_KEY= /opt/sxd-supabase/.env | sed 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/'; } > env.list) && \
  docker run --rm --network sxd_default --env-file env.list -v /tmp/sxd-import:/w -w /w node:22-alpine \
    sh -c 'npm i --silent --no-audit --no-fund >/dev/null 2>&1; node import-registrations.mjs responses.csv ${FLAG}'; \
  rc=\$?; rm -rf /tmp/sxd-import; exit \$rc"
