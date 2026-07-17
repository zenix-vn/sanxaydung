import type { Company } from '@/lib/types';

type CompanyWithRel = Company & {
  company_categories?: { categories: { name: string } | null }[];
  company_locations?: { provinces: { name: string } | null }[];
};

const TIER: Record<string, string> = {
  legal: 'Đã xác minh',
  capability: 'Xác minh năng lực',
  gold: 'Đối tác vàng',
};

export default function CompanyCard({ c }: { c: CompanyWithRel }) {
  const category = c.company_categories?.[0]?.categories?.name ?? 'Doanh nghiệp';
  const loc = c.company_locations?.[0]?.provinces?.name ?? null;
  const verified = c.verified_tier !== 'none';
  const tierLabel = verified ? TIER[c.verified_tier] ?? 'Đã xác minh' : 'Chưa xác minh';

  return (
    <a className="comp" href={`/cong-ty/${c.slug}`}>
      <div className="comp-top">
        <div className="comp-logo">
          {c.logo_url ? (
            <img src={c.logo_url} alt={c.name} />
          ) : (
            <svg className="ic" style={{ width: 34, height: 34 }}>
              <use href="#ic-building" />
            </svg>
          )}
        </div>
        <div>
          <h3>{c.name}</h3>
          <span className="badge">{category}</span>
        </div>
      </div>
      {loc ? (
        <div className="loc">
          <svg className="ic">
            <use href="#ic-pin" />
          </svg>{' '}
          {loc}
        </div>
      ) : null}
      <div className="stars">
        <span className="star">{verified ? '✓' : '★'}</span>
        <b style={{ color: verified ? '#16a34a' : 'var(--muted)' }}>{tierLabel}</b>
      </div>
      <div className="trust">
        <small>Trust Score</small>
        <b>{Math.round(c.trust_score)}</b>
      </div>
    </a>
  );
}
