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
│   ├── marketplace/             # Tin đăng nhu cầu (lọc tỉnh/lĩnh vực/ngân sách, BOQ, gợi ý đối tác)
│   ├── feed/ · feed/[id]/       # News Feed + trang bài viết & bình luận
│   ├── chat/                    # Nhắn tin realtime (đính kèm tệp, tìm trong hội thoại)
│   ├── ban-do/                  # Bản đồ doanh nghiệp theo tỉnh (Leaflet + OSM)
│   ├── linh-vuc/[cat]/[tỉnh]/   # Trang SEO lĩnh vực × tỉnh (có trong sitemap)
│   ├── so-sanh/                 # So sánh 2–3 doanh nghiệp
│   ├── moi/[token]/             # Nhận lời mời tham gia doanh nghiệp
│   ├── dashboard/               # Khu vực doanh nghiệp (layout + sidebar + chọn công ty)
│   │   ├── listings/            #   tin đăng & báo giá (sửa/đóng/gia hạn/rút)
│   │   ├── connections/         #   kết nối hợp tác → đánh giá
│   │   ├── members/             #   thành viên & lời mời
│   │   ├── stats/ · trust/      #   thống kê hồ sơ · lịch sử Trust Score
│   │   ├── billing/             #   gói hiện tại & lịch sử thanh toán
│   │   ├── saved/               #   đã lưu & so sánh
│   │   └── notifications/       #   thông báo & kênh nhận
│   ├── admin/                   # Quản trị sàn
│   ├── login/                   # Đăng nhập (magic link / Google)
│   └── api/v1/                  # REST API (web + mobile)
├── components/                  # Pagination, Skeleton, LineChart, SaveButton, Boq, Track…
├── lib/
│   ├── supabase/{server,client,api,public,company}.ts
│   ├── format.ts                # nhãn trạng thái, định dạng tiền/ngày dùng chung
│   ├── types.ts                 # kiểu dữ liệu dùng chung
│   └── http.ts                  # helper JSON + CORS
├── e2e/                         # Playwright smoke test
└── middleware.ts                # CORS + bảo vệ /dashboard, /admin
```

## Kiểm tra

```bash
npm run lint && npm run typecheck && npm run build
npx playwright install chromium   # lần đầu
npm run test:e2e                  # smoke test; chạy được cả khi không có Supabase
E2E_BASE_URL=https://demo.sanxaydung.vn npm run test:e2e   # chạy với môi trường thật
```

CI (`.github/workflows/web-ci.yml`) chạy lint → typecheck → build → smoke test cho mọi PR đụng tới `web/`.

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
