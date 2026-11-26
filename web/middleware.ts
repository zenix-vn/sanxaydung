import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { CORS_HEADERS } from '@/lib/http';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { serverFetch } from '@/lib/supabase/internal-fetch';

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
  matcher: ['/api/:path*', '/dashboard/:path*', '/admin/:path*', '/_next/image'],
};
