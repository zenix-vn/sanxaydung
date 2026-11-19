#!/usr/bin/env bash
#
# Công cụ quản trị nhanh (chưa có giao diện admin) — chạy từ máy bạn, thao tác trên DB production.
#   ./deploy/admin.sh claims                    # yêu cầu nhận hồ sơ đang chờ duyệt
#   ./deploy/admin.sh approve-claim <uuid>      # duyệt: gán người yêu cầu làm owner
#   ./deploy/admin.sh reject-claim  <uuid>
#   ./deploy/admin.sh verifications             # yêu cầu xác minh (MST/GPKD/chứng chỉ) đang chờ
#   ./deploy/admin.sh verify <uuid>             # duyệt → trigger tự nâng verified_tier + tính lại Trust Score
#   ./deploy/admin.sh reject-verification <uuid>
#   ./deploy/admin.sh stats                     # số liệu tổng quan
set -euo pipefail
CMD="${1:-}"; ID="${2:-}"
uuid_ok() { [[ "$1" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || { echo "ID phải là UUID"; exit 1; }; }
psqlx() { ssh -o BatchMode=yes zenix-server 'docker exec -i sxd-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off'; }

case "$CMD" in
  claims) psqlx <<'SQL'
select cl.id, c.name as "công ty", u.email as "người yêu cầu", cl.method, left(coalesce(cl.note,''),50) as "ghi chú", cl.created_at::date as ngày
  from company_claims cl join companies c on c.id=cl.company_id join auth.users u on u.id=cl.user_id
 where cl.status='pending' order by cl.created_at;
SQL
  ;;
  approve-claim) uuid_ok "$ID"; psqlx <<SQL
select public.approve_company_claim('$ID'::uuid, true, null);
select 'đã duyệt claim $ID';
SQL
  ;;
  reject-claim) uuid_ok "$ID"; psqlx <<SQL
select public.approve_company_claim('$ID'::uuid, false, null);
select 'đã từ chối claim $ID';
SQL
  ;;
  verifications) psqlx <<'SQL'
select v.id, c.name as "công ty", v.kind, v.reference as "số/ghi chú", v.cert_class as hạng, v.created_at::date as ngày
  from company_verifications v join companies c on c.id=v.company_id
 where v.status='pending' order by v.created_at;
SQL
  ;;
  verify) uuid_ok "$ID"; psqlx <<SQL
update company_verifications set status='verified', verified_at=now() where id='$ID'::uuid and status='pending';
select 'đã duyệt xác minh $ID (tier hiện tại: ' || (select c.verified_tier from companies c join company_verifications v on v.company_id=c.id where v.id='$ID'::uuid) || ')';
SQL
  ;;
  reject-verification) uuid_ok "$ID"; psqlx <<SQL
update company_verifications set status='rejected', verified_at=now() where id='$ID'::uuid and status='pending';
select 'đã từ chối xác minh $ID';
SQL
  ;;
  stats) psqlx <<'SQL'
select 'công ty: ' || count(*) || ' (có chủ ' || count(*) filter (where owner_id is not null) || ', chưa có chủ ' || count(*) filter (where owner_id is null) || ')' from companies where deleted_at is null;
select 'người dùng: ' || count(*) from auth.users where deleted_at is null;
select 'claim chờ duyệt: ' || count(*) from company_claims where status='pending';
select 'xác minh chờ duyệt: ' || count(*) from company_verifications where status='pending';
select 'tin đăng mở: ' || count(*) from marketplace_listings where status='open';
SQL
  ;;
  *) sed -n '3,13p' "$0"; exit 1 ;;
esac
