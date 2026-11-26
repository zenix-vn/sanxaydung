import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import LineChart, { type Point } from '@/components/LineChart';

export const metadata: Metadata = { title: 'Trust Score' };
export const dynamic = 'force-dynamic';

// Khớp compute_trust_score (supabase/migrations/..._functions_triggers.sql)
const PARTS = [
  {
    key: 'verification', label: 'Xác minh pháp lý & năng lực', max: 20,
    tip: (v: number) => (v >= 20 ? 'Đã đạt tối đa.' : v >= 14 ? 'Nộp chứng chỉ năng lực hoạt động xây dựng để đạt 20 điểm.' : 'Xác minh MST/GPKD (+14) và chứng chỉ năng lực (+20).'),
    href: '/dashboard/verify', cta: 'Xác minh',
  },
  {
    key: 'reviews', label: 'Đánh giá từ đối tác', max: 30,
    tip: (v: number) => (v >= 27 ? 'Rất tốt — tiếp tục duy trì chất lượng.' : 'Hoàn tất các hợp tác và mời đối tác đánh giá; điểm tính theo trung bình sao.'),
    href: '/dashboard/connections?tab=completed', cta: 'Xem kết nối',
  },
  {
    key: 'projects', label: 'Dự án portfolio', max: 15,
    tip: (v: number) => (v >= 15 ? 'Đã đạt tối đa.' : `Mỗi dự án +2 điểm — thêm ${Math.ceil((15 - v) / 2)} dự án nữa để đạt tối đa.`),
    href: '/dashboard/company-edit#projects', cta: 'Thêm dự án',
  },
  {
    key: 'completeness', label: 'Độ hoàn thiện hồ sơ', max: 10,
    tip: (v: number) => (v >= 10 ? 'Đã đạt tối đa.' : 'Bổ sung logo, mô tả, lĩnh vực, khu vực, liên hệ để tăng điểm.'),
    href: '/dashboard/company-edit', cta: 'Hoàn thiện hồ sơ',
  },
];
const MAX = PARTS.reduce((a, p) => a + p.max, 0);

export default async function TrustPage() {
  const { supa, company } = await requireUserCompany('/dashboard/trust');
  if (!company) return null;
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const [{ data: ts }, { data: hist }] = await Promise.all([
    supa.from('trust_scores').select('score, breakdown, computed_at').eq('company_id', company.id).maybeSingle(),
    supa.from('trust_score_history').select('score, created_at').eq('company_id', company.id).gte('created_at', since).order('created_at').limit(2000),
  ]);
  const score = Number(ts?.score ?? company.trust_score ?? 0);
  const bd = (ts?.breakdown ?? {}) as Record<string, number>;

  // Một điểm mỗi ngày (giá trị cuối ngày)
  const byDay = new Map<string, number>();
  for (const h of (hist ?? []) as { score: number; created_at: string }[]) byDay.set(h.created_at.slice(0, 10), Number(h.score));
  const points: Point[] = Array.from(byDay, ([date, s]) => ({ date, value: Math.round(s * 10) / 10 }));
  const first = points[0]?.value;
  const delta = first != null ? Math.round((score - first) * 10) / 10 : null;

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Trust Score</h1>
          <p>Điểm uy tín hiển thị trên hồ sơ công khai và ảnh hưởng thứ hạng trong danh bạ.</p>
        </div>
        <a className="btn btn-outline" href="/trust-score">Cách tính điểm</a>
      </div>

      <div className="grid-side-r" style={{ gap: 20 }}>
        <div>
          <div className="dcard mb-24">
            <div className="row" style={{ gap: 24, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{Math.round(score * 10) / 10}</div>
                <small className="muted">trên tối đa {MAX} điểm</small>
              </div>
              {delta != null && points.length > 1 && (
                <span className={`badge ${delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray'}`}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {delta > 0 ? '+' : ''}{delta} điểm trong 6 tháng qua
                </span>
              )}
            </div>
            <LineChart points={points} max={MAX} label="Trust Score theo thời gian" unit={` / ${MAX}`} empty="Chưa đủ dữ liệu để vẽ biểu đồ — điểm được ghi lại mỗi khi hồ sơ, xác minh hoặc đánh giá thay đổi." />
          </div>

          <div className="dcard">
            <h3>Chi tiết điểm</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Thành phần</th><th style={{ width: '38%' }}>Mức đạt</th><th>Điểm</th></tr></thead>
                <tbody>
                  {PARTS.map((p) => {
                    const v = Number(bd[p.key] ?? 0);
                    return (
                      <tr key={p.key}>
                        <td>{p.label}</td>
                        <td>
                          <div className="progress" aria-hidden><div className="bar" style={{ width: `${Math.min(100, (v / p.max) * 100)}%` }} /></div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}><b>{v}</b> / {p.max}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="dcard">
          <h3>Gợi ý tăng điểm</h3>
          {PARTS.map((p) => {
            const v = Number(bd[p.key] ?? 0);
            const done = v >= p.max;
            return (
              <div key={p.key} className={`todo ${done ? 'done' : ''}`} style={{ alignItems: 'flex-start' }}>
                <span className="ck">{done && <svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg>}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13.5, color: 'var(--navy)' }}>{p.label}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>{p.tip(v)}</div>
                </div>
                {!done && <a href={p.href}>{p.cta}</a>}
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
