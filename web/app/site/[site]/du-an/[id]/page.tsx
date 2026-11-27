import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { PROJECT_KINDS } from '@/lib/profile';
import { projectKey } from '@/lib/site';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { getSite, getSiteContent, projectCards, telOf, type Site } from '../../data';
import { PageHero, ProjectTile, CtaBand } from '../../parts';

type Props = { params: { site: string; id: string } };

const provinceName = cachedPublic(async (code: string) => {
  const { data, error } = await createSupabasePublic().from('provinces').select('name').eq('code', code).maybeSingle();
  if (error) throw error;
  return (data?.name as string | undefined) ?? null;
}, 'province-name', 86400);

async function load(params: Props['params']) {
  const s: Site = await getSite(params.site);
  const key = projectKey(params.id);
  const { photos } = await getSiteContent(s.c.id);
  const cards = projectCards(s.c, photos);
  const p = key ? cards.find((x) => x.id.startsWith(key)) : undefined;
  if (!p) notFound();
  return { ...s, p, cards };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { c, p } = await load(params);
  const img = p.cover_url ?? p.photos[0];
  return {
    title: p.title,
    description: (p.description ?? `${p.title} — dự án do ${c.name} thực hiện.`).slice(0, 300),
    alternates: { canonical: p.path },
    openGraph: img ? { images: [img] } : undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { c, href, p, cards } = await load(params);
  // Đường dẫn cũ (đổi tiêu đề) → chuyển về đường dẫn đúng
  if (`/du-an/${params.id}` !== p.path) permanentRedirect(href(p.path));
  const province = p.province_code ? await provinceName(p.province_code).catch(() => null) : null;
  const images = Array.from(new Set([p.cover_url, ...p.photos].filter((u): u is string => !!u)));
  const others = cards.filter((x) => x.id !== p.id).slice(0, 3);
  const facts = [
    ['Loại công trình', p.kind ? PROJECT_KINDS[p.kind] : null],
    ['Vai trò', p.role],
    ['Địa điểm', province],
    ['Năm', p.year ? String(p.year) : null],
  ].filter((f): f is [string, string] => !!f[1]);

  return (
    <>
      <PageHero title={p.title} sub={facts.map((f) => f[1]).join(' · ')} crumbs={[{ href: href('/'), label: 'Trang chủ' }, { href: href('/du-an'), label: 'Dự án' }, { label: p.title }]} />
      <section className="ws-sec">
        <div className="ws-wrap ws-proj-detail">
          <div>
            {images.length > 0 ? (
              <div className="ws-gallery">
                {images.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noopener" className={i === 0 ? 'big' : undefined}>
                    <img src={u} alt={`${p.title} — ảnh ${i + 1}`} loading={i ? 'lazy' : 'eager'} />
                  </a>
                ))}
              </div>
            ) : (
              <div className="ws-proj-img ws-proj-empty"><span><svg className="ic"><use href="#ic-building" /></svg></span></div>
            )}
            {p.description && <div className="ws-prose">{p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>}
          </div>
          <aside className="ws-card ws-facts-card">
            <h3>Thông tin dự án</h3>
            <ul className="ws-facts">{facts.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>
            <a className="ws-btn ws-btn-block" href={href('/lien-he#bao-gia')}>Tư vấn công trình tương tự</a>
          </aside>
        </div>
      </section>
      {others.length > 0 && (
        <section className="ws-sec ws-sec-alt">
          <div className="ws-wrap">
            <h2 className="ws-h2s">Dự án khác</h2>
            <div className="ws-grid3">
              {others.map((o) => <ProjectTile key={o.id} p={o} href={href(o.path)} kind={o.kind ? PROJECT_KINDS[o.kind] : null} />)}
            </div>
          </div>
        </section>
      )}
      <CtaBand href={href('/lien-he#bao-gia')} tel={telOf(c.phone)} phone={c.phone} />
    </>
  );
}
