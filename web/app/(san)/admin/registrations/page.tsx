import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, hasRole, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { GROUP_LABEL, REJECT_REASONS } from '@/lib/admin-labels';
import { Check, CheckAll, Queue, WorkCell, type BulkAction, type QueueMeta } from '@/components/admin/queue';
import { Act, Empty, ExportLink, Pager, Status, Tabs, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Đăng ký đối tác' };
type Row = {
  id: string; company_name: string; phone: string; tax_code: string | null; contact_name: string | null; contact_role: string | null;
  group_key: string | null; address: string | null; status: string; created_at: string; company_id: string | null; source: string | null;
};

const BULK: BulkAction[] = [
  { action: 'approve', label: 'Duyệt & tạo hồ sơ', tone: 'p', message: 'Mỗi bản đăng ký thành một hồ sơ công khai, chưa có chủ. Bản trùng SĐT với hồ sơ đã có sẽ được báo lại.' },
  { action: 'duplicate', label: 'Đánh dấu trùng', message: 'Các bản đăng ký trùng với doanh nghiệp đã có.' },
  { action: 'reject', label: 'Từ chối', tone: 'd', message: 'Lý do chỉ lưu nội bộ (người đăng ký chưa có tài khoản).', reason: { required: true, suggestions: REJECT_REASONS.registration } },
];

export default async function RegistrationsPage({ searchParams }: { searchParams: { status?: string; q?: string; page?: string } }) {
  const { supa, role, user } = await requireAdmin('/admin/registrations');
  const isAdmin = hasRole(role, 'admin');
  const status = ['pending', 'approved', 'rejected', 'duplicate'].includes(searchParams.status ?? '') ? searchParams.status! : 'pending';
  const q = (searchParams.q ?? '').trim().replace(/[%,()]/g, '');
  const { page, from, to } = pageOf(searchParams);
  let qb = supa.from('partner_registrations')
    .select('id, company_name, phone, tax_code, contact_name, contact_role, group_key, address, status, created_at, company_id, source', { count: 'exact' })
    .eq('status', status).order('created_at', { ascending: false }).range(from, to);
  if (q) qb = qb.or(`company_name.ilike.%${q}%,phone.ilike.%${q}%,tax_code.ilike.%${q}%`);
  const [{ data, count }, { count: pending }] = await Promise.all([qb, supa.from('partner_registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending')]);
  const rows = (data ?? []) as Row[];
  const open = status === 'pending';
  const { data: meta } = await supa.rpc('admin_queue_meta', { _kind: 'registration', _ids: rows.map((r) => r.id) });
  const labels = Object.fromEntries(rows.map((r) => [r.id, r.company_name]));

  return (
    <>
      <div className="adm-h"><div><h1>Đăng ký đối tác</h1><p>Hồ sơ thu thập từ biểu mẫu. Duyệt để tạo doanh nghiệp (chưa có chủ) — SĐT là khóa chống trùng, MST có thể trống.</p></div>{isAdmin && <div className="adm-hd-acts"><a className="ab o" href="/admin/import"><svg className="ic"><use href="#ic-upload" /></svg> Nhập CSV</a><ExportLink kind="registrations" /></div>}</div>
      <div className="adm-bar">
        <Tabs base="/admin/registrations" current={status} items={[{ key: 'pending', label: 'Chờ duyệt', count: pending ?? 0 }, { key: 'approved', label: 'Đã duyệt' }, { key: 'duplicate', label: 'Trùng' }, { key: 'rejected', label: 'Từ chối' }]} />
        <form className="adm-search" action="/admin/registrations">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Tên, SĐT hoặc MST…" aria-label="Tìm kiếm" />
          <button className="ab" type="submit">Tìm</button>
        </form>
      </div>
      <div className="adm-card">
        {rows.length === 0 ? <Empty title="Không có bản đăng ký nào" /> : (
          <Queue kind="registration" meId={user.id} meta={(meta ?? {}) as QueueMeta} labels={labels} actions={open ? BULK : []}>
          <div className="adm-tw"><table className="adm-t">
            <thead><tr>{open && <th className="chk"><CheckAll /></th>}<th>Doanh nghiệp</th><th>Liên hệ</th><th>Nhóm</th><th>MST</th><th>Gửi lúc</th><th>Trạng thái</th>{open && <th>Phụ trách</th>}<th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                {open && <td className="chk"><Check id={r.id} /></td>}
                <td><Who name={r.company_name} sub={r.address} color={colorFor(r.id)} /></td>
                <td><b style={{ color: 'var(--navy)' }}>{r.contact_name ?? '—'}</b>{r.contact_role && <small className="muted"> · {r.contact_role}</small>}<br /><small className="muted">{r.phone}</small></td>
                <td>{r.group_key ? GROUP_LABEL[r.group_key] ?? r.group_key : '—'}</td>
                <td>{r.tax_code ?? <span className="muted">Không có</span>}</td>
                <td>{fmtDate(r.created_at, true)}</td>
                <td><Status s={r.status} /></td>
                {open && <td><WorkCell id={r.id} /></td>}
                <td><div className="acts">
                  {r.company_id && <a className="ab" href={`/admin/companies/${r.company_id}`}>Xem DN</a>}
                  {r.status === 'pending' && (<>
                    <Act label="Trùng" fn="admin_review_registration" args={{ _reg: r.id, _action: 'duplicate' }} confirm={{ title: 'Đánh dấu trùng?', message: 'Bản đăng ký trùng với doanh nghiệp đã có.', confirmLabel: 'Đánh dấu' }} success="Đã đánh dấu trùng" />
                    <Act label="Từ chối" tone="d" fn="admin_review_registration" args={{ _reg: r.id, _action: 'reject' }} fieldArgs={{ note: '_note' }} confirm={{ title: 'Từ chối đăng ký?', confirmLabel: 'Từ chối', fields: [{ key: 'note', label: 'Lý do (lưu nội bộ)', type: 'textarea', required: true, suggestions: REJECT_REASONS.registration }] }} success="Đã từ chối" />
                    <Act label="Duyệt & tạo hồ sơ" icon="ic-check" tone="p" fn="admin_review_registration" args={{ _reg: r.id, _action: 'approve' }} confirm={{ title: 'Tạo hồ sơ doanh nghiệp?', message: `“${r.company_name}” sẽ được tạo (chưa có chủ, chờ chủ doanh nghiệp nhận hồ sơ).`, confirmLabel: 'Tạo hồ sơ' }} success="Đã tạo hồ sơ doanh nghiệp" />
                  </>)}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
          </Queue>
        )}
        <Pager base="/admin/registrations" params={{ status, q }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
