import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { CompanyDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const c = await getCompany(params.slug);
  if (!c) notFound();

  const cats = (c.company_categories ?? []).map((x) => x.categories?.name).filter(Boolean);
  const provs = (c.company_locations ?? []).map((x) => x.provinces?.name).filter(Boolean);
  const trust = c.trust_scores?.score ?? c.trust_score;

  return (
    <main className="block">
      <div className="container">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: 'var(--navy)', fontSize: 26 }}>{c.name}</h1>
            {c.verified_tier !== 'none' ? (
              <span className="badge badge-verified">✓ Đã xác minh</span>
            ) : (
              <span className="badge">Chưa xác nhận bởi chủ doanh nghiệp</span>
            )}
            {c.intro ? <p style={{ marginTop: 12 }}>{c.intro}</p> : null}
            <p className="muted" style={{ marginTop: 12 }}>
              {cats.length ? <>Lĩnh vực: {cats.join(', ')}. </> : null}
              {provs.length ? <>Khu vực: {provs.join(', ')}.</> : null}
            </p>
          </div>
          <div className="company-card" style={{ minWidth: 200, textAlign: 'center' }}>
            <div className="muted">Trust Score</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#16a34a' }}>{Math.round(trust)}</div>
          </div>
        </div>

        {c.projects && c.projects.length > 0 && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ fontSize: 20, color: 'var(--navy)', marginBottom: 12 }}>Dự án tiêu biểu</h2>
            <div className="company-grid">
              {c.projects.map((p) => (
                <div className="company-card" key={p.id}>
                  <h3>{p.title}</h3>
                  <p className="muted">
                    {[p.role, p.year].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
