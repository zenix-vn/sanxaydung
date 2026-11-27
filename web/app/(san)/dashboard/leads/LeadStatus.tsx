'use client';
import { useState } from 'react';
import { supa as loadSupa } from '@/lib/supabase/lazy';

const OPTS = [
  { v: 'new', label: 'Mới' },
  { v: 'contacted', label: 'Đã liên hệ' },
  { v: 'done', label: 'Hoàn tất' },
  { v: 'spam', label: 'Rác' },
];

export default function LeadStatus({ id, status }: { id: string; status: string }) {
  const [v, setV] = useState(status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function change(next: string) {
    const prev = v;
    setV(next); setBusy(true); setErr(false);
    const { error } = await (await loadSupa()).from('site_leads').update({ status: next }).eq('id', id);
    setBusy(false);
    if (error) { setV(prev); setErr(true); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={v} disabled={busy} onChange={(e) => change(e.target.value)} aria-label="Trạng thái yêu cầu">
        {OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      {err && <small style={{ color: 'var(--red)' }}>Chưa lưu được</small>}
    </div>
  );
}
