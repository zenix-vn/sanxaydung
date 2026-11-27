import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PROJECT_KINDS } from '@/lib/profile';
import { getSite, getSiteContent, projectCards, telOf } from '../data';
import { PageHero, ProjectTile, CtaBand } from '../parts';

type Props = { params: { site: string }; searchParams?: { loai?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { c } = await getSite(params.site);
  return { title: 'Dự án', description: `Các công trình tiêu biểu ${c.name} đã thực hiện.`, alternates: { canonical: '/du-an' } };
}

export default async function ProjectsPage({ params, searchParams }: Props) {
  const { c, href } = await getSite(params.site);
  const { photos } = await getSiteContent(c.id);
  const all = projectCards(c, photos);
  if (!all.length) notFound();
  const kinds = Array.from(new Set(all.map((p) => p.kind).filter((k): k is string => !!k && k in PROJECT_KINDS)));
  const loai = searchParams?.loai && kinds.includes(searchParams.loai) ? searchParams.loai : null;
  const list = loai ? all.filter((p) => p.kind === loai) : all;

  return (
    <>
      <PageHero title="Dự án tiêu biểu" sub={`${all.length} công trình ${c.name} đã thực hiện`} crumbs={[{ href: href('/'), label: 'Trang chủ' }, { label: 'Dự án' }]} />
      <section className="ws-sec">
        <div className="ws-wrap">
          {kinds.length > 1 && (
            <nav className="ws-filter" aria-label="Lọc theo loại công trình">
              <a href={href('/du-an')} className={loai ? undefined : 'on'}>Tất cả</a>
              {kinds.map((k) => <a key={k} href={`${href('/du-an')}?loai=${k}`} className={loai === k ? 'on' : undefined}>{PROJECT_KINDS[k]}</a>)}
            </nav>
          )}
          <div className="ws-grid3">
            {list.map((p) => <ProjectTile key={p.id} p={p} href={href(p.path)} kind={p.kind ? PROJECT_KINDS[p.kind] : null} />)}
          </div>
        </div>
      </section>
      <CtaBand href={href('/lien-he#bao-gia')} tel={telOf(c.phone)} phone={c.phone} />
    </>
  );
}
