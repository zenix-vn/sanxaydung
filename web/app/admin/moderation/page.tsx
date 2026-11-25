import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { Act, Empty, Pager, Status, Tabs } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Kiểm duyệt nội dung' };
const ENTITY: Record<string, string> = { post: 'Bài viết', listing: 'Tin đăng', marketplace_listing: 'Tin đăng', review: 'Đánh giá', company: 'Doanh nghiệp' };
const norm = (t: string | null) => (t === 'marketplace_listing' ? 'listing' : t ?? '');

type Rep = { id: string; entity_type: string | null; entity_id: string | null; reason: string | null; status: string; created_at: string; profiles: { full_name: string | null } | null };
type Item = { id: string; status: string; created_at: string; title?: string | null; body?: string | null; comment?: string | null; companies?: { name: string; slug: string } | null; target?: { name: string; slug: string } | null };

export default async function ModerationPage({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/moderation');
  const tab = ['reports', 'posts', 'listings', 'reviews'].includes(searchParams.tab ?? '') ? searchParams.tab! : 'reports';
  const { page, from, to } = pageOf(searchParams);
  const { count: openReports } = await supa.from('reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'reviewing']);

  let total = 0;
  let body: React.ReactNode;

  if (tab === 'reports') {
    const { data, count } = await supa.from('reports')
      .select('id, entity_type, entity_id, reason, status, created_at, profiles:reporter_id ( full_name )', { count: 'exact' })
      .order('status', { ascending: true }).order('created_at', { ascending: false }).range(from, to);
    total = count ?? 0;
    const reps = (data ?? []) as unknown as Rep[];
    // Lấy tiêu đề nội dung bị báo cáo
    const ids = (t: string) => reps.filter((r) => norm(r.entity_type) === t && r.entity_id).map((r) => r.entity_id!);
    const [p, l, rv, c] = await Promise.all([
      ids('post').length ? supa.from('posts').select('id, title, body, status').in('id', ids('post')) : { data: [] },
      ids('listing').length ? supa.from('marketplace_listings').select('id, title, status').in('id', ids('listing')) : { data: [] },
      ids('review').length ? supa.from('reviews').select('id, comment, status').in('id', ids('review')) : { data: [] },
      ids('company').length ? supa.from('companies').select('id, name, slug').in('id', ids('company')) : { data: [] },
    ]);
    const info = new Map<string, { text: string; status?: string; href?: string }>();
    (p.data ?? []).forEach((x: { id: string; title: string | null; body: string | null; status: string }) => info.set(x.id, { text: x.title || x.body?.slice(0, 90) || '(không nội dung)', status: x.status }));
    (l.data ?? []).forEach((x: { id: string; title: string; status: string }) => info.set(x.id, { text: x.title, status: x.status, href: `/marketplace/${x.id}` }));
    (rv.data ?? []).forEach((x: { id: string; comment: string | null; status: string }) => info.set(x.id, { text: x.comment?.slice(0, 90) || '(không lời bình)', status: x.status }));
    (c.data ?? []).forEach((x: { id: string; name: string; slug: string }) => info.set(x.id, { text: x.name, href: `/cong-ty/${x.slug}` }));

    body = reps.length === 0 ? <Empty title="Chưa có báo cáo nào" hint="Báo cáo vi phạm từ người dùng sẽ hiện ở đây." /> : (
      <div className="adm-tw"><table className="adm-t">
        <thead><tr><th>Nội dung bị báo cáo</th><th>Lý do</th><th>Người báo cáo</th><th>Lúc</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{reps.map((r) => {
          const e = r.entity_id ? info.get(r.entity_id) : undefined;
          const t = norm(r.entity_type);
          const canHide = ['post', 'listing', 'review'].includes(t) && r.entity_id;
          const open = r.status === 'open' || r.status === 'reviewing';
          return (
            <tr key={r.id}>
              <td><span className="bdg b">{ENTITY[r.entity_type ?? ''] ?? r.entity_type ?? '?'}</span>
                <div className="clip" style={{ marginTop: 5 }}>{e ? (e.href ? <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 600 }}>{e.text}</a> : e.text) : <span className="muted">Đã bị xóa</span>}</div>
                {e?.status === 'hidden' || e?.status === 'closed' ? <small className="muted">Đang bị ẩn</small> : null}
              </td>
              <td><div className="clip" style={{ maxWidth: 260 }}>{r.reason ?? '—'}</div></td>
              <td>{r.profiles?.full_name ?? '—'}</td>
              <td>{fmtDate(r.created_at, true)}</td>
              <td><Status s={r.status} /></td>
              <td><div className="acts">
                {open && canHide && (
                  <Act label="Ẩn & đóng" tone="d" fn="admin_moderate" args={{ _entity: t, _id: r.entity_id, _hide: true }} fieldArgs={{ reason: '_reason' }}
                    also={{ fn: 'admin_resolve_report', args: { _id: r.id, _status: 'resolved' } }}
                    confirm={{ title: 'Ẩn nội dung vi phạm?', message: 'Nội dung bị gỡ khỏi trang công khai và báo cáo được đánh dấu đã xử lý.', confirmLabel: 'Ẩn nội dung', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã ẩn nội dung" />
                )}
                {open && <Act label="Bỏ qua" fn="admin_resolve_report" args={{ _id: r.id, _status: 'dismissed' }} success="Đã bỏ qua báo cáo" />}
                {open && !canHide && <Act label="Đã xử lý" icon="ic-check" tone="p" fn="admin_resolve_report" args={{ _id: r.id, _status: 'resolved' }} success="Đã đóng báo cáo" />}
              </div></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    );
  } else {
    const cfg = {
      posts: { table: 'posts', sel: 'id, title, body, status, created_at, companies ( name, slug )', entity: 'post', hidden: 'hidden', label: 'bài viết' },
      listings: { table: 'marketplace_listings', sel: 'id, title, status, created_at, companies ( name, slug )', entity: 'listing', hidden: 'closed', label: 'tin đăng' },
      reviews: { table: 'reviews', sel: 'id, comment, status, created_at, target:target_company_id ( name, slug )', entity: 'review', hidden: 'hidden', label: 'đánh giá' },
    }[tab as 'posts' | 'listings' | 'reviews'];
    const { data, count } = await supa.from(cfg.table).select(cfg.sel, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    total = count ?? 0;
    const items = (data ?? []) as unknown as Item[];
    body = items.length === 0 ? <Empty title={`Chưa có ${cfg.label} nào`} /> : (
      <div className="adm-tw"><table className="adm-t">
        <thead><tr><th>Nội dung</th><th>Doanh nghiệp</th><th>Đăng lúc</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{items.map((it) => {
          const co = it.companies ?? it.target;
          const hidden = it.status === cfg.hidden;
          return (
            <tr key={it.id}>
              <td><div className="clip" style={{ maxWidth: 420, color: 'var(--navy)', fontWeight: 600 }}>{it.title || it.body?.slice(0, 100) || it.comment?.slice(0, 100) || '(không nội dung)'}</div></td>
              <td>{co ? <a href={`/cong-ty/${co.slug}`} target="_blank" rel="noopener noreferrer">{co.name}</a> : '—'}</td>
              <td>{fmtDate(it.created_at, true)}</td>
              <td><Status s={it.status} /></td>
              <td><div className="acts">
                {hidden ? (
                  <Act label="Khôi phục" tone="p" fn="admin_moderate" args={{ _entity: cfg.entity, _id: it.id, _hide: false }} success="Đã khôi phục" />
                ) : (
                  <Act label="Ẩn" tone="d" fn="admin_moderate" args={{ _entity: cfg.entity, _id: it.id, _hide: true }} fieldArgs={{ reason: '_reason' }}
                    confirm={{ title: `Ẩn ${cfg.label} này?`, confirmLabel: 'Ẩn', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã ẩn" />
                )}
              </div></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    );
  }

  return (
    <>
      <div className="adm-h"><div><h1>Kiểm duyệt nội dung</h1><p>Xử lý báo cáo vi phạm và gỡ bài viết, tin đăng, đánh giá không phù hợp. Mọi thao tác đều được ghi nhật ký.</p></div></div>
      <div className="adm-bar">
        <Tabs base="/admin/moderation" param="tab" current={tab} items={[{ key: 'reports', label: 'Báo cáo', count: openReports ?? 0 }, { key: 'posts', label: 'Bài viết' }, { key: 'listings', label: 'Tin đăng' }, { key: 'reviews', label: 'Đánh giá' }]} />
      </div>
      <div className="adm-card">
        {body}
        <Pager base="/admin/moderation" params={{ tab }} page={page} total={total} size={PAGE_SIZE} />
      </div>
    </>
  );
}
