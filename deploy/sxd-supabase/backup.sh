#!/usr/bin/env bash
# Sao lưu hằng ngày stack Supabase "sxd": toàn bộ DB (public + auth + storage metadata) và file Storage.
# Cài trên server bằng deploy/deploy-prod.sh backup (cron 03:30). Giữ 14 bản gần nhất.
set -euo pipefail
DIR=/opt/sxd-supabase/backups; KEEP=14; TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DIR"; cd "$DIR"
docker exec sxd-db pg_dump -U postgres -Fc postgres > "db-$TS.dump.tmp" && mv "db-$TS.dump.tmp" "db-$TS.dump"
tar -czf "storage-$TS.tgz.tmp" -C /opt/sxd-supabase/data storage && mv "storage-$TS.tgz.tmp" "storage-$TS.tgz"
ls -1t db-*.dump      2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t storage-*.tgz  2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
echo "$(date -Is) backup ok: db-$TS.dump ($(du -h "db-$TS.dump" | cut -f1)), storage-$TS.tgz ($(du -h "storage-$TS.tgz" | cut -f1))" >> "$DIR/backup.log"
