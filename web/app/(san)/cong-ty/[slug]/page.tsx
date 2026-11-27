import type { Metadata } from 'next';
import ReportButton from './ReportButton';
import SaveButton from '@/components/SaveButton';
import ShareButton from '@/components/ShareButton';
import { TrackView, ContactLink } from '@/components/Track';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getCompany, getContent, getSharedDocs } from './data';
import CoverBanner from './CoverBanner';
import { getMe, canAdmin } from '@/lib/me';
import { SITE_URL, thumb } from '@/lib/ui';
import ConnectButton, { type ExistingConn } from './ConnectButton';
import ReviewForm, { type Eligible } from './ReviewForm';
import ReviewReply from './ReviewReply';
import Gallery from './Gallery';
import ProjectsGrid from './ProjectsGrid';
import { AboutBlocks, AwardsSection, BranchesSection, FaqSection, ListingsSection, MilestonesSection, PartnersSection, PostsSection } from './ShowcaseSections';
import RichText from '@/components/RichText';
import { parseSiteSettings, siteUrl } from '@/lib/site';
import { plainText } from '@/lib/richtext';
import './profile.css';
import {
  CTA_LABELS, LINK_KINDS, LINK_META, MAX_FEATURED, RESPONSE_LABELS,
  brandVars, coverPosition, cssUrl, parseProfileSettings, sectionOrder,
  type SectionKey,
} from '@/lib/profile';
import { VERIFY_KIND } from '@/lib/admin-labels';

export const dynamic = 'force-dynamic';

const TIER_COLORS: Record<string, string> = {
  gold: '#c08a1a',
  capability: '#0d6b3f',
  legal: '#12439c',
  none: '#555',
};

// Map raw DB keys → Vietnamese labels for trust score breakdown
// Điểm tối đa mỗi nhóm (khớp compute_trust_score)
const BREAKDOWN_MAX: Record<string, number> = { verification: 20, reviews: 30, projects: 15, completeness: 10 };

const BREAKDOWN_LABELS: Record<string, string> = {
  verification: 'Xác minh pháp lý & năng lực',
  completeness: 'Độ hoàn thiện hồ sơ',
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

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function getRelation(companyId: string) {
  const me = await getMe();
  const mine = me.companies.filter((c) => c.id !== companyId);
  const out = { loggedIn: !!me.userId, isMember: me.companies.some((c) => c.id === companyId), canReply: me.companies.some((c) => c.id === companyId && canAdmin(c)), mine, existing: null as ExistingConn | null, eligible: [] as Eligible[] };
  if (!me.userId || !mine.length) return out;
  try {
    const supa = createSupabaseServer();
    const ids = mine.map((c) => c.id).join(',');
    const { data } = await supa
      .from('connections')
      .select('id, status, requester_company_id, target_company_id, created_at')
      .or(`and(requester_company_id.in.(${ids}),target_company_id.eq.${companyId}),and(target_company_id.in.(${ids}),requester_company_id.eq.${companyId})`)
      .order('created_at', { ascending: false });
    const conns = (data ?? []) as { id: string; status: string; requester_company_id: string; target_company_id: string }[];
    const mineOf = (c: (typeof conns)[number]) => (mine.some((m) => m.id === c.requester_company_id) ? c.requester_company_id : c.target_company_id);

    const open = conns.find((c) => c.status === 'pending' || c.status === 'accepted');
    const done = conns.find((c) => c.status === 'completed');
    const ex = open ?? done;
    if (ex) out.existing = { id: ex.id, status: ex.status, mineId: mineOf(ex), iAmTarget: ex.target_company_id === mineOf(ex) };

    const completed = conns.filter((c) => c.status === 'completed');
    if (completed.length) {
      const { data: rv } = await supa
        .from('reviews')
        .select('connection_id, reviewer_company_id')
        .in('connection_id', completed.map((c) => c.id));
      const reviewed = new Set((rv ?? []).map((r: { connection_id: string; reviewer_company_id: string }) => `${r.connection_id}:${r.reviewer_company_id}`));
      out.eligible = completed
        .map((c) => ({ c, co: mine.find((m) => m.id === mineOf(c))! }))
        .filter(({ c, co }) => canAdmin(co) && !reviewed.has(`${c.id}:${co.id}`))
        .map(({ c, co }) => ({ connectionId: c.id, reviewerId: co.id, reviewerName: co.name }));
    }
  } catch {
    /* bỏ qua: hiển thị trang không có trạng thái kết nối */
  }
  return out;
}

type PageProps = { params: { slug: string }; searchParams: { all?: string; khach?: string } };

/** Người xem có phải thành viên của doanh nghiệp này không. */
const isMemberOf = async (slug: string) => (await getMe()).companies.some((c) => c.slug === slug);

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const member = await isMemberOf(params.slug);
  const c = await getCompany(params.slug, member);
  if (!c) return { title: 'Không tìm thấy doanh nghiệp' };
  const summary = c.intro || plainText(c.description ?? '').slice(0, 300);
  return {
    title: c.name,
    description: summary || `Hồ sơ năng lực ${c.name} trên Sàn Xây Dựng.`,
    alternates: { canonical: `${SITE_URL}/cong-ty/${c.slug}` },
    openGraph: { title: c.name, description: summary.slice(0, 200), images: c.logo_url ? [c.logo_url] : [], url: `${SITE_URL}/cong-ty/${c.slug}`, type: 'website' },
    ...(c.status !== 'published' || searchParams.khach ? { robots: { index: false } } : {}),
  };
}

