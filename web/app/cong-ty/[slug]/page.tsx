import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { CompanyDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TIER_COLORS: Record<string, string> = {
  gold: '#c08a1a',
  capability: '#0d6b3f',
  legal: '#12439c',
  none: '#555',
};

function initials(name: string) {
  return name
    .split(' ')
    .filter((w) => w.length > 1)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function fmtPhone(phone: string | null) {
  if (!phone) return null;
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
}

async function getCompany(slug: string): Promise<CompanyDetail | null> {
  if (!SUPABASE_URL) return null;
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('companies')
      .select(
        `*,
         company_categories ( categories (*) ),
         company_locations ( provinces (*) ),
         projects ( * ),
         trust_scores ( score, breakdown )`,
      )
      .eq('slug', slug)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle();
    return (data as CompanyDetail) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCompany(params.slug);
  if (!c) return { title: 'Không tìm thấy doanh nghiệp' };
  return {
    title: c.name,
    description: c.intro ?? c.description ?? `Hồ sơ năng lực ${c.name} trên Sàn Xây Dựng.`,
    openGraph: { title: c.name, description: c.intro ?? '', images: c.logo_url ? [c.logo_url] : [] },
  };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const c = await getCompany(params.slug);
  if (!c) notFound();

  const cats = (c.company_categories ?? []).map((x) => x.categories?.name).filter(Boolean);
  const provs = (c.company_locations ?? []).map((x) => x.provinces?.name).filter(Boolean);
  const rawScore = c.trust_scores?.score ?? c.trust_score ?? 0;
  const trust = Math.round(rawScore);
  const breakdown = c.trust_scores?.breakdown ?? {};
  const ini = initials(c.name);
  const logoColor = TIER_COLORS[c.verified_tier] ?? '#12439c';

  return (
    <>
      {/* Cover */}
      <div
        style={{
          height: 220,
          background: c.cover_url
            ? `linear-gradient(rgba(2,30,72,.3),rgba(2,30,72,.1)),url(${c.cover_url}) center/cover`
            : 'linear-gradient(120deg,rgba(2,30,72,.9),rgba(2,30,72,.6)),url(https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80) center/cover',
        }}
      />

      {/* Profile head */}
      <div className="profile-head">
        <div className="container">
          <div className="ph-inner">
            {/* Logo */}
            <div className="ph-logo" style={{ background: logoColor }}>
              {c.logo_url ? <img src={c.logo_url} alt={c.name} /> : ini}
            </div>

            {/* Name + badges + meta */}
            <div className="ph-main">
              <h1>{c.name}</h1>
              <div className="ph-badges">
                {c.verified_tier === 'gold' && (
                  <span className="verify gold">
                    <svg className="ic"><use href="#ic-star-f" /></svg> Đối tác vàng
                  </span>
                )}
                {(c.verified_tier === 'capability' || c.verified_tier === 'gold') && (
                  <span className="verify capability">
                    <svg className="ic"><use href="#ic-award" /></svg> Chứng chỉ năng lực
                  </span>
                )}
                {c.verified_tier !== 'none' && (
                  <span className="verify legal">
                    <svg className="ic"><use href="#ic-shield-check" /></svg> Xác minh pháp lý
                  </span>
                )}
                {c.verified_tier === 'none' && (
                  <span className="badge gray">Chưa xác minh</span>
                )}
              </div>
              <div className="ph-meta">
                {cats[0] && (
                  <span>
                    <svg className="ic"><use href="#ic-briefcase" /></svg> {cats.join(', ')}
                  </span>
                )}
                {provs[0] && (
                  <span>
                    <svg className="ic"><use href="#ic-pin" /></svg> {provs.join(', ')}
                  </span>
                )}
                {c.size_range && (
                  <span>
                    <svg className="ic"><use href="#ic-users" /></svg> {c.size_range}
                  </span>
                )}
                {c.founded_year && (
                  <span>
                    <svg className="ic"><use href="#ic-clock" /></svg> Thành lập {c.founded_year}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="ph-actions">
              <a className="btn btn-outline" href={`/marketplace?company=${c.id}`}>
                <svg className="ic"><use href="#ic-plus" /></svg> Kết nối &amp; mời báo giá
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky tabs */}
      <div className="sticky-tabs">
        <div className="container">
          <nav className="tabs">
            <a className="active" href="#gioithieu">Giới thiệu</a>
            {(c.projects?.length ?? 0) > 0 && (
              <a href="#duan">Dự án ({c.projects!.length})</a>
            )}
            <a href="#danhgia">Đánh giá</a>
            <a href="#tailieu">Hồ sơ năng lực</a>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <section className="block" style={{ paddingTop: 24, background: 'var(--bg)' }}>
        <div className="container grid-side-r">

          {/* ── LEFT MAIN ── */}
          <div>

            {/* Giới thiệu */}
            <div className="card-block" id="gioithieu">
              <h2>Giới thiệu</h2>
              {c.intro || c.description ? (
                <p className="prose">{c.intro ?? c.description}</p>
              ) : (
                <p className="muted">Chưa có thông tin giới thiệu.</p>
              )}
              {c.profile_completeness > 0 && (
                <div className="grid-4 mt-16" style={{ gap: 12 }}>
                  <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                    <div className="num">{c.projects?.length ?? 0}</div>
                    <div className="lbl">Dự án</div>
                  </div>
                  {c.founded_year && (
                    <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                      <div className="num">{new Date().getFullYear() - c.founded_year}</div>
                      <div className="lbl">Năm kinh nghiệm</div>
                    </div>
                  )}
                  <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                    <div className="num">{trust}</div>
                    <div className="lbl">Trust Score</div>
                  </div>
                  <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                    <div className="num">{c.profile_completeness}%</div>
                    <div className="lbl">Hồ sơ hoàn thiện</div>
                  </div>
                </div>
              )}
            </div>

            {/* Dự án */}
            {(c.projects?.length ?? 0) > 0 && (
              <div className="card-block" id="duan">
                <h2>
                  Dự án tiêu biểu
                  {c.projects!.length > 6 && (
                    <span style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600 }}>
                      Xem tất cả {c.projects!.length} →
                    </span>
                  )}
                </h2>
                <div className="proj-grid">
                  {c.projects!.slice(0, 6).map((p) => (
                    <div className="proj" key={p.id}>
                      <div
                        className="img"
                        style={
                          p.cover_url
                            ? { backgroundImage: `url(${p.cover_url})` }
                            : { background: 'linear-gradient(135deg,#e6ebf1,#c8d6e5)' }
                        }
                      />
                      <div className="b">
                        <h4>{p.title}</h4>
                        <div className="m">
                          {p.role && <span>{p.role}</span>}
                          {p.year && <span>{p.year}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Đánh giá */}
            <div className="card-block" id="danhgia">
              <h2>Đánh giá từ đối tác</h2>
              <div className="pill-note mb-16">
                <svg className="ic"><use href="#ic-shield-check" /></svg>
                <span>
                  Chỉ doanh nghiệp có <b>kết nối đã hoàn tất</b> trên sàn mới được đánh giá — chống review ảo.
                </span>
              </div>
              <p className="muted">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá doanh nghiệp này.</p>
            </div>

            {/* Hồ sơ năng lực */}
            <div className="card-block" id="tailieu">
              <h2>Hồ sơ năng lực</h2>
              {c.verified_tier !== 'none' ? (
                <>
                  <div className="doc-row">
                    <div className="ic-b">
                      <svg className="ic"><use href="#ic-file-text" /></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4>Giấy chứng nhận đăng ký kinh doanh</h4>
                      <small>Đã xác minh bởi Sàn Xây Dựng</small>
                    </div>
                    <span className="badge green">
                      <svg className="ic"><use href="#ic-check" /></svg> Verified
                    </span>
                  </div>
                  {(c.verified_tier === 'capability' || c.verified_tier === 'gold') && (
                    <div className="doc-row">
                      <div className="ic-b">
                        <svg className="ic"><use href="#ic-award" /></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4>Chứng chỉ năng lực hoạt động xây dựng</h4>
                        <small>Đã xác minh</small>
                      </div>
                      <span className="badge green">
                        <svg className="ic"><use href="#ic-check" /></svg> Verified
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">Doanh nghiệp chưa tải lên hồ sơ năng lực.</p>
              )}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <aside>

            {/* Trust Score */}
            <div className="infobox" style={{ textAlign: 'center' }}>
              <h3 style={{ justifyContent: 'center' }}>
                <svg className="ic"><use href="#ic-shield-check" /></svg> Trust Score
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
                <div
                  className="trust-ring"
                  style={{ '--val': Math.min(100, trust) } as CSSProperties}
                >
                  <div className="inner">
                    <b>{trust}</b>
                    <small>/ 100</small>
                  </div>
                </div>
              </div>
              {Object.keys(breakdown).length > 0 && (
                <div className="ts-break">
                  {Object.entries(breakdown).slice(0, 5).map(([label, val]) => {
                    const pct = Math.min(100, Math.round((val as number) * 100));
                    return (
                      <div className="ts-row" key={label}>
                        <div className="between">
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                          <b>{val as number}</b>
                        </div>
                        <div className="progress">
                          <div className="bar green" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legal info */}
            <div className="infobox">
              <h3>
                <svg className="ic"><use href="#ic-file-text" /></svg> Thông tin pháp lý
              </h3>
              {c.tax_code && (
                <div className="kv">
                  <span className="k">Mã số thuế</span>
                  <span className="v">{c.tax_code}</span>
                </div>
              )}
              {c.legal_name && (
                <div className="kv">
                  <span className="k">Tên pháp lý</span>
                  <span className="v">{c.legal_name}</span>
                </div>
              )}
              {c.founded_year && (
                <div className="kv">
                  <span className="k">Năm thành lập</span>
                  <span className="v">{c.founded_year}</span>
                </div>
              )}
              {c.size_range && (
                <div className="kv">
                  <span className="k">Quy mô</span>
                  <span className="v">{c.size_range}</span>
                </div>
              )}
            </div>

            {/* Contact */}
            {(c.phone || c.email || c.website || c.address) && (
              <div className="infobox">
                <h3>
                  <svg className="ic"><use href="#ic-phone" /></svg> Liên hệ
                </h3>
                {c.phone && (
                  <div className="kv">
                    <span className="k">Điện thoại</span>
                    <span className="v">{fmtPhone(c.phone)}</span>
                  </div>
                )}
                {c.email && (
                  <div className="kv">
                    <span className="k">Email</span>
                    <span className="v" style={{ wordBreak: 'break-all' }}>{c.email}</span>
                  </div>
                )}
                {c.website && (
                  <div className="kv">
                    <span className="k">Website</span>
                    <a
                      className="v"
                      href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--orange)' }}
                    >
                      {c.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {c.address && (
                  <div className="kv">
                    <span className="k">Địa chỉ</span>
                    <span className="v">{c.address}</span>
                  </div>
                )}
              </div>
            )}

            {/* Regions */}
            {provs.length > 0 && (
              <div className="infobox">
                <h3>
                  <svg className="ic"><use href="#ic-pin" /></svg> Khu vực hoạt động
                </h3>
                <div className="row wrap" style={{ gap: 6 }}>
                  {provs.slice(0, 8).map((p) => (
                    <span className="badge gray" key={p}>{p}</span>
                  ))}
                  {provs.length > 8 && (
                    <span className="badge gray">+{provs.length - 8} tỉnh</span>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="infobox" style={{ textAlign: 'center', background: 'var(--navy)', border: 'none' }}>
              <p style={{ color: '#c6d3e2', fontSize: 13, marginBottom: 14 }}>
                Bạn là chủ doanh nghiệp? Nhận quyền quản lý hồ sơ này.
              </p>
              <a className="btn btn-orange btn-block" href="/login">
                <svg className="ic"><use href="#ic-shield-check" /></svg> Nhận hồ sơ
              </a>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
