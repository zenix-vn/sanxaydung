// Thành phần dùng chung giữa các trang của website doanh nghiệp (server components).
import type { VerifiedTier } from '@/lib/types';
import type { ProjectCard } from './data';

export const TIER_TEXT: Record<VerifiedTier, string> = {
  none: '',
  legal: 'Đã xác minh pháp lý',
  capability: 'Đã xác minh năng lực',
  gold: 'Đối tác uy tín',
};

export function SectionHead({ eyebrow, title, center }: { eyebrow?: string; title: string; center?: boolean }) {
  return (
    <div className={`ws-head2${center ? ' ws-center' : ''}`}>
      {eyebrow && <p className="ws-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
    </div>
  );
}

export function PageHero({ title, sub, crumbs }: { title: string; sub?: string | null; crumbs: { href?: string; label: string }[] }) {
  return (
    <section className="ws-phero">
      <div className="ws-wrap">
        <nav className="ws-crumbs" aria-label="Đường dẫn">
          {crumbs.map((c, i) => (
            <span key={i}>{c.href ? <a href={c.href}>{c.label}</a> : c.label}</span>
          ))}
        </nav>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </section>
  );
}

export function ProjectTile({ p, href, kind }: { p: ProjectCard; href: string; kind: string | null }) {
  const img = p.cover_url ?? p.photos[0];
  return (
    <a className="ws-card ws-proj" href={href}>
      <div className="ws-proj-img">
        {img ? <img src={img} alt={p.title} loading="lazy" /> : <span><svg className="ic"><use href="#ic-building" /></svg></span>}
        {p.featured && <em>Nổi bật</em>}
      </div>
      <div className="ws-proj-body">
        <h3>{p.title}</h3>
        <p>{[kind, p.role, p.year].filter(Boolean).join(' · ')}</p>
      </div>
    </a>
  );
}

export function CtaBand({ href, tel, phone }: { href: string; tel: string | null; phone: string | null }) {
  return (
    <section className="ws-cta">
      <div className="ws-wrap ws-cta-in">
        <div>
          <h2>Bạn đang chuẩn bị một công trình?</h2>
          <p>Gửi yêu cầu, chúng tôi sẽ liên hệ tư vấn và báo giá chi tiết.</p>
        </div>
        <div className="ws-hero-cta">
          <a className="ws-btn ws-btn-lg ws-btn-white" href={href}>Gửi yêu cầu báo giá</a>
          {tel && <a className="ws-btn ws-btn-lg ws-btn-ghost" href={`tel:${tel}`}><svg className="ic"><use href="#ic-phone" /></svg>{phone}</a>}
        </div>
      </div>
    </section>
  );
}
