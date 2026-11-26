import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { Empty, Pager } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Nhật ký hoạt động' };
const GROUPS = [
  { v: '', l: 'Tất cả hoạt động' }, { v: 'verification.', l: 'Xác minh' }, { v: 'company.', l: 'Doanh nghiệp / claim' },
  { v: 'moderation.', l: 'Kiểm duyệt' }, { v: 'report.', l: 'Báo cáo' }, { v: 'subscription.', l: 'Gói & thanh toán' }, { v: 'registration.', l: 'Đăng ký đối tác' }, { v: 'account.', l: 'Tài khoản' }, { v: 'user.', l: 'Phân quyền & khóa' },
];
const LABEL: Record<string, string> = {
  'verification.approved': 'Duyệt xác minh', 'verification.rejected': 'Từ chối xác minh',
  'company.claim_approved': 'Duyệt claim hồ sơ', 'company.claim_rejected': 'Từ chối claim hồ sơ',
  'company.status_suspended': 'Đình chỉ doanh nghiệp', 'company.status_published': 'Công khai doanh nghiệp', 'company.status_draft': 'Chuyển nháp',
  'moderation.hide': 'Ẩn nội dung', 'moderation.restore': 'Khôi phục nội dung',
  'subscription.granted': 'Cấp gói', 'subscription.cancelled': 'Hủy gói',
  'report.resolved': 'Đóng báo cáo (đã xử lý)', 'report.dismissed': 'Bỏ qua báo cáo', 'report.reviewing': 'Đang xem báo cáo',
  'registration.approve': 'Duyệt đăng ký đối tác', 'registration.reject': 'Từ chối đăng ký', 'registration.duplicate': 'Đánh dấu đăng ký trùng',
  'account.delete_self': 'Người dùng tự xóa tài khoản',
  'user.role_owner': 'Cấp quyền Chủ sở hữu', 'user.role_admin': 'Cấp quyền Quản trị viên', 'user.role_moderator': 'Cấp quyền Kiểm duyệt viên', 'user.role_member': 'Thu hồi quyền quản trị',
  'user.banned': 'Khóa tài khoản', 'user.unbanned': 'Mở khóa tài khoản',
};
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
  const { data: cos } = cids.length ? await supa.from('companies').select('id, name, slug').in('id', cids) : { data: [] };
  const coMap = new Map(((cos ?? []) as { id: string; name: string; slug: string }[]).map((c) => [c.id, c]));

  return (
    <>
      <div className="adm-h"><div><h1>Nhật ký hoạt động</h1><p>Mọi thao tác quản trị đều được ghi lại để đối soát. Chỉ đọc.</p></div></div>
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
                  <td><b style={{ color: 'var(--navy)' }}>{LABEL[r.action] ?? r.action}</b></td>
                  <td>{r.company_id && coMap.get(r.company_id) ? <a href={`/cong-ty/${coMap.get(r.company_id)!.slug}`} target="_blank" rel="noopener noreferrer">{coMap.get(r.company_id)!.name}</a> : '—'}</td>
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
