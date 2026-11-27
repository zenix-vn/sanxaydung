import type { Metadata } from 'next';
import RichText from '@/components/RichText';
import { AWARD_KINDS } from '@/lib/profile';
import { thumb } from '@/lib/ui';
import { getSite, getSiteContent, getSiteDocs } from '../data';
import { PageHero, SectionHead, CtaBand } from '../parts';

type Props = { params: { site: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { c } = await getSite(params.site);
  return { title: 'Giới thiệu', description: (c.intro ?? `Giới thiệu ${c.name}`).slice(0, 300), alternates: { canonical: '/gioi-thieu' } };
}

export default async function AboutPage({ params }: Props) {
  const { c, settings, href } = await getSite(params.site);
  const [{ extras }, docs] = await Promise.all([getSiteContent(c.id), getSiteDocs(c.id)]);
  const about = settings.about ?? {};
  const longText = c.description && c.description.trim() !== c.intro?.trim() ? c.description : '';
  const staff = [...(c.staff ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const services = c.services ?? [];
  const { milestones, awards } = extras;
  const tel = c.phone ? c.phone.replace(/[^\d+]/g, '') : null;

  return (
    <>
      <PageHero title={`Giới thiệu ${c.name}`} sub={settings.tagline || c.intro} crumbs={[{ href: href('/'), label: 'Trang chủ' }, { label: 'Giới thiệu' }]} />

      <section className="ws-sec">
        <div className="ws-wrap ws-narrow">
          {c.intro && <p className="ws-lead">{c.intro}</p>}
          {longText && <RichText text={longText} />}
        </div>
      </section>

      {(about.vision || about.mission || about.values?.length) && (
        <section className="ws-sec ws-sec-alt">
          <div className="ws-wrap ws-grid3">
            {about.vision && <div className="ws-card ws-pillar"><span className="ws-ico"><svg className="ic"><use href="#ic-eye" /></svg></span><h3>Tầm nhìn</h3><p>{about.vision}</p></div>}
            {about.mission && <div className="ws-card ws-pillar"><span className="ws-ico"><svg className="ic"><use href="#ic-trending" /></svg></span><h3>Sứ mệnh</h3><p>{about.mission}</p></div>}
            {about.values?.length ? (
              <div className="ws-card ws-pillar"><span className="ws-ico"><svg className="ic"><use href="#ic-heart" /></svg></span><h3>Giá trị cốt lõi</h3>
                <ul className="ws-checks">{about.values.map((v) => <li key={v}><svg className="ic"><use href="#ic-check" /></svg>{v}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {milestones.length > 0 && (
        <section className="ws-sec">
          <div className="ws-wrap ws-narrow">
            <SectionHead eyebrow="Chặng đường" title="Mốc phát triển" />
            <ol className="ws-timeline">
              {[...milestones].sort((a, b) => a.year - b.year).map((m) => (
                <li key={m.id}><b>{m.year}</b><div><h3>{m.title}</h3>{m.description && <p>{m.description}</p>}</div></li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section className="ws-sec ws-sec-alt">
          <div className="ws-wrap">
            <SectionHead eyebrow="Dịch vụ" title="Lĩnh vực chúng tôi cung cấp" />
            <div className="ws-grid3">
              {services.map((s) => (
                <div className="ws-card ws-service" key={s.id}>
                  <span className="ws-ico"><svg className="ic"><use href="#ic-briefcase" /></svg></span>
                  <h3>{s.name}</h3>
                  {s.description && <p>{s.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {staff.length > 0 && (
        <section className="ws-sec">
          <div className="ws-wrap">
            <SectionHead eyebrow="Con người" title="Đội ngũ" />
            <div className="ws-team">
              {staff.map((s) => (
                <div className="ws-member" key={s.id}>
                  {s.avatar_url ? <img src={thumb(s.avatar_url, 240)} alt={s.full_name ?? ''} loading="lazy" /> : <span className="ws-avatar"><svg className="ic"><use href="#ic-worker" /></svg></span>}
                  <h3>{s.full_name}</h3>
                  <p>{[s.title, s.experience_years ? `${s.experience_years} năm kinh nghiệm` : null].filter(Boolean).join(' · ')}</p>
                  {s.certificate && <small>{s.certificate}</small>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {awards.length > 0 && (
        <section className="ws-sec ws-sec-alt">
          <div className="ws-wrap">
            <SectionHead eyebrow="Ghi nhận" title="Giải thưởng & chứng nhận" />
            <div className="ws-grid3">
              {awards.map((a) => (
                <div className="ws-card ws-award" key={a.id}>
                  {a.image_url ? <img src={thumb(a.image_url, 240)} alt={a.title} loading="lazy" /> : <span className="ws-ico"><svg className="ic"><use href="#ic-award" /></svg></span>}
                  <div><small>{AWARD_KINDS[a.kind]}{a.year ? ` · ${a.year}` : ''}</small><h3>{a.title}</h3>{a.issuer && <p>{a.issuer}</p>}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {docs.length > 0 && (
        <section className="ws-sec">
          <div className="ws-wrap ws-narrow">
            <SectionHead eyebrow="Tài liệu" title="Hồ sơ năng lực" />
            <ul className="ws-docs">
              {docs.map((d) => (
                <li key={d.id}>
                  <svg className="ic"><use href="#ic-file-text" /></svg>
                  <span>{d.title}</span>
                  <a className="ws-btn ws-btn-sm" href={`/tai-lieu/${d.id}`} target="_blank" rel="nofollow noopener">Tải về</a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand href={href('/lien-he#bao-gia')} tel={tel} phone={c.phone} />
    </>
  );
}
