import type { Metadata } from 'next';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import MapView, { type ProvStat } from './MapView';

export const metadata: Metadata = {
  title: 'Bản đồ doanh nghiệp xây dựng',
  description: 'Khám phá nhà thầu, đội thi công, nhà cung cấp theo tỉnh thành trên bản đồ Việt Nam.',
  alternates: { canonical: '/ban-do' },
};
export const dynamic = 'force-dynamic'; // dữ liệu đã cache 10 phút qua cachedPublic

const fetchStats = cachedPublic(async (): Promise<ProvStat[]> => {
  const { data, error } = await createSupabasePublic().rpc('province_stats');
  if (error) throw error;
  return (data ?? []) as ProvStat[];
}, 'province-stats', 600);

async function getStats() {
  if (!SUPABASE_URL) return [];
  try {
    return await fetchStats();
  } catch {
    return [];
  }
}

export default async function MapPage() {
  const stats = await getStats();
  const total = stats.reduce((a, s) => a + s.total, 0);
  return (
    <>
      <div className="pagehead">
        <div className="container">
          <div className="crumb"><a href="/">Trang chủ</a><svg className="ic"><use href="#ic-chevron-right" /></svg><span>Bản đồ</span></div>
          <h1>Bản đồ doanh nghiệp xây dựng</h1>
          <p>Điểm càng lớn, càng nhiều doanh nghiệp hoạt động tại tỉnh đó. Bấm vào điểm để xem danh sách.</p>
        </div>
      </div>
      <section className="block" style={{ background: 'var(--bg)', paddingTop: 26 }}>
        <div className="container grid-side-r" style={{ gap: 20 }}>
          <div>{stats.length ? <MapView stats={stats} /> : <div className="card-block"><p className="muted">Chưa có dữ liệu.</p></div>}</div>
          {/* Bảng số liệu — thay thế cho người không xem được bản đồ */}
          <aside className="card-block" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 10 }}>Theo tỉnh/thành</h3>
            <table className="table">
              <thead><tr><th>Tỉnh/thành</th><th style={{ textAlign: 'right' }}>DN</th><th style={{ textAlign: 'right' }}>Xác minh</th></tr></thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.code}>
                    <td><a href={`/directory?province=${s.code}`}>{s.name}</a></td>
                    <td style={{ textAlign: 'right' }}>{s.total}</td>
                    <td style={{ textAlign: 'right' }}>{s.verified}</td>
                  </tr>
                ))}
              </tbody>
              {stats.length > 0 && <tfoot><tr><td><b>Lượt hiện diện</b></td><td style={{ textAlign: 'right' }}><b>{total}</b></td><td /></tr></tfoot>}
            </table>
            <small className="muted">Một doanh nghiệp có thể hoạt động ở nhiều tỉnh.</small>
          </aside>
        </div>
      </section>
    </>
  );
}
