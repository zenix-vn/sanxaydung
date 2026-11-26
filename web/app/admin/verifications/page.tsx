import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { REJECT_REASONS, VERIFY_KIND } from '@/lib/admin-labels';
import { Check, CheckAll, Queue, WorkCell, type BulkAction, type QueueMeta } from '@/components/admin/queue';
import { Act, Empty, Pager, SignedLink, Status, Tabs, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Xác minh pháp lý' };

type Row = {
  id: string; kind: string; status: string; reference: string | null; cert_class: string | null;
  evidence_url: string | null; meta: { admin_note?: string } | null; created_at: string; verified_at: string | null;
  companies: { id: string; name: string; slug: string; logo_url: string | null; phone: string | null } | null;
};

const BULK: BulkAction[] = [
  { action: 'approve', label: 'Duyệt', tone: 'p', message: 'Cấp huy hiệu cho tất cả mục đã chọn. Chỉ duyệt hàng loạt khi đã đối chiếu từng giấy tờ.' },
  { action: 'reject', label: 'Từ chối', tone: 'd', message: 'Lý do được gửi cho từng doanh nghiệp qua thông báo.', reason: { required: true, suggestions: REJECT_REASONS.verification } },
];

export default async function VerificationsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const { supa, user } = await requireAdmin('/admin/verifications');
  const status = ['pending', 'verified', 'rejected'].includes(searchParams.status ?? '') ? searchParams.status! : 'pending';
  const { page, from, to } = pageOf(searchParams);

  const [{ data, count }, { count: pending }] = await Promise.all([
    supa.from('company_verifications')
      .select('id, kind, status, reference, cert_class, evidence_url, meta, created_at, verified_at, companies ( id, name, slug, logo_url, phone )', { count: 'exact' })
      .eq('status', status).order('created_at', { ascending: status === 'pending' }).range(from, to),
    supa.from('company_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const open = status === 'pending';
  const { data: meta } = await supa.rpc('admin_queue_meta', { _kind: 'verification', _ids: rows.map((r) => r.id) });
  const labels = Object.fromEntries(rows.map((r) => [r.id, `${r.companies?.name ?? '—'} (${VERIFY_KIND[r.kind] ?? r.kind})`]));

  return (
    <>
      <div className="adm-h">
        <div><h1>Xác minh pháp lý</h1><p>Đối chiếu hồ sơ doanh nghiệp gửi lên với cơ sở dữ liệu quốc gia trước khi cấp huy hiệu.</p></div>
      </div>
      <div className="adm-bar">
        <Tabs base="/admin/verifications" current={status} items={[
          { key: 'pending', label: 'Chờ duyệt', count: pending ?? 0 }, { key: 'verified', label: 'Đã duyệt' }, { key: 'rejected', label: 'Từ chối' },
        ]} />
      </div>
      <div className="adm-card">
        {rows.length === 0 ? <Empty title="Không có yêu cầu nào" hint="Các yêu cầu mới sẽ xuất hiện ở đây." /> : (
          <Queue kind="verification" meId={user.id} meta={(meta ?? {}) as QueueMeta} labels={labels} actions={open ? BULK : []}>
          <div className="adm-tw">
            <table className="adm-t">
              <thead><tr>{open && <th className="chk"><CheckAll /></th>}<th>Doanh nghiệp</th><th>Loại</th><th>Thông tin khai</th><th>Tài liệu</th><th>Gửi lúc</th><th>Trạng thái</th>{open && <th>Phụ trách</th>}<th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const ev = r.evidence_url;
                  const external = ev && /^https?:/.test(ev) && !ev.includes('/verification-docs/');
                  return (
                    <tr key={r.id}>
                      {open && <td className="chk"><Check id={r.id} /></td>}
                      <td><Who name={r.companies?.name ?? '—'} sub={r.companies?.phone} logo={r.companies?.logo_url} color={colorFor(r.companies?.id ?? r.id)} href={r.companies ? `/admin/companies/${r.companies.id}` : undefined} /></td>
                      <td>{VERIFY_KIND[r.kind] ?? r.kind}</td>
                      <td><div className="clip">{r.reference ?? '—'}</div>{r.cert_class && <small className="muted">Hạng: {r.cert_class}</small>}</td>
                      <td>{ev ? (external ? <a className="ab" href={ev} target="_blank" rel="noopener noreferrer">Mở liên kết</a> : <SignedLink bucket="verification-docs" path={ev} />) : <span className="muted">Không có</span>}</td>
                      <td>{fmtDate(r.created_at, true)}</td>
                      <td><Status s={r.status} />{r.meta?.admin_note && <div className="muted" style={{ marginTop: 4, maxWidth: 220 }}>{r.meta.admin_note}</div>}</td>
                      {open && <td><WorkCell id={r.id} /></td>}
                      <td>
                        <div className="acts">
                          {r.companies && <a className="ab" href={`/admin/companies/${r.companies.id}`}>Chi tiết</a>}
                          {r.status === 'pending' && (
                            <>
                              <Act label="Từ chối" tone="d" fn="admin_review_verification" args={{ _id: r.id, _approve: false }} fieldArgs={{ note: '_note' }}
                                confirm={{ title: 'Từ chối xác minh', message: 'Lý do được gửi cho doanh nghiệp qua thông báo.', confirmLabel: 'Từ chối', fields: [{ key: 'note', label: 'Lý do', type: 'textarea', required: true, suggestions: REJECT_REASONS.verification }] }}
                                success="Đã từ chối yêu cầu" />
                              <Act label="Duyệt" icon="ic-check" tone="p" fn="admin_review_verification" args={{ _id: r.id, _approve: true }} fieldArgs={{ note: '_note' }}
                                confirm={{ title: 'Duyệt xác minh', message: `Cấp huy hiệu cho ${r.companies?.name ?? 'doanh nghiệp'}? Hạng xác minh và Trust Score sẽ được cập nhật ngay.`, confirmLabel: 'Duyệt', fields: [{ key: 'note', label: 'Ghi chú (không bắt buộc)', type: 'text' }] }}
                                success="Đã duyệt xác minh" />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </Queue>
        )}
        <Pager base="/admin/verifications" params={{ status }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
