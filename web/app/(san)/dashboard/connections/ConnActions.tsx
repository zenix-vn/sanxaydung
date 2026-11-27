'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

/** Chấp nhận / từ chối / xác nhận hoàn tất một kết nối (RPC kiểm tra quyền admin). */
export default function ConnActions({ id, companyId, mode }: { id: string; companyId: string; mode: 'respond' | 'complete' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: string, args: Record<string, unknown>, ask?: string) {
    if (ask && !confirm(ask)) return;
    setBusy(true);
    const { error } = await createSupabaseBrowser().rpc(fn, args);
    setBusy(false);
    if (error) return alert(error.message);
    router.refresh();
  }
  if (mode === 'respond') {
    return (
      <>
        <button className="btn btn-orange btn-sm" disabled={busy} onClick={() => run('respond_connection', { _connection: id, _as_company: companyId, _accept: true })}>Chấp nhận</button>
        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run('respond_connection', { _connection: id, _as_company: companyId, _accept: false }, 'Từ chối yêu cầu kết nối này?')}>Từ chối</button>
      </>
    );
  }
  return (
    <button
      className="btn btn-outline btn-sm"
      disabled={busy}
      onClick={() => run('complete_connection', { _connection: id, _as_company: companyId }, 'Xác nhận đã hoàn tất hợp tác? Sau đó hai bên có thể đánh giá lẫn nhau.')}
    >
      Đã hoàn tất hợp tác
    </button>
  );
}
