import Link from 'next/link';
import { requireAdmin, fmtDate, type AdminStats } from '@/lib/admin';

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

const ACTION_LABEL: Record<string, string> = {
  'verification.approved': 'Duyệt xác minh', 'verification.rejected': 'Từ chối xác minh',
  'company.claim_approved': 'Duyệt claim hồ sơ', 'company.claim_rejected': 'Từ chối claim hồ sơ',
  'company.status_suspended': 'Đình chỉ doanh nghiệp', 'company.status_published': 'Công khai doanh nghiệp',
  'moderation.hide': 'Ẩn nội dung', 'moderation.restore': 'Khôi phục nội dung',
  'subscription.granted': 'Cấp gói', 'subscription.cancelled': 'Hủy gói',
};

export default async function AdminHome() {
  const { supa } = await requireAdmin();
  const [{ data }, { data: logs }] = await Promise.all([
    supa.rpc('admin_stats'),
    supa.from('audit_log').select('id, action, entity_type, created_at, profiles:actor_id ( full_name )').order('created_at', { ascending: false }).limit(8),
  ]);
  const s = data as AdminStats | null;
  if (!s) return <div className="adm-card"><div className="bd">Không tải được số liệu. Kiểm tra migration <code>admin_console</code>.</div></div>;

  const max = Math.max(1, ...s.series.map((d) => d.users + d.companies));
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

      <div className="adm-grid2">
        <div className="adm-card">
          <div className="hd"><h2>Đăng ký mới · 14 ngày qua</h2><span className="muted">Người dùng + doanh nghiệp</span></div>
          <div className="bd">
            <div className="adm-chart" role="img" aria-label="Biểu đồ đăng ký mới 14 ngày">
              {s.series.map((d) => {
                const v = d.users + d.companies;
                return (
                  <div className="col" key={d.day} title={`${fmtDate(d.day)}: ${d.users} người dùng, ${d.companies} doanh nghiệp, ${d.listings} tin`}>
                    <div className="bar" style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />
                    <small>{d.day.slice(8)}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="adm-card">
          <div className="hd"><h2>Hoạt động gần đây</h2><Link href="/admin/audit" style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 13 }}>Xem tất cả</Link></div>
          {(logs ?? []).length === 0 ? (
            <div className="adm-empty">Chưa có hoạt động nào.</div>
          ) : (
            <ul className="adm-log">
              {(logs as unknown as { id: string; action: string; created_at: string; profiles: { full_name: string | null } | null }[]).map((l) => (
                <li key={l.id}>
                  <span><b style={{ color: 'var(--navy)' }}>{ACTION_LABEL[l.action] ?? l.action}</b><br /><small>{l.profiles?.full_name ?? 'Hệ thống'}</small></span>
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
