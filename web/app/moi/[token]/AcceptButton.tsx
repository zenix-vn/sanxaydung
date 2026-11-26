'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function AcceptButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function accept() {
    setBusy(true);
    setErr(null);
    const { data, error } = await createSupabaseBrowser().rpc('accept_invitation', { _token: token });
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    // Chuyển sang công ty vừa tham gia
    window.location.assign(`/dashboard/switch?to=${data as string}`);
  }
  return (
    <>
      {err && <div className="notice" style={{ background: '#fdecea', color: '#a12622', marginBottom: 12 }}>{err}</div>}
      <button className="btn btn-orange btn-lg" onClick={accept} disabled={busy}>{busy ? 'Đang xử lý…' : 'Nhận lời mời'}</button>
    </>
  );
}
