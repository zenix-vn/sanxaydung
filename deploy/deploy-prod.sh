#!/usr/bin/env bash
#
# Deploy SanXayDung lên zenix-server (sanxaydung.vn)
#   ./deploy/deploy-prod.sh web        build lại image web trên server + chạy lại container
#   ./deploy/deploy-prod.sh db         áp migration CHƯA áp (theo bảng public._sxd_migrations)
#   ./deploy/deploy-prod.sh backup     cài sao lưu hằng ngày (cron 03:30, giữ 14 bản) rồi chạy thử 1 lần
#   ./deploy/deploy-prod.sh all        db rồi web
#
# Kiến trúc trên server (/opt):
#   sxd-supabase/  Supabase RIÊNG (project "sxd": db, auth, rest, realtime, storage, kong → 127.0.0.1:8110)
#   sxd-web/src    mã nguồn web; image `sxd-web` chạy container `sxd-web` → 127.0.0.1:3020
#   OpenLiteSpeed vhost: /usr/local/lsws/conf/vhosts/sanxaydung.vn (mẫu: deploy/ols/)
# KHÔNG dùng chung stack /opt/supabase (thuộc app khác).
set -euo pipefail
SSH="ssh -o BatchMode=yes zenix-server"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="sanxaydung.vn"

db() {
  echo "==> Đồng bộ migration"
  $SSH 'mkdir -p /opt/sxd-supabase/sql'
  rsync -az --delete -e "ssh -o BatchMode=yes" "$ROOT/supabase/migrations" "$ROOT/supabase/seed.sql" zenix-server:/opt/sxd-supabase/sql/
  $SSH 'cd /opt/sxd-supabase/sql
    PSQL="docker exec -i sxd-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
    $PSQL -c "create table if not exists public._sxd_migrations(name text primary key, applied_at timestamptz default now())"
    for f in migrations/*.sql; do
      n=$(basename $f)
      if [ "$($PSQL -At -c "select count(*) from public._sxd_migrations where name = '"'"'$n'"'"'")" = 0 ]; then
        echo "  áp $n"; $PSQL -1 < $f && $PSQL -c "insert into public._sxd_migrations(name) values ('"'"'$n'"'"')"
      fi
    done
    $PSQL -c "notify pgrst, '"'"'reload schema'"'"'"'
}

web() {
  echo "==> Đồng bộ mã nguồn web + build image"
  rsync -az --delete -e "ssh -o BatchMode=yes" --exclude node_modules --exclude .next --exclude ".env*" --exclude "*.tsbuildinfo" "$ROOT/web/" zenix-server:/opt/sxd-web/src/
  $SSH "cd /opt/sxd-web/src && K=\$(grep ^ANON_KEY= /opt/sxd-supabase/.env | cut -d= -f2) && \
    docker build -q -t sxd-web:new --build-arg NEXT_PUBLIC_SUPABASE_URL=https://$DOMAIN --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=\"\$K\" . && \
    docker tag sxd-web:new sxd-web:latest && \
    (docker rm -f sxd-web >/dev/null 2>&1 || true) && \
    docker run -d --name sxd-web --restart unless-stopped --network sxd_default -p 127.0.0.1:3020:3000 -e SUPABASE_INTERNAL_URL=http://sxd-kong:8000 --add-host $DOMAIN:host-gateway --memory 768m sxd-web:latest"
}

backup() {
  echo "==> Cài sao lưu hằng ngày"
  scp -q "$ROOT/deploy/sxd-supabase/backup.sh" zenix-server:/opt/sxd-supabase/backup.sh
  $SSH 'chmod 750 /opt/sxd-supabase/backup.sh
    echo "30 3 * * * root /opt/sxd-supabase/backup.sh >>/opt/sxd-supabase/backups/cron.log 2>&1" > /etc/cron.d/sxd-backup
    chmod 644 /etc/cron.d/sxd-backup
    /opt/sxd-supabase/backup.sh && tail -1 /opt/sxd-supabase/backups/backup.log && ls -la /etc/cron.d/sxd-backup'
}

case "${1:-}" in
  backup) backup ;;
  db) db ;;
  web) web ;;
  all) db; web ;;
  *) echo "Dùng: $0 {db|web|all}"; exit 1 ;;
esac
