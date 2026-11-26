'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { TIER_LABELS } from '@/lib/format';
import { colorFor, initials, thumb } from '@/lib/ui';

type S = { id: string; name: string; slug: string; logo_url: string | null; verified_tier: string; trust_score: number; same_category: boolean; near: boolean; invited: boolean; quoted: boolean; reachable: boolean };

/** Chủ tin xem gợi ý đối tác phù hợp & mời báo giá (RPC suggest_partners / invite_partners). */
export default function SuggestPartners({ listingId }: { listingId: string }) {
  const [rows, setRows] = useState<S[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data, error } = await createSupabaseBrowser().rpc('suggest_partners', { _listing: listingId, _limit: 12 });
    if (error) return setMsg(error.message);
    setRows((data ?? []) as S[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function invite() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await createSupabaseBrowser().rpc('invite_partners', { _listing: listingId, _companies: Array.from(pick) });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(`Đã gửi lời mời tới ${data as number} doanh nghiệp.`);
    setPick(new Set());
    load();
  }

  if (!rows) return <p className="muted" style={{ fontSize: 13 }}>{msg ?? 'Đang tìm đối tác phù hợp…'}</p>;
  if (!rows.length) return <p className="muted" style={{ fontSize: 13 }}>Chưa tìm thấy doanh nghiệp phù hợp. Chọn lĩnh vực và khu vực cho tin để có gợi ý tốt hơn.</p>;

  return (
    <div>
      {rows.map((r) => {
        const disabled = r.invited || r.quoted || !r.reachable;
        return (
          <label key={r.id} className="crud-row" style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled && !r.quoted && !r.invited ? 0.6 : 1 }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={pick.has(r.id)}
              onChange={(e) => setPick((p) => { const n = new Set(p); if (e.target.checked && n.size < 10) n.add(r.id); else n.delete(r.id); return n; })}
              style={{ accentColor: 'var(--orange)', width: 17, height: 17 }}
            />
            {r.logo_url ? (
              <img src={thumb(r.logo_url, 72)} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
            ) : (
              <span style={{ width: 34, height: 34, borderRadius: 9, background: colorFor(r.id), color: '#fff', fontWeight: 800, fontSize: 11, display: 'grid', placeItems: 'center', flex: 'none' }}>{initials(r.name)}</span>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <a href={`/cong-ty/${r.slug}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><b style={{ color: 'var(--navy)' }}>{r.name}</b></a>
              <small className="muted" style={{ display: 'block' }}>
                {[r.same_category ? 'Đúng lĩnh vực' : 'Cùng nhóm ngành', r.near && 'Cùng khu vực', r.verified_tier !== 'none' && TIER_LABELS[r.verified_tier], `Trust ${Math.round(r.trust_score)}`].filter(Boolean).join(' · ')}
              </small>
            </span>
            {r.quoted ? <span className="badge green">Đã báo giá</span> : r.invited ? <span className="badge gray">Đã mời</span> : !r.reachable ? <span className="badge gray" title="Hồ sơ chưa có chủ nhận">Chưa liên hệ được</span> : null}
          </label>
        );
      })}
      {msg && <div className="notice mt-8">{msg}</div>}
      <button type="button" className="btn btn-orange btn-sm mt-16" disabled={busy || pick.size === 0} onClick={invite}>
        {busy ? 'Đang gửi…' : `Mời báo giá${pick.size ? ` (${pick.size})` : ''}`}
      </button>
    </div>
  );
}
