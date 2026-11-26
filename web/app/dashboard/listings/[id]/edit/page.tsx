import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUserCompany } from '@/lib/supabase/company';
import { canEdit } from '@/lib/roles';
import NewListingForm, { type ListingInit } from '@/app/marketplace/new/NewListingForm';

export const metadata: Metadata = { title: 'Sửa tin đăng' };
export const dynamic = 'force-dynamic';

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const { supa, companies } = await requireUserCompany(`/dashboard/listings/${params.id}/edit`);
  const [{ data: l }, c, p] = await Promise.all([
    supa
      .from('marketplace_listings')
      .select('id, company_id, type, title, description, category_id, province_code, budget_from, budget_to, deadline, location_text, start_date, boq')
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle(),
    supa.from('categories').select('id, name').order('sort_order'),
    supa.from('provinces').select('code, name').order('name'),
  ]);
  // Chỉ biên tập viên trở lên của công ty đăng tin mới sửa được (RLS cũng chặn khi lưu)
  const mine = l && companies.find((x) => x.id === l.company_id);
  if (!l || !mine || !canEdit(mine)) notFound();

  return (
    <div style={{ maxWidth: 780 }}>
      <div className="crumb"><a href="/dashboard/listings">Tin đăng &amp; báo giá</a><svg className="ic"><use href="#ic-chevron-right" /></svg> Sửa tin</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)', margin: '10px 0 16px' }}>Sửa tin đăng</h1>
      <div className="card-block">
        <NewListingForm
          categories={(c.data ?? []) as { id: string; name: string }[]}
          provinces={(p.data ?? []) as { code: string; name: string }[]}
          initial={l as ListingInit}
        />
      </div>
    </div>
  );
}
