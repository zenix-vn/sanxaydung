import { NextResponse, type NextRequest } from 'next/server';
import { createSupabasePublic } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

// Form "Gửi yêu cầu báo giá" trên website doanh nghiệp. Kiểm tra & chống gửi dồn nằm trong RPC
// submit_site_lead; ở đây chỉ lọc bot thô (ô bẫy ẩn, điền form quá nhanh).
export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 8000) return json({ error: 'Nội dung quá dài.' }, 413);
    b = JSON.parse(raw);
  } catch {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }
  const company = s(b.company, 36);
  if (!/^[0-9a-f-]{36}$/i.test(company)) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  // Bot: điền ô bẫy hoặc gửi trong chưa đầy 3 giây — trả về như thành công để không lộ cách lọc
  const elapsed = Number(b.elapsed);
  if (s(b.website, 200) || !Number.isFinite(elapsed) || elapsed < 3000) return json({ ok: true });

  const { error } = await createSupabasePublic().rpc('submit_site_lead', {
    _company: company,
    _name: s(b.name, 100),
    _phone: s(b.phone, 20),
    _email: s(b.email, 200),
    _need: s(b.need, 10),
    _message: s(b.message, 2000),
    _path: s(b.path, 300),
  });
  if (error) {
    // Lỗi kiểm tra dữ liệu / gửi dồn có thông báo tiếng Việt từ RPC
    const known = ['22023', '54000', 'P0002', '23514'].includes(error.code ?? '');
    return json({ error: known ? error.message : 'Chưa gửi được yêu cầu, vui lòng thử lại hoặc gọi điện trực tiếp.' }, known ? 422 : 502);
  }
  return json({ ok: true });
}
