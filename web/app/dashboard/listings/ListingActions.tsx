'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Patch = { status?: string; deadline?: string | null; deleted_at?: string };

/** Thao tác nhanh trên một tin đăng của công ty (RLS: biên tập viên trở lên). */
export function ListingActions({ id, status, deadline }: { id: string; status: string; deadline: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(p: Patch, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    const { error } = await createSupabaseBrowser().from('marketplace_listings').update(p).eq('id', id);
    setBusy(false);
    if (error) return alert(error.message);
    router.refresh();
  }

  // Gia hạn: +14 ngày tính từ hạn cũ (hoặc hôm nay nếu đã quá hạn) và mở lại tin
  function extend() {
    const base = deadline && new Date(deadline) > new Date() ? new Date(deadline) : new Date();
    base.setDate(base.getDate() + 14);
    patch({ status: 'open', deadline: base.toISOString().slice(0, 10) });
  }

  return (
    <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <a className="btn-link" href={`/dashboard/listings/${id}/edit`}>Sửa</a>
      {status === 'open' && (
        <>
          <button className="btn-link" disabled={busy} onClick={() => patch({ status: 'fulfilled' }, 'Đánh dấu đã tìm được đối tác? Tin sẽ ngừng nhận báo giá.')}>Hoàn tất</button>
          <button className="btn-link" disabled={busy} onClick={() => patch({ status: 'closed' }, 'Đóng tin này? Tin sẽ ẩn khỏi marketplace.')}>Đóng</button>
        </>
      )}
      {status !== 'open' && <button className="btn-link" disabled={busy} onClick={extend}>Mở lại +14 ngày</button>}
      {status === 'open' && <button className="btn-link" disabled={busy} onClick={extend}>Gia hạn</button>}
      <button className="btn-link danger" disabled={busy} onClick={() => patch({ deleted_at: new Date().toISOString() }, 'Xóa tin này? Báo giá đã nhận vẫn được lưu nhưng tin sẽ không còn hiển thị.')}>Xóa</button>
    </div>
  );
}

/** Rút báo giá mình đã gửi. */
export function WithdrawQuote({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm('Rút báo giá này? Bên đăng tin sẽ không còn thấy báo giá của bạn.')) return;
    setBusy(true);
    const { error } = await createSupabaseBrowser().from('quotes').update({ status: 'withdrawn' }).eq('id', id);
    setBusy(false);
    if (error) return alert(error.message);
    router.refresh();
  }
  return <button className="btn-link danger" disabled={busy} onClick={run}>Rút</button>;
}
