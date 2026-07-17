import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import CompanyCard from '@/components/CompanyCard';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SP = { q?: string; category?: string; province?: string; verified?: string };

async function search(sp: SP): Promise<Company[]> {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    let categoryId: string | null = null;
    if (sp.category) {
      const { data } = await supa.from('categories').select('id').eq('slug', sp.category).maybeSingle();
      categoryId = data?.id ?? null;
    }
    const { data } = await supa.rpc('search_companies', {
      q: sp.q || null,
      _category: categoryId,
      _province: sp.province || null,
      _verified_only: sp.verified === 'true',
      _limit: 30,
      _offset: 0,
    });
    return (data ?? []) as Company[];
  } catch {
    return [];
  }
}

type RawParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DirectoryPage({ searchParams }: { searchParams: RawParams }) {
  const sp: SP = {
    q: str(searchParams.q),
    category: str(searchParams.category),
    province: str(searchParams.province),
    verified: str(searchParams.verified),
  };
  const companies = await search(sp);

  return (
    <main className="block">
      <div className="container">
        <div className="sec-head">
          <h2>Doanh nghiệp</h2>
          <span className="muted">{companies.length} kết quả</span>
        </div>

        <form className="searchbar" action="/directory" style={{ marginBottom: 24 }}>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Từ khóa (không dấu cũng được)…" />
          <button className="btn btn-orange" type="submit">Tìm</button>
        </form>

        <div className="company-grid">
          {companies.length ? (
            companies.map((c) => <CompanyCard key={c.id} c={c} />)
          ) : (
            <p className="muted">Không tìm thấy doanh nghiệp phù hợp.</p>
          )}
        </div>
      </div>
    </main>
  );
}
