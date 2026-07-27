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

// Map raw DB keys → Vietnamese labels for trust score breakdown
const BREAKDOWN_LABELS: Record<string, string> = {
  legal: 'Xác minh pháp lý & năng lực',
  reviews: 'Đánh giá khách hàng',
  projects: 'Số & quy mô dự án',
  profile: 'Độ hoàn thiện hồ sơ',
  response: 'Mức độ phản hồi',
  completion: 'Tỷ lệ hoàn thành kết nối',
  verified: 'Xác minh pháp lý & năng lực',
  review_score: 'Đánh giá khách hàng',
  project_count: 'Số & quy mô dự án',
  profile_completeness: 'Độ hoàn thiện hồ sơ',
  response_rate: 'Mức độ phản hồi',
  connection_rate: 'Tỷ lệ hoàn thành kết nối',
};

function initials(name: string) {
  return name
    .split(' ')
    .filter((w) => w.length > 1)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function maskPhone(phone: string | null) {
  if (!phone) return null;
  return phone.replace(/(\d{3,4})\d{3}(\d{3})/, '$1●●●$2');
}

function maskTaxCode(code: string | null) {
  if (!code) return null;
  if (code.length <= 4) return code;
  return code.slice(0, 4) + '●'.repeat(code.length - 5) + code.slice(-1);
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

const MOCK_SERVICES = [
  { icon: 'ic-building', name: 'Thi công tổng thầu nhà cao tầng', desc: 'Thi công trọn gói phần thô đến hoàn thiện, quản lý dự án theo tiêu chuẩn quốc tế.', price: 'Theo dự án' },
  { icon: 'ic-gear', name: 'Thi công cơ điện (M&E)', desc: 'Hệ thống điện, cấp thoát nước, HVAC, PCCC cho công trình quy mô lớn.', price: 'Theo hạng mục' },
  { icon: 'ic-ruler', name: 'Tư vấn thiết kế & quản lý dự án', desc: 'Thiết kế kiến trúc – kết cấu, tư vấn giám sát, quản lý chi phí.', price: 'Từ 50 triệu' },
];

const MOCK_STAFF = [
  { ini: 'NV', bg: '#12439c', name: 'Nguyễn Văn A', role: 'Tổng Giám đốc · 30 năm' },
  { ini: 'TT', bg: '#0d6b3f', name: 'Trần Thị B', role: 'Giám đốc kỹ thuật · 22 năm' },
  { ini: 'LH', bg: '#b5610f', name: 'Lê Hoàng C', role: 'Chỉ huy trưởng · 18 năm' },
  { ini: 'PM', bg: '#7a5a0f', name: 'Phạm Minh D', role: 'Trưởng phòng M&E · 15 năm' },
];

const MOCK_REVIEWS = [
  {
    ini: 'VH', bg: '#0d6b3f', name: 'Vinhomes Project Management',
    project: 'Dự án Landmark Tower · 03/2024',
    stars: 5, text: 'Hòa Bình thi công đúng tiến độ cam kết, chất lượng hoàn thiện vượt kỳ vọng. Đội ngũ chỉ huy chuyên nghiệp, xử lý phát sinh nhanh. Chắc chắn hợp tác tiếp.',
  },
  {
    ini: 'TC', bg: '#b5610f', name: 'Tập đoàn Thành Công',
    project: 'Nhà xưởng KCN · 11/2023',
    stars: 4, text: 'Thi công nhà xưởng đạt yêu cầu kỹ thuật, an toàn lao động tốt. Chi phí phát sinh có thương lượng hợp lý. Giao mặt bằng đúng hẹn.',
  },
];

const REV_CRITERIA = [
  { label: 'Chất lượng', val: 4.9 },
  { label: 'Tiến độ', val: 4.8 },
  { label: 'Chi phí', val: 4.6 },
  { label: 'Thái độ hợp tác', val: 5.0 },
  { label: 'An toàn', val: 4.9 },
  { label: 'Bảo hành', val: 4.7 },
];

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
  const reviewCount = 128; // placeholder until reviews table is live

  return (
    <>
      <style>{`
        .svc{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--line-2)}
        .svc:last-child{border-bottom:none}
        .svc .ic-b{width:44px;height:44px;border-radius:10px;background:var(--orange-soft);color:var(--orange);display:grid;place-items:center;flex:none}
        .svc h4{font-size:14.5px;font-weight:700;color:var(--navy)}
        .svc p{font-size:13px;color:var(--muted);margin:3px 0}
        .svc .price{font-size:13.5px;font-weight:700;color:var(--green);white-space:nowrap}
        .rev-summary{display:grid;grid-template-columns:200px 1fr;gap:26px;align-items:center;margin-bottom:20px}
        .rev-big{text-align:center}
        .rev-big .n{font-size:52px;font-weight:800;color:var(--navy);line-height:1}
        .rev-crit{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}
        .rev-crit .between{font-size:13px;margin-bottom:4px}
        .review{padding:16px 0;border-bottom:1px solid var(--line-2)}
        .review:last-child{border-bottom:none}
        .review .top{display:flex;gap:12px;margin-bottom:8px}
        .review .top .ava{width:42px;height:42px;border-radius:10px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:14px;flex:none}
        .review .top h4{font-size:14px;font-weight:700;color:var(--navy)}
        .review .verified{font-size:11.5px;color:var(--green);display:flex;align-items:center;gap:4px;margin-top:2px}
        .review .verified svg{width:13px;height:13px}
        .review p{font-size:13.5px;color:#31414f;margin-top:6px}
        .staff-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .staff{text-align:center;border:1px solid var(--line);border-radius:12px;padding:16px}
        .staff .a{width:60px;height:60px;border-radius:50%;margin:0 auto 10px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:18px}
        .staff h4{font-size:13.5px;font-weight:700;color:var(--navy)}
        .staff small{font-size:12px;color:var(--muted)}
        @media(max-width:900px){.rev-summary{grid-template-columns:1fr}.staff-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.rev-crit{grid-template-columns:1fr}.staff-grid{grid-template-columns:1fr 1fr}}
      `}</style>

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
                    <svg className="ic"><use href="#ic-award" /></svg> Chứng chỉ năng lực Hạng I
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
                <span>
                  <svg className="ic" style={{ color: 'var(--orange)' }}><use href="#ic-star-f" /></svg>
                  <b style={{ color: 'var(--navy)' }}>4.9</b> ({reviewCount} đánh giá)
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="ph-actions">
              <a className="btn btn-outline btn-icon" title="Theo dõi">
                <svg className="ic"><use href="#ic-heart" /></svg>
              </a>
              <a className="btn btn-outline" href="#">
                <svg className="ic"><use href="#ic-link" /></svg> Chia sẻ
              </a>
              <a className="btn btn-outline" href="/chat">
                <svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin
              </a>
              <a className="btn btn-orange" href={`/marketplace?company=${c.id}`}>
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
            <a href="#dichvu">Dịch vụ</a>
            <a href="#danhgia">Đánh giá ({reviewCount})</a>
            <a href="#tailieu">Hồ sơ năng lực</a>
            <a href="#nhansu">Nhân sự &amp; Thiết bị</a>
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
              <h2>
                Giới thiệu
                <a href="#" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Báo cáo</a>
              </h2>
              {c.intro || c.description ? (
                <p className="prose">{c.intro ?? c.description}</p>
              ) : (
                <p className="muted">Chưa có thông tin giới thiệu.</p>
              )}
              <div className="grid-4 mt-16" style={{ gap: 12 }}>
                <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                  <div className="num">{c.projects?.length ?? 0}</div>
                  <div className="lbl">Dự án hoàn thành</div>
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
            </div>

            {/* Dự án */}
            {(c.projects?.length ?? 0) > 0 && (
              <div className="card-block" id="duan">
                <h2>
                  Dự án tiêu biểu
                  {c.projects!.length > 6 && (
                    <a href="#" style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600 }}>
                      Xem tất cả {c.projects!.length} →
                    </a>
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

            {/* Dịch vụ */}
            <div className="card-block" id="dichvu">
              <h2>Dịch vụ cung cấp</h2>
              {MOCK_SERVICES.map((s, i) => (
                <div className="svc" key={i}>
                  <div className="ic-b">
                    <svg className="ic"><use href={`#${s.icon}`} /></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4>{s.name}</h4>
                    <p>{s.desc}</p>
                  </div>
                  <div className="price">{s.price}</div>
                </div>
              ))}
            </div>

            {/* Đánh giá */}
            <div className="card-block" id="danhgia">
              <h2>Đánh giá từ đối tác</h2>
              <div className="rev-summary">
                <div className="rev-big">
                  <div className="n">4.9</div>
                  <div className="stars" style={{ justifyContent: 'center', margin: '4px 0' }}>
                    <span className="st">★★★★★</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {reviewCount} đánh giá xác thực
                  </div>
                </div>
                <div className="rev-crit">
                  {REV_CRITERIA.map((cr) => (
                    <div key={cr.label}>
                      <div className="between">
                        <span>{cr.label}</span><b>{cr.val}</b>
                      </div>
                      <div className="progress">
                        <div className="bar green" style={{ width: `${Math.round(cr.val / 5 * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pill-note mb-16">
                <svg className="ic"><use href="#ic-shield-check" /></svg>
                <span>
                  Chỉ doanh nghiệp có <b>kết nối đã hoàn tất</b> trên sàn mới được đánh giá — chống review ảo.
                </span>
              </div>
              {MOCK_REVIEWS.map((r, i) => (
                <div className="review" key={i}>
                  <div className="top">
                    <div className="ava" style={{ background: r.bg }}>{r.ini}</div>
                    <div style={{ flex: 1 }}>
                      <h4>{r.name}</h4>
                      <div className="verified">
                        <svg className="ic"><use href="#ic-shield-check" /></svg>
                        Kết nối xác thực · {r.project}
                      </div>
                    </div>
                    <div className="stars">
                      <span className="st">{'★'.repeat(r.stars)}</span>
                      {r.stars < 5 && <span className="st" style={{ opacity: 0.3 }}>{'★'.repeat(5 - r.stars)}</span>}
                    </div>
                  </div>
                  <p>{r.text}</p>
                </div>
              ))}
              <a className="btn btn-outline btn-block mt-16" href="#">
                Xem tất cả {reviewCount} đánh giá
              </a>
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
                      <small>PDF · Công khai · Đã xác minh</small>
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
                        <h4>Chứng chỉ năng lực hoạt động xây dựng Hạng I</h4>
                        <small>PDF · Công khai · Bộ Xây dựng cấp</small>
                      </div>
                      <span className="badge green">
                        <svg className="ic"><use href="#ic-check" /></svg> Verified
                      </span>
                    </div>
                  )}
                  <div className="doc-row">
                    <div className="ic-b" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                      <svg className="ic"><use href="#ic-lock" /></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4>Hồ sơ năng lực đầy đủ (Company Profile)</h4>
                      <small>PDF · Chỉ đối tác đã kết nối</small>
                    </div>
                    <a className="btn btn-outline btn-sm" href="/login">
                      <svg className="ic"><use href="#ic-download" /></svg> Yêu cầu
                    </a>
                  </div>
                </>
              ) : (
                <p className="muted">Doanh nghiệp chưa tải lên hồ sơ năng lực.</p>
              )}
            </div>

            {/* Nhân sự & Thiết bị */}
            <div className="card-block" id="nhansu">
              <h2>Nhân sự chủ chốt</h2>
              <div className="staff-grid mb-16">
                {MOCK_STAFF.map((s, i) => (
                  <div className="staff" key={i}>
                    <div className="a" style={{ background: s.bg }}>{s.ini}</div>
                    <h4>{s.name}</h4>
                    <small>{s.role}</small>
                  </div>
                ))}
              </div>
              <h2>Thiết bị chính</h2>
              <div className="grid-3" style={{ gap: 12 }}>
                <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                  <div className="num">12</div>
                  <div className="lbl">Cẩu tháp</div>
                </div>
                <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                  <div className="num">8</div>
                  <div className="lbl">Máy ép cọc</div>
                </div>
                <div className="stat-tile" style={{ boxShadow: 'none', background: '#fafbfc' }}>
                  <div className="num">45</div>
                  <div className="lbl">Giàn giáo (bộ)</div>
                </div>
              </div>
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
              <div className="ts-break">
                {Object.keys(breakdown).length > 0 ? (
                  Object.entries(breakdown).slice(0, 6).map(([key, val]) => {
                    const label = BREAKDOWN_LABELS[key] ?? key;
                    const pct = Math.min(100, Math.round((val as number) * 100));
                    return (
                      <div className="ts-row" key={key}>
                        <div className="between">
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                          <b style={{ fontSize: 12 }}>{val as number}</b>
                        </div>
                        <div className="progress">
                          <div className="bar green" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Fallback static breakdown when no data
                  [
                    ['Xác minh pháp lý & năng lực', 20, 20],
                    ['Đánh giá khách hàng', 29, 30],
                    ['Số & quy mô dự án', 15, 15],
                    ['Độ hoàn thiện hồ sơ', 10, 10],
                    ['Mức độ phản hồi', 9, 10],
                    ['Tỷ lệ hoàn thành kết nối', 10, 10],
                  ].map(([label, val, max]) => (
                    <div className="ts-row" key={label as string}>
                      <div className="between">
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                        <b style={{ fontSize: 12 }}>{val}/{max}</b>
                      </div>
                      <div className="progress">
                        <div className="bar green" style={{ width: `${Math.round(Number(val) / Number(max) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <a href="#" style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 600 }}>
                Trust Score được tính thế nào?
              </a>
            </div>

            {/* Legal info */}
            <div className="infobox">
              <h3>
                <svg className="ic"><use href="#ic-file-text" /></svg> Thông tin pháp lý
              </h3>
              {c.tax_code && (
                <div className="kv">
                  <span className="k">Mã số thuế</span>
                  <span className="v">{maskTaxCode(c.tax_code)}</span>
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
              {(c.verified_tier === 'capability' || c.verified_tier === 'gold') && (
                <div className="kv">
                  <span className="k">Hạng năng lực</span>
                  <span className="v">Hạng I</span>
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
            <div className="infobox">
              <h3>
                <svg className="ic"><use href="#ic-phone" /></svg> Liên hệ
              </h3>
              {c.phone && (
                <div className="kv">
                  <span className="k">Điện thoại</span>
                  <span className="v">{maskPhone(c.phone)}</span>
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
                  <span className="v" style={{ maxWidth: 170 }}>{c.address}</span>
                </div>
              )}
              <a className="btn btn-orange btn-block mt-16" href="/chat">
                <svg className="ic"><use href="#ic-chat" /></svg> Gửi tin nhắn
              </a>
            </div>

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

            {/* Claim CTA */}
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