const SVC_ICONS = ['ic-building', 'ic-gear', 'ic-ruler', 'ic-briefcase', 'ic-layers', 'ic-tag'];
const BG_COLORS = ['#12439c', '#0d6b3f', '#c0392b', '#b5610f', '#7a5a0f', '#17479e'];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BG_COLORS[h % BG_COLORS.length];
}

function fmtPrice(from: number | null, to: number | null, unit: string | null): string | null {
  if (!from && !to) return null;
  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(0)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1e6).toFixed(0)} triệu`;
    return n.toLocaleString('vi-VN');
  };
  let s = from && to ? `${fmt(from)} – ${fmt(to)}` : from ? `Từ ${fmt(from)}` : `Đến ${fmt(to!)}`;
  if (unit) s += ` / ${unit}`;
  return s;
}

export default async function CompanyPage({ params, searchParams }: PageProps) {
  const showAll = searchParams?.all === '1';
  const member = await isMemberOf(params.slug);
  const c = await getCompany(params.slug, member);
  if (!c) notFound();
  // "Xem như khách": thành viên thấy đúng những gì người lạ chưa đăng nhập thấy
  const asGuest = member && searchParams?.khach === '1';
  const [relation, { photos, gallery, extras }, docs] = await Promise.all([getRelation(c.id), getContent(c.id, member), getSharedDocs(c.id, asGuest)]);
  const rel = asGuest ? { loggedIn: false, isMember: false, canReply: false, mine: [], existing: null, eligible: [] as Eligible[] } : relation;
  const settings = parseProfileSettings(c.profile_settings);
  // Website doanh nghiệp <tên>.sanxaydung.vn (chỉ khi hồ sơ đã xuất bản và chưa tắt website)
  const webUrl = c.status === 'published' && parseSiteSettings(c.site_settings).enabled ? siteUrl(c) : null;
  const links = LINK_KINDS.flatMap((k) => (settings.links?.[k] ? [{ kind: k, url: settings.links[k]! }] : []));
  const sameAs = [
    ...(c.website ? [c.website.startsWith('http') ? c.website : `https://${c.website}`] : []),
    ...links.filter((l) => l.kind !== 'zalo').map((l) => l.url),
  ];

  const cats = (c.company_categories ?? []).map((x) => x.categories?.name).filter(Boolean);
  const provs = (c.company_locations ?? []).map((x) => x.provinces?.name).filter(Boolean);
  const rawScore = c.trust_scores?.score ?? c.trust_score ?? 0;
  const trust = Math.round(rawScore);
  const breakdown = c.trust_scores?.breakdown ?? {};
  const ini = initials(c.name);
  const logoColor = TIER_COLORS[c.verified_tier] ?? '#12439c';

  const verified = c.company_verifications ?? [];
  const capability = verified.find((v) => v.kind === 'capability_cert');
  const services = c.services ?? [];
  const staff = [...(c.staff ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const equipment = c.equipment ?? [];
  const reviews = (c.reviews ?? []).filter((r) => r.status === 'published');
  const reviewCount = reviews.length;

  // Tính trung bình điểm theo từng tiêu chí
  const avgCrit = (field: keyof typeof reviews[0]) => {
    const vals = reviews.map((r) => r[field] as number | null).filter((v): v is number => v !== null);
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };
  const avgOverall = avgCrit('overall');
  const revCriteria = [
    { label: 'Chất lượng',        val: avgCrit('score_quality') },
    { label: 'Tiến độ',           val: avgCrit('score_progress') },
    { label: 'Chi phí',           val: avgCrit('score_cost') },
    { label: 'Thái độ hợp tác',   val: avgCrit('score_cooperation') },
    { label: 'An toàn',           val: avgCrit('score_safety') },
    { label: 'Bảo hành',          val: avgCrit('score_warranty') },
  ].filter((cr) => cr.val !== null) as { label: string; val: number }[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: c.name,
    ...(c.legal_name ? { legalName: c.legal_name } : {}),
    url: `${SITE_URL}/cong-ty/${c.slug}`,
    ...(c.logo_url ? { logo: c.logo_url } : {}),
    ...(c.intro || c.description ? { description: c.intro || plainText(c.description ?? '').slice(0, 500) } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(c.founded_year ? { foundingDate: String(c.founded_year) } : {}),
    ...(c.address ? { address: { '@type': 'PostalAddress', streetAddress: c.address, addressCountry: 'VN' } } : {}),
    ...(reviewCount > 0 && avgOverall
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avgOverall, reviewCount, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  // Tên tỉnh cho các chi nhánh
  const branchCodes = Array.from(new Set(extras.branches.map((b) => b.province_code).filter((x): x is string => !!x)));
  const branchProvinces: { code: string; name: string }[] = branchCodes.length
    ? ((await createSupabaseServer().from('provinces').select('code, name').in('code', branchCodes)).data ?? [])
    : [];

  // Phần giới thiệu dài; bỏ qua nếu chỉ lặp lại mô tả ngắn
  const longText = c.description && c.description.trim() !== c.intro?.trim() ? c.description : '';
  // Dự án ghim đứng đầu, còn lại theo năm mới nhất
  const featuredIds = new Set((c.projects ?? []).filter((p) => p.is_featured).slice(0, MAX_FEATURED).map((p) => p.id));
  const projectCards = [...(c.projects ?? [])]
    .sort((a, b) => Number(featuredIds.has(b.id)) - Number(featuredIds.has(a.id)) || (b.year ?? 0) - (a.year ?? 0))
    .map((p) => ({
      id: p.id, title: p.title, role: p.role, year: p.year, kind: p.kind ?? null, featured: featuredIds.has(p.id), cover: p.cover_url,
      photos: (photos.get(p.id) ?? []).filter((u) => u !== p.cover_url).slice(0, 4),
    }));
  // Nhãn tab của từng mục; null = mục chưa có nội dung
  const tabs: Record<SectionKey, string | null> = {
    gioithieu: 'Giới thiệu',
    duan: projectCards.length ? `Dự án (${projectCards.length})` : null,
    thuvien: gallery.length ? `Hình ảnh (${gallery.length})` : null,
    dichvu: services.length ? `Dịch vụ (${services.length})` : null,
    doitac: extras.partners.length ? 'Khách hàng & đối tác' : null,
    danhgia: `Đánh giá (${reviewCount})`,
    tailieu: 'Hồ sơ năng lực',
    giaithuong: extras.awards.length ? 'Giải thưởng' : null,
    nhansu: staff.length || equipment.length ? 'Nhân sự & Thiết bị' : null,
    moc: extras.milestones.length ? 'Mốc phát triển' : null,
    chinhanh: extras.branches.length ? `Chi nhánh (${extras.branches.length})` : null,
    faq: extras.faqs.length ? 'Hỏi đáp' : null,
    baidang: extras.posts.length ? 'Bài đăng' : null,
    tindang: extras.listings.length ? `Tin đăng (${extras.listings.length})` : null,
  };
  const hidden = settings.sections?.hidden ?? [];
  const shown = sectionOrder(settings.sections?.order).filter((k) => tabs[k] && !hidden.includes(k));

  // Nút liên hệ chính do doanh nghiệp chọn; thiếu dữ liệu thì quay về "Nhắn tin"
  const tel = c.phone?.replace(/[^\d+]/g, '') || null;
  const cta =
    settings.cta === 'call' && tel ? { href: `tel:${tel}`, label: CTA_LABELS.call, icon: 'ic-phone' }
    : settings.cta === 'zalo' && settings.links?.zalo ? { href: settings.links.zalo, label: CTA_LABELS.zalo, icon: 'ic-chat', external: true }
    : settings.cta === 'quote' ? { href: `/chat?to=${c.id}&compose=quote`, label: CTA_LABELS.quote, icon: 'ic-clipboard' }
    : null;
  const provinceNames = new Map<string, string>(branchProvinces.map((p) => [p.code, p.name]));
  const faqLd = shown.includes('faq')
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: extras.faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }
    : null;

  const sections: Record<SectionKey, () => ReactNode> = {
    gioithieu: () => (
      <>
        <div className="card-block" id="gioithieu">
          <h2>
            Giới thiệu
            <ReportButton entityType="company" entityId={c.id} />
          </h2>
          {c.intro && <p className="prose co-lead">{c.intro}</p>}
          {!c.intro && !longText && !settings.about && <p className="muted">Chưa có thông tin giới thiệu.</p>}
          {settings.highlights ? (
            <div className="grid-4 mt-16" style={{ gap: 12 }}>
              {settings.highlights.map((h, i) => (
                <div className="stat-tile co-hl" key={i} style={{ boxShadow: 'none', background: '#fafbfc', padding: '16px 14px', overflowWrap: 'anywhere' }}>
                  <div className={h.value.length > 7 ? 'num long' : 'num'} style={settings.brand_color ? { color: 'var(--orange)' } : undefined}>{h.value}</div>
                  <div className="lbl">{h.label}</div>
                </div>
              ))}
            </div>
          ) : (
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
          )}
          {longText && <RichText text={longText} />}
          {settings.about && <AboutBlocks about={settings.about} />}
        </div>
      </>
    ),
    duan: () => (
      <>
        <div className="card-block" id="duan">
          <h2>Dự án tiêu biểu</h2>
          <ProjectsGrid items={projectCards} expanded={showAll} />
        </div>
      </>
    ),
    thuvien: () => (
      <>
        {gallery.length > 0 && (
          <div className="card-block" id="thuvien">
            <h2>Hình ảnh &amp; video</h2>
            <Gallery items={gallery} companyName={c.name} reportable={!rel.isMember} />
          </div>
        )}
      </>
    ),
    dichvu: () => (
      <>
        {services.length > 0 && (
          <div className="card-block" id="dichvu">
            <h2>Dịch vụ cung cấp</h2>
            {services.map((s, i) => {
              const price = fmtPrice(s.price_from, s.price_to, s.price_unit);
              return (
                <div className="svc" key={s.id}>
                  <div className="ic-b">
                    <svg className="ic"><use href={`#${SVC_ICONS[i % SVC_ICONS.length]}`} /></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4>{s.name}</h4>
                    {s.description && <p>{s.description}</p>}
                  </div>
                  {price && <div className="price">{price}</div>}
                </div>
              );
            })}
          </div>
        )}
      </>
    ),
    doitac: () => (
      <>
        <PartnersSection items={extras.partners} selfId={c.id} />
      </>
    ),
    danhgia: () => (
      <>
        <div className="card-block" id="danhgia">
          <h2>Đánh giá từ đối tác</h2>
          {rel.eligible.length > 0 && <ReviewForm targetId={c.id} eligible={rel.eligible} />}
          {reviewCount === 0 ? (
            <>
              <div className="pill-note mb-16">
                <svg className="ic"><use href="#ic-shield-check" /></svg>
                <span>Chỉ doanh nghiệp có <b>kết nối đã hoàn tất</b> trên sàn mới được đánh giá — chống review ảo.</span>
              </div>
              <p className="muted">Chưa có đánh giá nào cho doanh nghiệp này.</p>
            </>
          ) : (
            <>
              <div className="rev-summary">
                <div className="rev-big">
                  <div className="n">{avgOverall?.toFixed(1) ?? '—'}</div>
                  <div className="stars" style={{ justifyContent: 'center', margin: '4px 0' }}>
                    {avgOverall && (
                      <span className="st">{'★'.repeat(Math.round(avgOverall))}</span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {reviewCount} đánh giá xác thực
                  </div>
                </div>
                {revCriteria.length > 0 && (
                  <div className="rev-crit">
                    {revCriteria.map((cr) => (
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
                )}
              </div>
              <div className="pill-note mb-16">
                <svg className="ic"><use href="#ic-shield-check" /></svg>
                <span>Chỉ doanh nghiệp có <b>kết nối đã hoàn tất</b> trên sàn mới được đánh giá — chống review ảo.</span>
              </div>
              {(showAll ? reviews : reviews.slice(0, 5)).map((r) => {
                const rco = r.reviewer_company;
                const rName = rco?.name ?? 'Doanh nghiệp';
                const rIni = initials(rName);
                const rBg = rco ? colorFor(rco.id) : '#555';
                const stars = Math.round(r.overall ?? 0);
                return (
                  <div className="review" key={r.id}>
                    <div className="top">
                      <div className="ava" style={{ background: rBg }}>{rIni}</div>
                      <div style={{ flex: 1 }}>
                        <h4>
                          {rco ? (
                            <a href={`/cong-ty/${rco.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{rName}</a>
                          ) : rName}
                        </h4>
                        <div className="verified">
                          <svg className="ic"><use href="#ic-shield-check" /></svg>
                          Kết nối xác thực · {new Date(r.created_at).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <div className="stars">
                        <span className="st">{'★'.repeat(stars)}</span>
                        {stars < 5 && <span className="st" style={{ opacity: 0.3 }}>{'★'.repeat(5 - stars)}</span>}
                      </div>
                    </div>
                    {r.comment && <p>{r.comment}</p>}
                    <ReviewReply reviewId={r.id} companyName={c.name} initial={r.reply ?? null} canReply={rel.canReply} />
                  </div>
                );
              })}
              {reviewCount > 5 && !showAll && (
                <a className="btn btn-outline btn-block mt-16" href="?all=1#danhgia">
                  Xem tất cả {reviewCount} đánh giá
                </a>
              )}
            </>
          )}
        </div>
      </>
    ),
    tailieu: () => (
      <>
        <div className="card-block" id="tailieu">
          <h2>Hồ sơ năng lực</h2>
          {verified.length > 0 ? verified.map((v) => (
            <div className="doc-row" key={v.id}>
              <div className="ic-b">
                <svg className="ic"><use href={v.kind === 'capability_cert' ? '#ic-award' : '#ic-file-text'} /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <h4>{VERIFY_KIND[v.kind] ?? v.kind}{v.cert_class ? ` · ${v.cert_class}` : ''}</h4>
                <small>Sàn Xây Dựng đã đối chiếu{v.verified_at ? ` ngày ${new Date(v.verified_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}</small>
              </div>
              <span className="badge green">
                <svg className="ic"><use href="#ic-check" /></svg> Đã xác minh
              </span>
            </div>
          )) : (
            <p className="muted">Chưa có giấy tờ nào được xác minh.</p>
          )}
          {docs.length > 0 && (
            <>
              <h3 className="co-docs-h">Tài liệu do doanh nghiệp cung cấp</h3>
              {docs.map((d) => (
                <div className="doc-row" key={d.id}>
                  <div className="ic-b">
                    <svg className="ic"><use href="#ic-file-text" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <h4>{d.title}</h4>
                    <small>
                      {[
                        d.file_url.split('.').pop()?.toUpperCase(),
                        d.size_bytes ? fmtSize(d.size_bytes) : null,
                        d.visibility === 'connections' ? 'Chỉ đối tác đã kết nối' : null,
                      ].filter(Boolean).join(' · ')}
                    </small>
                  </div>
                  <a className="btn btn-outline btn-sm" href={`/tai-lieu/${d.id}`} target="_blank" rel="nofollow noopener" aria-label={`Tải ${d.title}`}>
                    <svg className="ic"><use href="#ic-download" /></svg> Tải
                  </a>
                </div>
              ))}
            </>
          )}
          {!rel.isMember && (
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              Cần hồ sơ năng lực chi tiết? <a href={`/chat?to=${c.id}`} style={{ color: 'var(--orange)', fontWeight: 600 }}>Nhắn tin cho doanh nghiệp</a>.
            </p>
          )}
        </div>
      </>
    ),
    giaithuong: () => (
      <>
        <AwardsSection items={extras.awards} />
      </>
    ),
    nhansu: () => (
      <>
        {(staff.length > 0 || equipment.length > 0) && (
          <div className="card-block" id="nhansu">
            {staff.length > 0 && (
              <>
                <h2>Nhân sự chủ chốt</h2>
                <div className="staff-grid mb-16">
                  {staff.map((s) => {
                    const sIni = s.full_name ? initials(s.full_name) : '?';
                    const sBg = colorFor(s.id);
                    return (
                      <div className="staff" key={s.id}>
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.full_name ?? ''} loading="lazy" style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto 10px', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div className="a" style={{ background: sBg }}>{sIni}</div>
                        )}
                        <h4>{s.full_name ?? 'Nhân sự'}</h4>
                        <small>
                          {[s.title, s.experience_years ? `${s.experience_years} năm` : null].filter(Boolean).join(' · ')}
                        </small>
                        {s.certificate && <div><span className="co-staff-cert">{s.certificate}</span></div>}
                        {s.bio && <p className="co-staff-bio">{s.bio}</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {equipment.length > 0 && (
              <>
                <h2>Thiết bị chính</h2>
                <div className="grid-3" style={{ gap: 12 }}>
                  {equipment.map((eq) => (
                    <div className="stat-tile" key={eq.id} style={{ boxShadow: 'none', background: '#fafbfc' }}>
                      {eq.quantity != null && <div className="num">{eq.quantity}</div>}
                      <div className="lbl">{eq.name}</div>
                      {eq.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{eq.note}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </>
    ),
    moc: () => (
      <>
        <MilestonesSection items={extras.milestones} />
      </>
    ),
    chinhanh: () => (
      <>
        <BranchesSection items={extras.branches} provinces={provinceNames} />
      </>
    ),
    faq: () => (
      <>
        <FaqSection items={extras.faqs} />
      </>
    ),
    baidang: () => (
      <>
        <PostsSection items={extras.posts} showAll={showAll} />
      </>
    ),
    tindang: () => (
      <>
        <ListingsSection items={extras.listings} />
      </>
    ),
  };

  return (
    <div className={settings.brand_color ? 'co-page co-brand' : 'co-page'} style={settings.brand_color ? (brandVars(settings.brand_color) as CSSProperties) : undefined}>
      {!member && <TrackView companyId={c.id} />}
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />}
      {member && (asGuest || c.status !== 'published') && (
        <div className="co-banner">
          <div className="container">
            <span>
              {asGuest ? <><b>Đang xem như khách.</b> Đây là những gì người chưa đăng nhập nhìn thấy.</> : null}
              {c.status !== 'published' ? ' Hồ sơ chưa công khai: hiện chỉ thành viên xem được trang này.' : null}
            </span>
            <span className="row" style={{ gap: 14 }}>
              {asGuest && <a href={`/cong-ty/${c.slug}`}>Thoát chế độ khách</a>}
              <a href="/dashboard/company-edit">Sửa hồ sơ</a>
            </span>
          </div>
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <style dangerouslySetInnerHTML={{ __html: `
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
        .proj-photos{display:flex;gap:6px;margin-top:8px}
        .proj-photos a{width:46px;height:36px;border-radius:6px;background:#e6ebf1 center/cover;display:block}
        .staff-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .staff{text-align:center;border:1px solid var(--line);border-radius:12px;padding:16px}
        .staff .a{width:60px;height:60px;border-radius:50%;margin:0 auto 10px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:18px}
        .staff h4{font-size:13.5px;font-weight:700;color:var(--navy)}
        .staff small{font-size:12px;color:var(--muted)}
        .co-brand .card-block h2{position:relative}
        .co-brand .card-block h2::before{content:"";position:absolute;left:-24px;top:3px;bottom:3px;width:4px;border-radius:0 4px 4px 0;background:var(--orange)}
        .co-brand .pill-note{color:var(--navy);border-color:var(--brand-line)}
        .co-cover{height:220px;position:relative}
        .co-tagline{position:absolute;left:0;right:0;bottom:22px}
        .co-tagline p{margin-left:146px;color:#fff;font-size:22px;font-weight:800;line-height:1.3;text-align:right;text-shadow:0 2px 12px rgba(0,0,0,.65);overflow-wrap:anywhere}
        .co-hl .num{font-size:clamp(19px,5.4vw,26px);overflow-wrap:anywhere}
        .co-hl .num.long{font-size:clamp(16px,4.4vw,21px);line-height:1.3}
        @media(min-width:901px){.co-page .ph-inner{align-items:flex-start}.co-page .ph-main{padding-top:68px;min-width:0}.co-page .ph-actions{padding-top:72px}}
        .co-gal{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .co-gal button{position:relative;aspect-ratio:4/3;border:none;padding:0;border-radius:10px;overflow:hidden;background:#e6ebf1;cursor:pointer}
        .co-gal img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .25s}
        .co-gal button:hover img{transform:scale(1.04)}
        .co-gal .ph{position:absolute;inset:0;display:grid;place-items:center;background:var(--navy);color:#c6d3e2;font-size:12px}
        .co-gal .play{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(2,30,72,.78);color:#fff;display:grid;place-items:center;font-size:16px}
        .co-gal .more{position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,30,72,.65);color:#fff;font-size:24px;font-weight:800}
        .co-gal .cap{position:absolute;left:0;right:0;bottom:0;padding:18px 8px 6px;background:linear-gradient(transparent,rgba(0,0,0,.7));color:#fff;font-size:11.5px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .lightbox{width:100vw;height:100vh;height:100dvh;max-width:100vw;max-height:100vh;max-height:100dvh;margin:0;padding:0;border:none;background:rgba(3,10,22,.95)}
        .lightbox::backdrop{background:rgba(3,10,22,.9)}
        .lb-in{height:100%;display:grid;place-items:center;padding:56px 64px;position:relative}
        .lightbox figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:100%}
        .lightbox figure img{max-width:100%;max-height:calc(100vh - 170px);max-height:calc(100dvh - 170px);border-radius:6px}
        .lightbox iframe{width:min(1100px,calc(100vw - 128px),calc((100vh - 170px)*16/9));aspect-ratio:16/9;border:none;background:#000}
        .lightbox figcaption{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;color:#c6d3e2;font-size:13px}
        .lightbox figcaption b{color:#fff}
        .lightbox figcaption a{color:#fff;text-decoration:underline}
        .lb-btn{position:absolute;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:1}
        .lb-btn:hover{background:rgba(255,255,255,.28)}
        .lb-close{top:12px;right:12px}.lb-prev{left:12px;top:calc(50% - 22px)}.lb-next{right:12px;top:calc(50% - 22px)}
        .co-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .co-links a{font-size:12.5px;font-weight:600;color:var(--navy);border:1.5px solid var(--line);border-radius:20px;padding:6px 12px;text-decoration:none}
        .co-links a:hover{border-color:var(--orange);color:var(--orange)}
        .co-docs-h{font-size:14.5px;font-weight:700;color:var(--navy);margin:20px 0 4px}
        @media(max-width:900px){.co-tagline{bottom:auto;top:20px}.co-tagline p{margin-left:0;font-size:17px;text-align:center}}
        @media(max-width:600px){.co-gal{grid-template-columns:repeat(2,1fr)}.lb-in{padding:56px 8px}.lightbox iframe{width:calc(100vw - 16px)}.lb-prev,.lb-next{top:auto;bottom:12px}}
        @media(max-width:900px){.rev-summary{grid-template-columns:1fr}.staff-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.rev-crit{grid-template-columns:1fr}.staff-grid{grid-template-columns:1fr 1fr}}
      ` }} />

      {/* Cover */}
      <div
        className="co-cover"
        style={{
          ['--cover-pos' as string]: coverPosition(settings),
          background: c.cover_url
            ? `linear-gradient(rgba(2,30,72,.3),rgba(2,30,72,.1)),${cssUrl(c.cover_url)} ${coverPosition(settings)}/cover`
            : 'linear-gradient(120deg,rgba(2,30,72,.9),rgba(2,30,72,.6)),url(https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1280&q=60) center/cover',
        }}
      >
        <CoverBanner images={settings.banner?.images ?? []} video={settings.banner?.video ?? null} position={coverPosition(settings)} />
        {settings.tagline && (
          <div className="co-tagline">
            <div className="container"><p>{settings.tagline}</p></div>
          </div>
        )}
      </div>

      {/* Profile head */}
      <div className="profile-head">
        <div className="container">
          <div className="ph-inner">
            {/* Logo */}
            <div className="ph-logo" style={{ background: logoColor }}>
              {c.logo_url ? <img src={thumb(c.logo_url, 200)} alt={c.name} /> : ini}
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
                {(c.verified_tier === 'capability' || capability) && (
                  <span className="verify capability">
                    <svg className="ic"><use href="#ic-award" /></svg> Chứng chỉ năng lực{capability?.cert_class ? ` ${capability.cert_class}` : ''}
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
                {reviewCount > 0 && (
                  <span>
                    <svg className="ic" style={{ color: 'var(--orange)' }}><use href="#ic-star-f" /></svg>
                    <b style={{ color: 'var(--navy)' }}>{avgOverall?.toFixed(1) ?? '—'}</b> ({reviewCount} đánh giá)
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="ph-actions">
              {!rel.isMember && <SaveButton kind="company" itemId={c.id} className="btn btn-outline btn-icon btn-square" compact />}
              <ShareButton path={`/cong-ty/${c.slug}`} title={c.name} className="btn btn-outline" />
              {rel.isMember ? (
                <a className="btn btn-outline" href="/dashboard/company-edit">
                  <svg className="ic"><use href="#ic-edit" /></svg> Sửa hồ sơ
                </a>
              ) : cta ? (
                <ContactLink companyId={c.id} className="btn btn-navy" href={cta.href} {...(cta.external ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {})}>
                  <svg className="ic"><use href={`#${cta.icon}`} /></svg> {cta.label}
                </ContactLink>
              ) : (
                <ContactLink companyId={c.id} className="btn btn-outline" href={`/chat?to=${c.id}`}>
                  <svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin
                </ContactLink>
              )}
              {!rel.isMember && <ConnectButton targetId={c.id} mine={rel.mine} existing={rel.existing} loggedIn={rel.loggedIn} />}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky tabs */}
      <div className="sticky-tabs">
        <div className="container">
          <nav className="tabs">
            {shown.map((k, i) => (
              <a key={k} className={i === 0 ? 'active' : undefined} href={`#${k}`}>{tabs[k]}</a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <section className="block" style={{ paddingTop: 24, background: 'var(--bg)' }}>
        <div className="container grid-side-r">

          {/* ── LEFT MAIN ── */}
          <div>

            {shown.map((k) => (
              <Fragment key={k}>{sections[k]()}</Fragment>
            ))}
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
                    const num = Number(val) || 0;
                    const max = BREAKDOWN_MAX[key];
                    const pct = max ? Math.min(100, Math.round((num / max) * 100)) : Math.min(100, Math.round(num));
                    return (
                      <div className="ts-row" key={key}>
                        <div className="between">
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                          <b style={{ fontSize: 12 }}>{max ? `${num}/${max}` : num}</b>
                        </div>
                        <div className="progress">
                          <div className="bar green" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="muted" style={{ fontSize: 12.5 }}>Chưa có dữ liệu chấm điểm cho doanh nghiệp này.</p>
                )}
              </div>
              <a href="/trust-score" style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 600 }}>
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
              {capability?.cert_class && (
                <div className="kv">
                  <span className="k">Hạng năng lực</span>
                  <span className="v">{capability.cert_class}</span>
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
                  {settings.cta === 'call' && tel ? (
                    // doanh nghiệp chọn "Gọi ngay" → công khai đầy đủ số
                    <ContactLink companyId={c.id} className="v" href={`tel:${tel}`} style={{ color: 'var(--orange)' }}>{c.phone}</ContactLink>
                  ) : (
                    <span className="v">{maskPhone(c.phone)}</span>
                  )}
                </div>
              )}
              {c.email && (
                <div className="kv">
                  <span className="k">Email</span>
                  <ContactLink companyId={c.id} className="v" href={`mailto:${c.email}`} style={{ wordBreak: 'break-all', color: 'var(--orange)' }}>{c.email}</ContactLink>
                </div>
              )}
              {c.website && (
                <div className="kv">
                  <span className="k">Website</span>
                  <ContactLink
                    companyId={c.id}
                    className="v"
                    href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--orange)' }}
                  >
                    {c.website.replace(/^https?:\/\//, '')}
                  </ContactLink>
                </div>
              )}
              {webUrl && (
                <div className="kv">
                  <span className="k">{c.website ? 'Trang web trên sàn' : 'Website'}</span>
                  <a className="v" href={webUrl} target="_blank" rel="noopener" style={{ color: 'var(--orange)', wordBreak: 'break-all' }}>{webUrl.replace('https://', '')}</a>
                </div>
              )}
              {c.address && (
                <div className="kv">
                  <span className="k">Địa chỉ</span>
                  <span className="v" style={{ maxWidth: 170 }}>{c.address}</span>
                </div>
              )}
              {settings.hours && (
                <div className="kv">
                  <span className="k">Giờ làm việc</span>
                  <span className="v" style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{settings.hours}</span>
                </div>
              )}
              {settings.response && (
                <div className="kv">
                  <span className="k">Thường phản hồi</span>
                  <span className="v">{RESPONSE_LABELS[settings.response]}</span>
                </div>
              )}
              <ContactLink companyId={c.id} className="btn btn-orange btn-block mt-16" href={`/chat?to=${c.id}`}>
                <svg className="ic"><use href="#ic-chat" /></svg> Gửi tin nhắn
              </ContactLink>
              {settings.links?.zalo && (
                <ContactLink companyId={c.id} className="btn btn-outline btn-block" style={{ marginTop: 8 }} href={settings.links.zalo} target="_blank" rel="nofollow noopener noreferrer">
                  <svg className="ic"><use href="#ic-phone" /></svg> Chat qua Zalo
                </ContactLink>
              )}
              {links.some((l) => l.kind !== 'zalo') && (
                <div className="co-links">
                  {links.filter((l) => l.kind !== 'zalo').map((l) => (
                    <ContactLink key={l.kind} companyId={c.id} href={l.url} target="_blank" rel="nofollow noopener noreferrer">{LINK_META[l.kind].label}</ContactLink>
                  ))}
                </div>
              )}
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
    </div>
  );
}
