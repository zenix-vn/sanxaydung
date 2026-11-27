import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { GROUP_LABEL } from '@/lib/admin-labels';
import { Act, Empty, Tabs } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Danh mục & tỉnh thành' };

type Cat = { id: string; name: string; slug: string; group_key: string; companies: number; other: number; children: number };
const GROUP_OPTIONS = Object.entries(GROUP_LABEL).map(([value, label]) => ({ value, label }));

export default async function CategoriesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supa } = await requireAdmin('/admin/categories', 'admin');
  const tab = searchParams.tab === 'provinces' ? 'provinces' : 'categories';

  let body: React.ReactNode;
  if (tab === 'categories') {
    const { data, error } = await supa.rpc('admin_list_categories');
    const cats = (data ?? []) as Cat[];
    body = error ? <div className="adm-card"><Empty title="Không tải được danh mục" hint={error.message} /></div> : (
      <div className="adm-stack">
        <div><Act label="Thêm danh mục" icon="ic-plus" tone="o" fn="admin_save_category" args={{ _id: null }} fieldArgs={{ name: '_name', group: '_group' }}
          confirm={{ title: 'Thêm danh mục', confirmLabel: 'Thêm', fields: [{ key: 'name', label: 'Tên danh mục', required: true }, { key: 'group', label: 'Nhóm', type: 'select', options: GROUP_OPTIONS }] }} success="Đã thêm danh mục" /></div>
        {Object.entries(GROUP_LABEL).map(([g, label]) => {
          const list = cats.filter((c) => c.group_key === g);
          return (
            <section className="adm-card" key={g}>
              <div className="hd"><h2>{label}</h2><span className="muted">{list.length} danh mục</span></div>
              <div className="adm-tw"><table className="adm-t">
                <thead><tr><th style={{ width: 96 }}>Thứ tự</th><th>Tên</th><th className="num">Doanh nghiệp</th><th className="num">Tin / dự án / dịch vụ</th><th /></tr></thead>
                <tbody>{list.map((c, i) => (
                  <tr key={c.id}>
                    <td><div className="adm-order">
                      {i > 0 && <Act label="▲" title="Đưa lên" fn="admin_move_category" args={{ _id: c.id, _up: true }} success="Đã đổi thứ tự" />}
                      {i < list.length - 1 && <Act label="▼" title="Đưa xuống" fn="admin_move_category" args={{ _id: c.id, _up: false }} success="Đã đổi thứ tự" />}
                    </div></td>
                    <td><b style={{ color: 'var(--navy)' }}>{c.name}</b><br /><small className="muted">{c.slug}{c.children ? ` · ${c.children} mục con` : ''}</small></td>
                    <td className="num">{c.companies}</td>
                    <td className="num">{c.other}</td>
                    <td><div className="acts">
                      <Act label="Sửa" icon="ic-edit" fn="admin_save_category" args={{ _id: c.id }} fieldArgs={{ name: '_name', group: '_group' }}
                        confirm={{ title: `Sửa “${c.name}”`, message: 'Đường dẫn lọc (slug) giữ nguyên.', confirmLabel: 'Lưu', fields: [{ key: 'name', label: 'Tên danh mục', required: true, defaultValue: c.name }, { key: 'group', label: 'Nhóm', type: 'select', defaultValue: c.group_key, options: GROUP_OPTIONS }] }} success="Đã lưu" />
                      <Act label="Gộp" icon="ic-layers" fn="admin_merge_categories" args={{ _source: c.id }} fieldArgs={{ target: '_target' }}
                        confirm={{ title: `Gộp “${c.name}” vào danh mục khác`, message: `${c.companies} doanh nghiệp cùng tin đăng, dự án, dịch vụ chuyển sang danh mục đích. “${c.name}” bị xóa. Không hoàn tác được từ giao diện.`, confirmLabel: 'Gộp', fields: [{ key: 'target', label: 'Gộp vào', type: 'select', options: cats.filter((x) => x.id !== c.id).map((x) => ({ value: x.id, label: `${GROUP_LABEL[x.group_key]} · ${x.name}` })) }] }} success="Đã gộp danh mục" />
                      {c.companies + c.other + c.children === 0 && <Act label="Xóa" tone="d" fn="admin_delete_category" args={{ _id: c.id }} confirm={{ title: `Xóa “${c.name}”?`, confirmLabel: 'Xóa' }} success="Đã xóa danh mục" />}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </section>
          );
        })}
      </div>
    );
  } else {
    const [{ data: provs }, { data: ins }] = await Promise.all([
      supa.from('provinces').select('code, name').order('name'),
      supa.from('company_locations').select('province_code').limit(10000),
    ]);
    const count = new Map<string, number>();
    ((ins ?? []) as { province_code: string }[]).forEach((x) => count.set(x.province_code, (count.get(x.province_code) ?? 0) + 1));
    body = (
      <div className="adm-card"><div className="adm-tw"><table className="adm-t">
        <thead><tr><th style={{ width: 90 }}>Mã</th><th>Tỉnh/thành</th><th className="num">Doanh nghiệp</th><th /></tr></thead>
        <tbody>{((provs ?? []) as { code: string; name: string }[]).map((p) => (
          <tr key={p.code}>
            <td className="muted">{p.code}</td><td><b style={{ color: 'var(--navy)' }}>{p.name}</b></td><td className="num">{count.get(p.code) ?? 0}</td>
            <td><div className="acts"><Act label="Đổi tên" icon="ic-edit" fn="admin_rename_province" args={{ _code: p.code }} fieldArgs={{ name: '_name' }}
              confirm={{ title: `Đổi tên ${p.name}`, message: 'Mã đơn vị hành chính giữ nguyên.', confirmLabel: 'Lưu', fields: [{ key: 'name', label: 'Tên mới', required: true, defaultValue: p.name }] }} success="Đã đổi tên" /></div></td>
          </tr>
        ))}</tbody>
      </table></div></div>
    );
  }

  return (
    <>
      <div className="adm-h"><div><h1>Danh mục & tỉnh thành</h1><p>Dùng cho bộ lọc danh bạ, form hồ sơ và nhập dữ liệu. Trang công khai cập nhật sau tối đa 1 giờ.</p></div></div>
      <div className="adm-bar"><Tabs base="/admin/categories" param="tab" current={tab} items={[{ key: 'categories', label: 'Ngành nghề' }, { key: 'provinces', label: 'Tỉnh/thành' }]} /></div>
      {body}
    </>
  );
}
