'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type M = { id: string; name: string; phone: string | null; verified_tier: string; same_category: boolean; near: boolean; reachable: boolean; invited: boolean; quoted: boolean };
const MAX = 20;

/** Gợi ý doanh nghiệp phù hợp với tin, mời báo giá qua thông báo hoặc gọi điện. */
export default function MatchPartners({ listingId, title }: { listingId: string; title: string }) {
  const { toast } = useAdmin();
  const router = useRouter();
  const [list, setList] = useState<M[] | null>(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setOpen(true); setList(null); setSel([]);
    const { data, error } = await createSupabaseBrowser().rpc('admin_match_companies', { _listing: listingId });
    if (error) { setOpen(false); return toast('err', error.message); }
    setList(data as M[]);
  }
  async function invite() {
    setBusy(true);
    const { data, error } = await createSupabaseBrowser().rpc('admin_invite_quote', { _listing: listingId, _companies: sel });
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', `Đã mời ${data} doanh nghiệp báo giá`);
    setOpen(false);
    router.refresh();
  }
  const can = (m: M) => m.reachable && !m.invited && !m.quoted;

  return (
    <>
      <button type="button" className="ab o" onClick={load}><svg className="ic"><use href="#ic-send" /></svg> Gợi ý đối tác</button>
      {open && (
        <div className="adm-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="adm-modal wide" role="dialog" aria-modal="true" aria-label="Gợi ý đối tác">
            <h3>Đối tác phù hợp</h3>
            <p>{title}{'\n'}Hồ sơ có người quản lý thì mời được qua thông báo (tối đa {MAX}). Hồ sơ chưa có chủ cần gọi điện.</p>
            {!list ? <div className="sk" style={{ height: 160 }} /> : list.length === 0 ? <div className="adm-none">Chưa có doanh nghiệp cùng lĩnh vực.</div> : (
              <ul className="adm-matches">{list.map((m) => (
                <li key={m.id}>
                  <input type="checkbox" className="adm-check" aria-label={`Chọn ${m.name}`} disabled={!can(m) || (!sel.includes(m.id) && sel.length >= MAX)} checked={sel.includes(m.id)}
                    onChange={() => setSel(sel.includes(m.id) ? sel.filter((x) => x !== m.id) : [...sel, m.id])} />
                  <div>
                    <Link href={`/admin/companies/${m.id}`}>{m.name}</Link>
                    <small>{[m.same_category ? 'đúng lĩnh vực' : 'cùng nhóm', m.near && 'cùng tỉnh', m.verified_tier !== 'none' && 'đã xác minh'].filter(Boolean).join(' · ')}</small>
                  </div>
                  {m.quoted ? <span className="bdg g">Đã báo giá</span> : m.invited ? <span className="bdg b">Đã mời</span>
                    : m.reachable ? <span className="bdg">Mời được</span>
                    : m.phone ? <a className="ab" href={`tel:${m.phone}`}><svg className="ic"><use href="#ic-phone" /></svg> {m.phone}</a> : <span className="bdg">Không có SĐT</span>}
                </li>
              ))}</ul>
            )}
            <div className="ft">
              <button type="button" className="ab" onClick={() => setOpen(false)}>Đóng</button>
              <button type="button" className="ab p" disabled={!sel.length || busy} onClick={invite}>{busy ? 'Đang gửi…' : `Mời ${sel.length || ''} doanh nghiệp`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
