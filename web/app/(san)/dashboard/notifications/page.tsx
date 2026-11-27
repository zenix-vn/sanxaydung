import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { timeAgo } from '@/lib/ui';
import Pagination from '@/components/Pagination';
import { MarkAllRead, NotifLink, PrefsForm } from './NotifClient';

export const metadata: Metadata = { title: 'Thông báo' };
export const dynamic = 'force-dynamic';

const PAGE = 30;
const ICONS: Record<string, string> = {
  new_message: 'ic-chat', new_quote: 'ic-file-text', quote_status: 'ic-file-text', review_received: 'ic-star-f',
  verify_result: 'ic-shield-check', connection_request: 'ic-people', member_invite: 'ic-users', member_joined: 'ic-users', site_lead: 'ic-clipboard',
};

type N = { id: string; type: string; title: string | null; body: string | null; link: string | null; is_read: boolean; created_at: string };

export default async function NotificationsPage({ searchParams }: { searchParams: { page?: string; unread?: string } }) {
  const { supa, user } = await requireUserCompany('/dashboard/notifications');
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const onlyUnread = searchParams.unread === '1';

  let q = supa.from('notifications').select('id, type, title, body, link, is_read, created_at', { count: 'exact' }).eq('user_id', user.id);
  if (onlyUnread) q = q.eq('is_read', false);
  const [{ data, count }, { count: unread }, { data: prefs }] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supa.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    supa.from('notification_prefs').select('email, zalo, push, digest').eq('user_id', user.id).maybeSingle(),
  ]);
  const items = (data ?? []) as N[];

  return (
    <div>
      <style>{`
        .nrow{display:flex;gap:12px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2);padding:13px 6px;cursor:pointer;font-family:inherit;color:inherit;border-radius:8px}
        .nrow:hover{background:#f8fafc}
        .nrow.un{background:#fff8f1}
        .nrow .ib{width:36px;height:36px;border-radius:10px;background:var(--blue-soft);color:var(--blue);display:grid;place-items:center;flex:none}
        .nrow .ib svg{width:17px;height:17px}
        .nrow b{display:block;font-size:13.5px;color:var(--navy)}
        .nrow span.t{display:block;font-size:13px;color:#31414f;margin-top:2px}
        .nrow small{font-size:11.5px;color:var(--muted)}
        .nrow .dot{width:8px;height:8px;border-radius:50%;background:var(--orange);margin:6px 0 0 auto;flex:none}
        .pref{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line-2);cursor:pointer}
        .pref b{display:block;font-size:13.5px;color:var(--navy)}
        .pref small{display:block;font-size:12px;color:var(--muted)}
      `}</style>
      <div className="dpage-head">
        <div>
          <h1>Thông báo</h1>
          <p>{unread ? `${unread} thông báo chưa đọc.` : 'Bạn đã đọc hết thông báo.'}</p>
        </div>
        <MarkAllRead userId={user.id} disabled={!unread} />
      </div>

      <div className="grid-side-r" style={{ gap: 20 }}>
        <div className="dcard">
          <div className="dtabs">
            <a className={!onlyUnread ? 'active' : ''} href="/dashboard/notifications">Tất cả</a>
            <a className={onlyUnread ? 'active' : ''} href="/dashboard/notifications?unread=1">Chưa đọc <span className="n">{unread ?? 0}</span></a>
          </div>
          {items.length === 0 ? (
            <div className="empty"><svg className="ic"><use href="#ic-bell" /></svg>Không có thông báo.</div>
          ) : (
            items.map((n) => (
              <NotifLink key={n.id} id={n.id} link={n.link} unread={!n.is_read}>
                <span className="ib"><svg className="ic"><use href={`#${ICONS[n.type] ?? 'ic-bell'}`} /></svg></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{n.title ?? 'Thông báo'}</b>
                  {n.body && <span className="t">{n.body}</span>}
                  <small>{timeAgo(n.created_at)}</small>
                </span>
                {!n.is_read && <span className="dot" aria-label="Chưa đọc" />}
              </NotifLink>
            ))
          )}
          <Pagination base="/dashboard/notifications" qs={onlyUnread ? 'unread=1' : ''} page={page} pages={Math.ceil((count ?? 0) / PAGE)} />
        </div>
        <aside className="dcard">
          <h3>Nhận thông báo qua</h3>
          <PrefsForm userId={user.id} initial={{ email: prefs?.email ?? true, zalo: prefs?.zalo ?? true, push: prefs?.push ?? true, digest: (prefs?.digest as 'instant') ?? 'instant' }} />
        </aside>
      </div>
    </div>
  );
}
