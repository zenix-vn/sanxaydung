import type { Metadata } from 'next';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import { SITE_URL } from '@/lib/ui';
import CompanyCard from '@/components/CompanyCard';

export const dynamic = 'force-dynamic';

const TITLE = 'Sàn Xây Dựng — Kết nối nhà thầu, đội thi công, nhà cung cấp toàn quốc';
const DESC =
  'Tìm nhà thầu xây dựng, đội thi công, nhà cung cấp vật liệu và đơn vị thiết kế uy tín trên toàn quốc. Hồ sơ năng lực đã xác minh, Trust Score, đánh giá xác thực và báo giá nhanh.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'vi_VN', siteName: 'Sàn Xây Dựng', title: TITLE, description: DESC, url: '/' },
  twitter: { title: TITLE, description: DESC },
};

// ---------- Dữ liệu (công khai, cache dùng chung) ----------
type Stats = {
  companies: number; verified: number; provinces: number; projects: number; listings: number;
  groups: Record<string, number>;
  top_categories: { slug: string; name: string; group_key: string; n: number }[];
  top_provinces: { code: string; name: string; n: number }[];
};
type ListingRow = {
  id: string; title: string; type: string; location_text: string | null;
  budget_from: number | null; budget_to: number | null; deadline: string | null; created_at: string;
};

const COMPANY_SELECT = '*, company_categories ( categories (name) ), company_locations ( provinces (name) )';

const fetchHome = cachedPublic(async () => {
  const supa = createSupabasePublic();
  const [stats, top, latest, listings, provinces] = await Promise.all([
    supa.rpc('home_stats'),
    supa.from('companies').select(COMPANY_SELECT).eq('status', 'published').is('deleted_at', null)
      .order('trust_score', { ascending: false }).limit(4),
    supa.from('companies').select(COMPANY_SELECT).eq('status', 'published').is('deleted_at', null)
      .order('created_at', { ascending: false }).order('name').limit(8),
    supa.from('marketplace_listings').select('id, title, type, location_text, budget_from, budget_to, deadline, created_at')
      .eq('status', 'open').is('deleted_at', null).order('created_at', { ascending: false }).limit(6),
    supa.from('provinces').select('code, name').order('name'),
  ]);
  const err = stats.error ?? top.error ?? latest.error ?? listings.error ?? provinces.error;
  if (err) throw err;
  return {
    stats: stats.data as Stats,
    top: top.data ?? [],
    latest: latest.data ?? [],
    listings: (listings.data ?? []) as ListingRow[],
    provinces: (provinces.data ?? []) as { code: string; name: string }[],
  };
}, 'home', 120);

async function getHome() {
  if (!SUPABASE_URL) return null;
  try {
    return await fetchHome();
  } catch {
    return null;
  }
}

// ---------- Nội dung tĩnh ----------
const GROUPS = [
  { key: 'contractor', label: 'Nhà thầu' },
  { key: 'crew', label: 'Đội thi công' },
  { key: 'supplier', label: 'Nhà cung cấp' },
  { key: 'service', label: 'Đơn vị dịch vụ' },
];

const CATEGORIES = [
  { icon: 'ic-building', name: 'Nhà thầu xây dựng', href: '/directory?group=contractor', group: 'contractor' },
  { icon: 'ic-worker', name: 'Đội thi công', href: '/directory?group=crew', group: 'crew' },
  { icon: 'ic-bricks', name: 'Vật liệu xây dựng', href: '/directory?category=vat-lieu', cat: 'vat-lieu' },
  { icon: 'ic-paint', name: 'Nội thất', href: '/directory?category=noi-that', cat: 'noi-that' },
  { icon: 'ic-ruler', name: 'Thiết kế - Kiến trúc', href: '/directory?category=thiet-ke', cat: 'thiet-ke' },
  { icon: 'ic-gear', name: 'Thiết bị - Máy móc', href: '/directory?category=thiet-bi', cat: 'thiet-bi' },
  { icon: 'ic-shield-check', name: 'Giám sát - Khảo sát', href: '/directory?category=giam-sat', cat: 'giam-sat' },
  { icon: 'ic-grid', name: 'Đơn vị dịch vụ', href: '/directory?group=service', group: 'service' },
];

