import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Empty, Pager, Status, Who } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Chất lượng dữ liệu' };

const ISSUES: [string, string, string][] = [
  ['dup_phone', 'Trùng số điện thoại', 'Mở một hồ sơ trong nhóm rồi dùng "Gộp vào hồ sơ này".'],
  ['dup_tax', 'Trùng mã số thuế', 'Có thể là chi nhánh, hoặc hồ sơ trùng cần gộp.'],
  ['bad_phone', 'Thiếu / sai SĐT', 'Số điện thoại là khóa chống trùng và để chủ doanh nghiệp nhận hồ sơ.'],
  ['no_category', 'Chưa có lĩnh vực', 'Không xuất hiện khi khách lọc theo ngành.'],
  ['no_location', 'Chưa có khu vực', 'Không xuất hiện khi khách lọc theo tỉnh.'],
  ['no_intro', 'Chưa có giới thiệu', 'Hồ sơ khó được tìm thấy bằng từ khóa.'],
  ['no_logo', 'Chưa có logo', 'Mời chủ doanh nghiệp bổ sung.'],
  ['stale', 'Hơn 180 ngày chưa cập nhật', 'Nên liên hệ xác nhận thông tin còn đúng.'],
];
type Item = { id: string; name: string; logo_url: string | null; phone: string | null; tax_code: string | null; status: string; has_owner: boolean; completeness: number | null; updated_at: string };
type Data = { total: number; counts: Record<string, number>; items: Item[] };

export default async function QualityPage({ searchParams }: { searchParams: { issue?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/quality', 'admin');
  const issue = ISSUES.find(([k]) => k === searchParams.issue) ?? ISSUES[0];
  const { page, from } = pageOf(searchParams);
  const { data, error } = await supa.rpc('admin_quality', { _issue: issue[0], _limit: PAGE_SIZE, _offset: from });
  const d = data as Data | null;
  const items = d?.items ?? [];

  return (
    <>
      <div className="adm-h"><div><h1>Chất lượng dữ liệu</h1><p>{d ? `Rà soát ${d.total.toLocaleString('vi-VN')} hồ sơ doanh nghiệp.` : ''} Chọn một vấn đề để xử lý.</p></div></div>
      <nav className="adm-issues" aria-label="Loại vấn đề">
        {ISSUES.map(([k, label]) => (
          <Link key={k} href={`/admin/quality?issue=${k}`} className={k === issue[0] ? 'on' : ''} aria-current={k === issue[0] ? 'page' : undefined}>
            <b className={d?.counts[k] ? '' : 'ok'}>{d?.counts[k] ?? 0}</b><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="adm-card">
        <div className="hd"><h2>{issue[1]}</h2><span className="muted">{issue[2]}</span></div>
        {error ? <Empty title="Không tải được danh sách" hint={error.message} /> : items.length === 0 ? <Empty title="Không có hồ sơ nào gặp vấn đề này" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Doanh nghiệp</th><th>SĐT</th><th>MST</th><th className="num">Hoàn thiện</th><th>Chủ</th><th>Cập nhật</th><th /></tr></thead>
            <tbody>{items.map((c) => (
              <tr key={c.id}>
                <td><Who name={c.name} logo={c.logo_url} color={colorFor(c.id)} href={`/admin/companies/${c.id}`} />{c.status !== 'published' && <Status s={c.status} />}</td>
                <td>{c.phone ?? <span className="muted">—</span>}</td>
                <td>{c.tax_code ?? <span className="muted">—</span>}</td>
                <td className="num">{c.completeness ?? 0}%</td>
                <td>{c.has_owner ? <span className="bdg g">Đã có</span> : <span className="bdg o">Chưa có</span>}</td>
                <td>{fmtDate(c.updated_at)}</td>
                <td><div className="acts"><Link className="ab" href={`/admin/companies/${c.id}`}>Xử lý</Link></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/quality" params={{ issue: issue[0] }} page={page} total={d?.counts[issue[0]] ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
