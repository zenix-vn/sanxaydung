import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Act, Empty, Pager, Status, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Doanh nghiệp' };
const TIER: Record<string, { l: string; c: string }> = { none: { l: 'Chưa xác minh', c: '' }, legal: { l: 'Pháp lý', c: 'b' }, capability: { l: 'Năng lực', c: 'g' }, gold: { l: 'Đối tác vàng', c: 'o' } };
type Row = {
  id: string; slug: string; name: string; phone: string | null; tax_code: string | null; logo_url: string | null; status: string;
  verified_tier: string; trust_score: number; owner_id: string | null; created_at: string; profile_completeness: number | null;
};

export default async function CompaniesPage({ searchParams }: { searchParams: { q?: string; status?: string; tier?: string; owner?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/companies');
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
      <div className="adm-h"><div><h1>Doanh nghiệp</h1><p>{(count ?? 0).toLocaleString('vi-VN')} hồ sơ khớp bộ lọc.</p></div></div>
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
                <td><Who name={r.name} sub={r.phone ?? (r.tax_code ? `MST ${r.tax_code}` : r.slug)} logo={r.logo_url} color={colorFor(r.id)} /></td>
                <td><Status s={r.status} /></td>
                <td><span className={`bdg ${TIER[r.verified_tier]?.c ?? ''}`}>{TIER[r.verified_tier]?.l ?? r.verified_tier}</span></td>
                <td className="num"><b>{Math.round(r.trust_score ?? 0)}</b></td>
                <td>{r.owner_id ? <span className="bdg g">Đã có chủ</span> : <span className="bdg o">Chưa có chủ</span>}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td><div className="acts">
                  <a className="ab" href={`/cong-ty/${r.slug}`} target="_blank" rel="noopener noreferrer">Xem</a>
                  <Act label="Hạng" fn="admin_set_company_tier" args={{ _company: r.id }} fieldArgs={{ tier: '_tier' }}
                    confirm={{ title: `Hạng xác minh · ${r.name}`, message: 'Đặt thủ công (vd. cấp Đối tác vàng). Trust Score được tính lại.', confirmLabel: 'Lưu', fields: [{ key: 'tier', label: 'Hạng', type: 'select', defaultValue: r.verified_tier, options: [{ value: 'none', label: 'Chưa xác minh' }, { value: 'legal', label: 'Pháp lý' }, { value: 'capability', label: 'Năng lực' }, { value: 'gold', label: 'Đối tác vàng' }] }] }} success="Đã đổi hạng" />
                  {planOpts.length > 0 && (
                    <Act label="Cấp gói" icon="ic-coin" fn="admin_grant_plan" args={{ _company: r.id }} fieldArgs={{ plan: '_plan', months: '_months' }}
                      confirm={{ title: `Cấp gói · ${r.name}`, message: 'Dùng khi đã nhận chuyển khoản. Gói đang chạy (nếu có) sẽ bị thay thế.', confirmLabel: 'Cấp gói', fields: [{ key: 'plan', label: 'Gói', type: 'select', options: planOpts }, { key: 'months', label: 'Số tháng', type: 'number', defaultValue: '1', required: true }] }} success="Đã cấp gói" />
                  )}
                  {r.status === 'suspended' ? (
                    <Act label="Mở lại" tone="p" fn="admin_set_company_status" args={{ _company: r.id, _status: 'published' }} confirm={{ title: 'Mở lại doanh nghiệp?', confirmLabel: 'Mở lại' }} success="Đã mở lại" />
                  ) : (
                    <Act label="Đình chỉ" tone="d" fn="admin_set_company_status" args={{ _company: r.id, _status: 'suspended' }} fieldArgs={{ reason: '_reason' }}
                      confirm={{ title: `Đình chỉ ${r.name}?`, message: 'Hồ sơ sẽ bị gỡ khỏi danh bạ và trang công khai.', confirmLabel: 'Đình chỉ', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã đình chỉ" />
                  )}
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
