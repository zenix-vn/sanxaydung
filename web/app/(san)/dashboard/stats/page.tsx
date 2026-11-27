import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import LineChart from '@/components/LineChart';

export const metadata: Metadata = { title: 'Thống kê hồ sơ' };
export const dynamic = 'force-dynamic';

type Row = { day: string; views: number; contacts: number; impressions: number; site_views: number; leads: number };
const KEYS = [
  { key: 'impressions', label: 'Hiển thị trong danh bạ', hint: 'Số lần hồ sơ xuất hiện trong kết quả tìm kiếm' },
  { key: 'views', label: 'Lượt xem hồ sơ', hint: 'Số lượt mở trang hồ sơ công khai' },
  { key: 'contacts', label: 'Lượt liên hệ', hint: 'Bấm gọi, nhắn tin, email trên hồ sơ và website' },
  { key: 'site_views', label: 'Lượt xem website', hint: 'Số lượt mở website <tên>.sanxaydung.vn' },
  { key: 'leads', label: 'Yêu cầu từ website', hint: 'Số yêu cầu báo giá khách gửi qua form trên website' },
] as const;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function StatsPage({ searchParams }: { searchParams: { days?: string } }) {
  const { supa, company } = await requireUserCompany('/dashboard/stats');
  if (!company) return null;
  const days = searchParams.days === '90' ? 90 : 30;
  const start = new Date(Date.now() - (2 * days - 1) * 86400000);
  const { data } = await supa
    .from('company_stats_daily')
    .select('day, views, contacts, impressions, site_views, leads')
    .eq('company_id', company.id)
    .gte('day', isoDay(start))
    .order('day');
  const byDay = new Map(((data ?? []) as Row[]).map((r) => [r.day, r]));

  // Đủ mọi ngày (ngày không có dữ liệu = 0); nửa đầu = kỳ trước để so sánh
  const all: Row[] = Array.from({ length: 2 * days }, (_, i) => {
    const d = isoDay(new Date(start.getTime() + i * 86400000));
    return byDay.get(d) ?? { day: d, views: 0, contacts: 0, impressions: 0, site_views: 0, leads: 0 };
  });
  const prev = all.slice(0, days);
  const cur = all.slice(days);
  const sum = (rs: Row[], k: keyof Omit<Row, 'day'>) => rs.reduce((a, r) => a + r[k], 0);
  const totals = Object.fromEntries(KEYS.map((k) => [k.key, { now: sum(cur, k.key), before: sum(prev, k.key) }])) as Record<string, { now: number; before: number }>;
  const rate = totals.views.now ? ((totals.contacts.now / totals.views.now) * 100).toFixed(1) : null;

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Thống kê hồ sơ</h1>
          <p>Mức độ khách hàng tìm thấy và quan tâm tới {company.name as string} trong {days} ngày qua.</p>
        </div>
        <div className="dtabs" style={{ marginBottom: 0 }}>
          <a className={days === 30 ? 'active' : ''} href="/dashboard/stats">30 ngày</a>
          <a className={days === 90 ? 'active' : ''} href="/dashboard/stats?days=90">90 ngày</a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginBottom: 24 }}>
        {KEYS.map((k) => {
          const t = totals[k.key];
          const d = t.before ? Math.round(((t.now - t.before) / t.before) * 100) : null;
          return (
            <div key={k.key} className="dcard" title={k.hint}>
              <small className="muted">{k.label}</small>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{t.now.toLocaleString('vi-VN')}</div>
              <small className="muted">
                {d == null ? 'Chưa có kỳ trước để so sánh' : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}% so với ${days} ngày trước`}
              </small>
            </div>
          );
        })}
        <div className="dcard" title="Lượt liên hệ / lượt xem">
          <small className="muted">Tỷ lệ liên hệ</small>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{rate != null ? `${rate}%` : '—'}</div>
          <small className="muted">trên mỗi lượt xem hồ sơ</small>
        </div>
      </div>

      {KEYS.map((k) => (
        <div key={k.key} className="dcard mb-24">
          <h3>{k.label}<small className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>{k.hint}</small></h3>
          <LineChart points={cur.map((r) => ({ date: r.day, value: r[k.key] }))} label={k.label} />
        </div>
      ))}

      <div className="pill-note">
        <svg className="ic"><use href="#ic-trending" /></svg>
        <span>
          Tăng lượt hiển thị: hoàn thiện hồ sơ, xác minh doanh nghiệp và thêm dự án — Trust Score cao được xếp trên trong danh bạ.{' '}
          <a href="/dashboard/trust" style={{ color: 'var(--orange)', fontWeight: 600 }}>Xem Trust Score →</a>
        </span>
      </div>
    </div>
  );
}
