import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { Empty, ExportLink, Pager } from '@/components/admin/ui';
import { AUDIT_LABEL } from '@/lib/admin-labels';

export const metadata: Metadata = { title: 'Nhật ký hoạt động' };
const GROUPS = [
  { v: '', l: 'Tất cả hoạt động' }, { v: 'verification.', l: 'Xác minh' }, { v: 'company.', l: 'Doanh nghiệp / claim' },
  { v: 'moderation.', l: 'Kiểm duyệt' }, { v: 'report.', l: 'Báo cáo' }, { v: 'subscription.', l: 'Gói dịch vụ' }, { v: 'payment.', l: 'Thanh toán' }, { v: 'plan.', l: 'Bảng giá' }, { v: 'listing.', l: 'Nhu cầu & báo giá' }, { v: 'registration.', l: 'Đăng ký đối tác' }, { v: 'account.', l: 'Tài khoản' }, { v: 'user.', l: 'Phân quyền & khóa' }, { v: 'category.', l: 'Danh mục' }, { v: 'ad.', l: 'Quảng cáo' }, { v: 'broadcast.', l: 'Thông báo' }, { v: 'import.', l: 'Nhập dữ liệu' }, { v: 'export.', l: 'Xuất dữ liệu' },
];
type Row = { id: string; action: string; company_id: string | null; entity_type: string | null; created_at: string; diff: Record<string, unknown> | null; profiles: { full_name: string | null } | null };

export default async function AuditPage({ searchParams }: { searchParams: { g?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/audit', 'admin');
  const g = GROUPS.some((x) => x.v === searchParams.g) ? searchParams.g ?? '' : '';
  const { page, from, to } = pageOf(searchParams);
  let qb = supa.from('audit_log')
    .select('id, action, company_id, entity_type, created_at, diff, profiles:actor_id ( full_name )', { count: 'exact' })
    .order('created_at', { ascending: false }).range(from, to);
  if (g) qb = qb.like('action', `${g}%`);
  const { data, count } = await qb;
  const rows = (data ?? []) as unknown as Row[];
  // audit_log.company_id không có FK → tra tên công ty riêng
  const cids = Array.from(new Set(rows.map((r) => r.company_id).filter(Boolean))) as string[];
  const { data: cos } = cids.length ? await supa.from('companies').select('id, name').in('id', cids) : { data: [] };
  const coMap = new Map(((cos ?? []) as { id: string; name: string }[]).map((c) => [c.id, c]));

  return (
    <>
      <div className="adm-h"><div><h1>Nhật ký hoạt động</h1><p>Mọi thao tác quản trị đều được ghi lại để đối soát. Chỉ đọc.</p></div><ExportLink kind="audit" /></div>
      <form className="adm-bar adm-search" action="/admin/audit">
        <select name="g" defaultValue={g} aria-label="Nhóm hoạt động">{GROUPS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>
        <button className="ab o" type="submit">Lọc</button>
      </form>
      <div className="adm-card">
        {rows.length === 0 ? <Empty title="Chưa có hoạt động nào" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Doanh nghiệp</th><th>Chi tiết</th></tr></thead>
            <tbody>{rows.map((r) => {
              const d = r.diff ? Object.entries(r.diff).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : '';
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at, true)}</td>
                  <td>{r.profiles?.full_name ?? <span className="muted">Hệ thống</span>}</td>
                  <td><b style={{ color: 'var(--navy)' }}>{AUDIT_LABEL[r.action] ?? r.action}</b></td>
                  <td>{r.company_id && coMap.get(r.company_id) ? <a href={`/admin/companies/${r.company_id}`}>{coMap.get(r.company_id)!.name}</a> : '—'}</td>
                  <td><div className="clip" style={{ maxWidth: 320 }} title={d}>{d || '—'}</div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Pager base="/admin/audit" params={{ g }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
