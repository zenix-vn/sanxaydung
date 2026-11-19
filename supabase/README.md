# Supabase — SanXayDung.vn

Migration & seed cho cơ sở dữ liệu nền tảng. Thiết kế chi tiết: [../docs/thiet-ke-ky-thuat.md](../docs/thiet-ke-ky-thuat.md).

## Cấu trúc

```
supabase/
├── migrations/
│   ├── 20260716090000_init_extensions.sql   # extensions, FTS tiếng Việt, helper
│   ├── 20260716090100_core_tables.sql       # toàn bộ bảng + index
│   ├── 20260716090200_functions_triggers.sql# helper RLS, trigger, RPC, Trust Score
│   ├── 20260716090300_rls_policies.sql       # bật RLS + policy
│   ├── 20260716090400_storage.sql            # buckets + policy storage
│   └── 20260716090500_cron.sql               # pg_cron (defensive)
└── seed.sql                                  # plans, provinces, categories
```

Thứ tự file theo timestamp — **không đổi tên** để giữ đúng thứ tự apply.

## Chạy local

```bash
supabase init          # nếu chưa có config.toml
supabase start         # khởi động stack local (cần Docker)
supabase db reset      # apply toàn bộ migrations + seed.sql
```

## Áp lên môi trường staging/production

```bash
supabase link --project-ref <ref>
supabase db push       # đẩy migrations lên project đã link
```

## Ghi chú

- **Roles Supabase** (`authenticated`, `anon`, `service_role`) có sẵn trên nền tảng — policy storage phụ thuộc chúng.
- **pg_cron / pg_net**: bật trong Dashboard → Database → Extensions (migration cron đã bọc defensive, không fail nếu thiếu).
- **Xác minh, Trust Score, thông báo** chạy ở tầng server (Edge Functions với `service_role`) — client không được cấp quyền ghi các bảng này.
- Đã kiểm thử toàn bộ migration + seed trên Postgres 15 (trigger, Trust Score, FTS không dấu, RLS) — pass.

## Việc tiếp theo (chưa nằm trong migration)

- Edge Functions: `verify-company`, `recompute-trust`, `notify-dispatch`, `payment-webhook`, `generate-sitemap`.
- Seed đầy đủ danh mục tỉnh/thành theo đơn vị hành chính hiện hành.
- Script seed 500–1.000 doanh nghiệp cho chiến lược cold-start.

## Migration bổ sung (AI-1)

| File | Nội dung |
|------|----------|
| `20260728090000_missing_features.sql` | trigger completeness / verified_tier / like_count / last_message, Realtime, `export_my_data`, `delete_my_account` |
| `20261119090000_business_rpcs.sql` | RPC nghiệp vụ, claim công ty, thông báo tự động, sửa trigger đếm & quyền hàm nội bộ |
| `20261119090100_storage_hardening.sql` | giới hạn dung lượng/MIME, bucket `avatars`, policy đọc file chat |
| `20261119090200_webhooks_cron_sitemap.sql` | `dispatch_edge` (webhook → Edge Function), `sitemap_entries()`, cron dọn thông báo |
| `20261119090300_account_deletion.sql` | `delete_my_account` khóa đăng nhập |
| `20261119090400_quotes_listings_chat_notify.sql` | `set_quote_status`, cột listing, thông báo tin nhắn |
| `20261119090500_fix_chat_rls_recursion.sql` | sửa đệ quy vô hạn RLS của chat |

**Webhook → Edge Function** chỉ chạy khi đặt (mỗi môi trường, không commit giá trị thật):
```sql
alter database postgres set app.edge_function_url = 'https://<ref>.supabase.co/functions/v1';
alter database postgres set app.service_role_key  = '<service_role_key>';
```
Chưa đặt hoặc thiếu `pg_net` → no-op, không ảnh hưởng ghi dữ liệu.

**Edge Function** (`functions/`): `verify-company`, `recompute-trust`, `notify-dispatch`, `payment-webhook` (khung). Mọi function (trừ `payment-webhook` dùng HMAC) chỉ nhận `service_role` qua `_shared/auth.ts`. Env: `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `ZALO_OA_TOKEN`, `PAYMENT_WEBHOOK_SECRET`, `MST_LOOKUP_API_URL/KEY`.

## Test

```bash
supabase test db        # chạy supabase/tests/*.test.sql (pgTAP)
```
