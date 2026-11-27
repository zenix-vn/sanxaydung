import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { canAdmin } from '@/lib/roles';
import { CONNECTION_STATUS, TIER_LABELS, fmtDate } from '@/lib/format';
import { colorFor, initials, thumb } from '@/lib/ui';
import ConnActions from './ConnActions';

export const metadata: Metadata = { title: 'Kết nối doanh nghiệp' };
export const dynamic = 'force-dynamic';

type Co = { id: string; name: string; slug: string; logo_url: string | null; verified_tier: string };
type C = {
  id: string; status: string; created_at: string; completed_at: string | null; listing_id: string | null;
  requester_company_id: string; target_company_id: string;
  requester: Co | null; target: Co | null; listing: { id: string; title: string } | null;
};

const TABS = [
  { key: 'incoming', label: 'Chờ bạn phản hồi' },
  { key: 'active', label: 'Đang hợp tác' },
  { key: 'outgoing', label: 'Đã gửi' },
  { key: 'completed', label: 'Đã hoàn tất' },
  { key: 'all', label: 'Tất cả' },
] as const;

export default async function ConnectionsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supa, company, role } = await requireUserCompany('/dashboard/connections');
  if (!company) return null;
  const me = company.id as string;
  const admin = canAdmin({ role: role ?? 'member' });

  const { data } = await supa
    .from('connections')
    .select(
      `id, status, created_at, completed_at, listing_id, requester_company_id, target_company_id,
       requester:companies!requester_company_id ( id, name, slug, logo_url, verified_tier ),
       target:companies!target_company_id ( id, name, slug, logo_url, verified_tier ),
       listing:marketplace_listings ( id, title )`,
    )
    .or(`requester_company_id.eq.${me},target_company_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(300);
  const all = (data ?? []) as unknown as C[];

  // Kết nối đã hoàn tất mà công ty mình chưa đánh giá
  const completedIds = all.filter((c) => c.status === 'completed').map((c) => c.id);
  let reviewed = new Set<string>();
  if (completedIds.length) {
    const { data: rv } = await supa.from('reviews').select('connection_id').eq('reviewer_company_id', me).in('connection_id', completedIds);
    reviewed = new Set((rv ?? []).map((r: { connection_id: string }) => r.connection_id));
  }

  const groups: Record<string, C[]> = {
    incoming: all.filter((c) => c.status === 'pending' && c.target_company_id === me),
    outgoing: all.filter((c) => c.status === 'pending' && c.requester_company_id === me),
    active: all.filter((c) => c.status === 'accepted'),
    completed: all.filter((c) => c.status === 'completed'),
    all,
  };
  const tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? (groups.incoming.length ? 'incoming' : 'active')) as keyof typeof groups;
  const rows = groups[tab];
  const toReview = groups.completed.filter((c) => !reviewed.has(c.id)).length;

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Kết nối doanh nghiệp</h1>
          <p>Theo dõi yêu cầu hợp tác. Sau khi hoàn tất, hai bên có thể đánh giá nhau để tăng Trust Score.</p>
        </div>
        <a className="btn btn-outline" href="/directory"><svg className="ic"><use href="#ic-search" /></svg> Tìm đối tác</a>
      </div>

      {toReview > 0 && (
        <div className="notice mb-16">
          Bạn có <b>{toReview}</b> hợp tác đã hoàn tất chưa đánh giá. Đánh giá xác thực giúp cả hai bên tăng uy tín.
        </div>
      )}

      <div className="dcard">
        <div className="dtabs">
          {TABS.map((t) => (
            <a key={t.key} className={tab === t.key ? 'active' : ''} href={`/dashboard/connections?tab=${t.key}`}>
              {t.label} <span className="n">{groups[t.key].length}</span>
            </a>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <svg className="ic"><use href="#ic-people" /></svg>
            {all.length === 0 ? 'Chưa có kết nối nào. Vào hồ sơ một doanh nghiệp và bấm “Kết nối” để bắt đầu hợp tác.' : 'Không có kết nối nào trong mục này.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Đối tác</th><th>Ngày</th><th>Trạng thái</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const outgoing = c.requester_company_id === me;
                  const other = outgoing ? c.target : c.requester;
                  const st = CONNECTION_STATUS[c.status];
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          {other?.logo_url ? (
                            <img src={thumb(other.logo_url, 72)} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover' }} />
                          ) : (
                            <span style={{ width: 36, height: 36, borderRadius: 9, background: colorFor(other?.id ?? c.id), color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', flex: 'none' }}>{initials(other?.name ?? '?')}</span>
                          )}
                          <div>
                            {other ? <a href={`/cong-ty/${other.slug}`}><b style={{ color: 'var(--navy)' }}>{other.name}</b></a> : 'Doanh nghiệp'}
                            <div className="muted" style={{ fontSize: 12 }}>
                              {outgoing ? 'Bạn gửi yêu cầu' : 'Gửi yêu cầu cho bạn'}
                              {other && other.verified_tier !== 'none' && ` · ${TIER_LABELS[other.verified_tier]}`}
                              {c.listing && <> · tin <a href={`/marketplace/${c.listing.id}`}>{c.listing.title}</a></>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.completed_at ?? c.created_at)}</td>
                      <td><span className={`badge ${st?.cls ?? 'gray'}`}>{st?.label ?? c.status}</span></td>
                      <td>
                        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {admin && c.status === 'pending' && !outgoing && <ConnActions id={c.id} companyId={me} mode="respond" />}
                          {c.status === 'accepted' && other && (
                            <a className="btn btn-outline btn-sm" href={`/chat?to=${other.id}`}><svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin</a>
                          )}
                          {admin && c.status === 'accepted' && <ConnActions id={c.id} companyId={me} mode="complete" />}
                          {c.status === 'completed' && other && !reviewed.has(c.id) && admin && (
                            <a className="btn btn-orange btn-sm" href={`/cong-ty/${other.slug}#danhgia`}><svg className="ic"><use href="#ic-star" /></svg> Viết đánh giá</a>
                          )}
                          {c.status === 'completed' && reviewed.has(c.id) && <span className="muted" style={{ fontSize: 12.5 }}>Đã đánh giá</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
