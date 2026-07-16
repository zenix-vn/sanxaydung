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
