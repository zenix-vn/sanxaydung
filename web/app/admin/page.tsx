import Link from 'next/link';
import { requireAdmin, fmtDate, hasRole, type AdminStats } from '@/lib/admin';
import { AUDIT_LABEL } from '@/lib/admin-labels';
import { RankBars, WeeklyColumns } from '@/components/admin/charts';

const KPI: { k: keyof AdminStats; label: string; icon: string; tone?: string; sub?: (s: AdminStats) => string | null }[] = [
  { k: 'companies_total', label: 'Doanh nghiệp', icon: 'ic-building', sub: (s) => `${s.companies_published} công khai · ${s.companies_verified} đã xác minh` },
  { k: 'companies_unclaimed', label: 'Hồ sơ chưa có chủ', icon: 'ic-link', tone: 'o' },
  { k: 'users_total', label: 'Người dùng', icon: 'ic-users', tone: 'g', sub: (s) => (s.users_7d ? `+${s.users_7d} trong 7 ngày` : null) },
  { k: 'listings_open', label: 'Tin đang mở', icon: 'ic-briefcase', sub: (s) => `${s.quotes_total} báo giá` },
  { k: 'connections_completed', label: 'Kết nối hoàn tất', icon: 'ic-check', tone: 'g', sub: (s) => `${s.reviews_total} đánh giá` },
  { k: 'subs_active', label: 'Thuê bao đang chạy', icon: 'ic-coin', tone: 'o' },
];

const QUEUES: { k: keyof AdminStats; href: string; label: string; hint: string }[] = [
  { k: 'verifications_pending', href: '/admin/verifications', label: 'Xác minh pháp lý', hint: 'MST, GPKD, chứng chỉ năng lực' },
  { k: 'claims_pending', href: '/admin/claims', label: 'Yêu cầu nhận hồ sơ', hint: 'Chủ doanh nghiệp xin quản lý' },
  { k: 'registrations_pending', href: '/admin/registrations', label: 'Đăng ký đối tác', hint: 'Từ Google Form / biểu mẫu' },
  { k: 'reports_open', href: '/admin/moderation', label: 'Báo cáo vi phạm', hint: 'Nội dung bị người dùng báo cáo' },
];

const RANGES = [8, 12, 26];
type Week = { week: string; users: number; companies: number; verified: number; quotes: number };
type Insights = {
  weeks: Week[]; funnel: { total: number; claimed: number; verified: number; paid: number | null };
  registrations: { total: number; pending: number; approved: number };
  provinces: { name: string; n: number }[]; categories: { name: string; n: number }[]; no_location: number; no_category: number;
};

