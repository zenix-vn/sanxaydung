import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CORS_HEADERS } from '@/lib/http';

// Thêm CORS cho toàn bộ /api/* và trả lời preflight OPTIONS (phục vụ app mobile).
export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const res = NextResponse.next();
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export const config = { matcher: '/api/:path*' };
