'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Result = {
  companies: { id: string; name: string; phone: string | null; tax_code: string | null; has_owner: boolean }[];
  users: { id: string; name: string | null; email: string | null; phone: string | null }[];
};
type Item = { key: string; href: string; title: string; sub: string; group: string };

/** Tìm nhanh toàn hệ thống: nút trên thanh tiêu đề hoặc Ctrl/⌘ + K. */
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState('');
  const [at, setAt] = useState(0);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setItems(null); setErr(''); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const { data, error } = await createSupabaseBrowser().rpc('admin_search', { _q: q });
      if (stale) return;
      if (error) return setErr(error.message);
      const r = data as Result;
      setErr(''); setAt(0);
      setItems([
        ...r.companies.map((c) => ({ key: c.id, href: `/admin/companies/${c.id}`, title: c.name, group: 'Doanh nghiệp', sub: [c.phone, c.tax_code && `MST ${c.tax_code}`, c.has_owner ? 'đã có chủ' : 'chưa có chủ'].filter(Boolean).join(' · ') })),
        ...r.users.map((u) => ({ key: u.id, href: `/admin/users/${u.id}`, title: u.name || u.email || 'Chưa đặt tên', group: 'Người dùng', sub: [u.email, u.phone].filter(Boolean).join(' · ') })),
      ]);
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [q, open]);

  function go(href: string) { setOpen(false); setQ(''); router.push(href); }
  function onKey(e: React.KeyboardEvent) {
    if (!items?.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((at + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((at - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); go(items[at].href); }
  }

  return (
    <>
      <button type="button" className="adm-search-btn" onClick={() => setOpen(true)} aria-label="Tìm kiếm (Ctrl K)">
        <svg className="ic"><use href="#ic-search" /></svg><span>Tìm SĐT, MST, tên…</span><kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div className="adm-modal-bg adm-cmd-bg" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="adm-cmd" role="dialog" aria-modal="true" aria-label="Tìm kiếm">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Số điện thoại, mã số thuế, email hoặc tên…" aria-label="Từ khóa" />
            <div className="res">
              {err ? <p className="none">{err}</p>
                : !items ? <p className="none">{q.trim().length < 2 ? 'Gõ ít nhất 2 ký tự.' : 'Đang tìm…'}</p>
                : items.length === 0 ? <p className="none">Không tìm thấy kết quả.</p>
                : items.map((it, i) => (
                  <div key={it.key}>
                    {(i === 0 || items[i - 1].group !== it.group) && <h4>{it.group}</h4>}
                    <button type="button" className={i === at ? 'on' : ''} onMouseEnter={() => setAt(i)} onClick={() => go(it.href)}><b>{it.title}</b><small>{it.sub}</small></button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
