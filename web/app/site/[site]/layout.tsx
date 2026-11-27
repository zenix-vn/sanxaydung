import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { SITE_URL, initials } from '@/lib/ui';
import { brandVars, readableBrand } from '@/lib/profile';
import { siteUrl } from '@/lib/site';
import { getSite, telOf } from './data';
import SiteNav from './SiteNav';
import { ContactLink, TrackSiteView } from '@/components/Track';
import './site.css';

type Props = { children: ReactNode; params: { site: string } };

const DEFAULT_BRAND = '#12439c';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { c, settings, base } = await getSite(params.site);
  const desc = (settings.tagline || c.intro || `${c.name} — hồ sơ năng lực, dự án tiêu biểu và thông tin liên hệ.`).slice(0, 300);
  const root = siteUrl(c);
  return {
    metadataBase: new URL(root ?? SITE_URL),
    // absolute: không kế thừa mẫu "… | Sàn Xây Dựng" của layout gốc
    title: { absolute: settings.tagline ? `${c.name} – ${settings.tagline}` : c.name, template: `%s | ${c.name}` },
    description: desc,
    applicationName: c.name,
    // Xem qua tên miền của sàn (/site/<x>) chỉ là bản xem trước: không cho Google lập chỉ mục
    robots: base ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'website', locale: 'vi_VN', siteName: c.name, description: desc, ...(c.cover_url || c.logo_url ? { images: [c.cover_url || c.logo_url!] } : {}) },
    icons: c.logo_url ? { icon: c.logo_url, apple: c.logo_url } : undefined,
    verification: {},
    manifest: null,
  };
}

export default async function SiteLayout({ children, params }: Props) {
  const { c, settings, href } = await getSite(params.site);
  const brand = readableBrand(settings.brand_color ?? DEFAULT_BRAND);
  const v = brandVars(brand);
  const style = { '--b': brand, '--b2': v['--orange-2'], '--bs': v['--orange-soft'], '--bl': v['--brand-line'] } as CSSProperties;
  const tel = telOf(c.phone);
  const zalo = settings.links?.zalo;
  const year = new Date().getFullYear();
  const nav = [
    { href: href('/'), label: 'Trang chủ' },
    { href: href('/gioi-thieu'), label: 'Giới thiệu' },
    ...((c.projects ?? []).length ? [{ href: href('/du-an'), label: 'Dự án' }] : []),
    { href: href('/lien-he'), label: 'Liên hệ' },
  ];
  const logo = c.logo_url
    ? <img className="ws-logo" src={c.logo_url} alt={c.name} />
    : <span className="ws-logo ws-logo-ini">{initials(c.name)}</span>;

  return (
    <div className="ws" style={style}>
      <TrackSiteView companyId={c.id} />
      <div className="ws-top">
        <div className="ws-wrap">
          {c.phone && <a href={`tel:${tel}`}><svg className="ic"><use href="#ic-phone" /></svg>{c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`}><svg className="ic"><use href="#ic-mail" /></svg>{c.email}</a>}
          {settings.hours && <span className="ws-hide-sm"><svg className="ic"><use href="#ic-clock" /></svg>{settings.hours.split('\n')[0]}</span>}
        </div>
      </div>

      <header className="ws-head">
        <div className="ws-wrap ws-head-in">
          <a className="ws-brand" href={href('/')}>
            {logo}
            <span className="ws-brand-name">{c.name}</span>
          </a>
          <SiteNav items={nav} cta={{ href: href('/lien-he#bao-gia'), label: 'Nhận báo giá' }} />
        </div>
      </header>

      <main>{children}</main>

      <footer className="ws-foot">
        <div className="ws-wrap ws-foot-grid">
          <div>
            <a className="ws-brand ws-brand-light" href={href('/')}>{logo}<span className="ws-brand-name">{c.name}</span></a>
            {(settings.tagline || c.intro) && <p className="ws-foot-desc">{settings.tagline || c.intro}</p>}
            {c.legal_name && <p className="ws-foot-legal">{c.legal_name}{c.tax_code ? ` · MST ${c.tax_code}` : ''}</p>}
          </div>
          <div>
            <h4>Liên kết</h4>
            <ul>{nav.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}</ul>
          </div>
          <div>
            <h4>Liên hệ</h4>
            <ul>
              {c.address && <li><svg className="ic"><use href="#ic-pin" /></svg>{c.address}</li>}
              {c.phone && <li><svg className="ic"><use href="#ic-phone" /></svg><a href={`tel:${tel}`}>{c.phone}</a></li>}
              {c.email && <li><svg className="ic"><use href="#ic-mail" /></svg><a href={`mailto:${c.email}`}>{c.email}</a></li>}
            </ul>
          </div>
        </div>
        <div className="ws-wrap ws-foot-bottom">
          <span>© {year} {c.name}</span>
          <a className="ws-powered" href={`${SITE_URL}/cong-ty/${c.slug}`} target="_blank" rel="noopener">
            <img src={`${SITE_URL}/logo.png`} alt="" width={18} height={18} />
            Website trên Sàn Xây Dựng{c.verified_tier !== 'none' ? ' · Đã xác minh' : ''}
          </a>
        </div>
      </footer>

      {/* Thanh liên hệ nhanh trên điện thoại */}
      <nav className="ws-mbar" aria-label="Liên hệ nhanh">
        {tel && <ContactLink companyId={c.id} href={`tel:${tel}`}><svg className="ic"><use href="#ic-phone" /></svg>Gọi</ContactLink>}
        {zalo && <ContactLink companyId={c.id} href={zalo} target="_blank" rel="nofollow noopener noreferrer"><svg className="ic"><use href="#ic-chat" /></svg>Zalo</ContactLink>}
        <a className="ws-mbar-cta" href={href('/lien-he#bao-gia')}><svg className="ic"><use href="#ic-clipboard" /></svg>Báo giá</a>
      </nav>
    </div>
  );
}