export default async function AdminHome({ searchParams }: { searchParams: { w?: string } }) {
  const { supa, role } = await requireAdmin();
  const weeks = RANGES.includes(Number(searchParams.w)) ? Number(searchParams.w) : 12;
  const canAudit = hasRole(role, 'admin');
  const [{ data }, { data: logs }, { data: ins }] = await Promise.all([
    supa.rpc('admin_stats'),
    supa.from('audit_log').select('id, action, entity_type, created_at, profiles:actor_id ( full_name )').order('created_at', { ascending: false }).limit(8),
    supa.rpc('admin_insights', { _weeks: weeks }),
  ]);
  const insights = ins as Insights | null;
  const series = (k: Exclude<keyof Week, 'week'>) => (insights?.weeks ?? []).map((x) => ({ label: `${x.week.slice(8)}/${x.week.slice(5, 7)}`, value: x[k] }));
  const s = data as AdminStats | null;
  if (!s) return <div className="adm-card"><div className="bd">Không tải được số liệu. Kiểm tra migration <code>admin_console</code>.</div></div>;

  const todo = s.verifications_pending + s.claims_pending + s.registrations_pending + s.reports_open;

  return (
    <>
      <div className="adm-h">
        <div>
          <h1>Tổng quan</h1>
          <p>{todo > 0 ? `Có ${todo} mục đang chờ bạn xử lý.` : 'Không có mục nào tồn đọng. Mọi thứ đang ổn 👌'}</p>
        </div>
      </div>

      <div className="adm-kpis">
        {KPI.map((c) => (
          <div className="kpi" key={c.k}>
            <div className={`ico ${c.tone ?? ''}`}><svg className="ic"><use href={`#${c.icon}`} /></svg></div>
            <div>
              <div className="v">{(s[c.k] as number).toLocaleString('vi-VN')}</div>
              <div className="l">{c.label}</div>
              {c.sub?.(s) && <div className="d">{c.sub(s)}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="adm-card" style={{ marginBottom: 16 }}>
        <div className="hd"><h2>Hàng đợi xử lý</h2></div>
        <div className="bd">
          <div className="queue">
            {QUEUES.map((q) => {
              const n = s[q.k] as number;
              return (
                <Link key={q.k} href={q.href}>
                  <div><b>{q.label}</b><small>{q.hint}</small></div>
                  <span className={`n${n > 0 ? ' hot' : ''}`}>{n}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {insights && (
        <>
          <div className="viz-filter" role="group" aria-label="Khoảng thời gian">
            <span>Xu hướng theo tuần</span>
            <nav className="adm-tabs">{RANGES.map((n) => <Link key={n} href={`/admin?w=${n}`} scroll={false} className={n === weeks ? 'on' : ''}>{n} tuần</Link>)}</nav>
          </div>
          <div className="viz-multi">
            <WeeklyColumns title="Người dùng mới" data={series('users')} />
            <WeeklyColumns title="Hồ sơ mới" data={series('companies')} />
            <WeeklyColumns title="Doanh nghiệp được xác minh" data={series('verified')} note="Tính theo ngày quản trị duyệt." />
            <WeeklyColumns title="Báo giá đã gửi" data={series('quotes')} />
          </div>
        </>
      )}

      <div className="adm-grid2">
        <div className="adm-stack">
          {insights && (
            <>
              <RankBars title="Chuyển đổi hồ sơ" hint="Mỗi mốc tính trên tổng số hồ sơ" of={insights.funnel.total}
                data={[
                  { label: 'Hồ sơ trên sàn', value: insights.funnel.total },
                  { label: 'Đã có chủ', value: insights.funnel.claimed },
                  { label: 'Đã xác minh', value: insights.funnel.verified },
                  ...(insights.funnel.paid == null ? [] : [{ label: 'Đang trả phí', value: insights.funnel.paid }]),
                ]}
                footer={<>Đăng ký đối tác từ biểu mẫu: {insights.registrations.total} bản · {insights.registrations.approved} đã duyệt · {insights.registrations.pending} đang chờ.</>} />
              <RankBars title="Tỉnh/thành có nhiều doanh nghiệp" hint="10 nơi dẫn đầu" data={insights.provinces.map((x) => ({ label: x.name, value: x.n }))}
                footer={<>Một doanh nghiệp hoạt động ở nhiều tỉnh được tính ở mỗi tỉnh. {insights.no_location} hồ sơ chưa khai khu vực.</>} />
              <RankBars title="Lĩnh vực phổ biến" hint="10 lĩnh vực dẫn đầu" data={insights.categories.map((x) => ({ label: x.name, value: x.n }))}
                footer={<>Một doanh nghiệp có thể thuộc nhiều lĩnh vực. {insights.no_category} hồ sơ chưa chọn lĩnh vực.</>} />
            </>
          )}
        </div>
        <div className="adm-card">
          <div className="hd"><h2>Hoạt động gần đây</h2>{canAudit && <Link href="/admin/audit" style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 13 }}>Xem tất cả</Link>}</div>
          {!canAudit ? (
            <div className="adm-empty">Nhật ký hoạt động chỉ dành cho quản trị viên.</div>
          ) : (logs ?? []).length === 0 ? (
            <div className="adm-empty">Chưa có hoạt động nào.</div>
          ) : (
            <ul className="adm-log">
              {(logs as unknown as { id: string; action: string; created_at: string; profiles: { full_name: string | null } | null }[]).map((l) => (
                <li key={l.id}>
                  <span><b style={{ color: 'var(--navy)' }}>{AUDIT_LABEL[l.action] ?? l.action}</b><br /><small>{l.profiles?.full_name ?? 'Hệ thống'}</small></span>
                  <small>{fmtDate(l.created_at, true)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
