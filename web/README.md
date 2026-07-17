# SanXayDung.vn — Web (Next.js) + API

Frontend Next.js (App Router) trên Supabase. Có sẵn **REST API `/api/v1`** dùng chung cho **web và app mobile**.

## Chạy local

```bash
cd web
cp .env.example .env.local      # điền NEXT_PUBLIC_SUPABASE_URL & ANON_KEY
npm install
npm run dev                     # http://localhost:3000
```

## Cấu trúc

```
web/
├── app/
│   ├── page.tsx                 # Trang chủ (SSR)
│   ├── directory/               # Tìm kiếm doanh nghiệp (FTS tiếng Việt)
│   ├── cong-ty/[slug]/          # Hồ sơ doanh nghiệp (SSR, tối ưu SEO)
│   ├── marketplace/             # Tin đăng nhu cầu
│   ├── login/                   # Đăng nhập (magic link)
│   └── api/v1/                  # REST API (web + mobile)
├── lib/
│   ├── supabase/{server,client,api}.ts
│   ├── types.ts                 # kiểu dữ liệu dùng chung
│   └── http.ts                  # helper JSON + CORS
└── middleware.ts                # CORS + preflight cho /api
```

## API cho app mobile

Base URL: `https://<domain>/api/v1`

**Xác thực (dual-mode):**
- **Web**: qua cookie phiên Supabase (SSR).
- **Mobile / client ngoài**: gửi header `Authorization: Bearer <access_token>` (lấy từ `supabase.auth` trên mobile bằng `@supabase/supabase-js`). Server áp **RLS** theo đúng user của token. Không có token → chỉ đọc dữ liệu công khai.

CORS đã bật sẵn cho mọi `/api/*` (kèm preflight `OPTIONS`).

### Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/v1/health` | trạng thái dịch vụ |
| GET | `/api/v1/categories?group=` | danh mục lĩnh vực |
| GET | `/api/v1/provinces` | danh sách tỉnh/thành |
| GET | `/api/v1/companies?q=&category=&province=&verified=&limit=&offset=` | tìm kiếm doanh nghiệp (FTS không dấu) |
| GET | `/api/v1/companies/{slug}` | hồ sơ đầy đủ (danh mục, khu vực, dự án, trust score) |
| GET | `/api/v1/listings?type=&province=&limit=&offset=` | tin đăng đang mở |
| POST | `/api/v1/listings` | tạo tin (cần Bearer; RLS: editor+ của công ty) |

**Định dạng phản hồi thống nhất:**
```json
{ "data": <kết quả> | null, "error": <string> | null, "meta": { "limit": 20, "offset": 0, "count": 8 } }
```

### Ví dụ (mobile)
```ts
const res = await fetch(`${API}/api/v1/companies?q=hoa binh&verified=true`, {
  headers: { Authorization: `Bearer ${accessToken}` }, // tùy chọn
});
const { data, error } = await res.json();
```

> App mobile có thể dùng **trực tiếp** `@supabase/supabase-js` (Auth/Realtime) như web, và gọi các endpoint `/api/v1` cho những nghiệp vụ đã đóng gói. Kiểu dữ liệu chia sẻ tại [`lib/types.ts`](lib/types.ts).

## Triển khai

- Đặt biến môi trường `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Deploy Vercel (khuyến nghị) hoặc `npm run build && npm start` sau reverse proxy.
