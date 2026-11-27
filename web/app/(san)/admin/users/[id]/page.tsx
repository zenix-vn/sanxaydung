import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, fmtDate, hasRole, ROLE_LABEL, type PlatformRole } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { AUDIT_LABEL, MEMBER_ROLE } from '@/lib/admin-labels';
import { Act, Status, Who } from '@/components/admin/ui';
import { Card, None } from '@/components/admin/card';
import UserActions from '../UserActions';

export const metadata: Metadata = { title: 'Chi tiết người dùng' };

type Detail = {
  id: string; full_name: string | null; phone: string | null; avatar_url: string | null; email: string | null; email_confirmed: boolean; providers: string[];
  created_at: string; last_sign_in_at: string | null; banned: boolean; deleted: boolean; role: PlatformRole | null;
  companies: { id: string; name: string; logo_url: string | null; status: string; role: string; member_status: string; is_owner: boolean; deleted: boolean }[];
  claims: { id: string; company_id: string; company: string; method: string; status: string; note: string | null; created_at: string }[];
  reports_filed: { id: string; entity_type: string; reason: string | null; status: string; created_at: string }[];
  reports_against: number;
  logins: { action: string; ip: string | null; created_at: string }[];
  sessions: { created_at: string; last_seen: string; user_agent: string | null; ip: string | null }[];
  history: { id: string; action: string; actor: string | null; diff: Record<string, unknown> | null; created_at: string }[];
};
const LOGIN: Record<string, string> = { login: 'Đăng nhập', logout: 'Đăng xuất', user_signedup: 'Đăng ký tài khoản' };
const PROVIDER: Record<string, string> = { google: 'Google', email: 'Email', phone: 'Số điện thoại' };

