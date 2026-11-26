import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { Empty, Pager, Status, Tabs } from '@/components/admin/ui';
import { Queue, WorkCell, type QueueMeta } from '@/components/admin/queue';
import MatchPartners from './MatchPartners';

export const metadata: Metadata = { title: 'Nhu cầu & báo giá' };

type Item = {
  id: string; title: string; status: string; created_at: string; deadline: string | null; category: string | null; province: string | null;
  company_id: string | null; company: string | null; phone: string | null; quotes: number; oldest_sent: string | null; invited: number;
};
type Data = { counts: { unanswered: number; waiting: number; all: number }; items: Item[] };
const EMPTY: Record<string, [string, string]> = {
  unanswered: ['Không có tin nào đang chờ báo giá', 'Tin đang mở mà chưa ai báo giá sẽ hiện ở đây.'],
  waiting: ['Không có báo giá nào bị bỏ quên', 'Báo giá gửi quá 2 ngày mà chủ tin chưa phản hồi sẽ hiện ở đây.'],
  all: ['Chưa có tin đăng nào', 'Tin do doanh nghiệp đăng ở mục Nhu cầu & Báo giá sẽ hiện ở đây.'],
};
const age = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'hôm nay' : `${d} ngày trước`;
};

export default async function DemandPage({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const { supa, user } = await requireAdmin('/admin/demand', 'admin');
  const tab = ['unanswered', 'waiting', 'all'].includes(searchParams.tab ?? '') ? searchParams.tab! : 'unanswered';
  const { page, from } = pageOf(searchParams);
  const { data, error } = await supa.rpc('admin_demand', { _tab: tab, _limit: PAGE_SIZE, _offset: from });
  const d = data as Data | null;
  const items = d?.items ?? [];
  const { data: meta } = await supa.rpc('admin_queue_meta', { _kind: 'listing', _ids: items.map((x) => x.id) });
  const labels = Object.fromEntries(items.map((x) => [x.id, x.title]));

  return (
    <>
      <div className="adm-h"><div><h1>Nhu cầu & báo giá</h1><p>Theo dõi tin chưa được đáp ứng để chủ động kết nối đối tác.</p></div></div>
      <div className="adm-bar">
        <Tabs base="/admin/demand" param="tab" current={tab} items={[
          { key: 'unanswered', label: 'Chưa có báo giá', count: d?.counts.unanswered },
          { key: 'waiting', label: 'Chờ chủ tin phản hồi', count: d?.counts.waiting },
          { key: 'all', label: 'Tất cả tin', count: d?.counts.all },
        ]} />
      </div>
      <div className="adm-card">
        {error ? <Empty title="Không tải được danh sách" hint={error.message} /> : items.length === 0 ? <Empty title={EMPTY[tab][0]} hint={EMPTY[tab][1]} /> : (
          <Queue kind="listing" meId={user.id} meta={(meta ?? {}) as QueueMeta} labels={labels} actions={[]}>
            <div className="adm-tw"><table className="adm-t">
              <thead><tr><th>Tin đăng</th><th>Người đăng</th><th>Đăng lúc</th><th className="num">Báo giá</th><th className="num">Đã mời</th><th>Phụ trách</th><th /></tr></thead>
              <tbody>{items.map((x) => (
                <tr key={x.id}>
                  <td style={{ maxWidth: 320 }}>
                    <a href={`/marketplace/${x.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 600 }}>{x.title}</a>
                    <br /><small className="muted">{[x.category, x.province, x.deadline && `hạn ${fmtDate(x.deadline)}`].filter(Boolean).join(' · ') || '—'}</small>
                    {x.status !== 'open' && <> <Status s={x.status} /></>}
                  </td>
                  <td>{x.company_id ? <Link href={`/admin/companies/${x.company_id}`} style={{ color: 'var(--navy)' }}>{x.company}</Link> : '—'}<br /><small className="muted">{x.phone}</small></td>
                  <td>{fmtDate(x.created_at)}<br /><small className="muted">{age(x.created_at)}</small></td>
                  <td className="num"><b>{x.quotes}</b>{x.oldest_sent && <><br /><small className="muted">chờ từ {age(x.oldest_sent)}</small></>}</td>
                  <td className="num">{x.invited}</td>
                  <td><WorkCell id={x.id} /></td>
                  <td><div className="acts">{x.status === 'open' && <MatchPartners listingId={x.id} title={x.title} />}</div></td>
                </tr>
              ))}</tbody>
            </table></div>
          </Queue>
        )}
        <Pager base="/admin/demand" params={{ tab }} page={page} total={d?.counts[tab as keyof Data['counts']] ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
