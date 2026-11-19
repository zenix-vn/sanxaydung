import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import NewListingForm from './NewListingForm';

export const metadata: Metadata = { title: 'Đăng nhu cầu / tin đăng' };
export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  let categories: { id: string; name: string }[] = [];
  let provinces: { code: string; name: string }[] = [];
  if (SUPABASE_URL) {
    try {
      const supa = createSupabaseServer();
      const [c, p] = await Promise.all([
        supa.from('categories').select('id, name').order('sort_order'),
        supa.from('provinces').select('code, name').order('name'),
      ]);
      categories = (c.data ?? []) as typeof categories;
      provinces = (p.data ?? []) as typeof provinces;
    } catch {
      /* hiển thị form không có danh mục */
    }
  }
  return (
    <>
      <div className="pagehead" style={{ padding: '18px 0' }}>
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <a href="/marketplace">Nhu cầu &amp; Báo giá</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span style={{ color: '#fff' }}>Đăng tin</span>
          </div>
          <h1>Đăng nhu cầu / tin đăng</h1>
        </div>
      </div>
      <section className="block" style={{ background: 'var(--bg)', paddingTop: 26 }}>
        <div className="container" style={{ maxWidth: 780 }}>
          <div className="card-block">
            <NewListingForm categories={categories} provinces={provinces} />
          </div>
        </div>
      </section>
    </>
  );
}
