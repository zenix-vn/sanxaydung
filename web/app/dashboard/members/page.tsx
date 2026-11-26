import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { canAdmin } from '@/lib/roles';
import { fmtDate, ROLE_LABELS } from '@/lib/format';
import { colorFor, initials } from '@/lib/ui';
import { InviteForm, MemberRow, RevokeInvite } from './MemberActions';

export const metadata: Metadata = { title: 'Thành viên & phân quyền' };
export const dynamic = 'force-dynamic';

type M = { id: string; user_id: string; role: string; created_at: string; profiles: { full_name: string | null; avatar_url: string | null } | null };
type Inv = { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; created_at: string };

const ORDER = ['owner', 'admin', 'editor', 'member'];

export default async function MembersPage() {
  const { supa, user, company, role } = await requireUserCompany('/dashboard/members');
  if (!company) return null;
  const manage = canAdmin({ role: role ?? 'member' });

  const [{ data: mRaw }, { data: iRaw }] = await Promise.all([
    supa
      .from('company_members')
      .select('id, user_id, role, created_at, profiles ( full_name, avatar_url )')
      .eq('company_id', company.id)
      .eq('status', 'active'),
    manage
      ? supa
          .from('company_invitations')
          .select('id, email, role, expires_at, accepted_at, created_at')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);
  const members = ((mRaw ?? []) as unknown as M[]).sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.created_at.localeCompare(b.created_at));
  const invites = (iRaw ?? []) as Inv[];
  const now = Date.now();
  const pending = invites.filter((i) => !i.accepted_at && new Date(i.expires_at).getTime() > now);
  const history = invites.filter((i) => !pending.includes(i)).slice(0, 10);

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Thành viên &amp; phân quyền</h1>
          <p>Mời đồng nghiệp cùng quản lý hồ sơ, tin đăng và báo giá của {company.name as string}.</p>
        </div>
      </div>

      <div className="grid-side-r" style={{ gap: 20 }}>
        <div className="dcard">
          <h3>Thành viên ({members.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Người dùng</th><th>Tham gia</th><th style={{ textAlign: 'right' }}>Vai trò</th></tr></thead>
              <tbody>
                {members.map((m) => {
                  const name = m.profiles?.full_name || 'Thành viên';
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          {m.profiles?.avatar_url ? (
                            <img src={m.profiles.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(m.user_id), color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{initials(name)}</span>
                          )}
                          <span>{name}{m.user_id === user.id && <span className="muted"> (bạn)</span>}</span>
                        </div>
                      </td>
                      <td>{fmtDate(m.created_at)}</td>
                      <td><MemberRow id={m.id} role={m.role} self={m.user_id === user.id} canManage={manage} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside>
          {manage ? (
            <>
              <div className="dcard mb-24">
                <h3>Mời thành viên</h3>
                <InviteForm companyId={company.id as string} />
              </div>
              <div className="dcard">
                <h3>Lời mời đang chờ ({pending.length})</h3>
                {pending.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>Không có lời mời nào đang chờ.</p>
                ) : (
                  pending.map((i) => (
                    <div key={i.id} className="act-row">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.email}</div>
                        <small className="muted" style={{ marginLeft: 0 }}>{ROLE_LABELS[i.role] ?? i.role} · hết hạn {fmtDate(i.expires_at)}</small>
                      </div>
                      <span style={{ marginLeft: 'auto' }}><RevokeInvite id={i.id} /></span>
                    </div>
                  ))
                )}
                {history.length > 0 && (
                  <details style={{ marginTop: 12, fontSize: 13 }}>
                    <summary className="muted" style={{ cursor: 'pointer' }}>Lịch sử lời mời</summary>
                    {history.map((i) => (
                      <div key={i.id} className="act-row">
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.email}</span>
                        <small>{i.accepted_at ? `Đã nhận ${fmtDate(i.accepted_at)}` : 'Hết hạn / thu hồi'}</small>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            </>
          ) : (
            <div className="dcard">
              <p className="muted" style={{ fontSize: 13 }}>Chỉ chủ sở hữu hoặc quản trị viên của doanh nghiệp mới mời và phân quyền thành viên.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
