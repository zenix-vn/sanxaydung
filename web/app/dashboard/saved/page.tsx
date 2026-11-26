import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { TIER_LABELS, LISTING_TYPE_LABEL, LISTING_STATUS, fmtRange, fmtDate } from '@/lib/format';
import { colorFor, initials, thumb } from '@/lib/ui';
import SaveButton from '@/components/SaveButton';
import CompareForm from './CompareForm';

export const metadata: Metadata = { title: 'Đã lưu' };
export const dynamic = 'force-dynamic';

type Co = { id: string; name: string; slug: string; logo_url: string | null; verified_tier: string; trust_score: number | null; intro: string | null };
type L = { id: string; title: string; type: string; status: string; budget_from: number | null; budget_to: number | null; deadline: string | null; deleted_at: string | null };

export default async function SavedPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supa, user } = await requireUserCompany('/dashboard/saved');
  const tab = searchParams.tab === 'listings' ? 'listings' : 'companies';
  const { data: items } = await supa.from('saved_items').select('kind, item_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
  const rows = (items ?? []) as { kind: string; item_id: string }[];
  const coIds = rows.filter((r) => r.kind === 'company').map((r) => r.item_id);
  const lIds = rows.filter((r) => r.kind === 'listing').map((r) => r.item_id);

  const [{ data: cos }, { data: ls }] = await Promise.all([
    coIds.length ? supa.from('companies').select('id, name, slug, logo_url, verified_tier, trust_score, intro').in('id', coIds) : Promise.resolve({ data: [] }),
    lIds.length ? supa.from('marketplace_listings').select('id, title, type, status, budget_from, budget_to, deadline, deleted_at').in('id', lIds) : Promise.resolve({ data: [] }),
  ]);
  // giữ thứ tự "mới lưu trước"; mục đã bị ẩn/xóa (RLS không trả về) bị bỏ qua
  const coMap = new Map(((cos ?? []) as Co[]).map((c) => [c.id, c]));
  const lMap = new Map(((ls ?? []) as L[]).map((l) => [l.id, l]));
  const companies = coIds.map((id) => coMap.get(id)).filter(Boolean) as Co[];
  const listings = lIds.map((id) => lMap.get(id)).filter((l): l is L => !!l && !l.deleted_at);

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Đã lưu</h1>
          <p>Doanh nghiệp và tin đăng bạn đánh dấu để xem lại, so sánh trước khi chọn đối tác.</p>
        </div>
      </div>
      <div className="dcard">
        <div className="dtabs">
          <a className={tab === 'companies' ? 'active' : ''} href="/dashboard/saved">Doanh nghiệp <span className="n">{companies.length}</span></a>
          <a className={tab === 'listings' ? 'active' : ''} href="/dashboard/saved?tab=listings">Tin đăng <span className="n">{listings.length}</span></a>
        </div>

        {tab === 'companies' ? (
          companies.length === 0 ? (
            <div className="empty"><svg className="ic"><use href="#ic-heart" /></svg>Chưa lưu doanh nghiệp nào. Bấm “Lưu” trên hồ sơ doanh nghiệp để thêm vào đây. <a href="/directory">Tìm doanh nghiệp →</a></div>
          ) : (
            <CompareForm>
              {companies.map((c) => (
                <div key={c.id} className="crud-row">
                  <input type="checkbox" name="c" value={c.slug} aria-label={`Chọn ${c.name} để so sánh`} style={{ accentColor: 'var(--orange)', width: 18, height: 18 }} />
                  {c.logo_url ? (
                    <img src={thumb(c.logo_url, 80)} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ width: 40, height: 40, borderRadius: 10, background: colorFor(c.id), color: '#fff', fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center', flex: 'none' }}>{initials(c.name)}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`/cong-ty/${c.slug}`}><b style={{ color: 'var(--navy)' }}>{c.name}</b></a>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {TIER_LABELS[c.verified_tier] ?? ''} · Trust {Math.round(c.trust_score ?? 0)}
                      {c.intro ? ` · ${c.intro.slice(0, 80)}` : ''}
                    </div>
                  </div>
                  <SaveButton kind="company" itemId={c.id} className="btn btn-outline btn-sm" compact />
                </div>
              ))}
            </CompareForm>
          )
        ) : listings.length === 0 ? (
          <div className="empty"><svg className="ic"><use href="#ic-heart" /></svg>Chưa lưu tin đăng nào. <a href="/marketplace">Xem nhu cầu đang mở →</a></div>
        ) : (
          listings.map((l) => (
            <div key={l.id} className="crud-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/marketplace/${l.id}`}><b style={{ color: 'var(--navy)' }}>{l.title}</b></a>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {LISTING_TYPE_LABEL[l.type] ?? l.type}
                  {fmtRange(l.budget_from, l.budget_to) ? ` · ${fmtRange(l.budget_from, l.budget_to)}` : ''}
                  {l.deadline ? ` · hạn ${fmtDate(l.deadline)}` : ''}
                </div>
              </div>
              <span className={`badge ${LISTING_STATUS[l.status]?.cls ?? 'gray'}`}>{LISTING_STATUS[l.status]?.label ?? l.status}</span>
              <SaveButton kind="listing" itemId={l.id} className="btn btn-outline btn-sm" compact />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