/** "Chrome trên Android" từ chuỗi user-agent. */
function device(ua: string | null) {
  if (!ua) return 'Thiết bị không rõ';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /zalo/i.test(ua) ? 'Zalo' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return br || os ? [br || 'Trình duyệt', os].filter(Boolean).join(' trên ') : ua.slice(0, 60);
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { supa, user: me, role } = await requireAdmin(`/admin/users/${params.id}`, 'admin');
  const { data, error } = await supa.rpc('admin_user_detail', { _user: params.id });
  if (error) throw new Error(error.message);
  const d = data as Detail | null;
  if (!d) notFound();
  const isOwner = hasRole(role, 'owner');
  const self = d.id === me.id;
  const label = d.full_name || d.email || 'Chưa đặt tên';

  const info: [string, React.ReactNode][] = [
    ['Email', d.email && <>{d.email}{!d.email_confirmed && <small className="muted"> · chưa xác thực</small>}</>],
    ['Số điện thoại', d.phone],
    ['Đăng nhập bằng', d.providers.map((p) => PROVIDER[p] ?? p).join(', ')],
    ['Đăng ký', fmtDate(d.created_at, true)],
    ['Đăng nhập gần nhất', d.last_sign_in_at && fmtDate(d.last_sign_in_at, true)],
    ['Báo cáo về người này', d.reports_against ? `${d.reports_against} báo cáo (hồ sơ sở hữu, bài viết, tin đăng)` : 'Không có'],
  ];

  return (
    <>
      <Link href="/admin/users" className="adm-back">← Danh sách người dùng</Link>
      <div className="adm-h adm-co">
        <div className="who">
          <span className="a" style={{ background: colorFor(d.id) }}>{d.avatar_url ? <img src={d.avatar_url} alt="" referrerPolicy="no-referrer" /> : label.slice(0, 1).toUpperCase()}</span>
          <div>
            <h1>{label}{self && ' (bạn)'}</h1>
            <p className="badges">
              <span className={`bdg ${d.role ? 'o' : ''}`}>{ROLE_LABEL[d.role ?? 'member']}</span>
              {d.deleted ? <span className="bdg r">Đã xóa</span> : d.banned ? <span className="bdg r">Bị khóa</span> : <span className="bdg g">Đang hoạt động</span>}
            </p>
          </div>
        </div>
        <div className="acts">
          {isOwner && !d.deleted && <Link className="ab" href={`/admin/users/${d.id}/view`} prefetch={false}><svg className="ic"><use href="#ic-eye" /></svg> Xem như người dùng</Link>}
          <UserActions user={d} label={label} self={self} isOwner={isOwner} />
        </div>
      </div>

      <div className="adm-grid2">
        <div className="adm-stack">
          <Card title="Tài khoản">
            <dl className="adm-dl">{info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">Chưa có</span>}</dd></div>)}</dl>
          </Card>
          <Card title="Doanh nghiệp tham gia">
            {d.companies.length === 0 ? <None>Chưa thuộc doanh nghiệp nào.</None> : (
              <div className="adm-tw"><table className="adm-t"><tbody>{d.companies.map((c) => (
                <tr key={c.id}>
                  <td><Who name={c.name} logo={c.logo_url} color={colorFor(c.id)} href={`/admin/companies/${c.id}`} /></td>
                  <td><span className={`bdg ${c.is_owner ? 'o' : ''}`}>{MEMBER_ROLE[c.role] ?? c.role}</span>{c.member_status === 'invited' && <small className="muted"> đang mời</small>}</td>
                  <td>{c.deleted ? <span className="bdg r">Đã gộp / xóa</span> : <Status s={c.status} />}</td>
                </tr>
              ))}</tbody></table></div>
            )}
          </Card>
          {d.claims.length > 0 && (
            <Card title="Yêu cầu nhận hồ sơ">
              <ul className="adm-log">{d.claims.map((x) => (
                <li key={x.id}>
                  <span><Link href={`/admin/companies/${x.company_id}`} style={{ color: 'var(--navy)', fontWeight: 600 }}>{x.company}</Link><br /><small>{fmtDate(x.created_at, true)}{x.note ? ` · “${x.note}”` : ''}</small></span>
                  <Status s={x.status} />
                </li>
              ))}</ul>
            </Card>
          )}
          {d.history.length > 0 && (
            <Card title="Nhật ký liên quan">
              <ul className="adm-log">{d.history.map((a) => (
                <li key={a.id}>
                  <span><b style={{ color: 'var(--navy)' }}>{AUDIT_LABEL[a.action] ?? a.action}</b><br /><small>{a.actor ?? 'Hệ thống'}{typeof a.diff?.reason === 'string' ? ` · ${a.diff.reason}` : ''}</small></span>
                  <small>{fmtDate(a.created_at, true)}</small>
                </li>
              ))}</ul>
            </Card>
          )}
        </div>
        <div className="adm-stack">
          <Card title="Thiết bị đang đăng nhập" extra={!self && d.sessions.length > 0 && (!d.role || isOwner) && (
            <Act label="Đăng xuất tất cả" tone="d" fn="admin_signout_user" args={{ _user: d.id }}
              confirm={{ title: `Đăng xuất ${label}?`, message: 'Người dùng phải đăng nhập lại trên mọi thiết bị. Phiên đang mở có thể còn hiệu lực tối đa 1 giờ.', confirmLabel: 'Đăng xuất' }} success="Đã đăng xuất mọi thiết bị" />
          )}>
            {d.sessions.length === 0 ? <None>Không có phiên nào đang mở.</None> : (
              <ul className="adm-log">{d.sessions.map((s, i) => (
                <li key={i}>
                  <span><b style={{ color: 'var(--navy)' }}>{device(s.user_agent)}</b><br /><small>{s.ip ? `IP ${s.ip} · ` : ''}đăng nhập {fmtDate(s.created_at, true)}</small></span>
                  <small>{fmtDate(s.last_seen, true)}</small>
                </li>
              ))}</ul>
            )}
          </Card>
          <Card title="Lịch sử đăng nhập">
            {d.logins.length === 0 ? <None>Chưa có dữ liệu.</None> : (
              <ul className="adm-log">{d.logins.map((x, i) => (
                <li key={i}><span>{LOGIN[x.action] ?? x.action}{x.ip && <><br /><small>IP {x.ip}</small></>}</span><small>{fmtDate(x.created_at, true)}</small></li>
              ))}</ul>
            )}
          </Card>
          {d.reports_filed.length > 0 && (
            <Card title="Báo cáo đã gửi" extra={<Link href="/admin/moderation" className="adm-more">Kiểm duyệt</Link>}>
              <ul className="adm-log">{d.reports_filed.map((r) => (
                <li key={r.id}><span>{r.reason ?? 'Không nêu lý do'}<br /><small>{fmtDate(r.created_at, true)}</small></span><Status s={r.status} /></li>
              ))}</ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
