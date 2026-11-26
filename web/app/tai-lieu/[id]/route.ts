import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const notFound = () =>
  new NextResponse('Không tìm thấy tài liệu hoặc bạn không có quyền tải.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

// Tải tài liệu hồ sơ doanh nghiệp. Quyền do RLS quyết định (bảng documents + storage.objects)
// theo phiên của người đang xem; ở đây chỉ đổi sang signed URL ngắn hạn.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return notFound();
  const supa = createSupabaseServer();
  const { data: doc } = await supa.from('documents').select('title, file_url').eq('id', params.id).maybeSingle();
  if (!doc) return notFound();
  // PDF & ảnh mở ngay trên trình duyệt; loại khác tải về với đúng tên
  const inline = /\.(pdf|jpe?g|png|webp)$/i.test(doc.file_url);
  const { data } = await supa.storage.from('company-documents').createSignedUrl(doc.file_url, 60, inline ? undefined : { download: doc.title });
  if (!data) return notFound();
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}
