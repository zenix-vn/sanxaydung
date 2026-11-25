import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Empty, Pager, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Người dùng' };
type U = { id: string; email: string | null; full_name: string | null; phone: string | null; created_at: string; last_sign_in_at: string | null; banned: boolean; companies: number; is_admin: boolean; total: number };

export default async function UsersPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/users');
  const q = (searchParams.q ?? '').trim();
  const { page, from } = pageOf(searchParams);
  const { data, error } = await supa.rpc('admin_list_users', { _q: q || null, _limit: PAGE_SIZE, _offset: from });
  const rows = (data ?? []) as U[];
  const total = rows[0]?.total ?? 0;

  return (
    <>
      <div className="adm-h"><div><h1>Người dùng</h1><p>Tài khoản đã đăng ký. Thông tin chỉ để tra cứu hỗ trợ — không chia sẻ ra ngoài.</p></div></div>
      <form className="adm-bar adm-search" action="/admin/users">
        <input name="q" defaultValue={q} placeholder="Tên, email hoặc SĐT…" aria-label="Tìm kiếm" style={{ flex: '1 1 280px' }} />
        <button className="ab o" type="submit">Tìm</button>
        {q && <a className="ab" href="/admin/users">Xóa lọc</a>}
      </form>
      <div className="adm-card">
        {error ? <Empty title="Không tải được danh sách" hint={error.message} /> : rows.length === 0 ? <Empty title="Không tìm thấy người dùng" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Người dùng</th><th>SĐT</th><th className="num">Doanh nghiệp</th><th>Đăng ký</th><th>Đăng nhập gần nhất</th><th>Vai trò</th></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.id}>
                <td><Who name={u.full_name || u.email || 'Chưa đặt tên'} sub={u.email} color={colorFor(u.id)} /></td>
                <td>{u.phone ?? '—'}</td>
                <td className="num">{u.companies}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>{fmtDate(u.last_sign_in_at, true)}</td>
                <td>{u.is_admin && <span className="bdg o">Quản trị</span>} {u.banned && <span className="bdg r">Bị khóa</span>}{!u.is_admin && !u.banned && <span className="muted">Thành viên</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/users" params={{ q }} page={page} total={Number(total)} size={PAGE_SIZE} />
      </div>
    </>
  );
}
