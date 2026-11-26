'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export type Picked = { id: string; name: string; phone: string | null };

/** Gõ tên / SĐT / slug rồi chọn một doanh nghiệp. */
export default function CompanyPicker({ value, onChange }: { value: Picked | null; onChange: (c: Picked | null) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Picked[] | null>(null);

  useEffect(() => {
    const key = q.trim().replace(/^.*\/cong-ty\//, '').replace(/[%,()/]/g, '');
    if (value || key.length < 2) { setList(null); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const { data } = await createSupabaseBrowser().from('companies').select('id, name, phone')
        .is('deleted_at', null).or(`name.ilike.%${key}%,phone.ilike.%${key}%,slug.ilike.%${key}%`).limit(8);
      if (!stale) setList((data ?? []) as Picked[]);
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [q, value]);

  if (value) {
    return (
      <div className="adm-picked">
        <span><b>{value.name}</b>{value.phone && <small> · {value.phone}</small>}</span>
        <button type="button" className="ab" onClick={() => { onChange(null); setQ(''); }}>Đổi</button>
      </div>
    );
  }
  return (
    <div className="adm-pick">
      <input className="adm-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ tên, SĐT hoặc slug doanh nghiệp…" aria-label="Tìm doanh nghiệp" />
      {list && (
        <ul>
          {list.length === 0 ? <li className="none">Không tìm thấy</li> : list.map((c) => (
            <li key={c.id}><button type="button" onClick={() => onChange(c)}><b>{c.name}</b><small>{c.phone}</small></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
