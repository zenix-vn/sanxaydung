import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Empty, ExportLink, Pager, Status, Who } from '@/components/admin/ui';
import { TIER } from '@/lib/admin-labels';
import CompanyActions from './CompanyActions';

export const metadata: Metadata = { title: 'Doanh nghiệp' };
type Row = {
  id: string; slug: string; name: string; phone: string | null; tax_code: string | null; logo_url: string | null; status: string;
  verified_tier: string; trust_score: number; owner_id: string | null; created_at: string; profile_completeness: number | null;
};

export default async function CompaniesPage({ searchParams }: { searchParams: { q?: string; status?: string; tier?: string; owner?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/companies', 'admin');
  const q = (searchParams.q ?? '').trim().replace(/[%,()]/g, '');
  const { status = '', tier = '', owner = '' } = searchParams;
  const { page, from, to } = pageOf(searchParams);

  let qb = supa.from('companies')
    .select('id, slug, name, phone, tax_code, logo_url, status, verified_tier, trust_score, owner_id, created_at, profile_completeness', { count: 'exact' })
    .is('deleted_at', null).order('created_at', { ascending: false }).range(from, to);
  if (q) qb = qb.or(`name.ilike.%${q}%,slug.ilike.%${q}%,phone.ilike.%${q}%,tax_code.ilike.%${q}%`);
  if (['draft', 'published', 'suspended'].includes(status)) qb = qb.eq('status', status);
  if (['none', 'legal', 'capability', 'gold'].includes(tier)) qb = qb.eq('verified_tier', tier);
  if (owner === 'unclaimed') qb = qb.is('owner_id', null);
  if (owner === 'claimed') qb = qb.not('owner_id', 'is', null);

  const [{ data, count }, { data: plans }] = await Promise.all([qb, supa.from('plans').select('id, name').order('price_month')]);
  const rows = (data ?? []) as Row[];
  const planOpts = ((plans ?? []) as { id: string; name: string | null }[]).map((p) => ({ value: p.id, label: p.name ?? p.id }));

  return (
    <>
      <div className="adm-h"><div><h1>Doanh nghiệp</h1><p>{(count ?? 0).toLocaleString('vi-VN')} hồ sơ khớp bộ lọc.</p></div><div className="adm-hd-acts"><a className="ab o" href="/admin/import"><svg className="ic"><use href="#ic-upload" /></svg> Nhập CSV</a><ExportLink kind="companies" /></div></div>
      <form className="adm-bar adm-search" action="/admin/companies">
        <input name="q" defaultValue={q} placeholder="Tên, slug, SĐT hoặc MST…" aria-label="Tìm kiếm" style={{ flex: '1 1 260px' }} />
        <select name="status" defaultValue={status} aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="published">Công khai</option><option value="draft">Nháp</option><option value="suspended">Đình chỉ</option></select>
        <select name="tier" defaultValue={tier} aria-label="Hạng xác minh"><option value="">Mọi hạng</option><option value="none">Chưa xác minh</option><option value="legal">Pháp lý</option><option value="capability">Năng lực</option><option value="gold">Đối tác vàng</option></select>
        <select name="owner" defaultValue={owner} aria-label="Chủ sở hữu"><option value="">Có/chưa có chủ</option><option value="claimed">Đã có chủ</option><option value="unclaimed">Chưa có chủ</option></select>
        <button className="ab o" type="submit">Lọc</button>
        {(q || status || tier || owner) && <a className="ab" href="/admin/companies">Xóa lọc</a>}
      </form>
      <div className="adm-card">
        {rows.length === 0 ? <Empty title="Không tìm thấy doanh nghiệp" hint="Thử đổi từ khóa hoặc bỏ bớt bộ lọc." /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Doanh nghiệp</th><th>Trạng thái</th><th>Xác minh</th><th className="num">Trust</th><th>Chủ sở hữu</th><th>Tạo lúc</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Who name={r.name} sub={r.phone ?? (r.tax_code ? `MST ${r.tax_code}` : r.slug)} logo={r.logo_url} color={colorFor(r.id)} href={`/admin/companies/${r.id}`} /></td>
                <td><Status s={r.status} /></td>
                <td><span className={`bdg ${TIER[r.verified_tier]?.c ?? ''}`}>{TIER[r.verified_tier]?.l ?? r.verified_tier}</span></td>
                <td className="num"><b>{Math.round(r.trust_score ?? 0)}</b></td>
                <td>{r.owner_id ? <span className="bdg g">Đã có chủ</span> : <span className="bdg o">Chưa có chủ</span>}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td><div className="acts">
                  <a className="ab" href={`/admin/companies/${r.id}`}>Chi tiết</a>
                  <CompanyActions company={r} plans={planOpts} />
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/companies" params={{ q, status, tier, owner }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
