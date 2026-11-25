import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Act, Empty, Pager, Status, Tabs, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Nhận hồ sơ (claim)' };
const METHOD: Record<string, string> = { phone: 'Khớp SĐT', email: 'Khớp email đăng ký', manual: 'Chờ duyệt tay' };
type Row = {
  id: string; method: string; claimed_phone: string | null; note: string | null; status: string; created_at: string;
  companies: { id: string; name: string; slug: string; logo_url: string | null; phone: string | null; owner_id: string | null } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

export default async function ClaimsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/claims');
  const status = ['pending', 'approved', 'rejected'].includes(searchParams.status ?? '') ? searchParams.status! : 'pending';
  const { page, from, to } = pageOf(searchParams);
  const [{ data, count }, { count: pending }] = await Promise.all([
    supa.from('company_claims')
      .select('id, method, claimed_phone, note, status, created_at, companies ( id, name, slug, logo_url, phone, owner_id ), profiles:user_id ( full_name, phone )', { count: 'exact' })
      .eq('status', status).order('created_at', { ascending: status === 'pending' }).range(from, to),
    supa.from('company_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <div className="adm-h"><div><h1>Nhận hồ sơ (claim)</h1><p>Người dùng xin quyền quản lý hồ sơ doanh nghiệp. So khớp SĐT người xin với SĐT hồ sơ trước khi duyệt.</p></div></div>
      <div className="adm-bar">
        <Tabs base="/admin/claims" current={status} items={[{ key: 'pending', label: 'Chờ duyệt', count: pending ?? 0 }, { key: 'approved', label: 'Đã duyệt' }, { key: 'rejected', label: 'Từ chối' }]} />
      </div>
      <div className="adm-card">
        {rows.length === 0 ? <Empty title="Không có yêu cầu nào" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Hồ sơ doanh nghiệp</th><th>Người yêu cầu</th><th>So khớp</th><th>Ghi chú</th><th>Gửi lúc</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{rows.map((r) => {
              const match = r.companies?.phone && r.claimed_phone && r.companies.phone.replace(/\D/g, '') === r.claimed_phone.replace(/\D/g, '');
              return (
                <tr key={r.id}>
                  <td><Who name={r.companies?.name ?? '—'} sub={`SĐT hồ sơ: ${r.companies?.phone ?? '—'}`} logo={r.companies?.logo_url} color={colorFor(r.companies?.id ?? r.id)} /></td>
                  <td><b style={{ color: 'var(--navy)' }}>{r.profiles?.full_name ?? 'Chưa đặt tên'}</b><br /><small className="muted">{r.claimed_phone ?? r.profiles?.phone ?? '—'}</small></td>
                  <td><span className={`bdg ${match ? 'g' : 'o'}`}>{match ? 'SĐT trùng khớp' : METHOD[r.method] ?? r.method}</span></td>
                  <td><div className="clip" style={{ maxWidth: 240 }}>{r.note ?? '—'}</div></td>
                  <td>{fmtDate(r.created_at, true)}</td>
                  <td><Status s={r.status} />{r.companies?.owner_id && r.status === 'pending' && <div className="muted" style={{ marginTop: 4 }}>Đã có chủ</div>}</td>
                  <td><div className="acts">
                    {r.companies && <a className="ab" href={`/cong-ty/${r.companies.slug}`} target="_blank" rel="noopener noreferrer">Hồ sơ</a>}
                    {r.status === 'pending' && (<>
                      <Act label="Từ chối" tone="d" fn="admin_review_claim" args={{ _claim: r.id, _approve: false }} confirm={{ title: 'Từ chối yêu cầu?', message: 'Người dùng sẽ không được cấp quyền quản lý hồ sơ này.', confirmLabel: 'Từ chối' }} success="Đã từ chối" />
                      <Act label="Duyệt" icon="ic-check" tone="p" fn="admin_review_claim" args={{ _claim: r.id, _approve: true }} confirm={{ title: 'Duyệt yêu cầu?', message: `${r.profiles?.full_name ?? 'Người dùng'} sẽ trở thành chủ sở hữu hồ sơ “${r.companies?.name}”.`, confirmLabel: 'Duyệt' }} success="Đã cấp quyền quản lý" />
                    </>)}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Pager base="/admin/claims" params={{ status }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