const STEPS = [
  { icon: 'ic-search', t: 'Tìm đối tác', d: 'Lọc theo lĩnh vực, khu vực và mức xác minh để ra danh sách phù hợp.' },
  { icon: 'ic-file-text', t: 'Xem hồ sơ năng lực', d: 'Dự án đã làm, giấy tờ pháp lý, Trust Score và đánh giá từ đối tác thật.' },
  { icon: 'ic-chat', t: 'Kết nối & nhận báo giá', d: 'Nhắn tin trực tiếp hoặc đăng nhu cầu để nhiều đơn vị gửi báo giá.' },
  { icon: 'ic-star', t: 'Hợp tác & đánh giá', d: 'Hoàn tất hợp tác trên sàn rồi đánh giá nhau, xây dựng uy tín lâu dài.' },
];

const WHY = [
  { icon: 'ic-shield-check', t: 'Xác minh pháp lý', d: 'Mã số thuế, giấy phép kinh doanh và chứng chỉ năng lực được đội ngũ kiểm tra trước khi cấp huy hiệu.', href: '/huong-dan' },
  { icon: 'ic-award', t: 'Trust Score minh bạch', d: 'Điểm tin cậy tính tự động từ xác minh, đánh giá, dự án và độ hoàn thiện hồ sơ.', href: '/trust-score' },
  { icon: 'ic-thumb', t: 'Đánh giá xác thực', d: 'Chỉ doanh nghiệp đã hợp tác hoàn tất trên sàn mới được đánh giá — chống review ảo.', href: '/cau-hoi-thuong-gap' },
  { icon: 'ic-coin', t: 'Miễn phí để bắt đầu', d: 'Tạo hồ sơ, tìm đối tác và nhận báo giá miễn phí; nâng cấp khi cần nổi bật hơn.', href: '/pricing' },
];

const FAQ: [string, string][] = [
  ['Sàn Xây Dựng là gì?', 'Là nền tảng B2B giúp chủ đầu tư, nhà thầu, đội thi công và nhà cung cấp tìm và kết nối với nhau dựa trên hồ sơ năng lực đã xác minh, điểm tin cậy và đánh giá xác thực.'],
  ['Đăng ký có mất phí không?', 'Không. Tạo hồ sơ doanh nghiệp, tìm đối tác và nhận báo giá đều miễn phí.'],
  ['Doanh nghiệp tôi đã có hồ sơ trên sàn?', 'Nhiều hồ sơ đã được tạo từ thông tin doanh nghiệp đăng ký. Đăng nhập bằng đúng email đã đăng ký để nhận quyền quản lý ngay.'],
  ['Làm sao để được xác minh?', 'Gửi mã số thuế, giấy phép kinh doanh hoặc chứng chỉ năng lực trong bảng điều khiển; huy hiệu được cấp sau khi kiểm tra.'],
];

const LISTING_TYPES: Record<string, string> = {
  need_contractor: 'Cần nhà thầu', need_crew: 'Cần đội thi công', need_supplier: 'Cần nhà cung cấp',
  partnership: 'Hợp tác', offer_service: 'Cung cấp dịch vụ', opportunity: 'Cơ hội',
};

const nf = new Intl.NumberFormat('vi-VN');
const money = (v: number) => (v >= 1e9 ? `${+(v / 1e9).toFixed(1)} tỷ` : v >= 1e6 ? `${Math.round(v / 1e6)} triệu` : nf.format(v));
function budget(l: ListingRow) {
  if (l.budget_from && l.budget_to) return `${money(l.budget_from)} – ${money(l.budget_to)}`;
  if (l.budget_to) return `Đến ${money(l.budget_to)}`;
  if (l.budget_from) return `Từ ${money(l.budget_from)}`;
  return 'Thương lượng';
}

