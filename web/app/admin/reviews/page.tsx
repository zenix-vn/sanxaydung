import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { Act, Empty, Pager, Status, Tabs } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Đánh giá' };

type Item = {
  id: string; overall: number | null; comment: string | null; reply: string | null; status: string; created_at: string;
  reviewer_id: string; reviewer: string | null; target_id: string; target: string | null; flags: string[]; suspicious: boolean; cleared: boolean;
};
type Data = { counts: { suspicious: number; hidden: number; all: number }; items: Item[] };
const EMPTY: Record<string, string> = { suspicious: 'Không có đánh giá đáng ngờ', hidden: 'Chưa ẩn đánh giá nào', all: 'Chưa có đánh giá nào' };

export default async function ReviewsPage({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/reviews');
  const tab = ['suspicious', 'hidden', 'all'].includes(searchParams.tab ?? '') ? searchParams.tab! : 'suspicious';
  const { page, from } = pageOf(searchParams);
  const { data, error } = await supa.rpc('admin_reviews', { _tab: tab, _limit: PAGE_SIZE, _offset: from });
  const d = data as Data | null;
  const items = d?.items ?? [];
  const company = (id: string, name: string | null) => <Link href={`/admin/companies/${id}`} style={{ color: 'var(--navy)', fontWeight: 600 }}>{name ?? '—'}</Link>;

  return (
    <>
      <div className="adm-h"><div><h1>Đánh giá</h1><p>Dấu hiệu nghi ngờ chỉ là gợi ý để xem xét, không phải kết luận. Ẩn đánh giá sẽ tính lại Trust Score.</p></div></div>
      <div className="adm-bar">
        <Tabs base="/admin/reviews" param="tab" current={tab} items={[
          { key: 'suspicious', label: 'Cần xem lại', count: d?.counts.suspicious }, { key: 'hidden', label: 'Đã ẩn', count: d?.counts.hidden }, { key: 'all', label: 'Tất cả', count: d?.counts.all },
        ]} />
      </div>
      <div className="adm-card">
        {error ? <Empty title="Không tải được danh sách" hint={error.message} /> : items.length === 0 ? <Empty title={EMPTY[tab]} /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Điểm</th><th>Đánh giá</th><th>Dấu hiệu</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{items.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}><b>{r.overall ?? '—'}</b> ★</td>
                <td style={{ maxWidth: 380 }}>
                  {company(r.reviewer_id, r.reviewer)} <span className="muted">đánh giá</span> {company(r.target_id, r.target)}
                  <div>{r.comment || <span className="muted">Không lời bình</span>}</div>
                  {r.reply && <div className="adm-reply">Phản hồi: {r.reply}</div>}
                  <small className="muted">{fmtDate(r.created_at, true)}</small>
                </td>
                <td style={{ maxWidth: 260 }}>
                  {r.flags.length === 0 ? <span className="muted">Không</span> : <ul className={`adm-flags${r.cleared ? ' off' : ''}`}>{r.flags.map((f) => <li key={f}>{f}</li>)}</ul>}
                  {r.cleared && <small className="muted">Đã xem, hợp lệ</small>}
                </td>
                <td><Status s={r.status} /></td>
                <td><div className="acts">
                  {r.suspicious && <Act label="Hợp lệ" icon="ic-check" tone="p" fn="admin_clear_review" args={{ _id: r.id }} success="Đã đánh dấu hợp lệ" />}
                  {r.status === 'hidden'
                    ? <Act label="Khôi phục" fn="admin_moderate" args={{ _entity: 'review', _id: r.id, _hide: false }} success="Đã khôi phục" />
                    : <Act label="Ẩn" tone="d" fn="admin_moderate" args={{ _entity: 'review', _id: r.id, _hide: true }} fieldArgs={{ reason: '_reason' }}
                        confirm={{ title: 'Ẩn đánh giá?', message: 'Đánh giá bị gỡ khỏi trang công khai và Trust Score được tính lại.', confirmLabel: 'Ẩn', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true, suggestions: ['Đánh giá ảo hoặc tự đánh giá', 'Nội dung xúc phạm', 'Không đúng giao dịch thực tế'] }] }} success="Đã ẩn đánh giá" />}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/reviews" params={{ tab }} page={page} total={d?.counts[tab as keyof Data['counts']] ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
