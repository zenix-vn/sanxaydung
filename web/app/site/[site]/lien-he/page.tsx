import type { Metadata } from 'next';
import { ContactLink } from '@/components/Track';
import LeadForm from '../LeadForm';
import BranchMap, { type Pin } from '@/app/(san)/cong-ty/[slug]/BranchMap';
import { getSite, getSiteContent, telOf } from '../data';
import { PageHero, SectionHead } from '../parts';

type Props = { params: { site: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { c } = await getSite(params.site);
  return {
    title: 'Liên hệ',
    description: `Liên hệ ${c.name}${c.address ? ` — ${c.address}` : ''}${c.phone ? ` — ${c.phone}` : ''}.`.slice(0, 300),
    alternates: { canonical: '/lien-he' },
  };
}

export default async function ContactPage({ params }: Props) {
  const { c, settings, href } = await getSite(params.site);
  const { extras } = await getSiteContent(c.id);
  const tel = telOf(c.phone);
  const zalo = settings.links?.zalo;
  const branches = extras.branches;
  const pins: Pin[] = branches.filter((b) => b.lat != null && b.lng != null).map((b) => ({ name: b.name, lat: b.lat!, lng: b.lng! }));
  const faqs = extras.faqs;

  return (
    <>
      <PageHero title="Liên hệ" sub={`Kết nối với ${c.name} để được tư vấn và báo giá.`} crumbs={[{ href: href('/'), label: 'Trang chủ' }, { label: 'Liên hệ' }]} />

      <section className="ws-sec">
        <div className="ws-wrap ws-contact">
          <div className="ws-card">
            <h2 className="ws-h2s">Thông tin liên hệ</h2>
            <ul className="ws-clist">
              {c.address && <li><svg className="ic"><use href="#ic-pin" /></svg><div><small>Địa chỉ</small>{c.address}</div></li>}
              {c.phone && <li><svg className="ic"><use href="#ic-phone" /></svg><div><small>Điện thoại</small><ContactLink companyId={c.id} href={`tel:${tel}`}>{c.phone}</ContactLink></div></li>}
              {c.email && <li><svg className="ic"><use href="#ic-mail" /></svg><div><small>Email</small><ContactLink companyId={c.id} href={`mailto:${c.email}`}>{c.email}</ContactLink></div></li>}
              {settings.hours && <li><svg className="ic"><use href="#ic-clock" /></svg><div><small>Giờ làm việc</small><span className="ws-pre">{settings.hours}</span></div></li>}
            </ul>
          </div>

          <div className="ws-card ws-quote" id="bao-gia">
            <h2 className="ws-h2s">Gửi yêu cầu báo giá</h2>
            <p className="ws-muted">Để lại thông tin, chúng tôi sẽ gọi lại tư vấn trong giờ làm việc.</p>
            <LeadForm companyId={c.id} companyName={c.name} />
            <div className="ws-qopts">
              {tel && <ContactLink companyId={c.id} className="ws-btn ws-btn-block ws-btn-ghost-dark" href={`tel:${tel}`}><svg className="ic"><use href="#ic-phone" /></svg>Hoặc gọi ngay {c.phone}</ContactLink>}
              {zalo && <ContactLink companyId={c.id} className="ws-btn ws-btn-block ws-btn-ghost-dark" href={zalo} target="_blank" rel="nofollow noopener noreferrer"><svg className="ic"><use href="#ic-chat" /></svg>Nhắn Zalo</ContactLink>}
            </div>
          </div>
        </div>
      </section>

      {branches.length > 0 && (
        <section className="ws-sec ws-sec-alt">
          <div className="ws-wrap">
            <SectionHead eyebrow="Hệ thống" title="Chi nhánh & văn phòng" />
            {pins.length > 0 && <BranchMap pins={pins} />}
            <div className="ws-grid3" style={{ marginTop: 24 }}>
              {branches.map((b) => (
                <div className="ws-card" key={b.id}>
                  <h3 className="ws-h3">{b.name}</h3>
                  {b.address && <p className="ws-muted">{b.address}</p>}
                  {b.phone && <a className="ws-link" href={`tel:${telOf(b.phone)}`}>{b.phone}</a>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="ws-sec">
          <div className="ws-wrap ws-narrow">
            <SectionHead eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" />
            <div className="ws-faq">
              {faqs.map((f) => (
                <details key={f.id}>
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