export default async function HomePage() {
  const home = await getHome();
  const s = home?.stats;
  const catCount = (c: (typeof CATEGORIES)[number]) =>
    c.group ? s?.groups?.[c.group] : s?.top_categories.find((x) => x.slug === c.cat)?.n;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Sàn Xây Dựng',
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      email: 'hotro@sanxaydung.vn',
      areaServed: 'VN',
      description: DESC,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Sàn Xây Dựng',
      url: SITE_URL,
      inLanguage: 'vi-VN',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/directory?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    ...(home?.top.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Top doanh nghiệp uy tín',
          itemListElement: home.top.map((c: { slug: string; name: string }, i: number) => ({
            '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/cong-ty/${c.slug}`, name: c.name,
          })),
        }]
      : []),
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .home-chips{display:flex;flex-wrap:wrap;gap:10px}
        .home-chips a{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid var(--line);border-radius:30px;background:#fff;font-size:13.5px;font-weight:600;color:var(--text);transition:.15s}
        .home-chips a:hover{border-color:var(--orange);color:var(--orange)}
        .home-chips a small{background:#f1f4f7;border-radius:20px;padding:1px 8px;font-size:12px;color:var(--muted);font-weight:600}
        .cat .cnt{display:block;font-size:11.5px;color:var(--muted);margin-top:4px;font-weight:500}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:36px}
        .two-col h3{font-size:18px;font-weight:800;color:var(--navy);margin-bottom:14px}
        .steps,.why{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        .step,.whyc{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;position:relative}
        .step .no{position:absolute;top:16px;right:18px;font-size:30px;font-weight:800;color:#eef2f6}
        .step .ico,.whyc .ico{width:46px;height:46px;border-radius:12px;background:#fff4e8;color:var(--orange);display:grid;place-items:center;margin-bottom:14px}
        .step .ico svg,.whyc .ico svg{width:22px;height:22px}
        .step b,.whyc b{display:block;color:var(--navy);font-size:15.5px;margin-bottom:6px}
        .step p,.whyc p{font-size:13.5px;color:var(--muted);line-height:1.6}
        .whyc a{display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:var(--orange)}
        .bg-soft{background:#f6f8fb}
        .lst{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .lst a{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;transition:.15s}
        .lst a:hover{border-color:var(--orange);box-shadow:var(--shadow-sm)}
        .lst .tp{font-size:11.5px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.4px}
        .lst b{display:block;color:var(--navy);font-size:15px;margin:6px 0 10px;line-height:1.35}
        .lst .meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12.5px;color:var(--muted)}
        .empty-box{border:1px dashed #cfd8e3;border-radius:14px;padding:28px;text-align:center;color:var(--muted);background:#fff}
        .faq-home details{border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:10px;background:#fff}
        .faq-home summary{font-weight:700;color:var(--navy);cursor:pointer}
        .faq-home p{margin-top:8px;color:#31414f;font-size:14.5px;line-height:1.65}
        .cta-band{background:linear-gradient(115deg,#021e48,#0a3a78);color:#fff;border-radius:18px;padding:40px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
        .cta-band h2{font-size:26px;font-weight:800;margin-bottom:6px}
        .cta-band p{color:#c6d3e2}
        @media(max-width:1024px){.steps,.why{grid-template-columns:repeat(2,1fr)}.lst{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:760px){.two-col{grid-template-columns:1fr}.steps,.why,.lst{grid-template-columns:1fr}.cta-band{padding:28px}}
      `}</style>

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Sàn kết nối ngành xây dựng Việt Nam</div>
            <h1>
              HỆ SINH THÁI<br />
              <span className="hl">XÂY DỰNG</span> TOÀN DIỆN
            </h1>
            <p className="lead">
              Tìm nhà thầu, đội thi công, nhà cung cấp vật liệu và đơn vị thiết kế uy tín trên toàn quốc — hồ sơ năng
              lực đã xác minh, Trust Score và đánh giá xác thực trên một nền tảng duy nhất.
            </p>
            <div className="hero-cta">
              <a className="btn btn-orange" href="/directory">
                <svg className="ic" style={{ width: 18, height: 18 }}><use href="#ic-search" /></svg> Tìm nhà thầu / Đội thi công
              </a>
              <a className="btn btn-ghost" href="/marketplace/new">
                <svg className="ic" style={{ width: 18, height: 18 }}><use href="#ic-plus" /></svg> Đăng nhu cầu tìm đối tác
              </a>
            </div>

            <form className="searchbar" action="/directory" role="search">
              <div className="field">
                <select defaultValue="" name="group" aria-label="Loại đối tác">
                  <option value="">Tất cả loại đối tác</option>
                  {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
              </div>
              <div className="field">
                <select defaultValue="" name="province" aria-label="Tỉnh / thành">
                  <option value="">Tất cả tỉnh / thành</option>
                  {(home?.provinces ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <select defaultValue="" name="category" aria-label="Lĩnh vực">
                  <option value="">Tất cả lĩnh vực</option>
                  {(s?.top_categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div className="field input">
                <input type="text" name="q" placeholder="Từ khóa: tên doanh nghiệp, dịch vụ..." aria-label="Từ khóa" />
              </div>
              <button className="btn btn-orange" style={{ justifyContent: 'center' }} type="submit">
                Tìm kiếm
              </button>
            </form>

            {s && s.top_categories.length > 0 && (
              <div className="tags">
                <span>Lĩnh vực nhiều doanh nghiệp:</span>
                {s.top_categories.slice(0, 6).map((c) => (
                  <a key={c.slug} href={`/directory?category=${c.slug}`}>{c.name}</a>
                ))}
              </div>
            )}
          </div>

          <div className="hero-stats">
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#f7941d' }}><use href="#ic-building-f" /></svg></div>
              <div>
                <div className="lbl">Doanh nghiệp trên sàn</div>
                <div className="num">{s ? nf.format(s.companies) : '—'}</div>
                <div className="sub">Hồ sơ năng lực công khai</div>
              </div>
            </div>
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#3f8fd6' }}><use href="#ic-shield-check" /></svg></div>
              <div>
                <div className="lbl">Đã xác minh pháp lý</div>
                <div className="num">{s ? nf.format(s.verified) : '—'}</div>
                <div className="sub">Mã số thuế / giấy phép <span className="check"><svg className="ic"><use href="#ic-check" /></svg></span></div>
              </div>
            </div>
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#f7941d' }}><use href="#ic-pin" /></svg></div>
              <div>
                <div className="lbl">Tỉnh / thành phủ sóng</div>
                <div className="num">{s ? nf.format(s.provinces) : '—'}</div>
                <div className="sub">Trên cả nước</div>
              </div>
            </div>
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#3f8fd6' }}><use href="#ic-clipboard-f" /></svg></div>
              <div>
                <div className="lbl">Dự án tiêu biểu</div>
                <div className="num">{s ? nf.format(s.projects) : '—'}</div>
                <div className="sub">Trong hồ sơ năng lực</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STAT STRIP ===== */}
      {s && (
        <div className="strip">
          <div className="container">
            {GROUPS.map((g, i) => (
              <a className="sitem" key={g.key} href={`/directory?group=${g.key}`}>
                <span className="ico"><svg className="ic"><use href={`#${['ic-building', 'ic-worker', 'ic-bricks', 'ic-briefcase'][i]}`} /></svg></span>
                <div><b>{nf.format(s.groups?.[g.key] ?? 0)}</b><span>{g.label}</span></div>
              </a>
            ))}
            <a className="sitem" href="/marketplace">
              <span className="ico"><svg className="ic"><use href="#ic-doc" /></svg></span>
              <div><b>{nf.format(s.listings)}</b><span>Nhu cầu đang mở</span></div>
            </a>
          </div>
        </div>
      )}

      {/* ===== CATEGORIES ===== */}
      <section className="block">
        <div className="container">
          <div className="sec-head">
            <h2>Danh mục phổ biến</h2>
            <a href="/directory">Xem tất cả →</a>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map((c) => {
              const n = catCount(c);
              return (
                <a className="cat" href={c.href} key={c.name}>
                  <div className="ico"><svg className="ic"><use href={`#${c.icon}`} /></svg></div>
                  <span>{c.name}</span>
                  {n ? <span className="cnt">{nf.format(n)} doanh nghiệp</span> : null}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== TOP COMPANIES ===== */}
      <section className="block company-block">
        <div className="container">
          <div className="sec-head">
            <h2>Top doanh nghiệp uy tín</h2>
            <a href="/directory?sort=trust">Xem tất cả →</a>
          </div>
          <div className="comp-grid">
            {(home?.top ?? []).map((c: { id: string }) => (
              <CompanyCard key={c.id} c={c as never} />
            ))}
            <div className="cta-card">
              <h3>Đăng ký doanh nghiệp ngay</h3>
              <p>Tạo hồ sơ doanh nghiệp để kết nối và mở rộng cơ hội kinh doanh của bạn.</p>
              <a className="btn btn-orange" href="/login" style={{ alignSelf: 'flex-start' }}>
                Đăng ký miễn phí →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="block bg-soft">
        <div className="container">
          <div className="sec-head">
            <h2>Cách Sàn Xây Dựng hoạt động</h2>
            <a href="/huong-dan">Hướng dẫn chi tiết →</a>
          </div>
          <div className="steps">
            {STEPS.map((st, i) => (
              <div className="step" key={st.t}>
                <span className="no">0{i + 1}</span>
                <div className="ico"><svg className="ic"><use href={`#${st.icon}`} /></svg></div>
                <b>{st.t}</b>
                <p>{st.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NEW COMPANIES ===== */}
      {home && home.latest.length > 0 && (
        <section className="block">
          <div className="container">
            <div className="sec-head">
              <h2>Doanh nghiệp mới tham gia</h2>
              <a href="/directory">Xem danh bạ →</a>
            </div>
            <div className="comp-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              {home.latest.map((c: { id: string }) => <CompanyCard key={c.id} c={c as never} />)}
            </div>
          </div>
        </section>
      )}

      {/* ===== LATEST LISTINGS ===== */}
      <section className="block bg-soft">
        <div className="container">
          <div className="sec-head">
            <h2>Nhu cầu & báo giá mới nhất</h2>
            <a href="/marketplace">Xem tất cả →</a>
          </div>
          {home && home.listings.length > 0 ? (
            <div className="lst">
              {home.listings.map((l) => (
                <a key={l.id} href={`/marketplace/${l.id}`}>
                  <span className="tp">{LISTING_TYPES[l.type] ?? 'Nhu cầu'}</span>
                  <b>{l.title}</b>
                  <div className="meta">
                    <span><svg className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }}><use href="#ic-coin" /></svg> {budget(l)}</span>
                    {l.location_text && <span><svg className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }}><use href="#ic-pin" /></svg> {l.location_text}</span>}
                    {l.deadline && <span><svg className="ic" style={{ width: 13, height: 13, verticalAlign: -2 }}><use href="#ic-clock" /></svg> Hạn {new Date(l.deadline).toLocaleDateString('vi-VN')}</span>}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              <p style={{ marginBottom: 14 }}>Bạn đang cần nhà thầu, đội thi công hay vật liệu? Đăng nhu cầu để các doanh nghiệp phù hợp gửi báo giá cho bạn.</p>
              <a className="btn btn-orange" href="/marketplace/new">Đăng nhu cầu miễn phí</a>
            </div>
          )}
        </div>
      </section>

      {/* ===== BROWSE BY AREA / FIELD (liên kết nội bộ cho SEO) ===== */}
      {s && (
        <section className="block">
          <div className="container two-col">
            <div>
              <h3>Tìm doanh nghiệp theo khu vực</h3>
              <div className="home-chips">
                {s.top_provinces.map((p) => (
                  <a key={p.code} href={`/directory?province=${p.code}`}>Xây dựng {p.name} <small>{p.n}</small></a>
                ))}
              </div>
            </div>
            <div>
              <h3>Tìm theo lĩnh vực</h3>
              <div className="home-chips">
                {s.top_categories.map((c) => (
                  <a key={c.slug} href={`/directory?category=${c.slug}`}>{c.name} <small>{c.n}</small></a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== WHY ===== */}
      <section className="block bg-soft">
        <div className="container">
          <div className="sec-head"><h2>Vì sao chọn Sàn Xây Dựng?</h2></div>
          <div className="why">
            {WHY.map((w) => (
              <div className="whyc" key={w.t}>
                <div className="ico"><svg className="ic"><use href={`#${w.icon}`} /></svg></div>
                <b>{w.t}</b>
                <p>{w.d}</p>
                <a href={w.href}>Tìm hiểu thêm →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="block">
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="sec-head">
            <h2>Câu hỏi thường gặp</h2>
            <a href="/cau-hoi-thuong-gap">Xem thêm →</a>
          </div>
          <div className="faq-home">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="block" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <div>
              <h2>Đưa doanh nghiệp của bạn lên Sàn Xây Dựng</h2>
              <p>Hồ sơ năng lực số, huy hiệu xác minh và cơ hội nhận báo giá từ khắp cả nước — miễn phí để bắt đầu.</p>
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <a className="btn btn-orange btn-lg" href="/login">Đăng ký miễn phí</a>
              <a className="btn btn-ghost btn-lg" href="/dashboard/claim">Nhận hồ sơ có sẵn</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
