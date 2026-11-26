'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function ClaimButton({ companyId, note }: { companyId: string; note: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function claim() {
    if (!confirm('Xác nhận bạn là đại diện của doanh nghiệp này?')) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await createSupabaseBrowser().rpc('claim_company', { _company: companyId, _note: note });
    setBusy(false);
    if (error) return setErr(error.message);
    if (data === 'pending') return setPending(true); // chưa khớp email/SĐT đã xác thực → chờ admin duyệt
    window.location.assign(`/dashboard/switch?to=${companyId}`);
  }

  if (pending) return <span className="badge orange">Đã gửi — chờ duyệt thủ công</span>;

  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn btn-orange btn-sm" disabled={busy} onClick={claim}>{busy ? 'Đang xử lý…' : 'Nhận hồ sơ'}</button>
      {err && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4, maxWidth: 220 }}>{err}</div>}
    </div>
  );
}
