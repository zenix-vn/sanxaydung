import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, hasRole, ROLE_LABEL, PAGE_SIZE, type PlatformRole } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Act, Empty, Pager, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Người dùng & phân quyền' };
type U = {
  id: string; email: string | null; full_name: string | null; phone: string | null; created_at: string; last_sign_in_at: string | null;
  banned: boolean; deleted: boolean; companies: number; role: PlatformRole | null; total: number;
};

const ROLE_BADGE: Record<PlatformRole, string> = { owner: 'o', admin: 'b', moderator: 'g' };
const ROLE_HELP = 'Chủ sở hữu: toàn quyền, phân quyền cho người khác. Quản trị viên: mọi thao tác vận hành, khóa tài khoản. Kiểm duyệt viên: chỉ xử lý xác minh, claim, đăng ký đối tác và kiểm duyệt nội dung.';
const FILTERS = [
  { v: '', l: 'Tất cả' }, { v: 'staff', l: 'Nhân sự quản trị' }, { v: 'owner', l: ROLE_LABEL.owner },
  { v: 'admin', l: ROLE_LABEL.admin }, { v: 'moderator', l: ROLE_LABEL.moderator }, { v: 'banned', l: 'Bị khóa' },
];

export default async function UsersPage({ searchParams }: { searchParams: { q?: string; f?: string; page?: string } }) {
  const { supa, user: me, role: myRole } = await requireAdmin('/admin/users', 'admin');
  const q = (searchParams.q ?? '').trim();
  const f = FILTERS.some((x) => x.v === searchParams.f) ? searchParams.f ?? '' : '';
  const { page, from } = pageOf(searchParams);
  const { data, error } = await supa.rpc('admin_list_users', { _q: q || null, _limit: PAGE_SIZE, _offset: from, _filter: f || null });
  const rows = (data ?? []) as U[];
  const total = rows[0]?.total ?? 0;
  const isOwner = hasRole(myRole, 'owner');

  return (
    <>
      <div className="adm-h"><div>
        <h1>Người dùng & phân quyền</h1>
        <p>Tài khoản đã đăng ký. Thông tin chỉ để tra cứu hỗ trợ — không chia sẻ ra ngoài.{!isOwner && ' Chỉ Chủ sở hữu mới phân quyền được.'}</p>
      </div></div>
      <form className="adm-bar adm-search" action="/admin/users">
        <input name="q" defaultValue={q} placeholder="Tên, email hoặc SĐT…" aria-label="Tìm kiếm" style={{ flex: '1 1 280px' }} />
        <select name="f" defaultValue={f} aria-label="Lọc theo vai trò">{FILTERS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>
        <button className="ab o" type="submit">Lọc</button>
        {(q || f) && <a className="ab" href="/admin/users">Xóa lọc</a>}
      </form>
      <div className="adm-card">
        {error ? <Empty title="Không tải được danh sách" hint={error.message} /> : rows.length === 0 ? <Empty title="Không tìm thấy người dùng" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Người dùng</th><th>SĐT</th><th className="num">Doanh nghiệp</th><th>Đăng ký</th><th>Đăng nhập gần nhất</th><th>Vai trò</th><th /></tr></thead>
            <tbody>{rows.map((u) => {
              const self = u.id === me.id;
              const label = u.full_name || u.email || 'Chưa đặt tên';
              return (
                <tr key={u.id}>
                  <td><Who name={self ? `${label} (bạn)` : label} sub={u.email} color={colorFor(u.id)} /></td>
                  <td>{u.phone ?? '—'}</td>
                  <td className="num">{u.companies}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>{fmtDate(u.last_sign_in_at, true)}</td>
                  <td>
                    {u.deleted ? <span className="bdg">Đã xóa</span>
                      : u.role ? <span className={`bdg ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                      : <span className="muted">{ROLE_LABEL.member}</span>}
                    {u.banned && !u.deleted && <> <span className="bdg r">Bị khóa</span></>}
                  </td>
                  <td><div className="acts">
                    {isOwner && !self && !u.deleted && !u.banned && (
                      <Act label="Phân quyền" icon="ic-shield-check" fn="admin_set_user_role" args={{ _user: u.id }} fieldArgs={{ role: '_role' }}
                        confirm={{
                          title: `Phân quyền · ${label}`, message: ROLE_HELP, confirmLabel: 'Lưu',
                          fields: [{ key: 'role', label: 'Vai trò', type: 'select', defaultValue: u.role ?? 'member', options: [
                            { value: 'member', label: ROLE_LABEL.member }, { value: 'moderator', label: ROLE_LABEL.moderator },
                            { value: 'admin', label: ROLE_LABEL.admin }, { value: 'owner', label: ROLE_LABEL.owner },
                          ] }],
                        }} success="Đã cập nhật vai trò" />
                    )}
                    {!self && !u.deleted && !u.role && (u.banned ? (
                      <Act label="Mở khóa" tone="p" fn="admin_set_user_banned" args={{ _user: u.id, _ban: false }}
                        confirm={{ title: `Mở khóa ${label}?`, message: 'Người dùng đăng nhập lại được bình thường.', confirmLabel: 'Mở khóa' }} success="Đã mở khóa" />
                    ) : (
                      <Act label="Khóa" tone="d" fn="admin_set_user_banned" args={{ _user: u.id, _ban: true }} fieldArgs={{ reason: '_reason' }}
                        confirm={{ title: `Khóa tài khoản ${label}?`, message: 'Đăng xuất khỏi mọi thiết bị và không đăng nhập lại được cho tới khi mở khóa. Hồ sơ doanh nghiệp của họ vẫn giữ nguyên.', confirmLabel: 'Khóa tài khoản', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã khóa tài khoản" />
                    ))}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Pager base="/admin/users" params={{ q, f }} page={page} total={Number(total)} size={PAGE_SIZE} />
      </div>
    </>
  );
}
