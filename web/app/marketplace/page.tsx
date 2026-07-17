import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  need_contractor: 'Tìm nhà thầu',
  need_crew: 'Tìm đội thi công',
  need_supplier: 'Tìm nhà cung cấp',
  partnership: 'Hợp tác',
  offer_service: 'Cung cấp dịch vụ',
  opportunity: 'Cơ hội',
};

async function getListings(): Promise<Listing[]> {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'open')
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);
    return (data ?? []) as Listing[];
  } catch {
    return [];
  }
}

export default async function MarketplacePage() {
  const listings = await getListings();
  return (
    <main className="block">
      <div className="container">
        <div className="sec-head">
          <h2>Nhu cầu &amp; cơ hội</h2>
        </div>
        <div className="company-grid">
          {listings.length ? (
            listings.map((l) => (
              <div className="company-card" key={l.id}>
                <span className="badge">{TYPE_LABEL[l.type] ?? l.type}</span>
                <h3 style={{ marginTop: 8 }}>{l.title}</h3>
                {l.description ? <p className="muted">{l.description.slice(0, 120)}</p> : null}
              </div>
            ))
          ) : (
            <p className="muted">Chưa có tin đăng nào.</p>
          )}
        </div>
      </div>
    </main>
  );
}
