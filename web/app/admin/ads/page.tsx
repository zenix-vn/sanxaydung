import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, fmtDate } from '@/lib/admin';
import { AD_SLOTS } from '@/lib/admin-labels';
import { Act, Empty } from '@/components/admin/ui';
import AdForm, { type AdRow } from './AdForm';

export const metadata: Metadata = { title: 'Quảng cáo' };

const ctr = (c: number, i: number) => (i ? `${((c / i) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%` : '—');
const nf = new Intl.NumberFormat('vi-VN');

function state(a: AdRow): { l: string; c: string } {
  const now = Date.now();
  if (a.status !== 'active') return { l: 'Tạm dừng', c: '' };
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return { l: 'Đã hết hạn', c: 'r' };
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return { l: 'Chờ đến ngày', c: 'o' };
  return { l: 'Đang chạy', c: 'g' };
}

export default async function AdsPage() {
  const { supa } = await requireAdmin('/admin/ads', 'admin');
  const { data, error } = await supa.rpc('admin_list_ads');
  const ads = (data ?? []) as AdRow[];

  return (
    <>
      <div className="adm-h">
        <div><h1>Quảng cáo</h1><p>Banner ở trang chủ, đầu danh bạ và đầu trang Nhu cầu & Báo giá. Lượt đếm là số tương đối, chưa lọc truy cập tự động.</p></div>
        <AdForm />
      </div>
      <div className="adm-card">
        {error ? <Empty title="Không tải được danh sách" hint={error.message} /> : ads.length === 0 ? <Empty title="Chưa có quảng cáo" hint="Khi chưa có quảng cáo, các vị trí này không hiển thị gì trên trang công khai." /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Quảng cáo</th><th>Vị trí & lịch chạy</th><th>Trạng thái</th><th className="num">Hiển thị</th><th className="num">Nhấp</th><th /></tr></thead>
            <tbody>{ads.map((a) => {
              const s = state(a);
              return (
                <tr key={a.id}>
                  <td><div className="adm-ad"><img src={a.creative_url} alt="" /><div>
                    <b>{a.title ?? '(không tiêu đề)'}</b>
                    <small>{a.company_id ? <Link href={`/admin/companies/${a.company_id}`}>{a.company}</Link> : 'Nội bộ'} · {a.target_url}</small>
                  </div></div></td>
                  <td>{AD_SLOTS[a.slot] ?? a.slot}<br /><small className="muted" style={{ whiteSpace: 'nowrap' }}>{a.starts_at ? fmtDate(a.starts_at) : 'Ngay'} → {a.ends_at ? fmtDate(a.ends_at) : 'không hạn'}</small></td>
                  <td><span className={`bdg ${s.c}`}>{s.l}</span></td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}><b>{nf.format(a.impressions)}</b><br /><small className="muted">30 ngày: {nf.format(a.impressions_30)}</small></td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}><b>{nf.format(a.clicks)}</b><br /><small className="muted">tỉ lệ {ctr(a.clicks, a.impressions)}</small></td>
                  <td><div className="acts">
                    <AdForm ad={a} />
                    {a.status === 'active'
                      ? <Act label="Tạm dừng" fn="admin_set_ad_status" args={{ _id: a.id, _status: 'paused' }} success="Đã tạm dừng" />
                      : <Act label="Chạy lại" tone="p" fn="admin_set_ad_status" args={{ _id: a.id, _status: 'active' }} success="Đã bật lại" />}
                    <Act label="Xóa" tone="d" fn="admin_set_ad_status" args={{ _id: a.id, _status: 'deleted' }} confirm={{ title: 'Xóa quảng cáo?', message: 'Số liệu hiển thị và lượt nhấp cũng bị xóa. Nếu chỉ muốn ngừng chạy, chọn Tạm dừng.', confirmLabel: 'Xóa' }} success="Đã xóa" />
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
