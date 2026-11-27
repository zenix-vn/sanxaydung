import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { CORS_HEADERS } from '@/lib/http';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { serverFetch } from '@/lib/supabase/internal-fetch';
import { subdomainFromHost, isValidSubdomain, SITE_ROOT_DOMAIN } from '@/lib/site';

// Slug → tên miền con tự chọn (để chuyển hướng địa chỉ cũ). Cache trong bộ nhớ 60 giây mỗi tiến trình.
const renamed = new Map<string, { to: string | null; exp: number }>();
async function renamedSubdomain(slug: string): Promise<string | null> {
  const hit = renamed.get(slug);
  if (hit && hit.exp > Date.now()) return hit.to;
  let to: string | null = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?select=site_subdomain&slug=eq.${encodeURIComponent(slug)}&status=eq.published&deleted_at=is.null&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store', signal: AbortSignal.timeout(1500) },
    );
    if (r.ok) {
      const v = ((await r.json()) as { site_subdomain?: string | null }[])[0]?.site_subdomain;
      to = v && v !== slug && isValidSubdomain(v) ? v : null;
    }
  } catch {
    return null; // lỗi mạng: không chuyển hướng, cũng không cache
  }
  if (renamed.size > 5000) renamed.clear();
  renamed.set(slug, { to, exp: Date.now() + 60_000 });
  return to;
}

// Route cần đăng nhập
const PROTECTED = ['/dashboard', '/admin'];

export async function middleware(req: NextRequest) {
  // CORS preflight cho API
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Chặn Image Optimization API (không dùng; xem next.config.mjs)
  if (req.nextUrl.pathname.startsWith('/_next/image')) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Website doanh nghiệp: <x>.sanxaydung.vn/<đường-dẫn> → /site/<x>/<đường-dẫn> (URL trên trình duyệt giữ nguyên).
  // /api và /tai-lieu dùng chung với sàn; mọi đường dẫn khác (kể cả /dashboard) chỉ trỏ vào website,
  // nên tên miền con không bao giờ có trang đăng nhập hay cookie phiên của sàn.
  const sub = subdomainFromHost(req.headers.get('host'));
  if (sub) {
    const { pathname } = req.nextUrl;
    if (!pathname.startsWith('/api/') && !pathname.startsWith('/tai-lieu/') && !/^\/[^/]+\.[a-z0-9]+$/i.test(pathname)) {
      // Doanh nghiệp đã đổi sang tên miền con khác → 301 về địa chỉ mới, giữ nguyên trang đang mở
      const to = SUPABASE_URL && SUPABASE_ANON_KEY ? await renamedSubdomain(sub) : null;
      if (to) return NextResponse.redirect(`https://${to}.${SITE_ROOT_DOMAIN}${pathname}${req.nextUrl.search}`, 301);
      const url = req.nextUrl.clone();
      url.pathname = `/site/${sub}${pathname === '/' ? '' : pathname}`;
      const headers = new Headers(req.headers);
      headers.set('x-site-host', sub);
      return NextResponse.rewrite(url, { request: { headers } });
    }
  }

  const res = NextResponse.next();

  // Thêm CORS header cho mọi /api/*
  if (req.nextUrl.pathname.startsWith('/api/')) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  }

  // Kiểm tra auth cho route được bảo vệ
  const isProtected = PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isProtected && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supa = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: serverFetch },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    // Chỉ để chuyển hướng khi chưa đăng nhập → đọc phiên từ cookie (tự làm mới token khi hết hạn),
    // không gọi GoTrue mỗi request. Layout/trang vẫn xác thực thật bằng getUser().
    const { data: { session } } = await supa.auth.getSession();

    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  // Mọi đường dẫn trừ tài nguyên tĩnh: cần đọc Host để nhận diện website doanh nghiệp
  matcher: ['/((?!_next/static|_next/data).*)'],
};
