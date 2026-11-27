import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUserCompany } from '@/lib/supabase/company';
import { parseProfileSettings } from '@/lib/profile';
import { parseSiteSettings, siteSubdomain, siteUrl, SITE_ROOT_DOMAIN } from '@/lib/site';
import WebsiteSettings, { CopyUrl } from './WebsiteSettings';

export const metadata: Metadata = { title: 'Website của bạn' };
export const dynamic = 'force-dynamic';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function WebsitePage() {
  const { supa, company, role } = await requireUserCompany('/dashboard/website');
  if (!company) redirect('/dashboard');
  const id = company.id as string;
  const canAdmin = role === 'owner' || role === 'admin';
  const site = parseSiteSettings(company.site_settings);
  const settings = parseProfileSettings(company.profile_settings);
  const c = company as { slug: string; site_subdomain?: string | null; status: string; name: string };
  const sub = siteSubdomain(c);
  const url = siteUrl(c);
  const live = c.status === 'published' && site.enabled && !!url;

  const [projects, services, partners, stats, fresh] = await Promise.all([
    supa.from('projects').select('id', { count: 'exact', head: true }).eq('company_id', id),
    supa.from('services').select('id', { count: 'exact', head: true }).eq('company_id', id),
    supa.from('company_partners').select('id', { count: 'exact', head: true }).eq('company_id', id),
    supa.from('company_stats_daily').select('site_views, leads').eq('company_id', id).gte('day', isoDay(new Date(Date.now() - 29 * 86400000))),
    supa.from('site_leads').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('status', 'new'),
  ]);
  const rows = (stats.data ?? []) as { site_views: number; leads: number }[];
  const views = rows.reduce((a, r) => a + (r.site_views ?? 0), 0);
  const leads = rows.reduce((a, r) => a + (r.leads ?? 0), 0);

  // Gợi ý để website đầy đặn hơn — mỗi mục trỏ về đúng khối trong trang sửa hồ sơ
  const checks = [
    { ok: !!company.logo_url, label: 'Logo', href: '/dashboard/company-edit#media' },
    { ok: !!company.cover_url || !!settings.banner?.images?.length, label: 'Ảnh bìa (ảnh lớn đầu trang chủ)', href: '/dashboard/company-edit#media' },
    { ok: !!settings.tagline, label: 'Khẩu hiệu', href: '/dashboard/company-edit#media' },
    { ok: !!company.intro, label: 'Giới thiệu ngắn', href: '/dashboard/company-edit#intro' },
    { ok: (services.count ?? 0) > 0, label: 'Dịch vụ', href: '/dashboard/company-edit#services' },
    { ok: (projects.count ?? 0) >= 3, label: 'Ít nhất 3 dự án có ảnh (trang Dự án chỉ hiện khi có dự án)', href: '/dashboard/company-edit#projects' },
    { ok: (partners.count ?? 0) > 0, label: 'Khách hàng & đối tác', href: '/dashboard/company-edit#layout' },
    { ok: !!company.phone, label: 'Số điện thoại (nút Gọi & thanh liên hệ trên điện thoại)', href: '/dashboard/company-edit#contact' },
    { ok: !!settings.hours, label: 'Giờ làm việc', href: '/dashboard/company-edit#contact' },
  ];
  const done = checks.filter((x) => x.ok).length;

  return (
    <div>
      <style>{`
        .ws-url{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .ws-url b{font-size:20px;color:var(--navy);word-break:break-all}
        .ws-state{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:20px}
        .ws-state.on{background:var(--green-soft);color:var(--green)}
        .ws-state.off{background:#eef2f6;color:var(--muted)}
        .ws-prev{position:relative;width:100%;aspect-ratio:16/10;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#f4f6f9}
        .ws-prev iframe{position:absolute;left:0;top:0;width:200%;height:200%;border:0;transform:scale(.5);transform-origin:0 0;pointer-events:none}
        .ws-check{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
        .ws-check:last-child{border-bottom:0}
        .ws-check .d{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;background:#eef2f6;color:#fff}
        .ws-check .d.ok{background:var(--green)}
        .ws-check .d svg{width:13px;height:13px}
        .ws-check a{margin-left:auto;color:var(--orange);font-weight:600;white-space:nowrap}
        .ws-kpi{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .ws-kpi div{background:#f8fafc;border-radius:10px;padding:12px 14px}
        .ws-kpi b{display:block;font-size:24px;color:var(--navy)}
        .ws-kpi small{color:var(--muted);font-size:12.5px}
      `}</style>
      <div className="dpage-head">
        <div>
          <h1>Website của bạn</h1>
          <p>Mỗi doanh nghiệp có một website riêng, dùng làm trang giới thiệu chính khi gửi cho khách hàng. Nội dung lấy từ hồ sơ trên sàn — sửa hồ sơ là website cập nhật theo.</p>
        </div>
      </div>

      {c.status !== 'published' && (
        <div className="notice" style={{ marginTop: 0 }}>
          Hồ sơ đang ở bản nháp nên website chưa hoạt động. <a href="/dashboard/company-edit" style={{ fontWeight: 700 }}>Hoàn thiện và xuất bản hồ sơ →</a>
        </div>
      )}

      <div className="grid-side-r" style={{ gap: 20 }}>
        <div>
          <div className="dcard mb-16">
            <div className="ws-url">
              <span className={`ws-state ${live ? 'on' : 'off'}`}>{live ? '● Đang hoạt động' : '○ Chưa hoạt động'}</span>
              <b>{url ? url.replace('https://', '') : '—'}</b>
            </div>
            {live && url && (
              <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <a className="btn btn-orange" href={url} target="_blank" rel="noopener"><svg className="ic"><use href="#ic-globe" /></svg> Mở website</a>
                <CopyUrl url={url} />
              </div>
            )}
          </div>

          <div className="dcard mb-16">
            <h3>Cài đặt</h3>
            <WebsiteSettings
              companyId={id}
              slug={c.slug}
              subdomain={c.site_subdomain ?? ''}
              current={sub}
              enabled={site.enabled}
              rawSettings={(company.site_settings ?? {}) as Record<string, unknown>}
              canAdmin={canAdmin}
              root={SITE_ROOT_DOMAIN}
            />
          </div>

          {sub && c.status === 'published' && site.enabled && (
            <div className="dcard">
              <h3>Xem trước <a href={`/site/${sub}`} target="_blank" rel="noopener" style={{ fontSize: 13, color: 'var(--orange)' }}>Mở toàn màn hình ↗</a></h3>
              <div className="ws-prev"><iframe src={`/site/${sub}`} title="Xem trước website" loading="lazy" tabIndex={-1} /></div>
            </div>
          )}
        </div>

        <aside>
          <div className="dcard mb-16">
            <h3>30 ngày qua</h3>
            <div className="ws-kpi">
              <div><b>{views.toLocaleString('vi-VN')}</b><small>lượt xem website</small></div>
              <div><b>{leads.toLocaleString('vi-VN')}</b><small>yêu cầu báo giá</small></div>
            </div>
            <a className="btn btn-outline btn-block mt-16" href="/dashboard/leads">
              Xem yêu cầu{fresh.count ? ` (${fresh.count} mới)` : ''}
            </a>
          </div>
          <div className="dcard">
            <h3>Hoàn thiện website <small className="muted">{done}/{checks.length}</small></h3>
            {checks.map((x) => (
              <div className="ws-check" key={x.label}>
                <span className={`d${x.ok ? ' ok' : ''}`}>{x.ok && <svg className="ic"><use href="#ic-check" /></svg>}</span>
                <span>{x.label}</span>
                {!x.ok && <a href={x.href}>Thêm</a>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
