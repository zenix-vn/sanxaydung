import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { SITE_URL, thumb } from '@/lib/ui';
import { coverPosition, cssUrl, PROJECT_KINDS } from '@/lib/profile';
import { getSite, getSiteContent, projectCards, telOf } from './data';
import { TIER_TEXT, ProjectTile, SectionHead, CtaBand } from './parts';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function SiteHome({ params }: { params: { site: string } }) {
  const { c, settings, href } = await getSite(params.site);
  const { photos, extras } = await getSiteContent(c.id);
  const tel = telOf(c.phone);
  const cats = (c.company_categories ?? []).map((x) => x.categories?.name).filter((x): x is string => !!x);
  const provs = (c.company_locations ?? []).map((x) => x.provinces?.name).filter((x): x is string => !!x);
  const projects = projectCards(c, photos);
  const services = c.services ?? [];
  const partners = extras.partners;
  const reviews = (c.reviews ?? []).filter((r) => r.status === 'published');
  const avg = reviews.length ? reviews.reduce((s, r) => s + (r.overall ?? 0), 0) / reviews.length : 0;
  const trust = Math.round(c.trust_scores?.score ?? c.trust_score ?? 0);
  const cover = settings.banner?.images?.[0] ?? c.cover_url;
  const heroStyle = cover ? ({ backgroundImage: cssUrl(cover), backgroundPosition: coverPosition(settings) } as CSSProperties) : undefined;

  // Số liệu nổi bật: dùng số doanh nghiệp tự khai, nếu không có thì lấy từ dữ liệu hồ sơ
  const stats = settings.highlights?.length
    ? settings.highlights
    : [
        ...(c.founded_year && new Date().getFullYear() - c.founded_year >= 1 ? [{ value: String(new Date().getFullYear() - c.founded_year), label: 'năm kinh nghiệm' }] : []),
        ...(projects.length ? [{ value: String(projects.length), label: 'dự án tiêu biểu' }] : []),
        ...(provs.length ? [{ value: String(provs.length), label: 'tỉnh, thành hoạt động' }] : []),
        ...(c.size_range ? [{ value: c.size_range, label: 'nhân sự' }] : []),
      ];

  return (
    <>
      {/* ── Hero ── */}
      <section className={`ws-hero${cover ? '' : ' plain'}`} style={heroStyle}>
        <div className="ws-wrap ws-hero-in">
          {c.verified_tier !== 'none' && (
            <span className="ws-badge"><svg className="ic"><use href="#ic-shield-check" /></svg>{TIER_TEXT[c.verified_tier]}</span>
          )}
          <h1>{c.name}</h1>
          {settings.tagline && <p className="ws-hero-tag">{settings.tagline}</p>}
          {c.intro && <p className="ws-hero-intro">{c.intro}</p>}
          <div className="ws-hero-cta">
            <a className="ws-btn ws-btn-lg" href={href('/lien-he#bao-gia')}>Nhận báo giá</a>
            {tel && <a className="ws-btn ws-btn-lg ws-btn-ghost" href={`tel:${tel}`}><svg className="ic"><use href="#ic-phone" /></svg>{c.phone}</a>}
          </div>
          {cats.length > 0 && <div className="ws-chips">{cats.slice(0, 5).map((x) => <span key={x}>{x}</span>)}</div>}
        </div>
      </section>

      {stats.length > 0 && (
        <section className="ws-stats">
          <div className="ws-wrap ws-stats-in">
            {stats.map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}
          </div>
        </section>
      )}

      {/* ── Giới thiệu ngắn ── */}
      <section className="ws-sec">
        <div className="ws-wrap ws-about">
          <div>
            <SectionHead eyebrow="Về chúng tôi" title={settings.about?.vision ? 'Tầm nhìn & cam kết' : `Giới thiệu ${c.name}`} />
            <p className="ws-lead">{settings.about?.vision || c.intro || c.description?.slice(0, 400)}</p>
            {settings.about?.values?.length ? (
              <ul className="ws-checks">{settings.about.values.slice(0, 4).map((v) => <li key={v}><svg className="ic"><use href="#ic-check" /></svg>{v}</li>)}</ul>
            ) : null}
            <a className="ws-link" href={href('/gioi-thieu')}>Tìm hiểu thêm <svg className="ic"><use href="#ic-chevron-right" /></svg></a>
          </div>
          <ul className="ws-facts">
            {c.founded_year && <li><span>Thành lập</span><b>{c.founded_year}</b></li>}
            {provs.length > 0 && <li><span>Khu vực</span><b>{provs.slice(0, 4).join(', ')}{provs.length > 4 ? '…' : ''}</b></li>}
            {cats.length > 0 && <li><span>Lĩnh vực</span><b>{cats.slice(0, 3).join(', ')}</b></li>}
            {c.address && <li><span>Trụ sở</span><b>{c.address}</b></li>}
          </ul>
        </div>
      </section>

      {/* ── Dịch vụ ── */}
      {services.length > 0 && (
        <section className="ws-sec ws-sec-alt">
          <div className="ws-wrap">
            <SectionHead eyebrow="Dịch vụ" title="Chúng tôi làm gì" center />
            <div className="ws-grid3">
              {services.slice(0, 6).map((s) => (
                <div className="ws-card ws-service" key={s.id}>
                  <span className="ws-ico"><svg className="ic"><use href="#ic-briefcase" /></svg></span>
                  <h3>{s.name}</h3>
                  {s.description && <p>{s.description.length > 160 ? `${s.description.slice(0, 160)}…` : s.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Dự án ── */}
      {projects.length > 0 && (
        <section className="ws-sec">
          <div className="ws-wrap">
            <SectionHead eyebrow="Dự án" title="Công trình tiêu biểu" center />
            <div className="ws-grid3">
              {projects.slice(0, 6).map((p) => <ProjectTile key={p.id} p={p} href={href(p.path)} kind={p.kind ? PROJECT_KINDS[p.kind] : null} />)}
            </div>
            {projects.length > 6 && <div className="ws-center"><a className="ws-btn ws-btn-ghost-dark" href={href('/du-an')}>Xem tất cả {projects.length} dự án</a></div>}
          </div>
        </section>
      )}

      {/* ── Khách hàng & đối tác ── */}
      {partners.length > 0 && (
        <section className="ws-sec ws-sec-alt ws-sec-tight">
          <div className="ws-wrap">
            <p className="ws-eyebrow ws-center">Khách hàng & đối tác đã đồng hành</p>
            <div className="ws-logos">
              {partners.slice(0, 12).map((p) => {
                const img = p.linked?.logo_url || p.logo_url;
                return img ? <img key={p.id} src={thumb(img, 200)} alt={p.linked?.name || p.name} title={p.linked?.name || p.name} loading="lazy" /> : <span key={p.id}>{p.linked?.name || p.name}</span>;
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Uy tín trên Sàn Xây Dựng ── */}
      {(c.verified_tier !== 'none' || reviews.length > 0 || trust > 0) && (
        <section className="ws-sec">
          <div className="ws-wrap ws-trust">
            <div>
              <SectionHead eyebrow="Uy tín được kiểm chứng" title={reviews.length ? 'Đối tác nói gì về chúng tôi' : 'Uy tín trên Sàn Xây Dựng'} />
              <div className="ws-trust-row">
                {trust > 0 && <div className="ws-score"><b>{trust}</b><span>Trust Score</span></div>}
                {reviews.length > 0 && <div className="ws-score"><b>{avg.toFixed(1)}<small>/5</small></b><span>{reviews.length} đánh giá</span></div>}
                {c.verified_tier !== 'none' && <div className="ws-score"><b><svg className="ic"><use href="#ic-shield-check" /></svg></b><span>{TIER_TEXT[c.verified_tier]}</span></div>}
              </div>
              <p className="ws-muted">Điểm uy tín và đánh giá do Sàn Xây Dựng tổng hợp từ xác minh pháp lý và các đối tác đã hợp tác thật.</p>
              <a className="ws-link" href={`${SITE_URL}/cong-ty/${c.slug}#danhgia`} target="_blank" rel="noopener">Xem hồ sơ trên Sàn Xây Dựng <svg className="ic"><use href="#ic-chevron-right" /></svg></a>
            </div>
            {reviews.length > 0 && (
              <div className="ws-quotes">
                {reviews.filter((r) => r.comment).slice(0, 2).map((r) => (
                  <blockquote key={r.id} className="ws-card">
                    <div className="ws-stars" aria-label={`${r.overall ?? 0}/5`}>{'★★★★★'.slice(0, Math.round(r.overall ?? 0))}<i>{'★★★★★'.slice(Math.round(r.overall ?? 0))}</i></div>
                    <p>“{r.comment!.length > 220 ? `${r.comment!.slice(0, 220)}…` : r.comment}”</p>
                    {r.reviewer_company && <cite>{r.reviewer_company.name}</cite>}
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <CtaBand href={href('/lien-he#bao-gia')} tel={tel} phone={c.phone} />
    </>
  );
}
